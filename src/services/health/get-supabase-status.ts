import "server-only"

import {
  checkSupabaseStatus,
  type SupabaseStatusPayload,
} from "@/lib/supabase/check-status"

export async function getSupabaseStatus(): Promise<SupabaseStatusPayload> {
  return checkSupabaseStatus()
}
