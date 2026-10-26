'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CircleStop,
  Download,
  FileVideo,
  Image as ImageIcon,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  Server,
  Sparkles,
  Square,
  Upload,
  UserCircle,
  Volume2,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  charToViseme,
  drawTalkingFrame,
  ease,
  formatDuration,
  pickVideoMime,
  rmsEnergy,
  visemeToMouth,
  type MouthState,
  type VisemeName,
} from '@/lib/talking-head';
import { apiFetch, useApiQuery } from '@/hooks/use-api';

interface Capabilities {
  tiers: Array<{ id: string; label: string; available: boolean; detail: string; env: string | null }>;
  configured: { lipsyncAdapter: boolean; localTts: boolean; videoAdapter: boolean; hostedMedia: boolean };
  limits: { maxScriptChars: number; maxPhotoBytes: number; recommendedFps: number };
}

const SCRIPT_PRESETS = [
  {
    id: 'welcome',
    label: 'Welcome / intro',
    text: 'Hi, I am your brand assistant. In the next thirty seconds I will show you how our service saves you time, what it costs, and how to start today.',
  },
  {
    id: 'offer',
    label: 'Offer announcement',
    text: 'This month we are opening ten onboarding slots. You get a written plan in two working days, a dedicated adviser, and no fee until you are matched.',
  },
  {
    id: 'explainer',
    label: 'Quick explainer',
    text: 'Here is how it works. First we review your goals. Then we build a plan you can approve. Finally we deliver, measure, and report back every month.',
  },
];

const SIZES = [
  { id: 'square', label: 'Square 720×720', width: 720, height: 720 },
  { id: 'landscape', label: 'Landscape 1280×720', width: 1280, height: 720 },
  { id: 'portrait', label: 'Portrait 720×1280', width: 720, height: 1280 },
];

export function LiveTalkStudio() {
  // useApiQuery unwraps the { data } envelope, so this is the capability object itself.
  const capabilities = useApiQuery<Capabilities>('/api/media/talking-head');

  const [photo, setPhoto] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [script, setScript] = useState(SCRIPT_PRESETS[0].text);
  const [sizeId, setSizeId] = useState('square');
  const [voiceName, setVoiceName] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [modeChoice, setModeChoice] = useState<'auto' | 'browser' | 'local-tts'>('auto');
  const [status, setStatus] = useState<'idle' | 'speaking' | 'recording'>('idle');
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedSize, setRecordedSize] = useState<number>(0);
  const [silentRecording, setSilentRecording] = useState(false);
  const [lipsyncTask, setLipsyncTask] = useState<string | null>(null);
  const [mouthAnchor, setMouthAnchor] = useState({ x: 0.5, y: 0.66 });
  const [busy, setBusy] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const mouthRef = useRef<MouthState>({ open: 0.08, round: 0.35, wide: 0.55, energy: 0 });
  const targetVisemeRef = useRef<VisemeName>('rest');
  const blinkRef = useRef(0);
  const nextBlinkRef = useRef(2000);
  const startedAtRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const speakingRef = useRef(false);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const config = capabilities.data;
  const localTtsAvailable = Boolean(config?.configured.localTts);
  const lipsyncAvailable = Boolean(config?.configured.lipsyncAdapter);
  const activeSize = SIZES.find((size) => size.id === sizeId) ?? SIZES[0];
  const words = script.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = Math.max(2, Math.round((words / 150) * 60));

  // useEffect instead of useState initialiser: voices load asynchronously and
  // touch window APIs, which must not run during server rendering.
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis?.getVoices?.() ?? []);
    load();
    window.speechSynthesis?.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', load);
  }, []);

  // Derived, not stored: avoids a setState-in-effect cascade. The operator's
  // explicit choice wins; otherwise pick the first installed English voice.
  const activeVoiceName = voiceName || voices.find((voice) => /^en/i.test(voice.lang))?.name || voices[0]?.name || '';
  const mode: 'browser' | 'local-tts' =
    modeChoice === 'auto' ? (localTtsAvailable ? 'local-tts' : 'browser') : modeChoice;

  // ── animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      const now = performance.now();

      // blinking
      if (now > nextBlinkRef.current) {
        blinkRef.current = 1;
        nextBlinkRef.current = now + 2200 + Math.random() * 3200;
      }
      blinkRef.current = Math.max(0, blinkRef.current - 0.12);

      // mouth target: real audio envelope when available, otherwise visemes
      let target: MouthState;
      const analyser = analyserRef.current;
      if (analyser && bufferRef.current) {
        analyser.getByteTimeDomainData(bufferRef.current);
        const energy = rmsEnergy(bufferRef.current);
        target = {
          open: Math.min(1, 0.06 + energy * 1.35),
          round: 0.3 + Math.sin(now / 220) * 0.18 + 0.18,
          wide: 0.55 + Math.cos(now / 310) * 0.18,
          energy,
        };
      } else if (speakingRef.current) {
        const viseme = visemeToMouth(targetVisemeRef.current, 0.7);
        // slight jitter keeps the mouth alive between boundary events
        target = { ...viseme, open: viseme.open * (0.82 + Math.sin(now / 90) * 0.14), energy: 0.65 };
      } else {
        target = { open: 0.06, round: 0.35, wide: 0.55, energy: 0 };
      }

      const mouth = mouthRef.current;
      mouthRef.current = {
        open: ease(mouth.open, target.open, 0.42),
        round: ease(mouth.round, target.round, 0.3),
        wide: ease(mouth.wide, target.wide, 0.3),
        energy: ease(mouth.energy, target.energy, 0.25),
      };

      drawTalkingFrame(
        ctx,
        imageRef.current,
        {
          timeMs: now - startedAtRef.current,
          mouth: mouthRef.current,
          blink: blinkRef.current,
          sway: speakingRef.current ? Math.sin(now / 640) * 3 : 0,
        },
        {
          width: canvas.width,
          height: canvas.height,
          mouthAnchor,
          label: status === 'recording' ? 'recording' : undefined,
        }
      );

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [status, mouthAnchor]);

  // Leaving the view must not leave a recorder, an oscillator or an audio
  // context running behind the user's back.
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // recorder already torn down
        }
      }
      if (sourceRef.current) {
        try {
          sourceRef.current.stop();
        } catch {
          // already finished
        }
      }
      window.speechSynthesis?.cancel();
      void audioCtxRef.current?.close().catch(() => undefined);
      audioCtxRef.current = null;
    };
  }, []);

  // ── photo handling ────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    const maxBytes = config?.limits.maxPhotoBytes ?? 6 * 1024 * 1024;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > maxBytes) {
      toast.error(`Photo must be under ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        setPhoto(dataUrl);
        toast.success('Photo loaded — it stays in this browser tab.');
      };
      img.onerror = () => toast.error('That image could not be decoded.');
      img.src = dataUrl;
    };
    reader.onerror = () => toast.error('Could not read that file.');
    reader.readAsDataURL(file);
  }, [config?.limits.maxPhotoBytes]);

  const clearPhoto = () => {
    imageRef.current = null;
    setPhoto(null);
  };

  // ── speech ────────────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    speakingRef.current = false;
    window.speechSynthesis?.cancel();
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // already finished — nothing to stop
      }
      sourceRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    audioDestinationRef.current = null;
    analyserRef.current = null;
    setStatus('idle');
  }, []);

  const speakWithBrowserVoice = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!('speechSynthesis' in window)) {
        toast.error('This browser has no speech synthesis. Use the recorded-voice tier with local TTS.');
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = voices.find((item) => item.name === activeVoiceName);
      if (voice) utterance.voice = voice;
      utterance.rate = 0.98;
      utterance.pitch = 1;
      utterance.onboundary = (event) => {
        const char = text[event.charIndex] ?? ' ';
        targetVisemeRef.current = charToViseme(char);
      };
      utterance.onstart = () => {
        speakingRef.current = true;
        startedAtRef.current = performance.now();
        setStatus('speaking');
      };
      utterance.onend = () => {
        speakingRef.current = false;
        targetVisemeRef.current = 'rest';
        setStatus('idle');
        onEnd?.();
      };
      utterance.onerror = () => {
        speakingRef.current = false;
        setStatus('idle');
        onEnd?.();
      };
      window.speechSynthesis.speak(utterance);
    },
    [voices, activeVoiceName]
  );

  const playWithLocalTts = useCallback(
    async (text: string, record: boolean) => {
      setBusy(record ? 'record' : 'play');
      try {
        const result = await apiFetch<{ data: { audioUrl: string } }>('/api/media/talking-head/audio', {
          method: 'POST',
          body: JSON.stringify({ text, voice: 'default' }),
        });

        const ctx = audioCtxRef.current ?? new AudioContext();
        audioCtxRef.current = ctx;
        await ctx.resume();
        const binary = await fetch(result.data.audioUrl).then((res) => res.arrayBuffer());
        const audioBuffer = await ctx.decodeAudioData(binary);

        const source = ctx.createBufferSource();
        sourceRef.current = source;
        source.buffer = audioBuffer;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyserRef.current = analyser;
        bufferRef.current = new Uint8Array(analyser.fftSize);

        source.connect(analyser);
        analyser.connect(ctx.destination);

        if (record) {
          const canvas = canvasRef.current;
          if (!canvas) throw new Error('Canvas is not ready');
          const stream = canvas.captureStream(30);
          const destination = ctx.createMediaStreamDestination();
          analyser.connect(destination);
          audioDestinationRef.current = destination;
          destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));

          const recorder = new MediaRecorder(stream, { mimeType: pickVideoMime(), videoBitsPerSecond: 3_500_000 });
          chunksRef.current = [];
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunksRef.current.push(event.data);
          };
          recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            setRecordedUrl((previous) => {
              if (previous) URL.revokeObjectURL(previous);
              return URL.createObjectURL(blob);
            });
            setRecordedSize(blob.size);
            setSilentRecording(false);
            setStatus('idle');
            toast.success('Clip recorded with voice.');
          };
          recorderRef.current = recorder;
          recorder.start(250);
          setStatus('recording');
        } else {
          setStatus('speaking');
        }

        speakingRef.current = true;
        startedAtRef.current = performance.now();
        source.onended = () => {
          speakingRef.current = false;
          sourceRef.current = null;
          analyserRef.current = null;
          setStatus('idle');
          if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
        };
        source.start();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Audio generation failed';
        toast.error(message);
        setStatus('idle');
        if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const playLive = useCallback(() => {
    if (!consent) {
      toast.error('Confirm you have permission to use this face before playing or recording.');
      return;
    }
    if (mode === 'local-tts' && localTtsAvailable) {
      void playWithLocalTts(script, false);
    } else {
      speakWithBrowserVoice(script);
    }
  }, [consent, mode, localTtsAvailable, playWithLocalTts, script, speakWithBrowserVoice]);

  const recordClip = useCallback(() => {
    if (!consent) {
      toast.error('Confirm you have permission to use this face before recording.');
      return;
    }
    if (mode === 'local-tts' && localTtsAvailable) {
      void playWithLocalTts(script, true);
      return;
    }
    // Browser voice cannot be captured as a stream, so the clip is silent by design.
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: pickVideoMime(), videoBitsPerSecond: 3_500_000 });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(blob);
      });
      setRecordedSize(blob.size);
      setSilentRecording(true);
      setStatus('idle');
      toast.success('Silent clip recorded. Configure local TTS to record with voice.');
    };
    recorderRef.current = recorder;
    recorder.start(250);
    setStatus('recording');
    speakWithBrowserVoice(script, () => {
      setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, 350);
    });
  }, [consent, mode, localTtsAvailable, playWithLocalTts, script, speakWithBrowserVoice]);

  const submitLipsync = useCallback(async () => {
    if (!lipsyncAvailable) {
      toast.error('Set LIPSYNC_ADAPTER_URL to a local lip-sync service first.');
      return;
    }
    if (!photo) {
      toast.error('Upload the client-supplied photo first.');
      return;
    }
    if (!consent) {
      toast.error('Consent must be confirmed before submitting a render.');
      return;
    }
    setBusy('lipsync');
    try {
      let audio: string | null = null;
      if (localTtsAvailable) {
        try {
          const result = await apiFetch<{ data: { audioUrl: string } }>('/api/media/talking-head/audio', {
            method: 'POST',
            body: JSON.stringify({ text: script, voice: 'default' }),
          });
          audio = result.data.audioUrl;
        } catch {
          audio = null;
        }
      }
      const response = await apiFetch<{ data: { taskId: string } }>('/api/media/lipsync', {
        method: 'POST',
        body: JSON.stringify({ image: photo, audio, script, width: activeSize.width, height: activeSize.height }),
      });
      setLipsyncTask(response.data.taskId);
      toast.success(`Job ${response.data.taskId} queued on the local adapter`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit the job');
    } finally {
      setBusy(null);
    }
  }, [lipsyncAvailable, photo, consent, localTtsAvailable, script, activeSize]);

  const reset = () => {
    stopAll();
    setRecordedUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    setRecordedSize(0);
    setSilentRecording(false);
  };

  return (
    <div id="live-talk-studio" className="scroll-mt-24 space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle className="h-4 w-4 text-primary" /> Live talk agent
            <Badge variant="outline" className="ml-1 text-[10px]">runs in this browser</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Turn a client-supplied photo plus a script into a talking clip. The photo stays in this tab; nothing is uploaded to the
            server unless you submit a local lip-sync job.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-12">
          {/* stage */}
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-black">
              <canvas
                ref={canvasRef}
                width={activeSize.width}
                height={activeSize.height}
                className="h-auto w-full"
                aria-label="Talking head preview"
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={playLive} disabled={status !== 'idle' || busy !== null}>
                <Play className="mr-1.5 h-3.5 w-3.5" /> Play live
              </Button>
              <Button size="sm" variant="outline" onClick={recordClip} disabled={status !== 'idle' || busy !== null}>
                {busy === 'record' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Square className="mr-1.5 h-3.5 w-3.5" />}
                Record clip
              </Button>
              <Button size="sm" variant="ghost" onClick={stopAll} disabled={status === 'idle'}>
                <CircleStop className="mr-1.5 h-3.5 w-3.5" /> Stop
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
              </Button>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {status === 'recording' ? '● recording' : status === 'speaking' ? 'speaking…' : `${formatDuration(estimatedSeconds * 1000)} est. · ~${words} words`}
              </span>
            </div>

            {recordedUrl && (
              <div className="mt-3 rounded-xl border border-emerald-300/50 bg-emerald-500/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-medium">
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Clip ready
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {(recordedSize / 1024 / 1024).toFixed(2)} MB · WebM{silentRecording ? ' · silent (no local TTS)' : ' · with voice'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" asChild>
                      <a href={recordedUrl} download={`talking-head-${Date.now()}.webm`}>
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={recordedUrl} target="_blank" rel="noreferrer noopener">
                        <FileVideo className="mr-1.5 h-3.5 w-3.5" /> Open
                      </a>
                    </Button>
                  </div>
                </div>
                {silentRecording && (
                  <p className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    Browsers do not expose their speech output as a stream, so this clip has no audio track. Configure
                    LOCAL_TTS_BASE_URL to record with a real voice.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* controls */}
          <div className="space-y-3 lg:col-span-5">
            <div className="space-y-1.5">
              <Label className="text-xs">1. Client-supplied photo</Label>
              <div className="flex items-center gap-2">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground hover:bg-accent">
                  <Upload className="h-3.5 w-3.5" />
                  {photo ? 'Replace photo' : 'Upload JPG / PNG / WebP'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                {photo && (
                  <Button variant="ghost" size="sm" className="h-8 text-[11px]" onClick={clearPhoto}>
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Without a photo the studio draws a neutral presenter so you can still test the pipeline.
              </p>
              {photo && (
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/30 p-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Mouth height {Math.round(mouthAnchor.y * 100)}%</Label>
                    <input
                      type="range"
                      min={40}
                      max={88}
                      value={Math.round(mouthAnchor.y * 100)}
                      onChange={(event) => setMouthAnchor((prev) => ({ ...prev, y: Number(event.target.value) / 100 }))}
                      className="w-full accent-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Mouth offset {Math.round(mouthAnchor.x * 100)}%</Label>
                    <input
                      type="range"
                      min={20}
                      max={80}
                      value={Math.round(mouthAnchor.x * 100)}
                      onChange={(event) => setMouthAnchor((prev) => ({ ...prev, x: Number(event.target.value) / 100 }))}
                      className="w-full accent-primary"
                    />
                  </div>
                  <p className="col-span-2 text-[9px] text-muted-foreground">
                    Drag until the animated mouth sits over the mouth in the photo. This is a 2D overlay, not a warped mesh.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-amber-300/50 bg-amber-500/5 p-2.5">
              <label className="flex items-start gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5"
                />
                <span>
                  I confirm the client supplied this photo and has given written permission to use this person&apos;s likeness.
                  Recording and lip-sync submission stay blocked until this is ticked.
                </span>
              </label>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">2. Script</Label>
              <textarea
                value={script}
                onChange={(event) => setScript(event.target.value.slice(0, config?.limits.maxScriptChars ?? 4000))}
                rows={4}
                className="w-full rounded-lg border border-border bg-background p-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                placeholder="What should the agent say?"
              />
              <div className="flex flex-wrap gap-1">
                {SCRIPT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setScript(preset.text)}
                    className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  onClick={() => setScript(script.trim().replace(/\s+/g, ' '))}
                  className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                >
                  <Wand2 className="mr-0.5 inline h-2.5 w-2.5" /> tidy spacing
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Frame</Label>
                <Select value={sizeId} onValueChange={setSizeId}>
                  <SelectTrigger className="h-8 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIZES.map((size) => (
                      <SelectItem key={size.id} value={size.id}>{size.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Voice tier</Label>
                <Select
                  value={mode}
                  onValueChange={(value) => setModeChoice(value as 'auto' | 'browser' | 'local-tts')}
                >
                  <SelectTrigger className="h-8 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local-tts" disabled={!localTtsAvailable}>
                      Local TTS {localTtsAvailable ? '(records with voice)' : '(not configured)'}
                    </SelectItem>
                    <SelectItem value="browser">Browser voice (silent recording)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {mode === 'browser' && voices.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Browser voice</Label>
                <Select value={activeVoiceName} onValueChange={setVoiceName}>
                  <SelectTrigger className="h-8 text-[11px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {voices.slice(0, 40).map((voice) => (
                      <SelectItem key={voice.name} value={voice.name}>
                        {voice.name} · {voice.lang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
                  <Volume2 className="mt-0.5 h-3 w-3 shrink-0" />
                  Preview only: the OS voice is heard but cannot be captured into the file.
                </p>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <p className="text-[11px] font-medium">3. Photoreal lip-sync (optional, local GPU)</p>
              {lipsyncAvailable ? (
                <Button size="sm" variant="outline" className="w-full" onClick={submitLipsync} disabled={busy !== null || !photo || !consent}>
                  {busy === 'lipsync' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Server className="mr-1.5 h-3.5 w-3.5" />}
                  Submit job to local adapter
                </Button>
              ) : (
                <p className="rounded-lg border border-border/60 bg-muted/40 p-2 text-[10px] leading-relaxed text-muted-foreground">
                  Not configured. Set <code className="font-mono">LIPSYNC_ADAPTER_URL</code> to a local SadTalker / Wav2Lip /
                  LiveTalk wrapper to render neural lip-sync. The in-browser animated head works without it.
                </p>
              )}
              {lipsyncTask && (
                <p className="rounded-lg border border-sky-300/50 bg-sky-500/5 p-2 text-[10px] text-sky-700 dark:text-sky-300">
                  Job <code className="font-mono">{lipsyncTask}</code> queued. Poll the adapter for the rendered clip.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* capability report */}
      <div className="grid gap-3 md:grid-cols-3">
        {(config?.tiers ?? []).map((tier) => (
          <Card key={tier.id} className="border-border/60">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium">{tier.label}</p>
                <Badge variant={tier.available ? 'success' : 'neutral'} className="shrink-0 text-[9px]">
                  {tier.available ? 'ready' : 'not configured'}
                </Badge>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{tier.detail}</p>
              {tier.env && <code className="mt-1 block font-mono text-[9px] text-muted-foreground/80">{tier.env}</code>}
            </CardContent>
          </Card>
        ))}
        {!config && (
          <Card className="border-border/60 md:col-span-3">
            <CardContent className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking which rendering tiers are available…
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-start gap-2 p-3 text-[10px] leading-relaxed text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="max-w-3xl">
            <span className="font-medium text-foreground">What this really is:</span> a real, downloadable talking clip generated
            from a still photo, with the mouth driven by the actual audio envelope (local TTS) or by speech boundary events (browser
            voice). It is an approximation, not a trained neural lip-sync model — the face does not deform photorealistically. For
            that, run a local lip-sync adapter and use the job button. No hosted provider, no voice cloning, and no photo leaves this
            browser unless you submit to your own adapter.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
