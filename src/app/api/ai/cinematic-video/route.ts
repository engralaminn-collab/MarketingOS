import { NextRequest, NextResponse } from 'next/server';
import { hasPermission, verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';
import { generateChatCompletion } from '@/lib/ai-provider';
import { generateWithComfyUIVideo } from '@/lib/comfyui';

const STYLES = new Set(['cinematic', 'documentary', 'product-demo', 'social-reel', 'explainer', 'editorial']);

function asText(value: unknown, maxLen: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLen) || fallback;
}

function getFallbackStoryboard(duration: number, topic: string) {
  const perScene = Math.max(4, Math.round(duration / 4));
  return [
    { scene: 1, duration: `${perScene}s`, visual: `Editorial title card introducing ${topic}`, narration: `Here is what most teams miss about ${topic}.`, mood: 'Focused & intriguing' },
    { scene: 2, duration: `${perScene}s`, visual: 'Problem contrast split-screen with real workflow friction', narration: 'Manual handoffs slow execution and hide clear attribution.', mood: 'Analytical' },
    { scene: 3, duration: `${perScene}s`, visual: 'Step-by-step product walkthrough showing clear outcome', narration: `With a structured system for ${topic}, teams ship faster with measurable proof.`, mood: 'Confident' },
    { scene: 4, duration: `${perScene}s`, visual: 'Clean closing frame with single primary call to action', narration: 'Start with one high-intent workflow today.', mood: 'Direct & clear' },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId || !actor.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const topic = asText(input.topic, 1_000);
    if (!topic) return NextResponse.json({ error: 'A video topic is required' }, { status: 400 });

    const durationValue = input.duration === undefined ? 30 : Number(input.duration);
    if (!Number.isInteger(durationValue) || durationValue < 5 || durationValue > 120) {
      return NextResponse.json({ error: 'Duration must be a whole number from 5 to 120 seconds' }, { status: 400 });
    }
    const duration = durationValue;
    const style = typeof input.style === 'string' && STYLES.has(input.style) ? input.style : 'cinematic';
    const language = asText(input.language, 40, 'English');
    const platform = typeof input.platform === 'string' ? input.platform.slice(0, 60) : null;

    let generatedTitle = topic.slice(0, 80);
    let script = '';
    let storyboard: Array<{ scene: number; duration: string; visual: string; narration: string; mood: string }> = [];
    let hashtags: string[] = [];
    let scriptSource: 'ai-model' | 'template-fallback' = 'template-fallback';
    let textProvider: string | null = null;

    try {
      const completion = await generateChatCompletion(
        [
          {
            role: 'system',
            content: `You are a professional video scriptwriter. Create a ${duration}-second ${style} video script about: ${topic}. Return valid JSON with keys: title, script (in ${language}), storyboard (array of {scene, duration, visual, narration, mood}), and hashtags (array of strings). Return JSON only.`,
          },
          { role: 'user', content: `Create a ${style} video about: ${topic}` },
        ],
        { temperature: 0.4 },
      );
      const cleaned = completion.content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);
      if (typeof parsed.title === 'string' && parsed.title.trim()) generatedTitle = parsed.title.trim();
      script = typeof parsed.script === 'string' ? parsed.script.trim() : '';
      storyboard = Array.isArray(parsed.storyboard) ? parsed.storyboard : [];
      hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
      if (script) { scriptSource = 'ai-model'; textProvider = completion.provider; }
    } catch {
      // Fall back to deterministic storyboard
    }

    if (!script || storyboard.length === 0) {
      script = `Opening: Introduce ${topic}. Highlight the core audience bottleneck and show one concrete result. Close with a clear call to action.`;
      storyboard = getFallbackStoryboard(duration, topic);
      scriptSource = 'template-fallback';
      textProvider = null;
    }

    let videoUrl: string | null = null;
    let videoStatus = 'storyboard-ready';
    try {
      const clipDuration = Math.min(10, Math.max(3, duration));
      videoUrl = await generateWithComfyUIVideo(`${style} video: ${topic}. ${script.slice(0, 300)}`, clipDuration);
      if (videoUrl) videoStatus = 'short-clip-ready';
    } catch {
      videoStatus = 'storyboard-only';
    }

    const content = await db.content.create({
      data: {
        title: `Video Plan: ${generatedTitle}`.slice(0, 200),
        type: 'video',
        status: 'draft',
        platform,
        body: `# ${generatedTitle}\n\n## Script (${scriptSource})\n${script}\n\n## Storyboard\n${storyboard
          .map((s) => `### Scene ${s.scene} (${s.duration})\n- **Visual:** ${s.visual}\n- **Narration:** ${s.narration}\n- **Mood:** ${s.mood}`)
          .join('\n\n')}`,
        mediaUrl: null,
        mediaType: 'video',
        aiGenerated: scriptSource === 'ai-model',
        creatorId: actor.userId,
        companyId: actor.companyId,
      },
    });

    await emitEvent({
      companyId: actor.companyId,
      userId: actor.userId,
      type: 'ai.cinematic_video_created',
      title: 'Video plan saved',
      description: `Topic: "${topic.slice(0, 60)}" — ${storyboard.length} scenes, ${duration}s`,
      resourceType: 'content',
      resourceId: content.id,
      link: '/content',
      metadata: { topic, duration, style, sceneCount: storyboard.length, scriptSource },
    });

    return NextResponse.json(
      {
        data: {
          contentId: content.id,
          title: generatedTitle,
          script,
          storyboard,
          hashtags,
          videoUrl,
          videoStatus,
          duration,
          style,
          language,
          scriptSource,
          textProvider,
          note: 'The storyboard is a plan. Any rendered clip is a separate short clip, not the complete assembled narrated video.',
          scriptGeneratedByAI: scriptSource === 'ai-model',
        },
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[POST /api/ai/cinematic-video]', error);
    return NextResponse.json({ error: 'Failed to save video plan' }, { status: 500 });
  }
}
