"use client";

import { useState } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api-query";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Loader2,
  Unplug,
  Shield,
  Check,
  ChevronRight,
  ChevronLeft,
  Globe,
  RefreshCw,
  KeyRound,
  Zap,
  Lock,
  ExternalLink,
  AlertTriangle,
  CircleDot,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SocialAccount {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string | null;
  status: string;
  lastSyncedAt: string | null;
  connectedAt: string;
}

interface PlatformRequirement {
  oauthUrl?: string;
  scopes: string[];
  needsBusinessVerification: boolean;
  setupGuide: string[];
}

interface SocialAccountsResponse {
  accounts: SocialAccount[];
  platforms: string[];
  connectedPlatforms: string[];
  missingPlatforms: string[];
  requirements: Record<string, PlatformRequirement>;
}

// ─── Platform Config ───────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  Facebook: "#1877F2",
  Instagram: "#E4405F",
  LinkedIn: "#0A66C2",
  X: "#000000",
  YouTube: "#FF0000",
  TikTok: "#010101",
  Pinterest: "#E60023",
  Telegram: "#26A5E4",
};

const PLATFORM_INITIALS: Record<string, string> = {
  Facebook: "f",
  Instagram: "ig",
  LinkedIn: "in",
  X: "X",
  YouTube: "YT",
  TikTok: "TK",
  Pinterest: "P",
  Telegram: "TG",
};

// ─── Platform Icon Component ───────────────────────────────────────────────────

function PlatformIcon({
  platform,
  size = "md",
}: {
  platform: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = { sm: "h-6 w-6 text-[10px]", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" };
  const bg = PLATFORM_COLORS[platform] || "#6B7280";
  const initial = PLATFORM_INITIALS[platform] || platform.charAt(0).toUpperCase();

  return (
    <div
      className={`${sizeClasses[size]} rounded-lg flex items-center justify-center font-bold text-white shadow-sm`}
      style={{ backgroundColor: bg }}
    >
      {initial}
    </div>
  );
}

// ─── Connection Wizard Steps ───────────────────────────────────────────────────

const WIZARD_STEPS = [
  { title: "Select Platform", icon: Globe },
  { title: "Token Method", icon: KeyRound },
  { title: "Requirements Check", icon: Shield },
  { title: "Setup Instructions", icon: AlertTriangle },
  { title: "Token Setup", icon: Lock },
  { title: "Verify Token", icon: Zap },
];

// ─── Main Component ────────────────────────────────────────────────────────────

export function SocialAccountsView() {
  // Data
  const { data, isLoading, refetch } = useApiQuery<SocialAccountsResponse>("/api/social-accounts");

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountHandle, setAccountHandle] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [connectSuccess, setConnectSuccess] = useState(false);
  const [connectTestError, setConnectTestError] = useState<string | null>(null);

  // Mutations
  const connectMutation = useApiMutation<any>({
    method: "POST",
    path: "/api/social-accounts",
    onSuccess: () => {
      toast.success("Credential verified and saved. Publishing access depends on the platform permissions granted.");
      refetch();
      resetWizard();
    },
    onError: (err) => toast.error(err),
  });

  const disconnectMutation = useApiMutation<any>({
    method: "DELETE",
    path: "/api/social-accounts",
    onSuccess: () => {
      toast.success("Account disconnected");
      refetch();
    },
    onError: (err) => toast.error(err),
  });

  const testConnectionMutation = useApiMutation<
    { platform: string; accessToken: string },
    { verified: boolean; accountName?: string | null; accountId?: string | null; error?: string }
  >({
    method: "POST",
    path: "/api/social-accounts/test",
  });

  const resetWizard = () => {
    setWizardStep(0);
    setSelectedPlatform(null);
    setAccountName("");
    setAccountHandle("");
    setAccessToken("");
    setTesting(false);
    setConnectSuccess(false);
    setConnectTestError(null);
    setWizardOpen(false);
  };

  const openWizard = () => {
    resetWizard();
    setWizardOpen(true);
  };

  const handlePlatformSelect = (platform: string) => {
    setSelectedPlatform(platform);
    setAccountName(`My ${platform}`);
    setConnectTestError(null);
    setWizardStep(1);
  };

  const tokenTestMutation = useApiMutation<{ platform: string; accessToken: string }, any>({
    method: "POST",
    path: "/api/social-accounts/test",
  });

  const handleConnect = async () => {
    if (!selectedPlatform || !accessToken.trim()) return;
    try {
      await connectMutation.mutateAsync({
        platform: selectedPlatform,
        accountName: accountName.trim() || `My ${selectedPlatform}`,
        accountHandle: accountHandle.trim() || undefined,
        accessToken: accessToken.trim(),
      });
    } catch {
      // error handled in onError
    }
  };

  const handleDisconnect = (id: string, name: string) => {
    disconnectMutation.mutate({ id });
    toast.info(`Disconnecting ${name}...`);
  };

  const simulateConnectionTest = async () => {
    if (!selectedPlatform || !accessToken.trim()) return;
    setWizardStep(5);
    setTesting(true);
    setConnectSuccess(false);
    setConnectTestError(null);
    try {
      const result = await testConnectionMutation.mutateAsync({
        platform: selectedPlatform,
        accessToken: accessToken.trim(),
      });
      if (!result.verified) throw new Error(result.error || 'The platform did not verify this credential');
      if (result.accountName) setAccountName(result.accountName);
      setConnectSuccess(true);
      toast.success('The platform accepted the credential. Publish permissions may still require app review.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Credential verification failed';
      setConnectTestError(message);
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  const accounts = data?.accounts || [];
  const selectedRequirements = selectedPlatform ? data?.requirements?.[selectedPlatform] : undefined;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-orange-500" />
            Social Media Accounts
          </h1>
          <p className="text-muted-foreground mt-1">
            Verify and store social access tokens. Posting and automatic sync are not implemented.
          </p>
        </div>
        <Button onClick={openWizard} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
          <Plus className="h-4 w-4" />
          Connect Account
        </Button>
      </div>

      {/* Security Notice */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-950/30 -sm p-4 flex items-start gap-3"
      >
        <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <span className="font-semibold">Access tokens are encrypted at rest.</span> Tokens are sent only to the selected provider's profile endpoint during verification. Posting and automatic sync are not enabled.
        </p>
      </motion.div>

      {/* Accounts Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-0 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed border-2 bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4">
              <CircleDot className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold">No verified accounts</h3>
            <p className="text-muted-foreground text-sm mt-1 max-w-md">
              Verify and store tokens for supported social accounts. Publishing and automatic sync are not available in this build.
            </p>
            <Button
              onClick={openWizard}
              variant="outline"
              className="mt-4 gap-2 border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/30"
            >
              <Plus className="h-4 w-4" />
              Connect Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {accounts.map((account, i) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                layout
              >
                <Card className="border-0 shadow-md hover:shadow-lg transition-shadow group overflow-hidden">
                  <div
                    className="h-1"
                    style={{
                      backgroundColor:
                        PLATFORM_COLORS[account.platform] || "#6B7280",
                    }}
                  />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <PlatformIcon platform={account.platform} />
                        <div>
                          <h3 className="font-semibold text-sm">
                            {account.accountName}
                          </h3>
                          {account.accountHandle && (
                            <p className="text-xs text-muted-foreground">
                              {account.accountHandle.startsWith("@") ? account.accountHandle : `@${account.accountHandle}`}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={
                          account.status === "active"
                            ? "default"
                            : "secondary"
                        }
                        className={
                          account.status === "active"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        }
                      >
                        <CircleDot className="h-3 w-3 mr-1" />
                        {account.status === "active" ? "Token verified" : "Needs revalidation"}
                      </Badge>
                    </div>

                    <Separator className="my-3" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <RefreshCw className="h-3 w-3" />
                        {account.lastSyncedAt
                          ? `Synced ${new Date(account.lastSyncedAt).toLocaleDateString()}`
                          : "Automatic sync unavailable"}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() =>
                          handleDisconnect(account.id, account.accountName)
                        }
                        disabled={disconnectMutation.isLoading}
                      >
                        <Unplug className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ─── Connect Wizard Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={wizardOpen}
        onOpenChange={(open) => {
          if (!open) resetWizard();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          {/* Wizard Header with Step Indicator */}
          <div className="px-6 pt-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle className="text-lg">Connect Social Account</DialogTitle>
              <DialogDescription>
                Step {wizardStep + 1} of {WIZARD_STEPS.length} — {WIZARD_STEPS[wizardStep].title}
              </DialogDescription>
            </DialogHeader>
            {/* Progress Steps */}
            <div className="flex items-center gap-1 mt-4">
              {WIZARD_STEPS.map((step, i) => {
                const StepIcon = step.icon;
                const isActive = i === wizardStep;
                const isComplete = i < wizardStep;
                return (
                  <div
                    key={i}
                    className="flex items-center"
                  >
                    <div
                      className={`
                        flex items-center justify-center rounded-full transition-all duration-300
                        ${isComplete ? "bg-orange-500 text-white scale-90" : ""}
                        ${isActive ? "bg-orange-500 text-white ring-2 ring-orange-200 dark:ring-orange-800" : ""}
                        ${!isComplete && !isActive ? "bg-muted text-muted-foreground" : ""}
                      `}
                      style={{ width: 28, height: 28, fontSize: 10 }}
                    >
                      {isComplete ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <StepIcon className="h-3.5 w-3.5" />
                      )}
                    </div>
                    {i < WIZARD_STEPS.length - 1 && (
                      <div
                        className={`h-0.5 w-6 transition-colors ${
                          isComplete ? "bg-orange-500" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Wizard Body */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6">
              <AnimatePresence mode="wait">
                {/* Step 0: Platform Selection */}
                {wizardStep === 0 && (
                  <motion.div
                    key="step-platforms"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <p className="text-sm text-muted-foreground">
                      Select the social media platform you want to connect.
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
                      {(data?.platforms ?? ["Facebook", "Instagram", "LinkedIn", "X", "YouTube", "TikTok", "Pinterest", "Telegram"]).map(
                        (platform) => {
                          const isConnected =
                            data?.connectedPlatforms?.includes(platform);
                          return (
                            <motion.button
                              key={platform}
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              disabled={isConnected}
                              onClick={() => handlePlatformSelect(platform)}
                              className={`
                                relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors
                                ${
                                  isConnected
                                    ? "opacity-50 cursor-not-allowed border-muted bg-muted/30"
                                    : "hover:border-orange-400 dark:hover:border-orange-600 border-muted hover:bg-orange-50/50 dark:hover:bg-orange-950/20"
                                }
                              `}
                            >
                              <PlatformIcon platform={platform} size="lg" />
                              <span className="text-xs font-medium">
                                {platform}
                              </span>
                              {isConnected && (
                                <Badge
                                  variant="secondary"
                                  className="absolute -top-1.5 -right-1.5 text-[9px] px-1.5 py-0 bg-emerald-500 text-white"
                                >
                                  Token verified
                                </Badge>
                              )}
                            </motion.button>
                          );
                        }
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Step 1: Connection Method */}
                {wizardStep === 1 && selectedPlatform && (
                  <motion.div
                    key="step-method"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <PlatformIcon platform={selectedPlatform} size="md" />
                      <div>
                        <h3 className="font-semibold">{selectedPlatform}</h3>
                        <p className="text-xs text-muted-foreground">
                          Choose the token source
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-muted bg-muted/30 text-center opacity-80">
                        <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                          <KeyRound className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">OAuth access token</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Paste a token you already obtained from {selectedPlatform}. This wizard does not launch an OAuth login.
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[9px]">Unavailable</Badge>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setWizardStep(2)}
                        className="relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-orange-500 bg-orange-50/50 text-center transition-colors hover:bg-orange-100/60 dark:bg-orange-950/20 dark:hover:bg-orange-950/40"
                      >
                        <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                          <Zap className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">
                            API or bot token
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            Manually supplied platform credential
                          </p>
                        </div>
                        <Badge className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] px-1.5 py-0">
                          Available
                        </Badge>
                      </motion.button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setWizardStep(0)}
                      className="text-muted-foreground"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back to platforms
                    </Button>
                  </motion.div>
                )}

                {/* Step 2: Requirements Checklist */}
                {wizardStep === 2 && selectedPlatform && (
                  <motion.div
                    key="step-requirements"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-5 w-5 text-orange-500" />
                      <h3 className="font-semibold">Provider Access Requirements</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      These are reference scopes only; the app cannot request them for you. Verification checks whether the supplied token can read the provider profile.
                    </p>
                    <Card className="border-muted bg-muted/30">
                      <CardContent className="p-4 space-y-4">
                        <div>
                          <p className="text-sm font-medium">Recommended scopes</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedRequirements?.scopes.length ? selectedRequirements.scopes.map((scope) => (
                              <Badge key={scope} variant="secondary" className="font-mono text-[10px]">{scope}</Badge>
                            )) : <p className="text-xs text-muted-foreground">This provider does not use OAuth scopes for bot tokens.</p>}
                          </div>
                        </div>
                        <div className="border-t pt-3">
                          <p className="text-sm font-medium">Business verification</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {selectedRequirements?.needsBusinessVerification ? "The provider may require business or app review before granting access." : "No additional business verification is indicated in this guide."}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">A successful profile lookup proves only that the token is accepted for that read request. It does not verify publishing permissions.</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Step 3: Setup Instructions */}
                {wizardStep === 3 && selectedPlatform && (
                  <motion.div
                    key="step-instructions"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      <h3 className="font-semibold">Setup Instructions</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Obtain a provider-issued token with the required profile-read permissions. OAuth consent and publishing access are not handled by this app.
                    </p>
                    <div className="space-y-3">
                      {data?.requirements?.[selectedPlatform]?.setupGuide.map(
                        (step, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-start gap-3"
                          >
                            <div
                              className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                              style={{
                                backgroundColor:
                                  PLATFORM_COLORS[selectedPlatform] || "#6B7280",
                                color: "white",
                              }}
                            >
                              {i + 1}
                            </div>
                            <div className="pt-0.5">
                              <p className="text-sm">{step}</p>
                            </div>
                          </motion.div>
                        )
                      ) || (
                        <p className="text-sm text-muted-foreground">
                          No specific setup instructions available for this platform.
                        </p>
                      )}
                    </div>
                    {data?.requirements?.[selectedPlatform]?.oauthUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 mt-2"
                        onClick={() => {
                          window.open(
                            data?.requirements?.[selectedPlatform]?.oauthUrl,
                            "_blank"
                          );
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Developer Portal
                      </Button>
                    )}
                  </motion.div>
                )}

                {/* Step 4: Token Input */}
                {wizardStep === 4 && selectedPlatform && (
                  <motion.div
                    key="step-token"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="h-5 w-5 text-orange-500" />
                      <h3 className="font-semibold">Provider Access Token</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Enter an access token issued by {selectedPlatform}. The token is checked against a read-only profile endpoint before it is saved.
                    </p>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="account-name">Account Name</Label>
                        <Input
                          id="account-name"
                          value={accountName}
                          onChange={(e) => setAccountName(e.target.value)}
                          placeholder={`My ${selectedPlatform}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="account-handle">Handle / Username (optional)</Label>
                        <Input
                          id="account-handle"
                          value={accountHandle}
                          onChange={(e) => setAccountHandle(e.target.value)}
                          placeholder="@username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="access-token">Access Token</Label>
                        <Input
                          id="access-token"
                          type="password"
                          value={accessToken}
                          onChange={(e) => { setAccessToken(e.target.value); setConnectSuccess(false); setConnectTestError(null); }}
                          placeholder="Enter provider-issued access token..."
                          className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Token is encrypted with AES-256-GCM before database storage. Set CREDENTIAL_ENCRYPTION_KEY first.
                          No passwords are ever stored.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 5: Provider Token Verification */}
                {wizardStep === 5 && selectedPlatform && (
                  <motion.div
                    key="step-test"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col items-center justify-center py-8 space-y-6"
                  >
                    {testing && !connectSuccess && (
                      <>
                        <div className="relative">
                          <div className="h-20 w-20 rounded-full border-4 border-orange-200 dark:border-orange-800" />
                          <motion.div
                            className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-500"
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <PlatformIcon platform={selectedPlatform} size="sm" />
                          </div>
                        </div>
                        <div className="text-center">
                          <h3 className="font-semibold">
                            Verifying access token with {selectedPlatform}...
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Checking the provider profile endpoint (read-only)
                          </p>
                        </div>
                        <div className="space-y-2 w-full max-w-xs">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Validating token with the platform...
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.2 }}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Waiting for identity response...
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.8 }}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Confirming account identity...
                          </motion.div>
                        </div>
                      </>
                    )}
                    {!testing && connectTestError && (
                      <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
                        <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
                        <p className="font-medium text-destructive">Credential verification failed</p>
                        <p className="text-sm text-muted-foreground mt-1">{connectTestError}</p>
                        <p className="text-xs text-muted-foreground mt-2">Check the token, expiry, API product access, and granted scopes, then try again.</p>
                      </div>
                    )}
                    {!testing && connectSuccess && (
                      <>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 15,
                          }}
                          className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"
                        >
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: 0.2 }}
                          >
                            <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                          </motion.div>
                        </motion.div>
                        <div className="text-center">
                          <h3 className="font-semibold text-lg text-emerald-600 dark:text-emerald-400">
                            Credential Verified
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            The {selectedPlatform} identity endpoint accepted this token. Posting permissions may still need approval.
                          </p>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* Wizard Footer */}
          <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWizardStep(Math.max(0, wizardStep - 1))}
              disabled={wizardStep === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            {wizardStep < 4 ? (
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white gap-1"
                onClick={() => setWizardStep(wizardStep + 1)}
                disabled={wizardStep === 0 && !selectedPlatform}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : wizardStep === 4 ? (
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white gap-1"
                onClick={simulateConnectionTest}
                disabled={!accessToken.trim() || testConnectionMutation.isLoading}
              >
                {testing || tokenTestMutation.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Verify Access Token
              </Button>
            ) : connectSuccess ? (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                onClick={handleConnect}
                disabled={connectMutation.isLoading}
              >
                {connectMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Verified Token
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setWizardStep(4)}>
                Edit Token
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SocialAccountsView;
