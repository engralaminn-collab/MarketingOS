"use client";

import { useState, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Plus,
  Pencil,
  Trash2,
  Handshake,
  Loader2,
  AlertTriangle,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface PartnerRecord {
  id: string;
  company: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  agreementType: string;
  commissionRate: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  user: { id: string; name: string; email: string } | null;
}

function statusBadge(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "inactive":
      return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    default:
      return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20";
  }
}

const emptyForm = {
  company: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  agreementType: "referral",
  commissionRate: "0",
  notes: "",
};

type FormState = typeof emptyForm;

function PartnersSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <Card>
        <CardContent className="pt-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PartnersView() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });

  const queryPath = `/api/partners${search ? `?search=${search}` : ""}`;
  const { data: partners, isLoading, error, refetch } = useApiQuery<PartnerRecord[]>(queryPath);

  const saveMutation = useApiMutation({
    method: "POST",
    path: "/api/partners",
    onSuccess: () => {
      toast.success(editId ? "Partner updated" : "Partner added");
      setDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (err) => toast.error(err),
  });

  const deleteMutation = useApiMutation({
    method: "DELETE",
    onSuccess: () => {
      toast.success("Partner removed");
      refetch();
    },
    onError: (err) => toast.error(err),
  });

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditId(null);
  };

  const openEdit = (partner: PartnerRecord) => {
    setEditId(partner.id);
    setForm({
      company: partner.company,
      contactPerson: partner.contactPerson || "",
      email: partner.email || "",
      phone: partner.phone || "",
      address: partner.address || "",
      agreementType: partner.agreementType,
      commissionRate: String(partner.commissionRate),
      notes: partner.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = useCallback(() => {
    if (!form.company.trim()) {
      toast.error("Company name is required");
      return;
    }
    const payload = {
      company: form.company,
      contactPerson: form.contactPerson || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      agreementType: form.agreementType,
      commissionRate: Number(form.commissionRate) || 0,
      notes: form.notes || null,
    };
    if (editId) {
      saveMutation.mutate(payload, `/api/partners/${editId}`);
    } else {
      saveMutation.mutate(payload);
    }
  }, [form, editId, saveMutation]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate({}, `/api/partners/${id}`);
    },
    [deleteMutation]
  );

  if (isLoading) return <PartnersSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Partners</h1>
          <p className="text-muted-foreground">Manage institutional partners and commissions</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Partner
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg">All Partners</CardTitle>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search partners..."
                className="pl-8 w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <CardDescription>
            {partners?.length ?? 0} partner(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-destructive font-medium">Failed to load partners</p>
              <button onClick={refetch} className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 underline">
                Retry
              </button>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners && partners.length > 0 ? (
                    partners.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{p.company}</p>
                          {p.address && (
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{p.address}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{p.contactPerson || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.email || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.phone || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{p.agreementType}</Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-emerald-600">
                          {p.commissionRate}%
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusBadge(p.status)}>
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(p)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-600">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Partner</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{p.company}&quot;? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-500 hover:bg-red-600"
                                    onClick={() => handleDelete(p.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No partners found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Partner Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Partner" : "Add Partner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p-company">Company Name *</Label>
                <Input id="p-company" placeholder="Company name" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-contact">Contact Person</Label>
                <Input id="p-contact" placeholder="Full name" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" type="email" placeholder="email@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-phone">Phone</Label>
                <Input id="p-phone" placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-address">Address</Label>
              <Input id="p-address" placeholder="Company address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Agreement Type</Label>
                <Select value={form.agreementType} onValueChange={(v) => setForm({ ...form, agreementType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="consulting">Consulting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-commission">Commission Rate (%)</Label>
                <Input id="p-commission" type="number" min="0" max="100" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-notes">Notes</Label>
              <Textarea id="p-notes" placeholder="Additional notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saveMutation.isLoading}>
                {saveMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editId ? "Update" : "Add Partner"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
