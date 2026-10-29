import { NextRequest } from 'next/server';
import { rejectUnsafeOutbound } from '@/lib/outbound-safety';

// Disabled until tenant consent, suppression and explicit approval exist.
export async function POST(req: NextRequest) {
  return rejectUnsafeOutbound(req, 'SMS');
}
