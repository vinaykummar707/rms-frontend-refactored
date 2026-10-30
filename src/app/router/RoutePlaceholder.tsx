import { useParams, useLocation } from "react-router-dom";
import { useAuthStore } from "@/core/auth/authStore";

interface RoutePlaceholderProps {
  title: string;
  path: string;
  description?: string;
  roles?: readonly string[];
}

export function RoutePlaceholder({
  title,
  path,
  description,
  roles = [],
}: RoutePlaceholderProps) {
  const params = useParams();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex h-full w-full min-h-[400px] flex-col items-center justify-center p-8 text-center">
      <div className="max-w-md w-full rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
          Phase 1 Architecture Boundary
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{path}</p>

        {description && (
          <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        )}

        <div className="mt-6 border-t border-border pt-4 text-left font-mono text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current User:</span>
            <span className="font-semibold">{user?.email || "Anonymous"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Active Role:</span>
            <span className="font-semibold">{user?.role?.name || "None"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Target UI Phase:</span>
            <span className="text-primary font-semibold">Phase 2: UI Migration</span>
          </div>

          {roles.length > 0 && (
            <div className="pt-2">
              <span className="text-muted-foreground block mb-1">Permitted Roles:</span>
              <div className="flex flex-wrap gap-1">
                {roles.map((r) => (
                  <span
                    key={r}
                    className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {Object.keys(params).length > 0 && (
            <div className="pt-2">
              <span className="text-muted-foreground block mb-1">Route Params:</span>
              <pre className="rounded bg-muted p-2 text-[11px] overflow-x-auto">
                {JSON.stringify(params, null, 2)}
              </pre>
            </div>
          )}

          {location.search && (
            <div className="pt-2">
              <span className="text-muted-foreground block mb-1">Query Params:</span>
              <span className="text-muted-foreground break-all">{location.search}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

