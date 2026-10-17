import { NextRequest, NextResponse } from 'next/server';
import { hasPermission, verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';
import { generateChatCompletion, generateLocalVideo } from '@/lib/ai-provider';

// POST /api/ai/cinematic-video — generate cinematic video with script + storyboard
// Body: { topic: string, duration?: number, style?: string, language?: string }
//
// This endpoint:
// 1. Generates a video script via LLM
// 2. Generates a storyboard (scene-by-scene breakdown)
// 3. Requests video generation from the configured local adapter
// 4. Saves everything to Content table
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const topic = asText(input.topic, 1_000);
    if (!topic) return NextResponse.json({ error: 'A video topic is required' }, { status: 400 });

    const durationValue = input.duration === undefined ? 30 : Number(input.duration);
    if (!Number.isInteger(durationValue) || durationValue < 15 || durationValue > 120) {
      return NextResponse.json({ error: 'Duration must be a whole number from 15 to 120 seconds' }, { status: 400 });
    }
    const duration = durationValue;
    const style = typeof input.style === 'string' && STYLES.has(input.style) ? input.style : 'cinematic';
    const language = asText(input.language, 40, 'English') || 'English';

    let script = '';
    let storyboard: any[] = [];
    let scriptSource: 'local-model' | 'template-fallback' = 'template-fallback';

    try {
      const completion = await generateChatCompletion([
        {
          role: 'system',
          content: `You are a professional video scriptwriter. Create a ${duration}-second ${style} video script about: ${topic}.

Return valid JSON with title, script in ${language}, storyboard array (scene, duration, visual, narration, mood), and hashtags array. Return JSON only.`
        },
        { role: 'user', content: `Create a ${style} video about: ${topic}` },
      ], { temperature: 0.4 });
      const response = completion.content.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '');
      const parsed = JSON.parse(response);
      script = parsed.script || '';
      storyboard = parsed.storyboard || [];
      if (script.trim()) scriptSource = 'local-model';
    } catch {
      // The explicit template fallback keeps the user informed that this is not an AI-written script.
    }

    if (!script || storyboard.length === 0) {
      script = `Opening: Introduce ${topic}. Explain the audience need and one key benefit. Close with a clear, relevant call to action.`;
      storyboard = getFallbackStoryboard(duration, topic);
      scriptSource = 'template';
    }

    // Step 2: Initiate generation through the configured self-hosted video adapter.
    let videoTaskId: string | null = null;
    let videoStatus = 'unavailable';
    try {
      const videoResult = await generateLocalVideo(`${style} video: ${topic}. ${script.slice(0, 500)}`, { duration });
      videoTaskId = videoResult.taskId;
      videoStatus = videoResult.status;
    } catch (error) {
      console.error('[cinematic-video] local video service unavailable:', error instanceof Error ? error.message : 'unknown error');
    }

    const storyboardText = storyboard.map((scene) =>
      `### Scene ${scene.scene} (${scene.duration})\n**Visual:** ${scene.visual}\n**Narration:** ${scene.narration}\n**Mood:** ${scene.mood}`,
    ).join('\n\n');
    const statusNote = videoTaskId
      ? `Provider task: ${videoTaskId} (${videoStatus})`
      : 'Provider render was not available; this draft contains a script and storyboard only.';
    const content = await db.content.create({
      data: {
        title: `Video Plan: ${generatedTitle}`.slice(0, 200),
        type: 'video',
        status: 'draft',
        platform: body.platform || null,
        body: `# Video Script\n\n## Title\n${topic}\n\n## Script\n${script}\n\n## Script source\n${scriptSource}\n\n## Storyboard\n${storyboard.map(s => `### Scene ${s.scene} (${s.duration})\n**Visual:** ${s.visual}\n**Narration:** ${s.narration}\n**Mood:** ${s.mood}`).join('\n\n')}`,
        mediaUrl: null,
        mediaType: 'video',
        aiGenerated: scriptSource === 'ai',
        creatorId: actor.userId,
        companyId: actor.companyId,
      },
    });

    const message = videoTaskId
      ? `Script and storyboard saved as a content draft. A rendering task was accepted (${videoStatus}); use Check render status for updates.`
      : `Script and storyboard saved as a content draft. The video provider is unavailable, so no rendered video was created. ${scriptSource === 'template' ? 'The script is a generic template—edit and review it before use.' : ''}`;
    await emitEvent({
      companyId: actor.companyId,
      userId: actor.userId,
      type: 'ai.cinematic_video_created',
      title: 'Video plan saved',
      description: `Topic: "${topic.slice(0, 60)}" — ${storyboard.length} scenes, ${duration}s; render ${videoStatus}`,
      resourceType: 'content',
      resourceId: content.id,
      link: '/content',
      metadata: { topic, duration, style, videoTaskId, sceneCount: storyboard.length, scriptSource },
    });

    return NextResponse.json({
      data: {
        contentId: content.id,
        title: generatedTitle,
        script,
        storyboard,
        videoTaskId,
        videoStatus,
        duration,
        style,
        language,
        scriptSource,
        scriptGeneratedByAI: scriptSource === 'local-model',
      },
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[POST /api/ai/cinematic-video]', error);
    return NextResponse.json({ error: 'Failed to save video plan' }, { status: 500 });
  }
}
