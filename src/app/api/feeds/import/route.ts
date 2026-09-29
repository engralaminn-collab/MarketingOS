import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// POST /api/feeds/import — convert a feed item into a Content row
// Body: { itemId: string }
// This is the "share to content queue" pattern — useful for curation workflows.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { itemId } = body;
    if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 });

    const item = await db.feedItem.findFirst({
      where: { id: String(itemId), companyId: payload.companyId },
      include: { source: true },
    });
    if (!item) return NextResponse.json({ error: 'Feed item not found' }, { status: 404 });

    // Check for existing content with same link to avoid duplicates
    const existingContent = await db.content.findFirst({
      where: { companyId: payload.companyId, mediaUrl: item.link },
    });
    if (existingContent) {
      return NextResponse.json({
        error: 'Already imported as content',
        data: { contentId: existingContent.id },
      }, { status: 409 });
    }

    // Create a Content row with the feed item as a draft blog/social post
    const content = await db.content.create({
      data: {
        title: item.title,
        type: 'blog',
        status: 'draft',
        platform: null,
        body: item.description
          ? `${item.description}\n\nSource: ${item.source.name}\nOriginal: ${item.link}${item.author ? `\nAuthor: ${item.author}` : ''}`
          : `Imported from ${item.source.name}: ${item.link}`,
        mediaUrl: item.link,
        mediaType: 'external',
        thumbnailUrl: null,
        hashtags: '#curated',
        creatorId: payload.userId,
        companyId: payload.companyId,
      },
    });

    // Mark the feed item as starred so it shows up in "imported" filter
    await db.feedItem.update({
      where: { id: item.id },
      data: { isStarred: true, isRead: true },
    });

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'content.imported_from_feed',
      title: 'Feed item imported as content',
      description: `"${item.title}" imported from ${item.source.name}`,
      resourceType: 'content',
      resourceId: content.id,
      link: '/content',
      metadata: { feedItemId: item.id, sourceName: item.source.name },
    });

    return NextResponse.json({
      data: {
        contentId: content.id,
        title: content.title,
        status: content.status,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/feeds/import]', err);
    return NextResponse.json({ error: 'Failed to import feed item' }, { status: 500 });
  }
}
