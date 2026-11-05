import { useState, useMemo } from "react";
import { cn } from "cn";
import { supabase, supabaseAuthHelper } from "@/integrations/supabase/client";
import { loggedUserCrud } from "@/features/users/api/userCrud";
import { roleCrud } from "@/features/users/api/roleCrud";
import { useAuthStore } from "@/core/auth/authStore";
import { formatDate, sortByLatestCreated } from "@/shared/utils/dateUtils";
import { notify } from "@/core/notifications/notificationService";
import type { ILoggedUser } from "@/shared/types/user";
import { Checkbox } from "@/components/ui/checkbox";
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
  Check,
  ChevronLeft,
  ChevronRight,
  Radio,
  Sliders,
  Volume2,
  Cpu,
  Eye,
  EyeOff,
} from "lucide-react";

const REGULAR_ROLE_ID = "fd72d0e0-831e-494c-96a5-3e153ab3e2db";
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function FieldErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export function RegularCustomersPage() {
  const loggedInUser = useAuthStore((state) => state.user);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [editingCustomer, setEditingCustomer] = useState<ILoggedUser | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<ILoggedUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
  const [showPassword, setShowPassword] = useState(false);
  const [formActive, setFormActive] = useState(true);
  const [formV1, setFormV1] = useState(false);
  const [formV2, setFormV2] = useState(false);
  const [formPIS, setFormPIS] = useState(false);
  const [formPAS, setFormPAS] = useState(false);
  const [formITMS, setFormITMS] = useState(false);
  const [formRouteEngineError, setFormRouteEngineError] = useState("");
  const [formModuleError, setFormModuleError] = useState("");
  const [isCheckingStep, setIsCheckingStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = [
    { num: 1, title: "Customer Details", icon: KeyRound },
    { num: 2, title: "Transit Modules", icon: Sliders },
  ];

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
    setCurrentStep(1);
    setFormEmail("");
    setFormEmailError("");
    setFormPassword("");
    setFormPasswordError("");
    setShowPassword(false);
    setFormActive(true);
    setFormV1(false);
    setFormV2(false);
    setFormPIS(false);
    setFormPAS(false);
    setFormITMS(false);
    setFormRouteEngineError("");
    setFormModuleError("");
    setIsFormOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (customer: ILoggedUser) => {
    setEditingCustomer(customer);
    setCurrentStep(1);
    setFormEmail(customer.email || "");
    setFormEmailError("");
    setFormPassword(customer.password || "");
    setFormPasswordError("");
    setShowPassword(false);
    setFormActive(Boolean(customer.active));
    setFormV1(Boolean(customer.v1_routes));
    setFormV2(Boolean(customer.v2_routes));
    setFormPIS(Boolean((customer as any).PIS));
    setFormPAS(Boolean((customer as any).PAS));
    setFormITMS(Boolean((customer as any).ITMS));
    setFormRouteEngineError("");
    setFormModuleError("");
    setIsFormOpen(true);
  };

  // Wizard Step Navigation
  const handleNext = async () => {
    let hasError = false;
    const trimmedEmail = formEmail.trim();

    if (!trimmedEmail) {
      setFormEmailError("Customer email is required.");
      hasError = true;
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      setFormEmailError("Enter a valid email address.");
      hasError = true;
    } else {
      setFormEmailError("");
    }

    if (!editingCustomer) {
      if (!formPassword) {
        setFormPasswordError("Password is required.");
        hasError = true;
      } else if (formPassword.length < 6) {
        setFormPasswordError("Password must be at least 6 characters.");
        hasError = true;
      } else {
        setFormPasswordError("");
      }
    } else {
      if (!formPassword || formPassword.trim().length === 0) {
        setFormPasswordError("Password is required.");
        hasError = true;
      } else if (formPassword.length < 6) {
        setFormPasswordError("Password must be at least 6 characters.");
        hasError = true;
      } else {
        setFormPasswordError("");
      }
    }

    if (hasError) return;

    // Check if customer email already exists in Supabase users table (Step 1 error check)
    if (!editingCustomer) {
      try {
        setIsCheckingStep(true);
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", trimmedEmail)
          .maybeSingle();

        if (existingUser) {
          setFormEmailError("A customer with this email address already exists.");
          return;
        }
      } catch (err: any) {
        console.warn("Customer email check error:", err);
      } finally {
        setIsCheckingStep(false);
      }
    }

    setCurrentStep(2);
  };

  const handleBack = () => {
    setFormRouteEngineError("");
    setFormModuleError("");
    setCurrentStep(1);
  };

  // Form Submit Handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentStep === 1) {
      await handleNext();
      return;
    }

    const trimmedEmail = formEmail.trim();

    // Validation: At least one module must be selected
    if (!formPIS && !formPAS && !formITMS) {
      setFormModuleError(
        "At least one intelligent transit module (PIS, PAS, or ITMS) must be enabled."
      );
      return;
    }

    // Validation: If PIS is enabled, at least 1 route engine (V1 or V2) must be selected
    if (formPIS && !formV1 && !formV2) {
      setFormRouteEngineError(
        "At least one route format engine (V1 or V2) must be selected when PIS is enabled."
      );
      return;
    }

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
        if (formPassword && formPassword.trim().length > 0) {
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
        setFormEmailError("A customer with this email address already exists.");
        setCurrentStep(1);
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
        <DialogContent className="sm:max-w-2xl p-6">
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
                    ? "Update account credentials and module access."
                    : "Provision a new standalone commercial customer account."}
                </DialogDescription>
              </div>
            </div>

            {/* Stepper Wizard Bar */}
            <div className="grid grid-cols-2 gap-2 pt-3">
              {steps.map((step) => {
                const Icon = step.icon;
                const isPassed = step.num < currentStep;
                const isCurrent = step.num === currentStep;
                return (
                  <div
                    key={step.num}
                    className={cn(
                      "flex flex-col items-center gap-1 pb-1.5 border-b-2 text-center transition-all",
                      isCurrent
                        ? "border-primary text-primary font-semibold"
                        : isPassed
                        ? "border-emerald-600 text-emerald-600"
                        : "border-border text-muted-foreground opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-xs">
                      {isPassed ? (
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                      <span className="text-[11px] font-medium">
                        {step.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
            {/* Step 1: Customer Credentials & Details */}
            {currentStep === 1 && (
              <div className="space-y-4">
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
                  <FieldErrorText message={formEmailError} />
                </div>

                {/* Password Input (Editable in both Create & Edit) */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="customer-password"
                    className="text-xs font-semibold"
                  >
                    {editingCustomer ? "Password (Editable)" : "Account Password *"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="customer-password"
                      type={showPassword ? "text" : "password"}
                      value={formPassword}
                      onChange={(e) => {
                        setFormPassword(e.target.value);
                        if (formPasswordError) setFormPasswordError("");
                      }}
                      placeholder={
                        editingCustomer
                          ? "Enter new password or leave current"
                          : "Minimum 6 characters"
                      }
                      className={cn(
                        "h-9 text-xs pr-9",
                        formPasswordError &&
                          "border-destructive focus-visible:ring-destructive/20"
                      )}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      onClick={() => setShowPassword((prev) => !prev)}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <FieldErrorText message={formPasswordError} />
                </div>

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
              </div>
            )}

            {/* Step 2: Transit Capabilities & Modules */}
            {currentStep === 2 && (
              <div className="space-y-4">
                {/* Section Header */}
                <div>
                  <span className="text-xs font-semibold text-foreground block">
                    Intelligent Transit Modules
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enable onboard hardware systems, telematics, and announcement technologies.
                  </p>
                </div>

                {/* Modules Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                  {/* Card 1: PIS */}
                  <div
                    role="checkbox"
                    aria-checked={formPIS}
                    tabIndex={0}
                    onClick={() => {
                      const nextPIS = !formPIS;
                      setFormPIS(nextPIS);
                      if (nextPIS && !formV1 && !formV2) {
                        setFormV2(true);
                      }
                      setFormRouteEngineError("");
                      if (formModuleError) setFormModuleError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        const nextPIS = !formPIS;
                        setFormPIS(nextPIS);
                        if (nextPIS && !formV1 && !formV2) {
                          setFormV2(true);
                        }
                        setFormRouteEngineError("");
                        if (formModuleError) setFormModuleError("");
                      }
                    }}
                    className={cn(
                      "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                      formPIS
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
                        checked={formPIS}
                        tabIndex={-1}
                        className="size-5 rounded-md border-2 border-foreground/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground pointer-events-none mt-0.5 shadow-xs"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                      Passenger Information System & destination LED signs
                    </p>
                  </div>

                  {/* Card 2: PAS */}
                  <div
                    role="checkbox"
                    aria-checked={formPAS}
                    tabIndex={0}
                    onClick={() => {
                      setFormPAS(!formPAS);
                      if (formModuleError) setFormModuleError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setFormPAS(!formPAS);
                        if (formModuleError) setFormModuleError("");
                      }
                    }}
                    className={cn(
                      "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                      formPAS
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
                        checked={formPAS}
                        tabIndex={-1}
                        className="size-5 rounded-md border-2 border-foreground/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground pointer-events-none mt-0.5 shadow-xs"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                      Synthesized speech announcements & stop arrival chimes
                    </p>
                  </div>

                  {/* Card 3: ITMS */}
                  <div
                    role="checkbox"
                    aria-checked={formITMS}
                    tabIndex={0}
                    onClick={() => {
                      setFormITMS(!formITMS);
                      if (formModuleError) setFormModuleError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        setFormITMS(!formITMS);
                        if (formModuleError) setFormModuleError("");
                      }
                    }}
                    className={cn(
                      "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                      formITMS
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
                        checked={formITMS}
                        tabIndex={-1}
                        className="size-5 rounded-md border-2 border-foreground/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground pointer-events-none mt-0.5 shadow-xs"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                      Real-time GPS telemetry & schedule compliance tracking
                    </p>
                  </div>
                </div>

                <FieldErrorText message={formModuleError} />

                {/* Section 2: PIS Route Display Engines (shown when PIS enabled) */}
                {formPIS && (
                  <div className="space-y-3 pt-3 border-t border-border/80 animate-in fade-in-50 duration-200">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground block">
                          PIS Route Display Engines *
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          PIS Sub-Features
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Select supported route format engines for LED destination boards (select V1, V2, or both).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                      {/* Card: V2 Route Engine */}
                      <div
                        role="checkbox"
                        aria-checked={formV2}
                        tabIndex={0}
                        onClick={() => {
                          const nextV2 = !formV2;
                          setFormV2(nextV2);
                          if (nextV2 || formV1) {
                            setFormRouteEngineError("");
                          } else {
                            setFormRouteEngineError(
                              "At least one route format engine (V1 or V2) must be selected when PIS is enabled."
                            );
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            const nextV2 = !formV2;
                            setFormV2(nextV2);
                            if (nextV2 || formV1) {
                              setFormRouteEngineError("");
                            } else {
                              setFormRouteEngineError(
                                "At least one route format engine (V1 or V2) must be selected when PIS is enabled."
                              );
                            }
                          }
                        }}
                        className={cn(
                          "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                          formV2
                            ? "border-emerald-500/70 bg-emerald-500/5 text-foreground ring-1 ring-emerald-500/20 shadow-2xs"
                            : formRouteEngineError
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
                            checked={formV2}
                            tabIndex={-1}
                            className="size-5 rounded-md border-2 border-foreground/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground pointer-events-none mt-0.5 shadow-xs"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                          Multi-slide bilingual layouts & split-screen Unicode Kannada
                        </p>
                      </div>

                      {/* Card: V1 Route Legacy */}
                      <div
                        role="checkbox"
                        aria-checked={formV1}
                        tabIndex={0}
                        onClick={() => {
                          const nextV1 = !formV1;
                          setFormV1(nextV1);
                          if (nextV1 || formV2) {
                            setFormRouteEngineError("");
                          } else {
                            setFormRouteEngineError(
                              "At least one route format engine (V1 or V2) must be selected when PIS is enabled."
                            );
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            const nextV1 = !formV1;
                            setFormV1(nextV1);
                            if (nextV1 || formV2) {
                              setFormRouteEngineError("");
                            } else {
                              setFormRouteEngineError(
                                "At least one route format engine (V1 or V2) must be selected when PIS is enabled."
                              );
                            }
                          }
                        }}
                        className={cn(
                          "flex flex-col justify-between rounded-lg border p-3 cursor-pointer transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-ring text-left",
                          formV1
                            ? "border-amber-500/70 bg-amber-500/5 text-foreground ring-1 ring-amber-500/20 shadow-2xs"
                            : formRouteEngineError
                            ? "border-destructive/60 bg-destructive/5 text-muted-foreground"
                            : "border-border bg-card/60 hover:bg-muted/40 text-muted-foreground"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                            <Tag className="h-4 w-4 text-amber-600 shrink-0" />
                            <span>V1 Route Engine (Legacy)</span>
                          </div>
                          <Checkbox
                            checked={formV1}
                            tabIndex={-1}
                            className="size-5 rounded-md border-2 border-foreground/50 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground pointer-events-none mt-0.5 shadow-xs"
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-2 leading-tight">
                          Single destination scroll binary format (Firmware 1.x)
                        </p>
                      </div>
                    </div>

                    <FieldErrorText message={formRouteEngineError} />
                  </div>
                )}
              </div>
            )}

            {/* Stepper Footer Buttons */}
            {currentStep === 1 ? (
              <DialogFooter className="flex items-center justify-end sm:justify-end pt-4 border-t border-border">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleNext}
                  disabled={isSubmitting || isCheckingStep}
                  className="text-xs font-semibold gap-1"
                >
                  {isCheckingStep ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            ) : (
              <DialogFooter className="flex items-center justify-between sm:justify-between pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="text-xs font-semibold gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
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
            )}
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

          <DialogFooter className="pt-4 border-t border-border">
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

          <DialogFooter className="pt-4 border-t border-border">
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

