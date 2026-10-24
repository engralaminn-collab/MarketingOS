import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateChatCompletion, generateEmbeddingVector } from '@/lib/ai-provider';
import { retrieveMemories } from '@/lib/ai-extensions';
import { cosineSimilarity } from '@/lib/free-ai-stack';

function extractWikiLinks(markdown: string): string[] {
  const matches = markdown.matchAll(/\[\[([^\[\]|#]+)(?:\|[^\[\]]+)?\]\]/g);
  return Array.from(new Set(Array.from(matches, (m) => m[1].trim()).filter(Boolean)));
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const [nodes, sops, memories] = await Promise.all([
      db.knowledgeNode.findMany({
        where: { companyId: actor.companyId },
        orderBy: { updatedAt: 'desc' },
        take: 120,
      }),
      db.sop.findMany({
        where: { companyId: actor.companyId },
        orderBy: { updatedAt: 'desc' },
        take: 40,
      }),
      retrieveMemories(actor.companyId, 'all', undefined, 30),
    ]);

    const titleToId = new Map(nodes.map((n) => [n.title.toLowerCase(), n.id]));
    const edges: Array<{ from: string; to: string; label: string }> = [];

    const enrichedNodes = nodes.map((n) => {
      let tags: string[] = [];
      try {
        tags = JSON.parse(n.tags || '[]');
      } catch {
        tags = [];
      }
      const links = extractWikiLinks(n.content);
      for (const linkTitle of links) {
        const targetId = titleToId.get(linkTitle.toLowerCase());
        if (targetId && targetId !== n.id) {
          edges.push({ from: n.id, to: targetId, label: linkTitle });
        }
      }
      return {
        id: n.id,
        title: n.title,
        summary: n.summary || n.content.slice(0, 160),
        content: n.content,
        category: n.category,
        nodeType: n.nodeType,
        tags,
        wikiLinks: links,
        accessCount: n.accessCount,
        rating: n.rating,
        updatedAt: n.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({
      data: {
        nodes: enrichedNodes,
        edges,
        sops: sops.map((s) => ({
          id: s.id,
          sopId: s.id,
          title: s.name,
          category: s.category,
          purpose: s.description || '',
        })),
        memories,
      },
    });
  } catch (error) {
    console.error('[GET /api/knowledge/wiki]', error);
    return NextResponse.json({ error: 'Failed to load Knowledge Wiki' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'JSON object required' }, { status: 400 });
    }

    // RAG Query mode with citations (docGPT-langchain / llm_wiki / OpenViking)
    if (body.action === 'ask') {
      const question = String(body.question || '').trim();
      if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 });

      const [nodes, sops, qVec] = await Promise.all([
        db.knowledgeNode.findMany({ where: { companyId: actor.companyId }, take: 120 }),
        db.sop.findMany({ where: { companyId: actor.companyId }, take: 40 }),
        generateEmbeddingVector(question),
      ]);

      const corpus = [
        ...nodes.map((n) => ({ id: n.id, source: 'wiki', title: n.title, category: n.category, content: n.content })),
        ...sops.map((s) => ({ id: s.id, source: 'sop', title: s.name, category: s.category, content: `${s.description || ''}\n${s.steps}` })),
      ];

      const scored = await Promise.all(
        corpus.map(async (doc) => {
          const dVec = await generateEmbeddingVector(`${doc.title}\n${doc.content.slice(0, 800)}`);
          const sim = cosineSimilarity(qVec.vector, dVec.vector);
          const lexical = doc.title.toLowerCase().includes(question.toLowerCase()) ? 0.25 : 0;
          return { ...doc, score: Number((sim + lexical).toFixed(4)) };
        }),
      );
      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, 4);

      const contextBlock = top
        .map((c, idx) => `[Citation ${idx + 1}: [[${c.title}]] (${c.source})]\n${c.content.slice(0, 900)}`)
        .join('\n\n');

      let answer = '';
      let mode: 'rag-llm' | 'rag-extractive' = 'rag-extractive';
      try {
        const llm = await generateChatCompletion(
          [
            {
              role: 'system',
              content:
                'Answer the user question strictly using the Knowledge Wiki citations below. Cite sources inline using [[Title]]. If a detail is not in the wiki, state that clearly.',
            },
            { role: 'user', content: `Context:\n${contextBlock}\n\nQuestion: ${question}` },
          ],
          { temperature: 0.2 },
        );
        answer = llm.content;
        mode = 'rag-llm';
      } catch {
        answer = top.length
          ? `Grounded Knowledge Wiki matches (${qVec.provider}):\n\n` +
            top.map((t, i) => `${i + 1}. **[[${t.title}]]** *(score ${t.score})* — ${t.content.slice(0, 260)}…`).join('\n\n')
          : 'No wiki nodes matched yet. Create your first [[Wiki]] page to populate workspace RAG.';
      }

      return NextResponse.json({
        data: {
          answer,
          mode,
          embeddingProvider: qVec.provider,
          citations: top.map((t) => ({
            id: t.id,
            title: t.title,
            source: t.source,
            category: t.category,
            score: t.score,
            excerpt: t.content.slice(0, 220),
          })),
        },
      });
    }

    // Create or Update Wiki Page
    const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : null;
    const title = String(body.title || '').trim().slice(0, 160);
    const content = String(body.content || '').trim().slice(0, 25_000);
    const category = String(body.category || 'marketing-playbook').trim().slice(0, 60);
    const nodeType = String(body.nodeType || 'wiki').trim().slice(0, 40);
    const tags = Array.isArray(body.tags) ? body.tags.map(String).slice(0, 15) : [];

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and markdown content are required' }, { status: 400 });
    }

    const embed = await generateEmbeddingVector(`${title}\n${content.slice(0, 1200)}`);
    const summary = typeof body.summary === 'string' && body.summary.trim()
      ? body.summary.trim().slice(0, 280)
      : content.replace(/[#*`\[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 240);

    if (id) {
      const existing = await db.knowledgeNode.findFirst({ where: { id, companyId: actor.companyId } });
      if (!existing) return NextResponse.json({ error: 'Wiki page not found' }, { status: 404 });
      const updated = await db.knowledgeNode.update({
        where: { id },
        data: {
          title,
          content,
          summary,
          category,
          nodeType,
          tags: JSON.stringify(tags),
          embedding: JSON.stringify(embed.vector.slice(0, 64)),
        },
      });
      return NextResponse.json({ data: { node: updated, wikiLinks: extractWikiLinks(content) } });
    }

    const created = await db.knowledgeNode.create({
      data: {
        title,
        content,
        summary,
        category,
        nodeType,
        tags: JSON.stringify(tags),
        embedding: JSON.stringify(embed.vector.slice(0, 64)),
        companyId: actor.companyId,
      },
    });
    return NextResponse.json({ data: { node: created, wikiLinks: extractWikiLinks(content) } }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/knowledge/wiki]', error);
    return NextResponse.json({ error: 'Failed to save wiki page' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await verifyToken(token);
    if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const id = new URL(req.url).searchParams.get('id')?.trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    await db.knowledgeNode.deleteMany({ where: { id, companyId: actor.companyId } });
    return NextResponse.json({ data: { deleted: true } });
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
