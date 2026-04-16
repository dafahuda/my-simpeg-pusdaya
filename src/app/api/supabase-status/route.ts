import { getSupabaseStatus } from "@/services/health/get-supabase-status"

export const dynamic = "force-dynamic"

export async function GET() {
  const status = await getSupabaseStatus()

  return Response.json(
    {
      ok: status.ok,
      message: status.message,
      state: status.state,
      statusLabel: status.statusLabel,
      detail: status.detail,
      checkedAt: status.checkedAt,
    },
    { status: status.statusCode },
  )
}
