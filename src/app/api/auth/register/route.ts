import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createSessionToken } from '@/lib/auth';
import { ipFromRequest, isSecureTransport, rateLimiter } from '@/lib/security';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  if (!isSecureTransport(req)) return NextResponse.json({ error: 'A secure HTTPS connection is required.' }, { status: 426 });
  const ipLimit = rateLimiter(`auth-register-ip:${ipFromRequest(req)}`, { maxRequests: 5, windowMs: 60 * 60_000 });
  if (!ipLimit.allowed) return tooManyRequests(ipLimit.retryAfterMs);

  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : '';
    const industry = typeof body?.industry === 'string' ? body.industry.trim() : '';
    const country = typeof body?.country === 'string' ? body.country.trim() : '';

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 });
    }
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }
    if (password.length < 12) {
      return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 });
    }
    if (password.length > 128 || name.length > 120 || companyName.length > 120 || industry.length > 100 || country.length > 100) {
      return NextResponse.json({ error: 'One or more fields exceed the allowed length' }, { status: 400 });
    }

    const emailLimit = rateLimiter(`auth-register-email:${email}`, { maxRequests: 3, windowMs: 60 * 60_000 });
    if (!emailLimit.allowed) return tooManyRequests(emailLimit.retryAfterMs);

    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const safeCompanyName = companyName || `${name}'s Company`;
    const slugBase = safeCompanyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44) || 'company';
    const slug = `${slugBase}-${randomBytes(4).toString('hex')}`;

    const { user, company } = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: { email, passwordHash, name },
      });
      const createdCompany = await tx.company.create({
        data: {
          name: safeCompanyName,
          slug,
          industry: industry || '',
          country: country || '',
          plan: 'free',
        },
      });
      await tx.companyUser.create({
        data: {
          userId: createdUser.id,
          companyId: createdCompany.id,
          role: 'company_owner',
          permissions: JSON.stringify({ all: true }),
        },
      });

      await tx.aiAgent.createMany({
        data: [
          { name: 'SEO Agent', type: 'seo', description: 'SEO analysis and optimization', companyId: createdCompany.id },
          { name: 'Content Writer', type: 'content', description: 'Content drafting and assistance', companyId: createdCompany.id },
          { name: 'Social Media Manager', type: 'social', description: 'Social content and scheduling', companyId: createdCompany.id },
          { name: 'Lead Generator', type: 'lead_gen', description: 'Lead generation and qualification', companyId: createdCompany.id },
          { name: 'Analytics Agent', type: 'analytics', description: 'Performance tracking and insights', companyId: createdCompany.id },
        ],
      });
      return { user: createdUser, company: createdCompany };
    });

    const { token } = await createSessionToken(req, {
      userId: user.id,
      email: user.email,
      role: 'company_owner',
      companyId: company.id,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: 'company_owner',
        companyId: company.id,
        companyName: company.name,
        institutionId: '',
        institutionName: '',
        isSuperAdmin: false,
        plan: company.plan,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/auth/register]', error);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'Email or company already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Unable to create account right now' }, { status: 500 });
  }
}

function tooManyRequests(retryAfterMs: number) {
  return NextResponse.json(
    { error: 'Too many registration attempts. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } },
  );
}
