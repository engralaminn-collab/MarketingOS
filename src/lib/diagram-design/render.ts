// Diagram Design renderer: JSON spec → self-contained editorial SVG.
//
// Implements eight layout grammars from the Diagram Design system
// (cathrynlavery/diagram-design, MIT): flowchart, architecture, sequence, quadrant,
// timeline, bar, waterfall, funnel. Rules enforced here:
//   - no shadows, max radius 6px, every coordinate on a 4px grid
//   - accent is for focal elements only (`kind: "focal"` nodes, highlighted points/bars)
//   - all text is XML-escaped; the SVG has no scripts and no external references

import { FONTS, RADIUS, STROKE, TOKENS, type DiagramTokens, type ThemeName } from './tokens';

export type NodeKind = 'focal' | 'backend' | 'store' | 'external' | 'input' | 'optional' | 'security';

export interface DNode {
  id: string;
  label: string;
  sub?: string;
  kind?: NodeKind;
}

export interface DEdge {
  from: string;
  to: string;
  label?: string;
}

export type DiagramSpec =
  | { type: 'flowchart'; title?: string; subtitle?: string; nodes: DNode[]; edges: DEdge[] }
  | { type: 'architecture'; title?: string; subtitle?: string; layers: { name: string; nodes: DNode[] }[] }
  | {
      type: 'sequence';
      title?: string;
      subtitle?: string;
      actors: string[];
      messages: { from: string; to: string; label: string; kind?: 'sync' | 'async' | 'return' }[];
    }
  | {
      type: 'quadrant';
      title?: string;
      subtitle?: string;
      xAxis: [string, string];
      yAxis: [string, string];
      quadrants?: [string, string, string, string];
      points: { label: string; x: number; y: number; focal?: boolean }[];
    }
  | { type: 'timeline'; title?: string; subtitle?: string; events: { date: string; label: string; sub?: string; focal?: boolean }[] }
  | { type: 'bar'; title?: string; subtitle?: string; unit?: string; items: { label: string; value: number; focal?: boolean }[] }
  | {
      type: 'waterfall';
      title?: string;
      subtitle?: string;
      start: { label: string; value: number };
      steps: { label: string; delta: number }[];
      endLabel?: string;
    }
  | { type: 'funnel'; title?: string; subtitle?: string; stages: { label: string; value: number }[] };

export const DIAGRAM_TYPES: { id: DiagramSpec['type']; label: string; hint: string }[] = [
  { id: 'flowchart', label: 'Flowchart', hint: 'Decision logic with branches' },
  { id: 'architecture', label: 'Architecture', hint: 'Stacked layers of systems' },
  { id: 'sequence', label: 'Sequence', hint: 'Time-ordered messages between actors' },
  { id: 'quadrant', label: 'Quadrant', hint: 'Two-axis positioning and prioritisation' },
  { id: 'timeline', label: 'Timeline', hint: 'Events positioned in order' },
  { id: 'bar', label: 'Bar chart', hint: 'Quantitative comparison across categories' },
  { id: 'waterfall', label: 'Waterfall', hint: 'Start total bridged to end total' },
  { id: 'funnel', label: 'Funnel', hint: 'Conversion drop-off by stage' },
];

// ─── Example specs (one per type) ───────────────────────────────────────────

export const EXAMPLE_SPECS: Record<DiagramSpec['type'], DiagramSpec> = {
  flowchart: {
    type: 'flowchart',
    title: 'Lead routing',
    subtitle: 'How an inbound form fill becomes a sales task',
    nodes: [
      { id: 'form', label: 'Form submitted', sub: 'POST /api/leads', kind: 'input' },
      { id: 'score', label: 'Score lead', sub: 'fit + intent', kind: 'backend' },
      { id: 'hot', label: 'Hot lead?', kind: 'focal' },
      { id: 'sdr', label: 'Assign to SDR', sub: 'round robin', kind: 'backend' },
      { id: 'nurture', label: 'Nurture sequence', kind: 'optional' },
      { id: 'crm', label: 'CRM record', sub: 'Lead table', kind: 'store' },
    ],
    edges: [
      { from: 'form', to: 'score' },
      { from: 'score', to: 'hot' },
      { from: 'hot', to: 'sdr', label: 'yes' },
      { from: 'hot', to: 'nurture', label: 'no' },
      { from: 'sdr', to: 'crm' },
      { from: 'nurture', to: 'crm' },
    ],
  },
  architecture: {
    type: 'architecture',
    title: 'MarketingOS architecture',
    subtitle: 'Where each capability runs',
    layers: [
      { name: 'Clients', nodes: [{ id: 'web', label: 'Web app', sub: 'Next.js', kind: 'input' }, { id: 'mail', label: 'Inbox', sub: 'Gmail API', kind: 'external' }] },
      { name: 'Services', nodes: [{ id: 'api', label: 'API routes', sub: '/api/*', kind: 'focal' }, { id: 'ai', label: 'AI agents', sub: 'LLM calls', kind: 'backend' }, { id: 'sms', label: 'SMS gateway', kind: 'external' }] },
      { name: 'Data', nodes: [{ id: 'db', label: 'Prisma store', sub: 'SQLite / MySQL', kind: 'store' }, { id: 'files', label: 'Media files', kind: 'store' }] },
    ],
  },
  sequence: {
    type: 'sequence',
    title: 'Password reset',
    subtitle: 'Happy path, one retry',
    actors: ['User', 'Web app', 'Auth API', 'Mailer'],
    messages: [
      { from: 'User', to: 'Web app', label: 'Request reset' },
      { from: 'Web app', to: 'Auth API', label: 'POST /reset' },
      { from: 'Auth API', to: 'Mailer', label: 'Send token', kind: 'async' },
      { from: 'Mailer', to: 'User', label: 'Email with link', kind: 'async' },
      { from: 'User', to: 'Web app', label: 'Open link + new password' },
      { from: 'Web app', to: 'Auth API', label: 'Confirm token', kind: 'sync' },
      { from: 'Auth API', to: 'Web app', label: 'Session issued', kind: 'return' },
    ],
  },
  quadrant: {
    type: 'quadrant',
    title: 'Channel priorities',
    subtitle: 'Reach against effort to run',
    xAxis: ['Low effort', 'High effort'],
    yAxis: ['Low reach', 'High reach'],
    quadrants: ['Quick wins', 'Big bets', 'Fill-ins', 'Hard slogs'],
    points: [
      { label: 'Email', x: 0.2, y: 0.8, focal: true },
      { label: 'SEO', x: 0.75, y: 0.85 },
      { label: 'Podcasts', x: 0.8, y: 0.3 },
      { label: 'Webinars', x: 0.5, y: 0.55 },
      { label: 'Cold DMs', x: 0.25, y: 0.2 },
    ],
  },
  timeline: {
    type: 'timeline',
    title: 'Launch timeline',
    subtitle: 'Milestones in order',
    events: [
      { date: 'Q1', label: 'Private beta', sub: '20 teams' },
      { date: 'Q2', label: 'Public launch', sub: 'Pricing live', focal: true },
      { date: 'Q3', label: 'SMS + VoIP', sub: 'Channels added' },
      { date: 'Q4', label: 'Marketplace', sub: 'Partner kits' },
    ],
  },
  bar: {
    type: 'bar',
    title: 'Monthly signups',
    subtitle: 'Last six months',
    unit: 'signups',
    items: [
      { label: 'May', value: 120 },
      { label: 'Jun', value: 180 },
      { label: 'Jul', value: 150 },
      { label: 'Aug', value: 240, focal: true },
      { label: 'Sep', value: 210 },
      { label: 'Oct', value: 265 },
    ],
  },
  waterfall: {
    type: 'waterfall',
    title: 'Pipeline bridge',
    subtitle: 'Opening pipeline to closing pipeline',
    start: { label: 'Opening', value: 500 },
    steps: [
      { label: 'New deals', delta: 220 },
      { label: 'Won', delta: -140 },
      { label: 'Lost', delta: -90 },
      { label: 'Expansion', delta: 75 },
    ],
    endLabel: 'Closing',
  },
  funnel: {
    type: 'funnel',
    title: 'Signup funnel',
    subtitle: 'Visitors to paying teams',
    stages: [
      { label: 'Visitors', value: 12000 },
      { label: 'Signups', value: 2400 },
      { label: 'Activated', value: 960 },
      { label: 'Paying', value: 210 },
    ],
  },
};

// ─── Text measurement (Diagram Design width budget) ─────────────────────────

function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff)
  );
}

/** Width in px: wide glyphs cost 1em, others their face's Latin advance (0.60 sans / 0.62 mono). */
export function textWidth(s: string, size: number, mono = false): number {
  let em = 0;
  for (const ch of s) {
    if (/\p{M}/u.test(ch)) continue;
    em += isWide(ch.codePointAt(0)!) ? 1 : mono ? 0.62 : 0.6;
  }
  return Math.ceil(em * size);
}

const up4 = (n: number) => Math.ceil(n / 4) * 4;

// ─── Small SVG helpers ──────────────────────────────────────────────────────

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nodeStyle(kind: NodeKind | undefined, t: DiagramTokens): { fill: string; stroke: string; dash?: string; sw: number } {
  switch (kind) {
    case 'focal':
      return { fill: t.accentTint, stroke: t.accent, sw: STROKE.strong };
    case 'store':
      return { fill: t.rule, stroke: t.muted, sw: STROKE.default };
    case 'external':
      return { fill: t.rule, stroke: t.soft, sw: STROKE.default };
    case 'input':
      return { fill: t.rule, stroke: t.soft, sw: STROKE.default };
    case 'optional':
      return { fill: 'none', stroke: t.soft, dash: '4,3', sw: STROKE.default };
    case 'security':
      return { fill: t.accentTint, stroke: t.accent, dash: '4,4', sw: STROKE.default };
    case 'backend':
    default:
      return { fill: t.backendFill, stroke: t.ink, sw: STROKE.default };
  }
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawNode(n: DNode, b: Box, t: DiagramTokens, mono: string, sans: string): string {
  const s = nodeStyle(n.kind, t);
  const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : '';
  const parts = [
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${RADIUS.md}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.sw}"${dash}/>`,
  ];
  const cx = b.x + b.w / 2;
  if (n.sub) {
    parts.push(`<text x="${cx}" y="${b.y + 20}" text-anchor="middle" font-family="${sans}" font-size="12" font-weight="600" fill="${t.ink}">${esc(n.label)}</text>`);
    parts.push(`<text x="${cx}" y="${b.y + 36}" text-anchor="middle" font-family="${mono}" font-size="9" fill="${t.soft}">${esc(n.sub)}</text>`);
  } else {
    parts.push(`<text x="${cx}" y="${b.y + b.h / 2 + 4}" text-anchor="middle" font-family="${sans}" font-size="12" font-weight="600" fill="${t.ink}">${esc(n.label)}</text>`);
  }
  return parts.join('');
}

/** Arrow-label with a paper-coloured mask so the line never bleeds through the text. */
function maskedLabel(x: number, y: number, text: string, t: DiagramTokens, mono: string): string {
  const w = up4(textWidth(text, 8, true) + 12);
  return (
    `<rect x="${x - w / 2}" y="${y - 8}" width="${w}" height="16" rx="${RADIUS.sm}" fill="${t.paper}"/>` +
    `<text x="${x}" y="${y + 3}" text-anchor="middle" font-family="${mono}" font-size="8" letter-spacing="0.5" fill="${t.muted}">${esc(text)}</text>`
  );
}

function arrowMarker(id: string, color: string): string {
  return `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`;
}

// ─── Layouts ────────────────────────────────────────────────────────────────

interface Canvas {
  width: number;
  height: number;
  body: string;
}

function header(spec: { title?: string; subtitle?: string }, t: DiagramTokens, serif: string, sans: string, x = 48): { svg: string; top: number } {
  let svg = '';
  let top = 40;
  if (spec.title) {
    svg += `<text x="${x}" y="56" font-family="${serif}" font-size="28" fill="${t.ink}">${esc(spec.title)}</text>`;
    top = 96;
  }
  if (spec.subtitle) {
    svg += `<text x="${x}" y="${spec.title ? 80 : 40}" font-family="${serif}" font-style="italic" font-size="14" fill="${t.muted}">${esc(spec.subtitle)}</text>`;
  }
  void sans;
  return { svg, top };
}

function flowchart(spec: Extract<DiagramSpec, { type: 'flowchart' }>, t: DiagramTokens, mono: string, sans: string, serif: string): Canvas {
  const PAD = 48;
  const { svg: head, top } = header(spec, t, serif, sans, PAD);
  const nodes = spec.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rank = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let i = 0; i < nodes.length; i++) {
    let changed = false;
    for (const e of spec.edges) {
      if (!byId.has(e.from) || !byId.has(e.to) || e.from === e.to) continue;
      const r = (rank.get(e.from) ?? 0) + 1;
      if (r > (rank.get(e.to) ?? 0) && r < nodes.length) {
        rank.set(e.to, r);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const maxRank = Math.max(0, ...Array.from(rank.values()));
  const columns: DNode[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const n of nodes) columns[rank.get(n.id) ?? 0].push(n);

  const sizes = new Map<string, { w: number; h: number }>();
  for (const n of nodes) {
    const w = Math.max(144, up4(Math.max(textWidth(n.label, 12), n.sub ? textWidth(n.sub, 9, true) : 0) + 32));
    sizes.set(n.id, { w, h: n.sub ? 52 : 40 });
  }
  const colW = columns.map((c) => Math.max(0, ...c.map((n) => sizes.get(n.id)!.w)));
  const GAP_X = 96;
  const GAP_Y = 28;
  const colH = columns.map((c) => c.reduce((s, n, i) => s + sizes.get(n.id)!.h + (i ? GAP_Y : 0), 0));
  const contentH = Math.max(0, ...colH);

  const boxes = new Map<string, Box>();
  let x = PAD;
  columns.forEach((col, ci) => {
    let y = top + Math.round((contentH - colH[ci]) / 2 / 4) * 4;
    for (const n of col) {
      const s = sizes.get(n.id)!;
      boxes.set(n.id, { x, y, w: s.w, h: s.h });
      y += s.h + GAP_Y;
    }
    x += colW[ci] + GAP_X;
  });
  const width = Math.max(x - GAP_X + PAD, 640);
  const height = top + contentH + 96;

  const edgesSvg: string[] = [];
  const labels: string[] = [];
  const backLaneY = top + contentH + 40;
  for (const e of spec.edges) {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    if (!a || !b) continue;
    const forward = (rank.get(e.to) ?? 0) > (rank.get(e.from) ?? 0);
    let d: string;
    let lx: number;
    let ly: number;
    if (forward) {
      const x1 = a.x + a.w;
      const y1 = a.y + a.h / 2;
      const x2 = b.x;
      const y2 = b.y + b.h / 2;
      const mx = Math.round(((x1 + x2) / 2) / 4) * 4;
      d = `M${x1} ${y1} H${mx} V${y2} H${x2}`;
      lx = mx;
      ly = (y1 + y2) / 2;
    } else {
      // Back edge: route below the diagram so it never crosses a node.
      const x1 = a.x + a.w / 2;
      const y1 = a.y + a.h;
      const x2 = b.x + b.w / 2;
      const y2 = b.y + b.h;
      d = `M${x1} ${y1} V${backLaneY} H${x2} V${y2}`;
      lx = (x1 + x2) / 2;
      ly = backLaneY;
    }
    edgesSvg.push(`<path d="${d}" fill="none" stroke="${t.muted}" stroke-width="${STROKE.default}" marker-end="url(#arr)"/>`);
    if (e.label) labels.push(maskedLabel(lx, ly - (forward ? 6 : 0), e.label, t, mono));
  }

  const nodesSvg = nodes.map((n) => drawNode(n, boxes.get(n.id)!, t, mono, sans)).join('');
  const defs = `<defs>${arrowMarker('arr', t.muted)}</defs>`;
  const finalH = Math.max(height, boxes.size ? backLaneY + 40 : height);
  return { width, height: finalH, body: defs + head + edgesSvg.join('') + nodesSvg + labels.join('') };
}

function architecture(spec: Extract<DiagramSpec, { type: 'architecture' }>, t: DiagramTokens, mono: string, sans: string, serif: string): Canvas {
  const PAD = 48;
  const { svg: head, top } = header(spec, t, serif, sans, PAD);
  const width = 960;
  const innerW = width - PAD * 2;
  let y = top;
  let body = head;
  for (const layer of spec.layers) {
    const nodeWs = layer.nodes.map((n) => Math.max(144, up4(Math.max(textWidth(n.label, 12), n.sub ? textWidth(n.sub, 9, true) : 0) + 32)));
    const rowW = nodeWs.reduce((s, w) => s + w, 0) + 16 * Math.max(0, nodeWs.length - 1);
    const bandH = 92;
    body += `<rect x="${PAD}" y="${y}" width="${innerW}" height="${bandH}" rx="${RADIUS.lg}" fill="none" stroke="${t.rule.replace('0.12', '0.25')}" stroke-width="${STROKE.thin}"/>`;
    body += `<text x="${PAD + 16}" y="${y + 20}" font-family="${mono}" font-size="8" letter-spacing="1.4" fill="${t.soft}">${esc(layer.name.toUpperCase())}</text>`;
    let x = PAD + (innerW - rowW) / 2;
    layer.nodes.forEach((n, i) => {
      const w = nodeWs[i];
      body += drawNode(n, { x: Math.round(x), y: y + 32, w, h: 48 }, t, mono, sans);
      x += w + 16;
    });
    y += bandH + 24;
  }
  const defs = '';
  return { width, height: y - 24 + 48, body: defs + body };
}

function sequence(spec: Extract<DiagramSpec, { type: 'sequence' }>, t: DiagramTokens, mono: string, sans: string, serif: string): Canvas {
  const PAD = 48;
  const { svg: head, top } = header(spec, t, serif, sans, PAD);
  const n = Math.max(1, spec.actors.length);
  const width = 960;
  const colW = (width - PAD * 2) / n;
  const boxW = 136;
  const boxH = 36;
  const x = (i: number) => Math.round(PAD + colW * i + colW / 2);
  const idx = new Map(spec.actors.map((a, i) => [a, i]));
  const lifeTop = top + boxH;
  const msgGap = 48;
  const lifeBottom = lifeTop + 48 + spec.messages.length * msgGap;
  let body = head;
  body += `<defs>${arrowMarker('arr', t.muted)}${arrowMarker('arrf', t.ink)}</defs>`;
  spec.actors.forEach((a, i) => {
    body += `<line x1="${x(i)}" y1="${lifeTop}" x2="${x(i)}" y2="${lifeBottom}" stroke="${t.soft}" stroke-width="${STROKE.thin}" stroke-dasharray="4,4"/>`;
    body += `<rect x="${x(i) - boxW / 2}" y="${top}" width="${boxW}" height="${boxH}" rx="${RADIUS.md}" fill="${t.backendFill}" stroke="${t.ink}" stroke-width="${STROKE.default}"/>`;
    body += `<text x="${x(i)}" y="${top + 22}" text-anchor="middle" font-family="${sans}" font-size="12" font-weight="600" fill="${t.ink}">${esc(a)}</text>`;
  });
  spec.messages.forEach((m, i) => {
    const y = lifeTop + 48 + i * msgGap;
    const a = idx.get(m.from) ?? 0;
    const b = idx.get(m.to) ?? 0;
    const kind = m.kind ?? 'sync';
    const dash = kind === 'return' || kind === 'async' ? ' stroke-dasharray="6,4"' : '';
    const color = kind === 'return' ? t.soft : t.muted;
    const marker = kind === 'async' ? '' : ` marker-end="url(#${kind === 'sync' ? 'arrf' : 'arr'})"`;
    if (a === b) {
      body += `<path d="M${x(a)} ${y} H${x(a) + 40} V${y + 20} H${x(a)}" fill="none" stroke="${color}" stroke-width="${STROKE.default}"${dash}${marker}/>`;
      body += `<text x="${x(a) + 48}" y="${y + 4}" font-family="${sans}" font-size="12" fill="${t.ink}">${esc(m.label)}</text>`;
    } else {
      body += `<line x1="${x(a)}" y1="${y}" x2="${x(b)}" y2="${y}" stroke="${color}" stroke-width="${STROKE.default}"${dash}${marker}/>`;
      const mid = (x(a) + x(b)) / 2;
      body += `<text x="${mid}" y="${y - 8}" text-anchor="middle" font-family="${sans}" font-size="12" fill="${t.ink}">${esc(m.label)}</text>`;
    }
  });
  return { width, height: lifeBottom + 48, body };
}

function quadrant(spec: Extract<DiagramSpec, { type: 'quadrant' }>, t: DiagramTokens, mono: string, sans: string, serif: string): Canvas {
  const PAD = 48;
  const { svg: head, top } = header(spec, t, serif, sans, PAD);
  const size = 520;
  const left = PAD + 72;
  const topY = top + 24;
  const width = 960;
  const height = topY + size + 96;
  const half = size / 2;
  let body = head;
  body += `<rect x="${left}" y="${topY}" width="${size}" height="${size}" fill="none" stroke="${t.ruleSolid}" stroke-width="${STROKE.default}"/>`;
  body += `<line x1="${left + half}" y1="${topY}" x2="${left + half}" y2="${topY + size}" stroke="${t.ruleSolid}" stroke-width="${STROKE.thin}"/>`;
  body += `<line x1="${left}" y1="${topY + half}" x2="${left + size}" y2="${topY + half}" stroke="${t.ruleSolid}" stroke-width="${STROKE.thin}"/>`;
  const qn = spec.quadrants ?? ['', '', '', ''];
  const qLabels: [string, number, number, string][] = [
    [qn[0], left + 12, topY + 20, 'start'],
    [qn[1], left + size - 12, topY + 20, 'end'],
    [qn[2], left + 12, topY + size - 12, 'start'],
    [qn[3], left + size - 12, topY + size - 12, 'end'],
  ];
  for (const [label, x, y, anchor] of qLabels) {
    if (label) body += `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${mono}" font-size="8" letter-spacing="1.4" fill="${t.soft}">${esc(label.toUpperCase())}</text>`;
  }
  body += `<text x="${left}" y="${topY + size + 28}" font-family="${mono}" font-size="8" letter-spacing="1.4" fill="${t.soft}">${esc(spec.xAxis[0].toUpperCase())}</text>`;
  body += `<text x="${left + size}" y="${topY + size + 28}" text-anchor="end" font-family="${mono}" font-size="8" letter-spacing="1.4" fill="${t.soft}">${esc(spec.xAxis[1].toUpperCase())}</text>`;
  body += `<text x="${left - 12}" y="${topY + size}" text-anchor="end" font-family="${mono}" font-size="8" letter-spacing="1.4" fill="${t.soft}">${esc(spec.yAxis[0].toUpperCase())}</text>`;
  body += `<text x="${left - 12}" y="${topY + 8}" text-anchor="end" font-family="${mono}" font-size="8" letter-spacing="1.4" fill="${t.soft}">${esc(spec.yAxis[1].toUpperCase())}</text>`;
  for (const p of spec.points) {
    const cx = Math.round(left + Math.min(1, Math.max(0, p.x)) * size);
    const cy = Math.round(topY + (1 - Math.min(1, Math.max(0, p.y))) * size);
    const fill = p.focal ? t.accent : t.paper;
    const stroke = p.focal ? t.accent : t.ink;
    body += `<circle cx="${cx}" cy="${cy}" r="6" fill="${fill}" stroke="${stroke}" stroke-width="${STROKE.default}"/>`;
    const onRight = cx < left + size - 120;
    body += `<text x="${onRight ? cx + 12 : cx - 12}" y="${cy + 4}" text-anchor="${onRight ? 'start' : 'end'}" font-family="${sans}" font-size="12" font-weight="600" fill="${t.ink}">${esc(p.label)}</text>`;
  }
  return { width, height, body };
}

function timeline(spec: Extract<DiagramSpec, { type: 'timeline' }>, t: DiagramTokens, mono: string, sans: string, serif: string): Canvas {
  const PAD = 48;
  const { svg: head, top } = header(spec, t, serif, sans, PAD);
  const width = 960;
  const n = Math.max(1, spec.events.length);
  const y = top + 160;
  const x0 = PAD + 40;
  const x1 = width - PAD - 40;
  const step = n > 1 ? (x1 - x0) / (n - 1) : 0;
  let body = head;
  body += `<line x1="${PAD}" y1="${y}" x2="${width - PAD}" y2="${y}" stroke="${t.muted}" stroke-width="${STROKE.default}"/>`;
  spec.events.forEach((e, i) => {
    const cx = Math.round(n > 1 ? x0 + i * step : width / 2);
    const above = i % 2 === 0;
    const r = e.focal ? 8 : 6;
    body += `<circle cx="${cx}" cy="${y}" r="${r}" fill="${e.focal ? t.accent : t.paper}" stroke="${e.focal ? t.accent : t.ink}" stroke-width="${STROKE.default}"/>`;
    const dateY = above ? y - 40 : y + 40;
    const labelY = above ? y - 20 : y + 60;
    body += `<line x1="${cx}" y1="${above ? y - 12 : y + 12}" x2="${cx}" y2="${above ? y - 28 : y + 28}" stroke="${t.soft}" stroke-width="${STROKE.thin}"/>`;
    body += `<text x="${cx}" y="${dateY}" text-anchor="middle" font-family="${mono}" font-size="8" letter-spacing="1.4" fill="${t.soft}">${esc(e.date.toUpperCase())}</text>`;
    body += `<text x="${cx}" y="${labelY}" text-anchor="middle" font-family="${sans}" font-size="12" font-weight="600" fill="${t.ink}">${esc(e.label)}</text>`;
    if (e.sub) body += `<text x="${cx}" y="${labelY + 16}" text-anchor="middle" font-family="${mono}" font-size="9" fill="${t.soft}">${esc(e.sub)}</text>`;
  });
  return { width, height: y + 160, body };
}

function bar(spec: Extract<DiagramSpec, { type: 'bar' }>, t: DiagramTokens, mono: string, sans: string, serif: string): Canvas {
  const PAD = 48;
  const { svg: head, top } = header(spec, t, serif, sans, PAD);
  const width = 960;
  const plotTop = top + 40;
  const plotH = 300;
  const baseY = plotTop + plotH;
  const n = Math.max(1, spec.items.length);
  const slot = (width - PAD * 2) / n;
  const max = Math.max(1, ...spec.items.map((i) => i.value));
  let body = head;
  body += `<line x1="${PAD}" y1="${baseY}" x2="${width - PAD}" y2="${baseY}" stroke="${t.ruleSolid}" stroke-width="${STROKE.default}"/>`;
  spec.items.forEach((it, i) => {
    const bw = Math.round(Math.min(120, slot * 0.56));
    const cx = PAD + slot * i + slot / 2;
    const h = Math.round((it.value / max) * plotH);
    const fill = it.focal ? t.accent : t.muted;
    body += `<rect x="${Math.round(cx - bw / 2)}" y="${baseY - h}" width="${bw}" height="${h}" rx="${RADIUS.sm}" fill="${it.focal ? t.accentTint : t.rule}" stroke="${fill}" stroke-width="${it.focal ? STROKE.strong : STROKE.thin}"/>`;
    body += `<text x="${cx}" y="${baseY - h - 8}" text-anchor="middle" font-family="${mono}" font-size="9" fill="${t.ink}">${esc(String(it.value))}${spec.unit ? ' ' + esc(spec.unit) : ''}</text>`;
    body += `<text x="${cx}" y="${baseY + 24}" text-anchor="middle" font-family="${sans}" font-size="12" font-weight="600" fill="${t.ink}">${esc(it.label)}</text>`;
  });
  return { width, height: baseY + 72, body };
}

function waterfall(spec: Extract<DiagramSpec, { type: 'waterfall' }>, t: DiagramTokens, mono: string, sans: string, serif: string): Canvas {
  const PAD = 48;
  const { svg: head, top } = header(spec, t, serif, sans, PAD);
  const width = 960;
  const plotTop = top + 40;
  const plotH = 300;
  const baseY = plotTop + plotH;
  const cols: { label: string; from: number; to: number; kind: 'total' | 'up' | 'down' }[] = [];
  let run = spec.start.value;
  cols.push({ label: spec.start.label, from: 0, to: run, kind: 'total' });
  for (const s of spec.steps) {
    const next = run + s.delta;
    cols.push({ label: s.label, from: run, to: next, kind: s.delta >= 0 ? 'up' : 'down' });
    run = next;
  }
  cols.push({ label: spec.endLabel || 'End', from: 0, to: run, kind: 'total' });
  const peak = Math.max(1, ...cols.flatMap((c) => [c.from, c.to]));
  const scale = (v: number) => baseY - Math.round((v / peak) * plotH);
  const n = cols.length;
  const slot = (width - PAD * 2) / n;
  const bw = Math.round(Math.min(96, slot * 0.6));
  let body = head;
  body += `<line x1="${PAD}" y1="${baseY}" x2="${width - PAD}" y2="${baseY}" stroke="${t.ruleSolid}" stroke-width="${STROKE.default}"/>`;
  cols.forEach((c, i) => {
    const cx = PAD + slot * i + slot / 2;
    const yTop = scale(Math.max(c.from, c.to));
    const yBot = scale(Math.min(c.from, c.to));
    const h = Math.max(2, yBot - yTop);
    const isFocal = c.kind === 'down';
    const fill = c.kind === 'total' ? t.rule : c.kind === 'up' ? t.rule : t.accentTint;
    const stroke = c.kind === 'total' ? t.ink : c.kind === 'up' ? t.muted : t.accent;
    body += `<rect x="${Math.round(cx - bw / 2)}" y="${yTop}" width="${bw}" height="${h}" rx="${RADIUS.sm}" fill="${fill}" stroke="${stroke}" stroke-width="${isFocal ? STROKE.strong : STROKE.thin}"/>`;
    const delta = c.kind === 'total' ? c.to : c.to - c.from;
    const valueText = (c.kind === 'total' ? '' : delta > 0 ? '+' : '') + String(delta);
    body += `<text x="${cx}" y="${yTop - 8}" text-anchor="middle" font-family="${mono}" font-size="9" fill="${t.ink}">${esc(valueText)}</text>`;
    body += `<text x="${cx}" y="${baseY + 24}" text-anchor="middle" font-family="${sans}" font-size="12" font-weight="600" fill="${t.ink}">${esc(c.label)}</text>`;
    if (i < n - 1) {
      const yRun = scale(c.to);
      body += `<line x1="${Math.round(cx + bw / 2)}" y1="${yRun}" x2="${Math.round(PAD + slot * (i + 1) + slot / 2 - bw / 2)}" y2="${yRun}" stroke="${t.soft}" stroke-width="${STROKE.thin}" stroke-dasharray="4,3"/>`;
    }
  });
  return { width, height: baseY + 72, body };
}

function funnel(spec: Extract<DiagramSpec, { type: 'funnel' }>, t: DiagramTokens, mono: string, sans: string, serif: string): Canvas {
  const PAD = 48;
  const { svg: head, top } = header(spec, t, serif, sans, PAD);
  const width = 960;
  const maxW = 560;
  const minW = 160;
  const rowH = 56;
  const gap = 32;
  const cx = width / 2;
  const max = Math.max(1, ...spec.stages.map((s) => s.value));
  let body = head;
  let y = top + 24;
  let prev: number | null = null;
  spec.stages.forEach((s, i) => {
    const w = Math.round(Math.max(minW, (s.value / max) * maxW));
    const last = i === spec.stages.length - 1;
    body += `<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${rowH}" rx="${RADIUS.md}" fill="${last ? t.accentTint : t.rule}" stroke="${last ? t.accent : t.muted}" stroke-width="${last ? STROKE.strong : STROKE.thin}"/>`;
    body += `<text x="${cx}" y="${y + 24}" text-anchor="middle" font-family="${sans}" font-size="12" font-weight="600" fill="${t.ink}">${esc(s.label)}</text>`;
    body += `<text x="${cx}" y="${y + 40}" text-anchor="middle" font-family="${mono}" font-size="9" fill="${t.soft}">${esc(s.value.toLocaleString('en-US'))}</text>`;
    if (prev !== null && prev > 0) {
      const pct = Math.round((s.value / prev) * 1000) / 10;
      body += maskedLabel(cx + maxW / 2 + 72, y - gap / 2, `${pct}% CONVERT`, t, mono);
    }
    prev = s.value;
    y += rowH + gap;
  });
  return { width, height: y + 24, body };
}

// ─── Public entry ───────────────────────────────────────────────────────────

export function renderDiagram(spec: DiagramSpec, theme: ThemeName = 'light'): string {
  const t = TOKENS[theme];
  const serif = FONTS.title;
  const sans = FONTS.sans;
  const mono = FONTS.mono;
  let canvas: Canvas;
  switch (spec.type) {
    case 'flowchart':
      canvas = flowchart(spec, t, mono, sans, serif);
      break;
    case 'architecture':
      canvas = architecture(spec, t, mono, sans, serif);
      break;
    case 'sequence':
      canvas = sequence(spec, t, mono, sans, serif);
      break;
    case 'quadrant':
      canvas = quadrant(spec, t, mono, sans, serif);
      break;
    case 'timeline':
      canvas = timeline(spec, t, mono, sans, serif);
      break;
    case 'bar':
      canvas = bar(spec, t, mono, sans, serif);
      break;
    case 'waterfall':
      canvas = waterfall(spec, t, mono, sans, serif);
      break;
    case 'funnel':
      canvas = funnel(spec, t, mono, sans, serif);
      break;
    default:
      throw new Error(`Unknown diagram type: ${(spec as { type: string }).type}`);
  }
  const w = Math.round(canvas.width);
  const h = Math.round(canvas.height);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">` +
    `<rect width="${w}" height="${h}" fill="${t.paper}"/>` +
    canvas.body +
    `</svg>`
  );
}

/** Parse + validate a user-supplied JSON spec. Returns a typed spec or throws a readable error. */
export function parseSpec(text: string): DiagramSpec {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }
  if (!raw || typeof raw !== 'object' || typeof (raw as { type?: unknown }).type !== 'string') {
    throw new Error('Spec must be an object with a "type" field.');
  }
  const type = (raw as { type: string }).type as DiagramSpec['type'];
  if (!DIAGRAM_TYPES.some((d) => d.id === type)) {
    throw new Error(`Unknown type "${type}". Use one of: ${DIAGRAM_TYPES.map((d) => d.id).join(', ')}.`);
  }
  const s = raw as Record<string, unknown>;
  const needArray = (k: string) => {
    if (!Array.isArray(s[k])) throw new Error(`"${k}" must be an array for a ${type} diagram.`);
  };
  switch (type) {
    case 'flowchart':
      needArray('nodes');
      needArray('edges');
      break;
    case 'architecture':
      needArray('layers');
      break;
    case 'sequence':
      needArray('actors');
      needArray('messages');
      break;
    case 'quadrant':
      needArray('points');
      break;
    case 'timeline':
      needArray('events');
      break;
    case 'bar':
      needArray('items');
      break;
    case 'waterfall':
      needArray('steps');
      break;
    case 'funnel':
      needArray('stages');
      break;
  }
  return raw as DiagramSpec;
}
