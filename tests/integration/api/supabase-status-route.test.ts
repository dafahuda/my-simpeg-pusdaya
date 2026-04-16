import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SupabaseStatusPayload } from "@/lib/supabase/check-status"

const { getSupabaseStatusMock } = vi.hoisted(() => {
  return {
    getSupabaseStatusMock: vi.fn(),
  }
})

vi.mock("@/services/health/get-supabase-status", () => {
  return {
    getSupabaseStatus: getSupabaseStatusMock,
  }
})

import { GET } from "@/app/api/supabase-status/route"

describe("GET /api/supabase-status", () => {
  beforeEach(() => {
    getSupabaseStatusMock.mockReset()
  })

  it("maps service payload into API JSON response and HTTP status", async () => {
    const mockedPayload: SupabaseStatusPayload = {
      ok: false,
      message: "Koneksi Supabase gagal diverifikasi (503 Service Unavailable).",
      state: "disconnected",
      statusLabel: "Disconnected",
      detail: "Koneksi Supabase gagal diverifikasi (503 Service Unavailable).",
      checkedAt: "10.23.45",
      statusCode: 503,
    }

    getSupabaseStatusMock.mockResolvedValue(mockedPayload)

    const response = await GET()
    const body = await response.json()

    expect(getSupabaseStatusMock).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(503)
    expect(body).toEqual({
      ok: mockedPayload.ok,
      message: mockedPayload.message,
      state: mockedPayload.state,
      statusLabel: mockedPayload.statusLabel,
      detail: mockedPayload.detail,
      checkedAt: mockedPayload.checkedAt,
    })
  })
})
