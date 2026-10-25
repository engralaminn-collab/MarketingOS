import { generateChatCompletion } from '@/lib/ai-provider';

export function isZaiMediaEnabled(): boolean {
  return process.env.ZAI_MEDIA_ENABLED === 'true';
}

let zaiInstance: any = null;
async function getZai(): Promise<any | null> {
  if (!isZaiMediaEnabled()) return null;
  if (zaiInstance) return zaiInstance;
  try {
    const mod = await import('z-ai-web-dev-sdk');
    const ZAI = (mod as any).default ?? mod;
    zaiInstance = await ZAI.create();
    return zaiInstance;
  } catch {
    return null;
  }
}

export async function generateVideo(prompt: string): Promise<{ taskId: string; status: string; videoUrl?: string } | null> {
  const zai = await getZai();
  if (!zai) return null;
  try {
    const task = await zai.video.generations.create({ prompt, quality: 'speed', with_audio: false, fps: 30, duration: 5 });
    return { taskId: task.id || '', status: task.task_status || 'PROCESSING', videoUrl: task.video_result?.[0]?.url };
  } catch {
    return null;
  }
}

export async function getVideoStatus(taskId: string): Promise<{ status: string; videoUrl?: string }> {
  const zai = await getZai();
  if (!zai) return { status: 'DISABLED' };
  try {
    const result = await zai.async.result.query(taskId);
    return { status: result.task_status || 'PROCESSING', videoUrl: result.video_result?.[0]?.url };
  } catch {
    return { status: 'FAILED' };
  }
}

export async function generateImage(prompt: string, size = '1024x1024'): Promise<{ base64: string } | null> {
  const zai = await getZai();
  if (!zai) return null;
  try {
    const res = await zai.images.generations.create({ prompt, size });
    const base64 = res.data?.[0]?.base64;
    return base64 ? { base64 } : null;
  } catch {
    return null;
  }
}

export async function generateSpeech(text: string, voice = 'default'): Promise<{ audioUrl: string } | null> {
  const zai = await getZai();
  if (!zai) return null;
  try {
    const res = await zai.audio?.speech?.create({ input: text, voice });
    return res?.url ? { audioUrl: res.url } : null;
  } catch {
    return null;
  }
}

// ─── Free Image Generation (Pollinations keyless / HF FLUX / Cloudflare FLUX) ─

export async function generateFreeCloudImage(
  prompt: string,
  width = 1024,
  height = 1024,
  preferred: 'pollinations' | 'huggingface' | 'cloudflare' = 'pollinations',
): Promise<{ dataUrl: string; provider: string } | null> {
  if (preferred === 'huggingface' && process.env.HF_API_TOKEN) {
    try {
      const resp = await fetch(
        'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: prompt }),
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (resp.ok && (resp.headers.get('content-type') || '').startsWith('image/')) {
        const buf = Buffer.from(await resp.arrayBuffer());
        return { dataUrl: `data:image/png;base64,${buf.toString('base64')}`, provider: 'huggingface-flux-schnell' };
      }
    } catch {
      // fall through
    }
  }

  if (preferred === 'cloudflare' && process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    try {
      const resp = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt, steps: 4 }),
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (resp.ok) {
        const data = (await resp.json()) as { result?: { image?: string } };
        if (data.result?.image) {
          return { dataUrl: `data:image/png;base64,${data.result.image}`, provider: 'cloudflare-flux-schnell' };
        }
      }
    } catch {
      // fall through
    }
  }

  if (preferred === 'pollinations' || process.env.POLLINATIONS_IMAGE_ENABLED === 'true') {
    try {
      const seed = Math.floor(Math.random() * 1_000_000);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(25_000) });
      if (resp.ok && (resp.headers.get('content-type') || '').startsWith('image/')) {
        const mime = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0];
        const buf = Buffer.from(await resp.arrayBuffer());
        if (buf.byteLength > 256 && buf.byteLength <= 15 * 1024 * 1024) {
          return { dataUrl: `data:${mime};base64,${buf.toString('base64')}`, provider: 'pollinations-free' };
        }
      }
    } catch {
      // fall through
    }
  }

  return null;
}

// ─── Free Speech-to-Text (Groq Whisper / Local OpenAI-Compatible Whisper) ─────

export async function transcribeFreeSpeech(params: {
  audioBase64: string;
  mimeType?: string;
  language?: string;
}): Promise<{ text: string; provider: string; segments?: Array<{ start: number; end: number; text: string }> } | null> {
  const cleanB64 = params.audioBase64.replace(/^data:[^;]+;base64,/, '');
  const bytes = Buffer.from(cleanB64, 'base64');
  if (!bytes.byteLength || bytes.byteLength > 25 * 1024 * 1024) return null;

  const endpoints: Array<{ name: string; url: string; key: string; model: string }> = [];
  if (process.env.LOCAL_STT_BASE_URL) {
    endpoints.push({
      name: 'local-whisper',
      url: `${process.env.LOCAL_STT_BASE_URL.replace(/\/+$/, '')}/v1/audio/transcriptions`,
      key: process.env.LOCAL_STT_API_KEY || '',
      model: process.env.LOCAL_STT_MODEL || 'whisper-1',
    });
  }
  if (process.env.GROQ_API_KEY) {
    endpoints.push({
      name: 'groq-whisper-large-v3-turbo',
      url: 'https://api.groq.com/openai/v1/audio/transcriptions',
      key: process.env.GROQ_API_KEY,
      model: 'whisper-large-v3-turbo',
    });
  }

  for (const ep of endpoints) {
    try {
      const form = new FormData();
      const blob = new Blob([bytes], { type: params.mimeType || 'audio/webm' });
      form.append('file', blob, 'recording.webm');
      form.append('model', ep.model);
      form.append('response_format', 'verbose_json');
      if (params.language) form.append('language', params.language);

      const headers: Record<string, string> = {};
      if (ep.key) headers.Authorization = `Bearer ${ep.key}`;

      const resp = await fetch(ep.url, {
        method: 'POST',
        headers,
        body: form,
        signal: AbortSignal.timeout(45_000),
      });
      if (resp.ok) {
        const json = (await resp.json()) as {
          text?: string;
          segments?: Array<{ start: number; end: number; text: string }>;
        };
        if (json.text) {
          return { text: json.text.trim(), provider: ep.name, segments: json.segments };
        }
      }
    } catch {
      // try next configured free STT endpoint
    }
  }
  return null;
}

// ─── blader/humanizer 24-Pattern AI-Writing Tell Detector & Rewriter ─────────

export interface HumanizerPatternHit {
  id: string;
  category: string;
  rule: string;
  matches: string[];
  severity: 'high' | 'medium' | 'low';
}

interface TellRule {
  id: string;
  category: string;
  rule: string;
  severity: 'high' | 'medium' | 'low';
  regex: RegExp;
  replace?: (input: string) => string;
}

const HUMANIZER_RULES: TellRule[] = [
  {
    id: 'chatbot-wrapper',
    category: 'Communication Artifacts',
    rule: 'Chatbot opener/closer ("Certainly!", "Great question!", "I hope this helps")',
    severity: 'high',
    regex: /\b(certainly!|great question!|absolutely!|i hope this helps!?|let me know if you(?:'d| would) like[^.!\n]*[.!]?|here(?:'s| is) a breakdown of)\b/gi,
    replace: (s) => s.replace(/^\s*(certainly!|great question!|absolutely!|sure thing!)\s*/gim, '').replace(/\s*i hope this helps[^.!\n]*[.!]?\s*$/gim, ''),
  },
  {
    id: 'contrast-formula',
    category: 'Structural Slop (§1)',
    rule: 'Negative parallelism ("It\'s not just X — it\'s Y" / "Not only X, but Y")',
    severity: 'high',
    regex: /\b(it(?:'s| is) not (?:just|merely|only) [^.,;—-]+[,—-]\s*it(?:'s| is)|not just about [^.,;—-]+[,—-]\s*it(?:'s| is) about)\b/gi,
    replace: (s) => s.replace(/\bit(?:'s| is) not (?:just|merely|only) ([^.,;—-]+)[,—-]\s*it(?:'s| is) /gi, 'Beyond $1, it brings '),
  },
  {
    id: 'ai-vocabulary',
    category: 'Lexical Tells (§9)',
    rule: 'High-frequency AI vocabulary (delve, tapestry, landscape, testament, realm, interplay, pivotal, underscore)',
    severity: 'high',
    regex: /\b(delve(?:s|d)?|tapestry|testament to|ever-evolving landscape|digital landscape|intricate interplay|pivotal moment|paradigm shift|realm of|harness(?:ing)? the power of|unlock(?:ing)? the full potential)\b/gi,
    replace: (s) =>
      s
        .replace(/\bdelve(?:s|d)? into\b/gi, 'examine')
        .replace(/\bdelve(?:s|d)?\b/gi, 'dig')
        .replace(/\btapestry of\b/gi, 'mix of')
        .replace(/\ba testament to\b/gi, 'proof of')
        .replace(/\bever-evolving landscape\b/gi, 'market')
        .replace(/\bdigital landscape\b/gi, 'online market')
        .replace(/\bintricate interplay\b/gi, 'interaction')
        .replace(/\bpivotal moment\b/gi, 'turning point')
        .replace(/\bparadigm shift\b/gi, 'major change')
        .replace(/\brealm of\b/gi, 'field of')
        .replace(/\bharness(?:ing)? the power of\b/gi, 'use')
        .replace(/\bunlock(?:ing)? the full potential of\b/gi, 'get more from'),
  },
  {
    id: 'significance-inflation',
    category: 'Puffery & Inflation (§2)',
    rule: 'Inflated significance ("marks a pivotal", "indelible mark", "beacon of")',
    severity: 'medium',
    regex: /\b(indelible mark|beacon of|watershed moment|stands as a cornerstone|plays a vital role in shaping)\b/gi,
    replace: (s) =>
      s
        .replace(/\bplays a vital role in shaping\b/gi, 'shapes')
        .replace(/\bstands as a cornerstone of\b/gi, 'anchors')
        .replace(/\bbeacon of\b/gi, 'example of'),
  },
  {
    id: 'promotional-buzzwords',
    category: 'Promotional Slop (§3)',
    rule: 'Empty promotional adjectives (seamless, cutting-edge, game-changer, groundbreaking, vibrant)',
    severity: 'medium',
    regex: /\b(seamless(?:ly)?|cutting-edge|game-chang(?:er|ing)|groundbreaking|state-of-the-art|revolutionary|synergistic|holistic approach)\b/gi,
    replace: (s) =>
      s
        .replace(/\bseamlessly\b/gi, 'smoothly')
        .replace(/\bseamless\b/gi, 'smooth')
        .replace(/\bcutting-edge\b/gi, 'modern')
        .replace(/\bstate-of-the-art\b/gi, 'modern')
        .replace(/\bgame-changer\b/gi, 'practical improvement')
        .replace(/\bgame-changing\b/gi, 'useful')
        .replace(/\bholistic approach\b/gi, 'complete method'),
  },
  {
    id: 'superficial-ing-tails',
    category: 'Participial Tails (§4)',
    rule: 'Trailing superficial participle (", underscoring...", ", fostering...", ", ensuring...")',
    severity: 'medium',
    regex: /,\s*(underscoring|highlighting|fostering|showcasing|exemplifying|paving the way for)\b[^.!\n]*/gi,
  },
  {
    id: 'copula-avoidance',
    category: 'Copula Avoidance (§10)',
    rule: 'Stiff verb substitutes for "is/has" ("serves as", "boasts", "stands as")',
    severity: 'low',
    regex: /\b(serves as a|stands as a|boasts an impressive|features a robust)\b/gi,
    replace: (s) =>
      s
        .replace(/\bserves as a\b/gi, 'is a')
        .replace(/\bstands as a\b/gi, 'is a')
        .replace(/\bboasts an impressive\b/gi, 'has a')
        .replace(/\bfeatures a robust\b/gi, 'includes a'),
  },
  {
    id: 'filler-transitions',
    category: 'Formulaic Transitions (§15)',
    rule: 'Stacked conjunctive adverbs ("Furthermore,", "Moreover,", "In conclusion,", "It is important to note that")',
    severity: 'medium',
    regex: /\b(furthermore,|moreover,|in conclusion,|in summary,|it is important to note that|it is worth noting that|in today's fast-paced world)\b/gi,
    replace: (s) =>
      s
        .replace(/\bFurthermore,\s*/g, 'Also, ')
        .replace(/\bMoreover,\s*/g, 'And ')
        .replace(/\bIn conclusion,\s*/gi, '')
        .replace(/\bIn summary,\s*/gi, '')
        .replace(/\bIt is (?:important|worth) (?:to note|noting) that\s*/gi, '')
        .replace(/\bIn today's fast-paced world,?\s*/gi, ''),
  },
  {
    id: 'em-dash-overuse',
    category: 'Punctuation Slop (§8)',
    rule: 'Excessive em-dashes (3+ em-dashes in a short passage)',
    severity: 'low',
    regex: /—/g,
    replace: (s) => {
      let count = 0;
      return s.replace(/\s*—\s*/g, (m) => {
        count += 1;
        return count > 1 ? ', ' : m;
      });
    },
  },
  {
    id: 'bold-bullet-slop',
    category: 'Formatting Slop (§19)',
    rule: 'Mechanical "**Bold Label:** explanation" list items',
    severity: 'low',
    regex: /^\s*[-*•]\s*\*\*[^*]{2,40}:\*\*/gm,
  },
  {
    id: 'vague-attribution',
    category: 'Weasel Words (§5)',
    rule: 'Unattributed authority claims ("Experts agree", "Studies show", "Industry leaders")',
    severity: 'medium',
    regex: /\b(experts agree|studies show|research indicates|many industry leaders|observers have noted)\b/gi,
  },
  {
    id: 'hedging-stack',
    category: 'Filler & Hedging (§12)',
    rule: 'Stacked hedges ("could potentially", "might possibly", "in order to")',
    severity: 'low',
    regex: /\b(could potentially|might possibly|in order to|due to the fact that|at this point in time)\b/gi,
    replace: (s) =>
      s
        .replace(/\bcould potentially\b/gi, 'could')
        .replace(/\bmight possibly\b/gi, 'might')
        .replace(/\bin order to\b/gi, 'to')
        .replace(/\bdue to the fact that\b/gi, 'because')
        .replace(/\bat this point in time\b/gi, 'now'),
  },
];

export function analyzeAiWritingTells(text: string): {
  aiSlopScore: number;
  hits: HumanizerPatternHit[];
  rewrittenDeterministic: string;
} {
  const hits: HumanizerPatternHit[] = [];
  let rewritten = text;
  let penalty = 0;

  for (const rule of HUMANIZER_RULES) {
    const found = text.match(rule.regex) || [];
    if (rule.id === 'em-dash-overuse' && found.length < 3) continue;
    if (found.length > 0) {
      const unique = Array.from(new Set(found.map((m) => m.trim()))).slice(0, 5);
      hits.push({
        id: rule.id,
        category: rule.category,
        rule: rule.rule,
        matches: unique,
        severity: rule.severity,
      });
      const weight = rule.severity === 'high' ? 16 : rule.severity === 'medium' ? 10 : 5;
      penalty += Math.min(weight * found.length, weight * 2.5);
      if (rule.replace) {
        rewritten = rule.replace(rewritten);
      }
    }
  }

  rewritten = rewritten.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const aiSlopScore = Math.max(0, Math.min(100, Math.round(penalty)));
  return { aiSlopScore, hits, rewrittenDeterministic: rewritten };
}

export async function humanizeText(
  text: string,
  tone = 'natural',
): Promise<{
  text: string;
  degraded: boolean;
  aiScoreBefore: number;
  aiScoreAfter: number;
  detectedTells: HumanizerPatternHit[];
}> {
  const before = analyzeAiWritingTells(text);
  try {
    const res = await generateChatCompletion([
      {
        role: 'system',
        content: `You are the blader/humanizer editorial rewriter. Rewrite the user's text in a ${tone} human voice.
Rules:
1. Preserve EVERY fact, name, date, number, URL, quote, and citation exactly. Never invent statistics or claims.
2. Strip AI tells: negative parallelisms ("not X, it's Y"), puffery ("pivotal, testament, delve, tapestry, seamless"), superficial "-ing" tails, stacked transitions ("Furthermore, Moreover, In conclusion"), chatbot wrappers, and mechanical bold-label bullets.
3. Vary sentence rhythm naturally. Return ONLY the rewritten text.`,
      },
      { role: 'user', content: text },
    ], { temperature: 0.45 });
    const cleaned = res.content || before.rewrittenDeterministic;
    const after = analyzeAiWritingTells(cleaned);
    return {
      text: cleaned,
      degraded: false,
      aiScoreBefore: before.aiSlopScore,
      aiScoreAfter: after.aiSlopScore,
      detectedTells: before.hits,
    };
  } catch {
    const after = analyzeAiWritingTells(before.rewrittenDeterministic);
    return {
      text: before.rewrittenDeterministic,
      degraded: true,
      aiScoreBefore: before.aiSlopScore,
      aiScoreAfter: after.aiSlopScore,
      detectedTells: before.hits,
    };
  }
}

// ─── languagetool-org Inspired Grammar, Readability & Style Engine ───────────

export interface GrammarIssue {
  original: string;
  suggestion: string;
  reason: string;
  category: 'grammar' | 'style' | 'typography' | 'clarity';
}

export function runDeterministicGrammarCheck(text: string): {
  correctedText: string;
  issues: GrammarIssue[];
  readability: { words: number; sentences: number; avgWordsPerSentence: number; gradeLevel: number };
} {
  const issues: GrammarIssue[] = [];
  let corrected = text;

  const rules: Array<{ re: RegExp; fix: string; reason: string; cat: GrammarIssue['category'] }> = [
    { re: /\b([A-Za-z]+)\s+\1\b/gi, fix: '$1', reason: 'Repeated consecutive word', cat: 'grammar' },
    { re: /\bteh\b/gi, fix: 'the', reason: 'Common transposition typo', cat: 'grammar' },
    { re: /\brecieve\b/gi, fix: 'receive', reason: 'Spelling ("i before e except after c")', cat: 'grammar' },
    { re: /\bseperate\b/gi, fix: 'separate', reason: 'Spelling ("separate")', cat: 'grammar' },
    { re: /\boccured\b/gi, fix: 'occurred', reason: 'Double-r spelling in past tense', cat: 'grammar' },
    { re: /\bdefinately\b/gi, fix: 'definitely', reason: 'Spelling ("definitely")', cat: 'grammar' },
    { re: /\balot\b/gi, fix: 'a lot', reason: 'Two words ("a lot")', cat: 'grammar' },
    { re: /\bshould of\b/gi, fix: 'should have', reason: 'Use auxiliary "have" instead of "of"', cat: 'grammar' },
    { re: /\bcould of\b/gi, fix: 'could have', reason: 'Use auxiliary "have" instead of "of"', cat: 'grammar' },
    { re: /\bwould of\b/gi, fix: 'would have', reason: 'Use auxiliary "have" instead of "of"', cat: 'grammar' },
    { re: /\birregardless\b/gi, fix: 'regardless', reason: 'Non-standard double negative', cat: 'grammar' },
    { re: /\butilize\b/gi, fix: 'use', reason: 'Prefer plain verb "use"', cat: 'clarity' },
    { re: /\bleverage\b(?=\s+(?:our|the|this|a)\b)/gi, fix: 'use', reason: 'Jargon verb; prefer "use"', cat: 'style' },
    { re: /([.!?]){2,}/g, fix: '$1', reason: 'Repeated terminal punctuation', cat: 'typography' },
    { re: /[ \t]{2,}/g, fix: ' ', reason: 'Multiple consecutive spaces', cat: 'typography' },
  ];

  for (const r of rules) {
    const matches = corrected.match(r.re);
    if (matches) {
      for (const m of matches.slice(0, 4)) {
        const replacement = m.replace(r.re, r.fix);
        issues.push({
          original: m,
          suggestion: replacement,
          reason: r.reason,
          category: r.cat,
        });
      }
      corrected = corrected.replace(r.re, r.fix);
    }
  }

  // Flag overly long sentences (> 34 words)
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  for (const s of sentences) {
    const wc = s.trim().split(/\s+/).length;
    if (wc > 34) {
      issues.push({
        original: `${s.slice(0, 68)}…`,
        suggestion: 'Split into two shorter sentences (< 25 words each)',
        reason: `Long sentence (${wc} words) reduces scan readability`,
        category: 'clarity',
      });
    }
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sentenceCount = Math.max(1, sentences.length);
  const syllables = (text.toLowerCase().match(/[aeiouy]{1,2}/g) || []).length || words;
  const avgWords = Number((words / sentenceCount).toFixed(1));
  const grade = Math.max(1, Math.min(18, Number((0.39 * avgWords + 11.8 * (syllables / Math.max(1, words)) - 15.59).toFixed(1))));

  return {
    correctedText: corrected.trim(),
    issues,
    readability: {
      words,
      sentences: sentenceCount,
      avgWordsPerSentence: avgWords,
      gradeLevel: grade,
    },
  };
}

export async function storeMemory(
  companyId: string,
  agentType: string,
  category: string,
  content: string,
  metadata?: unknown,
): Promise<{ id: string }> {
  const { db } = await import('@/lib/db');
  const record = await db.activity.create({
    data: {
      companyId,
      type: `agent_memory:${agentType}`,
      resourceType: category,
      description: content.slice(0, 4_000),
      metadata: JSON.stringify({
        agentType,
        category,
        extra: metadata ?? null,
        storedAt: new Date().toISOString(),
      }),
    },
    select: { id: true },
  });
  return { id: record.id };
}

export async function retrieveMemories(
  companyId: string,
  agentType = 'general',
  category?: string,
  limit = 20,
) {
  const { db } = await import('@/lib/db');
  const rows = await db.activity.findMany({
    where: {
      companyId,
      type: agentType === 'all' ? { startsWith: 'agent_memory:' } : `agent_memory:${agentType}`,
      ...(category ? { resourceType: category } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(1, limit), 100),
  });
  return rows.map((r) => {
    let parsedMeta: Record<string, unknown> = {};
    try {
      parsedMeta = JSON.parse(r.metadata || '{}');
    } catch {
      parsedMeta = {};
    }
    return {
      id: r.id,
      agentType: (parsedMeta.agentType as string) || agentType,
      category: r.resourceType || (parsedMeta.category as string) || category || 'general',
      title: `[${r.resourceType || 'memory'}] ${r.description.slice(0, 64)}`,
      content: r.description,
      metadata: parsedMeta.extra ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function checkGrammar(text: string): Promise<{
  correctedText: string;
  issues: GrammarIssue[];
  readability: { words: number; sentences: number; avgWordsPerSentence: number; gradeLevel: number };
  degraded: boolean;
}> {
  const baseline = runDeterministicGrammarCheck(text);
  try {
    const res = await generateChatCompletion([
      {
        role: 'system',
        content: 'Check the text for grammar, spelling, punctuation, and conciseness. Return ONLY valid JSON: {"correctedText":"...","issues":[{"original":"...","suggestion":"...","reason":"...","category":"grammar"}]}',
      },
      { role: 'user', content: text },
    ], { temperature: 0.1 });
    const jsonMatch = res.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        correctedText: typeof parsed.correctedText === 'string' ? parsed.correctedText : baseline.correctedText,
        issues: Array.isArray(parsed.issues) && parsed.issues.length > 0 ? parsed.issues : baseline.issues,
        readability: baseline.readability,
        degraded: false,
      };
    }
  } catch {
    // Use deterministic rule engine cleanly
  }
  return { ...baseline, degraded: true };
}
