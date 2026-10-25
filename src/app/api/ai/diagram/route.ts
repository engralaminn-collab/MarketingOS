import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { generateChatCompletion } from '@/lib/ai-provider';

export const DIAGRAM_TYPES = new Set([
  'flowchart',
  'sequence',
  'class',
  'state',
  'er',
  'gantt',
  'mindmap',
  'timeline',
  'funnel',
  'architecture',
  'sankey',
  'wardley',
  'swimlane',
  'quadrant',
]);

export function safeMermaidLabel(value: string, maxLength = 48): string {
  return (
    value
      .slice(0, maxLength * 2)
      .replace(/[\r\n\[\]{}<>"`|;\\]+/g, ' ')
      .replace(/-->|---|==>|\.\.->/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength) || 'Marketing workflow'
  );
}

export function diagramFallback(type: string, description: string): string {
  const topic = safeMermaidLabel(description, 44);
  switch (type) {
    case 'sequence':
      return `sequenceDiagram\n  participant User\n  participant System\n  User->>System: ${topic}\n  System-->>User: Validated Response\n  System->>System: Record Attribution`;
    case 'class':
      return `classDiagram\n  class Campaign {\n    +String name\n    +String channel\n    +launch() void\n  }\n  class Lead {\n    +String email\n    +Int score\n  }\n  Campaign "1" --> "*" Lead : captures`;
    case 'state':
      return `stateDiagram-v2\n  [*] --> Draft: ${topic}\n  Draft --> Review\n  Review --> Active\n  Active --> Completed\n  Completed --> [*]`;
    case 'er':
      return `erDiagram\n  COMPANY ||--o{ CAMPAIGN : runs\n  CAMPAIGN ||--o{ LEAD : captures\n  LEAD ||--o{ DEAL : converts`;
    case 'gantt':
      return `gantt\n  title ${topic}\n  dateFormat YYYY-MM-DD\n  section Strategy\n  Discovery :a1, 2026-10-01, 5d\n  Execution :after a1, 10d`;
    case 'mindmap':
      return `mindmap\n  root((${topic}))\n    Audience\n      ICP Segments\n      Pain Points\n    Channels\n      SEO and Content\n      Paid and Social\n    Conversion\n      Landing Page\n      Email Nurture`;
    case 'timeline':
      return `timeline\n  title ${topic}\n  Week 1 : Research and Positioning\n  Week 2 : Creative and Copy Production\n  Week 3 : Launch and Attribution\n  Week 4 : CRO and Iteration`;
    case 'funnel':
      return `flowchart TD\n  A[Awareness: ${topic}] --> B[Consideration and Proof]\n  B --> C[High-Intent Signup]\n  C --> D[Activated Customer]`;
    default:
      return `graph TD\n  A[Start: ${topic}] --> B{Decision}\n  B -->|Qualified| C[Execute Workflow]\n  B -->|Nurture| D[Follow-Up Sequence]\n  C --> E[Measure Outcome]\n  D --> E`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const rawDescription =
      typeof input.description === 'string' && input.description.trim()
        ? input.description
        : typeof input.prompt === 'string'
          ? input.prompt
          : '';
    const description = rawDescription.trim();
    if (!description || description.length > 3_000) {
      return NextResponse.json(
        { error: 'Description is required and must be at most 3,000 characters' },
        { status: 400 },
      );
    }
    if (input.type !== undefined && (typeof input.type !== 'string' || !DIAGRAM_TYPES.has(input.type))) {
      return NextResponse.json(
        { error: `Unsupported diagram type. Supported types: ${Array.from(DIAGRAM_TYPES).join(', ')}` },
        { status: 400 },
      );
    }
    const diagramType = typeof input.type === 'string' ? input.type : 'flowchart';

    let mermaid = '';
    let generationMode: 'local-model' | 'rule-based-fallback' = 'rule-based-fallback';
    try {
      const completion = await generateChatCompletion(
        [
          {
            role: 'system',
            content: `Generate valid Mermaid ${diagramType} syntax based on the user's description. Return ONLY valid Mermaid code (no markdown fences, no commentary).`,
          },
          { role: 'user', content: description },
        ],
        { temperature: 0.2 },
      );
      const cleaned = completion.content
        .replace(/^```(?:mermaid)?\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      if (cleaned) {
        mermaid = cleaned;
        generationMode = 'local-model';
      }
    } catch {
      // Clearly labeled deterministic template fallback when local/configured AI model is offline.
    }

    if (!mermaid) {
      mermaid = diagramFallback(diagramType, description);
    }

    return NextResponse.json(
      {
        data: {
          type: diagramType,
          description,
          prompt: description,
          mermaid,
          generationMode,
          degraded: generationMode !== 'local-model',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[POST /api/ai/diagram]', error);
    return NextResponse.json({ error: 'Could not generate diagram' }, { status: 500 });
  }
}
