import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// POST /api/sms/otp/verify — verify OTP code
// Body: { to: string, code: string }
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const body = await req.json();
    const to = String(body.to || '').trim();
    const code = String(body.code || '').trim();
    if (!to || !code) return NextResponse.json({ error: 'to and code required' }, { status: 400 });

    // Find the OTP message
    const otpMessage = await db.smsMessage.findFirst({
      where: {
        to,
        companyId: payload.companyId,
        providerMessageId: { startsWith: 'otp_' },
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpMessage) {
      return NextResponse.json({ data: { verified: false, reason: 'OTP expired or not found' } }, { status: 200 });
    }

    // Extract OTP from providerMessageId: otp_<code>_<timestamp>
    const parts = otpMessage.providerMessageId.split('_');
    const storedOtp = parts[1];

    if (storedOtp === code) {
      // Mark as verified
      await db.smsMessage.update({
        where: { id: otpMessage.id },
        data: { status: 'delivered', body: `OTP verified: ${code}` },
      });
      return NextResponse.json({ data: { verified: true } });
    } else {
      return NextResponse.json({ data: { verified: false, reason: 'Invalid code' } });
    }
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
