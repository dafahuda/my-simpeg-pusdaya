import Link from "next/link"

import { Button } from "@/components/ui/button"
import { checkSupabaseStatus } from "@/lib/supabase/check-status"
import { cn } from "@/lib/utils"
import { valueCards } from "@/modules/home/config/value-cards"
import { statusBadgeClass } from "@/modules/home/lib/status-badge-class"

export default async function HomePage() {
  const supabaseStatus = await checkSupabaseStatus()

  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 md:px-10 md:py-14">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top,oklch(from_var(--primary)_l_c_h_/_0.14),transparent_65%)]" />

      <section className="rounded-3xl border border-border/70 bg-card/90 p-8 shadow-sm backdrop-blur md:p-10">
        <div className="space-y-6">
          <span className="inline-flex w-fit rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            SIMPEG PUSDAYA • Smart Homepage
          </span>

          <div className="space-y-3">
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-balance md:text-5xl">
              Platform kepegawaian profesional untuk keputusan lebih cepat.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              Beranda ini menjadi pusat orientasi operasional SDM: menampilkan
              nilai utama sistem, status koneksi Supabase, dan jalur tindakan yang
              jelas untuk tim admin maupun pimpinan.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="#supabase-status">Lihat Status Koneksi</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/api/supabase-status">Buka Endpoint API</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {valueCards.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {item.highlight}
            </p>
            <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {item.summary}
            </p>
          </article>
        ))}
      </section>

      <section
        id="supabase-status"
        className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-7"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Status Koneksi Supabase
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Status ini dicek langsung dari server menggunakan shared checker
              Supabase saat halaman dirender.
            </p>
          </div>

          <span
            className={cn(
              "inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold",
              statusBadgeClass(supabaseStatus.state),
            )}
          >
            {supabaseStatus.statusLabel}
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-border/80 bg-muted/30 p-4">
          <p className="text-sm leading-6 text-foreground">{supabaseStatus.detail}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Terakhir dicek: {supabaseStatus.checkedAt}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-gradient-to-r from-card via-muted/40 to-card p-6 shadow-sm md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Lanjutkan ke pengembangan modul operasional
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Fondasi homepage sudah siap untuk integrasi dashboard pegawai,
              approval workflow, dan analitik SDM tanpa menambah dependency baru.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="#supabase-status">Review Status Supabase</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
