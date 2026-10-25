export type MarketingAssetType = 'marketing_kit' | 'marketing_diagram' | 'cta_button' | 'reimagined_html';

export type MarketingKitType =
  // Original 9 IDs preserved for backward compatibility
  | 'product_launch'
  | 'lead_magnet'
  | 'webinar'
  | 'retention'
  | 'education_enrollment'
  | 'seo_content_brief'
  | 'cro_experiment'
  | 'case_study'
  | 'referral_campaign'
  // Complete 52 coreyhaines31/marketingskills catalog
  | 'product-marketing'
  | 'cro'
  | 'signup'
  | 'onboarding'
  | 'form-cro'
  | 'popups'
  | 'paywalls'
  | 'ab-testing'
  | 'copywriting'
  | 'copy-editing'
  | 'cold-email'
  | 'emails'
  | 'sms'
  | 'social'
  | 'content-strategy'
  | 'seo-audit'
  | 'ai-seo'
  | 'programmatic-seo'
  | 'site-architecture'
  | 'schema'
  | 'link-building'
  | 'aso'
  | 'ads'
  | 'ad-creative'
  | 'image'
  | 'video'
  | 'launch'
  | 'pricing'
  | 'offers'
  | 'free-tools'
  | 'referrals'
  | 'marketing-loops'
  | 'marketing-psychology'
  | 'marketing-ideas'
  | 'marketing-plan'
  | 'marketing-council'
  | 'competitors'
  | 'competitor-profiling'
  | 'customer-research'
  | 'churn-prevention'
  | 'analytics'
  | 'attribution'
  | 'conversion-tracking'
  | 'prospecting'
  | 'sales-enablement'
  | 'revops'
  | 'co-marketing'
  | 'community-marketing'
  | 'directory-submissions'
  | 'events'
  | 'influencer-marketing'
  | 'lead-magnets'
  | 'public-relations';

export type MarketingDiagramType =
  // First 7 IDs preserved verbatim
  | 'journey'
  | 'flow'
  | 'funnel'
  | 'timeline'
  | 'quadrant'
  | 'flywheel'
  | 'service_blueprint'
  // Complete cathrynlavery/diagram-design v2.6 41 additional grammars (48 total)
  | 'architecture'
  | 'architecture-delta'
  | 'axonometric-plan'
  | 'bar'
  | 'data-flow'
  | 'datalake'
  | 'db-schema'
  | 'dependency'
  | 'deployment'
  | 'dp-integration'
  | 'dp-security-matrix'
  | 'er'
  | 'exploded'
  | 'fishbone'
  | 'flowchart'
  | 'gantt'
  | 'heatmap'
  | 'high-level'
  | 'it-state'
  | 'kanban'
  | 'layers'
  | 'line'
  | 'medallion'
  | 'nested'
  | 'org-chart'
  | 'polar'
  | 'process'
  | 'pyramid'
  | 'radar'
  | 'sankey'
  | 'scatter'
  | 'sequence'
  | 'state'
  | 'story-map'
  | 'swimlane'
  | 'tree'
  | 'treemap'
  | 'uml-class'
  | 'venn'
  | 'wardley'
  | 'waterfall';

export type CtaButtonVariant =
  | 'solid'
  | 'outline'
  | 'soft'
  | 'ghost'
  | 'gradient'
  | 'pill-badge'
  | 'split-arrow'
  | 'subtext-stack'
  | 'glass-editorial'
  | 'brutalist-offset'
  | 'minimal-underline'
  | 'dual-pair';

export interface MarketingKitForm {
  type: MarketingKitType;
  brand: string;
  product: string;
  description: string;
  audience: string;
  goal: string;
  offer: string;
  proof: string;
  tone: string;
  channels: string;
}

export interface MarketingKitData {
  version: 1;
  form: MarketingKitForm;
  outputs: {
    positioning: string;
    heroHeadline: string;
    heroSubhead: string;
    benefitBullets: string[];
    emailSubject: string;
    emailPreheader: string;
    emailBody: string;
    linkedinPost: string;
    instagramPost: string;
    adHeadline: string;
    adDescription: string;
    channelPlan: string[];
    primaryKpi: string;
    guardrails: string[];
    primaryCta: string;
    reviewNote: string;
    skillPlaybook?: string[];
  };
}

export interface MarketingDiagramNode {
  title: string;
  detail: string;
  frontstage?: string;
  backstage?: string;
  metric?: string;
  group?: string;
}

export interface MarketingDiagramData {
  version: 1;
  type: MarketingDiagramType;
  title: string;
  accent: string;
  paper?: string;
  ink?: string;
  muted?: string;
  theme?: 'editorial-light' | 'monograph-dark';
  nodes: MarketingDiagramNode[];
}

export interface CtaButtonData {
  version: 1;
  label: string;
  href: string;
  accent: string;
  variant: CtaButtonVariant;
  size: 'compact' | 'standard' | 'large';
  corners: 'square' | 'rounded' | 'pill';
  badgeText?: string;
  subtext?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

export const KIT_TYPES: Array<{ value: MarketingKitType; label: string; pillar: string; description: string }> = [
  // Original 9 starter kits
  { value: 'product_launch', label: 'Product launch', pillar: 'Launch & GTM', description: 'Positioning, landing page, email, social and ads' },
  { value: 'lead_magnet', label: 'Lead magnet', pillar: 'Growth & Loops', description: 'A useful offer and opt-in campaign starter' },
  { value: 'webinar', label: 'Event or webinar', pillar: 'Events & PR', description: 'Registration messaging and event promotion' },
  { value: 'retention', label: 'Retention', pillar: 'Lifecycle & Churn', description: 'A considerate re-engagement campaign' },
  { value: 'education_enrollment', label: 'Education enrollment', pillar: 'UKVI & Admissions', description: 'Admissions or study-abroad information campaign' },
  { value: 'seo_content_brief', label: 'SEO content brief', pillar: 'SEO & AI Search', description: 'Search intent, useful page structure, evidence and organic KPIs' },
  { value: 'cro_experiment', label: 'CRO experiment', pillar: 'CRO & Testing', description: 'A testable hypothesis, one primary metric and guardrails' },
  { value: 'case_study', label: 'Customer case study', pillar: 'Sales & Proof', description: 'Evidence-led customer story with claims held for review' },
  { value: 'referral_campaign', label: 'Referral campaign', pillar: 'Growth & Loops', description: 'Transparent referral offer with eligibility and opt-out checks' },

  // Complete 52 coreyhaines31/marketingskills catalog
  { value: 'product-marketing', label: 'Product Marketing Context', pillar: 'Foundation', description: 'ICP, positioning, messaging hierarchy & competitive wedge' },
  { value: 'marketing-plan', label: '90-Day Marketing Plan', pillar: 'Foundation', description: 'Channel bets, budget allocation, milestones & north-star KPI' },
  { value: 'marketing-council', label: 'Marketing Council Review', pillar: 'Foundation', description: 'Multi-angle critique: positioning, CRO, growth, brand & CFO lens' },
  { value: 'marketing-psychology', label: 'Buyer Psychology Audit', pillar: 'Foundation', description: 'Jobs-to-be-done, switching friction, loss aversion & ethical proof' },
  { value: 'customer-research', label: 'Customer Research Synthesis', pillar: 'Foundation', description: 'Voice-of-customer interview script, objection map & exact phrases' },

  { value: 'cro', label: 'Page CRO Audit', pillar: 'CRO & Testing', description: 'Above-the-fold clarity, visual hierarchy, proof placement & CTA friction' },
  { value: 'signup', label: 'Signup Flow CRO', pillar: 'CRO & Testing', description: 'Field reduction, social SSO, progressive profiling & error states' },
  { value: 'onboarding', label: 'Onboarding Activation CRO', pillar: 'CRO & Testing', description: 'Aha-moment checklist, empty states, sample data & Day-1 activation' },
  { value: 'form-cro', label: 'Lead Form CRO', pillar: 'CRO & Testing', description: 'Multi-step vs single-step, microcopy, trust assurances & completion rate' },
  { value: 'popups', label: 'Popup & Modal Strategy', pillar: 'CRO & Testing', description: 'Exit-intent, scroll-depth triggers, frequency caps & polite dismissal' },
  { value: 'paywalls', label: 'Paywall & Upgrade CRO', pillar: 'CRO & Testing', description: 'Usage meters, plan comparison clarity, trial-end nudges & expansion' },
  { value: 'ab-testing', label: 'A/B Test Setup Spec', pillar: 'CRO & Testing', description: 'MDE sample size, randomization unit, primary + guardrail metrics' },

  { value: 'copywriting', label: 'Landing Page Copywriting', pillar: 'Copy & Email', description: 'PAS/AIDA narrative, concrete specifics, objection handling & CTAs' },
  { value: 'copy-editing', label: '7-Sweep Copy Editing', pillar: 'Copy & Email', description: 'Clarity, voice, "so what?", proof check, specificity & concision' },
  { value: 'cold-email', label: 'Cold Outbound Sequence', pillar: 'Copy & Email', description: 'Trigger-based 4-touch plain-text outbound with low-friction ask' },
  { value: 'emails', label: 'Lifecycle Email Drip', pillar: 'Copy & Email', description: 'Welcome, activation, trial-expiry & win-back sequence architecture' },
  { value: 'sms', label: 'Consented SMS Campaign', pillar: 'Copy & Email', description: '160-char TCPA/GDPR-compliant reminders with STOP opt-out' },
  { value: 'social', label: 'Multi-Platform Social Pack', pillar: 'Copy & Email', description: 'LinkedIn, X thread, Instagram carousel & short-form hooks' },
  { value: 'content-strategy', label: 'Editorial Content Strategy', pillar: 'Copy & Email', description: 'BOFU/MOFU/TOFU pillars, distribution matrix & SME cadence' },

  { value: 'seo-audit', label: 'Technical & On-Page SEO Audit', pillar: 'SEO & AI Search', description: 'Crawlability, CWV, cannibalization, internal links & title CTR' },
  { value: 'ai-seo', label: 'AI Search / GEO Visibility', pillar: 'SEO & AI Search', description: 'Cite-worthy tables, entity clarity & Q&A structure for LLMs/Perplexity' },
  { value: 'programmatic-seo', label: 'Programmatic SEO Blueprint', pillar: 'SEO & AI Search', description: 'Dataset schema, unique value per URL, hub-spoke & thin-page guardrails' },
  { value: 'site-architecture', label: 'Site Information Architecture', pillar: 'SEO & AI Search', description: 'URL taxonomy, navigation depth, breadcrumbs & topic hubs' },
  { value: 'schema', label: 'JSON-LD Schema Markup', pillar: 'SEO & AI Search', description: 'Organization, Product, FAQPage, SoftwareApplication & Breadcrumb JSON-LD' },
  { value: 'link-building', label: 'Digital PR & Link Building', pillar: 'SEO & AI Search', description: 'Original data study, linkable assets & journalist outreach' },
  { value: 'aso', label: 'App Store Optimization (ASO)', pillar: 'SEO & AI Search', description: 'Title/subtitle keywords, screenshot storyline & review velocity' },

  { value: 'ads', label: 'Paid Acquisition Architecture', pillar: 'Paid & Creative', description: 'Google Search, Meta, LinkedIn & YouTube campaign structure + ROAS caps' },
  { value: 'ad-creative', label: 'Ad Creative Testing Matrix', pillar: 'Paid & Creative', description: '3×3 hook × visual angle matrix: problem, proof, demo & comparison' },
  { value: 'image', label: 'Campaign Visual Art Direction', pillar: 'Paid & Creative', description: 'Editorial photography, graphic layout specs & aspect-ratio kit' },
  { value: 'video', label: 'Short & Explainer Video Script', pillar: 'Paid & Creative', description: '3-second hook, visual beat sheet, captions & end-card CTA' },

  { value: 'launch', label: 'Tier-1 Launch Playbook', pillar: 'Launch & GTM', description: 'Product Hunt, customer advisory, press embargo & launch-week war room' },
  { value: 'pricing', label: 'Pricing & Packaging Strategy', pillar: 'Launch & GTM', description: 'Value metric selection, Good-Better-Best tiers & FAQ framing' },
  { value: 'offers', label: 'High-Converting Offer Design', pillar: 'Launch & GTM', description: 'Value stack, risk reversal, clear scope & fast time-to-value' },
  { value: 'free-tools', label: 'Engineering-as-Marketing Tool', pillar: 'Growth & Loops', description: 'Interactive calculator/auditor spec that earns organic links & leads' },
  { value: 'referrals', label: 'Double-Sided Referral Program', pillar: 'Growth & Loops', description: 'In-product trigger moment, dual reward mechanics & fraud checks' },
  { value: 'marketing-loops', label: 'Compounding Growth Loops', pillar: 'Growth & Loops', description: 'Viral, UGC, integration & template loops vs linear funnels' },
  { value: 'marketing-ideas', label: '139 Growth Experiments Filter', pillar: 'Growth & Loops', description: 'ICE-scored shortlist of unconventional acquisition & activation bets' },
  { value: 'lead-magnets', label: 'Interactive Lead Magnet Spec', pillar: 'Growth & Loops', description: 'Template pack, benchmark report or checklist with instant delivery' },

  { value: 'competitors', label: 'Competitor Comparison Pages', pillar: 'Sales & Proof', description: '"Brand vs X" & "Best X Alternatives" honest evaluation pages' },
  { value: 'competitor-profiling', label: 'Competitor Battlecard', pillar: 'Sales & Proof', description: 'Pricing, positioning claims, landmines, win/loss patterns & talk tracks' },
  { value: 'churn-prevention', label: 'Cancel-Flow & Churn Save', pillar: 'Lifecycle & Churn', description: 'Pause option, exit survey routing, dunning recovery & health alerts' },
  { value: 'analytics', label: 'Marketing Analytics Taxonomy', pillar: 'Analytics & RevOps', description: 'Clean event naming, north-star cohorts & executive scorecard' },
  { value: 'attribution', label: 'Multi-Touch Attribution Model', pillar: 'Analytics & RevOps', description: 'UTM governance, self-reported attribution + first/last touch blend' },
  { value: 'conversion-tracking', label: 'Conversion Pixel & CAPI Spec', pillar: 'Analytics & RevOps', description: 'GA4, Meta CAPI, Google Enhanced Conversions & consent mode' },
  { value: 'prospecting', label: 'Account-Based Prospecting', pillar: 'Sales & Proof', description: 'Buying-signal triggers, ICP tiering & multi-threaded account outreach' },
  { value: 'sales-enablement', label: 'Sales Enablement Kit', pillar: 'Sales & Proof', description: 'One-pager, discovery questions, ROI calculator & objection matrix' },
  { value: 'revops', label: 'Lead Lifecycle & Routing SLA', pillar: 'Analytics & RevOps', description: 'MQL/SQL definitions, lead scoring thresholds & 5-minute speed-to-lead' },
  { value: 'co-marketing', label: 'Partner Co-Marketing Playbook', pillar: 'Events & PR', description: 'Joint webinar, integration guide, lead-sharing & co-branded campaign' },
  { value: 'community-marketing', label: 'Community-Led Growth', pillar: 'Events & PR', description: 'Reddit/Slack/Discord value-first participation & ambassador rituals' },
  { value: 'directory-submissions', label: 'Directory & Review Launch', pillar: 'Events & PR', description: 'G2, Capterra, Product Hunt & niche directory listing kit' },
  { value: 'events', label: 'Field Event & Workshop Kit', pillar: 'Events & PR', description: 'Run-of-show, invite sequence, booth QR capture & 48h follow-up' },
  { value: 'influencer-marketing', label: 'Creator & B2B Influencer Brief', pillar: 'Events & PR', description: 'Creator vetting, authentic talking points, UTM promo codes & usage rights' },
  { value: 'public-relations', label: 'Press Release & Media Pitch', pillar: 'Events & PR', description: 'Newsworthy angle, tailored journalist pitch & founder quote bank' },
];

export const DIAGRAM_PRESETS: Array<{
  id: MarketingDiagramType;
  title: string;
  category: string;
  nodes: MarketingDiagramNode[];
}> = [
  // First 7 IDs preserved verbatim for existing tests
  {
    id: 'journey',
    title: 'Customer journey',
    category: 'Product & UX',
    nodes: [
      { title: 'Discover', detail: 'First useful touchpoint' },
      { title: 'Evaluate', detail: 'Compare and ask questions' },
      { title: 'Decide', detail: 'Make the offer clear' },
      { title: 'Onboard', detail: 'Set expectations and next steps' },
      { title: 'Advocate', detail: 'Invite feedback and referrals' },
    ],
  },
  {
    id: 'flow',
    title: 'Campaign workflow',
    category: 'Flow & Sequence',
    nodes: [
      { title: 'Research', detail: 'Audience, need and evidence' },
      { title: 'Brief', detail: 'Goal, message and offer' },
      { title: 'Create', detail: 'Build channel assets' },
      { title: 'Review', detail: 'Check claims and approvals' },
      { title: 'Measure', detail: 'Track agreed outcomes' },
    ],
  },
  {
    id: 'funnel',
    title: 'Demand funnel',
    category: 'Strategy & Positioning',
    nodes: [
      { title: 'Reach', detail: 'Qualified awareness', metric: '100%' },
      { title: 'Engage', detail: 'Useful interactions', metric: '42%' },
      { title: 'Consider', detail: 'Evidence and comparison', metric: '18%' },
      { title: 'Convert', detail: 'Clear, low-friction action', metric: '6.4%' },
      { title: 'Retain', detail: 'Follow-up and value', metric: '4.8%' },
    ],
  },
  {
    id: 'timeline',
    title: 'Launch timeline',
    category: 'Operations & Org',
    nodes: [
      { title: 'T−21 days', detail: 'Confirm brief and assets' },
      { title: 'T−14 days', detail: 'Start awareness content' },
      { title: 'T−7 days', detail: 'Open registration or waitlist' },
      { title: 'Launch day', detail: 'Publish, monitor and respond' },
      { title: 'T+7 days', detail: 'Review results and learn' },
    ],
  },
  {
    id: 'quadrant',
    title: 'Impact and effort map',
    category: 'Strategy & Positioning',
    nodes: [
      { title: 'Quick wins', detail: 'High impact · lower effort' },
      { title: 'Strategic bets', detail: 'High impact · more effort' },
      { title: 'Small improvements', detail: 'Lower impact · lower effort' },
      { title: 'Reconsider', detail: 'Lower impact · more effort' },
    ],
  },
  {
    id: 'flywheel',
    title: 'Growth flywheel',
    category: 'Strategy & Positioning',
    nodes: [
      { title: 'Attract', detail: 'Useful discovery' },
      { title: 'Engage', detail: 'Relevant experience' },
      { title: 'Convert', detail: 'Clear next step' },
      { title: 'Deliver value', detail: 'Meet the promise' },
      { title: 'Advocate', detail: 'Invite voluntary referrals' },
    ],
  },
  {
    id: 'service_blueprint',
    title: 'Service blueprint',
    category: 'Product & UX',
    nodes: [
      { title: 'Discover', detail: 'Learns about the service', frontstage: 'Helpful landing page', backstage: 'Source and claims review' },
      { title: 'Enquire', detail: 'Asks a question', frontstage: 'Acknowledged response', backstage: 'Assign owner and response target' },
      { title: 'Evaluate', detail: 'Compares options', frontstage: 'Clear evidence and terms', backstage: 'Check eligibility and availability' },
      { title: 'Convert', detail: 'Chooses a next step', frontstage: 'Accessible form or booking', backstage: 'Confirm consent and route request' },
      { title: 'Onboard', detail: 'Starts the relationship', frontstage: 'Set expectations', backstage: 'Record outcome and follow-up date' },
    ],
  },

  // 41 additional cathrynlavery/diagram-design v2.6 editorial presets
  {
    id: 'architecture',
    title: 'System architecture',
    category: 'Systems & Architecture',
    nodes: [
      { title: 'Web & Mobile Edge', detail: 'Next.js SPA · CDN · Consent Banner', group: 'Edge' },
      { title: 'API & Auth Gateway', detail: 'JWT RBAC · Rate Limiter · Audit Log', group: 'Control' },
      { title: 'Free AI Router', detail: 'Groq → Cerebras → OpenRouter :free → Ollama', group: 'Intelligence' },
      { title: 'CRM & Campaign Core', detail: 'Leads · Deals · Workflows · Attribution', group: 'Domain' },
      { title: 'LibSQL + Vector Store', detail: 'Multi-tenant SQLite · Knowledge Wiki 128d', group: 'Storage' },
    ],
  },
  {
    id: 'architecture-delta',
    title: 'Architecture migration delta',
    category: 'Systems & Architecture',
    nodes: [
      { title: 'Legacy Siloed Tools [Remove]', detail: 'Disconnected spreadsheets & manual exports' },
      { title: 'Paid-Only LLM Lock-in [Replace]', detail: 'Replaced by 17-provider Free AI Router' },
      { title: 'Unified CRM + Outreach [Keep+]', detail: 'Single tenant-scoped pipeline & inbox' },
      { title: 'Editorial Studio + Wiki [Added]', detail: '48 SVG grammars, 52 kits & cited RAG' },
    ],
  },
  {
    id: 'axonometric-plan',
    title: 'Axonometric stack plan',
    category: 'Spatial & Decomposition',
    nodes: [
      { title: 'Plane 01 · Experience Layer', detail: 'Editorial UI, Command Palette, Studio Canvas' },
      { title: 'Plane 02 · Agent Mesh', detail: 'Tool-calling loop, Memory, Context Compressor' },
      { title: 'Plane 03 · Channel Adapters', detail: 'Email, SMS, VoIP, RSS Radar, Firecrawl' },
      { title: 'Plane 04 · Sovereign Data Plane', detail: 'Encrypted Vault, LibSQL, Audit Trail' },
    ],
  },
  {
    id: 'bar',
    title: 'Channel conversion benchmark (bar)',
    category: 'Data & Statistical Charts',
    nodes: [
      { title: 'Organic Search (BOFU)', detail: 'High-intent comparison pages', metric: '84' },
      { title: 'Customer Referrals', detail: 'Double-sided advocacy loop', metric: '76' },
      { title: 'Lifecycle Email', detail: 'Triggered activation sequence', metric: '61' },
      { title: 'LinkedIn Editorial', detail: 'Founder & SME POV posts', metric: '48' },
      { title: 'Paid Social Cold', detail: 'Creative hook matrix', metric: '29' },
    ],
  },
  {
    id: 'data-flow',
    title: 'Lead enrichment data flow',
    category: 'Data Engineering & Schema',
    nodes: [
      { title: 'Inbound Capture', detail: 'Form / Webhook / CSV import' },
      { title: 'DNS & Domain Check', detail: 'MX, SPF/DMARC & site metadata' },
      { title: 'Cache & Dedup', detail: 'EnrichmentCache TTL + email hash' },
      { title: 'ICP Fit Scorer', detail: '0–100 weighted firmographic score' },
      { title: 'SLA Assignment', detail: 'Route to rep + notify inbox' },
    ],
  },
  {
    id: 'datalake',
    title: 'Marketing data lakehouse',
    category: 'Data Engineering & Schema',
    nodes: [
      { title: 'Raw Ingestion', detail: 'Ad spend, UTMs, CRM events, RSS signals' },
      { title: 'Identity Resolution', detail: 'Company & contact graph stitching' },
      { title: 'Attribution Marts', detail: 'First-touch, W-shaped & self-reported' },
      { title: 'Executive Scorecard', detail: 'CAC, payback, pipeline velocity' },
    ],
  },
  {
    id: 'db-schema',
    title: 'Multi-tenant schema topology',
    category: 'Data Engineering & Schema',
    nodes: [
      { title: 'Company (Tenant Root)', detail: 'id PK · slug UQ · plan · brandColors' },
      { title: 'Lead & Contact', detail: 'id PK · companyId FK · email · score' },
      { title: 'Campaign & Content', detail: 'id PK · companyId FK · type · status' },
      { title: 'KnowledgeNode', detail: 'id PK · companyId FK · wikiLinks · embedding' },
    ],
  },
  {
    id: 'dependency',
    title: 'Launch dependency graph',
    category: 'Systems & Architecture',
    nodes: [
      { title: 'Positioning Brief', detail: 'Blocks all downstream copy & creative' },
      { title: 'Landing Page + UTM', detail: 'Depends on Positioning + Conversion Pixel' },
      { title: 'Email & SMS Drip', detail: 'Depends on Landing Page + Consent Check' },
      { title: 'Sales Battlecard', detail: 'Depends on Positioning + Pricing Tiers' },
    ],
  },
  {
    id: 'deployment',
    title: 'Self-hosted deployment topology',
    category: 'Systems & Architecture',
    nodes: [
      { title: 'TLS Reverse Proxy', detail: 'Cloudflare / Caddy HTTPS termination' },
      { title: 'MarketingOS App Container', detail: 'Next.js 16 Node 22 · Port 3000' },
      { title: 'Local AI Sidecars', detail: 'Ollama :11434 · ComfyUI :8188 · Kokoro :8880' },
      { title: 'Encrypted Volume', detail: './db/custom.db + daily snapshot backup' },
    ],
  },
  {
    id: 'dp-integration',
    title: 'Integration hub contract',
    category: 'Data Engineering & Schema',
    nodes: [
      { title: 'AES-256-GCM Vault', detail: 'CREDENTIAL_ENCRYPTION_KEY server-only' },
      { title: 'Adapter Registry', detail: '116 cataloged marketing & UKVI connectors' },
      { title: 'Webhook Dispatcher', detail: 'HMAC-SHA256 signed outbound events' },
      { title: 'Usage & Health Log', detail: 'Latency, status codes & retry queue' },
    ],
  },
  {
    id: 'dp-security-matrix',
    title: 'RBAC & data security matrix',
    category: 'Data Engineering & Schema',
    nodes: [
      { title: 'Company Owner / Admin', detail: 'Full workspace, billing, vault & team RBAC' },
      { title: 'Marketing / SEO Manager', detail: 'Campaigns, Studio, SEO, Feeds & Analytics' },
      { title: 'Customer Support', detail: 'Unified Inbox, Tickets, Auto-Reply & VoIP' },
      { title: 'Viewer / Client User', detail: 'Read-only dashboards & approved reports' },
    ],
  },
  {
    id: 'er',
    title: 'CRM entity-relationship (ER)',
    category: 'Data Engineering & Schema',
    nodes: [
      { title: 'COMPANY ||--o{ LEAD', detail: 'One tenant owns many scored leads' },
      { title: 'LEAD ||--o{ LEAD_ACTIVITY', detail: 'Calls, emails, enrichments & notes' },
      { title: 'CONTACT ||--o{ DEAL', detail: 'Qualified opportunities with stage & value' },
      { title: 'COMPANY ||--o{ WORKFLOW', detail: 'Automated trigger → action pipelines' },
    ],
  },
  {
    id: 'exploded',
    title: 'Exploded campaign anatomy',
    category: 'Spatial & Decomposition',
    nodes: [
      { title: '01 · Hook & Headline', detail: 'Specific outcome in plain buyer language' },
      { title: '02 · Visual Proof', detail: 'Annotated product diagram or verified quote' },
      { title: '03 · Value Mechanism', detail: '3 concrete steps showing how it works' },
      { title: '04 · Risk-Free CTA', detail: 'High-contrast accessible action + expectations' },
    ],
  },
  {
    id: 'fishbone',
    title: 'Conversion drop-off Ishikawa (fishbone)',
    category: 'Operations & Org',
    nodes: [
      { title: 'Messaging Ambiguity', detail: 'Vague headline fails 5-second clarity test' },
      { title: 'Form Friction', detail: '7+ mandatory fields before showing value' },
      { title: 'Missing Proof', detail: 'Unverified claims without concrete examples' },
      { title: 'Mobile Latency', detail: 'Heavy scripts delaying LCP > 3.0s' },
    ],
  },
  {
    id: 'flowchart',
    title: 'Lead qualification decision flowchart',
    category: 'Flow & Sequence',
    nodes: [
      { title: 'New Lead Arrives', detail: 'Webhook / Form / Import' },
      { title: 'Valid Business Domain?', detail: 'Check MX & corporate domain match' },
      { title: 'ICP Score ≥ 70?', detail: 'Route immediately to Account Executive' },
      { title: 'Nurture Sequence', detail: 'Enroll in educational 4-step email drip' },
    ],
  },
  {
    id: 'gantt',
    title: 'Quarterly GTM Gantt schedule',
    category: 'Operations & Org',
    nodes: [
      { title: 'W1–W2 · ICP & Positioning', detail: 'Customer interviews & message testing', metric: '0-25%' },
      { title: 'W3–W5 · Asset & Free Tool Build', detail: 'Landing page, calculator & email kit', metric: '20-55%' },
      { title: 'W6–W8 · Launch & Partner Push', detail: 'PR, LinkedIn, newsletter & webinar', metric: '50-80%' },
      { title: 'W9–W12 · CRO & Scale Winners', detail: 'A/B tests & paid retargeting', metric: '75-100%' },
    ],
  },
  {
    id: 'heatmap',
    title: 'Cohort engagement heatmap',
    category: 'Data & Statistical Charts',
    nodes: [
      { title: 'Week 1 Onboarding', detail: 'Peak activation window', metric: '92' },
      { title: 'Week 2 Habit Loop', detail: 'First saved kit or workflow', metric: '68' },
      { title: 'Week 4 Team Invite', detail: 'Multi-seat collaboration trigger', metric: '54' },
      { title: 'Week 8 Renewal Health', detail: 'Sustained weekly active usage', metric: '49' },
    ],
  },
  {
    id: 'high-level',
    title: 'Executive high-level overview',
    category: 'Systems & Architecture',
    nodes: [
      { title: 'Market Signals', detail: 'RSS Radar, Competitors & SEO Demand' },
      { title: 'MarketingOS Engine', detail: 'Strategy, Studio, Free AI & Automation' },
      { title: 'Revenue Outcomes', detail: 'Qualified Pipeline, Admissions & Retention' },
    ],
  },
  {
    id: 'it-state',
    title: 'Martech consolidation state',
    category: 'Systems & Architecture',
    nodes: [
      { title: 'Current: 9 Point Tools', detail: '$1,800/mo fragmented SaaS & CSV glue' },
      { title: 'Transition: Dual Sync', detail: 'Import CRM, templates & webhooks' },
      { title: 'Target: Unified MarketingOS', detail: 'Single DB, $0 Free AI stack & full auditability' },
    ],
  },
  {
    id: 'kanban',
    title: 'Editorial production Kanban',
    category: 'Operations & Org',
    nodes: [
      { title: 'Backlog', detail: '12 keyword briefs & customer stories' },
      { title: 'Drafting', detail: 'UKVI 2026 CAS guide + comparison page' },
      { title: 'Humanizer & Legal QA', detail: 'Zero-slop & claim verification pass' },
      { title: 'Published & Tracked', detail: 'Live with UTM & conversion goals' },
    ],
  },
  {
    id: 'layers',
    title: 'Full-stack intelligence layers',
    category: 'Systems & Architecture',
    nodes: [
      { title: 'Layer 4 · Autonomous Workflows', detail: 'n8n-style triggers, approvals & schedules' },
      { title: 'Layer 3 · Specialized Skills', detail: '52 marketing playbooks + UKVI advisories' },
      { title: 'Layer 2 · Knowledge & Memory', detail: '[[WikiLinks]] graph + episodic memory' },
      { title: 'Layer 1 · Free Model Router', detail: '17 free providers + local Ollama fallback' },
    ],
  },
  {
    id: 'line',
    title: 'Pipeline velocity trend (slope/line)',
    category: 'Data & Statistical Charts',
    nodes: [
      { title: 'Jan', detail: 'Baseline inbound', metric: '28' },
      { title: 'Feb', detail: 'SEO + Lead Magnet live', metric: '44' },
      { title: 'Mar', detail: 'Outbound + Webinar', metric: '63' },
      { title: 'Apr', detail: 'Referral loop compounding', metric: '89' },
    ],
  },
  {
    id: 'medallion',
    title: 'Medallion intelligence pipeline (Bronze/Silver/Gold)',
    category: 'Data Engineering & Schema',
    nodes: [
      { title: 'Bronze · Raw Signals', detail: 'Unfiltered RSS items, scrapes & webhook payloads' },
      { title: 'Silver · Enriched Entities', detail: 'Normalized companies, contacts & deduped leads' },
      { title: 'Gold · Actionable Radar', detail: 'ICP-matched alerts, battlecards & ready campaigns' },
    ],
  },
  {
    id: 'nested',
    title: 'Nested market sizing (TAM / SAM / SOM)',
    category: 'Strategy & Positioning',
    nodes: [
      { title: 'TAM · Global B2B & Edu Teams', detail: 'All growth, agency & admissions teams' },
      { title: 'SAM · Privacy & Cost-Conscious', detail: 'Teams seeking self-hosted & $0 AI operations' },
      { title: 'SOM · Beachhead Wedge', detail: 'Agencies & UKVI consultancies needing all-in-one OS' },
    ],
  },
  {
    id: 'org-chart',
    title: 'AI + Human marketing org chart',
    category: 'Operations & Org',
    nodes: [
      { title: 'VP Marketing (Human Lead)', detail: 'Strategy, brand approvals & budget sign-off' },
      { title: 'Demand & SEO Pod', detail: 'OpenSEO crawler, programmatic hubs & paid ads' },
      { title: 'Content & Creative Pod', detail: 'Editorial diagrams, humanizer & video studio' },
      { title: 'RevOps & Admissions Pod', detail: 'Enrichment, SMS/VoIP & UKVI counselor desk' },
    ],
  },
  {
    id: 'polar',
    title: 'Channel balance polar wheel',
    category: 'Data & Statistical Charts',
    nodes: [
      { title: 'SEO & GEO', detail: 'Compounding search capture', metric: '85' },
      { title: 'Email Lifecycle', detail: 'Owned audience retention', metric: '78' },
      { title: 'Product Viral', detail: 'Free tools & templates', metric: '70' },
      { title: 'Social POV', detail: 'Executive authority', metric: '64' },
      { title: 'Partner Co-Mktg', detail: 'Shared ecosystems', metric: '58' },
    ],
  },
  {
    id: 'process',
    title: '7-Sweep editorial QA process',
    category: 'Flow & Sequence',
    nodes: [
      { title: '1. Clarity Sweep', detail: 'Can a reader grasp the point in 5 seconds?' },
      { title: '2. So-What & Proof', detail: 'Back every claim with a concrete fact or cut it' },
      { title: '3. Humanizer Pass', detail: 'Strip AI vocabulary, triads & puffery' },
      { title: '4. CTA & Compliance', detail: 'Verify links, contrast, consent & opt-outs' },
    ],
  },
  {
    id: 'pyramid',
    title: 'Messaging hierarchy pyramid',
    category: 'Strategy & Positioning',
    nodes: [
      { title: 'Category North Star', detail: 'The sovereign all-in-one Marketing & Admissions OS' },
      { title: 'Strategic Pillars', detail: 'Editorial Craft · $0 Free AI · Real Multi-Channel CRM' },
      { title: 'Proof & Capabilities', detail: '48 SVG diagrams, 52 kits, 17 free LLM providers, 71 DB tables' },
    ],
  },
  {
    id: 'radar',
    title: 'Competitive capability radar',
    category: 'Data & Statistical Charts',
    nodes: [
      { title: 'Cost Efficiency', detail: '$0 free AI & self-hosted', metric: '96' },
      { title: 'Editorial Quality', detail: 'Zero-slop SVG & copy', metric: '90' },
      { title: 'CRM Depth', detail: 'Leads, deals, SMS, VoIP', metric: '86' },
      { title: 'Data Privacy', detail: 'Tenant-isolated SQLite', metric: '94' },
      { title: 'Automation', detail: 'Visual workflows + MCP', metric: '84' },
    ],
  },
  {
    id: 'sankey',
    title: 'Budget-to-pipeline Sankey flow',
    category: 'Data & Statistical Charts',
    nodes: [
      { title: 'Content & SEO ($0 Media)', detail: '45% of qualified pipeline', metric: '45' },
      { title: 'Partner & Referral', detail: '30% of qualified pipeline', metric: '30' },
      { title: 'Targeted Paid Search', detail: '25% of qualified pipeline', metric: '25' },
      { title: 'Closed-Won Revenue', detail: 'Attributed multi-touch conversion', metric: '100' },
    ],
  },
  {
    id: 'scatter',
    title: 'Keyword opportunity scatter (Volume vs Intent)',
    category: 'Data & Statistical Charts',
    nodes: [
      { title: '"crm vs alternatives"', detail: 'High intent · fast win', metric: '88' },
      { title: '"ukvi cas 28 day calculator"', detail: 'Interactive tool magnet', metric: '92' },
      { title: '"b2b email templates"', detail: 'Mid-funnel volume', metric: '64' },
      { title: '"what is marketing"', detail: 'High volume · low buyer intent', metric: '22' },
    ],
  },
  {
    id: 'sequence',
    title: 'Webhook & agent sequence diagram',
    category: 'Flow & Sequence',
    nodes: [
      { title: 'Prospect → Web Form', detail: 'Submits inquiry with consent' },
      { title: 'API → Enrichment', detail: 'Resolves company & MX records' },
      { title: 'Free AI Agent → Wiki', detail: 'Drafts cited reply from [[Playbook]]' },
      { title: 'Rep → Unified Inbox', detail: 'Reviews & approves 1-click send' },
    ],
  },
  {
    id: 'state',
    title: 'Lead lifecycle state machine',
    category: 'Flow & Sequence',
    nodes: [
      { title: 'New', detail: 'Captured & deduplicated' },
      { title: 'Contacted', detail: 'First human/approved touch within SLA' },
      { title: 'Qualified (SQL)', detail: 'Confirmed need, budget & timeline' },
      { title: 'Converted', detail: 'Deal won & onboarding triggered' },
    ],
  },
  {
    id: 'story-map',
    title: 'User story map (Backbone → Releases)',
    category: 'Product & UX',
    nodes: [
      { title: 'Plan Strategy', detail: 'R1: 52 Kits · R2: Council Critique' },
      { title: 'Design Assets', detail: 'R1: 48 Diagrams + CTAs · R2: Reimagine HTML' },
      { title: 'Launch Outreach', detail: 'R1: Email/SMS/Social · R2: Workflow Studio' },
      { title: 'Measure & Learn', detail: 'R1: UTM Funnel · R2: Wiki Hindsight' },
    ],
  },
  {
    id: 'swimlane',
    title: 'Cross-functional UKVI admissions swimlane',
    category: 'Operations & Org',
    nodes: [
      { title: 'Student Applicant', detail: 'Uploads transcripts, passport & IELTS', group: 'Student' },
      { title: 'Admissions Counselor', detail: 'Matches 5 UK universities & verifies gaps', group: 'Counselor' },
      { title: 'Compliance Officer', detail: 'Audits 28-day bank statement & Pre-CAS mock', group: 'Compliance' },
      { title: 'University Partner', detail: 'Issues unconditional offer & CAS number', group: 'University' },
    ],
  },
  {
    id: 'tree',
    title: 'North-star metric driver tree',
    category: 'Spatial & Decomposition',
    nodes: [
      { title: 'Net New ARR', detail: 'Qualified Pipeline × Win Rate × ACV' },
      { title: 'Qualified Pipeline', detail: 'High-Intent Visitors × Signup % × SQL %' },
      { title: 'Win Rate', detail: 'Speed-to-Lead × Proof Quality × Offer Fit' },
      { title: 'Net Retention', detail: 'Day-7 Activation × Team Expansion − Churn' },
    ],
  },
  {
    id: 'treemap',
    title: 'Content library allocation treemap',
    category: 'Spatial & Decomposition',
    nodes: [
      { title: 'BOFU Comparison & Case Studies (40%)', detail: 'Highest conversion density', metric: '40' },
      { title: 'Interactive Free Tools & Calculators (25%)', detail: 'Backlinks & qualified signups', metric: '25' },
      { title: 'MOFU Playbooks & Templates (20%)', detail: 'Newsletter & lifecycle fuel', metric: '20' },
      { title: 'Executive POV & Original Data (15%)', detail: 'Category authority', metric: '15' },
    ],
  },
  {
    id: 'uml-class',
    title: 'Agent runtime domain model (UML)',
    category: 'Data Engineering & Schema',
    nodes: [
      { title: 'FreeAiGateway', detail: '+generateChatCompletion() · +fallbackChain' },
      { title: 'ToolCallingLoop', detail: '+executeAgentTool() · +maxSteps: 6' },
      { title: 'KnowledgeWikiRag', detail: '+searchCitations() · +extractWikiLinks()' },
      { title: 'ModelDeckMeter', detail: '+rpmPctLeft · +rpdPctLeft · +promptCache' },
    ],
  },
  {
    id: 'venn',
    title: 'Positioning sweet-spot Venn',
    category: 'Strategy & Positioning',
    nodes: [
      { title: 'What Buyers Urgently Need', detail: 'Predictable pipeline without tool sprawl' },
      { title: 'What Only You Do Uniquely', detail: 'Editorial craft + $0 sovereign AI stack' },
      { title: 'Winning Wedge (Overlap)', detail: 'Verified outcomes at 1/10th SaaS cost' },
    ],
  },
  {
    id: 'wardley',
    title: 'Wardley value-chain evolution map',
    category: 'Strategy & Positioning',
    nodes: [
      { title: 'Proprietary Brand Playbooks [Genesis]', detail: 'High visibility · custom differentiation', metric: '18' },
      { title: 'Editorial Diagram & CRO Kits [Custom]', detail: 'Tailored conversion craftsmanship', metric: '42' },
      { title: 'Multi-Channel CRM Workflows [Product]', detail: 'Standardized reliable execution', metric: '70' },
      { title: 'LLM Tokens & Commodity Hosting [Utility]', detail: 'Routed across $0 free endpoints', metric: '92' },
    ],
  },
  {
    id: 'waterfall',
    title: 'MRR bridge waterfall (running total)',
    category: 'Data & Statistical Charts',
    nodes: [
      { title: 'Starting MRR', detail: 'Opening recurring base', metric: '+100' },
      { title: 'New Logo Acquisition', detail: 'SEO + Outbound + Partner deals', metric: '+34' },
      { title: 'Seat & Tier Expansion', detail: 'Multi-workspace upgrades', metric: '+16' },
      { title: 'Gross Churn', detail: 'Mitigated via cancel-save flow', metric: '-8' },
      { title: 'Ending Net MRR', detail: '142% net growth index', metric: '=142' },
    ],
  },
];

export const DEFAULT_KIT_FORM: MarketingKitForm = {
  type: 'product_launch',
  brand: '',
  product: '',
  description: '',
  audience: '',
  goal: '',
  offer: '',
  proof: '',
  tone: 'Clear and helpful',
  channels: 'Website, email, LinkedIn',
};

function clean(value: string, fallback: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed.slice(0, 500) : fallback;
}

function sentence(value: string): string {
  const cleanValue = value.trim().replace(/[.!?]+$/, '');
  return cleanValue ? `${cleanValue}.` : '';
}

function buildSkillPlaybookChecklist(type: MarketingKitType, form: MarketingKitForm): string[] {
  const map: Partial<Record<MarketingKitType, string[]>> = {
    'product-marketing': [
      `Define primary ICP & trigger moment for ${form.audience}`,
      'Document status-quo alternative (spreadsheets, agencies, legacy SaaS)',
      'Lock 1-sentence category anchor + 3 falsifiable proof points',
      'Align homepage, sales deck, and outbound around identical terminology',
    ],
    cro: [
      'Pass 5-second test above the fold: What is it, who is it for, what happens on click?',
      'Place verifiable proof within 1 scroll of primary CTA',
      'Eliminate competing secondary navigation links on dedicated landing pages',
      'Add risk-reversal / expectation microcopy directly beneath the button',
    ],
    'cold-email': [
      'Touch 1 (45–75 words): Specific observation → peer problem → concrete proof → interest-based ask',
      'Touch 2 (+3d): Useful benchmark or teardown asset with zero guilt-trip language',
      'Touch 3 (+7d): Short case angle relevant to recipient role',
      'Touch 4 (+12d): Polite close-the-loop note + 1-click opt-out compliance',
    ],
    'programmatic-seo': [
      'Ensure every generated page answers a distinct search intent with unique data rows',
      'Enforce minimum content utility gate (no empty state or Mad-Libs spun paragraphs)',
      'Connect hub → category → leaf breadcrumbs for 3-click crawl depth',
      'Embed schema.org JSON-LD + interactive calculator/filter per template',
    ],
    'ai-seo': [
      'Open each key guide with a direct 45-word factual answer block',
      'Include structured HTML comparison tables with explicit pricing, pros, and limits',
      'Cite primary benchmarks and timestamps so LLMs/Perplexity rank page as high-trust source',
      'Use question-phrased H2 headings matching real buyer prompts',
    ],
  };

  return (
    map[type] || [
      `Confirm exact buyer segment and trigger context for ${form.audience}`,
      `Anchor copy in concrete specifics for ${form.product} rather than generic adjectives`,
      `Pair primary CTA ("${form.offer}") with clear next-step expectations`,
      'Verify every claim, metric, and compliance guardrail prior to launch',
    ]
  );
}

export function buildMarketingKit(input: MarketingKitForm): MarketingKitData {
  const form: MarketingKitForm = {
    ...input,
    brand: clean(input.brand, '[Brand name]'),
    product: clean(input.product, '[Product or service]'),
    description: clean(input.description, '[Describe the customer problem and your approach]'),
    audience: clean(input.audience, '[Target audience]'),
    goal: clean(input.goal, '[Desired customer outcome]'),
    offer: clean(input.offer, '[Offer or next step]'),
    proof: clean(input.proof, '[Add a verified proof point]'),
    tone: clean(input.tone, 'Clear and helpful'),
    channels: clean(input.channels, 'Website, email, LinkedIn'),
  };
  const channels = [...new Set(form.channels.split(',').map((channel) => channel.trim()).filter(Boolean))].slice(0, 12);
  const meta = KIT_TYPES.find((item) => item.value === form.type);
  const typeLabel = meta?.label || 'Campaign';
  let heroHeadline: string;
  let primaryCta: string;
  let emailSubject: string;

  switch (form.type) {
    case 'lead_magnet':
    case 'lead-magnets':
    case 'free-tools':
      heroHeadline = form.offer.startsWith('[') ? `A practical resource for ${form.audience}` : `Get ${form.offer}`;
      primaryCta = 'Get the resource';
      emailSubject = `Your ${form.offer.startsWith('[') ? 'resource' : form.offer} is ready`;
      break;
    case 'webinar':
    case 'events':
      heroHeadline = `Join ${form.brand} for ${form.product}`;
      primaryCta = 'Save your place';
      emailSubject = `You're invited: ${form.product}`;
      break;
    case 'retention':
    case 'churn-prevention':
      heroHeadline = `Keep moving forward with ${form.brand}`;
      primaryCta = 'Continue where you left off';
      emailSubject = `A next step from ${form.brand}`;
      break;
    case 'education_enrollment':
      heroHeadline = `Plan your next step with ${form.brand}`;
      primaryCta = 'Explore your options';
      emailSubject = `Your next-step guide from ${form.brand}`;
      break;
    case 'seo_content_brief':
    case 'seo-audit':
    case 'ai-seo':
    case 'programmatic-seo':
      heroHeadline = `A practical guide to ${form.product}`;
      primaryCta = 'Read the guide';
      emailSubject = `A useful guide from ${form.brand}`;
      break;
    case 'cro_experiment':
    case 'cro':
    case 'ab-testing':
    case 'signup':
    case 'onboarding':
    case 'form-cro':
      heroHeadline = `Test a clearer next step for ${form.audience}`;
      primaryCta = 'Review the experiment';
      emailSubject = `Experiment brief: ${form.product}`;
      break;
    case 'case_study':
    case 'competitors':
    case 'competitor-profiling':
    case 'sales-enablement':
      heroHeadline = `A customer story about ${form.product}`;
      primaryCta = 'Read the case study';
      emailSubject = `A customer story from ${form.brand}`;
      break;
    case 'referral_campaign':
    case 'referrals':
    case 'marketing-loops':
      heroHeadline = `Share ${form.product} with someone who could benefit`;
      primaryCta = 'Invite a colleague';
      emailSubject = `A thoughtful invitation from ${form.brand}`;
      break;
    default:
      heroHeadline = `${form.product}: ${form.goal.startsWith('[') ? `a clear next step for ${form.audience}` : form.goal}`;
      primaryCta = form.offer.startsWith('[') ? `Explore ${form.product}` : form.offer.slice(0, 42);
      emailSubject = `${typeLabel}: ${form.product}`;
  }

  const proofLine = form.proof.startsWith('[')
    ? 'Add a verified customer quote, result or credential here before publishing.'
    : `Evidence to review: ${form.proof}`;
  const offerLine = form.offer.startsWith('[') ? 'Add the specific offer, price or next step.' : `Offer: ${form.offer}`;

  const isSeo = ['seo_content_brief', 'seo-audit', 'ai-seo', 'programmatic-seo', 'site-architecture', 'schema', 'link-building', 'aso'].includes(form.type);
  const isCro = ['cro_experiment', 'cro', 'ab-testing', 'signup', 'onboarding', 'form-cro', 'popups', 'paywalls'].includes(form.type);
  const isCase = ['case_study', 'competitors', 'competitor-profiling', 'sales-enablement'].includes(form.type);
  const isReferral = ['referral_campaign', 'referrals', 'marketing-loops'].includes(form.type);

  const primaryKpi = isSeo
    ? 'Qualified organic visits that reach the intended next step; search volume alone is not success'
    : isCro
      ? 'Pre-registered primary conversion rate for the tested audience and period'
      : isCase
        ? 'Qualified requests influenced by the case study, using a defined attribution window'
        : isReferral
          ? 'Eligible, consented referrals that complete the defined next step'
          : 'Choose one primary conversion event before launch';

  const guardrails = isCro
    ? ['Define audience, randomization, sample size and stopping rule before launch', 'Monitor guardrail metrics and adverse effects', 'Do not call a result conclusive before the planned analysis']
    : isReferral
      ? ['Publish eligibility, reward and expiry terms', 'Respect consent and opt-out preferences', 'Monitor fraud, complaints and incentive cost']
      : ['Cost or effort per qualified outcome', 'Unsubscribe or opt-out rate', 'Negative feedback and complaint rate'];

  const reviewNote = isSeo
    ? 'Template-based content brief, not live SEO data. Verify search intent, sources, facts and claims; no ranking or traffic estimate is included.'
    : isCro
      ? 'Planning template only. Pre-register a valid experiment design and review results; no conversion lift is predicted.'
      : isCase
        ? 'Do not publish an outcome, quote, logo or customer name without verifiable evidence and written permission.'
        : isReferral
          ? 'Confirm eligibility, reward, expiry, privacy and anti-spam terms before inviting anyone.'
          : 'Template-based starter copy, not AI-generated. Verify every factual claim, price, date, eligibility rule and destination before publishing.';

  const body = [
    'Hi {{first_name}},',
    '',
    sentence(form.description),
    '',
    sentence(`This is for ${form.audience}`),
    sentence(offerLine),
    '',
    `${primaryCta}: {{destination_url}}`,
    '',
    `— ${form.brand}`,
  ].filter(Boolean).join('\n');

  return {
    version: 1,
    form,
    outputs: {
      positioning: `For ${form.audience}, ${form.brand} offers ${form.product} to help with ${form.goal}. ${proofLine}`,
      heroHeadline,
      heroSubhead: `${sentence(form.description)} ${sentence(`Designed for ${form.audience}`)} ${sentence(offerLine)}`.trim(),
      benefitBullets: [
        `Audience: ${form.audience}`,
        `Core value: ${form.description}`,
        proofLine,
      ],
      emailSubject,
      emailPreheader: `${typeLabel} from ${form.brand}: ${form.goal}`,
      emailBody: body,
      linkedinPost: `${heroHeadline}\n\n${sentence(form.description)}\n\n${offerLine}\n\n${primaryCta}: {{destination_url}}`,
      instagramPost: `${heroHeadline}\n\n${sentence(form.description)}\n\n${primaryCta} → {{destination_url}}`,
      adHeadline: heroHeadline,
      adDescription: `${sentence(form.description)} ${sentence(offerLine)}`.trim(),
      channelPlan: channels.length ? channels : ['Website', 'Email', 'LinkedIn'],
      primaryKpi,
      guardrails,
      primaryCta,
      reviewNote,
      skillPlaybook: buildSkillPlaybookChecklist(form.type, form),
    },
  };
}

export function isMarketingKitData(value: unknown): value is MarketingKitData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MarketingKitData>;
  const form = candidate.form;
  const outputs = candidate.outputs;
  if (candidate.version !== 1 || !form || typeof form !== 'object' || !outputs || typeof outputs !== 'object') return false;
  if (!KIT_TYPES.some((item) => item.value === form.type)) return false;
  const formStrings: Array<keyof Omit<MarketingKitForm, 'type'>> = ['brand', 'product', 'description', 'audience', 'goal', 'offer', 'proof', 'tone', 'channels'];
  if (formStrings.some((key) => typeof form[key] !== 'string')) return false;
  const outputStrings: Array<keyof Omit<MarketingKitData['outputs'], 'benefitBullets' | 'channelPlan' | 'guardrails' | 'skillPlaybook'>> = [
    'positioning', 'heroHeadline', 'heroSubhead', 'emailSubject', 'emailPreheader', 'emailBody', 'linkedinPost', 'instagramPost', 'adHeadline', 'adDescription', 'primaryKpi', 'primaryCta', 'reviewNote',
  ];
  if (outputStrings.some((key) => typeof outputs[key] !== 'string')) return false;
  return [outputs.benefitBullets, outputs.channelPlan, outputs.guardrails].every(
    (items) => Array.isArray(items) && items.every((item) => typeof item === 'string'),
  );
}

export function isMarketingDiagramData(value: unknown): value is MarketingDiagramData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MarketingDiagramData>;
  const validIds = new Set<string>(DIAGRAM_PRESETS.map((p) => p.id));
  if (candidate.version !== 1 || typeof candidate.type !== 'string' || !validIds.has(candidate.type)) return false;
  if (typeof candidate.title !== 'string' || typeof candidate.accent !== 'string' || !Array.isArray(candidate.nodes) || candidate.nodes.length < 2 || candidate.nodes.length > 16) return false;
  if ([candidate.paper, candidate.ink, candidate.muted].some((color) => color !== undefined && typeof color !== 'string')) return false;
  return candidate.nodes.every((node) => !!node && typeof node === 'object' && typeof node.title === 'string' && typeof node.detail === 'string');
}

export function isCtaButtonData(value: unknown): value is CtaButtonData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CtaButtonData>;
  const validVariants: CtaButtonVariant[] = [
    'solid', 'outline', 'soft', 'ghost', 'gradient', 'pill-badge',
    'split-arrow', 'subtext-stack', 'glass-editorial', 'brutalist-offset',
    'minimal-underline', 'dual-pair',
  ];
  return (
    candidate.version === 1 &&
    typeof candidate.label === 'string' &&
    typeof candidate.href === 'string' &&
    typeof candidate.accent === 'string' &&
    validVariants.includes(candidate.variant as CtaButtonVariant) &&
    ['compact', 'standard', 'large'].includes(candidate.size || '') &&
    ['square', 'rounded', 'pill'].includes(candidate.corners || '')
  );
}

export function safeButtonHref(value: string): string | null {
  const href = value.trim();
  if (!href) return '#';
  if (href.startsWith('/') || href.startsWith('#')) return href;
  try {
    const parsed = new URL(href);
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(parsed.protocol) ? href : null;
  } catch {
    return null;
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1];
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

function luminance(rgb: [number, number, number]): number {
  const linear = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function contrastRatio(foreground: string, background: string): number | null {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  if (!fg || !bg) return null;
  const values = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

export function normalizeHexColor(value: string, fallback = '#bf4520'): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : fallback;
}

export function softButtonBackground(accentColor: string): string {
  const [red, green, blue] = hexToRgb(normalizeHexColor(accentColor)) || [191, 69, 32];
  const alpha = 0x1a / 255;
  const composite = [red, green, blue].map((channel) => Math.round(channel * alpha + 255 * (1 - alpha)));
  return `#${composite.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function darkenHex(accentColor: string, amount = 0.22): string {
  const [r, g, b] = hexToRgb(normalizeHexColor(accentColor)) || [191, 69, 32];
  const factor = Math.max(0, 1 - amount);
  return `#${[r, g, b].map((c) => Math.round(c * factor).toString(16).padStart(2, '0')).join('')}`;
}

export function bestButtonTextColor(background: string): string {
  const normalized = normalizeHexColor(background);
  const whiteContrast = contrastRatio('#ffffff', normalized) || 0;
  const darkContrast = contrastRatio('#111111', normalized) || 0;
  return whiteContrast >= darkContrast ? '#ffffff' : '#111111';
}

export function buttonHtml(config: {
  label: string;
  href: string;
  accent: string;
  variant: CtaButtonVariant;
  size: CtaButtonData['size'];
  corners: CtaButtonData['corners'];
  badgeText?: string;
  subtext?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}): string {
  const href = safeButtonHref(config.href);
  if (!href) throw new Error('Use an HTTPS, HTTP, mailto, tel, relative or fragment destination.');

  const accent = normalizeHexColor(config.accent);
  const darker = darkenHex(accent, 0.24);
  const pad = config.size === 'compact' ? '9px 16px' : config.size === 'large' ? '15px 26px' : '12px 20px';
  const radius = config.corners === 'pill' ? '999px' : config.corners === 'square' ? '4px' : '10px';
  const textOnSolid = bestButtonTextColor(accent);
  const accessibleLabel = escapeHtml(config.label.trim() || 'Learn more');
  const escapedHref = escapeHtml(href);
  const fontBase = 'font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;line-height:1.2;text-decoration:none';

  switch (config.variant) {
    case 'gradient':
      return `<a href="${escapedHref}" style="display:inline-block;padding:${pad};background:linear-gradient(135deg,${accent} 0%,${darker} 100%);color:${textOnSolid};border:1px solid ${darker};border-radius:${radius};${fontBase};text-align:center">${accessibleLabel} &rarr;</a>`;
    case 'ghost':
      return `<a href="${escapedHref}" style="display:inline-block;padding:${pad};background:transparent;color:${accent};border:1px solid transparent;border-radius:${radius};${fontBase};text-align:center">${accessibleLabel} &rarr;</a>`;
    case 'pill-badge': {
      const badge = escapeHtml((config.badgeText || 'NEW').trim());
      return `<a href="${escapedHref}" style="display:inline-flex;align-items:center;gap:10px;padding:7px 18px 7px 8px;background:#111318;color:#ffffff;border:1px solid #272b36;border-radius:999px;${fontBase}"><span style="padding:4px 9px;background:${accent};color:${textOnSolid};border-radius:999px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase">${badge}</span><span>${accessibleLabel} &rarr;</span></a>`;
    }
    case 'split-arrow':
      return `<a href="${escapedHref}" style="display:inline-flex;align-items:stretch;background:${accent};color:${textOnSolid};border-radius:${radius};overflow:hidden;${fontBase}"><span style="padding:${pad}">${accessibleLabel}</span><span style="display:inline-flex;align-items:center;padding:0 14px;background:${darker};border-left:1px solid rgba(255,255,255,0.2)">&rarr;</span></a>`;
    case 'subtext-stack': {
      const sub = escapeHtml((config.subtext || 'No credit card · 2-min setup').trim());
      return `<a href="${escapedHref}" style="display:inline-block;padding:${pad};background:${accent};color:${textOnSolid};border-radius:${radius};${fontBase};text-align:center"><span style="display:block">${accessibleLabel}</span><span style="display:block;margin-top:4px;font-size:11px;font-weight:500;opacity:0.88">${sub}</span></a>`;
    }
    case 'glass-editorial':
      return `<a href="${escapedHref}" style="display:inline-block;padding:${pad};background:#fafaf7;color:#141413;border:1px solid ${accent};border-radius:${radius};box-shadow:inset 0 -2px 0 ${accent};${fontBase};text-align:center">${accessibleLabel}</a>`;
    case 'brutalist-offset':
      return `<a href="${escapedHref}" style="display:inline-block;padding:${pad};background:${accent};color:${textOnSolid};border:2px solid #111111;border-radius:${radius};box-shadow:4px 4px 0 #111111;${fontBase};text-align:center">${accessibleLabel}</a>`;
    case 'minimal-underline':
      return `<a href="${escapedHref}" style="display:inline-block;padding:6px 2px;background:transparent;color:#111111;border-bottom:2px solid ${accent};${fontBase}">${accessibleLabel} &nearr;</a>`;
    case 'dual-pair': {
      const secHref = safeButtonHref(config.secondaryHref || '#details') || '#';
      const secLabel = escapeHtml((config.secondaryLabel || 'View documentation').trim());
      return `<span style="display:inline-flex;flex-wrap:wrap;gap:10px;align-items:center"><a href="${escapedHref}" style="display:inline-block;padding:${pad};background:${accent};color:${textOnSolid};border:2px solid ${accent};border-radius:${radius};${fontBase}">${accessibleLabel}</a><a href="${escapeHtml(secHref)}" style="display:inline-block;padding:${pad};background:transparent;color:${accent};border:2px solid ${accent};border-radius:${radius};${fontBase}">${secLabel}</a></span>`;
    }
    default: {
      const background = config.variant === 'solid' ? accent : config.variant === 'soft' ? `${accent}1A` : 'transparent';
      const color = config.variant === 'solid' ? textOnSolid : accent;
      const border = config.variant === 'outline' ? `2px solid ${accent}` : '2px solid transparent';
      return `<a href="${escapedHref}" style="display:inline-block;padding:${pad};background:${background};color:${color};border:${border};border-radius:${radius};${fontBase};text-align:center">${accessibleLabel}</a>`;
    }
  }
}

export function buttonEmailVml(config: {
  label: string;
  href: string;
  accent: string;
  size: CtaButtonData['size'];
  corners: CtaButtonData['corners'];
}): string {
  const href = safeButtonHref(config.href);
  if (!href) throw new Error('Use an HTTPS, HTTP, mailto, tel, relative or fragment destination.');
  const accent = normalizeHexColor(config.accent);
  const text = bestButtonTextColor(accent);
  const heightPx = config.size === 'compact' ? 38 : config.size === 'large' ? 52 : 44;
  const widthPx = Math.max(160, Math.min(340, (config.label.trim().length || 10) * 11 + 48));
  const arc = config.corners === 'pill' ? '50%' : config.corners === 'square' ? '6%' : '18%';
  const radius = config.corners === 'pill' ? '999px' : config.corners === 'square' ? '4px' : '10px';
  const label = escapeHtml(config.label.trim() || 'Learn more');
  const escapedHref = escapeHtml(href);

  return `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapedHref}" style="height:${heightPx}px;v-text-anchor:middle;width:${widthPx}px;" arcsize="${arc}" stroke="f" fillcolor="${accent}">
  <w:anchorlock/>
  <center style="color:${text};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${label}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
<a href="${escapedHref}" style="background-color:${accent};border-radius:${radius};color:${text};display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;line-height:${heightPx}px;text-align:center;text-decoration:none;width:${widthPx}px;-webkit-text-size-adjust:none;">${label}</a>
<!--<![endif]-->`;
}

export function buttonCodeExports(config: CtaButtonData): {
  html: string;
  emailVml: string;
  tailwind: string;
  reactComponent: string;
  cssTokens: string;
} {
  const accent = normalizeHexColor(config.accent);
  const text = bestButtonTextColor(accent);
  const soft = softButtonBackground(accent);
  const href = safeButtonHref(config.href) || '#';
  const radiusCls = config.corners === 'pill' ? 'rounded-full' : config.corners === 'square' ? 'rounded' : 'rounded-lg';
  const sizeCls = config.size === 'compact' ? 'px-4 py-2 text-sm' : config.size === 'large' ? 'px-7 py-3.5 text-base' : 'px-5 py-2.5 text-sm';

  return {
    html: buttonHtml(config),
    emailVml: buttonEmailVml(config),
    tailwind: `<a\n  href="${escapeHtml(href)}"\n  style={{ backgroundColor: '${accent}', color: '${text}' }}\n  className="inline-flex items-center justify-center gap-2 ${sizeCls} ${radiusCls} font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"\n>\n  ${escapeHtml(config.label)}\n</a>`,
    reactComponent: `export function CampaignCta({ label = ${JSON.stringify(config.label)}, href = ${JSON.stringify(href)} }) {\n  return (\n    <a\n      href={href}\n      style={{ background: '${accent}', color: '${text}' }}\n      className="inline-flex items-center gap-2 ${sizeCls} ${radiusCls} font-semibold no-underline"\n    >\n      <span>{label}</span>\n      <span aria-hidden="true">→</span>\n    </a>\n  );\n}`,
    cssTokens: `:root {\n  --cta-accent: ${accent};\n  --cta-accent-soft: ${soft};\n  --cta-on-accent: ${text};\n  --cta-radius: ${config.corners === 'pill' ? '999px' : config.corners === 'square' ? '4px' : '10px'};\n}`,
  };
}

// ─── Editorial SVG Diagram Grammar Engine (cathrynlavery/diagram-design v2.6) ─

export function renderEditorialDiagramSvg(diagram: {
  type: MarketingDiagramType;
  title: string;
  subtitle?: string;
  accent: string;
  theme?: 'editorial-light' | 'monograph-dark';
  nodes: MarketingDiagramNode[];
}): string {
  const isDark = diagram.theme === 'monograph-dark';
  const paper = isDark ? '#0F1115' : '#FAFAF7';
  const cardBg = isDark ? '#171A21' : '#FFFFFF';
  const ink = isDark ? '#F3F4F6' : '#141413';
  const muted = isDark ? '#9CA3AF' : '#5E5D59';
  const rule = isDark ? '#2A2F3A' : '#E2E0D8';
  const accent = normalizeHexColor(diagram.accent, '#BF4520');
  const accentSoft = isDark ? `${accent}2E` : softButtonBackground(accent);

  const nodes = diagram.nodes.slice(0, 12);
  const count = Math.max(2, nodes.length);
  const width = 960;
  const height = diagram.type === 'service_blueprint' ? 470 : 430;
  const titleText = escapeHtml(diagram.title || 'Editorial Diagram');
  const subText = escapeHtml(
    diagram.subtitle ||
      `${DIAGRAM_PRESETS.find((p) => p.id === diagram.type)?.category || 'Editorial'} · ${diagram.type.replace(/_/g, '-')}`,
  );

  let bodySvg = '';

  if (diagram.type === 'funnel' || diagram.type === 'pyramid' || diagram.type === 'nested') {
    const inverted = diagram.type === 'pyramid';
    const topY = 98;
    const bandH = Math.floor(285 / count);
    bodySvg = nodes
      .map((n, i) => {
        const ratio = inverted ? (i + 1) / count : 1 - i * (0.52 / Math.max(1, count - 1));
        const w = Math.round(720 * Math.max(0.32, ratio));
        const x = Math.round((width - w) / 2);
        const y = topY + i * bandH;
        const fill = i === 0 ? accent : i % 2 === 0 ? cardBg : accentSoft;
        const fg = i === 0 ? bestButtonTextColor(accent) : ink;
        const subFg = i === 0 ? bestButtonTextColor(accent) : muted;
        return `<g data-node-idx="${i}">
          <rect x="${x}" y="${y}" width="${w}" height="${bandH - 8}" rx="4" fill="${fill}" stroke="${i === 0 ? accent : rule}" stroke-width="1"/>
          <text x="${width / 2}" y="${y + Math.round(bandH * 0.42)}" text-anchor="middle" fill="${fg}" font-size="14" font-weight="700">${escapeHtml(n.title)}${n.metric ? ` · ${escapeHtml(n.metric)}` : ''}</text>
          <text x="${width / 2}" y="${y + Math.round(bandH * 0.72)}" text-anchor="middle" fill="${subFg}" font-size="11.5">${escapeHtml(n.detail.slice(0, 68))}</text>
        </g>`;
      })
      .join('\n');
  } else if (diagram.type === 'quadrant' || diagram.type === 'wardley' || diagram.type === 'scatter') {
    const gx = 90;
    const gy = 96;
    const gw = 780;
    const gh = 290;
    const midX = gx + gw / 2;
    const midY = gy + gh / 2;
    const positions = [
      [gx + gw * 0.25, gy + gh * 0.27],
      [gx + gw * 0.75, gy + gh * 0.27],
      [gx + gw * 0.25, gy + gh * 0.75],
      [gx + gw * 0.75, gy + gh * 0.75],
      [gx + gw * 0.5, gy + gh * 0.5],
      [gx + gw * 0.82, gy + gh * 0.52],
    ];
    bodySvg = `
      <rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" fill="${cardBg}" stroke="${rule}" stroke-width="1"/>
      <line x1="${midX}" y1="${gy}" x2="${midX}" y2="${gy + gh}" stroke="${rule}" stroke-dasharray="4 4"/>
      <line x1="${gx}" y1="${midY}" x2="${gx + gw}" y2="${midY}" stroke="${rule}" stroke-dasharray="4 4"/>
      <text x="${gx + 10}" y="${gy + 18}" fill="${muted}" font-size="10" letter-spacing="0.08em">${diagram.type === 'wardley' ? 'VISIBLE VALUE ↑' : 'HIGH IMPACT ↑'}</text>
      <text x="${gx + gw - 10}" y="${gy + gh - 8}" text-anchor="end" fill="${muted}" font-size="10" letter-spacing="0.08em">${diagram.type === 'wardley' ? 'EVOLUTION (GENESIS → COMMODITY) →' : 'EFFORT / COMPLEXITY →'}</text>
      ${nodes
        .slice(0, 6)
        .map((n, i) => {
          const [cx, cy] = positions[i % positions.length];
          return `<g data-node-idx="${i}">
            <rect x="${cx - 145}" y="${cy - 34}" width="290" height="68" rx="4" fill="${i === 0 ? accentSoft : paper}" stroke="${i === 0 ? accent : rule}" stroke-width="1.2"/>
            <circle cx="${cx - 126}" cy="${cy - 10}" r="5" fill="${accent}"/>
            <text x="${cx - 112}" y="${cy - 6}" fill="${ink}" font-size="13" font-weight="700">${escapeHtml(n.title.slice(0, 32))}</text>
            <text x="${cx - 126}" y="${cy + 16}" fill="${muted}" font-size="11">${escapeHtml(n.detail.slice(0, 42))}</text>
          </g>`;
        })
        .join('\n')}`;
  } else if (diagram.type === 'flywheel' || diagram.type === 'polar' || diagram.type === 'radar' || diagram.type === 'venn') {
    const cx = width / 2;
    const cy = 248;
    const radius = 122;
    bodySvg = `
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${rule}" stroke-width="1.5" stroke-dasharray="5 4"/>
      <circle cx="${cx}" cy="${cy}" r="42" fill="${accentSoft}" stroke="${accent}" stroke-width="1.2"/>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${ink}" font-size="11" font-weight="700">${escapeHtml(diagram.type.toUpperCase())}</text>
      ${nodes
        .map((n, i) => {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
          const nx = Math.round(cx + Math.cos(angle) * (radius + 48));
          const ny = Math.round(cy + Math.sin(angle) * (radius + 22));
          return `<g data-node-idx="${i}">
            <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${rule}" stroke-width="1"/>
            <rect x="${nx - 92}" y="${ny - 24}" width="184" height="48" rx="4" fill="${cardBg}" stroke="${i === 0 ? accent : rule}" stroke-width="1.2"/>
            <text x="${nx}" y="${ny - 4}" text-anchor="middle" fill="${ink}" font-size="12" font-weight="700">${escapeHtml(n.title.slice(0, 24))}</text>
            <text x="${nx}" y="${ny + 13}" text-anchor="middle" fill="${muted}" font-size="10.5">${escapeHtml(n.detail.slice(0, 28))}</text>
          </g>`;
        })
        .join('\n')}`;
  } else if (diagram.type === 'service_blueprint') {
    const colW = Math.floor((width - 140) / count);
    bodySvg = `
      <text x="28" y="135" fill="${muted}" font-size="10" font-weight="700" letter-spacing="0.08em">CUSTOMER</text>
      <text x="28" y="242" fill="${accent}" font-size="10" font-weight="700" letter-spacing="0.08em">FRONTSTAGE</text>
      <line x1="28" y1="305" x2="${width - 28}" y2="305" stroke="${accent}" stroke-width="1.2" stroke-dasharray="6 4"/>
      <text x="${width - 32}" y="299" text-anchor="end" fill="${accent}" font-size="9.5" letter-spacing="0.08em">LINE OF VISIBILITY</text>
      <text x="28" y="365" fill="${muted}" font-size="10" font-weight="700" letter-spacing="0.08em">BACKSTAGE</text>
      ${nodes
        .map((n, i) => {
          const x = 112 + i * colW;
          const w = colW - 10;
          return `<g data-node-idx="${i}">
            <rect x="${x}" y="100" width="${w}" height="68" rx="4" fill="${cardBg}" stroke="${rule}"/>
            <text x="${x + 10}" y="122" fill="${ink}" font-size="12" font-weight="700">${i + 1}. ${escapeHtml(n.title.slice(0, 18))}</text>
            <text x="${x + 10}" y="142" fill="${muted}" font-size="10.5">${escapeHtml(n.detail.slice(0, 24))}</text>
            <rect x="${x}" y="205" width="${w}" height="72" rx="4" fill="${accentSoft}" stroke="${accent}"/>
            <text x="${x + 10}" y="232" fill="${ink}" font-size="11" font-weight="600">${escapeHtml((n.frontstage || 'Visible touchpoint').slice(0, 24))}</text>
            <rect x="${x}" y="330" width="${w}" height="72" rx="4" fill="${cardBg}" stroke="${rule}"/>
            <text x="${x + 10}" y="358" fill="${muted}" font-size="11">${escapeHtml((n.backstage || 'Internal system/SOP').slice(0, 24))}</text>
          </g>`;
        })
        .join('\n')}`;
  } else if (diagram.type === 'bar' || diagram.type === 'gantt' || diagram.type === 'waterfall' || diagram.type === 'sankey') {
    const startY = 104;
    const rowH = Math.floor(285 / count);
    bodySvg = nodes
      .map((n, i) => {
        const y = startY + i * rowH;
        const parsedMetric = parseFloat((n.metric || '').replace(/[^0-9.-]/g, ''));
        const pct = Number.isFinite(parsedMetric) ? Math.min(100, Math.max(12, Math.abs(parsedMetric))) : 90 - i * 14;
        const barW = Math.round((pct / 100) * 500);
        const barX = diagram.type === 'gantt' ? 280 + i * 45 : 280;
        const clampedW = Math.min(barW, width - barX - 60);
        return `<g data-node-idx="${i}">
          <text x="44" y="${y + 20}" fill="${ink}" font-size="13" font-weight="700">${escapeHtml(n.title.slice(0, 28))}</text>
          <text x="44" y="${y + 37}" fill="${muted}" font-size="11">${escapeHtml(n.detail.slice(0, 36))}</text>
          <rect x="280" y="${y + 8}" width="620" height="${Math.max(24, rowH - 22)}" rx="3" fill="${cardBg}" stroke="${rule}"/>
          <rect x="${barX}" y="${y + 8}" width="${clampedW}" height="${Math.max(24, rowH - 22)}" rx="3" fill="${i === 0 ? accent : accentSoft}" stroke="${accent}"/>
          <text x="${barX + clampedW + 10}" y="${y + 25}" fill="${ink}" font-size="12" font-weight="700">${escapeHtml(n.metric || `${pct}%`)}</text>
        </g>`;
      })
      .join('\n');
  } else if (diagram.type === 'layers' || diagram.type === 'medallion' || diagram.type === 'swimlane' || diagram.type === 'axonometric-plan') {
    const startY = 98;
    const bandH = Math.floor(292 / count);
    bodySvg = nodes
      .map((n, i) => {
        const y = startY + i * bandH;
        const skew = diagram.type === 'axonometric-plan' ? i * 14 : 0;
        return `<g data-node-idx="${i}">
          <rect x="${48 + skew}" y="${y}" width="${width - 96 - skew}" height="${bandH - 10}" rx="4" fill="${i === 0 ? accentSoft : cardBg}" stroke="${i === 0 ? accent : rule}" stroke-width="1.2"/>
          <text x="${68 + skew}" y="${y + Math.round(bandH * 0.44)}" fill="${ink}" font-size="13.5" font-weight="700">${escapeHtml(n.title)}</text>
          <text x="${68 + skew}" y="${y + Math.round(bandH * 0.74)}" fill="${muted}" font-size="11.5">${escapeHtml(n.detail)}</text>
          <text x="${width - 68}" y="${y + Math.round(bandH * 0.56)}" text-anchor="end" fill="${accent}" font-size="11" font-weight="700">L0${i + 1}</text>
        </g>`;
      })
      .join('\n');
  } else {
    // Clean multi-column editorial grid / flow with hairline connectors (journey, flow, timeline, architecture, er, sequence, kanban, etc.)
    const cols = Math.min(count, count <= 5 ? count : 3);
    const rows = Math.ceil(count / cols);
    const padX = 44;
    const gapX = 18;
    const cardW = Math.floor((width - padX * 2 - gapX * (cols - 1)) / cols);
    const cardH = rows === 1 ? 210 : 128;
    const startY = rows === 1 ? 132 : 104;

    bodySvg = nodes
      .map((n, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = padX + col * (cardW + gapX);
        const y = startY + row * (cardH + 22);
        const arrow =
          col < cols - 1 && i < count - 1
            ? `<line x1="${x + cardW}" y1="${y + cardH / 2}" x2="${x + cardW + gapX}" y2="${y + cardH / 2}" stroke="${accent}" stroke-width="1.5"/>`
            : '';
        return `<g data-node-idx="${i}">
          <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="4" fill="${cardBg}" stroke="${i === 0 ? accent : rule}" stroke-width="1.2"/>
          <rect x="${x}" y="${y}" width="${cardW}" height="4" fill="${i === 0 ? accent : rule}"/>
          <text x="${x + 14}" y="${y + 26}" fill="${accent}" font-size="10.5" font-weight="700" letter-spacing="0.06em">0${i + 1}${n.group ? ` · ${escapeHtml(n.group.toUpperCase())}` : ''}</text>
          <text x="${x + 14}" y="${y + 50}" fill="${ink}" font-size="13.5" font-weight="700">${escapeHtml(n.title.slice(0, 26))}</text>
          <text x="${x + 14}" y="${y + 76}" fill="${muted}" font-size="11.5">${escapeHtml(n.detail.slice(0, 34))}</text>
          ${n.detail.length > 34 ? `<text x="${x + 14}" y="${y + 94}" fill="${muted}" font-size="11.5">${escapeHtml(n.detail.slice(34, 68))}</text>` : ''}
          ${n.metric ? `<text x="${x + 14}" y="${y + cardH - 14}" fill="${ink}" font-size="12" font-weight="700">${escapeHtml(n.metric)}</text>` : ''}
          ${arrow}
        </g>`;
      })
      .join('\n');
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${titleText}" style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:${paper}">
  <rect width="${width}" height="${height}" fill="${paper}"/>
  <line x1="44" y1="74" x2="${width - 44}" y2="74" stroke="${rule}" stroke-width="1"/>
  <text x="44" y="42" fill="${ink}" font-size="20" font-weight="700" letter-spacing="-0.01em">${titleText}</text>
  <text x="44" y="61" fill="${muted}" font-size="11.5" letter-spacing="0.04em">${subText}</text>
  <rect x="${width - 144}" y="26" width="100" height="24" rx="12" fill="${accentSoft}" stroke="${accent}" stroke-width="1"/>
  <text x="${width - 94}" y="42" text-anchor="middle" fill="${ink}" font-size="10" font-weight="700" letter-spacing="0.06em">EDITORIAL SVG</text>
  ${bodySvg}
  <text x="44" y="${height - 14}" fill="${muted}" font-size="10">MarketingOS Studio · Flat Editorial Grammar (zero decorative shadow)</text>
</svg>`;
}

// ─── Mermaid / Draw.io XML / Excalidraw JSON Importer ────────────────────────

export function importDiagramSourceToNodes(source: string): {
  detectedFormat: 'excalidraw' | 'drawio' | 'mermaid' | 'lines';
  nodes: MarketingDiagramNode[];
} {
  const raw = source.trim();
  if (!raw) {
    return {
      detectedFormat: 'lines',
      nodes: [
        { title: 'Step 1', detail: 'First stage' },
        { title: 'Step 2', detail: 'Second stage' },
      ],
    };
  }

  // Excalidraw JSON
  if (raw.startsWith('{') && raw.includes('"elements"')) {
    try {
      const parsed = JSON.parse(raw) as { elements?: Array<{ type?: string; text?: string }> };
      const texts = (parsed.elements || [])
        .filter((e) => e.type === 'text' && typeof e.text === 'string' && e.text.trim())
        .map((e) => e.text!.trim().replace(/\s+/g, ' '));
      if (texts.length >= 2) {
        return {
          detectedFormat: 'excalidraw',
          nodes: texts.slice(0, 10).map((t, idx) => ({
            title: t.slice(0, 36),
            detail: `Imported from Excalidraw element #${idx + 1}`,
          })),
        };
      }
    } catch {
      // fall through
    }
  }

  // Draw.io / mxGraphModel XML
  if (raw.includes('<mxCell') || raw.includes('<mxfile')) {
    const values = Array.from(raw.matchAll(/\bvalue="([^"]+)"/g))
      .map((m) => m[1].replace(/&lt;[^&]*&gt;/g, ' ').replace(/&amp;/g, '&').trim())
      .filter((v) => v.length >= 2);
    if (values.length >= 2) {
      return {
        detectedFormat: 'drawio',
        nodes: values.slice(0, 10).map((v) => {
          const [head, ...rest] = v.split(/[:—-]/);
          return {
            title: head.trim().slice(0, 36),
            detail: rest.join(' ').trim().slice(0, 80) || 'Imported mxGraph node',
          };
        }),
      };
    }
  }

  // Mermaid flowchart / sequence / mindmap
  if (/^(flowchart|graph|sequenceDiagram|mindmap|timeline|erDiagram)\b/im.test(raw) || raw.includes('-->') || raw.includes('->>')) {
    const bracketLabels = Array.from(raw.matchAll(/[\[({]+([^\](){}]+)[)\]}]+/g)).map((m) => m[1].trim());
    const arrowParts = raw
      .split(/\n+/)
      .flatMap((l) => l.split(/--+>|-+>>/))
      .map((s) => s.replace(/^[A-Za-z0-9_]+\s*/, '').trim())
      .filter((s) => s.length > 2 && !/^(flowchart|graph|sequenceDiagram)/i.test(s));
    const combined = Array.from(new Set([...bracketLabels, ...arrowParts])).filter(Boolean);
    if (combined.length >= 2) {
      return {
        detectedFormat: 'mermaid',
        nodes: combined.slice(0, 10).map((label, idx) => ({
          title: label.slice(0, 36),
          detail: `Stage ${idx + 1} imported from Mermaid graph`,
        })),
      };
    }
  }

  // Plain lines "Title: Detail"
  const lines = raw
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean);
  return {
    detectedFormat: 'lines',
    nodes: (lines.length >= 2 ? lines : [raw, 'Next step']).slice(0, 10).map((line) => {
      const [t, ...rest] = line.split(/[:—–-]/);
      return {
        title: (t || 'Node').trim().slice(0, 36),
        detail: rest.join(' ').trim().slice(0, 90) || 'Semantic diagram node',
      };
    }),
  };
}

// ─── tt-a1i/archify Interactive Standalone HTML Exporter ─────────────────────

export function exportInteractiveArchifyHtml(diagram: {
  type: MarketingDiagramType;
  title: string;
  accent: string;
  theme?: 'editorial-light' | 'monograph-dark';
  nodes: MarketingDiagramNode[];
}): string {
  const svg = renderEditorialDiagramSvg(diagram);
  const safeNodesJson = JSON.stringify(
    diagram.nodes.map((n, idx) => ({
      index: idx + 1,
      title: n.title,
      detail: n.detail,
      frontstage: n.frontstage || null,
      backstage: n.backstage || null,
      metric: n.metric || null,
    })),
  ).replace(/</g, '\\u003c');
  const isDark = diagram.theme === 'monograph-dark';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(diagram.title)} — Interactive Architecture View</title>
<style>
  body { margin:0; font-family: Inter, -apple-system, sans-serif; background:${isDark ? '#0B0D12' : '#F4F3EE'}; color:${isDark ? '#F3F4F6' : '#141413'}; }
  .wrap { max-width: 1220px; margin: 0 auto; padding: 28px 20px; display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
  @media (max-width: 920px) { .wrap { grid-template-columns: 1fr; } }
  .canvas { background:${isDark ? '#0F1115' : '#FAFAF7'}; border:1px solid ${isDark ? '#272B36' : '#DDD9CE'}; border-radius:8px; padding:16px; overflow:auto; }
  .canvas svg { width:100%; height:auto; display:block; }
  .canvas g[data-node-idx] { cursor:pointer; transition: opacity 0.15s ease; }
  .canvas g[data-node-idx]:hover { opacity: 0.86; }
  .inspector { background:${isDark ? '#151922' : '#FFFFFF'}; border:1px solid ${isDark ? '#272B36' : '#DDD9CE'}; border-radius:8px; padding:20px; }
  .tag { display:inline-block; font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; padding:3px 8px; border-radius:999px; background:${normalizeHexColor(diagram.accent)}22; color:${normalizeHexColor(diagram.accent)}; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="canvas" id="diagram-root">${svg}</div>
    <aside class="inspector">
      <span class="tag">Archify Interactive Inspector</span>
      <h2 id="node-title" style="margin:12px 0 6px;font-size:18px;">Click any node to inspect</h2>
      <p id="node-detail" style="margin:0 0 14px;font-size:14px;line-height:1.5;opacity:0.82;">Select a component in the diagram to highlight its stage details, frontstage/backstage actions, and metrics.</p>
      <div id="node-meta" style="font-size:12.5px;border-top:1px solid rgba(128,128,128,0.2);padding-top:12px;"></div>
    </aside>
  </div>
  <script>
    const NODES = ${safeNodesJson};
    document.querySelectorAll('g[data-node-idx]').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = Number(el.getAttribute('data-node-idx'));
        const n = NODES[idx];
        if (!n) return;
        document.getElementById('node-title').textContent = n.index + '. ' + n.title;
        document.getElementById('node-detail').textContent = n.detail;
        const parts = [];
        if (n.metric) parts.push('<p><strong>Metric:</strong> ' + n.metric + '</p>');
        if (n.frontstage) parts.push('<p><strong>Frontstage:</strong> ' + n.frontstage + '</p>');
        if (n.backstage) parts.push('<p><strong>Backstage:</strong> ' + n.backstage + '</p>');
        document.getElementById('node-meta').innerHTML = parts.join('');
      });
    });
  </script>
</body>
</html>`;
}

// ─── Kayforkind/reimagine-it Content-Derived HTML Reimaginer ─────────────────
// "The source file is the design brief — preserve every real heading, number, link & claim without filler."

export interface ReimaginedDirection {
  id: 'swiss-editorial' | 'executive-dark' | 'conversion-split';
  name: string;
  rationale: string;
  html: string;
}

export function reimagineSourceContent(sourceInput: string, accentOverride = '#bf4520'): {
  extractedBrief: {
    title: string;
    headings: string[];
    factsAndMetrics: string[];
    paragraphs: string[];
    links: Array<{ label: string; href: string }>;
    brandColor: string;
  };
  directions: ReimaginedDirection[];
} {
  const raw = sourceInput.trim() || '# Sovereign Marketing Operations\nRun editorial campaigns, CRM enrichment, and $0 free AI workflows from one workspace.\n- 48 SVG diagram grammars\n- 52 marketing skill kits\n- 17 free LLM providers\n[Explore Workspace](/studio)';

  // Extract hex color if present in source HTML/CSS
  const hexMatch = raw.match(/#([0-9a-fA-F]{6})\b/);
  const brandColor = normalizeHexColor(accentOverride || (hexMatch ? `#${hexMatch[1]}` : '#bf4520'));

  // Extract links from HTML <a> or Markdown [label](url)
  const links: Array<{ label: string; href: string }> = [];
  for (const m of raw.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const safe = safeButtonHref(m[1]);
    const label = m[2].replace(/<[^>]+>/g, '').trim();
    if (safe && label) links.push({ label, href: safe });
  }
  for (const m of raw.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    const safe = safeButtonHref(m[2]);
    if (safe && m[1].trim()) links.push({ label: m[1].trim(), href: safe });
  }

  // Strip HTML tags into clean lines while preserving content verbatim
  const plainLines = raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(h[1-6]|p|li|div|section|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n+/)
    .map((l) => l.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const headings: string[] = [];
  const factsAndMetrics: string[] = [];
  const paragraphs: string[] = [];

  for (const line of plainLines) {
    const cleanLine = line.replace(/^#{1,6}\s*/, '').replace(/^[-*•]\s*/, '');
    if (line.startsWith('#') || (cleanLine.length <= 72 && paragraphs.length === 0 && headings.length === 0)) {
      headings.push(cleanLine);
    } else if (/\d+%|\$\d+|£\d+|\b\d+\+?\s+[A-Za-z]+/.test(cleanLine) || line.startsWith('-') || line.startsWith('*') || line.startsWith('•')) {
      factsAndMetrics.push(cleanLine);
    } else {
      paragraphs.push(cleanLine);
    }
  }

  const title = headings[0] || plainLines[0]?.slice(0, 80) || 'Document';
  const subheadings = headings.slice(1, 7);
  const primaryLink = links[0] || { label: 'Continue', href: '#' };

  const renderDirection = (
    id: ReimaginedDirection['id'],
    name: string,
    rationale: string,
    styles: { bg: string; surface: string; ink: string; muted: string; border: string; fontHeading: string },
  ): ReimaginedDirection => {
    const metricsHtml = factsAndMetrics.length
      ? `<section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin:28px 0;">
          ${factsAndMetrics
            .slice(0, 8)
            .map(
              (f) => `<div style="background:${styles.surface};border:1px solid ${styles.border};border-left:3px solid ${brandColor};padding:16px;border-radius:6px;">
                <div style="font-size:14.5px;font-weight:600;color:${styles.ink};line-height:1.45;">${escapeHtml(f)}</div>
              </div>`,
            )
            .join('')}
        </section>`
      : '';

    const bodyHtml = paragraphs
      .slice(0, 10)
      .map((p, idx) => {
        const sub = subheadings[idx] ? `<h2 style="font-family:${styles.fontHeading};font-size:20px;margin:24px 0 8px;color:${styles.ink};">${escapeHtml(subheadings[idx])}</h2>` : '';
        return `${sub}<p style="font-size:16px;line-height:1.7;color:${styles.muted};margin:0 0 14px;">${escapeHtml(p)}</p>`;
      })
      .join('');

    const linksHtml = links.length
      ? `<div style="margin-top:28px;display:flex;flex-wrap:wrap;gap:12px;">
          ${links
            .slice(0, 4)
            .map((l, i) =>
              i === 0
                ? buttonHtml({ label: l.label, href: l.href, accent: brandColor, variant: 'solid', size: 'standard', corners: 'rounded' })
                : buttonHtml({ label: l.label, href: l.href, accent: brandColor, variant: 'outline', size: 'standard', corners: 'rounded' }),
            )
            .join('')}
        </div>`
      : `<div style="margin-top:24px;">${buttonHtml({ label: primaryLink.label, href: primaryLink.href, accent: brandColor, variant: 'solid', size: 'standard', corners: 'rounded' })}</div>`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;background:${styles.bg};color:${styles.ink};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <main style="max-width:960px;margin:0 auto;padding:56px 24px;">
    <div style="display:inline-block;padding:4px 10px;border:1px solid ${brandColor};color:${brandColor};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-radius:999px;margin-bottom:16px;">${escapeHtml(name)}</div>
    <h1 style="font-family:${styles.fontHeading};font-size:clamp(28px,4vw,44px);line-height:1.12;letter-spacing:-0.02em;margin:0 0 18px;color:${styles.ink};">${escapeHtml(title)}</h1>
    ${metricsHtml}
    <article>${bodyHtml}</article>
    ${linksHtml}
  </main>
</body>
</html>`;
    return { id, name, rationale, html };
  };

  return {
    extractedBrief: {
      title,
      headings,
      factsAndMetrics,
      paragraphs,
      links,
      brandColor,
    },
    directions: [
      renderDirection('swiss-editorial', 'Direction A · Swiss Editorial Paper', 'Warm stone paper (#FAFAF7), serif display typography, 1px hairline rules, zero invented copy.', {
        bg: '#FAFAF7',
        surface: '#FFFFFF',
        ink: '#141413',
        muted: '#4A4945',
        border: '#E2E0D8',
        fontHeading: "Georgia,'Times New Roman',serif",
      }),
      renderDirection('executive-dark', 'Direction B · Executive Dark Monograph', 'Obsidian canvas (#0B0D12) with high-contrast metric callout cards for technical & enterprise buyers.', {
        bg: '#0B0D12',
        surface: '#141821',
        ink: '#F9FAFB',
        muted: '#9CA3AF',
        border: '#252B38',
        fontHeading: "Inter,-apple-system,sans-serif",
      }),
      renderDirection('conversion-split', 'Direction C · Crisp Conversion Brief', 'High-clarity scannable brief prioritizing extracted proof numbers and direct action.', {
        bg: '#F8FAFC',
        surface: '#FFFFFF',
        ink: '#0F172A',
        muted: '#475569',
        border: '#CBD5E1',
        fontHeading: "Inter,-apple-system,sans-serif",
      }),
    ],
  };
}
