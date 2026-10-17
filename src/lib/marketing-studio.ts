export type MarketingAssetType = 'marketing_kit' | 'marketing_diagram' | 'cta_button';
export type MarketingKitType = 'product_launch' | 'lead_magnet' | 'webinar' | 'retention' | 'education_enrollment' | 'seo_content_brief' | 'cro_experiment' | 'case_study' | 'referral_campaign';
export type MarketingDiagramType = 'journey' | 'flow' | 'funnel' | 'timeline' | 'quadrant' | 'flywheel' | 'service_blueprint';

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
  };
}

export interface MarketingDiagramNode {
  title: string;
  detail: string;
  frontstage?: string;
  backstage?: string;
}

export interface MarketingDiagramData {
  version: 1;
  type: MarketingDiagramType;
  title: string;
  accent: string;
  paper?: string;
  ink?: string;
  muted?: string;
  nodes: MarketingDiagramNode[];
}

export interface CtaButtonData {
  version: 1;
  label: string;
  href: string;
  accent: string;
  variant: 'solid' | 'outline' | 'soft';
  size: 'compact' | 'standard' | 'large';
  corners: 'square' | 'rounded' | 'pill';
}

export const KIT_TYPES: Array<{ value: MarketingKitType; label: string; description: string }> = [
  { value: 'product_launch', label: 'Product launch', description: 'Positioning, landing page, email, social and ads' },
  { value: 'lead_magnet', label: 'Lead magnet', description: 'A useful offer and opt-in campaign starter' },
  { value: 'webinar', label: 'Event or webinar', description: 'Registration messaging and event promotion' },
  { value: 'retention', label: 'Retention', description: 'A considerate re-engagement campaign' },
  { value: 'education_enrollment', label: 'Education enrollment', description: 'An admissions or study-abroad information campaign' },
  { value: 'seo_content_brief', label: 'SEO content brief', description: 'Search intent, useful page structure, evidence and organic KPIs' },
  { value: 'cro_experiment', label: 'CRO experiment', description: 'A testable hypothesis, one primary metric and guardrails' },
  { value: 'case_study', label: 'Customer case study', description: 'Evidence-led customer story with claims held for review' },
  { value: 'referral_campaign', label: 'Referral campaign', description: 'A transparent referral offer with eligibility and opt-out checks' },
];

export const DIAGRAM_PRESETS: Array<{
  id: MarketingDiagramType;
  title: string;
  nodes: MarketingDiagramNode[];
}> = [
  {
    id: 'journey',
    title: 'Customer journey',
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
    nodes: [
      { title: 'Reach', detail: 'Qualified awareness' },
      { title: 'Engage', detail: 'Useful interactions' },
      { title: 'Consider', detail: 'Evidence and comparison' },
      { title: 'Convert', detail: 'Clear, low-friction action' },
      { title: 'Retain', detail: 'Follow-up and value' },
    ],
  },
  {
    id: 'timeline',
    title: 'Launch timeline',
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
    nodes: [
      { title: 'Discover', detail: 'Learns about the service', frontstage: 'Helpful landing page', backstage: 'Source and claims review' },
      { title: 'Enquire', detail: 'Asks a question', frontstage: 'Acknowledged response', backstage: 'Assign owner and response target' },
      { title: 'Evaluate', detail: 'Compares options', frontstage: 'Clear evidence and terms', backstage: 'Check eligibility and availability' },
      { title: 'Convert', detail: 'Chooses a next step', frontstage: 'Accessible form or booking', backstage: 'Confirm consent and route request' },
      { title: 'Onboard', detail: 'Starts the relationship', frontstage: 'Set expectations', backstage: 'Record outcome and follow-up date' },
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
  const typeLabel = KIT_TYPES.find((item) => item.value === form.type)?.label || 'Campaign';
  let heroHeadline: string;
  let primaryCta: string;
  let emailSubject: string;

  switch (form.type) {
    case 'lead_magnet':
      heroHeadline = form.offer.startsWith('[') ? `A practical resource for ${form.audience}` : `Get ${form.offer}`;
      primaryCta = 'Get the resource';
      emailSubject = `Your ${form.offer.startsWith('[') ? 'resource' : form.offer} is ready`;
      break;
    case 'webinar':
      heroHeadline = `Join ${form.brand} for ${form.product}`;
      primaryCta = 'Save your place';
      emailSubject = `You're invited: ${form.product}`;
      break;
    case 'retention':
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
      heroHeadline = `A practical guide to ${form.product}`;
      primaryCta = 'Read the guide';
      emailSubject = `A useful guide from ${form.brand}`;
      break;
    case 'cro_experiment':
      heroHeadline = `Test a clearer next step for ${form.audience}`;
      primaryCta = 'Review the experiment';
      emailSubject = `Experiment brief: ${form.product}`;
      break;
    case 'case_study':
      heroHeadline = `A customer story about ${form.product}`;
      primaryCta = 'Read the case study';
      emailSubject = `A customer story from ${form.brand}`;
      break;
    case 'referral_campaign':
      heroHeadline = `Share ${form.product} with someone who could benefit`;
      primaryCta = 'Invite a colleague';
      emailSubject = `A thoughtful invitation from ${form.brand}`;
      break;
    default:
      heroHeadline = `${form.product}: a clear next step for ${form.audience}`;
      primaryCta = `Explore ${form.product}`;
      emailSubject = `Introducing ${form.product}`;
  }

  const proofLine = form.proof.startsWith('[')
    ? 'Add a verified customer quote, result or credential here before publishing.'
    : `Evidence to review: ${form.proof}`;
  const offerLine = form.offer.startsWith('[') ? 'Add the specific offer, price or next step.' : `Offer: ${form.offer}`;
  const primaryKpi = form.type === 'seo_content_brief'
    ? 'Qualified organic visits that reach the intended next step; search volume alone is not success'
    : form.type === 'cro_experiment'
      ? 'Pre-registered primary conversion rate for the tested audience and period'
      : form.type === 'case_study'
        ? 'Qualified requests influenced by the case study, using a defined attribution window'
        : form.type === 'referral_campaign'
          ? 'Eligible, consented referrals that complete the defined next step'
          : 'Choose one primary conversion event before launch';
  const guardrails = form.type === 'cro_experiment'
    ? ['Define audience, randomization, sample size and stopping rule before launch', 'Monitor guardrail metrics and adverse effects', 'Do not call a result conclusive before the planned analysis']
    : form.type === 'referral_campaign'
      ? ['Publish eligibility, reward and expiry terms', 'Respect consent and opt-out preferences', 'Monitor fraud, complaints and incentive cost']
      : ['Cost or effort per qualified outcome', 'Unsubscribe or opt-out rate', 'Negative feedback and complaint rate'];
  const reviewNote = form.type === 'seo_content_brief'
    ? 'Template-based content brief, not live SEO data. Verify search intent, sources, facts and claims; no ranking or traffic estimate is included.'
    : form.type === 'cro_experiment'
      ? 'Planning template only. Pre-register a valid experiment design and review results; no conversion lift is predicted.'
      : form.type === 'case_study'
        ? 'Do not publish an outcome, quote, logo or customer name without verifiable evidence and written permission.'
        : form.type === 'referral_campaign'
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
  const outputStrings: Array<keyof Omit<MarketingKitData['outputs'], 'benefitBullets' | 'channelPlan' | 'guardrails'>> = [
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
  const validTypes: MarketingDiagramType[] = ['journey', 'flow', 'funnel', 'timeline', 'quadrant', 'flywheel', 'service_blueprint'];
  if (candidate.version !== 1 || typeof candidate.type !== 'string' || !validTypes.includes(candidate.type as MarketingDiagramType)) return false;
  if (typeof candidate.title !== 'string' || typeof candidate.accent !== 'string' || !Array.isArray(candidate.nodes) || candidate.nodes.length < 2 || candidate.nodes.length > 6) return false;
  if ([candidate.paper, candidate.ink, candidate.muted].some((color) => color !== undefined && typeof color !== 'string')) return false;
  return candidate.nodes.every((node) => !!node && typeof node === 'object' && typeof node.title === 'string' && typeof node.detail === 'string' &&
    (node.frontstage === undefined || typeof node.frontstage === 'string') &&
    (node.backstage === undefined || typeof node.backstage === 'string'));
}

export function isCtaButtonData(value: unknown): value is CtaButtonData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CtaButtonData>;
  return candidate.version === 1 && typeof candidate.label === 'string' && typeof candidate.href === 'string' && typeof candidate.accent === 'string' &&
    ['solid', 'outline', 'soft'].includes(candidate.variant || '') &&
    ['compact', 'standard', 'large'].includes(candidate.size || '') &&
    ['square', 'rounded', 'pill'].includes(candidate.corners || '');
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

function escapeHtml(value: string): string {
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
  variant: CtaButtonData['variant'];
  size: CtaButtonData['size'];
  corners: CtaButtonData['corners'];
}): string {
  const href = safeButtonHref(config.href);
  if (!href) throw new Error('Use an HTTPS, HTTP, mailto, tel, relative or fragment destination.');

  const accent = normalizeHexColor(config.accent);
  const pad = config.size === 'compact' ? '9px 16px' : config.size === 'large' ? '15px 26px' : '12px 20px';
  const radius = config.corners === 'pill' ? '999px' : config.corners === 'square' ? '4px' : '10px';
  const text = bestButtonTextColor(accent);
  const background = config.variant === 'solid' ? accent : config.variant === 'soft' ? `${accent}1A` : 'transparent';
  const color = config.variant === 'solid' ? text : accent;
  const border = config.variant === 'outline' ? `2px solid ${accent}` : '2px solid transparent';
  const accessibleLabel = escapeHtml(config.label.trim() || 'Learn more');

  return `<a href="${escapeHtml(href)}" style="display:inline-block;padding:${pad};background:${background};color:${color};border:${border};border-radius:${radius};font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;line-height:1.2;text-align:center;text-decoration:none">${accessibleLabel}</a>`;
}
