import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, companyName, industry, country } = await req.json();
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name required' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { email, passwordHash, name },
    });

    const slug = (companyName || name).toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50);
    const company = await db.company.create({
      data: {
        name: companyName || `${name}'s Company`,
        slug,
        industry: industry || '',
        country: country || '',
        plan: 'free',
      },
    });

    await db.companyUser.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role: 'company_owner',
        permissions: JSON.stringify({ all: true }),
      },
    });

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: 'company_owner',
      companyId: company.id,
    });

    // Create default AI agents
    const defaultAgents = [
      { name: 'SEO Agent', type: 'seo', desc: 'Automated SEO analysis and optimization' },
      { name: 'Content Writer', type: 'content', desc: 'AI-powered content creation' },
      { name: 'Social Media Manager', type: 'social', desc: 'Social media post creation and scheduling' },
      { name: 'Lead Generator', type: 'lead_gen', desc: 'Automated lead generation and qualification' },
      { name: 'Analytics Agent', type: 'analytics', desc: 'Performance tracking and insights' },
    ];
    for (const agent of defaultAgents) {
      await db.aiAgent.create({
        data: { name: agent.name, type: agent.type, description: agent.desc, companyId: company.id },
      });
    }

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'company_owner',
        companyId: company.id,
        companyName: company.name,
        plan: 'free',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
