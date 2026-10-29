import { NextRequest } from 'next/server';
import { rejectUnsafeOutbound } from '@/lib/outbound-safety';

// The former implementation created fake provider IDs and marked messages
// sent without contacting a provider. It must not run again.
export async function POST(req: NextRequest) {
  return rejectUnsafeOutbound(req, 'SMS broadcast');
}
