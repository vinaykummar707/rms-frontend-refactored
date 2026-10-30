export type NotificationType = "success" | "error" | "warning" | "info";

export interface NotificationPayload {
  type: NotificationType;
  message: string;
  description?: string;
  duration?: number;
}

type NotificationListener = (notification: NotificationPayload) => void;

class NotificationService {
  private listeners: Set<NotificationListener> = new Set();

  public subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notify(payload: NotificationPayload): void {
    if (this.listeners.size === 0) {
      if (payload.type === "error") {
        console.error(`[Notification ${payload.type.toUpperCase()}]: ${payload.message}`, payload.description || "");
      } else if (payload.type === "warning") {
        console.warn(`[Notification ${payload.type.toUpperCase()}]: ${payload.message}`, payload.description || "");
      } else {
        console.log(`[Notification ${payload.type.toUpperCase()}]: ${payload.message}`, payload.description || "");
      }
    }
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error("Error in notification listener:", err);
      }
    });
  }

  public success(message: string, description?: string): void {
    this.notify({ type: "success", message, description });
  }

  public error(message: string, description?: string): void {
    this.notify({ type: "error", message, description });
  }

  public warning(message: string, description?: string): void {
    this.notify({ type: "warning", message, description });
  }

  public info(message: string, description?: string): void {
    this.notify({ type: "info", message, description });
  }
}

export const notify = new NotificationService();

