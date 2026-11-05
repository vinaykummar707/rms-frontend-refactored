import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { notify, type NotificationPayload } from "@/core/notifications/notificationService";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

interface ToastItem extends NotificationPayload {
  id: string;
}

export function NotificationToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsubscribe = notify.subscribe((payload: NotificationPayload) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const toastItem: ToastItem = { ...payload, id };

      setToasts((prev) => [...prev, toastItem]);

      const duration = payload.duration || 4000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    });

    return unsubscribe;
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (!mounted || typeof document === "undefined" || toasts.length === 0) {
    return null;
  }

  const content = (
    <div
      className="fixed bottom-4 right-4 z-[99999] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const bgStyles: Record<string, string> = {
          success: "bg-emerald-600 text-white border-emerald-700 shadow-emerald-950/20",
          error: "bg-red-600 text-white border-red-700 shadow-red-950/20",
          warning: "bg-amber-500 text-white border-amber-600 shadow-amber-950/20",
          info: "bg-blue-600 text-white border-blue-700 shadow-blue-950/20",
        };

        const Icon =
          toast.type === "success"
            ? CheckCircle2
            : toast.type === "error"
            ? AlertCircle
            : toast.type === "warning"
            ? AlertTriangle
            : Info;

        const currentStyle = bgStyles[toast.type] || bgStyles.info;

        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-3 shadow-xl transition-all animate-in fade-in slide-in-from-bottom-2 ${currentStyle}`}
          >
            <Icon className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1 pr-1">
              <div className="text-xs font-semibold break-words leading-snug">
                {toast.message}
              </div>
              {toast.description && (
                <div className="text-[11px] opacity-90 mt-0.5 break-words font-normal">
                  {toast.description}
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/80 hover:text-white rounded p-0.5 hover:bg-white/10 transition-colors shrink-0"
              aria-label="Close notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );

  return createPortal(content, document.body);
}

export default NotificationToastContainer;
