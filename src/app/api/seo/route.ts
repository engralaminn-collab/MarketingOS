import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, verifyToken } from '@/lib/auth';

const ALLOWED_DURATIONS = new Set([30, 60, 90, 180, 365]);
const MAX_KEYWORDS = 50;

async function getActor(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.companyId || !payload.userId) return null;
  return { companyId: payload.companyId, userId: payload.userId, role: payload.role };
}

function createTaskTemplates(duration: number) {
  const templates = [
    { day: 1, title: 'Review crawlability and index coverage', category: 'technical', desc: 'Check the site in your search console and document verified crawl or index coverage issues.' },
    { day: 2, title: 'Map search intent to target pages', category: 'research', desc: 'For each target query, record intent and the page that should satisfy it.' },
    { day: 3, title: 'Review competitor search results', category: 'research', desc: 'Manually compare relevant search results and note the content formats and questions they address.' },
    { day: 4, title: 'Check page experience', category: 'technical', desc: 'Review mobile usability, load performance and page stability using your chosen measurement tools.' },
    { day: 5, title: 'Improve titles and descriptions', category: 'onpage', desc: 'Review important page titles and descriptions for accuracy, clarity and search intent.' },
    { day: 6, title: 'Find content gaps', category: 'content', desc: 'Compare the questions your audience asks with the coverage on your priority pages.' },
    { day: 7, title: 'Review sitemap and canonical signals', category: 'technical', desc: 'Confirm the sitemap and canonical URLs are current and intentional.' },
    { day: 8, title: 'Check structured data', category: 'technical', desc: 'Validate applicable structured data and ensure it matches visible page content.' },
    { day: 9, title: 'Improve internal links', category: 'onpage', desc: 'Add useful contextual links between pages that support the same visitor journey.' },
    { day: 10, title: 'Review image descriptions', category: 'onpage', desc: 'Check alternative text, filenames, file sizes and whether each image serves a purpose.' },
  ];
  const categories = ['content', 'offpage', 'onpage', 'technical', 'research'];
  const recurringTasks: Record<string, string[]> = {
    content: ['Refresh a priority page', 'Draft a helpful FAQ', 'Outline a topic-cluster article', 'Review content accuracy'],
    offpage: ['Identify a relevant partnership opportunity', 'Review brand mentions', 'Plan a useful digital PR asset', 'Audit directory listing accuracy'],
    onpage: ['Review internal-link opportunities', 'Improve one page heading structure', 'Check a priority landing page', 'Review image accessibility'],
    technical: ['Review indexing signals', 'Check a redirect or canonical sample', 'Verify mobile usability', 'Review performance measurements'],
    research: ['Review query intent', 'Compare search-result features', 'Update keyword-to-page mapping', 'Record a competitor observation'],
  };

  for (let day = 11; day <= duration; day += 1) {
    const category = categories[(day - 11) % categories.length];
    const taskOptions = recurringTasks[category];
    const title = taskOptions[Math.floor((day - 11) / categories.length) % taskOptions.length];
    templates.push({
      day,
      title: `${title} — day ${day}`,
      category,
      desc: `Manual planning prompt: ${title.toLowerCase()}. Record the observation, owner and next action in your team's workflow.`,
    });
  }
  return templates;
}

export async function GET(req: NextRequest) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const challenges = await db.seoChallenge.findMany({
      where: { companyId: actor.companyId },
      include: { dailyTasks: { orderBy: { day: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ challenges });
  } catch (error) {
    console.error('[GET /api/seo]', error);
    return NextResponse.json({ error: 'Failed to fetch SEO plans' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasPermission(actor.role, 'seo_manager')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON request body is required' }, { status: 400 });
    }

    if (body.action === 'completeTask') {
      const taskId = typeof body.taskId === 'string' ? body.taskId.trim() : '';
      if (!taskId || taskId.length > 64) return NextResponse.json({ error: 'A valid task ID is required' }, { status: 400 });

      const task = await db.seoDailyTask.findFirst({
        where: { id: taskId, challenge: { is: { companyId: actor.companyId } } },
        select: { id: true, challengeId: true, status: true },
      });
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

      if (task.status === 'completed') return NextResponse.json({ success: true, alreadyCompleted: true });

      const result = await db.$transaction(async (tx) => {
        const updatedTask = await tx.seoDailyTask.update({
          where: { id: task.id },
          data: { status: 'completed', completedAt: new Date() },
        });
        const tasks = await tx.seoDailyTask.findMany({
          where: { challengeId: task.challengeId },
          select: { day: true, status: true },
        });
        const completed = tasks.filter((item) => item.status === 'completed');
        const score = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;
        const currentDay = completed.reduce((latest, item) => Math.max(latest, item.day), 0);
        const challenge = await tx.seoChallenge.update({
          where: { id: task.challengeId },
          data: { score, currentDay },
        });
        return { task: updatedTask, challenge };
      });

      return NextResponse.json({ success: true, ...result });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const websiteUrl = typeof body.websiteUrl === 'string' ? body.websiteUrl.trim() : '';
    const duration = Number(body.duration);
    if (!websiteUrl || websiteUrl.length > 2_048) {
      return NextResponse.json({ error: 'Website URL is required (maximum 2,048 characters)' }, { status: 400 });
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(websiteUrl);
    } catch {
      return NextResponse.json({ error: 'Enter a valid absolute website URL' }, { status: 400 });
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
      return NextResponse.json({ error: 'Use a public HTTP or HTTPS website URL without embedded credentials' }, { status: 400 });
    }
    if (!ALLOWED_DURATIONS.has(duration)) {
      return NextResponse.json({ error: 'Duration must be 30, 60, 90, 180 or 365 days' }, { status: 400 });
    }
    if (name.length > 120) return NextResponse.json({ error: 'Plan name must be 120 characters or fewer' }, { status: 400 });

    const rawKeywords: unknown[] = Array.isArray(body.targetKeywords)
      ? body.targetKeywords
      : typeof body.targetKeywords === 'string'
        ? body.targetKeywords.split(',')
        : [];
    const keywords = [...new Set(rawKeywords
      .filter((item): item is string => typeof item === 'string')
      .map((keyword) => keyword.trim().slice(0, 100))
      .filter(Boolean))].slice(0, MAX_KEYWORDS);

    const taskTemplates = createTaskTemplates(duration);
    const challenge = await db.seoChallenge.create({
      data: {
        name: name || `${duration}-Day SEO Checklist`,
        websiteUrl: parsedUrl.toString(),
        targetKeywords: JSON.stringify(keywords),
        duration,
        status: 'active',
        currentDay: 0,
        score: 0,
        results: JSON.stringify({}),
        companyId: actor.companyId,
        dailyTasks: {
          create: taskTemplates.map((task) => ({
            day: task.day,
            title: task.title,
            description: task.desc,
            category: task.category,
          })),
        },
      },
      include: { dailyTasks: true },
    });

    return NextResponse.json({ challenge }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/seo]', error);
    return NextResponse.json({ error: 'Failed to save SEO checklist' }, { status: 500 });
  }
}
