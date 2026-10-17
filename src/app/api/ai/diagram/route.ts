import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { generateChatCompletion } from '@/lib/ai-provider';

// POST /api/ai/diagram — generate a Mermaid diagram from text description
// Inspired by cathrynlavery/diagram-design pattern
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const body = await req.json();
    const description = String(body.description || '').trim();
    if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 });
    const type = ['flowchart', 'sequence', 'class', 'state', 'er', 'gantt'].includes(body.type) ? body.type : 'flowchart';

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
      diagram = diagramFallback(type, description);
    }

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
  return `graph TD\n    A[${desc.slice(0, 50)}]`;
}
