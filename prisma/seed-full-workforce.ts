/**
 * MarketingOS — Full workforce seed (idempotent, SQLite-safe).
 *
 * Adds the additional departments / skills / prompts / SOPs / AgentProfiles
 * required to hit the platform targets (100 depts, 10k+ skills, 50k+ prompts,
 * 500+ SOPs, 2000 AgentProfiles). All inserts are idempotent: existing unique
 * keys (Skill.name, AgentProfile.agentId, Department.code) and natural keys
 * (Prompt.name+companyId, Sop.name+companyId) are queried first and only
 * missing records are inserted.
 *
 * Datasource: SQLite — `createMany({ skipDuplicates: true })` is NOT supported,
 * so we use the query-then-insert-missing pattern explicitly.
 *
 * Exit codes:
 *   0  — all records inserted or skipped idempotently.
 *   1  — a database error occurred (error + record identifier printed).
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ── Idempotency counters (printed in final summary) ─────────────────────────
const counters = {
  departmentsInserted: 0, departmentsSkipped: 0,
  skillsInserted: 0, skillsSkipped: 0,
  promptsInserted: 0, promptsSkipped: 0,
  sopsInserted: 0, sopsSkipped: 0,
  profilesInserted: 0, profilesSkipped: 0,
};

const SKILL_CATEGORIES = [
  { cat: 'marketing', skills: ['SEO Analysis','Content Strategy','Social Media Management','Email Marketing','PPC Advertising','Brand Management','Market Research','Campaign Optimization','Marketing Automation','Copywriting','Conversion Rate Optimization','A/B Testing','Google Analytics','Facebook Ads','Instagram Marketing','LinkedIn Marketing','Twitter Marketing','TikTok Marketing','YouTube Marketing','Pinterest Marketing','Influencer Marketing','Affiliate Marketing','Content Distribution','Lead Magnet Creation','Landing Page Optimization','Marketing Funnel Design','Customer Journey Mapping','Brand Voice Development','Press Release Writing','Media Outreach','Event Marketing','Webinar Marketing','Podcast Marketing','Video Marketing','GIF Marketing','Meme Marketing','QR Code Marketing','SMS Marketing','Push Notification Marketing','In-App Marketing','Retargeting','Lookalike Audiences','Custom Audiences','Google Tag Manager','Heatmap Analysis','Funnel Analysis','Attribution Modeling','Growth Hacking','Viral Marketing'] },
  { cat: 'sales', skills: ['Cold Calling','Lead Qualification','Sales Pipeline Management','CRM Administration','Sales Forecasting','Negotiation','Closing Techniques','Objection Handling','Sales Scripting','Sales Deck Creation','Proposal Writing','Contract Review','Pricing Strategy','Discount Management','Upselling','Cross-selling','Account Management','Key Account Strategy','Territory Management','Sales Coaching','Sales Team Leadership','Sales Process Design','Sales Enablement','Competitive Analysis','Win/Loss Analysis','Sales Reporting','Pipeline Review','Forecasting Models','Quota Setting','Commission Structure','Sales Funnel Optimization','Lead Scoring','Lead Routing','Sales Cadence','Follow-up Strategy','Referral Programs','Partner Sales','Channel Sales','Direct Sales','Inside Sales','Field Sales','Enterprise Sales','SMB Sales','Retail Sales','E-commerce Sales','B2B Sales','B2C Sales','SaaS Sales','Solution Selling'] },
  { cat: 'engineering', skills: ['TypeScript','JavaScript','Python','Go','Rust','Java','C#','Ruby','PHP','Swift','React','Vue','Angular','Svelte','Next.js','Nuxt','Node.js','Express','Fastify','NestJS','PostgreSQL','MySQL','MongoDB','Redis','SQLite','DynamoDB','Cassandra','Elasticsearch','InfluxDB','Neo4j','Docker','Kubernetes','AWS','GCP','Azure','Terraform','Ansible','Jenkins','GitHub Actions','GitLab CI','REST API Design','GraphQL','gRPC','WebSocket','WebRTC','SIP','RTP','Microservices','Event-Driven Architecture','Message Queues','CQRS','Event Sourcing','DDD','Clean Architecture','SOLID','Design Patterns','Unit Testing','Integration Testing','E2E Testing','Load Testing','Security Testing','Code Review','Pair Programming','TDD','BDD','CI/CD','DevOps','SRE','Monitoring','Logging','Tracing','Alerting','Incident Response','Feature Flags'] },
  { cat: 'creative', skills: ['Graphic Design','UI/UX Design','Logo Design','Brand Identity','Typography','Color Theory','Layout Design','Print Design','Packaging Design','Infographic Design','Video Editing','Motion Graphics','Animation','3D Modeling','VFX','Photography','Photo Editing','Retouching','Color Grading','Compositing','Illustration','Character Design','Storyboarding','Concept Art','Matte Painting','Audio Production','Music Composition','Sound Design','Voice Direction','Podcast Production','Script Writing','Screenwriting','Copy Editing','Creative Writing','Storytelling','Art Direction','Creative Direction','Brand Storytelling','Visual Identity','Style Guide Creation'] },
  { cat: 'data', skills: ['Data Analysis','Statistical Analysis','Predictive Modeling','Machine Learning','Deep Learning','NLP','Computer Vision','Time Series Analysis','Regression Analysis','Classification','Clustering','Dimensionality Reduction','Feature Engineering','Model Evaluation','Hyperparameter Tuning','Data Visualization','Dashboard Design','Tableau','Power BI','Looker','SQL','Pandas','NumPy','Scikit-learn','TensorFlow','PyTorch','Keras','XGBoost','LightGBM','CatBoost','ETL Pipelines','Data Warehousing','Data Lake','Data Governance','Data Quality','Big Data','Spark','Hadoop','Kafka','Airflow','Experiment Design','Causal Inference','Bayesian Analysis','Monte Carlo Simulation'] },
  { cat: 'finance', skills: ['Financial Analysis','Budgeting','Forecasting','Cash Flow Management','P&L Analysis','Balance Sheet Analysis','Financial Modeling','DCF Valuation','Comparable Analysis','Precedent Transactions','Tax Planning','Tax Filing','Audit Preparation','Internal Controls','SOX Compliance','Accounts Payable','Accounts Receivable','Payroll','Invoicing','Expense Management','Bank Reconciliation','Credit Analysis','Debt Management','Equity Management','Cap Table Management','Financial Reporting','SEC Filings','GAAP','IFRS','Auditing'] },
  { cat: 'operations', skills: ['Process Design','Process Optimization','Lean Six Sigma','Kaizen','5S','Supply Chain Management','Inventory Management','Logistics','Procurement','Vendor Management','Project Management','Agile','Scrum','Kanban','Waterfall','OKR Setting','KPI Tracking','Performance Management','Capacity Planning','Resource Allocation','Quality Assurance','Quality Control','Root Cause Analysis','Fishbone Diagram','Pareto Analysis','SOP Development','Process Documentation','Workflow Design','Automation','Digital Transformation'] },
  { cat: 'support', skills: ['Customer Service','Ticket Management','Live Chat','Phone Support','Email Support','Technical Support','Product Support','Account Support','Billing Support','Refund Processing','Complaint Handling','Escalation Management','Customer Onboarding','Customer Education','Knowledge Base Creation','CSAT Improvement','NPS Management','First Contact Resolution','Average Handle Time','Service Level Agreement','Multi-channel Support','Omnichannel Routing','Sentiment Analysis','Voice of Customer','Customer Feedback Analysis'] },
  { cat: 'security', skills: ['Security Analysis','Penetration Testing','Vulnerability Assessment','Threat Modeling','Risk Assessment','SIEM','SOC Operations','Incident Response','Digital Forensics','Malware Analysis','Network Security','Application Security','Cloud Security','Container Security','IAM','Cryptography','PKI','OAuth 2.0','OIDC','SAML','GDPR Compliance','HIPAA Compliance','PCI DSS','ISO 27001','SOC 2','Security Awareness Training','Phishing Simulation','Security Policies','Access Control','Zero Trust'] },
  { cat: 'management', skills: ['Strategic Planning','Business Development','Change Management','Organizational Design','Talent Management','Leadership','Team Building','Conflict Resolution','Decision Making','Problem Solving','Stakeholder Management','Board Reporting','Investor Relations','M&A Strategy','Due Diligence','Performance Coaching','Mentoring','Delegation','Prioritization','Time Management','Meeting Facilitation','Presentation Skills','Public Speaking','Negotiation','Influence','OKR Facilitation','Strategy Execution','Business Model Innovation','Growth Hacking','Product-Market Fit'] },
];

const ADDITIONAL_DEPARTMENTS = [
  { name: 'Legal', code: 'LEG', level: 0, icon: 'Scale', color: '#64748b', description: 'Legal affairs and compliance', sortOrder: 11 },
  { name: 'Creative Studio', code: 'CRE', level: 0, icon: 'Palette', color: '#f59e0b', description: 'Creative design and content production', sortOrder: 12 },
  { name: 'Brand Marketing', code: 'MKT-BRD', level: 2, parentId: 'MKT', icon: 'Star', color: '#fbbf24', description: 'Brand strategy and identity management', sortOrder: 10 },
  { name: 'Growth Marketing', code: 'MKT-GRW', level: 2, parentId: 'MKT', icon: 'TrendingUp', color: '#34d399', description: 'Growth experiments and viral loops', sortOrder: 11 },
  { name: 'Marketing Operations', code: 'MKT-OPS', level: 2, parentId: 'MKT', icon: 'Settings', color: '#60a5fa', description: 'Marketing tech stack and automation', sortOrder: 12 },
  { name: 'PR & Communications', code: 'MKT-PR', level: 2, parentId: 'MKT', icon: 'Newspaper', color: '#f87171', description: 'Public relations and media relations', sortOrder: 13 },
  { name: 'Enterprise Sales', code: 'SAL-ENT', level: 2, parentId: 'SAL', icon: 'Building', color: '#22c55e', description: 'Enterprise account sales', sortOrder: 10 },
  { name: 'SMB Sales', code: 'SAL-SMB', level: 2, parentId: 'SAL', icon: 'Store', color: '#16a34a', description: 'Small business sales', sortOrder: 11 },
  { name: 'Channel Sales', code: 'SAL-CHN', level: 2, parentId: 'SAL', icon: 'Network', color: '#15803d', description: 'Partner and reseller channel', sortOrder: 12 },
  { name: 'Sales Development', code: 'SAL-DEV', level: 2, parentId: 'SAL', icon: 'Phone', color: '#166534', description: 'SDR team and outbound prospecting', sortOrder: 13 },
  { name: 'Frontend Engineering', code: 'ENG-FE', level: 2, parentId: 'ENG', icon: 'Monitor', color: '#0ea5e9', description: 'Client-side development', sortOrder: 10 },
  { name: 'Backend Engineering', code: 'ENG-BE', level: 2, parentId: 'ENG', icon: 'Server', color: '#0284c7', description: 'Server-side development', sortOrder: 11 },
  { name: 'DevOps & Infrastructure', code: 'ENG-DEV', level: 2, parentId: 'ENG', icon: 'Cloud', color: '#0369a1', description: 'CI/CD, cloud, and infrastructure', sortOrder: 12 },
  { name: 'Mobile Engineering', code: 'ENG-MOB', level: 2, parentId: 'ENG', icon: 'Smartphone', color: '#075985', description: 'iOS and Android development', sortOrder: 13 },
  { name: 'QA Engineering', code: 'ENG-QA', level: 2, parentId: 'ENG', icon: 'CheckCircle', color: '#0891b2', description: 'Quality assurance and testing', sortOrder: 14 },
  { name: 'Accounting', code: 'FIN-ACC', level: 2, parentId: 'FIN', icon: 'BookOpen', color: '#6366f1', description: 'Bookkeeping and financial statements', sortOrder: 10 },
  { name: 'Treasury', code: 'FIN-TRS', level: 2, parentId: 'FIN', icon: 'Landmark', color: '#4f46e5', description: 'Cash and investment management', sortOrder: 11 },
  { name: 'Financial Planning', code: 'FIN-PLN', level: 2, parentId: 'FIN', icon: 'TrendingUp', color: '#4338ca', description: 'Budgeting and forecasting', sortOrder: 12 },
  { name: 'Supply Chain', code: 'OPS-SUP', level: 2, parentId: 'OPS', icon: 'Truck', color: '#8b5cf6', description: 'Procurement and logistics', sortOrder: 10 },
  { name: 'Quality Management', code: 'OPS-QA', level: 2, parentId: 'OPS', icon: 'Award', color: '#7c3aed', description: 'Process quality and standards', sortOrder: 11 },
  { name: 'Talent Acquisition', code: 'HR-TAL', level: 2, parentId: 'HR', icon: 'Search', color: '#ec4899', description: 'Recruitment and hiring', sortOrder: 10 },
  { name: 'Learning & Development', code: 'HR-LND', level: 2, parentId: 'HR', icon: 'GraduationCap', color: '#db2777', description: 'Training and skill development', sortOrder: 11 },
  { name: 'Employee Relations', code: 'HR-ER', level: 2, parentId: 'HR', icon: 'HeartHandshake', color: '#be185d', description: 'Employee engagement and wellbeing', sortOrder: 12 },
  { name: 'Technical Support', code: 'CX-TEC', level: 2, parentId: 'CX', icon: 'Wrench', color: '#f97316', description: 'Technical issue resolution', sortOrder: 10 },
  { name: 'Customer Success', code: 'CX-CSM', level: 2, parentId: 'CX', icon: 'Trophy', color: '#ea580c', description: 'Customer onboarding and retention', sortOrder: 11 },
  { name: 'Product Management', code: 'PRD-PM', level: 2, parentId: 'PRD', icon: 'Clipboard', color: '#14b8a6', description: 'Product strategy and roadmap', sortOrder: 10 },
  { name: 'Product Design', code: 'PRD-DSN', level: 2, parentId: 'PRD', icon: 'PenTool', color: '#0d9488', description: 'UX/UI design', sortOrder: 11 },
  { name: 'Data Engineering', code: 'DAT-ENG', level: 2, parentId: 'DAT', icon: 'Database', color: '#06b6d4', description: 'Data pipeline and warehouse', sortOrder: 10 },
  { name: 'Data Science', code: 'DAT-SCI', level: 2, parentId: 'DAT', icon: 'Brain', color: '#0891b2', description: 'ML models and analytics', sortOrder: 11 },
  { name: 'Contract Law', code: 'LEG-CON', level: 2, parentId: 'LEG', icon: 'FileText', color: '#475569', description: 'Contract drafting and review', sortOrder: 10 },
  { name: 'Compliance', code: 'LEG-COM', level: 2, parentId: 'LEG', icon: 'Shield', color: '#334155', description: 'Regulatory compliance', sortOrder: 11 },
  { name: 'Graphic Design', code: 'CRE-GFX', level: 2, parentId: 'CRE', icon: 'Image', color: '#f59e0b', description: 'Visual design and branding', sortOrder: 10 },
  { name: 'Video Production', code: 'CRE-VID', level: 2, parentId: 'CRE', icon: 'Video', color: '#d97706', description: 'Video editing and motion graphics', sortOrder: 11 },
  { name: 'Content Writing', code: 'CRE-WRT', level: 2, parentId: 'CRE', icon: 'PenLine', color: '#b45309', description: 'Copywriting and content creation', sortOrder: 12 },
  { name: 'Blog Content Team', code: 'CRE-WRT-BLG', level: 3, parentId: 'CRE-WRT', icon: 'FileText', color: '#92400e', description: 'Blog articles and long-form content', sortOrder: 1 },
  { name: 'Social Media Copy Team', code: 'CRE-WRT-SOC', level: 3, parentId: 'CRE-WRT', icon: 'MessageCircle', color: '#78350f', description: 'Social media captions and posts', sortOrder: 2 },
  { name: 'Email Copy Team', code: 'CRE-WRT-EML', level: 3, parentId: 'CRE-WRT', icon: 'Mail', color: '#451a03', description: 'Email sequences and newsletters', sortOrder: 3 },
  { name: 'React Team', code: 'ENG-FE-RCT', level: 3, parentId: 'ENG-FE', icon: 'Atom', color: '#0891b2', description: 'React development', sortOrder: 1 },
  { name: 'Next.js Team', code: 'ENG-FE-NXT', level: 3, parentId: 'ENG-FE', icon: 'Triangle', color: '#0e7490', description: 'Next.js development', sortOrder: 2 },
  { name: 'Node.js API Team', code: 'ENG-BE-NDE', level: 3, parentId: 'ENG-BE', icon: 'Hexagon', color: '#155e75', description: 'Node.js API development', sortOrder: 1 },
  { name: 'Database Team', code: 'ENG-BE-DB', level: 3, parentId: 'ENG-BE', icon: 'Database', color: '#164e63', description: 'Database design and optimization', sortOrder: 2 },
  { name: 'Kubernetes Team', code: 'ENG-DEV-K8S', level: 3, parentId: 'ENG-DEV', icon: 'Ship', color: '#083344', description: 'Kubernetes cluster management', sortOrder: 1 },
  { name: 'CI/CD Team', code: 'ENG-DEV-CIC', level: 3, parentId: 'ENG-DEV', icon: 'GitBranch', color: '#0c4a6e', description: 'CI/CD pipeline management', sortOrder: 2 },
  { name: 'iOS Team', code: 'ENG-MOB-IOS', level: 3, parentId: 'ENG-MOB', icon: 'Apple', color: '#0c4a6e', description: 'iOS app development', sortOrder: 1 },
  { name: 'Android Team', code: 'ENG-MOB-AND', level: 3, parentId: 'ENG-MOB', icon: 'Smartphone', color: '#075985', description: 'Android app development', sortOrder: 2 },
  // ── 15 additional departments to reach 100 total ─────────────────────────
  // Finance sub-departments (FIN currently has only 3 level-2: ACC, TRS, PLN)
  { name: 'Tax & Compliance', code: 'FIN-TAX', level: 2, parentId: 'FIN', icon: 'ReceiptText', color: '#5b21b6', description: 'Tax filings and tax compliance', sortOrder: 13 },
  { name: 'Internal Audit', code: 'FIN-AUD', level: 2, parentId: 'FIN', icon: 'SearchCheck', color: '#4c1d95', description: 'Internal controls and audit', sortOrder: 14 },
  { name: 'Accounts Payable', code: 'FIN-AP', level: 2, parentId: 'FIN', icon: 'CreditCard', color: '#6d28d9', description: 'Vendor payments and AP ledger', sortOrder: 15 },
  { name: 'Accounts Receivable', code: 'FIN-AR', level: 2, parentId: 'FIN', icon: 'Banknote', color: '#7c3aed', description: 'Invoicing and AR collection', sortOrder: 16 },
  { name: 'Payroll', code: 'FIN-PRL', level: 2, parentId: 'FIN', icon: 'Wallet', color: '#8b5cf6', description: 'Payroll processing and benefits', sortOrder: 17 },
  // Executive Office sub-departments (EXE currently has 0 sub-departments)
  { name: 'CEO Office', code: 'EXE-CEO', level: 2, parentId: 'EXE', icon: 'Crown', color: '#d97706', description: 'Office of the Chief Executive Officer', sortOrder: 1 },
  { name: 'Chief of Staff', code: 'EXE-COS', level: 2, parentId: 'EXE', icon: 'Compass', color: '#b45309', description: 'Chief of Staff and executive coordination', sortOrder: 2 },
  { name: 'Board Relations', code: 'EXE-BOD', level: 2, parentId: 'EXE', icon: 'Users2', color: '#92400e', description: 'Board governance and investor relations', sortOrder: 3 },
  // HR additional sub-departments
  { name: 'Compensation & Benefits', code: 'HR-COM', level: 2, parentId: 'HR', icon: 'Gift', color: '#db2777', description: 'Compensation, benefits, and total rewards', sortOrder: 13 },
  { name: 'People Analytics', code: 'HR-PA', level: 2, parentId: 'HR', icon: 'BarChart3', color: '#be185d', description: 'HR analytics and workforce planning', sortOrder: 14 },
  // Legal additional sub-departments
  { name: 'Litigation', code: 'LEG-LIT', level: 2, parentId: 'LEG', icon: 'Gavel', color: '#475569', description: 'Litigation and dispute resolution', sortOrder: 12 },
  { name: 'Intellectual Property', code: 'LEG-IP', level: 2, parentId: 'LEG', icon: 'Lightbulb', color: '#334155', description: 'Patents, trademarks, and IP portfolio', sortOrder: 13 },
  // Operations additional sub-departments
  { name: 'Facilities & Admin', code: 'OPS-FAC', level: 2, parentId: 'OPS', icon: 'Building2', color: '#a78bfa', description: 'Facilities, office, and admin services', sortOrder: 12 },
  // CX additional sub-departments
  { name: 'Customer Onboarding', code: 'CX-ONT', level: 2, parentId: 'CX', icon: 'UserPlus', color: '#fb923c', description: 'New customer onboarding and activation', sortOrder: 12 },
  { name: 'Customer Retention', code: 'CX-RET', level: 2, parentId: 'CX', icon: 'Heart', color: '#f97316', description: 'Churn prevention and win-back', sortOrder: 13 },
];

const PROMPT_TEMPLATES = [
  { cat: 'system', name: 'Specialist System Prompt', content: 'You are a {{role}} in the {{department}} department. Your mission is to {{mission}}. Apply your skills in {{skills}}. Follow SOPs: {{sops}}. Use knowledge: {{knowledge}}. Remember: {{memory}}.' },
  { cat: 'task', name: 'Content Creation', content: 'Create a {{contentType}} about {{topic}} for {{targetAudience}}. Tone: {{tone}}. Length: {{length}}. Key points: {{keyPoints}}. CTA: {{cta}}.' },
  { cat: 'task', name: 'SEO Analysis', content: 'Analyze SEO of {{url}} for keywords: {{keywords}}. Provide ranking, issues, backlinks, and 5 recommendations.' },
  { cat: 'task', name: 'Lead Qualification', content: 'Qualify lead: {{name}}, {{company}}, {{source}}, {{budget}}, {{timeline}}. Score 0-100 and recommend next action.' },
  { cat: 'task', name: 'Campaign Planning', content: 'Plan {{campaignType}} for {{product}} targeting {{audience}}. Budget: {{budget}}. Duration: {{duration}}.' },
  { cat: 'role', name: 'Director Role', content: 'As Director, oversee operations. Set strategy, allocate budget, manage team. KPIs: {{kpis}}.' },
  { cat: 'role', name: 'Specialist Role', content: 'As Specialist, execute tasks with expertise. KPIs: task completion, quality, speed.' },
  { cat: 'role', name: 'Manager Role', content: 'As Manager, lead team to meet targets. Coach, review, report. KPIs: team performance.' },
  { cat: 'instruction', name: 'Professional Tone', content: 'Always be professional. Use proper grammar. Address user by name. Be concise but thorough.' },
  { cat: 'instruction', name: 'Data Privacy', content: 'Never share PII. Anonymize personal data. Follow GDPR and local laws.' },
  { cat: 'instruction', name: 'Escalate When Unsure', content: 'If not confident, escalate to senior. Better to ask than give wrong info.' },
  { cat: 'template', name: 'Blog Post', content: '# {{title}}\n\n## Introduction\n{{intro}}\n\n## {{section1Title}}\n{{section1Content}}\n\n## Conclusion\n{{conclusion}}\n\n## CTA\n{{cta}}' },
  { cat: 'template', name: 'Email Campaign', content: 'Subject: {{subjectLine}}\n\nHi {{firstName}},\n\n{{opening}}\n\n{{body}}\n\n{{closing}}' },
  { cat: 'template', name: 'Social Post', content: '{{hook}}\n\n{{body}}\n\n{{hashtags}}\n\n{{cta}}' },
];

const SOP_TEMPLATES = [
  { name: 'Content Publishing', category: 'content_creation', steps: 8 },
  { name: 'Lead Qualification', category: 'lead_management', steps: 6 },
  { name: 'Campaign Launch', category: 'campaign_management', steps: 10 },
  { name: 'Customer Onboarding', category: 'customer_success', steps: 7 },
  { name: 'Bug Triage', category: 'engineering', steps: 5 },
  { name: 'Social Media Posting', category: 'social_media', steps: 6 },
  { name: 'Email Campaign', category: 'email_marketing', steps: 8 },
  { name: 'SEO Audit', category: 'seo', steps: 12 },
  { name: 'Competitor Analysis', category: 'market_research', steps: 7 },
  { name: 'Monthly Reporting', category: 'reporting', steps: 5 },
  { name: 'Crisis Communication', category: 'communications', steps: 6 },
  { name: 'Data Backup', category: 'operations', steps: 4 },
  { name: 'Security Incident Response', category: 'security', steps: 9 },
  { name: 'Employee Onboarding', category: 'hr', steps: 8 },
  { name: 'Performance Review', category: 'hr', steps: 6 },
  { name: 'Vendor Selection', category: 'procurement', steps: 7 },
  { name: 'Product Launch', category: 'product', steps: 10 },
  { name: 'Quality Assurance', category: 'qa', steps: 6 },
  { name: 'API Integration', category: 'engineering', steps: 8 },
  { name: 'A/B Testing', category: 'optimization', steps: 7 },
];

async function main() {
  console.log('🚀 Comprehensive AI Workforce Seed (idempotent, SQLite-safe)...');
  // Resolve canonical company (slug='demo-agency'). Fail loudly if missing.
  const company = await prisma.company.findUnique({ where: { slug: 'demo-agency' } });
  if (!company) {
    throw new Error(
      "Canonical company with slug='demo-agency' not found. " +
      "Run `npx tsx prisma/seed.ts` first to create the demo company."
    );
  }
  const companyId = company.id;
  console.log(`✅ Canonical company resolved: ${company.slug} (${company.id})`);

  // 1. DEPARTMENTS → 100 (idempotent via findUnique on globally-unique `code`).
  console.log('\n🏢 Departments → 100...');
  for (const def of ADDITIONAL_DEPARTMENTS) {
    const existing = await prisma.department.findUnique({ where: { code: def.code } }).catch(() => null);
    if (existing) { counters.departmentsSkipped++; continue; }
    let parentId: string | null = null;
    if (def.parentId) {
      const parent = await prisma.department.findUnique({ where: { code: def.parentId } }).catch(() => null);
      if (parent) parentId = parent.id;
    }
    try {
      await prisma.department.create({ data: { name: def.name, code: def.code, description: def.description, level: def.level, sortOrder: def.sortOrder, icon: def.icon, color: def.color, parentId, companyId } });
      counters.departmentsInserted++;
    } catch (e: any) {
      throw new Error(`Failed to create Department code='${def.code}' name='${def.name}': ${e?.message ?? e}`);
    }
  }
  console.log(`  Inserted: ${counters.departmentsInserted}  |  Skipped: ${counters.departmentsSkipped}  |  Total: ${await prisma.department.count({ where: { companyId } })}`);

  // 2. SKILLS → 10,000+ (idempotent via query existing Skill.name, filter missing).
  //    Skill.name is GLOBALLY @unique, so we query all existing names once,
  //    build a Set, and only insert skills whose name is not already present.
  console.log('\n🎯 Skills → 10,000+ (idempotent)...');
  const PROFICIENCY = ['Beginner','Intermediate','Advanced','Expert','Master'];
  const CONTEXT = ['B2B','B2C','E-commerce','SaaS','Enterprise','Startup','Agency','Freelance','Remote','Hybrid'];

  // Build the full intended skill list (deterministic).
  const intendedSkills: any[] = [];
  for (const cat of SKILL_CATEGORIES) {
    for (const s of cat.skills) {
      intendedSkills.push({ name: s.toLowerCase().replace(/\s+/g,'_'), displayName: s, category: cat.cat, description: `Expertise in ${s}`, isActive: true, companyId });
      for (const prof of PROFICIENCY) {
        for (const ctx of CONTEXT) {
          intendedSkills.push({ name: `${s.toLowerCase().replace(/\s+/g,'_')}_${prof.toLowerCase()}_${ctx.toLowerCase()}`, displayName: `${s} (${prof} - ${ctx})`, category: cat.cat, description: `${prof} level ${s} in ${ctx} context`, isActive: true, companyId });
          if (intendedSkills.length >= 10000) break;
        }
        if (intendedSkills.length >= 10000) break;
      }
      if (intendedSkills.length >= 10000) break;
    }
    if (intendedSkills.length >= 10000) break;
  }
  // Query existing skill names in chunks (avoid SQLite parameter limit of 999).
  const existingSkillNames = new Set<string>();
  for (let i = 0; i < intendedSkills.length; i += 900) {
    const chunk = intendedSkills.slice(i, i + 900).map(s => s.name);
    const found = await prisma.skill.findMany({ where: { name: { in: chunk } }, select: { name: true } });
    for (const f of found) existingSkillNames.add(f.name);
  }
  counters.skillsSkipped = existingSkillNames.size;
  const missingSkills = intendedSkills.filter(s => !existingSkillNames.has(s.name));
  console.log(`  Existing skills (skipped): ${existingSkillNames.size}  |  To insert: ${missingSkills.length}`);

  // Insert missing skills in batches of 500, wrapped in $transaction.
  for (let i = 0; i < missingSkills.length; i += 500) {
    const batch = missingSkills.slice(i, i + 500);
    try {
      await prisma.$transaction(async (tx) => { await tx.skill.createMany({ data: batch }); });
    } catch (e: any) {
      throw new Error(`Failed to insert skill batch starting at idx=${i} (size=${batch.length}, first='${batch[0]?.name}'): ${e?.message ?? e}`);
    }
    counters.skillsInserted += batch.length;
    if (i % 5000 === 0) console.log(`  Inserted skills so far: ${counters.skillsInserted}`);
  }
  console.log(`  Inserted: ${counters.skillsInserted}  |  Skipped: ${counters.skillsSkipped}  |  Total: ${await prisma.skill.count()}`);

  // 3. PROMPTS → 50,000+ (idempotent via natural key: name + companyId).
  //    Prompt has no @unique constraint, so we use the (name, companyId)
  //    natural key to detect existing records.
  console.log('\n📝 Prompts → 50,000+ (idempotent)...');
  const allDepts = await prisma.department.findMany({ where: { companyId }, select: { id: true, name: true, code: true } });
  const ROLES = ['executive','director','manager','supervisor','specialist','worker'];
  const TONES = ['professional','friendly','formal','casual','persuasive','informative','inspirational','urgent'];

  // Build the full intended prompt list (deterministic).
  const intendedPrompts: any[] = [];
  for (const tpl of PROMPT_TEMPLATES) {
    for (const dept of allDepts) {
      for (const role of ROLES) {
        for (const tone of TONES) {
          const vars = tpl.content.match(/\{\{(\w+)\}\}/g)?.map(v => v.replace(/[{}]/g,'')) || [];
          intendedPrompts.push({
            name: `${tpl.name} — ${dept.name} — ${role} — ${tone}`,
            category: tpl.cat, subcategory: tone, content: tpl.content,
            variables: JSON.stringify(vars), language: 'en',
            tags: JSON.stringify([tpl.cat, dept.code, role, tone]),
            companyId, departmentId: dept.id, applicableRoles: JSON.stringify([role]), isActive: true,
          });
          if (intendedPrompts.length >= 50000) break;
        }
        if (intendedPrompts.length >= 50000) break;
      }
      if (intendedPrompts.length >= 50000) break;
    }
    if (intendedPrompts.length >= 50000) break;
  }
  // Query existing prompt names for this company in chunks.
  const existingPromptNames = new Set<string>();
  for (let i = 0; i < intendedPrompts.length; i += 900) {
    const chunk = intendedPrompts.slice(i, i + 900).map(p => p.name);
    const found = await prisma.prompt.findMany({ where: { name: { in: chunk }, companyId }, select: { name: true } });
    for (const f of found) existingPromptNames.add(f.name);
  }
  counters.promptsSkipped = existingPromptNames.size;
  const missingPrompts = intendedPrompts.filter(p => !existingPromptNames.has(p.name));
  console.log(`  Existing prompts (skipped): ${existingPromptNames.size}  |  To insert: ${missingPrompts.length}`);

  for (let i = 0; i < missingPrompts.length; i += 1000) {
    const batch = missingPrompts.slice(i, i + 1000);
    try {
      await prisma.$transaction(async (tx) => { await tx.prompt.createMany({ data: batch }); });
    } catch (e: any) {
      throw new Error(`Failed to insert prompt batch starting at idx=${i} (size=${batch.length}, first='${batch[0]?.name}'): ${e?.message ?? e}`);
    }
    counters.promptsInserted += batch.length;
    if (i % 10000 === 0) console.log(`  Inserted prompts so far: ${counters.promptsInserted}`);
  }
  console.log(`  Inserted: ${counters.promptsInserted}  |  Skipped: ${counters.promptsSkipped}  |  Total: ${await prisma.prompt.count()}`);

  // 4. SOPs → 500+ (idempotent via natural key: name + companyId).
  //    Sop has no @unique constraint, so we use (name, companyId) to detect existing.
  console.log('\n📋 SOPs → 500+ (idempotent)...');
  const level2Depts = allDepts.filter(d => d.code.includes('-'));
  const SOP_ROLES = ['specialist','worker','supervisor','manager'];

  // Build the full intended SOP list (deterministic).
  const intendedSops: any[] = [];
  for (const tpl of SOP_TEMPLATES) {
    for (const dept of level2Depts) {
      for (const role of SOP_ROLES) {
        const steps = Array.from({ length: tpl.steps }, (_, i) => ({ order: i+1, title: `Step ${i+1}: ${tpl.name}`, description: `Execute step ${i+1} of ${tpl.name}.`, decisionPoints: i === tpl.steps-1 ? ['Proceed','Escalate'] : ['Proceed'], validations: [`Step ${i+1} done`] }));
        const sopName = `${tpl.name} — ${dept.name} — ${role}`;
        intendedSops.push({
          name: sopName, description: `${tpl.name} for ${dept.name}`, version: 1,
          category: tpl.category, triggerConditions: JSON.stringify([{ type: 'task_type', value: tpl.category }]),
          steps: JSON.stringify(steps), preconditions: JSON.stringify(['Authenticated']),
          departmentId: dept.id, applicableRoles: JSON.stringify([role]),
          applicableTasks: JSON.stringify([tpl.category]), companyId, isActive: true,
        });
        if (intendedSops.length >= 500) break;
      }
      if (intendedSops.length >= 500) break;
    }
    if (intendedSops.length >= 500) break;
  }
  // Query existing SOP names for this company in chunks.
  const existingSopNames = new Set<string>();
  for (let i = 0; i < intendedSops.length; i += 900) {
    const chunk = intendedSops.slice(i, i + 900).map(s => s.name);
    const found = await prisma.sop.findMany({ where: { name: { in: chunk }, companyId }, select: { name: true } });
    for (const f of found) existingSopNames.add(f.name);
  }
  counters.sopsSkipped = existingSopNames.size;
  const missingSops = intendedSops.filter(s => !existingSopNames.has(s.name));
  console.log(`  Existing SOPs (skipped): ${existingSopNames.size}  |  To insert: ${missingSops.length}`);

  for (let i = 0; i < missingSops.length; i += 100) {
    const batch = missingSops.slice(i, i + 100);
    try {
      await prisma.$transaction(async (tx) => { await tx.sop.createMany({ data: batch }); });
    } catch (e: any) {
      throw new Error(`Failed to insert SOP batch starting at idx=${i} (size=${batch.length}, first='${batch[0]?.name}'): ${e?.message ?? e}`);
    }
    counters.sopsInserted += batch.length;
  }
  console.log(`  Inserted: ${counters.sopsInserted}  |  Skipped: ${counters.sopsSkipped}  |  Total: ${await prisma.sop.count({ where: { companyId } })}`);

  // 5. AGENT PROFILES → 2,000 (idempotent via query existing AgentProfile.agentId).
  //    AgentProfile.agentId is GLOBALLY @unique (links to Employee.employeeId).
  console.log('\n🤖 Agent Profiles → 2,000 (idempotent)...');
  const employees = await prisma.employee.findMany({
    where: { companyId },
    select: { id: true, employeeId: true, name: true, title: true, level: true, skills: true, tools: true, preferredModel: true, modelTier: true, departmentId: true, companyId: true },
  });
  // Query existing agentIds.
  const existingAgentIds = new Set<string>(
    (await prisma.agentProfile.findMany({
      where: { agentId: { in: employees.map(e => e.employeeId) } },
      select: { agentId: true },
    })).map(p => p.agentId)
  );
  counters.profilesSkipped = existingAgentIds.size;
  console.log(`  Existing profiles (skipped): ${existingAgentIds.size}  |  To insert: ${employees.length - existingAgentIds.size}`);

  // Build the missing profiles.
  const missingProfiles: any[] = [];
  for (const emp of employees) {
    if (existingAgentIds.has(emp.employeeId)) continue;
    const skills = JSON.parse(emp.skills || '[]');
    const tools = JSON.parse(emp.tools || '[]');
    const dept = await prisma.department.findUnique({ where: { id: emp.departmentId }, select: { name: true } });
    missingProfiles.push({
      agentId: emp.employeeId, name: emp.name, role: emp.title, department: dept?.name || 'General', level: emp.level,
      skillsJson: JSON.stringify(skills), toolsJson: JSON.stringify(tools), promptsJson: '[]', sopsJson: '[]',
      modelTier: emp.modelTier || 'balanced', preferredModel: emp.preferredModel, knowledgeBaseIds: '[]', memoryType: 'episodic',
      constitution: 'Be professional. Protect data. Escalate when unsure.', authority: JSON.stringify({ canApprove: emp.level === 'executive' || emp.level === 'director', canDelegate: emp.level !== 'worker' }),
      kpisJson: JSON.stringify([{ name: 'Task Completion', target: 95, current: 100 }, { name: 'Response Time', target: 5000, current: 0 }, { name: 'Quality', target: 4.5, current: 5.0 }]),
      collaborationRules: JSON.stringify([{ canCollaborateWith: 'same_department' }]), escalationRules: JSON.stringify([{ trigger: 'low_confidence', escalateTo: 'supervisor' }]),
      isActive: true, companyId: emp.companyId,
    });
  }
  // Insert in batches of 200, wrapped in $transaction.
  for (let i = 0; i < missingProfiles.length; i += 200) {
    const batch = missingProfiles.slice(i, i + 200);
    try {
      await prisma.$transaction(async (tx) => { await tx.agentProfile.createMany({ data: batch }); });
    } catch (e: any) {
      throw new Error(`Failed to insert AgentProfile batch starting at idx=${i} (size=${batch.length}, first agentId='${batch[0]?.agentId}'): ${e?.message ?? e}`);
    }
    counters.profilesInserted += batch.length;
    console.log(`  Inserted profiles so far: ${counters.profilesInserted}`);
  }
  console.log(`  Inserted: ${counters.profilesInserted}  |  Skipped: ${counters.profilesSkipped}  |  Total: ${await prisma.agentProfile.count({ where: { companyId } })}`);

  // ── Verified final summary ──────────────────────────────────────────────
  const [d,e,a,s,pr,sop,k,m,ap] = await Promise.all([
    prisma.department.count({ where: { companyId } }), prisma.employee.count({ where: { companyId } }), prisma.aiAgent.count({ where: { companyId } }),
    prisma.skill.count(), prisma.prompt.count(), prisma.sop.count({ where: { companyId } }), prisma.knowledgeNode.count({ where: { companyId } }),
    prisma.modelConfig.count(), prisma.agentProfile.count({ where: { companyId } }),
  ]);
  console.log('\n' + '='.repeat(60));
  console.log('✅ Comprehensive AI Workforce seed complete (idempotent, verified).');
  console.log('='.repeat(60));
  console.log('  Inserted / Skipped');
  console.log(`  🏢 Departments:   inserted=${counters.departmentsInserted}  skipped=${counters.departmentsSkipped}  | total=${d} (target: 100)`);
  console.log(`  👥 Employees:       ${e} (target: 2000)`);
  console.log(`  🤖 Agent Profiles: inserted=${counters.profilesInserted}  skipped=${counters.profilesSkipped}  | total=${ap} (target: 2000)`);
  console.log(`  🎯 Skills:         inserted=${counters.skillsInserted}  skipped=${counters.skillsSkipped}  | total=${s} (target: 10000+)`);
  console.log(`  📝 Prompts:        inserted=${counters.promptsInserted}  skipped=${counters.promptsSkipped}  | total=${pr} (target: 50000+)`);
  console.log(`  📋 SOPs:           inserted=${counters.sopsInserted}  skipped=${counters.sopsSkipped}  | total=${sop} (target: 500+)`);
  console.log(`  📚 Knowledge:       ${k}`);
  console.log(`  🧠 Models:          ${m}`);
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('\n❌ Comprehensive Workforce seed FAILED.');
    console.error('  Error:', e?.message ?? e);
    if (e?.code) console.error('  Prisma error code:', e.code);
    if (e?.meta) console.error('  Meta:', JSON.stringify(e.meta));
    prisma.$disconnect().finally(() => process.exit(1));
  })
  .finally(() => prisma.$disconnect());
