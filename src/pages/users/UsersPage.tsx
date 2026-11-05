import { useState, useMemo } from "react";
import { cn } from "cn";
import { supabase, supabaseAuthHelper } from "@/integrations/supabase/client";
import { useOrganizationStore } from "@/features/stores/useOrganizationStore";
import { useRegionStore } from "@/features/stores/useRegionStore";
import { useAuthStore } from "@/core/auth/authStore";
import { loggedUserCrud } from "@/features/users/api/userCrud";
import { roleCrud } from "@/features/users/api/roleCrud";
import { regionCrud } from "@/features/regions/api/regionCrud";
import { depotCrud } from "@/features/depots/api/depotCrud";
import { checkHierarchyUniqueness } from "@/features/users/services/userService";
import { getUserDeleteImpactMessage } from "@/shared/utils/deleteImpact";
import { canCreateUserOfRole } from "@/core/authorization/permissions";
import { isSuperAdmin } from "@/core/authorization/customerTier";
import { getRoleLabel } from "@/config/constants/roles";
import { formatDate, sortByLatestCreated } from "@/shared/utils/dateUtils";
import { notify } from "@/core/notifications/notificationService";
import type { ILoggedUser, IRole } from "@/shared/types/user";
import type { IRegion } from "@/shared/types/region";
import type { IDepot } from "@/shared/types/depot";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordViewerCell } from "@/pages/regularCustomers/components/PasswordViewerCell";
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Calendar,
  Building2,
  Compass,
  Warehouse,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Tag,
  Layers,
  KeyRound,
  X,
  Filter,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
  Radio,
  Sliders,
  Volume2,
  Cpu,
} from "lucide-react";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

function FieldErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

const toNullableUuid = (val?: string | null): string | null => {
  if (!val) return null;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function UsersPage() {
  const loggedInUser = useAuthStore((state) => state.user);
  const { selectedOrganization } = useOrganizationStore();
  const selectedRegion = useRegionStore((state) => state.selectedRegion);

  const activeOrgId =
    selectedOrganization?.id || loggedInUser?.organization_id || loggedInUser?.organization?.id;
  const activeOrgName =
    selectedOrganization?.name || loggedInUser?.organization?.name || "Organization";

  const isSuper = isSuperAdmin(loggedInUser);
  const userRole = loggedInUser?.role?.name?.toLowerCase() || "";
  const canManage =
    userRole === "region_admin" ||
    userRole === "organization_admin" ||
    userRole === "master" ||
    userRole === "depot_admin";

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [editingUser, setEditingUser] = useState<ILoggedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<ILoggedUser | null>(null);
  const [deleteImpactMsg, setDeleteImpactMsg] = useState("");
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Status Suspension Dialog State
  const [statusPromptUser, setStatusPromptUser] = useState<{
    user: ILoggedUser;
    nextActive: boolean;
  } | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Form Fields State
  const [formEmail, setFormEmail] = useState("");
  const [formEmailError, setFormEmailError] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPasswordError, setFormPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formRoleId, setFormRoleId] = useState("");
  const [formRoleError, setFormRoleError] = useState("");
  const [formRegionId, setFormRegionId] = useState("");
  const [formRegionError, setFormRegionError] = useState("");
  const [formDepotId, setFormDepotId] = useState("");
  const [formDepotError, setFormDepotError] = useState("");
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
    { num: 1, title: "Account Details", icon: KeyRound },
    { num: 2, title: "Transit Modules", icon: Sliders },
  ];

  // Scoped User Query
  const userFilters = useMemo(() => {
    const f: Record<string, any> = {};
    if (isSuper) {
      if (selectedOrganization?.id) {
        f.organization_id = selectedOrganization.id;
      }
    } else if (userRole === "depot_admin") {
      const depotId = loggedInUser?.depot_id || loggedInUser?.depot?.id;
      if (depotId) f.depot_id = depotId;
    } else if (userRole === "region_admin") {
      const regionId = loggedInUser?.region_id || loggedInUser?.region?.id;
      if (regionId) f.region_id = regionId;
    } else {
      const orgId = activeOrgId;
      if (orgId) f.organization_id = orgId;
    }
    return f;
  }, [isSuper, userRole, selectedOrganization?.id, loggedInUser, activeOrgId]);

  const shouldSkip = isSuper
    ? !selectedOrganization?.id
    : Object.keys(userFilters).length === 0;

  const { data, isLoading, refetch } = loggedUserCrud.useList({
    filters: userFilters,
    orderBy: { column: "created_at", ascending: false },
    skip: shouldSkip,
    custom(query) {
      return query.select(`
        *,
        region:region_id (*),
        organization:organization_id (*),
        depot:depot_id (*),
        role:role_id (*)
      `);
    },
  });

  // Query Roles
  const { data: rolesData } = roleCrud.useList();
  const allRoles = useMemo(
    () => (rolesData?.data as IRole[]) || [],
    [rolesData]
  );

  // Query Regions for current organization
  const { data: regionsData } = regionCrud.useList({
    filters: { organization_id: activeOrgId || "" },
    orderBy: { column: "name", ascending: true },
    skip: !activeOrgId,
  });
  const regions = useMemo(
    () => (regionsData?.data as IRegion[]) || [],
    [regionsData]
  );

  // Query Depots for form Region selection
  const { data: depotsData } = depotCrud.useList({
    filters: {
      organization_id: activeOrgId || "",
      ...(formRegionId ? { region_id: formRegionId } : {}),
    },
    orderBy: { column: "name", ascending: true },
    skip: !activeOrgId,
  });
  const depots = useMemo(
    () => (depotsData?.data as IDepot[]) || [],
    [depotsData]
  );

  // Filter allowed roles that current user is permitted to create
  const assignableRoles = useMemo(() => {
    return allRoles.filter((r) => {
      const lower = r.name.toLowerCase();
      if (lower === "master" || lower === "super_admin") return false;
      if (lower === "user") return false; // regular customer role
      return canCreateUserOfRole(loggedInUser, lower);
    });
  }, [allRoles, loggedInUser]);

  const rawUsers = useMemo(
    () => (data ? (data.data as ILoggedUser[]) : []),
    [data]
  );

  // Filter strictly to STU users in this organization, excluding logged-in self user
  const stuUsers = useMemo(() => {
    const list = rawUsers.filter(
      (u) =>
        u.customer_type !== "regular" &&
        u.role?.name?.toLowerCase() !== "user" &&
        u.id !== loggedInUser?.id &&
        u.user_id !== loggedInUser?.user_id &&
        u.email?.toLowerCase() !== loggedInUser?.email?.toLowerCase()
    );
    return sortByLatestCreated(list);
  }, [rawUsers, loggedInUser]);

  // Apply Search & Role Filters
  const filteredUsers = useMemo(() => {
    let result = stuUsers;

    if (roleFilter !== "all") {
      result = result.filter(
        (u) => u.role?.name?.toLowerCase() === roleFilter.toLowerCase()
      );
    }

    const query = searchTerm.toLowerCase().trim();
    if (query) {
      result = result.filter((u) => {
        const email = (u.email || "").toLowerCase();
        const role = (u.role?.name || "").toLowerCase();
        const region = (u.region?.name || "").toLowerCase();
        const depot = (u.depot?.name || "").toLowerCase();
        return (
          email.includes(query) ||
          role.includes(query) ||
          region.includes(query) ||
          depot.includes(query)
        );
      });
    }

    return result;
  }, [stuUsers, searchTerm, roleFilter]);

  // Handle Refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await refetch();
      notify.info("Users list refreshed");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingUser(null);
    setCurrentStep(1);
    setFormEmail("");
    setFormEmailError("");
    setFormPassword("");
    setFormPasswordError("");
    setShowPassword(false);
    setFormRoleId(assignableRoles[0]?.id || "");
    setFormRoleError("");
    setFormRegionId(selectedRegion?.id || regions[0]?.id || "");
    setFormRegionError("");
    setFormDepotId("");
    setFormDepotError("");
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
  const handleOpenEdit = (userItem: ILoggedUser) => {
    setEditingUser(userItem);
    setCurrentStep(1);
    setFormEmail(userItem.email || "");
    setFormEmailError("");
    setFormPassword(userItem.password || "");
    setFormPasswordError("");
    setShowPassword(false);
    setFormRoleId(userItem.role_id || "");
    setFormRoleError("");
    setFormRegionId(userItem.region_id || "");
    setFormRegionError("");
    setFormDepotId(userItem.depot_id || "");
    setFormDepotError("");
    setFormActive(Boolean(userItem.active));
    setFormV1(Boolean(userItem.v1_routes));
    setFormV2(Boolean(userItem.v2_routes));
    setFormPIS(Boolean((userItem as any).PIS));
    setFormPAS(Boolean((userItem as any).PAS));
    setFormITMS(Boolean((userItem as any).ITMS));
    setFormRouteEngineError("");
    setFormModuleError("");
    setIsFormOpen(true);
  };

  // Selected Role inspection
  const selectedRoleName = useMemo(() => {
    const match = allRoles.find((r) => r.id === formRoleId);
    return match?.name?.toLowerCase() || "";
  }, [allRoles, formRoleId]);

  const requiresRegion =
    selectedRoleName === "region_admin" ||
    selectedRoleName === "area_admin" ||
    selectedRoleName === "depot_admin";
  const requiresDepot = selectedRoleName === "depot_admin";

  // Step Navigation
  const handleNext = async () => {
    let hasError = false;
    const trimmedEmail = formEmail.trim();

    if (!trimmedEmail) {
      setFormEmailError("User email is required.");
      hasError = true;
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      setFormEmailError("Enter a valid email address.");
      hasError = true;
    } else {
      setFormEmailError("");
    }

    if (!editingUser) {
      if (!formPassword) {
        setFormPasswordError("Password is required.");
        hasError = true;
      } else if (!PASSWORD_REGEX.test(formPassword)) {
        setFormPasswordError(
          "Password must be at least 8 characters and include uppercase, lowercase, number, and a special character."
        );
        hasError = true;
      } else {
        setFormPasswordError("");
      }
    } else {
      if (!formPassword || formPassword.trim().length === 0) {
        setFormPasswordError("Password is required.");
        hasError = true;
      } else if (formPassword !== (editingUser.password || "") && !PASSWORD_REGEX.test(formPassword)) {
        setFormPasswordError(
          "Password must be at least 8 characters and include uppercase, lowercase, number, and a special character."
        );
        hasError = true;
      } else {
        setFormPasswordError("");
      }
    }

    if (!formRoleId) {
      setFormRoleError("Please select a role.");
      hasError = true;
    } else {
      setFormRoleError("");
    }

    if (requiresRegion && !formRegionId) {
      setFormRegionError("Please select an assigned region.");
      hasError = true;
    } else {
      setFormRegionError("");
    }

    if (requiresDepot && !formDepotId) {
      setFormDepotError("Please select an assigned depot.");
      hasError = true;
    } else {
      setFormDepotError("");
    }

    if (!toNullableUuid(activeOrgId)) {
      notify.error("No active organization selected. Please select an organization.");
      hasError = true;
    }

    if (hasError) return;

    // Check email uniqueness & 1:1 hierarchy uniqueness check
    try {
      setIsCheckingStep(true);

      // 1. Check if user already exists
      if (!editingUser) {
        const { data: existingUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", trimmedEmail)
          .maybeSingle();

        if (existingUser) {
          setFormEmailError("A user with this email address already exists.");
          return;
        }
      }

      // 2. Check 1:1 hierarchy uniqueness check
      const isDuplicate = await checkHierarchyUniqueness(
        selectedRoleName,
        {
          organizationId: activeOrgId,
          regionId: requiresRegion ? formRegionId : null,
          depotId: requiresDepot ? formDepotId : null,
          roleId: formRoleId,
        },
        editingUser?.id
      );

      if (isDuplicate) {
        const isOrgAdmin =
          selectedRoleName === "organization_admin" || selectedRoleName === "org_admin";
        const errorMsg = isOrgAdmin
          ? "An Organization Admin already exists for this organization."
          : selectedRoleName === "region_admin"
          ? "A Region Admin is already assigned to this region."
          : selectedRoleName === "depot_admin"
          ? "A Depot Admin is already assigned to this depot."
          : "Only one user is allowed for the selected organization/region/depot.";

        if (isOrgAdmin) {
          setFormRoleError(errorMsg);
        } else if (selectedRoleName === "region_admin") {
          setFormRegionError(errorMsg);
        } else if (selectedRoleName === "depot_admin") {
          setFormDepotError(errorMsg);
        }

        return;
      }
    } catch (err: any) {
      console.warn("Step 1 validation check error:", err);
    } finally {
      setIsCheckingStep(false);
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
        "At least one route engine (V1 or V2) must be selected when PIS is enabled."
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const payload: Record<string, any> = {
        role_id: toNullableUuid(formRoleId)!,
        customer_type: "stu" as const,
        organization_id: toNullableUuid(activeOrgId),
        region_id: requiresRegion ? toNullableUuid(formRegionId) : null,
        depot_id: requiresDepot ? toNullableUuid(formDepotId) : null,
        active: formActive,
        v1_routes: formV1,
        v2_routes: formV2,
        PIS: formPIS,
        PAS: formPAS,
        ITMS: formITMS,
      };

      if (editingUser) {
        // UPDATE MODE
        const updatePayload: Record<string, any> = { ...payload };
        if (formPassword && formPassword.trim().length > 0) {
          updatePayload.password = formPassword.trim();
        }

        let { error: updateError } = await supabase
          .from("users")
          .update(updatePayload)
          .eq("id", editingUser.id);

        if (updateError && (updateError.code === "PGRST204" || updateError.code === "42703")) {
          const { PIS, PAS, ITMS, ...fbPayload } = updatePayload;
          const { error: fbErr } = await supabase
            .from("users")
            .update(fbPayload)
            .eq("id", editingUser.id);
          updateError = fbErr;
        }

        if (updateError) throw updateError;

        notify.success("STU User updated successfully");
        setIsFormOpen(false);
        setEditingUser(null);
        refetch();
        return;
      }

      // CREATE MODE
      // 1. Check if user already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (existingUser) {
        setFormEmailError("A user with this email address already exists.");
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
              organization_id: activeOrgId,
              customer_type: "stu",
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
            setIsSubmitting(false);
            return;
          }
        } else {
          notify.error(`Sign up failed: ${signUpError.message}`);
          setIsSubmitting(false);
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
        ...payload,
      };

      let { error: insErr } = await supabase.from("users").insert(insertPayload);
      if (insErr && (insErr.code === "PGRST204" || insErr.code === "42703")) {
        const { PIS, PAS, ITMS, ...fbInsert } = insertPayload;
        const { error: fbErr } = await supabase.from("users").insert(fbInsert);
        insErr = fbErr;
      }

      if (insErr) throw insErr;

      notify.success("STU User created successfully");
      setIsFormOpen(false);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Request Status Toggle (Opens confirmation dialog)
  const handleRequestToggleActive = (userItem: ILoggedUser) => {
    setStatusPromptUser({
      user: userItem,
      nextActive: !userItem.active,
    });
  };

  // Confirm Status Toggle
  const handleConfirmStatusToggle = async () => {
    if (!statusPromptUser) return;
    const { user: targetUser, nextActive } = statusPromptUser;
    try {
      setIsUpdatingStatus(true);
      const { error } = await supabase
        .from("users")
        .update({ active: nextActive })
        .eq("id", targetUser.id);

      if (error) throw error;
      notify.success(
        `User "${targetUser.email}" ${nextActive ? "activated" : "suspended"}`
      );
      setStatusPromptUser(null);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Prompt Delete
  const handlePromptDelete = async (userItem: ILoggedUser) => {
    setDeletingUser(userItem);
    try {
      setIsLoadingImpact(true);
      const msg = await getUserDeleteImpactMessage(userItem.user_id || userItem.id);
      setDeleteImpactMsg(msg);
    } finally {
      setIsLoadingImpact(false);
    }
  };

  // Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", deletingUser.id);

      if (error) throw error;
      notify.success(`User "${deletingUser.email}" deleted successfully`);
      setDeletingUser(null);
      refetch();
    } catch (err: any) {
      notify.error(err.message || "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };



  // Avatar Background Color Helper
  const getRoleBadgeStyle = (roleName?: string | null) => {
    const lower = (roleName || "").toLowerCase();
    switch (lower) {
      case "organization_admin":
        return "bg-blue-600/10 text-blue-700 dark:text-blue-400 border border-blue-600/20";
      case "region_admin":
        return "bg-purple-600/10 text-purple-700 dark:text-purple-400 border border-purple-600/20";
      case "depot_admin":
        return "bg-amber-600/10 text-amber-700 dark:text-amber-400 border border-amber-600/20";
      case "master":
      case "super_admin":
        return "bg-rose-600/10 text-rose-700 dark:text-rose-400 border border-rose-600/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getAvatarBg = (roleName?: string | null) => {
    const lower = (roleName || "").toLowerCase();
    switch (lower) {
      case "organization_admin":
        return "bg-blue-600";
      case "region_admin":
        return "bg-purple-600";
      case "depot_admin":
        return "bg-amber-600";
      case "master":
      case "super_admin":
        return "bg-rose-600";
      default:
        return "bg-indigo-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            STU Users
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Manage staff accounts, administrative roles, and depot permissions for{" "}
          <strong className="text-foreground">{activeOrgName}</strong>.
        </p>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search & Role Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by email, role, region, depot..."
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

          {/* Role Filter */}
          <div className="w-full sm:w-[170px] shrink-0">
            <Select
              value={roleFilter}
              onValueChange={(val) => val && setRoleFilter(val)}
              items={[
                { label: "All Roles", value: "all" },
                { label: "Org Admin", value: "organization_admin" },
                { label: "Region Admin", value: "region_admin" },
                { label: "Depot Admin", value: "depot_admin" },
              ]}
            >
              <SelectTrigger className="h-9 text-xs w-full">
                <div className="flex items-center gap-1.5 truncate">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="All Roles" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="organization_admin">Org Admin</SelectItem>
                <SelectItem value="region_admin">Region Admin</SelectItem>
                <SelectItem value="depot_admin">Depot Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add User</span>
            </Button>
          )}

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
      {!activeOrgId ? (
        /* No Organization Selected */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No Organization Selected
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Please choose an active organization from the top bar selector to manage its staff accounts.
          </p>
        </div>
      ) : isLoading ? (
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
      ) : filteredUsers.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No users found
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {searchTerm || roleFilter !== "all"
              ? `No users match your filters in ${activeOrgName}.`
              : `No staff user accounts have been added to ${activeOrgName} yet.`}
          </p>
          {searchTerm || roleFilter !== "all" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setRoleFilter("all");
              }}
              className="mt-4 text-xs"
            >
              Clear Filters
            </Button>
          ) : (
            canManage && (
              <Button
                size="sm"
                onClick={handleOpenCreate}
                className="mt-4 text-xs font-semibold gap-1.5 shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add User</span>
              </Button>
            )
          )}
        </div>
      ) : (
        /* Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {filteredUsers.map((userItem) => {
            const email = userItem.email || "Unknown";
            const initials = email.slice(0, 2).toUpperCase();
            const roleName = userItem.role?.name || "User";
            const roleLabel = getRoleLabel(roleName);
            const regionName = userItem.region?.name;
            const depotName = userItem.depot?.name;

            return (
              <Card
                key={userItem.id}
                className="relative flex flex-col justify-between transition-all duration-200 border-border/80 bg-card hover:border-foreground/20 hover:shadow-md"
              >
                <div>
                  {/* Card Header */}
                  <CardHeader className="pb-2.5 block w-full min-w-0">
                    <div className="flex items-start justify-between gap-2 w-full min-w-0">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <Avatar className="h-9 w-9 rounded-xl after:rounded-xl shrink-0 mt-0.5">
                          <AvatarFallback
                            className={`rounded-xl text-xs font-bold text-white shadow-xs ${getAvatarBg(
                              roleName
                            )}`}
                          >
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      {/* Active Status Switch */}
                      <div
                        className="flex items-center gap-1.5 shrink-0 mt-0.5"
                        title={`Click to ${userItem.active ? "suspend" : "activate"}`}
                      >
                        <span
                          onClick={() => handleRequestToggleActive(userItem)}
                          className={cn(
                            "text-[10px] font-semibold cursor-pointer select-none",
                            userItem.active
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {userItem.active ? "Active" : "Suspended"}
                        </span>
                        <Switch
                          size="sm"
                          checked={Boolean(userItem.active)}
                          onCheckedChange={() => handleRequestToggleActive(userItem)}
                          aria-label={`Toggle active for ${email}`}
                          className="cursor-pointer data-checked:bg-emerald-600"
                        />
                      </div>
                    </div>
                  </CardHeader>

                  {/* Card Content */}
                  <CardContent className="p-3.5 pt-0 space-y-2.5">
                    {/* User Email */}
                    <div className="min-w-0 flex-1">
                      <CardTitle
                        className="text-xs font-semibold leading-snug text-foreground truncate block"
                        title={email}
                      >
                        {email}
                      </CardTitle>
                    </div>

                    {/* Role Badge */}
                    <div className="pt-0.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-4.5 px-2 gap-1 font-semibold ${getRoleBadgeStyle(
                          roleName
                        )}`}
                      >
                        <ShieldCheck className="h-2.5 w-2.5" />
                        <span>{roleLabel}</span>
                      </Badge>
                    </div>

                    {/* Password Viewer */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        Password
                      </span>
                      <PasswordViewerCell password={userItem.password} />
                    </div>

                    {/* Hierarchy Scopes */}
                    {(regionName || depotName) && (
                      <div className="space-y-1.5 pt-1 border-t border-border/60 text-xs text-muted-foreground">
                        {regionName && (
                          <div className="flex items-center gap-1.5">
                            <Compass className="h-3 w-3 text-primary shrink-0" />
                            <span
                              className="truncate font-medium text-foreground text-[11px]"
                              title={regionName}
                            >
                              {regionName}
                            </span>
                          </div>
                        )}

                        {depotName && (
                          <div className="flex items-center gap-1.5">
                            <Warehouse className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span
                              className="truncate text-[11px]"
                              title={depotName}
                            >
                              {depotName}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Route Capabilities Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {userItem.v1_routes && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-4.5 px-1.5 gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-semibold"
                        >
                          <Tag className="h-2.5 w-2.5" />
                          <span>V1 Engine</span>
                        </Badge>
                      )}
                      {userItem.v2_routes && (
                        <Badge
                          variant="default"
                          className="text-[10px] h-4.5 px-1.5 gap-1 font-semibold"
                        >
                          <Layers className="h-2.5 w-2.5" />
                          <span>V2 Engine</span>
                        </Badge>
                      )}
                      {(userItem as any).PIS && (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1 text-muted-foreground"
                        >
                          PIS
                        </Badge>
                      )}
                      {(userItem as any).PAS && (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1 text-muted-foreground"
                        >
                          PAS
                        </Badge>
                      )}
                      {(userItem as any).ITMS && (
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
                      <span>Registered {formatDate(userItem.created_at)}</span>
                    </div>
                  </CardContent>
                </div>

                {/* Card Footer */}
                {canManage && (
                  <CardFooter className="px-3.5 py-2.5 border-t border-border/80 flex items-center justify-end gap-1.5 bg-muted/20">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(userItem)}
                      className="h-7 text-xs px-2.5 gap-1 hover:bg-muted font-medium"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePromptDelete(userItem)}
                      className="h-7 text-xs px-2.5 gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive border-input"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </Button>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit User Dialog */}
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
        <DialogContent className="sm:max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                {editingUser ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  {editingUser ? "Edit STU User" : "Add STU User"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {editingUser
                    ? "Modify staff credentials, hierarchy terminal, and transit modules."
                    : `Provision a new staff account under ${activeOrgName}.`}
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
            {/* Step 1: Staff Account Details */}
            {currentStep === 1 && (
              <div className="space-y-4">
                {/* Email Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="user-email" className="text-xs font-semibold">
                    Staff Email *
                  </Label>
                  <Input
                    id="user-email"
                    type="email"
                    value={formEmail}
                    onChange={(e) => {
                      setFormEmail(e.target.value);
                      if (formEmailError) setFormEmailError("");
                    }}
                    disabled={Boolean(editingUser)}
                    placeholder="staff@transport.org"
                    className={cn(
                      "h-9 text-xs",
                      formEmailError &&
                        "border-destructive focus-visible:ring-destructive/20"
                    )}
                    autoFocus={!editingUser}
                  />
                  <FieldErrorText message={formEmailError} />
                </div>

                {/* Password Input (Editable in both Create & Edit) */}
                <div className="space-y-1.5">
                  <Label htmlFor="user-password" className="text-xs font-semibold">
                    {editingUser ? "Password (Editable)" : "Account Password *"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="user-password"
                      type={showPassword ? "text" : "password"}
                      value={formPassword}
                      onChange={(e) => {
                        setFormPassword(e.target.value);
                        if (formPasswordError) setFormPasswordError("");
                      }}
                      placeholder={
                        editingUser
                          ? "Enter new password or leave current"
                          : "Min 8 chars with uppercase, lowercase, number & special char"
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

                {/* Role Select */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Staff Role *</Label>
                  <Select
                    value={formRoleId}
                    onValueChange={(val) => {
                      setFormRoleId(val ?? "");
                      if (formRoleError) setFormRoleError("");
                      const selected = allRoles.find((r) => r.id === val)?.name?.toLowerCase();
                      if (
                        selected !== "region_admin" &&
                        selected !== "area_admin" &&
                        selected !== "depot_admin"
                      ) {
                        setFormRegionId("");
                        setFormDepotId("");
                      } else if (selected === "region_admin" || selected === "area_admin") {
                        setFormDepotId("");
                      }
                    }}
                    items={assignableRoles.map((r) => ({
                      label: getRoleLabel(r.name),
                      value: r.id,
                    }))}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-9 text-xs w-full",
                        formRoleError &&
                          "border-destructive focus-visible:ring-destructive/20"
                      )}
                    >
                      <SelectValue placeholder="Select staff role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {getRoleLabel(r.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldErrorText message={formRoleError} />
                </div>

                {/* Region Select (Visible when Region Admin or Depot Admin selected) */}
                {requiresRegion && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Assigned Region *</Label>
                    <Select
                      value={formRegionId}
                      onValueChange={(val) => {
                        setFormRegionId(val ?? "");
                        setFormDepotId("");
                        if (formRegionError) setFormRegionError("");
                      }}
                      items={regions.map((r) => ({
                        label: r.name,
                        value: r.id,
                      }))}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-9 text-xs w-full",
                          formRegionError &&
                            "border-destructive focus-visible:ring-destructive/20"
                        )}
                      >
                        <SelectValue placeholder="Select region...">
                          {(val: string | null) => {
                            if (!val) return null;
                            const match = regions.find((r) => r.id === val);
                            return match ? match.name : val;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {regions.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldErrorText message={formRegionError} />
                  </div>
                )}

                {/* Depot Select (Visible when Depot Admin selected) */}
                {requiresDepot && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Assigned Depot *</Label>
                    <Select
                      value={formDepotId}
                      onValueChange={(val) => {
                        setFormDepotId(val ?? "");
                        if (formDepotError) setFormDepotError("");
                      }}
                      items={depots.map((d) => ({
                        label: d.name,
                        value: d.id,
                      }))}
                      disabled={!formRegionId || depots.length === 0}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-9 text-xs w-full",
                          formDepotError &&
                            "border-destructive focus-visible:ring-destructive/20"
                        )}
                      >
                        <SelectValue placeholder="Select depot...">
                          {(val: string | null) => {
                            if (!val) return null;
                            const match = depots.find((d) => d.id === val);
                            return match ? match.name : val;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {depots.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldErrorText message={formDepotError} />
                    {formRegionId && depots.length === 0 && (
                      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2 mt-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>No depots found in this region</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Active Switch */}
                <div className="flex items-center justify-between rounded-lg border border-border/80 p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold">Account Status</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Allow this staff member to sign in to the platform.
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

            {/* Step 2: Transit Modules & Capabilities */}
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
                    <span>{editingUser ? "Save Changes" : "Create User"}</span>
                  )}
                </Button>
              </DialogFooter>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog
        open={Boolean(deletingUser)}
        onOpenChange={(open, details?: any) => {
          if (!open) {
            if (
              details?.reason === "outside-press" ||
              details?.reason === "outsidePress"
            ) {
              return;
            }
            setDeletingUser(null);
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
              Delete STU User
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground space-y-2 pt-1">
              {isLoadingImpact ? (
                <span className="flex items-center gap-1.5 text-muted-foreground italic">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Calculating deletion impact...
                </span>
              ) : (
                <span className="block text-destructive/90 font-medium">
                  {deleteImpactMsg}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-4 border-t border-border">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={isDeleting || isLoadingImpact}
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
                  Delete User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Suspension / Activation Confirmation Dialog */}
      <Dialog
        open={Boolean(statusPromptUser)}
        onOpenChange={(open, details?: any) => {
          if (!open) {
            if (
              details?.reason === "outside-press" ||
              details?.reason === "outsidePress"
            ) {
              return;
            }
            setStatusPromptUser(null);
          }
        }}
        disablePointerDismissal={true}
      >
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center mb-2",
                statusPromptUser?.nextActive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              )}
            >
              {statusPromptUser?.nextActive ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <DialogTitle className="text-base font-bold">
              {statusPromptUser?.nextActive
                ? "Activate User Account"
                : "Suspend User Account"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              {statusPromptUser?.nextActive ? (
                <span>
                  Are you sure you want to activate the account for{" "}
                  <strong className="text-foreground">
                    {statusPromptUser?.user.email}
                  </strong>
                  ? This staff member will immediately be allowed to sign in to
                  the platform.
                </span>
              ) : (
                <span>
                  Are you sure you want to suspend the account for{" "}
                  <strong className="text-foreground">
                    {statusPromptUser?.user.email}
                  </strong>
                  ? The user will immediately be blocked from logging into the
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
                statusPromptUser?.nextActive
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-amber-600 hover:bg-amber-700"
              )}
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>
                    {statusPromptUser?.nextActive
                      ? "Activating..."
                      : "Suspending..."}
                  </span>
                </>
              ) : (
                <span>
                  {statusPromptUser?.nextActive
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

export default UsersPage;
