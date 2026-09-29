import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { enrichByEmail, enrichByDomain } from '@/lib/enrichment';

// POST /api/leads/enrich — lookup enrichment info for an email/domain without saving
// Body: { email?: string, domain?: string }
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const email = body.email ? String(body.email) : null;
    const domain = body.domain ? String(body.domain) : null;

    if (email && email.includes('@')) {
      const result = await enrichByEmail(email);
      if (result) return NextResponse.json({ data: result });
    }
    if (domain) {
      const result = await enrichByDomain(domain);
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ error: 'Provide email or domain' }, { status: 400 });
  } catch (err) {
    console.error('[POST /api/leads/enrich]', err);
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 });
  }
}

// GET /api/leads/enrich?domain=example.com — same as POST but as a GET lookup
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain');
    const email = searchParams.get('email');

    if (email && email.includes('@')) {
      const result = await enrichByEmail(email);
      if (result) return NextResponse.json({ data: result });
    }
    if (domain) {
      const result = await enrichByDomain(domain);
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ error: 'Provide ?domain= or ?email= parameter' }, { status: 400 });
  } catch (err) {
    console.error('[GET /api/leads/enrich]', err);
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 });
  }
}
