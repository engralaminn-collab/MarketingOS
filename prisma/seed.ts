/**
 * MarketingOS — Base seed (idempotent, connector-safe).
 *
 * Datasource: SQLite (see prisma/schema.prisma).
 * SQLite does NOT support `createMany({ skipDuplicates: true })`, so this
 * script uses explicit existence checks (findFirst on natural keys) before
 * any insert. Re-running this script will not create duplicates.
 *
 * Exit codes:
 *   0  — all records inserted or skipped idempotently.
 *   1  — a database error occurred (error + record identifier printed).
 *
 * Usage:  npx tsx prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';

const prisma = new PrismaClient();

const counters = { inserted: 0, skipped: 0 };

function getAdminSeedPassword(): string {
  const fromEnv = process.env.ADMIN_SEED_PASSWORD;
  if (fromEnv && fromEnv.length >= 8) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SEED_PASSWORD env var required in production');
  }
  console.warn('⚠️ ADMIN_SEED_PASSWORD not set — using dev fallback "admin123"');
  return 'admin123';
}

function getAdminSeedEmail(): string {
  const fromEnv = process.env.ADMIN_SEED_EMAIL;
  if (fromEnv && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEnv)) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SEED_EMAIL env var must be a valid email in production');
  }
  console.warn('⚠️ ADMIN_SEED_EMAIL not set — using dev fallback "admin@marketingos.com"');
  return 'admin@marketingos.com';
}

async function seed() {
  const adminEmail = getAdminSeedEmail();
  console.log('Seeding database (idempotent, SQLite-safe)...');

  // ── 1. Demo company (idempotent via upsert on slug) ──────────────────────
  const company = await prisma.company.upsert({
    where: { slug: 'demo-agency' },
    update: {
      name: 'Demo Marketing Agency',
      website: 'https://demo-agency.com',
      industry: 'Marketing',
      country: 'United States',
      brandColors: JSON.stringify({ primary: '#f97316', secondary: '#3b82f6' }),
      plan: 'professional',
    },
    create: {
      name: 'Demo Marketing Agency',
      slug: 'demo-agency',
      website: 'https://demo-agency.com',
      industry: 'Marketing',
      country: 'United States',
      brandColors: JSON.stringify({ primary: '#f97316', secondary: '#3b82f6' }),
      plan: 'professional',
    },
  });
  counters.inserted += 1;

  // ── 2. Super admin user (upsert keyed on email) ─────────────────────────
  const passwordHash = await hashPassword(getAdminSeedPassword());
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: 'Admin User',
      isActive: true,
    },
  });
  counters.inserted += 1;

  // ── 3. Admin ↔ company link (role=super_admin) ─────────────────────────
  const adminLink = await prisma.companyUser.findFirst({
    where: { userId: admin.id, companyId: company.id },
  });
  if (!adminLink) {
    await prisma.companyUser.create({
      data: {
        userId: admin.id,
        companyId: company.id,
        role: 'super_admin',
        permissions: JSON.stringify({ all: true }),
      },
    });
    counters.inserted += 1;
  } else if (adminLink.role !== 'super_admin') {
    await prisma.companyUser.update({
      where: { id: adminLink.id },
      data: { role: 'super_admin', permissions: JSON.stringify({ all: true }) },
    });
    counters.inserted += 1;
  } else {
    counters.skipped += 1;
  }

  // ── 4. Team members (idempotent: skip if user with that email exists) ─
  const teamMembers = [
    { name: 'Sarah Chen', email: 'sarah@demo-agency.com', role: 'social_media_manager' },
    { name: 'Mike Johnson', email: 'mike@demo-agency.com', role: 'content_manager' },
    { name: 'Emily Davis', email: 'emily@demo-agency.com', role: 'seo_manager' },
    { name: 'James Wilson', email: 'james@demo-agency.com', role: 'manager' },
    { name: 'Lisa Park', email: 'lisa@demo-agency.com', role: 'customer_support' },
  ];

  for (const member of teamMembers) {
    const existing = await prisma.user.findUnique({ where: { email: member.email } });
    if (existing) {
      const linkExists = await prisma.companyUser.findFirst({
        where: { userId: existing.id, companyId: company.id },
      });
      if (!linkExists) {
        await prisma.companyUser.create({
          data: { userId: existing.id, companyId: company.id, role: member.role },
        });
        counters.inserted += 1;
      } else {
        counters.skipped += 1;
      }
      continue;
    }
    const user = await prisma.user.create({
      data: {
        email: member.email,
        passwordHash: await hashPassword(getAdminSeedPassword()),
        name: member.name,
        isActive: true,
      },
    });
    await prisma.companyUser.create({
      data: { userId: user.id, companyId: company.id, role: member.role },
    });
    counters.inserted += 2;
  }

  // ── 5. Social accounts (natural key: platform + accountName + companyId) ─
  const platforms = ['Facebook', 'Instagram', 'LinkedIn', 'YouTube', 'X', 'TikTok', 'Pinterest', 'Telegram'];
  const connectedPlatforms = platforms.slice(0, 4);
  for (const platform of connectedPlatforms) {
    const accountName = `Demo ${platform}`;
    const exists = await prisma.socialAccount.findFirst({
      where: { platform, accountName, companyId: company.id },
    });
    if (exists) { counters.skipped += 1; continue; }
    await prisma.socialAccount.create({
      data: {
        platform,
        accountName,
        accountHandle: `@demo${platform.toLowerCase()}`,
        accessToken: `encrypted_token_${platform.toLowerCase()}`,
        status: 'active',
        companyId: company.id,
        scopes: JSON.stringify(['read', 'write', 'publish']),
        lastSyncedAt: new Date(),
      },
    });
    counters.inserted += 1;
  }

  // ── 6. CRM leads (natural key: email + companyId) ───────────────────────
  const leadSources = ['facebook', 'google', 'website', 'referral', 'linkedin'];
  const leadStatuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
  const leadNames = [
    'Alex Thompson', 'Maria Garcia', 'David Kim', 'Jennifer Brown', 'Chris Lee',
    'Amanda White', 'Robert Taylor', 'Nicole Martinez', 'Kevin Anderson', 'Rachel Thomas',
    'Daniel Harris', 'Stephanie Clark', 'Michael Lewis', 'Lauren Robinson', 'Brandon Walker',
  ];

  for (let i = 0; i < leadNames.length; i++) {
    const status = leadStatuses[i % leadStatuses.length];
    const email = `${leadNames[i].toLowerCase().replace(' ', '.')}@email.com`;
    const exists = await prisma.lead.findFirst({ where: { email, companyId: company.id } });
    if (exists) { counters.skipped += 1; continue; }
    await prisma.lead.create({
      data: {
        name: leadNames[i],
        email,
        phone: `+1-555-${String(1000 + i).padStart(4, '0')}`,
        companyName: ['TechCorp', 'DesignStudio', 'GrowthLab', 'MediaPro', 'BrandForce'][i % 5],
        source: leadSources[i % leadSources.length],
        status,
        score: Math.floor(Math.random() * 100),
        companyId: company.id,
      },
    });
    counters.inserted += 1;
  }

  // ── 7. Deals (natural key: name + companyId) ──────────────────────────────
  const stages = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
  const dealNames = ['Website Redesign', 'Social Campaign', 'SEO Package', 'Brand Identity', 'Content Strategy', 'Email Automation'];
  for (let i = 0; i < 6; i++) {
    const name = `Deal ${String.fromCharCode(65 + i)} - ${dealNames[i]}`;
    const exists = await prisma.deal.findFirst({ where: { name, companyId: company.id } });
    if (exists) { counters.skipped += 1; continue; }
    await prisma.deal.create({
      data: {
        name,
        value: [5000, 12000, 8000, 15000, 6000, 3000][i],
        stage: stages[i],
        probability: [10, 30, 50, 70, 100, 0][i],
        companyId: company.id,
      },
    });
    counters.inserted += 1;
  }

  // ── 8. SEO challenge (natural key: name + companyId) ─────────────────────
  const challengeName = '60-Day SEO Growth Challenge';
  let challenge = await prisma.seoChallenge.findFirst({
    where: { name: challengeName, companyId: company.id },
  });
  if (challenge) {
    counters.skipped += 1;
  } else {
    challenge = await prisma.seoChallenge.create({
      data: {
        name: challengeName,
        websiteUrl: 'https://demo-agency.com',
        targetKeywords: JSON.stringify(['marketing automation', 'social media management', 'AI marketing', 'content strategy', 'SEO optimization']),
        duration: 60,
        status: 'active',
        currentDay: 12,
        score: 45,
        results: JSON.stringify({
          initialRanking: 85,
          currentRanking: 62,
          organicTraffic: 1240,
          backlinks: 23,
          keywordRankings: { improved: 8, stable: 12, declined: 2 },
        }),
        companyId: company.id,
      },
    });
    counters.inserted += 1;
  }
  if (!challenge) throw new Error('Failed to load SEO challenge for companyId=' + company.id);

  // ── 9. SEO daily tasks (natural key: title + challengeId) ────────────────
  const seoTasks = [
    { day: 1, title: 'Technical SEO Audit', category: 'technical', status: 'completed' },
    { day: 2, title: 'Keyword Research & Analysis', category: 'research', status: 'completed' },
    { day: 3, title: 'Website Speed Optimization', category: 'technical', status: 'completed' },
    { day: 4, title: 'On-Page SEO Fix: Title Tags', category: 'onpage', status: 'completed' },
    { day: 5, title: 'On-Page SEO Fix: Meta Descriptions', category: 'onpage', status: 'completed' },
    { day: 6, title: 'Content Gap Analysis', category: 'content', status: 'completed' },
    { day: 7, title: 'Google Search Console Setup', category: 'technical', status: 'completed' },
    { day: 8, title: 'Schema Markup Implementation', category: 'technical', status: 'completed' },
    { day: 9, title: 'Internal Linking Strategy', category: 'onpage', status: 'completed' },
    { day: 10, title: 'Image Alt Text Optimization', category: 'onpage', status: 'completed' },
    { day: 11, title: 'Blog Post: Industry Keywords', category: 'content', status: 'completed' },
    { day: 12, title: 'Competitor Backlink Analysis', category: 'offpage', status: 'completed' },
    { day: 13, title: 'Guest Post Outreach (5 sites)', category: 'offpage', status: 'in_progress' },
    { day: 14, title: 'Create Linkable Content Assets', category: 'content', status: 'pending' },
    { day: 15, title: 'Social Media Profile Optimization', category: 'offpage', status: 'pending' },
  ];

  for (const task of seoTasks) {
    const exists = await prisma.seoDailyTask.findFirst({
      where: { title: task.title, challengeId: challenge.id },
    });
    if (exists) { counters.skipped += 1; continue; }
    await prisma.seoDailyTask.create({
      data: {
        ...task,
        description: `Complete ${task.title.toLowerCase()} for improved search rankings.`,
        challengeId: challenge.id,
        completedAt: task.status === 'completed' ? new Date() : null,
      },
    });
    counters.inserted += 1;
  }

  // ── 10. AI agents (natural key: name + companyId) ────────────────────────
  const agentTypes = [
    { name: 'SEO Agent', type: 'seo', desc: 'Automated SEO analysis and optimization' },
    { name: 'Content Writer', type: 'content', desc: 'AI-powered content creation' },
    { name: 'Social Media Manager', type: 'social', desc: 'Social media post creation and scheduling' },
    { name: 'Lead Generator', type: 'lead_gen', desc: 'Automated lead generation and qualification' },
    { name: 'Analytics Agent', type: 'analytics', desc: 'Performance tracking and insights' },
    { name: 'Email Campaign Agent', type: 'email', desc: 'Email marketing automation' },
    { name: 'Video Creator', type: 'video', desc: 'Video content generation' },
    { name: 'Image Creator', type: 'image', desc: 'Image and graphic creation' },
    { name: 'Brand Strategist', type: 'branding', desc: 'Brand strategy and positioning' },
    { name: 'Competitor Research Agent', type: 'competitor', desc: 'Competitor analysis and monitoring' },
    { name: 'CRM Agent', type: 'crm', desc: 'Customer relationship management' },
    { name: 'Sales Agent', type: 'sales', desc: 'Sales automation and pipeline management' },
    { name: 'SMS Agent', type: 'sms', desc: 'SMS campaign management' },
    { name: 'Strategy Planner', type: 'strategy', desc: 'Marketing strategy planning' },
  ];

  for (const agent of agentTypes) {
    const exists = await prisma.aiAgent.findFirst({
      where: { name: agent.name, companyId: company.id },
    });
    if (exists) { counters.skipped += 1; continue; }
    await prisma.aiAgent.create({
      data: {
        name: agent.name,
        type: agent.type,
        description: agent.desc,
        isEnabled: Math.random() > 0.3,
        companyId: company.id,
      },
    });
    counters.inserted += 1;
  }

  // ── 11. Content (natural key: title + companyId) ─────────────────────────
  const contentTypes = ['blog', 'social_post', 'email', 'sms', 'landing_page', 'video_script', 'ad_copy'];
  const statuses = ['draft', 'scheduled', 'published', 'archived'];
  const contentTitles = [
    '10 Marketing Trends for 2025', 'How AI Transforms Social Media', 'SEO Best Practices Guide',
    'Content Marketing 101', 'Social Media Strategy Template', 'Email Marketing Tips',
    'Video Marketing Guide', 'Brand Building Strategies', 'Lead Generation Tactics',
    'Marketing Automation Setup', 'Analytics Dashboard Guide', 'Customer Journey Mapping',
  ];
  for (let i = 0; i < contentTitles.length; i++) {
    const title = contentTitles[i];
    const exists = await prisma.content.findFirst({ where: { title, companyId: company.id } });
    if (exists) { counters.skipped += 1; continue; }
    await prisma.content.create({
      data: {
        title,
        type: contentTypes[i % contentTypes.length],
        status: statuses[i % statuses.length],
        platform: ['Facebook', 'Instagram', 'LinkedIn', 'Blog', 'Email', 'YouTube'][i % 6],
        aiGenerated: Math.random() > 0.4,
        engagement: JSON.stringify({
          likes: Math.floor(Math.random() * 500),
          shares: Math.floor(Math.random() * 100),
          comments: Math.floor(Math.random() * 50),
          clicks: Math.floor(Math.random() * 200),
        }),
        companyId: company.id,
        scheduledAt: i % 3 === 1 ? new Date(Date.now() + i * 86400000) : null,
        publishedAt: i % 3 === 2 ? new Date(Date.now() - i * 86400000) : null,
      },
    });
    counters.inserted += 1;
  }

  // ── 12. Campaigns (natural key: name + companyId) ────────────────────────
  const campaigns = [
    { name: 'Q1 Brand Awareness', type: 'social', status: 'active', budget: 5000 },
    { name: 'Product Launch 2025', type: 'multi_channel', status: 'active', budget: 15000 },
    { name: 'Holiday Email Blast', type: 'email', status: 'completed', budget: 2000 },
    { name: 'SEO Content Push', type: 'content', status: 'active', budget: 3000 },
  ];

  for (const campaign of campaigns) {
    const exists = await prisma.campaign.findFirst({
      where: { name: campaign.name, companyId: company.id },
    });
    if (exists) { counters.skipped += 1; continue; }
    await prisma.campaign.create({
      data: {
        ...campaign,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        metrics: JSON.stringify({
          reach: Math.floor(Math.random() * 50000),
          impressions: Math.floor(Math.random() * 100000),
          clicks: Math.floor(Math.random() * 5000),
          conversions: Math.floor(Math.random() * 500),
          spend: campaign.budget * (0.3 + Math.random() * 0.5),
        }),
        companyId: company.id,
      },
    });
    counters.inserted += 1;
  }

  // ── 13. Subscription (one per company) ───────────────────────────────────
  const existingSub = await prisma.subscription.findFirst({ where: { companyId: company.id } });
  if (existingSub) {
    counters.skipped += 1;
  } else {
    await prisma.subscription.create({
      data: {
        plan: 'professional',
        billingCycle: 'monthly',
        amount: 99,
        status: 'active',
        startsAt: new Date('2025-01-01'),
        endsAt: new Date('2025-12-31'),
        companyId: company.id,
      },
    });
    counters.inserted += 1;
  }

  // ── 14. Audit logs (idempotent: skip by action+resource+userId+companyId) ─
  const auditLogDefs = [
    { action: 'user.login', resource: 'auth', details: 'Admin logged in' },
    { action: 'social.connect', resource: 'social_account', details: 'Connected Facebook account' },
    { action: 'content.create', resource: 'content', details: 'Created new blog post' },
    { action: 'crm.lead_create', resource: 'lead', details: 'New lead added' },
    { action: 'seo.challenge_start', resource: 'seo_challenge', details: 'Started 60-day SEO challenge' },
  ];
  for (const log of auditLogDefs) {
    const exists = await prisma.auditLog.findFirst({
      where: { action: log.action, resource: log.resource, userId: admin.id, companyId: company.id },
    });
    if (exists) { counters.skipped += 1; continue; }
    await prisma.auditLog.create({
      data: { ...log, userId: admin.id, companyId: company.id },
    });
    counters.inserted += 1;
  }

  // ── Verified final summary ──────────────────────────────────────────────
  const verified = await Promise.all([
    prisma.company.count({ where: { slug: 'demo-agency' } }),
    prisma.user.count(),
    prisma.companyUser.count({ where: { companyId: company.id } }),
    prisma.socialAccount.count({ where: { companyId: company.id } }),
    prisma.lead.count({ where: { companyId: company.id } }),
    prisma.deal.count({ where: { companyId: company.id } }),
    prisma.seoChallenge.count({ where: { companyId: company.id } }),
    prisma.seoDailyTask.count({ where: { challengeId: challenge.id } }),
    prisma.aiAgent.count({ where: { companyId: company.id } }),
    prisma.content.count({ where: { companyId: company.id } }),
    prisma.campaign.count({ where: { companyId: company.id } }),
    prisma.subscription.count({ where: { companyId: company.id } }),
    prisma.auditLog.count({ where: { companyId: company.id } }),
  ]);

  console.log('\n' + '='.repeat(60));
  console.log('✅ Base seed complete (idempotent, verified).');
  console.log('='.repeat(60));
  console.log(`  Inserted: ${counters.inserted}  |  Skipped (existing): ${counters.skipped}`);
  console.log(`  Company (demo-agency): ${verified[0]} | Users: ${verified[1]} | CompanyUser links: ${verified[2]}`);
  console.log(`  SocialAccounts: ${verified[3]} | Leads: ${verified[4]} | Deals: ${verified[5]}`);
  console.log(`  SeoChallenges: ${verified[6]} | SeoDailyTasks: ${verified[7]} | AiAgents: ${verified[8]}`);
  console.log(`  Content: ${verified[9]} | Campaigns: ${verified[10]} | Subscriptions: ${verified[11]} | AuditLogs: ${verified[12]}`);
  console.log(`  Admin email: ${adminEmail}`);
  console.log('='.repeat(60));
}

seed()
  .catch((e) => {
    console.error('\n❌ Base seed FAILED.');
    console.error('  Error:', e?.message ?? e);
    if (e?.code) console.error('  Prisma error code:', e.code);
    if (e?.meta) console.error('  Meta:', JSON.stringify(e.meta));
    prisma.$disconnect().finally(() => process.exit(1));
  })
  .finally(() => prisma.$disconnect());
