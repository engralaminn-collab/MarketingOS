/**
 * Canonical department catalog — single source of truth.
 *
 * The agency operating model is exactly 100 departments:
 *   54 core departments (CORE_DEPARTMENTS) + 46 specialist departments
 *   (AGENCY_DEPARTMENTS).
 *
 * Both are exported here because two seeds used to own half of the catalog each
 * (prisma/seed-workforce.ts had the core 54, prisma/seed-agency.ts the other
 * 46). Running only one of them produced 46 or 54 departments, so the readiness
 * audit could never reach its 100-department / 2,000-agent target — and the
 * agent top-up crashed on the AgentSpec.code constraint because the code range
 * depended on how many departments happened to exist. One list, imported by
 * both seeds, removes that class of failure.
 */

/** A core department, seeded by prisma/seed-workforce.ts and seed-agency.ts. */
export interface CoreDepartment {
  name: string;
  code: string;
  level: number;
  parent: string | null;
  icon: string;
  color: string;
  description: string;
  sortOrder: number;
}

/** A specialist department owned by the agency operating model. */
export interface AgencyDepartment {
  code: string;
  name: string;
  parent: string | null;
  level: number;
  icon: string;
  color: string;
  description: string;
  deliverable: string;
  sortOrder?: number;
}

/** 54 core departments: executive, functional and marketing teams. */
export const CORE_DEPARTMENTS: CoreDepartment[] = [
// Level 0 - Executive
  { name:'Executive Office', code:'EXE', level:0, parent: null, icon:'Crown', color:'#f59e0b', description:'Strategic leadership and company-wide decision making', sortOrder:1 },
  { name:'Marketing', code:'MKT', level:0, parent: null, icon:'Megaphone', color:'#ef4444', description:'Brand awareness, lead generation, and customer acquisition', sortOrder:2 },
  { name:'Sales', code:'SAL', level:0, parent: null, icon:'DollarSign', color:'#22c55e', description:'Revenue generation and deal closing', sortOrder:3 },
  { name:'Finance', code:'FIN', level:0, parent: null, icon:'Calculator', color:'#6366f1', description:'Financial planning, accounting, and compliance', sortOrder:4 },
  { name:'Engineering', code:'ENG', level:0, parent: null, icon:'Code2', color:'#0ea5e9', description:'Software development and technical infrastructure', sortOrder:5 },
  { name:'Operations', code:'OPS', level:0, parent: null, icon:'Settings', color:'#8b5cf6', description:'Business operations and process optimization', sortOrder:6 },
  { name:'Human Resources', code:'HR', level:0, parent: null, icon:'Users', color:'#ec4899', description:'Talent acquisition, development, and employee relations', sortOrder:7 },
  { name:'Customer Experience', code:'CX', level:0, parent: null, icon:'Heart', color:'#f97316', description:'Customer satisfaction, support, and success', sortOrder:8 },
  { name:'Product', code:'PRD', level:0, parent: null, icon:'Package', color:'#14b8a6', description:'Product strategy, design, and lifecycle management', sortOrder:9 },
  { name:'Data & Analytics', code:'DAT', level:0, parent: null, icon:'BarChart3', color:'#06b6d4', description:'Data infrastructure, analytics, and business intelligence', sortOrder:10 },
  { name:'Creative', code:'CRE', level:0, parent: null, icon:'Palette', color:'#d946ef', description:'Visual design, video production, and creative assets', sortOrder:11 },
  { name:'Legal & Compliance', code:'LEG', level:0, parent: null, icon:'Shield', color:'#64748b', description:'Legal affairs, regulatory compliance, and risk management', sortOrder:12 },

  // Level 1-2 - Marketing sub-departments
  { name:'Content Marketing', code:'MKT-CNT', level:2, parent:'MKT', icon:'FileText', color:'#f87171', description:'Blog posts, articles, whitepapers, and long-form content', sortOrder:1 },
  { name:'Social Media Marketing', code:'MKT-SOC', level:2, parent:'MKT', icon:'Share2', color:'#fb923c', description:'Social media strategy, posting, and community management', sortOrder:2 },
  { name:'SEO & SEM', code:'MKT-SEO', level:2, parent:'MKT', icon:'Search', color:'#a3e635', description:'Search engine optimization and paid search', sortOrder:3 },
  { name:'Email Marketing', code:'MKT-EML', level:2, parent:'MKT', icon:'Mail', color:'#fbbf24', description:'Email campaigns, automation, and deliverability', sortOrder:4 },
  { name:'Performance Marketing', code:'MKT-PER', level:2, parent:'MKT', icon:'Target', color:'#34d399', description:'Paid advertising, ROAS optimization, and attribution', sortOrder:5 },
  { name:'Brand Strategy', code:'MKT-BRN', level:2, parent:'MKT', icon:'Sparkles', color:'#c084fc', description:'Brand positioning, guidelines, and identity', sortOrder:6 },
  { name:'Growth Marketing', code:'MKT-GRW', level:2, parent:'MKT', icon:'TrendingUp', color:'#2dd4bf', description:'Growth experiments, viral loops, and funnel optimization', sortOrder:7 },
  { name:'Partnership Marketing', code:'MKT-PAR', level:2, parent:'MKT', icon:'Handshake', color:'#818cf8', description:'Co-marketing, affiliate programs, and strategic partnerships', sortOrder:8 },

  // Level 3 - Marketing teams
  { name:'Blog Writing Team', code:'MKT-CNT-BLG', level:3, parent:'MKT-CNT', icon:'PenTool', color:'#fca5a5', description:'Blog content creation and editorial calendar', sortOrder:1 },
  { name:'Content SEO Team', code:'MKT-CNT-SEO', level:3, parent:'MKT-CNT', icon:'FileSearch', color:'#fdba74', description:'SEO-optimized content and keyword strategy', sortOrder:2 },
  { name:'Social Content Team', code:'MKT-SOC-CNT', level:3, parent:'MKT-SOC', icon:'ImagePlus', color:'#fde68a', description:'Social media content creation and curation', sortOrder:1 },
  { name:'Community Management', code:'MKT-SOC-COM', level:3, parent:'MKT-SOC', icon:'MessageCircle', color:'#d9f99d', description:'Community engagement and social listening', sortOrder:2 },
  { name:'Technical SEO Team', code:'MKT-SEO-TEC', level:3, parent:'MKT-SEO', icon:'Code', color:'#86efac', description:'Technical SEO audits and implementation', sortOrder:1 },
  { name:'Link Building Team', code:'MKT-SEO-LNK', level:3, parent:'MKT-SEO', icon:'Link', color:'#bbf7d0', description:'Backlink acquisition and link strategy', sortOrder:2 },
  { name:'Email Design Team', code:'MKT-EML-DSN', level:3, parent:'MKT-EML', icon:'LayoutTemplate', color:'#fcd34d', description:'Email template design and HTML production', sortOrder:1 },
  { name:'Email Automation Team', code:'MKT-EML-AUT', level:3, parent:'MKT-EML', icon:'Zap', color:'#fef08a', description:'Drip campaigns, triggers, and automation flows', sortOrder:2 },

  // Sales sub-departments
  { name:'Inside Sales', code:'SAL-INS', level:2, parent:'SAL', icon:'Phone', color:'#4ade80', description:'Inbound lead qualification and closing', sortOrder:1 },
  { name:'Enterprise Sales', code:'SAL-ENT', level:2, parent:'SAL', icon:'Building2', color:'#22c55e', description:'Enterprise deal management and strategic accounts', sortOrder:2 },
  { name:'Sales Development', code:'SAL-SDR', level:2, parent:'SAL', icon:'UserPlus', color:'#16a34a', description:'Outbound prospecting and initial outreach', sortOrder:3 },
  { name:'Sales Operations', code:'SAL-OPS', level:2, parent:'SAL', icon:'PieChart', color:'#15803d', description:'Sales processes, tools, and analytics', sortOrder:4 },

  // Finance sub-departments
  { name:'Accounting', code:'FIN-ACC', level:2, parent:'FIN', icon:'Receipt', color:'#818cf8', description:'Financial reporting, AP/AR, and reconciliation', sortOrder:1 },
  { name:'FP&A', code:'FIN-FPA', level:2, parent:'FIN', icon:'TrendingUp', color:'#6366f1', description:'Financial planning, budgeting, and forecasting', sortOrder:2 },
  { name:'Treasury', code:'FIN-TRS', level:2, parent:'FIN', icon:'Vault', color:'#4f46e5', description:'Cash management and treasury operations', sortOrder:3 },

  // Engineering sub-departments
  { name:'Frontend', code:'ENG-FE', level:2, parent:'ENG', icon:'Monitor', color:'#38bdf8', description:'UI/UX implementation and client-side applications', sortOrder:1 },
  { name:'Backend', code:'ENG-BE', level:2, parent:'ENG', icon:'Server', color:'#0ea5e9', description:'Server-side development and APIs', sortOrder:2 },
  { name:'DevOps', code:'ENG-OPS', level:2, parent:'ENG', icon:'Container', color:'#0284c7', description:'Infrastructure, CI/CD, and deployment', sortOrder:3 },
  { name:'AI/ML', code:'ENG-AI', level:2, parent:'ENG', icon:'Brain', color:'#0369a1', description:'Machine learning models and AI systems', sortOrder:4 },
  { name:'QA', code:'ENG-QA', level:2, parent:'ENG', icon:'CheckCircle', color:'#075985', description:'Quality assurance and testing', sortOrder:5 },

  // Operations sub-departments
  { name:'Project Management', code:'OPS-PM', level:2, parent:'OPS', icon:'Kanban', color:'#a78bfa', description:'Project planning, execution, and delivery', sortOrder:1 },
  { name:'Supply Chain', code:'OPS-SC', level:2, parent:'OPS', icon:'Truck', color:'#8b5cf6', description:'Supply chain management and logistics', sortOrder:2 },

  // CX sub-departments
  { name:'Customer Support', code:'CX-SUP', level:2, parent:'CX', icon:'Headphones', color:'#fb923c', description:'Customer issue resolution and support', sortOrder:1 },
  { name:'Customer Success', code:'CX-SUC', level:2, parent:'CX', icon:'Award', color:'#f97316', description:'Onboarding, adoption, and retention', sortOrder:2 },

  // Product sub-departments
  { name:'Product Design', code:'PRD-DES', level:2, parent:'PRD', icon:'Figma', color:'#2dd4bf', description:'UX research and product design', sortOrder:1 },
  { name:'Product Management', code:'PRD-PM', level:2, parent:'PRD', icon:'ClipboardList', color:'#14b8a6', description:'Product roadmap and feature prioritization', sortOrder:2 },

  // Data sub-departments
  { name:'Business Intelligence', code:'DAT-BI', level:2, parent:'DAT', icon:'LineChart', color:'#22d3ee', description:'Dashboards, reporting, and insights', sortOrder:1 },
  { name:'Data Engineering', code:'DAT-DE', level:2, parent:'DAT', icon:'Database', color:'#06b6d4', description:'Data pipelines, warehousing, and ETL', sortOrder:2 },

  // Creative sub-departments
  { name:'Graphic Design', code:'CRE-GFX', level:2, parent:'CRE', icon:'Paintbrush', color:'#e879f9', description:'Visual design, branding, and print assets', sortOrder:1 },
  { name:'Video Production', code:'CRE-VID', level:2, parent:'CRE', icon:'Video', color:'#d946ef', description:'Video creation, editing, and motion graphics', sortOrder:2 },

  // HR sub-departments
  { name:'Talent Acquisition', code:'HR-TAL', level:2, parent:'HR', icon:'UserCheck', color:'#f472b6', description:'Recruiting, interviewing, and hiring', sortOrder:1 },
  { name:'Learning & Development', code:'HR-LND', level:2, parent:'HR', icon:'GraduationCap', color:'#ec4899', description:'Training, upskilling, and career development', sortOrder:2 },

  // Legal sub-departments
  { name:'Corporate Legal', code:'LEG-COR', level:2, parent:'LEG', icon:'Scale', color:'#94a3b8', description:'Contracts, corporate governance, and IP', sortOrder:1 },
  { name:'Compliance', code:'LEG-CMP', level:2, parent:'LEG', icon:'ShieldCheck', color:'#64748b', description:'Regulatory compliance and audit', sortOrder:2 }
];

/** 46 specialist departments that complete the 100-department agency model. */
export const AGENCY_DEPARTMENTS: AgencyDepartment[] = [
{ code: 'AIZ', name: 'AI Operations', parent: null, level: 0, icon: 'Cpu', color: '#8b5cf6', description: 'Runs the agent fleet, model profiles, evaluation and continuity', deliverable: 'agent fleet health and model policy' },
  { code: 'CLS', name: 'Client Services', parent: null, level: 0, icon: 'Handshake', color: '#f59e0b', description: 'Owns client relationships, delivery and reporting', deliverable: 'client satisfaction and retention' },
  { code: 'RES', name: 'Research & Insights', parent: null, level: 0, icon: 'Telescope', color: '#0ea5e9', description: 'Market, audience and trend intelligence', deliverable: 'evidence-backed insights' },
  { code: 'LOC', name: 'Localisation & Accessibility', parent: null, level: 0, icon: 'Languages', color: '#14b8a6', description: 'Language, cultural and accessibility adaptation', deliverable: 'market-ready localised assets' },

  { code: 'MKT-CPY', name: 'Copywriting', parent: 'MKT', level: 2, icon: 'PenLine', color: '#ef4444', description: 'Owns written voice across every channel', deliverable: 'copy that matches the brand voice' },
  { code: 'MKT-SOC-FB', name: 'Facebook & Instagram', parent: 'MKT', level: 2, icon: 'Instagram', color: '#ec4899', description: 'Meta platform content, publishing and community', deliverable: 'published Meta content calendar' },
  { code: 'MKT-SOC-TIK', name: 'TikTok Marketing', parent: 'MKT', level: 2, icon: 'Music2', color: '#111827', description: 'Short-form vertical video strategy and publishing', deliverable: 'short-form video pipeline' },
  { code: 'MKT-SOC-LI', name: 'LinkedIn Marketing', parent: 'MKT', level: 2, icon: 'Linkedin', color: '#0284c7', description: 'B2B thought leadership and company page content', deliverable: 'B2B content programme' },
  { code: 'MKT-SOC-YT', name: 'YouTube Marketing', parent: 'MKT', level: 2, icon: 'Youtube', color: '#dc2626', description: 'Long-form video, thumbnails, titles and channel SEO', deliverable: 'channel growth plan' },
  { code: 'MKT-SEO-ONP', name: 'On-Page SEO', parent: 'MKT', level: 2, icon: 'FileSearch', color: '#84cc16', description: 'Titles, headings, internal links and schema markup', deliverable: 'optimised page briefs' },
  { code: 'MKT-SEO-LOC', name: 'Local SEO', parent: 'MKT', level: 2, icon: 'MapPin', color: '#22c55e', description: 'Google Business Profile, citations and local landing pages', deliverable: 'local visibility plan' },
  { code: 'MKT-PER-GAD', name: 'Google Ads', parent: 'MKT', level: 2, icon: 'MousePointerClick', color: '#f59e0b', description: 'Search, Performance Max and shopping campaigns', deliverable: 'paid search performance' },
  { code: 'MKT-PER-MAD', name: 'Meta Ads', parent: 'MKT', level: 2, icon: 'Megaphone', color: '#3b82f6', description: 'Facebook and Instagram acquisition campaigns', deliverable: 'paid social performance' },
  { code: 'MKT-INF', name: 'Influencer Marketing', parent: 'MKT', level: 2, icon: 'Users', color: '#a855f7', description: 'Creator sourcing, briefing and measurement', deliverable: 'creator campaign results' },
  { code: 'MKT-PR', name: 'Public Relations', parent: 'MKT', level: 2, icon: 'Newspaper', color: '#64748b', description: 'Press, media relations and reputation', deliverable: 'earned media coverage' },
  { code: 'MKT-AFF', name: 'Affiliate Marketing', parent: 'MKT', level: 2, icon: 'Network', color: '#06b6d4', description: 'Partner recruitment, tracking and payouts', deliverable: 'affiliate revenue' },
  { code: 'MKT-LIF', name: 'Lifecycle & Retention', parent: 'MKT', level: 2, icon: 'Repeat', color: '#8b5cf6', description: 'Onboarding, activation, retention and winback journeys', deliverable: 'retention lift' },
  { code: 'MKT-MOP', name: 'Marketing Operations', parent: 'MKT', level: 2, icon: 'Workflow', color: '#475569', description: 'Tooling, data hygiene, process and governance', deliverable: 'reliable marketing systems' },

  { code: 'CRE-MOT', name: 'Motion Graphics', parent: 'CRE', level: 2, icon: 'Clapperboard', color: '#d946ef', description: 'Animated explainers, lower thirds and stingers', deliverable: 'motion assets' },
  { code: 'CRE-VED', name: 'Video Editing', parent: 'CRE', level: 2, icon: 'Scissors', color: '#f97316', description: 'Cuts, captions, pacing and platform variants', deliverable: 'edited video deliverables' },
  { code: 'CRE-AUD', name: 'Audio & Voice Production', parent: 'CRE', level: 2, icon: 'Mic', color: '#0ea5e9', description: 'Voiceover, podcast and sound design', deliverable: 'audio deliverables' },
  { code: 'CRE-PER', name: 'Face & Persona Studio', parent: 'CRE', level: 2, icon: 'UserSquare', color: '#e879f9', description: 'Builds client-owned AI presenters from supplied photos with one consistent voice', deliverable: 'approved persona kit' },
  { code: 'CRE-PHO', name: 'Photography & Retouching', parent: 'CRE', level: 2, icon: 'Camera', color: '#78716c', description: 'Product and lifestyle imagery, cut-outs and colour', deliverable: 'final image sets' },
  { code: 'CRE-3D', name: '3D & AR Assets', parent: 'CRE', level: 2, icon: 'Box', color: '#7c3aed', description: '3D product views and AR-ready assets', deliverable: '3D/AR asset packs' },

  { code: 'DAT-ANL', name: 'Web & Product Analytics', parent: 'DAT', level: 2, icon: 'LineChart', color: '#06b6d4', description: 'Traffic, event and funnel measurement', deliverable: 'analytics instrumentation' },
  { code: 'DAT-ATR', name: 'Attribution & Measurement', parent: 'DAT', level: 2, icon: 'GitMerge', color: '#0891b2', description: 'UTM governance, channel attribution and incrementality', deliverable: 'trustworthy attribution' },
  { code: 'DAT-EXP', name: 'Experimentation & CRO', parent: 'DAT', level: 2, icon: 'FlaskConical', color: '#14b8a6', description: 'Test design, landing page optimisation and analysis', deliverable: 'validated experiments' },
  { code: 'DAT-RPT', name: 'Reporting & Dashboards', parent: 'DAT', level: 2, icon: 'LayoutDashboard', color: '#0e7490', description: 'Client dashboards, KPI definitions and commentary', deliverable: 'client reporting pack' },

  { code: 'OPS-AUT', name: 'Automation & Integrations', parent: 'OPS', level: 2, icon: 'Plug', color: '#8b5cf6', description: 'Workflows, webhooks and system-to-system data flow', deliverable: 'working automations' },
  { code: 'OPS-BIL', name: 'Billing & Invoicing', parent: 'OPS', level: 2, icon: 'Receipt', color: '#22c55e', description: 'Retainers, media spend reconciliation and final invoices', deliverable: 'accurate invoices' },
  { code: 'OPS-VEN', name: 'Vendor & Cost Control', parent: 'OPS', level: 2, icon: 'Wallet', color: '#a16207', description: 'Supplier contracts, tool spend and margin protection', deliverable: 'cost control register' },

  { code: 'CX-REP', name: 'Reputation & Reviews', parent: 'CX', level: 2, icon: 'Star', color: '#f59e0b', description: 'Review generation, response and sentiment recovery', deliverable: 'review programme' },
  { code: 'CX-ONB', name: 'Client Onboarding', parent: 'CX', level: 2, icon: 'Rocket', color: '#f97316', description: 'Kickoff, access, brand intake and first-90-day plan', deliverable: 'onboarded client workspace' },

  { code: 'LEG-PRV', name: 'Privacy & Data Protection', parent: 'LEG', level: 2, icon: 'Lock', color: '#475569', description: 'Consent, retention and data-processing records', deliverable: 'privacy compliance file' },
  { code: 'LEG-ADP', name: 'Advertising Policy & Brand Safety', parent: 'LEG', level: 2, icon: 'ShieldCheck', color: '#334155', description: 'Platform policy, claims substantiation and placement safety', deliverable: 'policy clearance' },

  { code: 'FIN-PRC', name: 'Procurement', parent: 'FIN', level: 2, icon: 'ShoppingCart', color: '#6366f1', description: 'Tool and supplier purchasing', deliverable: 'approved purchases' },
  { code: 'FIN-TAX', name: 'Tax & Statutory Reporting', parent: 'FIN', level: 2, icon: 'Landmark', color: '#4338ca', description: 'VAT/GST, withholding and statutory filings', deliverable: 'filed statutory returns' },

  { code: 'HR-OPS', name: 'HR Operations', parent: 'HR', level: 2, icon: 'ClipboardCheck', color: '#ec4899', description: 'Contracts, records and workforce policy', deliverable: 'current people records' },

  { code: 'ENG-WEB', name: 'Web Platform', parent: 'ENG', level: 2, icon: 'Globe', color: '#0ea5e9', description: 'Landing pages, CMS and storefront work', deliverable: 'shipped web changes' },
  { code: 'ENG-INT', name: 'Integrations & API', parent: 'ENG', level: 2, icon: 'Webhook', color: '#0284c7', description: 'Platform connectors and API reliability', deliverable: 'working integrations' },

  { code: 'AIZ-PRM', name: 'Prompt & Model Operations', parent: 'AIZ', level: 2, icon: 'SlidersHorizontal', color: '#7c3aed', description: 'Prompt versions, model profiles and routing policy', deliverable: 'model policy set' },
  { code: 'AIZ-EVL', name: 'Agent Evaluation & QA', parent: 'AIZ', level: 2, icon: 'BadgeCheck', color: '#6d28d9', description: 'Test sets, scoring and regression gates for agents', deliverable: 'agent quality report' },
  { code: 'AIZ-KNW', name: 'Knowledge & RAG Operations', parent: 'AIZ', level: 2, icon: 'BookOpen', color: '#5b21b6', description: 'Knowledge base, retrieval quality and citations', deliverable: 'retrieval quality report' },
  { code: 'AIZ-SAF', name: 'AI Safety & Guardrails', parent: 'AIZ', level: 2, icon: 'ShieldAlert', color: '#4c1d95', description: 'Prompt safety, refusal policy and human review gates', deliverable: 'guardrail register' },

  { code: 'CLS-ACC', name: 'Account Management', parent: 'CLS', level: 2, icon: 'UserCog', color: '#b45309', description: 'Day-to-day client ownership and planning', deliverable: 'account plan' },
  { code: 'CLS-REP', name: 'Client Reporting', parent: 'CLS', level: 2, icon: 'FileBarChart', color: '#d97706', description: 'Monthly performance narrative and QBRs', deliverable: 'monthly report' }
];

/** Total departments in the agency operating model. */
export const DEPARTMENT_TOTAL = CORE_DEPARTMENTS.length + AGENCY_DEPARTMENTS.length;
