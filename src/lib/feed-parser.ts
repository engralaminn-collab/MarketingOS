/**
 * Minimal RSS/Atom feed parser — no external dependencies.
 * Supports RSS 2.0, RSS 1.0 (RDF), and Atom 1.0 feeds.
 *
 * Inspired by DIYgod/RSSHub but simpler: just fetch + parse XML, no route generation.
 */
import { db } from './db';
import { safeFetchText } from './ssrf';

export interface ParsedFeed {
  title: string;
  description: string | null;
  link: string | null;
  items: ParsedFeedItem[];
}

export interface ParsedFeedItem {
  title: string;
  link: string;
  description: string | null;
  author: string | null;
  publishedAt: Date;
  guid: string | null;
}

/**
 * Fetch + parse a feed URL. Returns null on failure.
 */
export async function fetchAndParseFeed(feedUrl: string): Promise<ParsedFeed | null> {
  try {
    const res = await safeFetchText(feedUrl, {
      timeoutMs: 10_000,
      maxResponseBytes: 1_500_000,
      headers: {
        'User-Agent': 'MarketingOS-RSSReader/1.0',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) return null;
    const xml = await res.text();
    return parseFeedXml(xml, feedUrl);
  } catch (error) {
    console.warn('[fetchAndParseFeed] request failed:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}

/**
 * Parse RSS/Atom XML into a normalized shape.
 * Uses regex-based parsing (no DOM parser dependency) — fast and good-enough.
 */
export function parseFeedXml(xml: string, sourceUrl: string): ParsedFeed | null {
  // Detect feed type
  if (xml.includes('<feed') && xml.includes('xmlns')) {
    return parseAtom(xml, sourceUrl);
  }
  if (xml.includes('<rdf:RDF')) {
    return parseRdf(xml, sourceUrl);
  }
  return parseRss(xml, sourceUrl);
}

function parseRss(xml: string, sourceUrl: string): ParsedFeed {
  // Channel-level metadata
  const channelTitle = extractTag(xml, 'title') || sourceUrl;
  const channelDesc = extractTag(xml, 'description');
  const channelLink = extractTag(xml, 'link');

  // Items — split on <item>...</item>
  const items: ParsedFeedItem[] = [];
  const itemMatches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
  for (const m of itemMatches) {
    const itemXml = m[1];
    const title = extractTag(itemXml, 'title') || '(untitled)';
    let link = extractTag(itemXml, 'link') || '';
    // Some RSS feeds put link in <link>text</link>, others in <link href="..."/>
    if (!link) {
      const hrefMatch = itemXml.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (hrefMatch) link = hrefMatch[1];
    }
    let description = extractTag(itemXml, 'description');
    // Strip CDATA wrapper if present
    if (description && description.startsWith('<![CDATA[')) {
      description = description.slice(9, -3);
    }
    // Strip HTML tags from description (keep first 500 chars)
    if (description) {
      description = description.replace(/<[^>]+>/g, '').trim().slice(0, 500);
    }
    const pubDate = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date');
    const author = extractTag(itemXml, 'dc:creator') || extractTag(itemXml, 'author');
    const guid = extractTag(itemXml, 'guid');

    items.push({
      title: title.trim(),
      link: link.trim(),
      description,
      author: author || null,
      publishedAt: pubDate ? new Date(pubDate) : new Date(),
      guid: guid || null,
    });
  }

  return {
    title: channelTitle,
    description: channelDesc || null,
    link: channelLink || null,
    items,
  };
}

function parseAtom(xml: string, sourceUrl: string): ParsedFeed {
  // Atom: <feed><title>...</title><entry>...</entry></feed>
  const title = extractTag(xml, 'title') || sourceUrl;
  const subtitle = extractTag(xml, 'subtitle');
  // First <link href="..."/> without rel="alternate" or with rel="self"
  const linkMatch = xml.match(/<link[^>]*href=["']([^"']+)["']/i);
  const link = linkMatch ? linkMatch[1] : null;

  const items: ParsedFeedItem[] = [];
  const entryMatches = xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi);
  for (const m of entryMatches) {
    const entryXml = m[1];
    const entryTitle = extractTag(entryXml, 'title') || '(untitled)';
    const entryLinkMatch = entryXml.match(/<link[^>]*href=["']([^"']+)["']/i);
    const entryLink = entryLinkMatch ? entryLinkMatch[1] : '';
    const summary = extractTag(entryXml, 'summary') || extractTag(entryXml, 'content');
    let description = summary;
    if (description && description.startsWith('<![CDATA[')) {
      description = description.slice(9, -3);
    }
    if (description) {
      description = description.replace(/<[^>]+>/g, '').trim().slice(0, 500);
    }
    const updated = extractTag(entryXml, 'updated') || extractTag(entryXml, 'published');
    const author = extractTag(entryXml, 'name'); // <author><name>...</name></author>
    const id = extractTag(entryXml, 'id');

    items.push({
      title: entryTitle.trim(),
      link: entryLink.trim(),
      description,
      author: author || null,
      publishedAt: updated ? new Date(updated) : new Date(),
      guid: id || null,
    });
  }

  return {
    title,
    description: subtitle || null,
    link,
    items,
  };
}

function parseRdf(xml: string, sourceUrl: string): ParsedFeed {
  // RDF Site Summary (RSS 1.0) — uses <rdf:RDF> + <item rdf:about="...">
  const channelTitle = extractTag(xml, 'title') || sourceUrl;
  const channelDesc = extractTag(xml, 'description');

  const items: ParsedFeedItem[] = [];
  // <item rdf:about="URL">...</item>
  const itemMatches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
  for (const m of itemMatches) {
    const itemXml = m[1];
    const title = extractTag(itemXml, 'title') || '(untitled)';
    const link = extractTag(itemXml, 'link') || '';
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'dc:date');
    const author = extractTag(itemXml, 'dc:creator');
    const about = itemXml.match(/rdf:about=["']([^"']+)["']/i);

    items.push({
      title: title.trim(),
      link: link.trim() || (about ? about[1] : ''),
      description: description ? description.replace(/<[^>]+>/g, '').trim().slice(0, 500) : null,
      author: author || null,
      publishedAt: pubDate ? new Date(pubDate) : new Date(),
      guid: about ? about[1] : null,
    });
  }

  return {
    title: channelTitle,
    description: channelDesc || null,
    link: sourceUrl,
    items,
  };
}

function extractTag(xml: string, tag: string): string | null {
  // Match <tag>...</tag> or <tag attr="...">...</tag>
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return null;
  let content = m[1].trim();
  // Strip CDATA wrapper
  if (content.startsWith('<![CDATA[')) {
    content = content.slice(9, -3);
  }
  return content;
}

/**
 * Refresh a single FeedSource: fetch + parse + upsert all items.
 * Returns the number of new items found.
 */
export async function refreshFeedSource(feedSourceId: string): Promise<number> {
  const source = await db.feedSource.findUnique({ where: { id: feedSourceId } });
  if (!source) return 0;

  const parsed = await fetchAndParseFeed(source.url);
  if (!parsed) {
    await db.feedSource.update({
      where: { id: feedSourceId },
      data: { lastError: 'Failed to fetch or parse feed', lastFetchedAt: new Date() },
    });
    return 0;
  }

  // Update source metadata if missing
  if (!source.name || source.name === source.url) {
    await db.feedSource.update({
      where: { id: feedSourceId },
      data: { name: parsed.title.slice(0, 100), lastError: null, lastFetchedAt: new Date() },
    });
  } else {
    await db.feedSource.update({
      where: { id: feedSourceId },
      data: { lastError: null, lastFetchedAt: new Date() },
    });
  }

  // Upsert items — only insert new ones (skip duplicates via unique constraint)
  let newCount = 0;
  for (const item of parsed.items) {
    if (!item.link) continue;
    try {
      await db.feedItem.create({
        data: {
          sourceId: feedSourceId,
          title: item.title.slice(0, 500),
          link: item.link,
          description: item.description,
          author: item.author,
          publishedAt: item.publishedAt,
          guid: item.guid,
          companyId: source.companyId,
        },
      });
      newCount++;
    } catch (err: any) {
      // Unique constraint violation = duplicate, skip
      if (err?.code !== 'P2002') {
        console.error('[refreshFeedSource] insert failed:', err);
      }
    }
  }
  return newCount;
}
