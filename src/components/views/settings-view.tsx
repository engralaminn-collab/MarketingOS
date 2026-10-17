"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { motion, type Variants } from "framer-motion";
import { useAppStore } from "@/stores/app-store";
import { useApiQuery, useApiMutation } from "@/hooks/use-api-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  CreditCard,
  Shield,
  Key,
  Loader2,
  Save,
  Check,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Globe,
  Palette,
  Target,
  Lock,
  Monitor,
  Zap,
  Crown,
  Rocket,
  Star,
  Gift,
  Building,
  CheckCircle2,
  XCircle,
  Webhook,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Animation Variants ────────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

// ─── Glass Card ────────────────────────────────────────────────────────────────

function GlassCard({
  children,
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<typeof Card>) {
  return (
    <Card
      className={
        "border-border bg-card/60  shadow-lg dark:border-white/5 " +
        className
      }
      {...props}
    >
      {children}
    </Card>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Pricing Plans ──────────────────────────────────────────────────────────────

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: { name: string; included: boolean }[];
  highlight: boolean;
  badge?: string;
  icon: React.ElementType;
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with basic features",
    features: [
      { name: "Storage", included: true },
      { name: "1 Social Account", included: true },
      { name: "50 AI Credits/mo", included: true },
      { name: "Basic Analytics", included: true },
      { name: "Email Support", included: true },
      { name: "SEO: 5 Keywords", included: true },
      { name: "1 Team Member", included: true },
      { name: "API Access", included: false },
      { name: "Custom Branding", included: false },
      { name: "Priority Support", included: false },
    ],
    highlight: false,
    icon: Gift,
  },
  {
    id: "starter",
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "Perfect for small businesses",
    features: [
      { name: "5 GB Storage", included: true },
      { name: "5 Social Accounts", included: true },
      { name: "500 AI Credits/mo", included: true },
      { name: "Advanced Analytics", included: true },
      { name: "Email + Chat Support", included: true },
      { name: "SEO: 25 Keywords", included: true },
      { name: "3 Team Members", included: true },
      { name: "API Access", included: false },
      { name: "Custom Branding", included: false },
      { name: "Priority Support", included: false },
    ],
    highlight: false,
    icon: Rocket,
  },
  {
    id: "professional",
    name: "Professional",
    price: "$99",
    period: "/month",
    description: "For growing marketing teams",
    badge: "Popular",
    features: [
      { name: "25 GB Storage", included: true },
      { name: "15 Social Accounts", included: true },
      { name: "2,500 AI Credits/mo", included: true },
      { name: "Full Analytics Suite", included: true },
      { name: "Priority Support", included: true },
      { name: "SEO: 100 Keywords", included: true },
      { name: "10 Team Members", included: true },
      { name: "API Access", included: true },
      { name: "Custom Branding", included: true },
      { name: "Dedicated Manager", included: false },
    ],
    highlight: true,
    icon: Star,
  },
  {
    id: "agency",
    name: "Agency",
    price: "$249",
    period: "/month",
    description: "For agencies and large teams",
    features: [
      { name: "100 GB Storage", included: true },
      { name: "Unlimited Social", included: true },
      { name: "10,000 AI Credits/mo", included: true },
      { name: "Full Analytics Suite", included: true },
      { name: "24/7 Priority Support", included: true },
      { name: "SEO: Unlimited", included: true },
      { name: "25 Team Members", included: true },
      { name: "Full API Access", included: true },
      { name: "Custom Branding", included: true },
      { name: "Dedicated Manager", included: true },
    ],
    highlight: false,
    icon: Building,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Tailored solutions for enterprises",
    features: [
      { name: "Unlimited Storage", included: true },
      { name: "Unlimited Social", included: true },
      { name: "Unlimited AI Credits", included: true },
      { name: "Custom Analytics", included: true },
      { name: "24/7 Dedicated Support", included: true },
      { name: "SEO: Unlimited", included: true },
      { name: "Unlimited Members", included: true },
      { name: "Full API Access", included: true },
      { name: "Custom Integrations", included: true },
      { name: "SLA Guarantee", included: true },
    ],
    highlight: false,
    icon: Crown,
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: "$999",
    period: "one-time",
    description: "Pay once, use forever",
    badge: "Best Value",
    features: [
      { name: "50 GB Storage", included: true },
      { name: "Unlimited Social", included: true },
      { name: "5,000 AI Credits/mo", included: true },
      { name: "Full Analytics Suite", included: true },
      { name: "Priority Support", included: true },
      { name: "SEO: Unlimited", included: true },
      { name: "15 Team Members", included: true },
      { name: "Full API Access", included: true },
      { name: "Custom Branding", included: true },
      { name: "All Future Updates", included: true },
    ],
    highlight: false,
    icon: Zap,
  },
];

// ─── Mock Sessions ─────────────────────────────────────────────────────────────




// ═══════════════════════════════════════════════════════════════════════════════
// Company Tab
// ═══════════════════════════════════════════════════════════════════════════════

const COMPANY_FORM_DEFAULTS: CompanyForm = {
  name: "",
  website: "",
  industry: "Technology",
  country: "United States",
  primaryColor: "#f97316",
  secondaryColor: "#3b82f6",
  accentColor: "#10b981",
  targetAudience: "",
  marketingGoals: "",
};

interface CompanyForm {
  name: string;
  website: string;
  industry: string;
  country: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  targetAudience: string;
  marketingGoals: string;
}

/** Maps an API company record onto the form shape, applying the same defaults. */
function toCompanyForm(company: any): CompanyForm {
  return {
    name: company.name || COMPANY_FORM_DEFAULTS.name,
    website: company.website || COMPANY_FORM_DEFAULTS.website,
    industry: company.industry || COMPANY_FORM_DEFAULTS.industry,
    country: company.country || COMPANY_FORM_DEFAULTS.country,
    primaryColor: company.primaryColor || COMPANY_FORM_DEFAULTS.primaryColor,
    secondaryColor: company.secondaryColor || COMPANY_FORM_DEFAULTS.secondaryColor,
    accentColor: company.accentColor || COMPANY_FORM_DEFAULTS.accentColor,
    targetAudience: company.targetAudience || COMPANY_FORM_DEFAULTS.targetAudience,
    marketingGoals: company.marketingGoals || COMPANY_FORM_DEFAULTS.marketingGoals,
  };
}

function CompanyTab() {
  // Load real company data from /api/settings/company
  const { data: companyData, refetch } = useApiQuery<{ company: any }>("/api/settings/company");

  const [saving, setSaving] = useState(false);
  // `null` until the user edits something. While it is null the form is derived
  // straight from the server response, so no effect has to copy data into state.
  // Once a draft exists it always wins, which means a background refetch (for
  // example the one fired after a save) can never discard unsaved edits.
  const [draft, setDraft] = useState<CompanyForm | null>(null);

  // Pulled out of `companyData` first so the memo's inferred dependency is this
  // value rather than the enclosing response object.
  const company = companyData?.company ?? null;

  const baseForm = useMemo(
    () => (company ? toCompanyForm(company) : { ...COMPANY_FORM_DEFAULTS }),
    [company],
  );

  const form = draft ?? baseForm;

  const updateField = useCallback(
    (field: keyof CompanyForm, value: string) => {
      setDraft((current) => ({ ...(current ?? baseForm), [field]: value }));
    },
    [baseForm],
  );

  const saveMutation = useApiMutation({
    method: "PUT",
    path: "/api/settings/company",
    onSuccess: () => { toast.success("Company settings saved"); refetch(); },
    onError: () => { toast.error("Failed to save company settings"); },
  });

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      toast.error("Company name is required");
      return;
    }
    setSaving(true);
    try {
      saveMutation.mutate({
        name: form.name,
        website: form.website,
        industry: form.industry,
        country: form.country,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        accentColor: form.accentColor,
        targetAudience: form.targetAudience,
        marketingGoals: form.marketingGoals,
      });
    } finally {
      setTimeout(() => setSaving(false), 1000);
    }
  }, [form, saveMutation]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Company Info */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-orange-500" />
              Company Information
            </CardTitle>
            <CardDescription>Basic details about your company</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-name" className="text-xs font-medium">Company Name</Label>
                <Input
                  id="company-name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Your company name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-website" className="text-xs font-medium flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Website
                </Label>
                <Input
                  id="company-website"
                  value={form.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  placeholder="https://yourcompany.com"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="industry" className="text-xs font-medium">Industry</Label>
                <Select value={form.industry} onValueChange={(v) => updateField("industry", v)}>
                  <SelectTrigger id="industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Technology", "Healthcare", "Finance", "Education", "E-commerce",
                      "Real Estate", "SaaS", "Agency", "Manufacturing", "Other",
                    ].map((ind) => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country" className="text-xs font-medium">Country</Label>
                <Select value={form.country} onValueChange={(v) => updateField("country", v)}>
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "United States", "United Kingdom", "Canada", "Australia", "Germany",
                      "France", "India", "Japan", "Brazil", "Other",
                    ].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </GlassCard>
      </motion.div>

      {/* Brand Colors */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4 text-orange-500" />
              Brand Colors
            </CardTitle>
            <CardDescription>Customize the color palette for your brand</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: "Primary Color", value: form.primaryColor, onChange: (v: string) => updateField("primaryColor", v) },
                { label: "Secondary Color", value: form.secondaryColor, onChange: (v: string) => updateField("secondaryColor", v) },
                { label: "Accent Color", value: form.accentColor, onChange: (v: string) => updateField("accentColor", v) },
              ].map((color) => (
                <div key={color.label} className="space-y-2">
                  <Label className="text-xs font-medium">{color.label}</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="color"
                        value={color.value}
                        onChange={(e) => color.onChange(e.target.value)}
                        className="h-10 w-10 cursor-pointer rounded-lg border border-border dark:border-white/5 overflow-hidden"
                      />
                    </div>
                    <Input
                      value={color.value}
                      onChange={(e) => color.onChange(e.target.value)}
                      className="flex-1 font-mono text-xs"
                      placeholder="#000000"
                    />
                  </div>
                  {/* Color preview swatch */}
                  <div className="h-3 rounded-full" style={{ backgroundColor: color.value }} />
                </div>
              ))}
            </div>
          </CardContent>
        </GlassCard>
      </motion.div>

      {/* Marketing Strategy */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-500" />
              Marketing Strategy
            </CardTitle>
            <CardDescription>Define your target audience and marketing goals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="target-audience" className="text-xs font-medium">Target Audience</Label>
              <Textarea
                id="target-audience"
                value={form.targetAudience}
                onChange={(e) => updateField("targetAudience", e.target.value)}
                rows={3}
                placeholder="Describe your ideal customer..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marketing-goals" className="text-xs font-medium">Marketing Goals</Label>
              <Textarea
                id="marketing-goals"
                value={form.marketingGoals}
                onChange={(e) => updateField("marketingGoals", e.target.value)}
                rows={3}
                placeholder="What are your primary marketing objectives?"
              />
            </div>
          </CardContent>
        </GlassCard>
      </motion.div>

      {/* Save Button */}
      <motion.div variants={itemVariants} className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 min-w-[140px]"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Subscription Tab
// ═══════════════════════════════════════════════════════════════════════════════

function SubscriptionTab() {
  const { data: companyData } = useApiQuery<{ company: { plan?: string; name?: string } }>("/api/settings/company");
  const currentPlanId = (companyData?.company?.plan || "free").toLowerCase();
  const currentPlan = PRICING_PLANS.find((plan) => plan.id === currentPlanId);
  const currentPlanName = currentPlan?.name || currentPlanId.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <GlassCard className="overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-blue-500 p-4">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <p className="text-sm font-medium opacity-80">Workspace Plan</p>
                <p className="text-2xl font-bold">{currentPlanName}</p>
                <p className="text-sm opacity-80 mt-1">Plan is read from the workspace record. No renewal date is available.</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                <Star className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Billing is not connected in this deployment. The catalog below is informational; upgrades, charges, usage quotas, and renewals are not processed or represented as active.
            </p>
          </CardContent>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRICING_PLANS.map((plan) => {
            const isCurrentPlan = plan.id === currentPlanId;
            const PlanIcon = plan.icon;
            return (
              <GlassCard
                key={plan.id}
                className={`relative overflow-hidden flex flex-col ${plan.highlight ? "ring-2 ring-orange-500/50" : ""}`}
              >
                {plan.badge && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] px-2">{plan.badge}</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${plan.highlight ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white" : "bg-muted text-muted-foreground"}`}>
                      <PlanIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{plan.name}</CardTitle>
                      <CardDescription className="text-[10px]">{plan.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="mb-4">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-sm text-muted-foreground ml-1">{plan.period}</span>}
                    <p className="mt-1 text-[10px] text-muted-foreground">Displayed for information only</p>
                  </div>
                  <div className="space-y-2 flex-1">
                    {plan.features.map((feature) => (
                      <div key={feature.name} className="flex items-center gap-2 text-xs">
                        {feature.included ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
                        <span className={feature.included ? "" : "text-muted-foreground/50"}>{feature.name}</span>
                      </div>
                    ))}
                  </div>
                  <Button className="mt-4 w-full" variant={isCurrentPlan ? "default" : "outline"} disabled>
                    {isCurrentPlan ? "Current Workspace Plan" : "Billing Not Configured"}
                  </Button>
                </CardContent>
              </GlassCard>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Security Tab
// ═══════════════════════════════════════════════════════════════════════════════

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Real data: sessions, webhooks, api-keys
  const { data: sessionsData, refetch: refetchSessions } = useApiQuery<{ sessions: any[] }>("/api/settings/sessions");
  const { data: webhooksData, refetch: refetchWebhooks } = useApiQuery<{ webhooks: any[] }>("/api/settings/webhooks");
  const { data: apiKeysData, refetch: refetchApiKeys } = useApiQuery<{ apiKeys: any[] }>("/api/settings/api-keys");

  const sessions = sessionsData?.sessions ?? [];
  const webhooks = webhooksData?.webhooks ?? [];
  const apiKeys = apiKeysData?.apiKeys ?? [];

  const passwordMutation = useApiMutation({
    method: "POST",
    path: "/api/settings/security/password",
    onSuccess: () => {
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: () => {
      toast.error("Failed to change password");
    },
  });

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword.length < 12 || newPassword.length > 128) {
      toast.error("New password must be between 12 and 128 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      await passwordMutation.mutateAsync({ currentPassword, newPassword });
    } catch {
      // The mutation reports a user-facing error.
    } finally {
      setChangingPassword(false);
    }
  }, [currentPassword, newPassword, confirmPassword, passwordMutation]);

  const handleRevokeSession = useCallback(async (sessionId: string) => {
    try {
      const token = localStorage.getItem("mos_token");
      const res = await fetch(`/api/settings/sessions/${sessionId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Session revoked");
      refetchSessions();
    } catch {
      toast.error("Failed to revoke session");
    }
  }, [refetchSessions]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Change Password */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-orange-500" />
              Change Password
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password" className="text-xs font-medium">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-xs font-medium">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 12 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-xs font-medium">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <Button
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25"
            >
              {changingPassword ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Update Password
            </Button>
          </CardContent>
        </GlassCard>
      </motion.div>

      {/* Two-factor authentication is not implemented yet; do not present a fake toggle. */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>Authenticator-based verification is not configured for this deployment.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No two-factor preference is saved and sign-in does not request a second factor. Use a unique password and revoke sessions you do not recognize.
            </p>
          </CardContent>
        </GlassCard>
      </motion.div>

      {/* Session Management */}
      <motion.div variants={itemVariants}>
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="h-4 w-4 text-violet-500" />
              Active Sessions
            </CardTitle>
            <CardDescription>Manage your active sessions across devices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No active sessions recorded</p>
              ) : sessions.map((session: any) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border dark:border-white/5 p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      session.current ? "bg-emerald-500/15" : "bg-muted"
                    }`}>
                      <Monitor className={`h-4 w-4 ${session.current ? "text-emerald-500" : "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {session.device}
                        {session.current && (
                          <Badge variant="outline" className="text-[10px] ml-2 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-1.5">
                            Current
                          </Badge>
                        )}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {session.ip} · {session.location} · {session.lastActive}
                      </p>
                    </div>
                  </div>
                  {!session.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10 text-xs shrink-0"
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Tab
// ═══════════════════════════════════════════════════════════════════════════════

function ApiTab() {
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [newWebhookSignature, setNewWebhookSignature] = useState<string | null>(null);
  const { data: webhooksData, refetch: refetchWebhooks } = useApiQuery<{ webhooks: any[] }>("/api/settings/webhooks");
  const { data: apiKeysData, refetch: refetchApiKeys } = useApiQuery<{ apiKeys: any[] }>("/api/settings/api-keys");
  const webhooks = webhooksData?.webhooks ?? [];
  const apiKeys = apiKeysData?.apiKeys ?? [];

  const handleCopySecret = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error("Clipboard access is unavailable; copy the value manually");
    }
  }, []);

  const handleAddWebhook = useCallback(async () => {
    if (!newWebhookUrl.trim()) {
      toast.error("Enter a webhook URL");
      return;
    }
    try {
      const token = localStorage.getItem("mos_token");
      const res = await fetch("/api/settings/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url: newWebhookUrl, events: ["lead.created", "campaign.completed"] }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to add webhook");
      setNewWebhookSecret(json.webhook.secret);
      setNewWebhookSignature(json.webhook.signatureHeader);
      setNewWebhookUrl("");
      toast.success("Webhook created. Copy the signing secret now; it is shown only once.");
      refetchWebhooks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add webhook");
    }
  }, [newWebhookUrl, refetchWebhooks]);

  const handleDeleteWebhook = useCallback(async (id: string) => {
    try {
      const token = localStorage.getItem("mos_token");
      const res = await fetch(`/api/settings/webhooks/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete webhook");
      toast.success("Webhook deleted");
      refetchWebhooks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete webhook");
    }
  }, [refetchWebhooks]);

  const handleCreateApiKey = useCallback(async () => {
    if (!newKeyName.trim()) {
      toast.error("Enter a name for the API key");
      return;
    }
    try {
      const token = localStorage.getItem("mos_token");
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: newKeyName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to create API key");
      setNewlyCreatedKey(json.apiKey.key);
      setNewKeyName("");
      toast.success("API key created — copy it now; it cannot be retrieved again");
      refetchApiKeys();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create API key");
    }
  }, [newKeyName, refetchApiKeys]);

  const handleDeleteApiKey = useCallback(async (id: string) => {
    try {
      const token = localStorage.getItem("mos_token");
      const res = await fetch(`/api/settings/api-keys/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to revoke API key");
      toast.success("API key revoked");
      refetchApiKeys();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke API key");
    }
  }, [refetchApiKeys]);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <GlassCard>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4 text-orange-500" />API Keys</CardTitle>
                <CardDescription className="mt-1">Bearer keys authenticate as their creator and use that member's current company role.</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="text-xs" onClick={handleCreateApiKey}>
                <Key className="h-3.5 w-3.5 mr-1.5" />Generate Key
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {newlyCreatedKey && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">New API key — copy now; it will not be shown again:</p>
                  <code className="block bg-muted/60 rounded p-2 break-all">{newlyCreatedKey}</code>
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => void handleCopySecret(newlyCreatedKey, "API key")}><Copy className="h-3 w-3 mr-1" />Copy</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setNewlyCreatedKey(null)}>Dismiss</Button>
                  </div>
                </div>
              )}
              <div className="flex gap-2 mb-2">
                <Input placeholder="New API key name (e.g. Production)" value={newKeyName} onChange={(event) => setNewKeyName(event.target.value)} className="h-8 text-xs" />
                <Button size="sm" className="h-8 text-xs" onClick={handleCreateApiKey}>Create</Button>
              </div>
              {apiKeys.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No API keys yet — create one above</p>
              ) : apiKeys.map((apiKey: any) => (
                <div key={apiKey.id} className="rounded-lg border border-border dark:border-white/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{apiKey.name}</p>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-600" onClick={() => handleDeleteApiKey(apiKey.id)}>Revoke</Button>
                  </div>
                  <div className="flex items-center gap-2 bg-muted/50 rounded px-3 py-1.5">
                    <code className="text-xs font-mono text-muted-foreground flex-1 truncate">{apiKey.keyPrefix}••••••••••••••••</code>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                    <span>Last used: {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleString() : "Never"}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemVariants}>
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4 text-blue-500" />Webhooks</CardTitle>
            <CardDescription>HTTPS-only event delivery, signed with a timestamped HMAC-SHA256 header. Delivery is best-effort, not queued.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {newWebhookSecret && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs space-y-2">
                <p className="font-semibold text-blue-700 dark:text-blue-400">Webhook signing secret — copy now; it will not be shown again:</p>
                <code className="block bg-muted/60 rounded p-2 break-all">{newWebhookSecret}</code>
                <p className="text-muted-foreground">{newWebhookSignature}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => void handleCopySecret(newWebhookSecret, "Webhook secret")}><Copy className="h-3 w-3 mr-1" />Copy secret</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => { setNewWebhookSecret(null); setNewWebhookSignature(null); }}>Dismiss</Button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input value={newWebhookUrl} onChange={(event) => setNewWebhookUrl(event.target.value)} placeholder="https://your-app.com/api/webhooks/mos" className="flex-1" />
              <Button onClick={handleAddWebhook} disabled={!newWebhookUrl.trim()} size="sm" className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shrink-0">Add</Button>
            </div>
            <div className="space-y-3">
              {webhooks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No webhooks configured</p>
              ) : webhooks.map((webhook: any) => (
                <div key={webhook.id} className="rounded-lg border border-border dark:border-white/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`h-2 w-2 rounded-full ${webhook.status === "active" ? "bg-emerald-500" : "bg-gray-400"}`} />
                        <code className="text-xs font-mono truncate">{webhook.url}</code>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {(webhook.events || []).map((event: string) => <Badge key={event} variant="outline" className="text-[9px] px-1.5 py-0">{event}</Badge>)}
                        {(webhook.events || []).length === 0 && <Badge variant="outline" className="text-[9px] px-1.5 py-0">All events</Badge>}
                      </div>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {webhook.deliveryCount || 0} delivered · {webhook.failureCount || 0} failed · Last HTTP: {webhook.lastDeliveryStatus ?? "—"}
                      </p>
                      {webhook.lastDeliveryError && <p className="mt-1 text-[10px] text-amber-600">Last error: {webhook.lastDeliveryError}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0" onClick={() => handleDeleteWebhook(webhook.id)}>
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemVariants}>
        <GlassCard>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-emerald-500" />Integration Settings</CardTitle>
            <CardDescription>Provider sync is not enabled by a preference toggle.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configure credentials in Integration Hub. Saving credentials does not verify a provider connection or start live sync unless a provider-specific adapter is implemented and confirmed.
            </p>
          </CardContent>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export function SettingsView() {
  const { user } = useAppStore();

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-blue-500 text-white shadow-lg shadow-orange-500/25">
            <Building2 className="h-5 w-5" />
          </div>
          Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your account, billing, security, and integrations
        </p>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="company" className="text-xs gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500/10 data-[state=active]:to-blue-500/10">
              <Building2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Company</span>
            </TabsTrigger>
            <TabsTrigger value="subscription" className="text-xs gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500/10 data-[state=active]:to-blue-500/10">
              <CreditCard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Subscription</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="text-xs gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500/10 data-[state=active]:to-blue-500/10">
              <Shield className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="api" className="text-xs gap-1.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500/10 data-[state=active]:to-blue-500/10">
              <Key className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">API</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <CompanyTab />
          </TabsContent>

          <TabsContent value="subscription">
            <SubscriptionTab />
          </TabsContent>

          <TabsContent value="security">
            <SecurityTab />
          </TabsContent>

          <TabsContent value="api">
            <ApiTab />
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}

export default SettingsView;
