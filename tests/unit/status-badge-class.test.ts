import { describe, expect, it } from "vitest"

import { statusBadgeClass } from "@/modules/home/lib/status-badge-class"

describe("statusBadgeClass", () => {
  it("returns primary badge classes for connected state", () => {
    expect(statusBadgeClass("connected")).toBe(
      "border-primary/25 bg-primary/10 text-primary",
    )
  })

  it("returns destructive badge classes for disconnected state", () => {
    expect(statusBadgeClass("disconnected")).toBe(
      "border-destructive/30 bg-destructive/10 text-destructive",
    )
  })
})
