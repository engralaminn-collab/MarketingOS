import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import {
  REFERENCE_LIBRARY,
  REFERENCE_STATS,
  type ReferenceEntry,
} from '@/data/reference-library';

/**
 * GET /api/ecosystem — the verified open-source reference catalogue.
 *
 * The same catalogue that powers the Ecosystem Library screen is exposed here so
 * that CI, docs and external dashboards can query it without scraping the UI.
 *
 * Query parameters (all optional):
 *   q         free-text search across title, owner, description, topics
 *   category  exact category name
 *   module    exact MarketingOS module name
 *   status    adopted | blueprint | evaluated | license-review | unavailable | external-reference
 *   sort      stars | name | recent
 *   limit     1–200 (default 50)
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const actor = await verifyToken(token);
  if (!actor?.companyId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const category = searchParams.get('category') || 'all';
  const moduleFilter = searchParams.get('module') || 'all';
  const status = searchParams.get('status') || 'all';
  const sort = searchParams.get('sort') || 'stars';
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50) || 50, 1), 200);

  let rows: ReferenceEntry[] = REFERENCE_LIBRARY.filter((entry) => {
    if (category !== 'all' && entry.category !== category) return false;
    if (moduleFilter !== 'all' && entry.module !== moduleFilter) return false;
    if (status !== 'all' && entry.status !== status) return false;
    if (!q) return true;
    return [
      entry.title,
      entry.fullName,
      entry.owner,
      entry.description,
      entry.note,
      entry.module,
      entry.category,
      ...entry.topics,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  rows = [...rows].sort((a, b) => {
    if (sort === 'name') return a.title.localeCompare(b.title);
    if (sort === 'recent') {
      const ta = a.pushedAt ? Date.parse(a.pushedAt) : 0;
      const tb = b.pushedAt ? Date.parse(b.pushedAt) : 0;
      return tb - ta;
    }
    return (b.stars ?? -1) - (a.stars ?? -1);
  });

  return NextResponse.json({
    data: rows.slice(0, limit),
    meta: {
      matched: rows.length,
      returned: Math.min(rows.length, limit),
      total: REFERENCE_STATS.total,
      verifiedAt: REFERENCE_STATS.verifiedAt,
      byStatus: REFERENCE_STATS.byStatus,
      byCategory: REFERENCE_STATS.byCategory,
      byModule: REFERENCE_STATS.byModule,
    },
  });
}
