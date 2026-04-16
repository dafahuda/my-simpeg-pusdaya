import "server-only"

export type SupabaseEnvResult =
  | {
      ok: true
      url: string
      anonKey: string
    }
  | {
      ok: false
      message: string
    }

export function getSupabaseServerEnv(): SupabaseEnvResult {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey) {
    return {
      ok: false,
      message:
        "Konfigurasi Supabase belum lengkap. Pastikan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY terisi.",
    }
  }

  return {
    ok: true,
    url,
    anonKey,
  }
}
