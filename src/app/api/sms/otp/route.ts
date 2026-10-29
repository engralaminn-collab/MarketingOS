import { NextRequest } from 'next/server';
import { rejectUnsafeOtp } from '@/lib/outbound-safety';

export async function POST(req: NextRequest) { return rejectUnsafeOtp(req); }
export async function GET(req: NextRequest) { return rejectUnsafeOtp(req); }
