import { NextRequest } from 'next/server';
import { rejectUnsafeOutbound } from '@/lib/outbound-safety';

export async function POST(req: NextRequest) {
  return rejectUnsafeOutbound(req, 'voice call');
}
