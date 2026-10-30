import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/core/auth/useAuth";
import { useAuthStore } from "@/core/auth/authStore";
import { useTheme } from "@/components/theme-provider";
import { getRoleLabel } from "@/config/constants/roles";
import { PROTECTED_ROUTES_METADATA } from "@/navigation/metadata";
import { GlobalOrgSelector } from "./GlobalOrgSelector";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, LogOut, Shield } from "lucide-react";

export function AppHeader() {
  const location = useLocation();
  const { signOut } = useAuth();
  const user = useAuthStore((state) => state.user);
  const { theme, setTheme } = useTheme();

  // Find active route title
  const currentPathSegment = location.pathname.split("/").pop();
  const currentRouteMeta = PROTECTED_ROUTES_METADATA.find(
    (r) => r.path === currentPathSegment
  );
  const pageTitle = currentRouteMeta?.title || "Overview";

  const userInitials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "NV";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md transition-[width,height] ease-linear">
      {/* Left: Sidebar trigger + Breadcrumbs */}
      <div className="flex items-center gap-2.5 min-w-0">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />

        <Breadcrumb className="hidden sm:flex">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link to="/home" />}>Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold text-foreground truncate max-w-[200px]">
                {pageTitle}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Right: Global Org Selector, Theme Toggle, Logout Button, and User Menu */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <GlobalOrgSelector />

        <Separator orientation="vertical" className="h-4 mx-0.5 hidden sm:block" />

        {/* Theme Toggle Button */}
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
        </Button>

        {/* Logout Icon Button */}
       

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="relative h-7 gap-2 rounded-full px-1 hover:bg-muted/60"
              />
            }
          >
            <Avatar className="h-6 w-6 rounded-full">
              <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:inline-block text-xs font-medium text-foreground max-w-[120px] truncate">
              {user?.email}
            </span>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 p-1.5 space-y-1">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal px-2 py-1.5">
                <div className="flex flex-col space-y-1">
                  <p className="text-xs font-semibold leading-none text-foreground truncate">
                    {user?.email}
                  </p>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                      {getRoleLabel(user?.role?.name)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {user?.customer_type === "regular" ? "Regular" : "STU"}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {user?.organization && (
              <div className="px-2 py-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-primary shrink-0" />
                <span className="truncate">{user.organization.name}</span>
              </div>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => signOut()}
              className="cursor-pointer text-xs py-1.5 text-destructive focus:text-destructive flex items-center gap-2"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default AppHeader;
