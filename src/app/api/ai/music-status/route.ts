import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getCompanyToolCredentials, ToolCredentialsError } from '@/lib/tool-credentials';

const MUREKA_TOOL_NUMBER = 120;
const MUREKA_QUERY_ENDPOINT = 'https://api.mureka.ai/v1/instrumental/query/';
const TASK_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function getBearer(req: NextRequest): string | null {
  return req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

function safeAudioUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return null;
    if (/^(?:0|10|127|169\.254|192\.168)\./.test(host)) return null;
    const private172 = host.match(/^172\.(\d+)\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null;
    if (host.startsWith('[')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function choicesFrom(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).flatMap((choice, index) => {
    if (!choice || typeof choice !== 'object' || Array.isArray(choice)) return [];
    const item = choice as Record<string, unknown>;
    const audioUrl = safeAudioUrl(item.audio_url ?? item.audioUrl ?? item.mp3_url ?? item.wav_url ?? item.url);
    const title = typeof item.title === 'string' ? item.title.slice(0, 160) : `Instrumental ${index + 1}`;
    return [{ title, audioUrl }];
  });
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearer(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const taskId = new URL(req.url).searchParams.get('taskId') || '';
    if (!TASK_ID_PATTERN.test(taskId)) return NextResponse.json({ error: 'A valid taskId is required' }, { status: 400 });

    // The task is only pollable by a member of the company that created its
    // audio draft; arbitrary provider task IDs cannot be used for cross-tenant reads.
    const draft = await db.content.findFirst({
      where: { companyId: actor.companyId, type: 'audio', body: { contains: `Mureka Task: ${taskId}` } },
      select: { id: true, body: true },
    });
    if (!draft) return NextResponse.json({ error: 'Audio task not found' }, { status: 404 });

    const integration = await getCompanyToolCredentials(actor.companyId, MUREKA_TOOL_NUMBER, ['MUREKA_API_KEY']);
    if (!integration) return NextResponse.json({ error: 'Connect Mureka in Integrations before checking audio tasks' }, { status: 503 });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    let response: Response;
    try {
      response = await fetch(`${MUREKA_QUERY_ENDPOINT}${encodeURIComponent(taskId)}`, {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${integration.MUREKA_API_KEY}` },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return NextResponse.json({ error: `Mureka status request failed (HTTP ${response.status})` }, { status: 502 });
    }
    const raw: unknown = await response.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ error: 'Mureka returned an invalid status response' }, { status: 502 });
    }
    const result = raw as Record<string, unknown>;
    const status = typeof result.status === 'string' ? result.status.slice(0, 40) : 'unknown';
    const choices = choicesFrom(result.choices);
    const rootAudioUrl = safeAudioUrl(result.stream_url ?? result.audio_url ?? result.audioUrl ?? result.wav_url);
    const audioUrl = choices.find((choice) => choice.audioUrl)?.audioUrl || rootAudioUrl || null;

    const baseBody = (draft.body || '').split('\n').filter((line) => !line.startsWith('Mureka Status:') && !line.startsWith('Mureka Audio URL:'));
    baseBody.push(`Mureka Status: ${status}`);
    if (audioUrl) baseBody.push(`Mureka Audio URL: ${audioUrl}`);
    await db.content.update({
      where: { id: draft.id },
      data: {
        body: baseBody.join('\n'),
        ...(audioUrl ? { mediaUrl: audioUrl, mediaType: 'audio' } : {}),
      },
    });

    return NextResponse.json({
      data: {
        taskId,
        status,
        model: typeof result.model === 'string' ? result.model.slice(0, 80) : null,
        isReady: status === 'succeeded' && Boolean(audioUrl),
        isProcessing: ['preparing', 'queued', 'running', 'streaming'].includes(status),
        isFailed: ['failed', 'timeouted', 'cancelled'].includes(status),
        error: ['failed', 'timeouted', 'cancelled'].includes(status) ? 'Generation did not complete. Review the prompt or Mureka account and try again.' : null,
        audioUrl,
        choices,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Mureka status request timed out. Retry shortly.' }, { status: 504 });
    }
    if (error instanceof Error && error.name === 'ToolCredentialsError') {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('[GET /api/ai/music-status]', error);
    return NextResponse.json({ error: 'Could not fetch Mureka task status' }, { status: 500 });
  }
}
