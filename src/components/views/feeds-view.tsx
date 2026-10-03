"use client";

import { useState, useCallback } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api-query";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Rss, Plus, RefreshCw, Trash2, ExternalLink, Star, StarOff, FileText,
  Loader2, Newspaper,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface FeedSource {
  id: string;
  name: string;
  url: string;
  category: string;
  isActive: boolean;
  lastFetchedAt: string | null;
  lastError: string | null;
  itemCount: number;
  createdAt: string;
}

interface FeedItem {
  id: string;
  title: string;
  link: string;
  description: string | null;
  author: string | null;
  publishedAt: string;
  isRead: boolean;
  isStarred: boolean;
  source: { id: string; name: string; category: string };
}

export default function FeedsView() {
  const { data: sourcesData, refetch: refetchSources } = useApiQuery<{ data: FeedSource[] } | FeedSource[]>("/api/feeds/sources");
  const { data: itemsData, refetch: refetchItems, isLoading: itemsLoading } = useApiQuery<{ data: FeedItem[]; unreadCount: number } | FeedItem[]>("/api/feeds/items?limit=50");

  const [addOpen, setAddOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ url: "", name: "", category: "general" });
  const [filter, setFilter] = useState<string>("all"); // all | unread | starred | source:xxx

  const addMut = useApiMutation({
    method: "POST",
    path: "/api/feeds/sources",
    onSuccess: () => { toast.success("Feed added — refreshing..."); setAddOpen(false); setForm({ url: "", name: "", category: "general" }); refetchSources(); },
    onError: (e) => toast.error(e),
  });

  const handleRefresh = useCallback(async (sourceId?: string) => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem("mos_token");
      const res = await fetch("/api/feeds/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(sourceId ? { sourceId } : {}),
      });
      if (!res.ok) throw new Error("Refresh failed");
      const json = await res.json();
      const total = json.data?.totalNew ?? json.totalNew ?? 0;
      toast.success(`Refreshed — ${total} new items`);
      refetchSources();
      refetchItems();
    } catch {
      toast.error("Failed to refresh feeds");
    } finally {
      setRefreshing(false);
    }
  }, [refetchSources, refetchItems]);

  const handleDeleteSource = useCallback(async (id: string) => {
    if (!confirm("Delete this feed source and all its items?")) return;
    try {
      const token = localStorage.getItem("mos_token");
      const res = await fetch(`/api/feeds/sources/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Feed source deleted");
      refetchSources();
      refetchItems();
    } catch {
      toast.error("Failed to delete feed source");
    }
  }, [refetchSources, refetchItems]);

  const handleImportItem = useCallback(async (itemId: string) => {
    try {
      const token = localStorage.getItem("mos_token");
      const res = await fetch("/api/feeds/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err.error?.includes("Already imported")) {
          toast.info("Already imported as content");
          return;
        }
        throw new Error(err.error || "Failed");
      }
      toast.success("Imported as content draft");
      refetchItems();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import");
    }
  }, [refetchItems]);

  const sources = sourcesData ? (Array.isArray(sourcesData) ? sourcesData : sourcesData.data) : [];
  const items = itemsData ? (Array.isArray(itemsData) ? itemsData : itemsData.data) : [];
  const unreadCount = Array.isArray(itemsData) ? items.filter((i: FeedItem) => !i.isRead).length : (itemsData?.unreadCount ?? 0);

  const filtered = items.filter((item: FeedItem) => {
    if (filter === "unread") return !item.isRead;
    if (filter === "starred") return item.isStarred;
    if (filter.startsWith("source:")) return item.source.id === filter.slice(7);
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-blue-600 bg-clip-text text-transparent flex items-center gap-2">
            <Rss className="h-6 w-6 text-orange-500" />
            RSS Feeds
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Curate content from RSS sources — refresh, read, and import to your content queue
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleRefresh()} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh All
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Feed
          </Button>
        </div>
      </div>

      {/* Sources + Items */}
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Sources Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sources ({sources.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <button
              onClick={() => setFilter("all")}
              className={`w-full text-left px-2 py-1.5 rounded text-xs ${filter === "all" ? "bg-primary/10 text-primary" : "hover:bg-accent/50"}`}
            >
              All items ({items.length})
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`w-full text-left px-2 py-1.5 rounded text-xs ${filter === "unread" ? "bg-primary/10 text-primary" : "hover:bg-accent/50"}`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter("starred")}
              className={`w-full text-left px-2 py-1.5 rounded text-xs ${filter === "starred" ? "bg-primary/10 text-primary" : "hover:bg-accent/50"}`}
            >
              Starred (imported)
            </button>
            <div className="border-t border-border/40 my-2" />
            {sources.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-4">No sources yet</p>
            ) : sources.map((s: FeedSource) => (
              <div key={s.id} className="group">
                <button
                  onClick={() => setFilter(`source:${s.id}`)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs ${filter === `source:${s.id}` ? "bg-primary/10 text-primary" : "hover:bg-accent/50"}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="flex-1 truncate font-medium">{s.name}</span>
                    <Badge variant="secondary" className="text-[9px] h-3.5 px-1">{s.itemCount}</Badge>
                  </div>
                  <p className="text-[9px] text-muted-foreground/60 truncate">{s.category}</p>
                </button>
                <div className="opacity-0 group-hover:opacity-100 flex gap-1 px-2 pb-1 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRefresh(s.id)} disabled={refreshing}>
                    <RefreshCw className={`h-2.5 w-2.5 ${refreshing ? "animate-spin" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteSource(s.id)}>
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Items List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {filter === "all" ? "All Feed Items" : filter === "unread" ? "Unread Items" : filter === "starred" ? "Starred / Imported" : "Filtered Items"}
              <span className="text-muted-foreground ml-1">({filtered.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {itemsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Newspaper className="h-10 w-10 opacity-40 mb-2" />
                <p className="text-xs">No feed items yet.</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Add a feed source and click "Refresh All"</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
                {filtered.map((item: FeedItem) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg border border-border/60 p-3 group ${!item.isRead ? "bg-primary/5 border-primary/30" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold hover:text-primary flex items-start gap-1"
                      >
                        <span className="flex-1">{item.title}</span>
                        <ExternalLink className="h-3 w-3 mt-1 shrink-0 text-muted-foreground/60" />
                      </a>
                      <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleImportItem(item.id)}
                          title="Import to content queue"
                        >
                          <FileText className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Badge variant="secondary" className="text-[9px] h-3.5 px-1">{item.source.name}</Badge>
                      {item.author && <span>by {item.author}</span>}
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}</span>
                      {item.isStarred && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Feed Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add RSS Feed</DialogTitle>
            <DialogDescription>Enter a feed URL — we&apos;ll auto-detect the name from the feed</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="feed-url">Feed URL *</Label>
              <Input
                id="feed-url"
                placeholder="https://example.com/feed.xml"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">
                Accepts RSS 2.0, RSS 1.0 (RDF), or Atom 1.0 feeds
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="feed-name">Name (optional)</Label>
                <Input
                  id="feed-name"
                  placeholder="Auto-detected from feed"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feed-cat">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger id="feed-cat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="tech">Tech</SelectItem>
                    <SelectItem value="ai">AI / ML</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="news">News</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-md bg-muted/30 p-2 text-[10px] text-muted-foreground">
              💡 Tip: Try these popular feeds —
              <code className="ml-1">https://hnrss.org/frontpage</code>,
              <code className="ml-1">https://www.theverge.com/rss/index.xml</code>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                addMut.mutate({ url: form.url, name: form.name || undefined, category: form.category });
              }}
              disabled={!form.url.trim() || addMut.isLoading}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white"
            >
              {addMut.isLoading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Add Feed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
