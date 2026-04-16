import { beforeEach, describe, expect, it, vi } from "vitest"

const { createSupabaseServerClientMock } = vi.hoisted(() => {
  return {
    createSupabaseServerClientMock: vi.fn(),
  }
})

vi.mock("@/lib/supabase/server", () => {
  return {
    createSupabaseServerClient: createSupabaseServerClientMock,
  }
})

import { checkSupabaseStatus } from "@/lib/supabase/check-status"

describe("checkSupabaseStatus", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset()
  })

  it("returns disconnected payload when server client is unavailable", async () => {
    createSupabaseServerClientMock.mockReturnValue({
      ok: false,
      message: "SUPABASE_URL belum terpasang.",
    })

    const result = await checkSupabaseStatus()

    expect(createSupabaseServerClientMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      ok: false,
      message: "Layanan Supabase belum siap.",
      state: "disconnected",
      statusLabel: "Disconnected",
      detail: "Layanan Supabase belum siap.",
      statusCode: 500,
    })
    expect(typeof result.checkedAt).toBe("string")
  })
})
