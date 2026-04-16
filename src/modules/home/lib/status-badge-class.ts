import type { ConnectionState } from "@/lib/supabase/check-status"

export function statusBadgeClass(state: ConnectionState) {
  if (state === "connected") {
    return "border-primary/25 bg-primary/10 text-primary"
  }

  return "border-destructive/30 bg-destructive/10 text-destructive"
}
