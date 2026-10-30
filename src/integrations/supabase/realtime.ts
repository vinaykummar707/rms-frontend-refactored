import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./client";

export interface SubscriptionConfig {
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  schema?: string;
  table: string;
  filter?: string;
}

export function subscribeToTableChanges<T extends Record<string, unknown> = Record<string, unknown>>(
  config: SubscriptionConfig,
  callback: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE" | string;
    new: T;
    old: Partial<T>;
  }) => void
): () => void {
  const channelName = `realtime-${config.table}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  
  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on(
      "postgres_changes" as any,
      {
        event: config.event || "*",
        schema: config.schema || "public",
        table: config.table,
        filter: config.filter,
      },
      (payload: any) => {
        callback({
          eventType: payload.eventType,
          new: payload.new,
          old: payload.old,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

