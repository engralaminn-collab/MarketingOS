import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { generateChatCompletion } from '@/lib/ai-provider';

const DIAGRAM_TYPES = new Set(['flowchart', 'sequence', 'class', 'state', 'er', 'gantt']);

function safeMermaidLabel(value: string, maxLength: number): string {
  return value.slice(0, maxLength).replace(/[\r\n\[\]{}<>"`|]/g, ' ').replace(/-->|---|==>/g, ' ').replace(/\s+/g, ' ').trim();
}

function diagramFallback(type: string, description: string): string {
  const label = safeMermaidLabel(description, 40) || 'Marketing workflow';
  if (type === 'flowchart') {
    return `graph TD\n    A[Start: ${label}] --> B{Decision}\n    B -->|Yes| C[Process]\n    B -->|No| D[Alternative]\n    C --> E[End]\n    D --> E`;
  }
  if (type === 'sequence') {
    return `sequenceDiagram\n    participant User\n    participant System\n    User->>System: ${label}\n    System-->>User: Response\n    System->>System: Process`;
  }
  return `graph TD\n    A[${safeMermaidLabel(description, 50) || 'Marketing workflow'}]`;
}

// POST /api/ai/diagram — generate a Mermaid diagram from a description.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    if (!description || description.length > 3_000) return NextResponse.json({ error: 'Description is required and must be at most 3,000 characters' }, { status: 400 });
    const type = typeof input.type === 'string' && DIAGRAM_TYPES.has(input.type) ? input.type : 'flowchart';

    let diagram: string;
    let generationMode: 'local-model' | 'rule-based-fallback' = 'rule-based-fallback';
    try {
      const completion = await generateChatCompletion([
        { role: 'system', content: `Generate a Mermaid ${type} diagram based on the user's description. Return ONLY valid Mermaid code (no markdown, no backticks, no explanation). Start with the diagram type keyword (e.g. "graph TD" or "sequenceDiagram").` },
        { role: 'user', content: description },
      ]);
      diagram = completion.content;
      generationMode = 'local-model';
    } catch {
      // A clearly labeled template remains available when the local model is offline.
    }
    if (!mermaid) mermaid = diagramFallback(type, description);

    return NextResponse.json({ data: { type, description, mermaid: diagram, generationMode, degraded: generationMode !== 'local-model' } });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

function diagramFallback(type: string, desc: string): string {
  if (type === 'flowchart') {
    return `graph TD
    A[Start: ${desc.slice(0, 40)}] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[Alternative]
    C --> E[End]
    D --> E`;
  }
  if (type === 'sequence') {
    return `sequenceDiagram
    participant User
    participant System
    User->>System: ${desc.slice(0, 40)}
    System-->>User: Response
    System->>System: Process`;
  }
}
