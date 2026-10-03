"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Send,
  Loader2,
  AlertTriangle,
  MessageSquare,
  Users,
  Check,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface MessageThread {
  otherUser: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    isRead: boolean;
    senderId: string;
  };
  unreadCount: number;
}

interface MessageItem {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender: { id: string; name: string; avatar: string | null };
  isRead: boolean;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
}

export default function MessagesView() {
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: threads, isLoading, error, refetch: refetchThreads } =
    useApiQuery<MessageThread[]>("/api/messages");

  const { data: users } = useApiQuery<UserOption[]>("/api/users?limit=100");

  const threadId = selectedThread?.otherUser.id ?? null;
  const { data: messages, isLoading: msgLoading, refetch: refetchMessages } =
    useApiQuery<MessageItem[]>(threadId ? `/api/messages/${threadId}` : null);

  const sendMutation = useApiMutation({
    method: "POST",
    path: "/api/messages",
    onSuccess: () => {
      toast.success("Message sent");
      setComposeOpen(false);
      setRecipientIds([]);
      setMessageContent("");
      refetchThreads();
      refetchMessages();
    },
    onError: (err) => toast.error(err),
  });

  const replyMutation = useApiMutation({
    method: "POST",
    path: "/api/messages",
    onSuccess: () => {
      setReplyContent("");
      refetchThreads();
      refetchMessages();
    },
    onError: (err) => toast.error(err),
  });

  const markReadMutation = useApiMutation({
    method: "POST",
    onSuccess: () => {
      refetchThreads();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCompose = useCallback(() => {
    if (recipientIds.length === 0 || !messageContent.trim()) {
      toast.error("Please select recipients and write a message");
      return;
    }
    sendMutation.mutate({
      recipientIds,
      content: messageContent,
    });
  }, [recipientIds, messageContent, sendMutation]);

  const handleReply = useCallback(() => {
    if (!selectedThread || !replyContent.trim()) return;
    replyMutation.mutate({
      recipientIds: [selectedThread.otherUser.id],
      content: replyContent,
    });
  }, [selectedThread, replyContent, replyMutation]);

  const handleSelectThread = useCallback(
    (thread: MessageThread) => {
      setSelectedThread(thread);
      if (thread.unreadCount > 0) {
        markReadMutation.mutate({}, `/api/messages/${thread.otherUser.id}/read`);
      }
    },
    [markReadMutation]
  );

  const toggleRecipient = (userId: string) => {
    setRecipientIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const senderName = selectedThread?.otherUser.name;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">Communicate with colleagues and staff</p>
        </div>
        <Button onClick={() => { setRecipientIds([]); setMessageContent(""); setComposeOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Compose
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm text-destructive font-medium">Failed to load messages</p>
            <button onClick={refetchThreads} className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 underline">
              Retry
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3 h-[calc(100vh-14rem)]">
          {/* Conversation List */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" /> Conversations
              </CardTitle>
            </CardHeader>
            <Separator />
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-3 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : threads && threads.length > 0 ? (
                threads.map((thread, idx) => {
                  const isSelected = selectedThread?.otherUser.id === thread.otherUser.id;
                  return (
                    <div
                      key={thread.otherUser.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? "bg-emerald-500/5 border-r-2 border-emerald-500" : ""}`}
                      onClick={() => handleSelectThread(thread)}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-medium shrink-0 ${isSelected ? "bg-emerald-500/20 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                        {thread.otherUser.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm truncate ${thread.unreadCount > 0 ? "font-bold" : "font-medium"}`}>
                            {thread.otherUser.name}
                          </p>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {formatDistanceToNow(new Date(thread.lastMessage.createdAt), { addSuffix: false })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className={`text-xs truncate ${thread.unreadCount > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                            {thread.lastMessage.senderId === thread.otherUser.id && (
                              <span className="text-muted-foreground mr-1">{thread.lastMessage.isRead ? "✓✓" : "✓"}</span>
                            )}
                            {thread.lastMessage.content}
                          </p>
                          {thread.unreadCount > 0 && (
                            <Badge className="shrink-0 ml-2 bg-emerald-500 text-white hover:bg-emerald-600 text-xs h-5 min-w-5 flex items-center justify-center px-1">
                              {thread.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground text-center">No conversations yet.</p>
                </div>
              )}
            </div>
          </Card>

          {/* Messages Panel */}
          <Card className="lg:col-span-2 flex flex-col">
            {selectedThread ? (
              <>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-medium text-emerald-600">
                      {selectedThread.otherUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-sm">{selectedThread.otherUser.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{selectedThread.otherUser.email}</p>
                    </div>
                  </div>
                </CardHeader>
                <Separator />
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {msgLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                        <Skeleton className="h-16 w-48 rounded-xl" />
                      </div>
                    ))
                  ) : messages && messages.length > 0 ? (
                    messages.map((msg) => {
                      const isMine = msg.senderId === "me" || msg.senderId === selectedThread.otherUser.id === false;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-xl px-4 py-2.5 ${isMine ? "bg-emerald-600 text-white" : "bg-muted"}`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                              <span className={`text-[10px] ${isMine ? "text-emerald-100" : "text-muted-foreground"}`}>
                                {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                              </span>
                              {isMine && (
                                msg.isRead
                                  ? <CheckCheck className="h-3 w-3 text-emerald-200" />
                                  : <Check className="h-3 w-3 text-emerald-200" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      No messages yet. Start the conversation!
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <Separator />
                <div className="p-4 flex items-center gap-2">
                  <Textarea
                    placeholder="Type a message..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={1}
                    className="resize-none min-h-[40px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleReply}
                    disabled={!replyContent.trim() || replyMutation.isLoading}
                  >
                    {replyMutation.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-3 text-muted-foreground/30" />
                <p className="text-sm font-medium">Select a conversation</p>
                <p className="text-xs">Choose a contact to start messaging</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Compose Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Recipients</Label>
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {users && users.length > 0 ? (
                  users.map((u) => (
                    <div
                      key={u.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${
                        recipientIds.includes(u.id)
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => toggleRecipient(u.id)}
                    >
                      <div className="h-4 w-4 rounded border flex items-center justify-center">
                        {recipientIds.includes(u.id) && (
                          <div className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
                        )}
                      </div>
                      <span>{u.name}</span>
                      <span className="text-xs text-muted-foreground">({u.role})</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">No users found.</p>
                )}
              </div>
              {recipientIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{recipientIds.length} recipient(s) selected</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="compose-msg">Message</Label>
              <Textarea
                id="compose-msg"
                placeholder="Write your message..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
              <Button onClick={handleCompose} disabled={sendMutation.isLoading}>
                {sendMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-1" /> Send
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
