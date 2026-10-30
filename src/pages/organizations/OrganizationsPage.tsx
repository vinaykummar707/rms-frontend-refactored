import React, { useState, useMemo } from "react";
import { cn } from "cn";
import { useOrganizations, deleteOrganizationCascade } from "@/features/organizations";
import { formatDate } from "@/shared/utils/dateUtils";
import { notify } from "@/core/notifications/notificationService";
import { STUOnboardingWizardDialog } from "@/components/organizations/STUOnboardingWizardDialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  Search,
  Phone,
  Mail,
  Calendar,
  Radio,
  RefreshCw,
  Sparkles,
  Pencil,
  Trash2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Save,
  Volume2,
  Cpu,
  Layers,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import type { IOrganization } from "@/shared/types/organization";

export function OrganizationsPage() {
  const {
    organizations,
    isLoading,
    isError,
    refetch,
    useUpdate,
  } = useOrganizations();

  const { mutateAsync: updateOrganization, isPending: isUpdating } = useUpdate();

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog states
  const [isOnboardOpen, setIsOnboardOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<IOrganization | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<IOrganization | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Form states
  const [editName, setEditName] = useState("");
  const [editNameError, setEditNameError] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editPIS, setEditPIS] = useState(true);
  const [editPAS, setEditPAS] = useState(true);
  const [editITMS, setEditITMS] = useState(false);
  const [editV1, setEditV1] = useState(false);
  const [editV2, setEditV2] = useState(true);

  const filteredOrgs = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) return organizations;
    return organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(search) ||
        (org.email && org.email.toLowerCase().includes(search)) ||
        (org.phone && org.phone.toLowerCase().includes(search))
    );
  }, [organizations, searchTerm]);

  // Handle Refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await refetch();
      notify.info("Organization list refreshed");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (org: IOrganization) => {
    setEditingOrg(org);
    setEditNameError("");
    setEditName(org.name || "");
    setEditEmail(org.email || "");
    setEditPhone(org.phone || "");
    setEditActive(Boolean(org.active));
    setEditPIS(Boolean(org.PIS));
    setEditPAS(Boolean(org.PAS));
    setEditITMS(Boolean(org.ITMS));
    setEditV1(Boolean(org.v1_routes));
    setEditV2(Boolean(org.v2_routes ?? true));
  };

  // Submit Update
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditNameError("Organization name is required.");
      return;
    }

    try {
      await updateOrganization({
        id: editingOrg.id,
        payload: {
          id: editingOrg.id,
          name: trimmedName,
          email: editEmail.trim() || null,
          phone: editPhone.trim() || null,
          customer_type: editingOrg.customer_type ?? "stu",
          active: editActive,
          PIS: editPIS,
          PAS: editPAS,
          ITMS: editITMS,
          v1_routes: editV1,
          v2_routes: editV2,
        },
      });

      notify.success("Organization updated successfully", `Saved changes for "${trimmedName}"`);
      setEditingOrg(null);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to update organization");
    }
  };

  // Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!deletingOrg) return;

    try {
      setIsDeleting(true);
      await deleteOrganizationCascade(deletingOrg.id);
      notify.success("Organization deleted successfully", `Removed "${deletingOrg.name}" and clean up child records.`);
      setDeletingOrg(null);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to delete organization");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Organizations
          </h1>
          <Badge variant="secondary" className="font-semibold text-xs px-2 py-0.5">
            {organizations.length} Total
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage transit agencies, state transport corporations, and customer fleets.
        </p>
      </div>

      {/* Search and Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Action Controls: STU Onboard Customer & Refresh */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsOnboardOpen(true)}
            className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>STU Onboard Customer</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-12 w-full" />
              <div className="flex justify-between pt-2">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center">
          <p className="text-sm font-medium text-destructive">
            Failed to load organizations. Please check your Supabase connection.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="mt-3 text-xs"
          >
            Try Again
          </Button>
        </div>
      ) : filteredOrgs.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No organizations found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {searchTerm
              ? `No organizations match "${searchTerm}".`
              : "No organizations have been registered in the database yet. Click 'STU Onboard Customer' to create one."}
          </p>
          {searchTerm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="mt-4 text-xs"
            >
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        /* Organizations Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrgs.map((org) => {
            const isNavitronix = org.name.toLowerCase() === "navitronix";
            const initials = org.name.slice(0, 2).toUpperCase();
            const isRegular = org.customer_type === "regular";

            return (
              <Card
                key={org.id}
                className="relative flex flex-col justify-between transition-all duration-200 border-border/80 bg-card hover:border-foreground/20 hover:shadow-md"
              >
                <div>
                  {/* Card Header */}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      {/* Organization Avatar + Name */}
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-xl after:rounded-xl shrink-0">
                          {org.logo && (
                            <AvatarImage
                              src={org.logo}
                              alt={org.name}
                              className="rounded-xl object-contain p-0.5 bg-background"
                            />
                          )}
                          <AvatarFallback
                            className={`rounded-xl text-xs font-bold text-white shadow-xs ${
                              isNavitronix
                                ? "bg-amber-500"
                                : isRegular
                                ? "bg-purple-600"
                                : "bg-blue-600"
                            }`}
                          >
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex flex-col truncate">
                          <CardTitle className="text-sm font-semibold truncate text-foreground">
                            {org.name}
                          </CardTitle>
                         
                        </div>
                      </div>

                      {/* Active Status Badge */}
                      <Badge
                        variant={org.active ? "default" : "secondary"}
                        className={`text-[10px] px-2 py-0.5 capitalize shrink-0 ${
                          org.active
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {org.active ? "Active" : "Suspended"}
                      </Badge>
                    </div>
                  </CardHeader>

                  {/* Card Content */}
                  <CardContent className="space-y-3 pb-3">
                    {/* Contact Details */}
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {org.email && (
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{org.email}</span>
                        </div>
                      )}
                      {org.phone && (
                        <div className="flex items-center gap-2 truncate">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{org.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span>Created {formatDate(org.created_at)}</span>
                      </div>
                    </div>

                    {/* Features Tags */}
                    <div className="pt-2 border-t border-border/60">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Enabled Modules
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge
                          variant={org.PIS ? "default" : "outline"}
                          className={`text-[10px] px-1.5 py-0 h-4.5 ${
                            org.PIS
                              ? "bg-blue-600 text-white hover:bg-blue-600"
                              : "opacity-40"
                          }`}
                        >
                          <Radio className="h-2.5 w-2.5 mr-1" />
                          PIS
                        </Badge>
                        <Badge
                          variant={org.PAS ? "default" : "outline"}
                          className={`text-[10px] px-1.5 py-0 h-4.5 ${
                            org.PAS
                              ? "bg-indigo-600 text-white hover:bg-indigo-600"
                              : "opacity-40"
                          }`}
                        >
                          PAS
                        </Badge>
                        <Badge
                          variant={org.ITMS ? "default" : "outline"}
                          className={`text-[10px] px-1.5 py-0 h-4.5 ${
                            org.ITMS
                              ? "bg-cyan-600 text-white hover:bg-cyan-600"
                              : "opacity-40"
                          }`}
                        >
                          ITMS
                        </Badge>
                        {org.v1_routes && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4.5">
                            V1
                          </Badge>
                        )}
                        {org.v2_routes && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4.5">
                            V2
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </div>

                {/* Card Footer: CRUD Operations (Edit & Delete) */}
                <CardFooter className="pt-3 pb-3 border-t border-border/80 flex items-center justify-end gap-2 bg-muted/20">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(org)}
                    className="h-8 text-xs gap-1.5 hover:bg-muted font-medium"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Edit</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingOrg(org)}
                    className="h-8 text-xs gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-input"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* STU Onboarding Wizard Modal */}
      <STUOnboardingWizardDialog
        open={isOnboardOpen}
        onOpenChange={setIsOnboardOpen}
        onSuccess={() => refetch()}
      />

      {/* Edit Organization Dialog */}
      <Dialog open={!!editingOrg} onOpenChange={(open) => !open && setEditingOrg(null)}>
        <DialogContent className="sm:max-w-4xl p-6">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Pencil className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Edit Organization</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Update corporate parameters, modules, and operating state.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {editingOrg && (
            <form onSubmit={handleSaveEdit} className="space-y-4 py-3">
              {/* Top Form Fields: Unified Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-org-name" className="text-xs font-semibold">
                    Organization Name *
                  </Label>
                  <Input
                    id="edit-org-name"
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      if (editNameError) setEditNameError("");
                    }}
                    placeholder="e.g. KSRTC"
                    className={cn(
                      "h-9 text-xs",
                      editNameError && "border-destructive focus-visible:ring-destructive/20"
                    )}
                    autoFocus
                  />
                  {editNameError && (
                    <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{editNameError}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-org-email" className="text-xs font-semibold">
                    Corporate Email
                  </Label>
                  <Input
                    id="edit-org-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="contact@agency.gov.in"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-org-phone" className="text-xs font-semibold">
                    Corporate Phone
                  </Label>
                  <Input
                    id="edit-org-phone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+91 80 2222 1111"
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Checkbox Cards Grid of Columns */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Transit Modules & Operational Settings
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {/* Card 1: PIS */}
                  <div
                    role="checkbox"
                    aria-checked={editPIS}
                    tabIndex={0}
                    onClick={() => setEditPIS(!editPIS)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setEditPIS(!editPIS);
                      }
                    }}
                    className={cn(
                      "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                      editPIS
                        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20 shadow-2xs"
                        : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                        <Radio className="h-4 w-4 text-blue-600 shrink-0" />
                        <span>PIS Displays</span>
                      </div>
                      <Checkbox
                        checked={editPIS}
                        tabIndex={-1}
                        className="pointer-events-none mt-0.5"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                      Destination LED signs & in-bus screen displays
                    </p>
                  </div>

                  {/* Card 2: PAS */}
                  <div
                    role="checkbox"
                    aria-checked={editPAS}
                    tabIndex={0}
                    onClick={() => setEditPAS(!editPAS)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setEditPAS(!editPAS);
                      }
                    }}
                    className={cn(
                      "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                      editPAS
                        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20 shadow-2xs"
                        : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                        <Volume2 className="h-4 w-4 text-indigo-600 shrink-0" />
                        <span>PAS Audio</span>
                      </div>
                      <Checkbox
                        checked={editPAS}
                        tabIndex={-1}
                        className="pointer-events-none mt-0.5"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                      Synthesized announcements & stop chimes
                    </p>
                  </div>

                  {/* Card 3: ITMS */}
                  <div
                    role="checkbox"
                    aria-checked={editITMS}
                    tabIndex={0}
                    onClick={() => setEditITMS(!editITMS)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setEditITMS(!editITMS);
                      }
                    }}
                    className={cn(
                      "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                      editITMS
                        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20 shadow-2xs"
                        : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                        <Cpu className="h-4 w-4 text-cyan-600 shrink-0" />
                        <span>ITMS Telematics</span>
                      </div>
                      <Checkbox
                        checked={editITMS}
                        tabIndex={-1}
                        className="pointer-events-none mt-0.5"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                      Live GPS telemetry & fleet schedule tracking
                    </p>
                  </div>

                  {/* Card 4: V2 Route Engine */}
                  <div
                    role="checkbox"
                    aria-checked={editV2}
                    tabIndex={0}
                    onClick={() => setEditV2(!editV2)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setEditV2(!editV2);
                      }
                    }}
                    className={cn(
                      "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                      editV2
                        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20 shadow-2xs"
                        : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                        <Sliders className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span>V2 Route Engine</span>
                      </div>
                      <Checkbox
                        checked={editV2}
                        tabIndex={-1}
                        className="pointer-events-none mt-0.5"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                      Multi-slide layouts & Unicode Kannada fonts
                    </p>
                  </div>

                  {/* Card 5: V1 Route Legacy */}
                  <div
                    role="checkbox"
                    aria-checked={editV1}
                    tabIndex={0}
                    onClick={() => setEditV1(!editV1)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setEditV1(!editV1);
                      }
                    }}
                    className={cn(
                      "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                      editV1
                        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20 shadow-2xs"
                        : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                        <Layers className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>V1 Route Legacy</span>
                      </div>
                      <Checkbox
                        checked={editV1}
                        tabIndex={-1}
                        className="pointer-events-none mt-0.5"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                      Backward support for older controller devices
                    </p>
                  </div>

                  {/* Card 6: Account Operational Status */}
                  <div
                    role="checkbox"
                    aria-checked={editActive}
                    tabIndex={0}
                    onClick={() => setEditActive(!editActive)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setEditActive(!editActive);
                      }
                    }}
                    className={cn(
                      "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                      editActive
                        ? "border-emerald-600/40 bg-emerald-500/5 text-foreground ring-1 ring-emerald-500/20 shadow-2xs"
                        : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                        <CheckCircle2
                          className={cn(
                            "h-4 w-4 shrink-0",
                            editActive ? "text-emerald-600" : "text-muted-foreground"
                          )}
                        />
                        <span>Active Account</span>
                      </div>
                      <Checkbox
                        checked={editActive}
                        tabIndex={-1}
                        className="pointer-events-none mt-0.5"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                      {editActive ? "Tenant is active and operational" : "Tenant access is suspended"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dialog Footer */}
              <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingOrg(null)}
                  disabled={isUpdating}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUpdating}
                  className="text-xs font-semibold gap-1.5"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Save Changes
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingOrg} onOpenChange={(open) => !open && setDeletingOrg(null)}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold">
              Delete Organization
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground space-y-2 pt-1">
              <span>
                Are you sure you want to permanently delete{" "}
                <strong className="text-foreground">{deletingOrg?.name}</strong>?
              </span>
              <span className="block text-destructive/90 font-medium">
                This action cannot be undone. Child depots, regions, and staff associations under this organization will be detached or deleted.
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingOrg(null)}
              disabled={isDeleting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="text-xs font-semibold gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Organization
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OrganizationsPage;
