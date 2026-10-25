import { randomBytes } from 'node:crypto';
import { db as prisma } from '../src/lib/db';
import { hashPassword, createToken } from '../src/lib/auth';

// ─── Administrator seed identity ─────────────────────────────────────────────
// The address is an identifier, not a secret, and stays overridable per environment.
const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL || 'admin@marketingos.com';

const MIN_ADMIN_PASSWORD_LENGTH = 12;

/** Generates a cryptographically strong, single-use password. */
function generateStrongPassword(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Resolves the administrator password used when the account is first created.
 *
 * The value is NEVER hardcoded:
 *   - Production: `ADMIN_SEED_PASSWORD` is mandatory; the seed refuses to run without it.
 *   - Non-production: a random one-time password is generated and printed once so the
 *     developer can sign in. It is not a shared/known default and is never committed.
 */
function resolveAdminSeedPassword(): { password: string; generated: boolean } {
  const fromEnv = process.env.ADMIN_SEED_PASSWORD;

  if (fromEnv) {
    if (fromEnv.length < MIN_ADMIN_PASSWORD_LENGTH) {
      throw new Error(
        `ADMIN_SEED_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters long.`
      );
    }
    return { password: fromEnv, generated: false };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ADMIN_SEED_PASSWORD environment variable is required in production. ' +
        'Generate one with `openssl rand -base64 24` and store it server-side only.'
    );
  }

  return { password: generateStrongPassword(), generated: true };
}

async function seed() {
  console.log('Seeding database...');

  // ── Super admin user ───────────────────────────────────────────────────────
  // An existing administrator is never silently re-credentialed. The stored hash
  // is only rewritten when an operator explicitly supplies ADMIN_SEED_PASSWORD
  // (the documented rotation path in docs/DEPLOYMENT-RUNBOOK.md).
  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  let generatedAdminPassword: string | null = null;
  let admin;

  if (existingAdmin) {
    if (process.env.ADMIN_SEED_PASSWORD) {
      const { password } = resolveAdminSeedPassword();
      admin = await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { passwordHash: await hashPassword(password), isActive: true },
      });
      console.log('Existing administrator password hash rotated from ADMIN_SEED_PASSWORD.');
    } else {
      admin = existingAdmin;
      console.log('Existing administrator left untouched (no ADMIN_SEED_PASSWORD supplied).');
    }
  } else {
    const resolved = resolveAdminSeedPassword();
    if (resolved.generated) generatedAdminPassword = resolved.password;
    admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash: await hashPassword(resolved.password),
        name: 'Admin User',
        isActive: true,
      },
    });
  }

  // Create demo company (idempotent via upsert on slug)
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

  // Link admin to company (idempotent — find existing link first)
  const existingLink = await prisma.companyUser.findFirst({
    where: { userId: admin.id, companyId: company.id },
  });
  if (!existingLink) {
    await prisma.companyUser.create({
      data: {
        userId: admin.id,
        companyId: company.id,
        role: 'company_owner',
        permissions: JSON.stringify({ all: true }),
      },
    });
  }

  // Create team members
  const teamMembers = [
    { name: 'Sarah Chen', email: 'sarah@demo-agency.com', role: 'social_media_manager' },
    { name: 'Mike Johnson', email: 'mike@demo-agency.com', role: 'content_manager' },
    { name: 'Emily Davis', email: 'emily@demo-agency.com', role: 'seo_manager' },
    { name: 'James Wilson', email: 'james@demo-agency.com', role: 'manager' },
    { name: 'Lisa Park', email: 'lisa@demo-agency.com', role: 'customer_support' },
  ];

  for (const member of teamMembers) {
    // Idempotent — skip if user already exists
    const existing = await prisma.user.findUnique({ where: { email: member.email } });
    if (existing) {
      // Ensure link to company exists
      const linkExists = await prisma.companyUser.findFirst({ where: { userId: existing.id, companyId: company.id } });
      if (!linkExists) {
        await prisma.companyUser.create({
          data: { userId: existing.id, companyId: company.id, role: member.role },
        });
      }
      continue;
    }
    // Demo team members exist to populate the UI, not to be signed into. Each one
    // gets a unique, unguessable secret that is never printed, stored in plaintext,
    // or shared — sign-in requires an explicit password reset by an administrator.
    const user = await prisma.user.create({
      data: {
        email: member.email,
        passwordHash: await hashPassword(generateStrongPassword()),
        name: member.name,
        isActive: true,
      },
    });
    await prisma.companyUser.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role: member.role,
      },
    });
  }

  // Create social accounts
  const platforms = ['Facebook', 'Instagram', 'LinkedIn', 'YouTube', 'X', 'TikTok', 'Pinterest', 'Telegram'];
  const connectedPlatforms = platforms.slice(0, 4);
  for (const platform of connectedPlatforms) {
    await prisma.socialAccount.create({
      data: {
        platform,
        accountName: `Demo ${platform}`,
        accountHandle: `@demo${platform.toLowerCase()}`,
        // Inert placeholder for demo data — not a credential. Real tokens are
        // supplied at runtime through the integrations flow and stored encrypted.
        accessToken: `placeholder-no-token-${platform.toLowerCase()}`,
        status: 'needs_revalidation',
        companyId: company.id,
        scopes: JSON.stringify([]),
        lastSyncedAt: null,
      },
    });
  }

  // Create CRM leads
  const leadSources = ['facebook', 'google', 'website', 'referral', 'linkedin'];
  const leadStatuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
  const leadNames = [
    'Alex Thompson', 'Maria Garcia', 'David Kim', 'Jennifer Brown', 'Chris Lee',
    'Amanda White', 'Robert Taylor', 'Nicole Martinez', 'Kevin Anderson', 'Rachel Thomas',
    'Daniel Harris', 'Stephanie Clark', 'Michael Lewis', 'Lauren Robinson', 'Brandon Walker',
  ];

  for (let i = 0; i < leadNames.length; i++) {
    const status = leadStatuses[i % leadStatuses.length];
    await prisma.lead.create({
      data: {
        name: leadNames[i],
        email: `${leadNames[i].toLowerCase().replace(' ', '.')}@email.com`,
        phone: `+1-555-${String(1000 + i).padStart(4, '0')}`,
        companyName: ['TechCorp', 'DesignStudio', 'GrowthLab', 'MediaPro', 'BrandForce'][i % 5],
        source: leadSources[i % leadSources.length],
        status,
        score: Math.floor(Math.random() * 100),
        companyId: company.id,
      },
    });
  }

  // Create deals
  const stages = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
  for (let i = 0; i < 6; i++) {
    await prisma.deal.create({
      data: {
        name: `Deal ${String.fromCharCode(65 + i)} - ${['Website Redesign', 'Social Campaign', 'SEO Package', 'Brand Identity', 'Content Strategy', 'Email Automation'][i]}`,
        value: [5000, 12000, 8000, 15000, 6000, 3000][i],
        stage: stages[i],
        probability: [10, 30, 50, 70, 100, 0][i],
        companyId: company.id,
      },
    });
  }

  // Create SEO challenge
  const challenge = await prisma.seoChallenge.create({
    data: {
      name: '60-Day SEO Growth Challenge',
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

  // Create SEO daily tasks
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
    await prisma.seoDailyTask.create({
      data: {
        ...task,
        description: `Complete ${task.title.toLowerCase()} for improved search rankings.`,
        challengeId: challenge.id,
        completedAt: task.status === 'completed' ? new Date() : null,
      },
    });
  }

  // Create AI agents
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
    await prisma.aiAgent.create({
      data: {
        name: agent.name,
        type: agent.type,
        description: agent.desc,
        isEnabled: Math.random() > 0.3,
        companyId: company.id,
      },
    });
  }

  // Create content pieces
  const contentTypes = ['blog', 'social_post', 'email', 'sms', 'landing_page', 'video_script', 'ad_copy'];
  const statuses = ['draft', 'scheduled', 'published', 'archived'];
  for (let i = 0; i < 12; i++) {
    await prisma.content.create({
      data: {
        title: ['10 Marketing Trends for 2025', 'How AI Transforms Social Media', 'SEO Best Practices Guide', 'Content Marketing 101', 'Social Media Strategy Template', 'Email Marketing Tips', 'Video Marketing Guide', 'Brand Building Strategies', 'Lead Generation Tactics', 'Marketing Automation Setup', 'Analytics Dashboard Guide', 'Customer Journey Mapping'][i],
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
  }

  // Create campaigns
  const campaigns = [
    { name: 'Q1 Brand Awareness', type: 'social', status: 'active', budget: 5000 },
    { name: 'Product Launch 2025', type: 'multi_channel', status: 'active', budget: 15000 },
    { name: 'Holiday Email Blast', type: 'email', status: 'completed', budget: 2000 },
    { name: 'SEO Content Push', type: 'content', status: 'active', budget: 3000 },
  ];

  for (const campaign of campaigns) {
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
  }

  // Create subscription
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

  // Create audit logs
  await prisma.auditLog.createMany({
    data: [
      { action: 'user.login', resource: 'auth', details: 'Admin logged in', userId: admin.id, companyId: company.id },
      { action: 'social.connect', resource: 'social_account', details: 'Connected Facebook account', userId: admin.id, companyId: company.id },
      { action: 'content.create', resource: 'content', details: 'Created new blog post', userId: admin.id, companyId: company.id },
      { action: 'crm.lead_create', resource: 'lead', details: 'New lead added', userId: admin.id, companyId: company.id },
      { action: 'seo.challenge_start', resource: 'seo_challenge', details: 'Started 60-day SEO challenge', userId: admin.id, companyId: company.id },
    ],
  });

  console.log('Seed completed successfully!');
  console.log(`Admin email: ${ADMIN_EMAIL}`);

  if (generatedAdminPassword) {
    console.log('');
    console.log('  No ADMIN_SEED_PASSWORD was set, so a one-time random password was');
    console.log('  generated for the new administrator account. Copy it now — it is');
    console.log('  hashed on save and cannot be recovered:');
    console.log('');
    console.log(`      ${generatedAdminPassword}`);
    console.log('');
    console.log('  Set ADMIN_SEED_PASSWORD in your server-side .env to control this value.');
  } else {
    console.log('Admin credentials unchanged — managed via the ADMIN_SEED_PASSWORD env var.');
  }
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
