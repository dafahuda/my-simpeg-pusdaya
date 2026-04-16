import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"

const SUPABASE_STATUS_TIMEOUT_MS = 4_000

export type ConnectionState = "connected" | "disconnected"

export type SupabaseStatusPayload = {
  ok: boolean
  message: string
  state: ConnectionState
  statusLabel: "Connected" | "Disconnected"
  detail: string
  checkedAt: string
  statusCode: number
}

function disconnectedPayload(
  message: string,
  checkedAt: string,
  statusCode: number,
): SupabaseStatusPayload {
  return {
    ok: false,
    message,
    state: "disconnected",
    statusLabel: "Disconnected",
    detail: message,
    checkedAt,
    statusCode,
  }
}

export async function checkSupabaseStatus(): Promise<SupabaseStatusPayload> {
  const checkedAt = new Date().toLocaleTimeString("id-ID")
  const clientResult = createSupabaseServerClient()

  if (!clientResult.ok) {
    return disconnectedPayload("Layanan Supabase belum siap.", checkedAt, 500)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, SUPABASE_STATUS_TIMEOUT_MS)

  try {
    const response = await fetch(`${clientResult.url}/auth/v1/settings`, {
      method: "GET",
      headers: {
        apikey: clientResult.anonKey,
        Authorization: `Bearer ${clientResult.anonKey}`,
      },
      cache: "no-store",
      signal: controller.signal,
    })

    if (!response.ok) {
      const reason = `${response.status} ${response.statusText}`.trim()
      return disconnectedPayload(
        `Koneksi Supabase gagal diverifikasi (${reason}).`,
        checkedAt,
        503,
      )
    }

    return {
      ok: true,
      message: "Koneksi Supabase tersedia.",
      state: "connected",
      statusLabel: "Connected",
      detail: "Koneksi Supabase tersedia.",
      checkedAt,
      statusCode: 200,
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return disconnectedPayload(
        "Verifikasi koneksi Supabase melewati batas waktu.",
        checkedAt,
        504,
      )
    }

    return disconnectedPayload("Gagal menghubungi Supabase saat ini.", checkedAt, 503)
  } finally {
    clearTimeout(timeoutId)
  }
}
