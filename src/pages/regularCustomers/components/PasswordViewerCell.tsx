import React, { useState, useEffect } from "react";
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

  // Auto-hide password after 15 seconds for security (BUG-053)
  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => {
      setRevealed(false);
    }, 15000);
    return () => clearTimeout(timer);
  }, [revealed]);

  if (!password) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  // Robust copy with fallback for HTTP / non-secure contexts (BUG-051)
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(password);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = password;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopied(true);
      notify.success("Password copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy password:", err);
      notify.error("Failed to copy password to clipboard");
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealed((prev) => !prev);
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 select-none min-w-0 max-w-full ${className || ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className="font-mono text-xs select-all text-foreground font-medium truncate min-w-0 max-w-[130px] sm:max-w-[160px]"
        title={revealed ? password : "Click eye to reveal"}
      >
        {revealed ? password : "••••••••"}
      </span>
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
          onClick={handleToggle}
          title={revealed ? "Hide password" : "Show password (auto-hides after 15s)"}
        >
          {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
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

