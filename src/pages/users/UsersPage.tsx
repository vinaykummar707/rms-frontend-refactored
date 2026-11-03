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
import {
  checkHierarchyUniqueness,
  sendUserPasswordReset,
} from "@/features/users/services/userService";
import { getUserDeleteImpactMessage } from "@/shared/utils/deleteImpact";
import { canCreateUserOfRole } from "@/core/authorization/permissions";
import { isSuperAdmin } from "@/core/authorization/customerTier";
import { getRoleLabel } from "@/config/constants/roles";
import { formatDate, sortByLatestCreated } from "@/shared/utils/dateUtils";
import { notify } from "@/core/notifications/notificationService";
import type { ILoggedUser, IRole } from "@/shared/types/user";
import type { IRegion } from "@/shared/types/region";
import type { IDepot } from "@/shared/types/depot";
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
} from "lucide-react";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

const toNullableUuid = (val?: string | null): string | null => {
  if (!val) return null;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function UsersPage() {
  const loggedInUser = useAuthStore((state) => state.user);
  const { selectedOrganization } = useOrganizationStore();
  const selectedRegion = useRegionStore((state) => state.selectedRegion);

  const activeOrg =
    selectedOrganization || (loggedInUser?.organization as any) || null;
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
  const [editingUser, setEditingUser] = useState<ILoggedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<ILoggedUser | null>(null);
  const [deleteImpactMsg, setDeleteImpactMsg] = useState("");
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

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
  const [formV2, setFormV2] = useState(true);
  const [formPIS, setFormPIS] = useState(true);
  const [formPAS, setFormPAS] = useState(false);
  const [formITMS, setFormITMS] = useState(false);
  const [formRouteEngineError, setFormRouteEngineError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setFormV1(Boolean(activeOrg?.v1_routes ?? false));
    setFormV2(Boolean(activeOrg?.v2_routes ?? true));
    setFormPIS(Boolean(activeOrg?.PIS ?? true));
    setFormPAS(Boolean(activeOrg?.PAS ?? false));
    setFormITMS(Boolean(activeOrg?.ITMS ?? false));
    setFormRouteEngineError("");
    setIsFormOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (userItem: ILoggedUser) => {
    setEditingUser(userItem);
    setFormEmail(userItem.email || "");
    setFormEmailError("");
    setFormPassword("");
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
    setFormV2(userItem.v2_routes !== false);
    setFormPIS(Boolean((userItem as any).PIS ?? userItem.organization?.PIS ?? true));
    setFormPAS(Boolean((userItem as any).PAS ?? userItem.organization?.PAS ?? false));
    setFormITMS(Boolean((userItem as any).ITMS ?? userItem.organization?.ITMS ?? false));
    setFormRouteEngineError("");
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

  // Form Submit Handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let hasError = false;
    const trimmedEmail = formEmail.trim();

    if (!trimmedEmail) {
      setFormEmailError("User email is required.");
      hasError = true;
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      setFormEmailError("Enter a valid email address.");
      hasError = true;
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
      }
    } else {
      // Optional password reset by Super Admin in edit mode
      if (isSuper && formPassword && formPassword.trim().length > 0) {
        if (!PASSWORD_REGEX.test(formPassword)) {
          setFormPasswordError(
            "Password must be at least 8 characters and include uppercase, lowercase, number, and a special character."
          );
          hasError = true;
        }
      }
    }

    if (!formRoleId) {
      setFormRoleError("Please select a role.");
      hasError = true;
    }

    if (requiresRegion && !formRegionId) {
      setFormRegionError("Please select an assigned region.");
      hasError = true;
    }

    if (requiresDepot && !formDepotId) {
      setFormDepotError("Please select an assigned depot.");
      hasError = true;
    }

    if (!toNullableUuid(activeOrgId)) {
      notify.error("No active organization selected. Please select an organization.");
      hasError = true;
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

    // Check 1:1 hierarchy uniqueness check
    try {
      setIsSubmitting(true);
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

        notify.error(errorMsg);
        setIsSubmitting(false);
        return;
      }

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
        if (isSuper && formPassword && formPassword.trim().length > 0) {
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
                  <CardContent className="p-3.5 pt-0 space-y-2">
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
                    <div className="pt-1">
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

                    {/* Hierarchy Scopes */}
                    <div className="space-y-1.5 pt-2 border-t border-border/60 text-xs text-muted-foreground">
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

                      {/* Route Access Badges */}
                      <div className="flex items-center gap-1 pt-0.5">
                        {userItem.v1_routes && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] h-4 px-1 gap-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          >
                            <Tag className="h-2 w-2" />
                            <span>V1</span>
                          </Badge>
                        )}
                        {userItem.v2_routes && (
                          <Badge
                            variant="default"
                            className="text-[9px] h-4 px-1 gap-0.5"
                          >
                            <Layers className="h-2 w-2" />
                            <span>V2</span>
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Created Date */}
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                      <Calendar className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                      <span>Added {formatDate(userItem.created_at)}</span>
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
        <DialogContent className="sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
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
                    ? "Modify staff permissions, assigned terminal, and route access."
                    : `Provision a new staff account under ${activeOrgName}.`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
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
              {formEmailError && (
                <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{formEmailError}</span>
                </p>
              )}
            </div>

            {/* Password Input (Create Mode Only) */}
            {!editingUser ? (
              <div className="space-y-1.5">
                <Label htmlFor="user-password" className="text-xs font-semibold">
                  Temporary Password *
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
                    placeholder="Min 8 chars with uppercase, lowercase, number & special char"
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
                {formPasswordError && (
                  <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{formPasswordError}</span>
                  </p>
                )}
              </div>
            ) : (
              /* Password Reset Section in Edit Mode */
              <div className="space-y-3 rounded-lg bg-muted/40 p-3 border border-border">
                {isSuper && (
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-user-password" className="text-xs font-semibold">
                      Reset Password Directly (Optional)
                    </Label>
                    <div className="relative">
                      <Input
                        id="edit-user-password"
                        type={showPassword ? "text" : "password"}
                        value={formPassword}
                        onChange={(e) => {
                          setFormPassword(e.target.value);
                          if (formPasswordError) setFormPasswordError("");
                        }}
                        placeholder="Enter new password (optional)"
                        className={cn(
                          "h-9 text-xs pr-9 bg-background",
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
                    {formPasswordError && (
                      <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{formPasswordError}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Send Password Reset Link
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Sends instructions to {formEmail || "user"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleTriggerPasswordReset(formEmail)}
                    disabled={isResettingPassword}
                    className="h-7 text-xs gap-1 font-medium shrink-0"
                  >
                    <KeyRound className="h-3 w-3" />
                    <span>
                      {isResettingPassword ? "Sending..." : "Send Reset Link"}
                    </span>
                  </Button>
                </div>
              </div>
            )}

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
              {formRoleError && (
                <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{formRoleError}</span>
                </p>
              )}
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
                {formRegionError && (
                  <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{formRegionError}</span>
                  </p>
                )}
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
                {formDepotError && (
                  <p className="text-[11px] font-medium text-destructive mt-1 flex items-center gap-1 animate-in fade-in-50">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{formDepotError}</span>
                  </p>
                )}
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

            {/* Route Format Engine Switches */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-semibold block">
                Allowed Route Engines
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs font-medium">V1 Engine</span>
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
                    <span className="text-xs font-medium">V2 Engine</span>
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

            {/* Module Features (PIS, PAS, ITMS) */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold block">
                  Module Features
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  (Inherited from {editingUser?.organization?.name || activeOrg?.name || "Organization"})
                </span>
              </div>
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
                  <Switch size="sm" checked={formITMS} onCheckedChange={setFormITMS} />
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
                  <span>{editingUser ? "Save Changes" : "Create User"}</span>
                )}
              </Button>
            </DialogFooter>
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

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingUser(null)}
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

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusPromptUser(null)}
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
