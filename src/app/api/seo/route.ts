import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const challenges = await db.seoChallenge.findMany({
      where: { companyId: payload.companyId },
      include: { dailyTasks: { orderBy: { day: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ challenges });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { name, websiteUrl, targetKeywords, duration } = await req.json();
    if (!websiteUrl) return NextResponse.json({ error: 'Website URL required' }, { status: 400 });

    // Generate SEO daily tasks
    const taskTemplates = [
      { day: 1, title: 'Technical SEO Audit', category: 'technical', desc: 'Run a full technical SEO audit using Google Search Console and identify all critical issues.' },
      { day: 2, title: 'Keyword Research & Analysis', category: 'research', desc: 'Research target keywords using multiple tools. Identify primary, secondary, and long-tail keywords.' },
      { day: 3, title: 'Competitor Analysis', category: 'research', desc: 'Analyze top 5 competitors. Document their strategies, keywords, and backlinks.' },
      { day: 4, title: 'Website Speed Optimization', category: 'technical', desc: 'Optimize page load speed. Compress images, minify CSS/JS, enable caching.' },
      { day: 5, title: 'Fix Title Tags & Meta Descriptions', category: 'onpage', desc: 'Rewrite all title tags and meta descriptions with target keywords.' },
      { day: 6, title: 'Content Gap Analysis', category: 'content', desc: 'Identify content gaps between you and competitors. Create content plan.' },
      { day: 7, title: 'Google Search Console Setup', category: 'technical', desc: 'Verify site in GSC, submit sitemap, monitor indexing.' },
      { day: 8, title: 'Schema Markup', category: 'technical', desc: 'Implement structured data markup (JSON-LD) for all page types.' },
      { day: 9, title: 'Internal Linking Strategy', category: 'onpage', desc: 'Create internal linking structure. Add contextual links between related content.' },
      { day: 10, title: 'Image Optimization', category: 'onpage', desc: 'Optimize all images: alt tags, file names, compression, WebP format.' },
    ];

    // Fill remaining days with repeating categories
    const categories = ['content', 'offpage', 'onpage', 'technical', 'research'];
    const contentTasks = ['Publish Blog Post', 'Create Infographic', 'Write Case Study', 'Record Video Content', 'Create How-To Guide', 'Write Industry Report', 'Create FAQ Page', 'Publish White Paper'];
    const offpageTasks = ['Guest Post Outreach', 'Directory Submissions', 'Forum Participation', 'Social Bookmarking', 'Influencer Outreach', 'PR Outreach', 'Podcast Appearances', 'Community Engagement'];

    for (let i = 11; i <= duration; i++) {
      const cat = categories[i % categories.length];
      let title: string;
      if (cat === 'content') title = contentTasks[Math.floor(i / categories.length) % contentTasks.length];
      else if (cat === 'offpage') title = offpageTasks[Math.floor(i / categories.length) % offpageTasks.length];
      else title = `Day ${i} ${cat.charAt(0).toUpperCase() + cat.slice(1)} Task`;

      taskTemplates.push({ day: i, title, category: cat, desc: `Execute ${title.toLowerCase()} for continued SEO improvement.` });
    }

    const challenge = await db.seoChallenge.create({
      data: {
        name: name || `${duration}-Day SEO Challenge`,
        websiteUrl,
        targetKeywords: JSON.stringify(targetKeywords || []),
        duration,
        status: 'active',
        currentDay: 0,
        score: 0,
        results: JSON.stringify({ initialRanking: 100, currentRanking: 100, organicTraffic: 0, backlinks: 0 }),
        companyId: payload.companyId,
        dailyTasks: {
          create: taskTemplates.map(t => ({
            day: t.day,
            title: t.title,
            description: t.desc,
            category: t.category,
          })),
        },
      },
      include: { dailyTasks: true },
    });

    return NextResponse.json({ challenge });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
