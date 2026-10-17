import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { generateChatCompletion } from '@/lib/ai-provider';

// POST /api/ai/grammar-check — check grammar + spelling via LLM
// Inspired by languagetool/languagetool pattern
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const body = await req.json();
    const text = String(body.text || '').trim();
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
    if (text.length > 10000) return NextResponse.json({ error: 'Text too long' }, { status: 400 });

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
      // Fallback: basic rule-based check
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
