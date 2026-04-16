import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseServerEnv } from "@/lib/supabase/env"

export { getSupabaseServerEnv, type SupabaseEnvResult } from "@/lib/supabase/env"

type SupabaseClientResult =
  | {
      ok: true
      client: SupabaseClient
      url: string
      anonKey: string
    }
  | {
      ok: false
      message: string
    }

export function createSupabaseServerClient(): SupabaseClientResult {
  const envResult = getSupabaseServerEnv()

  if (!envResult.ok) {
    return envResult
  }

  const client = createClient(envResult.url, envResult.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return {
    ok: true,
    client,
    url: envResult.url,
    anonKey: envResult.anonKey,
  }
}
