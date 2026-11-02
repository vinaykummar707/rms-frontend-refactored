import React, { useState, useMemo } from "react";
import { cn } from "cn";
import {
  useOrganizations,
  deleteOrganizationCascade,
  checkOrganizationNameDuplicate,
  checkOrganizationEmailDuplicate,
  checkOrganizationPhoneDuplicate,
} from "@/features/organizations";
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
import { Switch } from "@/components/ui/switch";
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
  Play,
  Airplay,
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

  // Status Toggle confirmation state
  const [statusConfirmOrg, setStatusConfirmOrg] = useState<IOrganization | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Edit Form states
  const [editName, setEditName] = useState("");
  const [editNameError, setEditNameError] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editEmailError, setEditEmailError] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPhoneError, setEditPhoneError] = useState("");
  const [editModuleError, setEditModuleError] = useState("");
  const [editRouteError, setEditRouteError] = useState("");
  const [isValidatingDuplicates, setIsValidatingDuplicates] = useState(false);
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

  // Real-time onBlur duplicate checks for Edit Organization
  const handleBlurName = async () => {
    if (!editingOrg) return;
    const trimmed = editName.trim();
    if (!trimmed || trimmed.length < 2) return;
    if (trimmed.toLowerCase() === (editingOrg.name || "").toLowerCase()) return;
    try {
      const isDup = await checkOrganizationNameDuplicate(trimmed, editingOrg.id);
      if (isDup) {
        setEditNameError(`An organization with the name "${trimmed}" already exists.`);
      }
    } catch (err) {
      console.warn("Name duplicate check error:", err);
    }
  };

  const handleBlurEmail = async () => {
    if (!editingOrg) return;
    const trimmed = editEmail.trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!trimmed || !emailRegex.test(trimmed)) return;
    if (trimmed.toLowerCase() === (editingOrg.email || "").toLowerCase()) return;
    try {
      const isDup = await checkOrganizationEmailDuplicate(trimmed, editingOrg.id);
      if (isDup) {
        setEditEmailError(`An organization with the email "${trimmed}" already exists.`);
      }
    } catch (err) {
      console.warn("Email duplicate check error:", err);
    }
  };

  const handleBlurPhone = async () => {
    if (!editingOrg) return;
    const trimmed = editPhone.trim();
    if (!trimmed || trimmed.length < 7 || trimmed.length > 16) return;
    if (trimmed === (editingOrg.phone || "")) return;
    try {
      const isDup = await checkOrganizationPhoneDuplicate(trimmed, editingOrg.id);
      if (isDup) {
        setEditPhoneError(`An organization with the contact number "${trimmed}" already exists.`);
      }
    } catch (err) {
      console.warn("Phone duplicate check error:", err);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (org: IOrganization) => {
    setEditingOrg(org);
    setEditNameError("");
    setEditEmailError("");
    setEditPhoneError("");
    setEditModuleError("");
    setEditRouteError("");
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

    let hasError = false;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditNameError("Organization name is required.");
      hasError = true;
    } else if (trimmedName.length < 2) {
      setEditNameError("Organization name must be at least 2 characters.");
      hasError = true;
    }

    const trimmedEmail = editEmail.trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!trimmedEmail) {
      setEditEmailError("Corporate email address is required.");
      hasError = true;
    } else if (!emailRegex.test(trimmedEmail)) {
      setEditEmailError("Please enter a valid corporate email address.");
      hasError = true;
    }

    const trimmedPhone = editPhone.trim();
    if (!trimmedPhone) {
      setEditPhoneError("Contact number is required.");
      hasError = true;
    } else if (trimmedPhone.length < 7 || trimmedPhone.length > 16) {
      setEditPhoneError("Contact number must be between 7 and 16 digits.");
      hasError = true;
    }

    // Validate modules
    if (!editPIS && !editPAS && !editITMS) {
      setEditModuleError("At least one transit module (PIS, PAS, or ITMS) must be enabled.");
      hasError = true;
    }

    // Validate PIS routes
    if (editPIS && !editV1 && !editV2) {
      setEditRouteError("At least one route format engine (V1 or V2) must be selected when PIS is enabled.");
      hasError = true;
    }

    if (hasError) return;

    // Check database duplicates before saving
    try {
      setIsValidatingDuplicates(true);
      const [isNameDup, isEmailDup, isPhoneDup] = await Promise.all([
        trimmedName.toLowerCase() !== (editingOrg.name || "").toLowerCase()
          ? checkOrganizationNameDuplicate(trimmedName, editingOrg.id)
          : false,
        trimmedEmail.toLowerCase() !== (editingOrg.email || "").toLowerCase()
          ? checkOrganizationEmailDuplicate(trimmedEmail, editingOrg.id)
          : false,
        trimmedPhone !== (editingOrg.phone || "")
          ? checkOrganizationPhoneDuplicate(trimmedPhone, editingOrg.id)
          : false,
      ]);

      if (isNameDup) {
        setEditNameError(`An organization with the name "${trimmedName}" already exists.`);
        hasError = true;
      }
      if (isEmailDup) {
        setEditEmailError(`An organization with the email "${trimmedEmail}" already exists.`);
        hasError = true;
      }
      if (isPhoneDup) {
        setEditPhoneError(`An organization with the contact number "${trimmedPhone}" already exists.`);
        hasError = true;
      }
    } catch (err: any) {
      console.warn("Duplicate pre-check warning:", err);
    } finally {
      setIsValidatingDuplicates(false);
    }

    if (hasError) return;

    try {
      await updateOrganization({
        id: editingOrg.id,
        payload: {
          id: editingOrg.id,
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          customer_type: editingOrg.customer_type ?? "stu",
          active: editActive,
          PIS: editPIS,
          PAS: editPAS,
          ITMS: editITMS,
          v1_routes: editPIS ? editV1 : false,
          v2_routes: editPIS ? editV2 : false,
        },
      });

      notify.success("Organization updated successfully", `Saved changes for "${trimmedName}"`);
      setEditingOrg(null);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to update organization");
    }
  };

  // Confirm Status Toggle (Activate / Suspend)
  const handleToggleStatusConfirm = async () => {
    if (!statusConfirmOrg) return;
    try {
      setIsTogglingStatus(true);
      const targetState = !statusConfirmOrg.active;
      await updateOrganization({
        id: statusConfirmOrg.id,
        payload: {
          id: statusConfirmOrg.id,
          name: statusConfirmOrg.name,
          email: statusConfirmOrg.email ?? null,
          phone: statusConfirmOrg.phone ?? null,
          customer_type: statusConfirmOrg.customer_type ?? "stu",
          active: targetState,
          PIS: statusConfirmOrg.PIS ?? true,
          PAS: statusConfirmOrg.PAS ?? true,
          ITMS: statusConfirmOrg.ITMS ?? false,
          v1_routes: statusConfirmOrg.v1_routes ?? false,
          v2_routes: statusConfirmOrg.v2_routes ?? true,
        },
      });

      notify.success(
        `Organization ${targetState ? "Activated" : "Suspended"}`,
        `"${statusConfirmOrg.name}" is now ${targetState ? "active and operational" : "suspended"}.`
      );
      setStatusConfirmOrg(null);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to change organization status");
    } finally {
      setIsTogglingStatus(false);
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
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto">
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

        {/* Action Controls: Create Organization & Refresh */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsOnboardOpen(true)}
            className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Create Organization</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="space-y-4 p-4">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-10 w-full" />
              <div className="flex justify-between pt-2">
                <Skeleton className="h-7 w-16 rounded-md" />
                <Skeleton className="h-7 w-16 rounded-md" />
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
              : "No organizations have been registered in the database yet. Click 'Create Organization' to create one."}
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
        /* Organizations Cards Grid (5-column layout on XL screens) */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3.5">
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
                  <CardHeader className=" pb-2.5 block w-full min-w-0">
                    <div className="flex items-start justify-between gap-2 w-full min-w-0">
                      {/* Organization Avatar + Name (up to 2 lines max with break-words to prevent overflow) */}
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <Avatar className="h-9 w-9 rounded-xl after:rounded-xl shrink-0 mt-0.5">
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

                       
                      </div>

                      {/* Active Status Interactive Switch */}
                      <div
                        className="flex items-center gap-1.5 shrink-0 mt-0.5"
                        title={`Click to ${org.active ? "suspend" : "activate"} ${org.name}`}
                      >
                        <span
                          onClick={() => setStatusConfirmOrg(org)}
                          className={cn(
                            "text-[10px] font-semibold cursor-pointer select-none transition-colors",
                            org.active
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {org.active ? "Active" : "Suspended"}
                        </span>
                        <Switch
                          size="sm"
                          checked={Boolean(org.active)}
                          onCheckedChange={() => setStatusConfirmOrg(org)}
                          aria-label={`Toggle status for ${org.name}`}
                          className="cursor-pointer data-checked:bg-emerald-600 dark:data-checked:bg-emerald-600"
                        />
                      </div>
                    </div>
                  </CardHeader>

                  {/* Card Content */}
                  <CardContent className="p-3.5 pt-0 space-y-2.5">
                    {/* Contact Details */}
                     <div className="min-w-0 flex-1">
                          <CardTitle
                            className="text-sm font-semibold leading-snug text-foreground line-clamp-2 break-words [overflow-wrap:anywhere]"
                            title={org.name}
                          >
                            {org.name}
                          </CardTitle>
                        </div>
                    <div className="space-y-1 text-xs text-muted-foreground">

                      {org.email && (
                        <div className="flex items-center gap-2 truncate" title={org.email}>
                          <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{org.email}</span>
                        </div>
                      )}
                      {org.phone && (
                        <div className="flex items-center gap-2 truncate" title={org.phone}>
                          <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{org.phone}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span>Created {formatDate(org.created_at)}</span>
                      </div>
                    </div>

                    {/* Features Tags: Show ONLY enabled module chips */}
                    <div className="pt-2 border-t border-border/60">
                     
                      <div className="flex flex-wrap gap-1">
                        {org.PIS && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4.5 bg-blue-600 hover:bg-blue-600 text-white gap-1 font-medium shadow-none">
                            <Airplay className="h-2.5 w-2.5" />
                            
                            {(org.v2_routes && org.v1_routes) && 'PIS - V1 & V2'} 
                            {(org.v2_routes && !org.v1_routes) && 'PIS -V2'}
                            {(!org.v2_routes && org.v1_routes) && 'PIS -V1'}
                          </Badge>
                        )}
                        {org.PAS && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4.5 bg-indigo-600 hover:bg-indigo-600 text-white gap-1 font-medium shadow-none">
                            <Volume2 className="h-2.5 w-2.5" />
                            PAS
                          </Badge>
                        )}
                        {org.ITMS && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4.5 bg-cyan-600 hover:bg-cyan-600 text-white gap-1 font-medium shadow-none">
                            <Cpu className="h-2.5 w-2.5" />
                            ITMS
                          </Badge>
                        )}
                       
                        {!org.PIS && !org.PAS && !org.ITMS && !org.v1_routes && !org.v2_routes && (
                          <span className="text-[10px] text-muted-foreground italic">None configured</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </div>

                {/* Card Footer: CRUD Operations (Edit & Delete) */}
                <CardFooter className="px-3.5 py-2.5 border-t border-border/80 flex items-center justify-end gap-1.5 bg-muted/20">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(org)}
                    className="h-7 text-xs px-2.5 gap-1 hover:bg-muted font-medium"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                    <span>Edit</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingOrg(org)}
                    className="h-7 text-xs px-2.5 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive border-input"
                  >
                    <Trash2 className="h-3 w-3" />
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
                    onBlur={handleBlurName}
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
                    Corporate Email *
                  </Label>
                  <Input
                    id="edit-org-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => {
                      setEditEmail(e.target.value);
                      if (editEmailError) setEditEmailError("");
                    }}
                    onBlur={handleBlurEmail}
                    placeholder="contact@agency.gov.in"
                    className={cn(
                      "h-9 text-xs",
                      editEmailError && "border-destructive focus-visible:ring-destructive/20"
                    )}
                  />
                  {editEmailError && (
                    <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{editEmailError}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-org-phone" className="text-xs font-semibold">
                    Contact Number *
                  </Label>
                  <Input
                    id="edit-org-phone"
                    value={editPhone}
                    onChange={(e) => {
                      setEditPhone(e.target.value);
                      if (editPhoneError) setEditPhoneError("");
                    }}
                    onBlur={handleBlurPhone}
                    placeholder="+91 80 2222 1111"
                    className={cn(
                      "h-9 text-xs",
                      editPhoneError && "border-destructive focus-visible:ring-destructive/20"
                    )}
                  />
                  {editPhoneError && (
                    <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{editPhoneError}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Checkbox Cards Grid of Columns */}
              <div className="space-y-3 pt-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Transit Modules & Operational Settings
                </span>

                {/* Primary Modules Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  {/* Card 1: PIS */}
                  <div
                    role="checkbox"
                    aria-checked={editPIS}
                    tabIndex={0}
                    onClick={() => {
                      const next = !editPIS;
                      setEditPIS(next);
                      if (next && !editV1 && !editV2) {
                        setEditV2(true);
                      }
                      setEditRouteError("");
                      if (next || editPAS || editITMS) {
                        setEditModuleError("");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        const next = !editPIS;
                        setEditPIS(next);
                        if (next && !editV1 && !editV2) {
                          setEditV2(true);
                        }
                        setEditRouteError("");
                        if (next || editPAS || editITMS) {
                          setEditModuleError("");
                        }
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
                        <Airplay className="h-4 w-4 text-blue-600 shrink-0" />
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
                    onClick={() => {
                      const next = !editPAS;
                      setEditPAS(next);
                      if (next || editPIS || editITMS) {
                        setEditModuleError("");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        const next = !editPAS;
                        setEditPAS(next);
                        if (next || editPIS || editITMS) {
                          setEditModuleError("");
                        }
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
                    onClick={() => {
                      const next = !editITMS;
                      setEditITMS(next);
                      if (next || editPIS || editPAS) {
                        setEditModuleError("");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        const next = !editITMS;
                        setEditITMS(next);
                        if (next || editPIS || editPAS) {
                          setEditModuleError("");
                        }
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

                  {/* Card 4: Account Operational Status */}
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

                {editModuleError && (
                  <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{editModuleError}</span>
                  </p>
                )}

                {/* PIS Features: V1 & V2 Route Access (shown only if PIS is checked) */}
                {editPIS && (
                  <div className="space-y-2 pt-2 border-t border-border/70 animate-in fade-in-50 duration-200">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      PIS Route Formats & Display Engines *
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* V2 Route Engine */}
                      <div
                        role="checkbox"
                        aria-checked={editV2}
                        tabIndex={0}
                        onClick={() => {
                          const nextV2 = !editV2;
                          setEditV2(nextV2);
                          if (nextV2 || editV1) {
                            setEditRouteError("");
                          } else {
                            setEditRouteError("At least one route format engine (V1 or V2) must be selected when PIS is enabled.");
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            const nextV2 = !editV2;
                            setEditV2(nextV2);
                            if (nextV2 || editV1) {
                              setEditRouteError("");
                            } else {
                              setEditRouteError("At least one route format engine (V1 or V2) must be selected when PIS is enabled.");
                            }
                          }
                        }}
                        className={cn(
                          "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                          editV2
                            ? "border-emerald-500/70 bg-emerald-500/5 text-foreground ring-1 ring-emerald-500/20 shadow-2xs"
                            : editRouteError
                            ? "border-destructive/60 bg-destructive/5 text-muted-foreground"
                            : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                            <Sliders className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span>V2 Route Engine (Modern)</span>
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

                      {/* V1 Route Legacy */}
                      <div
                        role="checkbox"
                        aria-checked={editV1}
                        tabIndex={0}
                        onClick={() => {
                          const nextV1 = !editV1;
                          setEditV1(nextV1);
                          if (nextV1 || editV2) {
                            setEditRouteError("");
                          } else {
                            setEditRouteError("At least one route format engine (V1 or V2) must be selected when PIS is enabled.");
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            const nextV1 = !editV1;
                            setEditV1(nextV1);
                            if (nextV1 || editV2) {
                              setEditRouteError("");
                            } else {
                              setEditRouteError("At least one route format engine (V1 or V2) must be selected when PIS is enabled.");
                            }
                          }
                        }}
                        className={cn(
                          "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                          editV1
                            ? "border-amber-500/70 bg-amber-500/5 text-foreground ring-1 ring-amber-500/20 shadow-2xs"
                            : editRouteError
                            ? "border-destructive/60 bg-destructive/5 text-muted-foreground"
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
                          Legacy single-line LED microcontrollers
                        </p>
                      </div>
                    </div>

                    {editRouteError && (
                      <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{editRouteError}</span>
                      </p>
                    )}
                  </div>
                )}
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
                  disabled={isUpdating || isValidatingDuplicates}
                  className="text-xs font-semibold gap-1.5"
                >
                  {isUpdating || isValidatingDuplicates ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {isValidatingDuplicates ? "Validating..." : "Saving..."}
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

      {/* Status Change Confirmation Dialog */}
      <Dialog open={!!statusConfirmOrg} onOpenChange={(open) => !open && setStatusConfirmOrg(null)}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center mb-2",
                statusConfirmOrg?.active
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {statusConfirmOrg?.active ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
            <DialogTitle className="text-base font-bold">
              {statusConfirmOrg?.active ? "Suspend Organization" : "Activate Organization"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground space-y-2 pt-1">
              <span>
                Are you sure you want to{" "}
                <strong className="text-foreground">
                  {statusConfirmOrg?.active ? "suspend" : "activate"}
                </strong>{" "}
                this organization?
              </span>
              <span className="block font-medium">
                {statusConfirmOrg?.active
                  ? "Suspending this organization will temporarily restrict depot access, fleet telemetry, and vehicle configurations."
                  : "Activating this organization will re-enable all configured transit modules and operational access for assigned users."}
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusConfirmOrg(null)}
              disabled={isTogglingStatus}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={statusConfirmOrg?.active ? "destructive" : "default"}
              size="sm"
              onClick={handleToggleStatusConfirm}
              disabled={isTogglingStatus}
              className={cn(
                "text-xs font-semibold gap-1.5",
                !statusConfirmOrg?.active && "bg-emerald-600 hover:bg-emerald-700 text-white"
              )}
            >
              {isTogglingStatus ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Updating...
                </>
              ) : statusConfirmOrg?.active ? (
                "Deactivate"
              ) : (
                "Activate"
              )}
            </Button>
          </DialogFooter>
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
                Are you sure you want to permanently delete this organization?
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
