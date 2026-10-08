import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import ZAI from 'z-ai-web-dev-sdk';
import { DIAGRAM_TYPES, EXAMPLE_SPECS, parseSpec, type DiagramSpec } from '@/lib/diagram-design/render';

// POST /api/ai/diagram
//   { description, type, format?: 'mermaid' | 'spec' }
//   format "mermaid" (default): returns Mermaid code (legacy behaviour).
//   format "spec": returns a Diagram Design JSON spec that renders with /lib/diagram-design
//                  (Flowchart, Architecture, Sequence, Quadrant, Timeline, Bar, Waterfall, Funnel).
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid' }, { status: 401 });

    const body = await req.json();
    const description = String(body.description || '').trim();
    if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 });

    if (body.format === 'spec') {
      const requested = DIAGRAM_TYPES.map((d) => d.id) as DiagramSpec['type'][];
      const type = (requested as string[]).includes(body.type) ? (body.type as DiagramSpec['type']) : 'flowchart';
      const spec = await generateSpec(type, description);
      return NextResponse.json({ data: { type, description, spec, json: JSON.stringify(spec, null, 2) } });
    }

    const type = ['flowchart', 'sequence', 'class', 'state', 'er', 'gantt'].includes(body.type) ? body.type : 'flowchart';

    let diagram;
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: `Generate a Mermaid ${type} diagram based on the user's description. Return ONLY valid Mermaid code (no markdown, no backticks, no explanation). Start with the diagram type keyword (e.g. "graph TD" or "sequenceDiagram").` },
          { role: 'user', content: description },
        ],
        thinking: { type: 'disabled' },
      });
      diagram = completion.choices[0]?.message?.content || '';
    } catch {
      diagram = diagramFallback(type, description);
    }

    return NextResponse.json({ data: { type, description, mermaid: diagram } });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}

const SPEC_GUIDE: Record<DiagramSpec['type'], string> = {
  flowchart: '{"type":"flowchart","title":str,"subtitle":str,"nodes":[{"id":str,"label":str,"sub"?:str,"kind"?:"focal"|"backend"|"store"|"external"|"input"|"optional"|"security"}],"edges":[{"from":id,"to":id,"label"?:str}]}',
  architecture: '{"type":"architecture","title":str,"subtitle":str,"layers":[{"name":str,"nodes":[{"id":str,"label":str,"sub"?:str,"kind"?:...}]}]}',
  sequence: '{"type":"sequence","title":str,"subtitle":str,"actors":[str],"messages":[{"from":actor,"to":actor,"label":str,"kind"?:"sync"|"async"|"return"}]}',
  quadrant: '{"type":"quadrant","title":str,"subtitle":str,"xAxis":[lowLabel,highLabel],"yAxis":[lowLabel,highLabel],"quadrants":[topLeft,topRight,bottomLeft,bottomRight],"points":[{"label":str,"x":0..1,"y":0..1,"focal"?:bool}]}',
  timeline: '{"type":"timeline","title":str,"subtitle":str,"events":[{"date":str,"label":str,"sub"?:str,"focal"?:bool}]}',
  bar: '{"type":"bar","title":str,"subtitle":str,"unit"?:str,"items":[{"label":str,"value":number,"focal"?:bool}]}',
  waterfall: '{"type":"waterfall","title":str,"subtitle":str,"start":{"label":str,"value":number},"steps":[{"label":str,"delta":number}],"endLabel":str}',
  funnel: '{"type":"funnel","title":str,"subtitle":str,"stages":[{"label":str,"value":number}]}',
};

async function generateSpec(type: DiagramSpec['type'], description: string): Promise<DiagramSpec> {
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Convert the user's description into a ${type} diagram spec. Return ONLY one JSON object, no markdown, no commentary, matching exactly this shape: ${SPEC_GUIDE[type]}. Use at most 9 nodes or points for a clean diagram. Use "focal" for at most two elements.`,
        },
        { role: 'user', content: description },
      ],
      thinking: { type: 'disabled' },
    });
    const raw = (completion.choices[0]?.message?.content || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const spec = parseSpec(raw);
    if (spec.type !== type) throw new Error('type mismatch');
    return spec;
  } catch {
    // Fall back to the editorial example for this type so the user always gets a valid diagram.
    return { ...EXAMPLE_SPECS[type], title: description.slice(0, 60) } as DiagramSpec;
  }
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
