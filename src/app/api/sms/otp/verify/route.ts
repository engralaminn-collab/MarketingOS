import { NextRequest } from 'next/server';
import { rejectUnsafeOtp } from '@/lib/outbound-safety';

// Do not read, log, retain or verify a code. There is no trusted OTP provider.
export async function POST(req: NextRequest) { return rejectUnsafeOtp(req); }
