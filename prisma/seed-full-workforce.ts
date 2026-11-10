// @ts-nocheck
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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
  console.log('🚀 Comprehensive AI Workforce Seed...');
  const company = await prisma.company.findFirst();
  if (!company) { console.error('No company found'); return; }
  const companyId = company.id;

  // 1. DEPARTMENTS → 100
  console.log('\n🏢 Departments → 100...');
  for (const def of ADDITIONAL_DEPARTMENTS) {
    const existing = await prisma.department.findUnique({ where: { code: def.code } }).catch(() => null);
    if (existing) continue;
    let parentId = null;
    if (def.parentId) {
      const parent = await prisma.department.findUnique({ where: { code: def.parentId } }).catch(() => null);
      if (parent) parentId = parent.id;
    }
    await prisma.department.create({ data: { name: def.name, code: def.code, description: def.description, level: def.level, sortOrder: def.sortOrder, icon: def.icon, color: def.color, parentId, companyId } });
  }
  console.log(`  ✅ Departments: ${await prisma.department.count({ where: { companyId } })}`);

  // 2. SKILLS → 10,000+
  console.log('\n🎯 Skills → 10,000+...');
  const PROFICIENCY = ['Beginner','Intermediate','Advanced','Expert','Master'];
  const CONTEXT = ['B2B','B2C','E-commerce','SaaS','Enterprise','Startup','Agency','Freelance','Remote','Hybrid'];
  let skillBatch: any[] = [];
  let skillIdx = 0;
  for (const cat of SKILL_CATEGORIES) {
    for (const s of cat.skills) {
      skillIdx++;
      skillBatch.push({ name: s.toLowerCase().replace(/\s+/g,'_'), displayName: s, category: cat.cat, description: `Expertise in ${s}`, isActive: true, companyId });
      for (const prof of PROFICIENCY) {
        for (const ctx of CONTEXT) {
          skillIdx++;
          skillBatch.push({ name: `${s.toLowerCase().replace(/\s+/g,'_')}_${prof.toLowerCase()}_${ctx.toLowerCase()}`, displayName: `${s} (${prof} - ${ctx})`, category: cat.cat, description: `${prof} level ${s} in ${ctx} context`, isActive: true, companyId });
          if (skillBatch.length >= 500) { await prisma.skill.createMany({ data: skillBatch }); skillBatch = []; console.log(`  ✅ Skills: ${skillIdx}`); }
          if (skillIdx >= 10000) break;
        }
        if (skillIdx >= 10000) break;
      }
      if (skillBatch.length >= 500) { await prisma.skill.createMany({ data: skillBatch }); skillBatch = []; console.log(`  ✅ Skills: ${skillIdx}`); }
      if (skillIdx >= 10000) break;
    }
    if (skillIdx >= 10000) break;
  }
  if (skillBatch.length > 0) { await prisma.skill.createMany({ data: skillBatch }); console.log(`  ✅ Skills: ${skillIdx}`); }
  console.log(`  Total skills: ${await prisma.skill.count()}`);

  // 3. PROMPTS → 50,000+
  console.log('\n📝 Prompts → 50,000+...');
  const allDepts = await prisma.department.findMany({ where: { companyId }, select: { id: true, name: true, code: true } });
  const ROLES = ['executive','director','manager','supervisor','specialist','worker'];
  const TONES = ['professional','friendly','formal','casual','persuasive','informative','inspirational','urgent'];
  let promptBatch: any[] = [];
  let promptIdx = 0;
  for (const tpl of PROMPT_TEMPLATES) {
    for (const dept of allDepts) {
      for (const role of ROLES) {
        for (const tone of TONES) {
          promptIdx++;
          const vars = tpl.content.match(/\{\{(\w+)\}\}/g)?.map(v => v.replace(/[{}]/g,'')) || [];
          promptBatch.push({ name: `${tpl.name} — ${dept.name} — ${role} — ${tone}`, category: tpl.cat, subcategory: tone, content: tpl.content, variables: JSON.stringify(vars), language: 'en', tags: JSON.stringify([tpl.cat, dept.code, role, tone]), companyId, departmentId: dept.id, applicableRoles: JSON.stringify([role]), isActive: true });
          if (promptBatch.length >= 1000) { await prisma.prompt.createMany({ data: promptBatch }); promptBatch = []; console.log(`  ✅ Prompts: ${promptIdx}`); }
          if (promptIdx >= 50000) break;
        }
        if (promptIdx >= 50000) break;
      }
      if (promptIdx >= 50000) break;
    }
    if (promptIdx >= 50000) break;
  }
  if (promptBatch.length > 0) { await prisma.prompt.createMany({ data: promptBatch }); console.log(`  ✅ Prompts: ${promptIdx}`); }
  console.log(`  Total prompts: ${await prisma.prompt.count()}`);

  // 4. SOPs → 500+
  console.log('\n📋 SOPs → 500+...');
  const level2Depts = allDepts.filter(d => d.code.includes('-'));
  const SOP_ROLES = ['specialist','worker','supervisor','manager'];
  let sopBatch: any[] = [];
  let sopIdx = 0;
  for (const tpl of SOP_TEMPLATES) {
    for (const dept of level2Depts) {
      for (const role of SOP_ROLES) {
        sopIdx++;
        const steps = Array.from({ length: tpl.steps }, (_, i) => ({ order: i+1, title: `Step ${i+1}: ${tpl.name}`, description: `Execute step ${i+1} of ${tpl.name}.`, decisionPoints: i === tpl.steps-1 ? ['Proceed','Escalate'] : ['Proceed'], validations: [`Step ${i+1} done`] }));
        sopBatch.push({ name: `${tpl.name} — ${dept.name} — ${role}`, description: `${tpl.name} for ${dept.name}`, version: 1, category: tpl.category, triggerConditions: JSON.stringify([{ type: 'task_type', value: tpl.category }]), steps: JSON.stringify(steps), preconditions: JSON.stringify(['Authenticated']), departmentId: dept.id, applicableRoles: JSON.stringify([role]), applicableTasks: JSON.stringify([tpl.category]), companyId, isActive: true });
        if (sopBatch.length >= 100) { await prisma.sop.createMany({ data: sopBatch }); sopBatch = []; console.log(`  ✅ SOPs: ${sopIdx}`); }
        if (sopIdx >= 500) break;
      }
      if (sopIdx >= 500) break;
    }
    if (sopIdx >= 500) break;
  }
  if (sopBatch.length > 0) { await prisma.sop.createMany({ data: sopBatch }); console.log(`  ✅ SOPs: ${sopIdx}`); }
  console.log(`  Total SOPs: ${await prisma.sop.count({ where: { companyId } })}`);

  // 5. AGENT PROFILES → 2,000
  console.log('\n🤖 Agent Profiles → 2,000...');
  const employees = await prisma.employee.findMany({ where: { companyId }, select: { id: true, employeeId: true, name: true, title: true, level: true, skills: true, tools: true, preferredModel: true, modelTier: true, departmentId: true, companyId: true } });
  let profileBatch: any[] = [];
  for (const emp of employees) {
    const skills = JSON.parse(emp.skills || '[]');
    const tools = JSON.parse(emp.tools || '[]');
    const dept = await prisma.department.findUnique({ where: { id: emp.departmentId }, select: { name: true } });
    profileBatch.push({
      agentId: emp.employeeId, name: emp.name, role: emp.title, department: dept?.name || 'General', level: emp.level,
      skillsJson: JSON.stringify(skills), toolsJson: JSON.stringify(tools), promptsJson: '[]', sopsJson: '[]',
      modelTier: emp.modelTier || 'balanced', preferredModel: emp.preferredModel, knowledgeBaseIds: '[]', memoryType: 'episodic',
      constitution: 'Be professional. Protect data. Escalate when unsure.', authority: JSON.stringify({ canApprove: emp.level === 'executive' || emp.level === 'director', canDelegate: emp.level !== 'worker' }),
      kpisJson: JSON.stringify([{ name: 'Task Completion', target: 95, current: 100 }, { name: 'Response Time', target: 5000, current: 0 }, { name: 'Quality', target: 4.5, current: 5.0 }]),
      collaborationRules: JSON.stringify([{ canCollaborateWith: 'same_department' }]), escalationRules: JSON.stringify([{ trigger: 'low_confidence', escalateTo: 'supervisor' }]),
      isActive: true, companyId: emp.companyId,
    });
    if (profileBatch.length >= 200) { await prisma.agentProfile.createMany({ data: profileBatch }); profileBatch = []; console.log(`  ✅ Profiles: ${employees.indexOf(emp) + 1}/${employees.length}`); }
  }
  if (profileBatch.length > 0) { await prisma.agentProfile.createMany({ data: profileBatch }); }
  console.log(`  Total profiles: ${await prisma.agentProfile.count({ where: { companyId } })}`);

  // FINAL SUMMARY
  const [d,e,a,s,pr,sop,k,m,ap] = await Promise.all([
    prisma.department.count({ where: { companyId } }), prisma.employee.count({ where: { companyId } }), prisma.aiAgent.count({ where: { companyId } }),
    prisma.skill.count(), prisma.prompt.count(), prisma.sop.count({ where: { companyId } }), prisma.knowledgeNode.count({ where: { companyId } }),
    prisma.modelConfig.count(), prisma.agentProfile.count({ where: { companyId } }),
  ]);
  console.log('\n' + '='.repeat(60));
  console.log('🎉 COMPREHENSIVE AI WORKFORCE SEED COMPLETE');
  console.log('='.repeat(60));
  console.log(`  🏢 Departments:     ${d} (target: 100)`);
  console.log(`  👥 Employees:       ${e} (target: 2000)`);
  console.log(`  🤖 Agent Profiles:  ${ap} (target: 2000)`);
  console.log(`  🎯 Skills:          ${s} (target: 10000+)`);
  console.log(`  📝 Prompts:         ${pr} (target: 50000+)`);
  console.log(`  📋 SOPs:            ${sop} (target: 500+)`);
  console.log(`  📚 Knowledge:       ${k}`);
  console.log(`  🧠 Models:          ${m}`);
  console.log('='.repeat(60));
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
