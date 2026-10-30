import { useState, useMemo } from "react";
import { useOrganizations } from "@/features/organizations";
import { useAuthStore } from "@/core/auth/authStore";
import { isSuperAdmin } from "@/core/authorization/customerTier";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Search,
  Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { notify } from "@/core/notifications/notificationService";
import type { IOrganization } from "@/shared/types/organization";

export function GlobalOrgSelector() {
  const navigate = useNavigate();
  const { organizations, selectedOrganization, setSelectedOrganization, isLoading } =
    useOrganizations();
  const user = useAuthStore((state) => state.user);
  const superAdmin = isSuperAdmin(user);

  const [searchTerm, setSearchTerm] = useState("");

  const filteredOrgs = useMemo(() => {
    if (!searchTerm.trim()) return organizations;
    const term = searchTerm.toLowerCase();
    return organizations.filter(
      (o) =>
        o.name.toLowerCase().includes(term) ||
        (o.code && o.code.toLowerCase().includes(term))
    );
  }, [organizations, searchTerm]);

  const handleSelectOrg = (org: IOrganization | null) => {
    setSelectedOrganization(org);
    if (org) {
      notify.info(`Active tenant switched to "${org.name}"`);
    } else {
      notify.info("Organization filter cleared (All Organizations)");
    }
  };

  // If user is locked to an organization and not super-admin
  if (!superAdmin && user?.organization) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border bg-muted/40 text-xs">
        <Building2 className="h-3.5 w-3.5 text-primary" />
        <span className="font-semibold text-foreground max-w-[140px] truncate">
          {user.organization.name}
        </span>
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
          {user.customer_type === "regular" ? "Regular" : "STU"}
        </Badge>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 px-2.5 max-w-[170px] sm:max-w-[240px] justify-between border-input/80 bg-background/80 hover:bg-muted/60"
          />
        }
      >
        <div className="flex items-center gap-2 truncate">
          <div className="h-5 w-5 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Building2 className="h-3 w-3" />
          </div>
          <span className="truncate text-xs font-medium">
            {selectedOrganization ? selectedOrganization.name : "All Organizations"}
          </span>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[280px] p-1.5 space-y-1">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-semibold px-2 py-1 flex items-center justify-between text-muted-foreground">
            <span>Active Organization</span>
            {selectedOrganization && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {selectedOrganization.code || "Active"}
              </Badge>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        {/* Search within organizations */}
        <div className="px-1.5 pb-1">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter organizations..."
              className="h-7 pl-7 text-xs"
              autoFocus={false}
            />
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Option for 'All Organizations' */}
        <DropdownMenuItem
          onClick={() => handleSelectOrg(null)}
          className="flex items-center justify-between cursor-pointer text-xs py-1.5"
        >
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded border border-dashed flex items-center justify-center">
              <span className="text-[9px] font-bold">ALL</span>
            </div>
            <span className="font-medium">All Organizations</span>
          </div>
          {!selectedOrganization && <Check className="h-3.5 w-3.5 text-primary" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Organizations List */}
        <div className="max-h-[220px] overflow-y-auto space-y-0.5">
          {isLoading ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Loading organizations...
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              No matching organizations
            </div>
          ) : (
            filteredOrgs.map((org) => {
              const isSelected = selectedOrganization?.id === org.id;
              return (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleSelectOrg(org)}
                  className={`flex items-center justify-between cursor-pointer text-xs py-1.5 rounded-md ${
                    isSelected ? "bg-accent text-accent-foreground font-semibold" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <div
                      className={`h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        org.customer_type === "regular"
                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {org.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="truncate flex flex-col">
                      <span className="truncate">{org.name}</span>
                      {org.code && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {org.code}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">
                      {org.customer_type === "regular" ? "Reg" : "STU"}
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </div>

        {superAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate("/home/organizations")}
              className="flex items-center gap-2 cursor-pointer text-xs py-1.5 text-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Manage & Add Organizations</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default GlobalOrgSelector;
