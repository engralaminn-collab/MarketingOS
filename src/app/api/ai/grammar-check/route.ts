import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { generateChatCompletion } from '@/lib/ai-provider';

// POST /api/ai/grammar-check — check grammar + spelling via the configured text model.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    const rawText = (body as Record<string, unknown>).text;
    const text = typeof rawText === 'string' ? rawText.trim() : '';
    if (!text || text.length > 10_000) return NextResponse.json({ error: 'Text is required and must be at most 10,000 characters' }, { status: 400 });

    let result;
    let generationMode: 'local-model' | 'rule-based-fallback' = 'rule-based-fallback';
    try {
      const completion = await generateChatCompletion([
        { role: 'system', content: 'You are a grammar and spell checker. Check the text for errors. Return JSON: {"errors":[{"type":"grammar|spelling|punctuation|style","original":"...","suggestion":"...","message":"..."}],"correctedText":"..."}' },
        { role: 'user', content: text },
      ], { temperature: 0 });
      const jsonText = completion.content.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '');
      result = JSON.parse(jsonText);
      generationMode = 'local-model';
    } catch {
      result = grammarCheckFallback(text);
    }

    return NextResponse.json({ data: result, generationMode, degraded: generationMode !== 'local-model' });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

function grammarCheckFallback(text: string): any {
  const errors: any[] = [];
  let corrected = text;

  // Check for common mistakes
  const checks = [
    { pattern: /\bteh\b/gi, fix: 'the', type: 'spelling', msg: 'Typo: "teh" should be "the"' },
    { pattern: /\brecieve\b/gi, fix: 'receive', type: 'spelling', msg: '"recieve" should be "receive" (i before e)' },
    { pattern: /\baccomodate\b/gi, fix: 'accommodate', type: 'spelling', msg: '"accomodate" should be "accommodate"' },
    { pattern: /\bdefinately\b/gi, fix: 'definitely', type: 'spelling', msg: '"definately" should be "definitely"' },
    { pattern: /\bseperate\b/gi, fix: 'separate', type: 'spelling', msg: '"seperate" should be "separate"' },
    { pattern: /\bits\s+a\b/gi, fix: "it's a", type: 'grammar', msg: 'Possessive "its" vs contraction "it\'s"' },
    { pattern: /\byour\s+welcome\b/gi, fix: "you're welcome", type: 'grammar', msg: '"your welcome" should be "you\'re welcome"' },
    { pattern: /\bcould\s+of\b/gi, fix: 'could have', type: 'grammar', msg: '"could of" should be "could have"' },
    { pattern: /\bshould\s+of\b/gi, fix: 'should have', type: 'grammar', msg: '"should of" should be "should have"' },
    { pattern: /\bwould\s+of\b/gi, fix: 'would have', type: 'grammar', msg: '"would of" should be "would have"' },
  ];

  for (const check of checks) {
    const matches = text.match(check.pattern);
    if (matches) {
      errors.push({ type: check.type, original: matches[0], suggestion: check.fix, message: check.msg });
      corrected = corrected.replace(check.pattern, check.fix);
    }
  }

  return { errors, correctedText: corrected, errorCount: errors.length };
}
