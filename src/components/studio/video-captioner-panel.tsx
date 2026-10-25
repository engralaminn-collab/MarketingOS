'use client';

import React, { useRef, useState } from 'react';
import {
  Captions,
  Download,
  Mic,
  MonitorPlay,
  Sparkles,
  Square,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/hooks/use-api';

const IMAGE_PROMPT_RECIPES = [
  {
    name: 'Editorial Product Flat-Lay',
    prompt: 'Overhead editorial studio photograph on warm limestone surface, matte ceramic coffee cup beside clean product packaging, crisp morning side-light, 50mm lens, zero text overlay, magazine art direction',
  },
  {
    name: 'Isometric SaaS Architecture Hero',
    prompt: 'Clean minimal isometric architectural model made of brushed aluminum, warm terracotta and frosted glass blocks on cream paper background, soft diffused studio lighting, Dieter Rams industrial design aesthetic',
  },
  {
    name: 'B2B Founder Documentary Portrait',
    prompt: 'Candid editorial environmental portrait in sunlit modern studio with whiteboards and plants softly out of focus, natural skin tones, 35mm film grain, Leica M11 look, authentic approachable expression',
  },
  {
    name: 'University Campus Study-Abroad Scene',
    prompt: 'Students walking across historic British sandstone university quad in golden autumn afternoon light, authentic documentary photography, natural colors, crisp detail',
  },
];

export function VideoCaptionerAndVoicePanel() {
  const [transcript, setTranscript] = useState(
    'Welcome to our Q4 growth review. Today we decided to shift 40% of ad spend into high-intent comparison pages and free calculators. Action item: Sarah will publish the UKVI 28-day CAS calculator by Friday and Marcus will configure Groq + Ollama fallback routing.',
  );
  const [translateTo, setTranslateTo] = useState('none');
  const [processing, setProcessing] = useState(false);
  const [captionResult, setCaptionResult] = useState<{
    srt: string;
    vtt: string;
    translatedSrt: string | null;
    meetingNotes: { summary: string; actionItems: string[]; decisions: string[] };
  } | null>(null);

  // Browser Web Speech live dictation
  const [dictating, setDictating] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Cap-style Screen Recorder
  const [recordingScreen, setRecordingScreen] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Free Cloud Image + gpt4o-image-prompts builder
  const [imgPrompt, setImgPrompt] = useState(IMAGE_PROMPT_RECIPES[0].prompt);
  const [imgProvider, setImgProvider] = useState<'pollinations' | 'huggingface' | 'cloudflare' | 'comfyui'>('pollinations');
  const [generatingImg, setGeneratingImg] = useState(false);
  const [generatedImgUrl, setGeneratedImgUrl] = useState<string | null>(null);

  async function handleGenerateCaptionsAndNotes() {
    if (!transcript.trim()) return;
    setProcessing(true);
    try {
      const res = await apiFetch<{ data: NonNullable<typeof captionResult> }>('/api/ai/transcribe', {
        method: 'POST',
        body: JSON.stringify({ transcript, translateTo }),
      });
      setCaptionResult(res.data);
      toast.success('Generated SRT, WebVTT & Doodle-Note meeting action items');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Captioning failed');
    } finally {
      setProcessing(false);
    }
  }

  function toggleDictation() {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast.info('Browser Web Speech API requires Chrome/Edge. Paste transcript or use Groq Whisper API.');
      return;
    }
    if (dictating && recognitionRef.current) {
      recognitionRef.current.stop();
      setDictating(false);
      return;
    }
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (ev: any) => {
      const chunk = Array.from(ev.results)
        .map((r: any) => r[0]?.transcript || '')
        .join(' ');
      setTranscript((prev) => `${prev} ${chunk}`.trim());
    };
    rec.onerror = () => setDictating(false);
    rec.onend = () => setDictating(false);
    recognitionRef.current = rec;
    rec.start();
    setDictating(true);
  }

  async function toggleScreenCapture() {
    if (recordingScreen && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecordingScreen(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'video/webm' });
        setRecordedVideoUrl(URL.createObjectURL(blob));
        toast.success('Screen demo recorded as WebM');
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingScreen(true);
    } catch {
      toast.info('Screen capture cancelled or unsupported in this browser tab');
    }
  }

  async function handleGenerateFreeImage() {
    if (!imgPrompt.trim()) return;
    setGeneratingImg(true);
    try {
      const res = await apiFetch<{ data: { imageUrl: string; provider: string } }>('/api/ai/generate-image', {
        method: 'POST',
        body: JSON.stringify({ prompt: imgPrompt, size: '1024x1024', provider: imgProvider }),
      });
      setGeneratedImgUrl(res.data.imageUrl);
      toast.success(`Rendered via ${res.data.provider}`);
    } catch (err) {
      toast.info(err instanceof Error ? err.message : 'Free cloud image endpoint offline — use Instant Local Graphic Maker tab');
    } finally {
      setGeneratingImg(false);
    }
  }

  function downloadText(name: string, text: string) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Captions className="h-4 w-4 text-orange-500" /> VideoCaptioner, Voice Dictation & Doodle-Note Meeting Extractor
            </CardTitle>
            <CardDescription>
              Generate `.srt` & `.vtt` subtitles, translate captions, dictate live via microphone, and extract meeting action items.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={dictating ? 'destructive' : 'outline'} onClick={toggleDictation}>
                <Mic className="mr-1.5 h-3.5 w-3.5" /> {dictating ? 'Stop Live Dictation' : 'Start Browser Voice Dictation'}
              </Button>
              <Button size="sm" variant={recordingScreen ? 'destructive' : 'outline'} onClick={toggleScreenCapture}>
                {recordingScreen ? <Square className="mr-1.5 h-3.5 w-3.5" /> : <MonitorPlay className="mr-1.5 h-3.5 w-3.5" />}
                {recordingScreen ? 'Stop Screen Recording' : 'Record Product Demo (Cap WebM)'}
              </Button>
            </div>

            {recordedVideoUrl && (
              <div className="rounded border p-2 space-y-1.5">
                <video src={recordedVideoUrl} controls className="w-full max-h-52 rounded" />
                <a href={recordedVideoUrl} download="product-demo.webm" className="text-xs text-primary underline">
                  Download Recorded WebM
                </a>
              </div>
            )}

            <Textarea rows={4} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs">Subtitle Translation:</Label>
              <select
                value={translateTo}
                onChange={(e) => setTranslateTo(e.target.value)}
                className="h-8 rounded border bg-background px-2 text-xs"
              >
                <option value="none">Original Language Only</option>
                <option value="Bengali">Bengali</option>
                <option value="Spanish">Spanish</option>
                <option value="Arabic">Arabic</option>
                <option value="French">French</option>
              </select>
              <Button size="sm" className="ml-auto" onClick={handleGenerateCaptionsAndNotes} disabled={processing}>
                <Wand2 className="mr-1.5 h-3.5 w-3.5" /> {processing ? 'Building...' : 'Build SRT/VTT & Meeting Notes'}
              </Button>
            </div>

            {captionResult && (
              <div className="grid gap-3 md:grid-cols-2 pt-2">
                <div className="rounded border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">SRT / WebVTT Subtitles</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => downloadText('captions.srt', captionResult.srt)}>
                        <Download className="mr-1 h-3 w-3" /> .SRT
                      </Button>
                      <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => downloadText('captions.vtt', captionResult.vtt)}>
                        <Download className="mr-1 h-3 w-3" /> .VTT
                      </Button>
                    </div>
                  </div>
                  <pre className="text-[11px] font-mono bg-muted/40 p-2 rounded max-h-44 overflow-y-auto whitespace-pre-wrap">
                    {captionResult.srt}
                  </pre>
                </div>

                <div className="rounded border p-3 space-y-2 text-xs">
                  <div className="font-semibold">Doodle-Note Structured Meeting Summary</div>
                  <p className="text-muted-foreground">{captionResult.meetingNotes.summary}</p>
                  <div className="font-semibold pt-1">Action Items:</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {captionResult.meetingNotes.actionItems.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                  <div className="font-semibold pt-1">Decisions:</div>
                  <ul className="list-disc pl-4 space-y-0.5 text-emerald-700 dark:text-emerald-400">
                    {captionResult.meetingNotes.decisions.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-500" /> GPT-4o / FLUX Marketing Image Prompt Builder
            </CardTitle>
            <CardDescription>Curated art-direction prompt recipes + free Pollinations / HF FLUX / ComfyUI rendering</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {IMAGE_PROMPT_RECIPES.map((r) => (
                <Button key={r.name} size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setImgPrompt(r.prompt)}>
                  {r.name}
                </Button>
              ))}
            </div>
            <Textarea rows={4} value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} className="text-xs" />
            <div className="flex gap-2">
              <select
                value={imgProvider}
                onChange={(e) => setImgProvider(e.target.value as typeof imgProvider)}
                className="h-9 rounded border bg-background px-2 text-xs flex-1"
              >
                <option value="pollinations">Pollinations.ai (Free Keyless)</option>
                <option value="huggingface">Hugging Face FLUX.1-schnell</option>
                <option value="cloudflare">Cloudflare Workers FLUX</option>
                <option value="comfyui">Self-Hosted ComfyUI</option>
              </select>
              <Button size="sm" onClick={handleGenerateFreeImage} disabled={generatingImg}>
                {generatingImg ? 'Rendering...' : 'Render'}
              </Button>
            </div>
            {generatedImgUrl && (
              <div className="rounded border p-2">
                <img src={generatedImgUrl} alt="Generated campaign creative" className="w-full rounded" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
