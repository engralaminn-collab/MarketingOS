"use client";

import { useState, useCallback } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api-query";
import { useAppStore } from "@/stores/app-store";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Megaphone,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  priority: string;
  targetRoles: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

function priorityColor(priority: string) {
  switch (priority) {
    case "high":
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    case "normal":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "low":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    default:
      return "";
  }
}

function priorityIcon(priority: string) {
  switch (priority) {
    case "high": return "🔴";
    case "low": return "🟢";
    default: return "🟡";
  }
}

function AnnouncementsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-12 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AnnouncementsView() {
  const { user } = useAppStore();
  const isAdmin = user?.role === "admin" || user?.role === "company_owner" || user?.role === "super_admin" || user?.role === "manager";

  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formPriority, setFormPriority] = useState("normal");
  const [formTargetRoles, setFormTargetRoles] = useState("all");

  const { data: announcements, isLoading, error, refetch } =
    useApiQuery<AnnouncementItem[]>("/api/announcements");

  const createMutation = useApiMutation({
    method: "POST",
    path: "/api/announcements",
    onSuccess: () => {
      toast.success(editId ? "Announcement updated" : "Announcement created");
      setCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => toast.error(err),
  });

  const deleteMutation = useApiMutation({
    method: "DELETE",
    onSuccess: () => {
      toast.success("Announcement deleted");
      refetch();
    },
    onError: (err) => toast.error(err),
  });

  const resetForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormPriority("normal");
    setFormTargetRoles("all");
    setEditId(null);
  };

  const openEdit = (ann: AnnouncementItem) => {
    setEditId(ann.id);
    setFormTitle(ann.title);
    setFormContent(ann.content);
    setFormPriority(ann.priority);
    setFormTargetRoles(ann.targetRoles);
    setCreateOpen(true);
  };

  const handleSubmit = useCallback(() => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error("Please fill in title and content");
      return;
    }
    const payload = {
      title: formTitle,
      content: formContent,
      priority: formPriority,
      targetRoles: formTargetRoles,
    };
    if (editId) {
      createMutation.mutate(payload, `/api/announcements/${editId}`);
    } else {
      createMutation.mutate(payload);
    }
  }, [formTitle, formContent, formPriority, formTargetRoles, editId, createMutation]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate({}, `/api/announcements/${id}`);
    },
    [deleteMutation]
  );

  if (isLoading) return <AnnouncementsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Create and manage announcements" : "Latest updates from your institution"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Announcement
          </Button>
        )}
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
            <p className="text-sm text-destructive font-medium">Failed to load announcements</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <button onClick={refetch} className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 underline">
              Retry
            </button>
          </CardContent>
        </Card>
      ) : announcements && announcements.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {announcements.map((ann) => (
            <Card key={ann.id} className="flex flex-col">
              <CardContent className="pt-6 flex-1 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-tight">{ann.title}</h3>
                  <Badge variant="outline" className={`shrink-0 ${priorityColor(ann.priority)}`}>
                    {priorityIcon(ann.priority)} {ann.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
                  {ann.content}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {ann.targetRoles && ann.targetRoles !== "all" && (
                    ann.targetRoles.split(",").map((role) => (
                      <Badge key={role} variant="secondary" className="text-xs">
                        {role.trim()}
                      </Badge>
                    ))
                  )}
                  {(!ann.targetRoles || ann.targetRoles === "all") && (
                    <Badge variant="secondary" className="text-xs">All Roles</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(ann)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &quot;{ann.title}&quot;? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-500 hover:bg-red-600"
                              onClick={() => handleDelete(ann.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Announcement" : "New Announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ann-title">Title</Label>
              <Input
                id="ann-title"
                placeholder="Announcement title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ann-content">Content</Label>
              <Textarea
                id="ann-content"
                placeholder="Write the announcement content..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={5}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target Roles</Label>
                <Select value={formTargetRoles} onValueChange={setFormTargetRoles}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="student">Students</SelectItem>
                    <SelectItem value="teacher">Teachers</SelectItem>
                    <SelectItem value="admin">Admins</SelectItem>
                    <SelectItem value="student,teacher">Students & Teachers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isLoading}>
                {createMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editId ? "Update" : "Publish"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
