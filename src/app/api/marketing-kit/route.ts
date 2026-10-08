import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import ZAI from 'z-ai-web-dev-sdk';
import kit from '@/data/marketing-kit/skills.json';

// Marketing Kit — browse + run the Marketing Skills library
// (https://github.com/coreyhaines31/marketingskills, MIT).
//
// GET  /api/marketing-kit                 → skill index (no bodies)
// GET  /api/marketing-kit?slug=copywriting → full skill (SKILL.md + references)
// POST /api/marketing-kit                  → run a skill: { slug, input, referencePaths?: string[] }

type KitSkill = (typeof kit.skills)[number];

const MAX_CONTEXT_CHARS = 60_000;

function findSkill(slug: string): KitSkill | undefined {
  return kit.skills.find((s) => s.slug === slug);
}

async function auth(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(req: NextRequest) {
  if (!(await auth(req))) return NextResponse.json({ error: 'No token' }, { status: 401 });

  const slug = req.nextUrl.searchParams.get('slug');
  if (slug) {
    const skill = findSkill(slug);
    if (!skill) return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    return NextResponse.json({ data: skill });
  }

  return NextResponse.json({
    data: {
      source: kit.source,
      license: kit.license,
      upstreamVersion: kit.upstreamVersion,
      skills: kit.skills.map((s) => ({
        slug: s.slug,
        name: s.name,
        description: s.description,
        version: s.version,
        referenceCount: s.references.length,
      })),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const payload = await auth(req);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json();
    const skill = findSkill(String(body.slug || ''));
    if (!skill) return NextResponse.json({ error: 'Skill not found' }, { status: 404 });

    const input = String(body.input || '').trim();
    if (!input) return NextResponse.json({ error: 'input is required' }, { status: 400 });

    const wanted: string[] = Array.isArray(body.referencePaths) ? body.referencePaths.map(String) : [];
    const refs = skill.references.filter((r) => wanted.length === 0 || wanted.includes(r.path));

    let context = skill.body;
    for (const r of refs) {
      if (context.length + r.content.length > MAX_CONTEXT_CHARS) break;
      context += `\n\n---\n\n# Reference: ${r.path}\n\n${r.content}`;
    }

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `You are running the "${skill.name}" marketing skill inside MarketingOS. Follow the skill instructions below exactly. Ask for missing inputs only if the task truly cannot be done without them; otherwise make reasonable assumptions and state them.\n\n${context}`,
        },
        { role: 'user', content: input },
      ],
      thinking: { type: 'disabled' },
    });

    const output = completion.choices[0]?.message?.content || '';
    return NextResponse.json({
      data: { slug: skill.slug, name: skill.name, output, referencesUsed: refs.map((r) => r.path) },
    });
  } catch (err) {
    console.error('[marketing-kit] run failed', err);
    return NextResponse.json({ error: 'The AI service failed to run this skill. Try again.' }, { status: 502 });
  }
}
