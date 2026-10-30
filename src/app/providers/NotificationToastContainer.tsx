import { useState, useEffect } from "react";
import { notify, type NotificationPayload } from "@/core/notifications/notificationService";

interface ToastItem extends NotificationPayload {
  id: string;
}

export function NotificationToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
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

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const bgStyles: Record<string, string> = {
          success: "bg-emerald-600 text-white border-emerald-700",
          error: "bg-red-600 text-white border-red-700",
          warning: "bg-amber-500 text-white border-amber-600",
          info: "bg-blue-600 text-white border-blue-700",
        };
        const currentStyle = bgStyles[toast.type] || bgStyles.info;

        return (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex items-start justify-between rounded-lg border px-4 py-3 shadow-lg transition-all animate-in fade-in slide-in-from-bottom-2 ${currentStyle}`}
          >
            <div className="text-sm font-medium pr-2 break-words">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/80 hover:text-white text-xs font-bold px-1"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}

