import { NextResponse } from 'next/server';
import { getActor } from '@/lib/agency';
import { hasPermission } from '@/lib/auth';

// A caller-provided photo cannot currently be tied cryptographically to a
// consented, workspace-owned persona asset or an allowed channel. Do not send
// the image/audio to an adapter until that binding and a durable worker exist.
export async function GET(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ data: { configured: false, adapter: null, hint: 'Lip-sync is disabled until consented asset binding and a durable worker are implemented.' } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPermission(actor.role, 'content_manager')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ error: 'Lip-sync is unavailable until consented asset binding and a durable worker are implemented. Nothing was sent or queued.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
}
