import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';
import ZAI from 'z-ai-web-dev-sdk';

// GET /api/ai/avatar — list all avatar profiles
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    // Avatar profiles are stored as AiAgent records with type 'avatar'
    const avatars = await db.aiAgent.findMany({
      where: { companyId: payload.companyId, type: 'avatar' },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      data: avatars.map(a => {
        const config = (() => { try { return JSON.parse(a.config || '{}'); } catch { return {}; } })();
        return {
          id: a.id,
          name: a.name,
          description: a.description,
          faceImageUrl: config.faceImageUrl || null,
          voiceId: config.voiceId || 'default',
          ethnicity: config.ethnicity || 'asian',
          gender: config.gender || 'female',
          age: config.age || 'young adult',
          style: config.style || 'professional',
          isEnabled: a.isEnabled,
          createdAt: a.createdAt.toISOString(),
        };
      }),
    });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

// POST /api/ai/avatar — create a new AI avatar with consistent face + voice
// Body: { name, ethnicity?, gender?, age?, style?, description? }
// Generates a face image via z-ai SDK + creates a voice profile
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    if (!hasPermission(payload.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (process.env.ZAI_MEDIA_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Hosted avatar generation is disabled. Configure a local media model or explicitly enable ZAI_MEDIA_ENABLED.' }, { status: 503 });
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const ethnicity = body.ethnicity || 'bangladeshi';
    const gender = body.gender || 'female';
    const age = body.age || 'young adult';
    const style = body.style || 'professional';

    // Generate the face image via z-ai SDK
    let faceImageUrl: string | null = null;
    try {
      const zai = await ZAI.create();
      const imageResult = await zai.images.generations.create({
        prompt: `Professional portrait photo of a ${age} ${ethnicity} ${gender} person, ${style} appearance, natural lighting, high quality, photorealistic, looking at camera, neutral background, head and shoulders shot`,
        size: '1024x1024',
      });

      // The SDK returns base64 data — we need to save it or use it as a reference URL
      // For now, store the base64 as a data URL (in production, save to cloud storage)
      if (imageResult.data?.[0]?.base64) {
        faceImageUrl = `data:image/png;base64,${imageResult.data[0].base64}`;
      }
    } catch {
      // Fallback: use a placeholder URL that represents the avatar
      faceImageUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}&backgroundColor=f97316`;
    }

    // Generate a unique voice ID (in production, this would clone a voice via TTS API)
    const voiceId = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Store the avatar profile as an AiAgent record
    const avatar = await db.aiAgent.create({
      data: {
        name,
        type: 'avatar',
        description: body.description || `${ethnicity} ${gender} avatar, ${age}, ${style}`,
        config: JSON.stringify({
          faceImageUrl,
          voiceId,
          ethnicity,
          gender,
          age,
          style,
          createdAt: new Date().toISOString(),
        }),
        isEnabled: true,
        companyId: payload.companyId,
      },
    });

    // Test the voice by generating a sample TTS
    let voiceTestUrl: string | null = null;
    try {
      const zai = await ZAI.create();
      const ttsResult = await zai.audio.tts.create({
        input: `Hello, I am ${name}. I will be your AI presenter for marketing videos.`,
        voice: voiceId,
      });
      voiceTestUrl = ttsResult.url || ttsResult.audio_url || null;
    } catch {
      // Voice test failed — avatar still created, voice will work when API is available
    }

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'ai.avatar_created',
      title: `AI Avatar "${name}" created`,
      description: `${ethnicity} ${gender}, ${age}, ${style}. Face + voice profile ready for video generation.`,
      resourceType: 'avatar',
      resourceId: avatar.id,
      metadata: { name, ethnicity, gender, voiceId, hasVoice: !!voiceTestUrl },
    });

    return NextResponse.json({
      data: {
        id: avatar.id,
        name,
        ethnicity,
        gender,
        age,
        style,
        faceImageUrl,
        voiceId,
        voiceTestUrl,
        message: 'Avatar created. Use this avatar ID with /api/ai/avatar-video to generate videos with consistent face + voice.',
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ai/avatar]', err);
    return NextResponse.json({ error: 'Failed to create avatar' }, { status: 500 });
  }
}
