import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { getCompanyToolCredentials } from '@/lib/tool-credentials';

const MUREKA_TOOL_NUMBER = 120;
const MUREKA_ENDPOINT = 'https://api.mureka.ai/v1/instrumental/generate';
const MODELS = new Set(['auto', 'mureka-7.6', 'mureka-8', 'mureka-9', 'mureka-9.5']);

function readBearer(req: NextRequest): string | null {
  return req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  let draftId: string | null = null;
  try {
    const token = readBearer(req);
    if (!token) return errorResponse('Unauthorized', 401);
    const actor = await verifyToken(token);
    if (!actor?.companyId || !actor.userId) return errorResponse('Invalid token', 401);
    if (!hasPermission(actor.role, 'content_manager')) return errorResponse('Forbidden', 403);

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponse('A JSON object is required', 400);
    const input = body as Record<string, unknown>;
    const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
    const model = typeof input.model === 'string' ? input.model : 'auto';
    if (!prompt || prompt.length > 1024) return errorResponse('Prompt is required and must be at most 1,024 characters', 400);
    if (!MODELS.has(model)) return errorResponse('Unsupported Mureka model', 400);

    const integration = await getCompanyToolCredentials(actor.companyId, MUREKA_TOOL_NUMBER, ['MUREKA_API_KEY']);
    if (!integration) return errorResponse('Connect Mureka in Integrations before generating audio', 503);

    // Create the draft before calling the paid provider so the task can still be
    // recovered if persisting the task response later fails.
    const draft = await db.content.create({
      data: {
        title: `Instrumental soundtrack: ${prompt.slice(0, 72)}`,
        type: 'audio',
        status: 'draft',
        body: `Prompt: ${prompt}\nProvider: Mureka\nMureka Status: starting`,
        mediaType: 'audio',
        aiGenerated: true,
        creatorId: actor.userId,
        companyId: actor.companyId,
      },
      select: { id: true },
    });
    draftId = draft.id;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    let providerResponse: Response;
    try {
      providerResponse = await fetch(MUREKA_ENDPOINT, {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${integration.MUREKA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        // Mureka defaults n to 2; explicitly request one output to avoid
        // unintentionally doubling the user's provider charge.
        body: JSON.stringify({ model, prompt, n: 1 }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!providerResponse.ok) {
      await db.content.update({
        where: { id: draft.id },
        data: { body: `Prompt: ${prompt}\nProvider: Mureka\nMureka Status: request failed (HTTP ${providerResponse.status})` },
      });
      return errorResponse(`Mureka rejected the request (HTTP ${providerResponse.status}). Check the integration key, model, and account balance.`, 502);
    }

    const result: unknown = await providerResponse.json();
    const taskId = result && typeof result === 'object' && !Array.isArray(result)
      ? (result as { id?: unknown }).id
      : null;
    const status = result && typeof result === 'object' && !Array.isArray(result)
      ? (result as { status?: unknown }).status
      : null;
    if (typeof taskId !== 'string' || !taskId.trim() || taskId.length > 128) {
      await db.content.update({
        where: { id: draft.id },
        data: { body: `Prompt: ${prompt}\nProvider: Mureka\nMureka Status: response did not contain a valid task ID` },
      });
      return errorResponse('Mureka returned an invalid task response. The draft was saved for review.', 502);
    }

    await db.content.update({
      where: { id: draft.id },
      data: { body: `Prompt: ${prompt}\nProvider: Mureka\nMureka Task: ${taskId}\nMureka Status: ${typeof status === 'string' ? status.slice(0, 40) : 'queued'}` },
    });

    return NextResponse.json({
      data: {
        contentId: draft.id,
        taskId,
        status: typeof status === 'string' ? status : 'queued',
        model: typeof result === 'object' && result && 'model' in result && typeof result.model === 'string' ? result.model : model,
        prompt,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (draftId) await db.content.update({ where: { id: draftId }, data: { body: 'Provider request timed out. Check Mureka task history before retrying to avoid duplicate charges.' } }).catch(() => undefined);
      return errorResponse('Mureka request timed out. Check the saved audio draft before retrying.', 504);
    }
    if (error instanceof Error && error.name === 'ToolCredentialsError') {
      return errorResponse(error.message, 503);
    }
    console.error('[POST /api/ai/generate-music]', error);
    return errorResponse('Could not start instrumental generation', 500);
  }
}
