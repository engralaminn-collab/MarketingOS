'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Plug,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ExternalLink,
  Settings2,
  Zap,
  Eye,
  EyeOff,
  TestTube2,
  Globe,
  Bot,
  Database,
  Shield,
  Mail,
  CreditCard,
  BarChart3,
  MessageSquare,
  Radio,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/stores/app-store';
import { toast } from 'sonner';

// ==================== TYPES ====================

interface Credential {
  key: string;
  label: string;
  isSecret: boolean;
  optional?: boolean;
}

interface ToolConnection {
  id: string;
  status: string;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  totalCalls: number;
  errorCount: number;
  hasCredentials: boolean;
}

interface Tool {
  id: string;
  toolNumber: number;
  name: string;
  url: string;
  authType: string;
  requiredCredentials: Credential[];
  connectionType: string;
  category: string;
  subcategory: string | null;
  capabilities: string;
  automationLevel: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  connection: ToolConnection | null;
}

interface ToolsResponse {
  tools: Tool[];
  total: number;
  configured: number;
  connected: number;
  disconnected: number;
  categoryBreakdown: Record<string, { total: number; configured: number }>;
  automationBreakdown: Record<string, number>;
}

// ==================== CATEGORY CONFIG ====================

const CATEGORY_CONFIG: Record<string, { label: string; icon: LucideIcon; color: string; gradient: string }> = {
  google: { label: 'Google', icon: Globe, color: '#4285F4', gradient: 'from-blue-500 to-blue-600' },
  meta: { label: 'Meta', icon: MessageSquare, color: '#1877F2', gradient: 'from-blue-600 to-blue-700' },
  tiktok: { label: 'TikTok', icon: Radio, color: '#000000', gradient: 'from-gray-700 to-gray-900' },
  linkedin: { label: 'LinkedIn', icon: Globe, color: '#0A66C2', gradient: 'from-sky-600 to-sky-700' },
  reddit: { label: 'Reddit', icon: MessageSquare, color: '#FF4500', gradient: 'from-orange-500 to-red-600' },
  telegram: { label: 'Telegram', icon: MessageSquare, color: '#0088CC', gradient: 'from-sky-500 to-sky-600' },
  discord: { label: 'Discord', icon: MessageSquare, color: '#5865F2', gradient: 'from-violet-500 to-violet-600' },
  twitter: { label: 'X / Twitter', icon: Globe, color: '#000000', gradient: 'from-gray-800 to-gray-900' },
  pinterest: { label: 'Pinterest', icon: Radio, color: '#E60023', gradient: 'from-red-600 to-red-700' },
  content: { label: 'Content Platforms', icon: Globe, color: '#6366F1', gradient: 'from-indigo-500 to-indigo-600' },
  bd_platform: { label: 'BD Platforms', icon: Globe, color: '#EC4899', gradient: 'from-pink-500 to-pink-600' },
  scholarship: { label: 'Scholarships', icon: Zap, color: '#F59E0B', gradient: 'from-amber-500 to-amber-600' },
  university: { label: 'University Networks', icon: Globe, color: '#8B5CF6', gradient: 'from-violet-500 to-violet-600' },
  google_workspace: { label: 'Google Workspace', icon: Globe, color: '#34A853', gradient: 'from-green-500 to-emerald-600' },
  microsoft: { label: 'Microsoft', icon: Globe, color: '#0078D4', gradient: 'from-blue-600 to-blue-700' },
  communication: { label: 'Communication', icon: MessageSquare, color: '#006BFF', gradient: 'from-blue-500 to-blue-600' },
  crm: { label: 'CRM', icon: Database, color: '#FF7A59', gradient: 'from-orange-500 to-orange-600' },
  email: { label: 'Email / SMS', icon: Mail, color: '#1A82E2', gradient: 'from-sky-500 to-sky-600' },
  ai_provider: { label: 'AI Providers', icon: Bot, color: '#10A37F', gradient: 'from-emerald-500 to-teal-600' },
  audio: { label: 'Audio', icon: Radio, color: '#7C3AED', gradient: 'from-violet-500 to-purple-600' },
  payment: { label: 'Payments', icon: CreditCard, color: '#635BFF', gradient: 'from-violet-500 to-violet-600' },
  tracking: { label: 'Tracking', icon: Eye, color: '#F97316', gradient: 'from-orange-500 to-orange-600' },
  security: { label: 'Security', icon: Shield, color: '#F48120', gradient: 'from-orange-500 to-amber-600' },
  notification: { label: 'Notifications', icon: Radio, color: '#EE4B2B', gradient: 'from-red-500 to-red-600' },
  infrastructure: { label: 'Infrastructure', icon: Database, color: '#336791', gradient: 'from-slate-500 to-slate-600' },
  devops: { label: 'DevOps', icon: Settings2, color: '#FF4A00', gradient: 'from-orange-500 to-red-600' },
  alo_internal: { label: 'ALO Internal', icon: Zap, color: '#F97316', gradient: 'from-orange-400 to-orange-600' },
};

const AUTH_LABELS: Record<string, string> = {
  oauth2: 'OAuth 2.0',
  api_key: 'API Key',
  bot_token: 'Bot Token',
  partner: 'Partner',
  none: 'No Auth',
  internal: 'Internal',
};

const AUTO_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  AUTO: { label: 'Auto', variant: 'default' },
  LIMITED: { label: 'Limited', variant: 'secondary' },
  MANUAL: { label: 'Manual', variant: 'outline' },
  CHECK: { label: 'Check', variant: 'secondary' },
  PARTNER: { label: 'Partner', variant: 'outline' },
  'AUTO/LIMITED': { label: 'Auto/Ltd', variant: 'default' },
  'MANUAL/AUTO CONTENT': { label: 'Semi-Auto', variant: 'secondary' },
};

// ==================== STAT CARD ====================

function StatCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-2xl font-bold ${accent || ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ==================== CATEGORY ROW ====================

function CategoryRow({
  category,
  total,
  configured,
  isSelected,
  onClick,
}: {
  category: string;
  total: number;
  configured: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const cfg = CATEGORY_CONFIG[category] || { label: category, icon: Plug, color: '#666', gradient: 'from-gray-500 to-gray-600' };
  const Icon = cfg.icon;
  const pct = total > 0 ? Math.round((configured / total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group
        ${isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent/50 border border-transparent'}`}
    >
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shrink-0`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium truncate">{cfg.label}</p>
          <span className="text-xs text-muted-foreground ml-2 shrink-0">
            {configured}/{total}
          </span>
        </div>
        <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-chart-2 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </button>
  );
}

// ==================== TOOL CARD ====================

function ToolCard({ tool, onConnect, onDisconnect }: { tool: Tool; onConnect: (t: Tool) => void; onDisconnect: (toolId: string) => void }) {
  const isConfigured = Boolean(tool.connection && !['disconnected', 'revoked'].includes(tool.connection.status));
  const hasError = tool.connection?.status === 'error';
  const catCfg = CATEGORY_CONFIG[tool.category] || { label: tool.category, color: '#666' };
  const autoCfg = AUTO_LABELS[tool.automationLevel] || { label: tool.automationLevel, variant: 'outline' as const };

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
      <Card className={`group hover:shadow-md transition-all duration-200 ${isConfigured ? 'border-primary/30 bg-primary/[0.03]' : 'border-border/50 bg-card/50'}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm" style={{ backgroundColor: tool.color || catCfg.color || '#666' }}>
              {tool.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold truncate">{tool.name}</h3>
                <span className="text-[10px] text-muted-foreground font-mono">#{String(tool.toolNumber).padStart(3, '0')}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tool.capabilities}</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <Badge variant={autoCfg.variant} className="text-[9px] px-1.5 py-0 h-4">{autoCfg.label}</Badge>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{AUTH_LABELS[tool.authType] || tool.authType}</Badge>
                {isConfigured && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-600">Credentials saved · not verified</Badge>}
                {hasError && <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4"><XCircle className="w-2.5 h-2.5 mr-0.5" />Configuration error</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="sm" variant={isConfigured ? 'outline' : 'default'} className="h-7 text-xs" disabled={tool.requiredCredentials.length === 0} onClick={() => onConnect(tool)}>
                <Settings2 className="w-3 h-3 mr-1" />{isConfigured ? 'Edit' : 'Configure'}
              </Button>
              {isConfigured && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" aria-label={`Remove ${tool.name} credentials`} onClick={() => onDisconnect(tool.id)}><XCircle className="w-3.5 h-3.5" /></Button>}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ==================== CONNECT DIALOG ====================

function ConnectDialog({
  tool,
  open,
  onClose,
  onConnect,
}: {
  tool: Tool | null;
  open: boolean;
  onClose: () => void;
  onConnect: (toolId: string, credentials: Record<string, string>) => Promise<void>;
}) {
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!tool) return;
    setError(null);
    setLoading(true);
    try {
      await onConnect(tool.id, creds);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const toggleSecret = (key: string) => setShowSecrets((previous) => ({ ...previous, [key]: !previous[key] }));
  if (!tool) return null;
  const catCfg = CATEGORY_CONFIG[tool.category] || { label: tool.category, color: '#666' };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: tool.color || catCfg.color || '#666' }}>{tool.name.charAt(0)}</div>
            <div><p>{tool.name}</p><p className="text-xs text-muted-foreground font-normal">#{String(tool.toolNumber).padStart(3, '0')} &middot; {catCfg.label}</p></div>
          </DialogTitle>
          <DialogDescription>{tool.description || tool.capabilities}</DialogDescription>
        </DialogHeader>
        <Separator />
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          Credentials are encrypted before storage. Saving them does not verify the provider. Text AI uses self-hosted Ollama by default; OpenRouter is used only when the server explicitly sets AI_PROVIDER=openrouter. Mureka is an optional external music API and may incur charges; most other catalog entries remain setup-only.
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Credentials</p>
            <Badge variant="outline" className="text-[10px]">{AUTH_LABELS[tool.authType] || tool.authType}</Badge>
          </div>
          {tool.requiredCredentials.length === 0 ? (
            <p className="text-xs text-muted-foreground">This catalog entry has no credential fields and cannot be connected automatically in this build.</p>
          ) : tool.requiredCredentials.map((credential) => (
            <div key={credential.key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{credential.label}{!credential.optional && <span className="text-destructive ml-1">*</span>}</Label>
              <div className="relative">
                <Input
                  type={credential.isSecret && !showSecrets[credential.key] ? 'password' : 'text'}
                  placeholder={`Enter ${credential.label.toLowerCase()}`}
                  value={creds[credential.key] || ''}
                  onChange={(event) => setCreds((previous) => ({ ...previous, [credential.key]: event.target.value }))}
                  className="pr-10 font-mono text-xs"
                  autoComplete="off"
                />
                {credential.isSecret && <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => toggleSecret(credential.key)}>{showSecrets[credential.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</Button>}
              </div>
            </div>
          ))}
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <Separator />
        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild><a href={tool.url} target="_blank" rel="noopener noreferrer" className="text-xs"><ExternalLink className="w-3.5 h-3.5 mr-1" />Get credentials</a></Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button size="sm" onClick={handleConnect} disabled={loading || tool.requiredCredentials.length === 0}>
              {loading ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <><Plug className="w-3.5 h-3.5 mr-1" />Save Credentials</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== MAIN VIEW ====================

export function IntegrationsView() {
  const { user } = useAppStore();
  const [data, setData] = useState<ToolsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [connectTool, setConnectTool] = useState<Tool | null>(null);
  const [showCategories, setShowCategories] = useState(true);

  // Read the token out of the store once, so the callback below closes over a
  // plain string instead of the whole `user` object. That makes the inferred
  // dependencies match the declared ones (react-hooks/preserve-manual-memoization)
  // while still re-running the request whenever the token actually changes.
  const authToken = user?.token ?? null;

  // Every state update below happens after an `await`, so this can be called
  // straight from an effect without writing state synchronously during render.
  // Results from an aborted request (filter change or unmount) are dropped.
  const fetchTools = useCallback(
    async (signal?: AbortSignal) => {
      if (!authToken) return;
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (selectedCategory) params.set('category', selectedCategory);
        const res = await fetch(`/api/tools?${params}`, {
          headers: { Authorization: `Bearer ${authToken}` },
          signal,
        });
        const json = await res.json();
        if (signal?.aborted) return;
        if (!res.ok) throw new Error(json.error || 'Failed to load integrations');
        if (json.tools) setData(json);
      } catch {
        // silent
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [authToken, search, selectedCategory]
  );

  // Refresh after a successful connect — runs from an event handler.
  const reloadTools = useCallback(() => {
    setLoading(true);
    void fetchTools();
  }, [fetchTools]);

  React.useEffect(() => {
    const controller = new AbortController();
    // Dispatched inside an async scope so the effect body itself performs no
    // state update; every setState in the loader runs after the response awaits.
    void (async () => {
      await fetchTools(controller.signal);
    })();
    return () => controller.abort();
  }, [fetchTools]);

  const filteredTools = useMemo(() => {
    if (!data?.tools) return [];
    let tools = data.tools;
    if (search) {
      const q = search.toLowerCase();
      tools = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.capabilities.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          String(t.toolNumber).includes(q)
      );
    }
    if (selectedCategory) {
      tools = tools.filter((t) => t.category === selectedCategory);
    }
    return tools;
  }, [data?.tools, search, selectedCategory]);

  const handleConnect = async (toolId: string, credentials: Record<string, string>) => {
    if (!user?.token) throw new Error('Please sign in again');
    const res = await fetch('/api/tools', {
      method: 'POST',
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId, credentials }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Unable to save credentials');
    toast.success(json.message || 'Credentials saved. Provider connectivity was not tested.');
    setConnectTool(null);
    reloadTools();
  };

  const handleDisconnect = async (toolId: string) => {
    if (!user?.token) return;
    try {
      const res = await fetch(`/api/tools/${toolId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Unable to remove configuration');
      toast.success('Stored credentials removed');
      reloadTools();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to remove configuration');
    }
  };

  // Pull the field out before memoizing so the inferred dependency is the
  // breakdown itself rather than the enclosing `data` object.
  const categoryBreakdown = data?.categoryBreakdown;

  const sortedCategories = useMemo(() => {
    if (!categoryBreakdown) return [];
    return Object.entries(categoryBreakdown).sort((a, b) => b[1].total - a[1].total);
  }, [categoryBreakdown]);

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Integrations" value={data?.total ?? '-'} />
        <StatCard label="Configured (not live)" value={data?.configured ?? '-'} accent="text-amber-500" />
        <StatCard label="Disconnected" value={data?.disconnected ?? '-'} />
        <StatCard label="Categories" value={sortedCategories.length || '-'} />
      </div>

      {/* Search + Filter Bar */}
      <Card className="bg-card/50 border-border/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search integrations by name, category, or capability..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Button
              variant={selectedCategory ? 'default' : 'outline'}
              size="sm"
              className="shrink-0 h-9"
              onClick={() => setSelectedCategory(null)}
            >
              <Filter className="w-3.5 h-3.5 mr-1" />
              {selectedCategory ? 'Clear' : 'Filter'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="md:hidden h-9"
              onClick={() => setShowCategories(!showCategories)}
            >
              {showCategories ? 'Hide' : 'Show'} Categories
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        {/* Category Sidebar */}
        <div className={`w-56 shrink-0 space-y-1 ${showCategories ? 'block' : 'hidden md:block'}`}>
          <div className="sticky top-16">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-2">
              Categories ({sortedCategories.length})
            </p>
            <ScrollArea className="max-h-[calc(100vh-280px)]">
              <div className="space-y-0.5">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-all
                    ${!selectedCategory ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center">
                    <Plug className="w-4 h-4 text-white" />
                  </div>
                  All Tools
                  <span className="ml-auto text-xs">{data?.total ?? 0}</span>
                </button>
                {sortedCategories.map(([cat, info]) => (
                  <CategoryRow
                    key={cat}
                    category={cat}
                    total={info.total}
                    configured={info.configured}
                    isSelected={selectedCategory === cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Tool Grid */}
        <div className="flex-1 min-w-0">
          {loading && !data ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-60" />
                      </div>
                      <Skeleton className="h-7 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{filteredTools.length}</span> of {data?.total} tools
                </p>
                {selectedCategory && (
                  <Badge variant="secondary" className="text-xs">
                    {CATEGORY_CONFIG[selectedCategory]?.label || selectedCategory}
                    <XCircle className="w-3 h-3 ml-1 cursor-pointer" onClick={() => setSelectedCategory(null)} />
                  </Badge>
                )}
              </div>
              <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                <AnimatePresence mode="popLayout">
                  {filteredTools.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} onConnect={setConnectTool} onDisconnect={handleDisconnect} />
                  ))}
                </AnimatePresence>
                {filteredTools.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Search className="w-10 h-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No tools match your search</p>
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearch(''); setSelectedCategory(null); }}>
                      Clear filters
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Connect Dialog */}
      <ConnectDialog
        key={connectTool?.id ?? 'closed'}
        tool={connectTool}
        open={!!connectTool}
        onClose={() => setConnectTool(null)}
        onConnect={handleConnect}
      />
    </div>
  );
}