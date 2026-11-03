import React, { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/core/notifications/notificationService";

interface PasswordViewerCellProps {
  password?: string | null;
  className?: string;
}

export function PasswordViewerCell({ password, className }: PasswordViewerCellProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!password) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(password);
    setCopied(true);
    notify.success("Password copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealed((prev) => !prev);
  };

  return (
    <div
      className={`flex items-center gap-1.5 select-none ${className || ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className="font-mono text-xs select-all text-foreground font-medium truncate max-w-[90px]"
        title={revealed ? password : "Click eye to reveal"}
      >
        {revealed ? password : "••••••••"}
      </span>
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          onClick={handleToggle}
          title={revealed ? "Hide password" : "Show password"}
        >
          {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
          title="Copy password"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-600" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}

export default PasswordViewerCell;

