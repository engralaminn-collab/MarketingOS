import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { emitEvent } from '@/lib/events';
import ZAI from 'z-ai-web-dev-sdk';

// POST /api/ai/cinematic-video — generate cinematic video with script + storyboard
// Body: { topic: string, duration?: number, style?: string, language?: string }
//
// This endpoint:
// 1. Generates a video script via LLM
// 2. Generates a storyboard (scene-by-scene breakdown)
// 3. Initiates video generation via z-ai SDK
// 4. Saves everything to Content table
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const body = await req.json();
    const topic = String(body.topic || '').trim();
    if (!topic) return NextResponse.json({ error: 'topic required' }, { status: 400 });

    const duration = Math.min(120, Math.max(15, body.duration || 30));
    const style = body.style || 'cinematic';
    const language = body.language || 'english';

    // Step 1: Generate video script via LLM
    let script = '';
    let storyboard: any[] = [];

    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a professional video scriptwriter. Create a ${duration}-second ${style} video script about: ${topic}. 

Return JSON with:
{
  "title": "...",
  "script": "Full narration script in ${language}",
  "storyboard": [
    { "scene": 1, "duration": "0-5s", "visual": "Description of what's shown", "narration": "Voiceover text", "mood": "tone" }
  ],
  "hashtags": ["#tag1", "#tag2"]
}`
          },
          { role: 'user', content: `Create a ${style} video about: ${topic}` }
        ],
        thinking: { type: 'disabled' },
      });

      const response = completion.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(response);
      script = parsed.script || '';
      storyboard = parsed.storyboard || [];
    } catch {
      // Fallback script
      script = `Welcome to this cinematic video about ${topic}. In the next ${duration} seconds, we'll explore the key aspects that make this topic fascinating. From the fundamentals to advanced insights, this video will give you a comprehensive understanding. Let's dive in.`;
      storyboard = [
        { scene: 1, duration: '0-5s', visual: 'Opening title with brand logo', narration: `Welcome to this video about ${topic}.`, mood: 'professional' },
        { scene: 2, duration: '5-15s', visual: 'Overview shot of the topic', narration: `Let's start with the basics.`, mood: 'informative' },
        { scene: 3, duration: '15-25s', visual: 'Close-up of key detail', narration: `Here's what makes it special.`, mood: 'engaging' },
        { scene: 4, duration: '25-30s', visual: 'Closing shot with call-to-action', narration: `Thanks for watching. Follow for more.`, mood: 'uplifting' },
      ];
    }

    // Step 2: Initiate video generation
    // The SDK returns { id, task_status }. The actual video URL must be polled
    // later via zai.async.result.query(taskId).
    let videoTaskId: string | null = null;
    let videoStatus = 'pending';
    try {
      const zai = await ZAI.create();
      const videoResult = await zai.video.generations.create({
        prompt: `${style} video: ${topic}. ${script.slice(0, 500)}`,
      });
      videoTaskId = videoResult.id;
      videoStatus = videoResult.task_status === 'SUCCESS' ? 'completed'
        : videoResult.task_status === 'FAIL' ? 'failed'
        : 'processing';
    } catch {
      videoStatus = 'rate_limited';
    }

    // Step 3: Save to Content table
    const content = await db.content.create({
      data: {
        title: `Cinematic Video: ${topic.slice(0, 80)}`,
        type: 'video',
        status: 'draft',
        platform: body.platform || null,
        body: `# Video Script\n\n## Title\n${topic}\n\n## Script\n${script}\n\n## Storyboard\n${storyboard.map(s => `### Scene ${s.scene} (${s.duration})\n**Visual:** ${s.visual}\n**Narration:** ${s.narration}\n**Mood:** ${s.mood}`).join('\n\n')}`,
        mediaUrl: null,
        mediaType: 'video',
        aiGenerated: true,
        creatorId: payload.userId,
        companyId: payload.companyId,
      },
    });

    // Step 4: Emit event
    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'ai.cinematic_video_created',
      title: 'Cinematic video created',
      description: `Topic: "${topic.slice(0, 60)}" — ${storyboard.length} scenes, ${duration}s`,
      resourceType: 'content',
      resourceId: content.id,
      link: '/content',
      metadata: { topic, duration, style, videoTaskId, sceneCount: storyboard.length },
    });

    return NextResponse.json({
      data: {
        contentId: content.id,
        title: topic,
        script,
        storyboard,
        videoTaskId,
        videoStatus,
        duration,
        style,
        language,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ai/cinematic-video]', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
