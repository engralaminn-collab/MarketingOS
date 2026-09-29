import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { prompt, size = '1024x1024' } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });

    const validSizes = ['1024x1024', '768x1344', '1344x768', '1440x720', '720x1440', '864x1152', '1152x864'];
    if (!validSizes.includes(size)) {
      return NextResponse.json({ error: `Invalid size. Use: ${validSizes.join(', ')}` }, { status: 400 });
    }

    const zai = await ZAI.create();
    const response = await zai.images.generations.create({
      prompt,
      size: size as any,
    });

    const imageBase64 = response.data[0].base64;
    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${imageBase64}`,
      size,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
