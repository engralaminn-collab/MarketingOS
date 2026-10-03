"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useApiQuery, useApiMutation } from "@/hooks/use-api-query";
import { useAppStore } from "@/stores/app-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot,
  Send,
  Loader2,
  User,
  Sparkles,
  Target,
  TrendingUp,
  Search,
  Mail,
  Video,
  Megaphone,
  FileText,
  Rocket,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AiMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  prompt: string;
  gradient: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "plan", label: "Create Marketing Plan", icon: Target, prompt: "Create a comprehensive marketing plan for my business with goals, strategies, timelines, and KPIs.", gradient: "from-orange-500/20 to-amber-500/10" },
  { id: "grow", label: "Grow My Business", icon: TrendingUp, prompt: "Give me actionable growth strategies to scale my business to the next level.", gradient: "from-emerald-500/20 to-teal-500/10" },
  { id: "content", label: "30-Day Content Plan", icon: FileText, prompt: "Create a 30-day content calendar with post ideas, captions, hashtags, and posting times for my brand.", gradient: "from-sky-500/20 to-cyan-500/10" },
  { id: "leads", label: "Generate Leads", icon: Rocket, prompt: "Design a lead generation strategy including funnels, landing pages, and conversion tactics.", gradient: "from-violet-500/20 to-purple-500/10" },
  { id: "seo", label: "Run SEO Challenge", icon: Search, prompt: "Analyze my website SEO and give me a step-by-step 30-day SEO improvement challenge.", gradient: "from-rose-500/20 to-pink-500/10" },
  { id: "competitors", label: "Analyze Competitors", icon: Megaphone, prompt: "Help me perform a competitor analysis: identify top competitors, their strengths, weaknesses, and market positioning.", gradient: "from-blue-500/20 to-indigo-500/10" },
  { id: "email", label: "Create Email Campaign", icon: Mail, prompt: "Design a complete email marketing campaign with subject lines, body copy, CTAs, and a send schedule.", gradient: "from-amber-500/20 to-yellow-500/10" },
  { id: "video", label: "Create Video Campaign", icon: Video, prompt: "Plan a video marketing campaign with content ideas, scripts, platform strategy, and distribution plan.", gradient: "from-fuchsia-500/20 to-pink-500/10" },
];

const SUGGESTION_CHIPS = [
  "Write a blog post about AI trends",
  "Create social media captions",
  "Generate email subject lines",
  "Plan a product launch",
  "Write ad copy for Google Ads",
  "Improve my website copy",
];

// ─── Animation Variants ─────────────────────────────────────────────────────

const messageVariants = {
  initial: { opacity: 0, y: 20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.95 },
};

const sidebarItemVariants = {
  initial: { opacity: 0, x: -20 },
  animate: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: "easeOut" },
  }),
};

const typingDotVariants = {
  initial: { opacity: 0.3, y: 0 },
  animate: (i: number) => ({
    opacity: 1,
    y: [0, -6, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      delay: i * 0.15,
      ease: "easeInOut",
    },
  }),
};

// ─── Component ───────────────────────────────────────────────────────────────

export function AiCommandView() {
  const { isSidebarOpen, setSidebarOpen } = useAppStore();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeChip, setActiveChip] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages, isLoading, refetch } =
    useApiQuery<AiMessage[]>("/api/ai/chat");

  const sendMutation = useApiMutation({
    method: "POST",
    path: "/api/ai/chat",
    onSuccess: () => {
      setIsTyping(false);
      setInput("");
      setActiveChip(null);
      refetch();
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    },
    onError: () => {
      setIsTyping(false);
    },
  });

  const handleSend = useCallback(
    (text?: string) => {
      const message = text || input;
      if (!message.trim() || sendMutation.isLoading) return;
      setIsTyping(true);
      sendMutation.mutate({ message: message.trim() });
    },
    [input, sendMutation]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      handleSend(action.prompt);
    },
    [handleSend]
  );

  const handleClearChat = useCallback(() => {
    setInput("");
    // visually clear; backend history cleared on next fetch
    refetch();
  }, [refetch]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages && messages.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  return (
    <div className="flex gap-4 h-[calc(100vh-10rem)] min-h-[500px]">
      {/* ─── Left Sidebar: Quick Actions ─────────────────────────────── */}
      <div
        className={[
          "shrink-0 transition-all duration-300 overflow-hidden",
          isSidebarOpen ? "w-64" : "w-0",
        ].join(" ")}
      >
        <div className="w-64 h-full flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Actions
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSidebarOpen(false)}
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 pr-1">
            <div className="space-y-2 pb-4">
              {QUICK_ACTIONS.map((action, i) => {
                const Icon = action.icon;
                return (
                  <motion.button
                    key={action.id}
                    custom={i}
                    variants={sidebarItemVariants}
                    initial="initial"
                    animate="animate"
                    whileHover={{ scale: 1.02, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleQuickAction(action)}
                    disabled={sendMutation.isLoading}
                    className={[
                      "w-full text-left rounded-xl p-3 border border-border/50 transition-colors cursor-pointer",
                      "bg-gradient-to-br",
                      action.gradient,
                      "hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "group",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm border border-border/50 shrink-0">
                        <Icon className="h-4 w-4 text-orange-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">
                          {action.label}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* ─── Main Chat Area ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSidebarOpen(true)}
                aria-label="Expand sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">
                AI Command Center
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Your AI marketing co-pilot
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearChat}
            className="text-muted-foreground hover:text-destructive gap-1.5 h-8"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="text-xs">Clear</span>
          </Button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        >
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={[
                    "flex gap-3",
                    i % 2 === 0 ? "justify-start" : "justify-end",
                  ].join(" ")}
                >
                  {i % 2 === 0 && (
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  )}
                  <Skeleton className="h-20 w-72 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : messages && messages.length > 0 ? (
            <AnimatePresence mode="popLayout">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <motion.div
                    key={msg.id}
                    variants={messageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className={[
                      "flex gap-3",
                      isUser ? "justify-end" : "justify-start",
                    ].join(" ")}
                  >
                    {!isUser && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/20 to-blue-500/20 border border-sky-500/30 shrink-0 mt-1">
                        <Bot className="h-4 w-4 text-sky-400" />
                      </div>
                    )}
                    <div
                      className={[
                        "max-w-[75%] rounded-2xl px-4 py-3",
                        isUser
                          ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-br-sm shadow-lg shadow-orange-500/20"
                          : "bg-background/60 backdrop-blur-md border border-border/50 rounded-bl-sm",
                      ].join(" ")}
                    >
                      {isUser ? (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_p]:leading-relaxed [&_p]:text-sm [&_ul]:my-1 [&_ol]:my-1 [&_li]:text-sm [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h4]:text-sm [&_code]:text-xs [&_pre]:rounded-lg [&_pre]:bg-muted/50 [&_blockquote]:border-l-2 [&_blockquote]:border-orange-500/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-orange-400">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                      <p
                        className={[
                          "text-[10px] mt-2",
                          isUser ? "text-orange-200" : "text-muted-foreground",
                        ].join(" ")}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {isUser && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white shrink-0 mt-1">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col items-center justify-center h-full text-center py-12"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-sky-500/20 border border-border/50 mb-4">
                <Sparkles className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold mb-1">
                AI Command Center
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Your AI marketing co-pilot is ready. Use a quick action from the
                sidebar or type your own command below.
              </p>
            </motion.div>
          )}

          {/* Typing Indicator */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex gap-3 justify-start"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/20 to-blue-500/20 border border-sky-500/30 shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-sky-400" />
                </div>
                <div className="bg-background/60 backdrop-blur-md border border-border/50 rounded-2xl rounded-bl-sm px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        custom={i}
                        variants={typingDotVariants}
                        initial="initial"
                        animate="animate"
                        className="h-2 w-2 rounded-full bg-sky-400"
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Suggestion Chips */}
        {(!messages || messages.length === 0) && !isLoading && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Lightbulb className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {SUGGESTION_CHIPS.slice(0, 4).map((chip, i) => (
                <button
                  key={chip}
                  onClick={() => {
                    setInput(chip);
                    setActiveChip(i);
                  }}
                  className={[
                    "text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer",
                    activeChip === i
                      ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                      : "bg-background/40 border-border/50 text-muted-foreground hover:border-orange-500/30 hover:text-foreground",
                  ].join(" ")}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border/50 bg-card/60 backdrop-blur-md p-4">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              placeholder="Ask me anything about marketing..."
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setActiveChip(null);
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              className="resize-none min-h-[44px] max-h-32 bg-background/50 border-border/50 focus-visible:ring-orange-500/30"
              disabled={isTyping}
            />
            <Button
              size="icon"
              className="shrink-0 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 h-11 w-11 shadow-lg shadow-orange-500/20"
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
            >
              {isTyping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            AI-powered marketing assistant. Press Enter to send, Shift+Enter for
            new line.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AiCommandView;
