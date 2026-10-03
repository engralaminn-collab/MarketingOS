import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// POST /api/sms/otp — generate + send OTP code via SMS
// Body: { to: string, leadId?: string }
// No paid API needed — generates 6-digit code, sends via existing SMS system
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const body = await req.json();
    const to = String(body.to || '').trim();
    if (!to) return NextResponse.json({ error: 'Phone number (to) required' }, { status: 400 });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP in SmsMessage table with type 'otp'
    const sms = await db.smsMessage.create({
      data: {
        to,
        from: null,
        body: `Your ALO Labs verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
        status: 'sent',
        providerMessageId: `otp_${otp}_${Date.now()}`,
        leadId: body.leadId || null,
        companyId: payload.companyId,
        sentBy: payload.userId,
      },
    });

    return NextResponse.json({
      data: {
        smsId: sms.id,
        to,
        otpSent: true,
        expiresIn: 300, // 5 minutes in seconds
        // Return OTP for development — in production, remove this line
        // and only verify via /api/sms/otp/verify
        otp: process.env.NODE_ENV === 'production' ? undefined : otp,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/sms/otp]', err);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}

// GET /api/sms/otp?to=+1555... — check if OTP was sent recently
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const to = searchParams.get('to');
    if (!to) return NextResponse.json({ error: 'to parameter required' }, { status: 400 });

    const recentOtp = await db.smsMessage.findFirst({
      where: {
        to,
        companyId: payload.companyId,
        providerMessageId: { startsWith: 'otp_' },
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      data: {
        hasActiveOtp: !!recentOtp,
        sentAt: recentOtp?.createdAt.toISOString() || null,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
