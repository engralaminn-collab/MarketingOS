import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { transcribeFreeSpeech } from '@/lib/ai-extensions';
import { generateChatCompletion } from '@/lib/ai-provider';

function pad2(n: number) {
  return String(Math.floor(n)).padStart(2, '0');
}

function formatSrtTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(ms).padStart(3, '0')}`;
}

function formatVttTime(sec: number) {
  return formatSrtTime(sec).replace(',', '.');
}

function buildCaptionsFromTranscript(
  text: string,
  wordsPerMinute = 145,
  rawSegments?: Array<{ start: number; end: number; text: string }>,
) {
  const cues: Array<{ index: number; start: number; end: number; text: string }> = [];

  if (rawSegments && rawSegments.length > 0) {
    rawSegments.forEach((seg, idx) => {
      cues.push({
        index: idx + 1,
        start: Number(seg.start.toFixed(2)),
        end: Number(Math.max(seg.start + 0.8, seg.end).toFixed(2)),
        text: seg.text.trim(),
      });
    });
  } else {
    const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const secPerWord = 60 / Math.max(80, Math.min(220, wordsPerMinute));
    const chunkSize = 9;
    let cursor = 0;
    let idx = 1;
    for (let i = 0; i < words.length; i += chunkSize) {
      const slice = words.slice(i, i + chunkSize).join(' ');
      const dur = Math.max(1.4, slice.split(' ').length * secPerWord);
      cues.push({
        index: idx++,
        start: Number(cursor.toFixed(2)),
        end: Number((cursor + dur).toFixed(2)),
        text: slice,
      });
      cursor += dur + 0.12;
    }
  }

  const srt = cues
    .map((c) => `${c.index}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${c.text}`)
    .join('\n\n');

  const vtt = `WEBVTT\n\n${cues
    .map((c) => `${formatVttTime(c.start)} --> ${formatVttTime(c.end)}\n${c.text}`)
    .join('\n\n')}`;

  return { cues, srt, vtt };
}

function extractMeetingNotesDeterministic(transcript: string) {
  const sentences = transcript
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);

  const actionPattern = /\b(will|need to|must|action|todo|follow up|assign|deadline|by friday|by monday|next step|schedule|send|prepare|launch)\b/i;
  const decisionPattern = /\b(decided|agreed|approved|confirmed|chosen|finalized|selected|moving forward with)\b/i;

  const actionItems = sentences.filter((s) => actionPattern.test(s)).slice(0, 6);
  const decisions = sentences.filter((s) => decisionPattern.test(s)).slice(0, 4);
  const summaryBullets = sentences.slice(0, 4);

  return {
    summary: summaryBullets.join(' ') || transcript.slice(0, 300),
    actionItems: actionItems.length ? actionItems : ['Review transcript and assign owners + deadlines in CRM/Tasks.'],
    decisions: decisions.length ? decisions : ['No formal decision marker detected; confirm key takeaways with attendees.'],
  };
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'JSON body required' }, { status: 400 });
    }

    let transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
    let provider = 'script-alignment';
    let rawSegments: Array<{ start: number; end: number; text: string }> | undefined;

    if (typeof body.audioBase64 === 'string' && body.audioBase64.length > 32) {
      const stt = await transcribeFreeSpeech({
        audioBase64: body.audioBase64,
        mimeType: typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm',
        language: typeof body.language === 'string' ? body.language : undefined,
      });
      if (stt) {
        transcript = stt.text;
        provider = stt.provider;
        rawSegments = stt.segments;
      } else if (!transcript) {
        return NextResponse.json(
          {
            error:
              'Server-side Whisper STT is not configured yet (set GROQ_API_KEY for free whisper-large-v3-turbo or LOCAL_STT_BASE_URL). Use Browser Live Voice Dictation or paste your transcript to generate SRT/VTT & meeting notes immediately.',
          },
          { status: 503 },
        );
      }
    }

    if (!transcript) {
      return NextResponse.json({ error: 'Provide transcript text or audioBase64' }, { status: 400 });
    }

    const wpm = Number(body.wordsPerMinute) || 145;
    const { cues, srt, vtt } = buildCaptionsFromTranscript(transcript, wpm, rawSegments);
    let meetingNotes = extractMeetingNotesDeterministic(transcript);
    let translatedSrt: string | null = null;
    const targetLanguage = typeof body.translateTo === 'string' ? body.translateTo.trim() : '';

    if (targetLanguage && targetLanguage.toLowerCase() !== 'none') {
      try {
        const tr = await generateChatCompletion(
          [
            {
              role: 'system',
              content: `Translate the following SRT subtitle cues into ${targetLanguage}. Keep exact cue numbers and timestamps unchanged. Return ONLY valid SRT.`,
            },
            { role: 'user', content: srt.slice(0, 6_000) },
          ],
          { temperature: 0.2 },
        );
        translatedSrt = tr.content;
      } catch {
        translatedSrt = null;
      }
    }

    try {
      const llmNotes = await generateChatCompletion(
        [
          {
            role: 'system',
            content: 'Extract concise meeting notes from this transcript. Return JSON only: {"summary":"...","actionItems":["..."],"decisions":["..."]}',
          },
          { role: 'user', content: transcript.slice(0, 6_000) },
        ],
        { temperature: 0.2 },
      );
      const m = llmNotes.content.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (parsed.summary) {
          meetingNotes = {
            summary: String(parsed.summary),
            actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.map(String) : meetingNotes.actionItems,
            decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map(String) : meetingNotes.decisions,
          };
        }
      }
    } catch {
      // Keep deterministic meeting notes
    }

    return NextResponse.json({
      data: {
        transcript,
        provider,
        cues,
        srt,
        vtt,
        translatedSrt,
        meetingNotes,
      },
    });
  } catch (error) {
    console.error('[POST /api/ai/transcribe]', error);
    return NextResponse.json({ error: 'Transcription & captioning failed' }, { status: 500 });
  }
}
