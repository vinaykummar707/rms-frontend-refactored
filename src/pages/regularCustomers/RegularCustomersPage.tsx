import { useState, useMemo } from "react";
import { cn } from "cn";
import { supabase, supabaseAuthHelper } from "@/integrations/supabase/client";
import { loggedUserCrud } from "@/features/users/api/userCrud";
import { roleCrud } from "@/features/users/api/roleCrud";
import { sendUserPasswordReset } from "@/features/users/services/userService";
import { useAuthStore } from "@/core/auth/authStore";
import { formatDate, sortByLatestCreated } from "@/shared/utils/dateUtils";
import { notify } from "@/core/notifications/notificationService";
import { isSuperAdmin } from "@/core/authorization/customerTier";
import type { ILoggedUser } from "@/shared/types/user";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PasswordViewerCell } from "./components/PasswordViewerCell";
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Calendar,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Tag,
  Layers,
  KeyRound,
  X,
  UserCheck,
  CheckCircle2,
} from "lucide-react";

const REGULAR_ROLE_ID = "fd72d0e0-831e-494c-96a5-3e153ab3e2db";
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function RegularCustomersPage() {
  const loggedInUser = useAuthStore((state) => state.user);
  const isSuper = isSuperAdmin(loggedInUser);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ILoggedUser | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<ILoggedUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Status Suspension Dialog State
  const [statusPromptCustomer, setStatusPromptCustomer] = useState<{
    customer: ILoggedUser;
    nextActive: boolean;
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Form Fields State
  const [formEmail, setFormEmail] = useState("");
  const [formEmailError, setFormEmailError] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPasswordError, setFormPasswordError] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formV1, setFormV1] = useState(false);
  const [formV2, setFormV2] = useState(true);
  const [formPIS, setFormPIS] = useState(true);
  const [formPAS, setFormPAS] = useState(false);
  const [formITMS, setFormITMS] = useState(false);
  const [formRouteEngineError, setFormRouteEngineError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query Regular Customers
  const { useList } = loggedUserCrud;
  const { data, isLoading, refetch } = useList({
    custom(query) {
      return query
        .select(`*, role:role_id (*)`)
        .or(
          "customer_type.eq.regular,role_id.eq.fd72d0e0-831e-494c-96a5-3e153ab3e2db,organization_id.is.null"
        );
    },
    orderBy: { column: "created_at", ascending: false },
  });

  // Query Roles to find regular role if needed
  const { data: rolesData } = roleCrud.useList();
  const regularRole = useMemo(() => {
    const list = rolesData?.data || [];
    return (
      list.find((r) => r.id === REGULAR_ROLE_ID) ||
      list.find((r) => r.name.toLowerCase() === "user") ||
      null
    );
  }, [rolesData]);

  const rawUsers = useMemo(
    () => (data ? (data.data as ILoggedUser[]) : []),
    [data]
  );

  // Filter strictly to regular customers, excluding logged-in self user
  const regularCustomers = useMemo(() => {
    const list = rawUsers.filter(
      (u) =>
        (u.customer_type === "regular" ||
          u.role?.name?.toLowerCase() === "user" ||
          !u.organization_id) &&
        u.id !== loggedInUser?.id &&
        u.user_id !== loggedInUser?.user_id &&
        u.email?.toLowerCase() !== loggedInUser?.email?.toLowerCase()
    );
    return sortByLatestCreated(list);
  }, [rawUsers, loggedInUser]);

  // Apply search query
  const filteredCustomers = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return regularCustomers;
    return regularCustomers.filter((u) =>
      (u.email || "").toLowerCase().includes(query)
    );
  }, [regularCustomers, searchTerm]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = regularCustomers.length;
    const active = regularCustomers.filter((u) => u.active).length;
    const v1Enabled = regularCustomers.filter((u) => u.v1_routes).length;
    const v2Enabled = regularCustomers.filter((u) => u.v2_routes).length;
    return { total, active, v1Enabled, v2Enabled };
  }, [regularCustomers]);

  // Handle Refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await refetch();
      notify.info("Customer list refreshed");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormEmail("");
    setFormEmailError("");
    setFormPassword("");
    setFormPasswordError("");
    setFormActive(true);
    setFormV1(false);
    setFormV2(true);
    setFormPIS(true);
    setFormPAS(false);
    setFormITMS(false);
    setFormRouteEngineError("");
    setIsFormOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (customer: ILoggedUser) => {
    setEditingCustomer(customer);
    setFormEmail(customer.email || "");
    setFormEmailError("");
    setFormPassword("");
    setFormPasswordError("");
    setFormActive(Boolean(customer.active));
    setFormV1(Boolean(customer.v1_routes));
    setFormV2(customer.v2_routes !== false);
    setFormPIS(Boolean((customer as any).PIS ?? true));
    setFormPAS(Boolean((customer as any).PAS ?? false));
    setFormITMS(Boolean((customer as any).ITMS ?? false));
    setFormRouteEngineError("");
    setIsFormOpen(true);
  };

  // Form Submit Handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;
    const trimmedEmail = formEmail.trim();

    if (!trimmedEmail) {
      setFormEmailError("Customer email is required.");
      hasError = true;
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      setFormEmailError("Enter a valid email address.");
      hasError = true;
    }

    if (!editingCustomer) {
      if (!formPassword) {
        setFormPasswordError("Password is required.");
        hasError = true;
      } else if (formPassword.length < 6) {
        setFormPasswordError("Password must be at least 6 characters.");
        hasError = true;
      }
    }

    // Validation: If PIS is enabled, at least 1 route engine (V1 or V2) must be selected
    if (formPIS && !formV1 && !formV2) {
      setFormRouteEngineError(
        "At least one route engine (V1 or V2) must be selected when PIS is enabled."
      );
      notify.error(
        "At least one route engine (V1 or V2) must be selected when PIS is enabled."
      );
      hasError = true;
    }

    if (hasError) return;

    const roleId = regularRole?.id || REGULAR_ROLE_ID;

    const basePayload: Record<string, any> = {
      role_id: roleId,
      customer_type: "regular" as const,
      organization_id: null,
      region_id: null,
      depot_id: null,
      active: Boolean(formActive),
      v1_routes: Boolean(formV1),
      v2_routes: Boolean(formV2),
      PIS: Boolean(formPIS),
      PAS: Boolean(formPAS),
      ITMS: Boolean(formITMS),
    };

    try {
      setIsSubmitting(true);

      if (editingCustomer) {
        // UPDATE MODE
        const updatePayload: Record<string, any> = { ...basePayload };
        if (isSuper && formPassword && formPassword.trim().length > 0) {
          updatePayload.password = formPassword.trim();
        }

        let { error: updateError } = await supabase
          .from("users")
          .update(updatePayload)
          .eq("id", editingCustomer.id);

        if (updateError && (updateError.code === "PGRST204" || updateError.code === "42703")) {
          const { PIS, PAS, ITMS, ...fbPayload } = updatePayload;
          const { error: fbErr } = await supabase
            .from("users")
            .update(fbPayload)
            .eq("id", editingCustomer.id);
          updateError = fbErr;
        }

        if (updateError) throw updateError;

        notify.success("Regular Customer updated successfully");
        setIsFormOpen(false);
        setEditingCustomer(null);
        refetch();
        return;
      }

      // CREATE MODE
      // 1. Check if user already exists in public.users
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (existingUser) {
        setFormEmailError("A user with this email address already exists.");
        notify.error("A user with this email address already exists.");
        setIsSubmitting(false);
        return;
      }

      // 2. Sign up user via supabaseAuthHelper
      const { data: signUpData, error: signUpError } =
        await supabaseAuthHelper.auth.signUp({
          email: trimmedEmail,
          password: formPassword,
          options: {
            data: {
              customer_type: "regular",
              v1_routes: formV1,
              v2_routes: formV2,
              PIS: formPIS,
              PAS: formPAS,
              ITMS: formITMS,
            },
          },
        });

      let userId = signUpData?.user?.id;

      if (signUpError) {
        const errMsg = signUpError.message.toLowerCase();
        if (
          errMsg.includes("already registered") ||
          errMsg.includes("already exists")
        ) {
          const { data: signInData, error: signInErr } =
            await supabaseAuthHelper.auth.signInWithPassword({
              email: trimmedEmail,
              password: formPassword,
            });

          if (signInData?.user?.id) {
            userId = signInData.user.id;
          } else {
            notify.error(
              `User exists in auth. ${signInErr?.message ? `(${signInErr.message})` : "Please verify password."}`
            );
            return;
          }
        } else {
          notify.error(`Sign up failed: ${signUpError.message}`);
          return;
        }
      } else if (
        signUpData?.user &&
        (!signUpData.user.identities || signUpData.user.identities.length === 0)
      ) {
        const { data: signInData, error: signInErr } =
          await supabaseAuthHelper.auth.signInWithPassword({
            email: trimmedEmail,
            password: formPassword,
          });

        if (signInData?.user?.id) {
          userId = signInData.user.id;
        } else {
          notify.error(`Authentication error: ${signInErr?.message || "User exists"}`);
          setIsSubmitting(false);
          return;
        }
      }

      if (!userId) {
        notify.error("Unable to obtain authentication user ID");
        setIsSubmitting(false);
        return;
      }

      // 3. Insert into public.users
      const insertPayload: Record<string, any> = {
        email: trimmedEmail,
        user_id: userId,
        password: formPassword,
        ...basePayload,
      };

      let { error: insErr } = await supabase.from("users").insert(insertPayload);
      if (insErr && (insErr.code === "PGRST204" || insErr.code === "42703")) {
        const { PIS, PAS, ITMS, ...fbPayload } = insertPayload;
        const { error: fbErr } = await supabase.from("users").insert(fbPayload);
        insErr = fbErr;
      }

      if (insErr) throw insErr;

      notify.success("Regular Customer created successfully");
      setIsFormOpen(false);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request Status Toggle (Opens confirmation dialog)
  const handleRequestToggleActive = (customer: ILoggedUser) => {
    setStatusPromptCustomer({
      customer,
      nextActive: !customer.active,
    });
  };

  // Confirm Status Toggle
  const handleConfirmStatusToggle = async () => {
    if (!statusPromptCustomer) return;
    const { customer: targetCustomer, nextActive } = statusPromptCustomer;
    try {
      setIsUpdatingStatus(true);
      const { error } = await supabase
        .from("users")
        .update({ active: nextActive })
        .eq("id", targetCustomer.id);

      if (error) throw error;
      notify.success(
        `Customer "${targetCustomer.email}" ${nextActive ? "activated" : "suspended"}`
      );
      setStatusPromptCustomer(null);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Delete Customer
  const handleDeleteConfirm = async () => {
    if (!deletingCustomer) return;
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", deletingCustomer.id);

      if (error) throw error;
      notify.success(`Customer "${deletingCustomer.email}" deleted successfully`);
      setDeletingCustomer(null);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to delete customer");
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset Password Trigger
  const handleTriggerPasswordReset = async (email: string) => {
    try {
      setIsResettingPassword(true);
      await sendUserPasswordReset(email);
      notify.success(`Password reset email sent to ${email}`);
    } catch (err: any) {
      notify.error(err.message || "Failed to send password reset email");
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <UserCheck className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Regular Customers
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage standalone customer accounts, login status, and format permissions.
        </p>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">
            Total Customers
          </span>
          <span className="text-2xl font-bold text-foreground">
            {metrics.total}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">
            Active Accounts
          </span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.active}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">
            V1 Format Enabled
          </span>
          <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {metrics.v1Enabled}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">
            V2 Format Enabled
          </span>
          <span className="text-2xl font-bold text-primary">
            {metrics.v2Enabled}
          </span>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by customer email..."
            className="pl-9 pr-8 h-9 text-xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Regular Customer</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        /* Loading Skeletons */
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
              <Skeleton className="h-6 w-1/2" />
              <div className="flex justify-between pt-2">
                <Skeleton className="h-7 w-16 rounded-md" />
                <Skeleton className="h-7 w-16 rounded-md" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No regular customers found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {searchTerm
              ? `No customers match "${searchTerm}".`
              : "No regular enterprise customers have been registered yet."}
          </p>
          {searchTerm ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="mt-4 text-xs"
            >
              Clear Search
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="mt-4 text-xs font-semibold gap-1.5 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Regular Customer</span>
            </Button>
          )}
        </div>
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {filteredCustomers.map((customer) => {
            const email = customer.email || "Unknown";
            const initials = email.slice(0, 2).toUpperCase();

            return (
              <Card
                key={customer.id}
                className="relative flex flex-col justify-between transition-all duration-200 border-border/80 bg-card hover:border-foreground/20 hover:shadow-md"
              >
                <div>
                  {/* Card Header */}
                  <CardHeader className="pb-2.5 block w-full min-w-0">
                    <div className="flex items-start justify-between gap-2 w-full min-w-0">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <Avatar className="h-9 w-9 rounded-xl after:rounded-xl shrink-0 mt-0.5">
                          <AvatarFallback className="rounded-xl text-xs font-bold text-white bg-emerald-600 shadow-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {/* Active Status Switch */}
                      <div
                        className="flex items-center gap-1.5 shrink-0 mt-0.5"
                        title={`Click to ${customer.active ? "suspend" : "activate"}`}
                      >
                        <span
                          onClick={() => handleRequestToggleActive(customer)}
                          className={cn(
                            "text-[10px] font-semibold cursor-pointer select-none",
                            customer.active
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {customer.active ? "Active" : "Suspended"}
                        </span>
                        <Switch
                          size="sm"
                          checked={Boolean(customer.active)}
                          onCheckedChange={() => handleRequestToggleActive(customer)}
                          aria-label={`Toggle active for ${customer.email}`}
                          className="cursor-pointer data-checked:bg-emerald-600"
                        />
                      </div>
                    </div>
                  </CardHeader>

                  {/* Card Content */}
                  <CardContent className="p-3.5 pt-0 space-y-2.5">
                    {/* Customer Email */}
                    <div className="min-w-0 flex-1">
                      <CardTitle
                        className="text-xs font-semibold leading-snug text-foreground truncate block"
                        title={email}
                      >
                        {email}
                      </CardTitle>
                    </div>

                    {/* Password Viewer */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        Password
                      </span>
                      <PasswordViewerCell password={customer.password} />
                    </div>

                    {/* Route Capabilities Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {customer.v1_routes && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-4.5 px-1.5 gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-semibold"
                        >
                          <Tag className="h-2.5 w-2.5" />
                          <span>V1 Engine</span>
                        </Badge>
                      )}
                      {customer.v2_routes && (
                        <Badge
                          variant="default"
                          className="text-[10px] h-4.5 px-1.5 gap-1 font-semibold"
                        >
                          <Layers className="h-2.5 w-2.5" />
                          <span>V2 Engine</span>
                        </Badge>
                      )}
                      {(customer as any).PIS && (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1 text-muted-foreground"
                        >
                          PIS
                        </Badge>
                      )}
                      {(customer as any).PAS && (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1 text-muted-foreground"
                        >
                          PAS
                        </Badge>
                      )}
                      {(customer as any).ITMS && (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1 text-muted-foreground"
                        >
                          ITMS
                        </Badge>
                      )}
                    </div>

                    {/* Created Date */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      <span>Registered {formatDate(customer.created_at)}</span>
                    </div>
                  </CardContent>
                </div>

                {/* Card Footer */}
                <CardFooter className="px-3.5 py-2.5 border-t border-border/80 flex items-center justify-end gap-1.5 bg-muted/20">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(customer)}
                    className="h-7 text-xs px-2.5 gap-1 hover:bg-muted font-medium"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                    <span>Edit</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingCustomer(customer)}
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

      {/* Create / Edit Customer Dialog */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open, details?: any) => {
          if (!open) {
            if (
              details?.reason === "outside-press" ||
              details?.reason === "outsidePress"
            ) {
              return;
            }
            setIsFormOpen(false);
          }
        }}
        disablePointerDismissal={true}
      >
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                {editingCustomer ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  {editingCustomer
                    ? "Edit Regular Customer"
                    : "Add Regular Customer"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {editingCustomer
                    ? "Update account permissions and format access."
                    : "Provision a new standalone commercial customer account."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
            {/* Email Input */}
            <div className="space-y-1.5">
              <Label htmlFor="customer-email" className="text-xs font-semibold">
                Customer Email *
              </Label>
              <Input
                id="customer-email"
                type="email"
                value={formEmail}
                onChange={(e) => {
                  setFormEmail(e.target.value);
                  if (formEmailError) setFormEmailError("");
                }}
                disabled={Boolean(editingCustomer)}
                placeholder="customer@company.com"
                className={cn(
                  "h-9 text-xs",
                  formEmailError &&
                    "border-destructive focus-visible:ring-destructive/20"
                )}
                autoFocus={!editingCustomer}
              />
              {formEmailError && (
                <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{formEmailError}</span>
                </p>
              )}
            </div>

            {/* Password Input (Create Mode Only) */}
            {!editingCustomer ? (
              <div className="space-y-1.5">
                <Label
                  htmlFor="customer-password"
                  className="text-xs font-semibold"
                >
                  Account Password *
                </Label>
                <Input
                  id="customer-password"
                  type="password"
                  value={formPassword}
                  onChange={(e) => {
                    setFormPassword(e.target.value);
                    if (formPasswordError) setFormPasswordError("");
                  }}
                  placeholder="Minimum 6 characters"
                  className={cn(
                    "h-9 text-xs",
                    formPasswordError &&
                      "border-destructive focus-visible:ring-destructive/20"
                  )}
                />
                {formPasswordError && (
                  <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{formPasswordError}</span>
                  </p>
                )}
              </div>
            ) : (
              /* Password Reset Action in Edit Mode */
              <div className="rounded-lg bg-muted/50 p-3 border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground block">
                    Password Reset
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    Send instructions to reset password.
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleTriggerPasswordReset(formEmail)}
                  disabled={isResettingPassword}
                  className="h-7 text-xs gap-1 font-medium"
                >
                  <KeyRound className="h-3 w-3" />
                  <span>
                    {isResettingPassword ? "Sending..." : "Send Reset Link"}
                  </span>
                </Button>
              </div>
            )}

            {/* Active Status */}
            <div className="flex items-center justify-between rounded-lg border border-border/80 p-3">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Account Status</Label>
                <p className="text-[11px] text-muted-foreground">
                  Allow this customer to log in and create routes.
                </p>
              </div>
              <Switch
                checked={formActive}
                onCheckedChange={setFormActive}
                className="data-checked:bg-emerald-600"
              />
            </div>

            {/* Route Format Permissions */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-semibold block">
                Allowed Route Engines
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs font-medium">V1 Route Engine</span>
                  </div>
                  <Switch
                    checked={formV1}
                    onCheckedChange={(checked) => {
                      setFormV1(checked);
                      if (checked || formV2 || !formPIS) setFormRouteEngineError("");
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">V2 Route Engine</span>
                  </div>
                  <Switch
                    checked={formV2}
                    onCheckedChange={(checked) => {
                      setFormV2(checked);
                      if (checked || formV1 || !formPIS) setFormRouteEngineError("");
                    }}
                  />
                </div>
              </div>
              {formRouteEngineError && (
                <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{formRouteEngineError}</span>
                </p>
              )}
            </div>

            {/* Module Features */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-semibold block">
                Module Features
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center justify-between rounded-lg border border-border p-2">
                  <span className="text-xs font-medium">PIS</span>
                  <Switch
                    size="sm"
                    checked={formPIS}
                    onCheckedChange={(checked) => {
                      setFormPIS(checked);
                      if (!checked || formV1 || formV2) setFormRouteEngineError("");
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-2">
                  <span className="text-xs font-medium">PAS</span>
                  <Switch size="sm" checked={formPAS} onCheckedChange={setFormPAS} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-2">
                  <span className="text-xs font-medium">ITMS</span>
                  <Switch
                    size="sm"
                    checked={formITMS}
                    onCheckedChange={setFormITMS}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormOpen(false)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="text-xs font-semibold gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>
                    {editingCustomer
                      ? "Save Changes"
                      : "Create Customer"}
                  </span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingCustomer)}
        onOpenChange={(open, details?: any) => {
          if (!open) {
            if (
              details?.reason === "outside-press" ||
              details?.reason === "outsidePress"
            ) {
              return;
            }
            setDeletingCustomer(null);
          }
        }}
        disablePointerDismissal={true}
      >
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-bold">
              Delete Regular Customer
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground space-y-2 pt-1">
              <span>
                This action cannot be undone. Are you sure you want to permanently delete regular customer{" "}
                <strong className="text-foreground">
                  "{deletingCustomer?.email}"
                </strong>
                ?
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingCustomer(null)}
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
                  Delete Customer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Suspension / Activation Confirmation Dialog */}
      <Dialog
        open={Boolean(statusPromptCustomer)}
        onOpenChange={(open, details?: any) => {
          if (!open) {
            if (
              details?.reason === "outside-press" ||
              details?.reason === "outsidePress"
            ) {
              return;
            }
            setStatusPromptCustomer(null);
          }
        }}
        disablePointerDismissal={true}
      >
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center mb-2",
                statusPromptCustomer?.nextActive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              )}
            >
              {statusPromptCustomer?.nextActive ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <DialogTitle className="text-base font-bold">
              {statusPromptCustomer?.nextActive
                ? "Activate Customer Account"
                : "Suspend Customer Account"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              {statusPromptCustomer?.nextActive ? (
                <span>
                  Are you sure you want to activate the account for{" "}
                  <strong className="text-foreground">
                    {statusPromptCustomer?.customer.email}
                  </strong>
                  ? This customer will immediately be allowed to log in and
                  manage their routes.
                </span>
              ) : (
                <span>
                  Are you sure you want to suspend the account for{" "}
                  <strong className="text-foreground">
                    {statusPromptCustomer?.customer.email}
                  </strong>
                  ? This customer will immediately be blocked from logging into the
                  platform until reactivated.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusPromptCustomer(null)}
              disabled={isUpdatingStatus}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmStatusToggle}
              disabled={isUpdatingStatus}
              className={cn(
                "text-xs font-semibold gap-1.5 text-white",
                statusPromptCustomer?.nextActive
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700"
              )}
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>
                    {statusPromptCustomer?.nextActive
                      ? "Activating..."
                      : "Suspending..."}
                  </span>
                </>
              ) : (
                <span>
                  {statusPromptCustomer?.nextActive
                    ? "Yes, Activate"
                    : "Yes, Suspend Account"}
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RegularCustomersPage;

