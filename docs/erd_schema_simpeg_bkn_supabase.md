# ERD Supabase Parity Rewrite

Dokumen ini adalah definisi final skema SIMPEG ASN untuk implementasi Supabase + Next.js. Cakupan dokumen meliputi chapter A sampai U dan berdiri sebagai referensi utama skema target produksi.

## Cakupan Domain

- Core data pegawai untuk kebutuhan identitas, relasi lintas modul, dan filter operasional.
- Biodata personal yang dipisahkan dari tabel induk agar desain tetap rapi dan aman.
- Batas akses data melalui RLS, service role, dan backend route handler.

## Daftar Chapter

- A–B: Data inti pegawai
- C–K: Riwayat dan administrasi pegawai
- L–Q: Workflow, akses, dan audit
- S–T: Master referensi dan workflow
- U: Dokumen pegawai

---

# A. Tabel `pegawai`

**Template Type: T10 (Core Employee Master for Supabase).**

## 1. Tujuan Parity Supabase

Tabel `pegawai` menjadi pusat identitas pegawai pada skema Supabase. Tabel ini dipakai sebagai root relasi untuk modul data pribadi, histori, workflow, akses, dan dokumen.

Target skema yang dipertahankan pada dokumen ini:

- `pegawai_id` tetap menjadi primary key stabil, bertipe `text`.
- `nip` tetap unique dan disimpan sebagai teks agar nol depan aman.
- kolom audit tersedia konsisten: `created_at`, `updated_at`, `created_by`, `updated_by`.
- `is_active` dipakai untuk soft deactivation tanpa menghapus histori.

## 2. Posisi Tabel dalam ERD

`pegawai` adalah parent table untuk beberapa domain utama.

```text
pegawai
  ├── 1 : 0..1 -> users
  ├── 1 : 1    -> pegawai_pribadi
  ├── 1 : N    -> riwayat_jabatan
  ├── 1 : N    -> riwayat_pangkat_golongan
  ├── 1 : N    -> riwayat_keluarga
  ├── 1 : N    -> riwayat_pendidikan
  ├── 1 : N    -> riwayat_diklat
  ├── 1 : N    -> riwayat_kgb
  ├── 1 : N    -> riwayat_skp
  ├── 1 : N    -> riwayat_pak
  ├── 1 : N    -> riwayat_disiplin
  ├── 1 : N    -> riwayat_usulan
  └── 1 : N    -> dokumen_pegawai
```

Catatan relasi:

- relasi ke `pegawai_pribadi` wajib 1:1 pada sisi data aktif;
- relasi ke tabel histori bersifat 1:N;
- relasi ke `users` tetap opsional untuk skenario pegawai yang belum memiliki akun login.

## 3. Struktur Kolom

Struktur parity minimum `pegawai` pada Supabase:

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `pegawai_id` | text | Ya | PK data pegawai. |
| `nip` | text | Ya | Unique, identitas resmi ASN/pegawai. |
| `nama_lengkap` | text | Ya | Nama inti tanpa format gelar otomatis. |
| `status_pegawai_id` | text | Ya | FK ke `master_status_pegawai`. |
| `kedudukan_hukum_id` | text | Tidak | FK ke `master_kedudukan_hukum`. |
| `status_kerja_id` | text | Tidak | FK ke `master_status_kerja`. |
| `unit_kerja_id` | text | Tidak | FK ke `master_unit_kerja`. |
| `opd_id` | text | Tidak | FK ke `master_opd`. |
| `tmt_cpns` | date | Tidak | Tanggal mulai CPNS. |
| `tmt_pns` | date | Tidak | Tanggal mulai PNS. |
| `tmt_pensiun` | date | Tidak | Tanggal pensiun. |
| `tmt_pensiun_source` | text | Tidak | Sumber nilai `tmt_pensiun`. |
| `no_karpeg` | text | Tidak | Nomor kartu pegawai. |
| `no_taspen` | text | Tidak | Nomor taspen. |
| `no_karis_karsu` | text | Tidak | Nomor KARIS/KARSU. |
| `is_active` | boolean | Ya | Default `true`. |
| `created_at` | timestamptz | Ya | Default `now()`. |
| `updated_at` | timestamptz | Ya | Default `now()`. |
| `created_by` | text | Tidak | Audit pembuat data. |
| `updated_by` | text | Tidak | Audit pengubah data terakhir. |

## 4. Aturan Integritas dan Relasi

Aturan integritas utama untuk `pegawai`:

1. `pegawai_id` primary key dan tidak boleh blank.
2. `nip` unique dan tidak boleh blank.
3. `nama_lengkap` tidak boleh blank.
4. FK wajib valid untuk setiap kolom referensi yang terisi.
5. `updated_at` dikelola trigger on update.

FK yang direkomendasikan:

- `status_pegawai_id -> master_status_pegawai.status_pegawai_id`
- `kedudukan_hukum_id -> master_kedudukan_hukum.kedudukan_hukum_id`
- `status_kerja_id -> master_status_kerja.status_kerja_id`
- `unit_kerja_id -> master_unit_kerja.unit_kerja_id`
- `opd_id -> master_opd.opd_id`

Check constraint yang direkomendasikan:

- `trim(pegawai_id) <> ''`
- `trim(nip) <> ''`
- `trim(nama_lengkap) <> ''`
- jika `tmt_cpns` dan `tmt_pns` terisi bersamaan, `tmt_pns >= tmt_cpns`

## 5. Aturan Bisnis Inti

Aturan bisnis inti yang dijaga pada layer database dan backend:

- satu `nip` hanya untuk satu pegawai aktif;
- penonaktifan pegawai memakai `is_active=false`, bukan delete fisik;
- atribut yang bersifat histori tidak disimpan sebagai snapshot permanen di tabel ini;
- perubahan data sensitif dicatat pada `audit_log` melalui jalur backend.

Batas data yang tidak menjadi sumber utama di tabel `pegawai`:

- jabatan aktif detail;
- pangkat dan golongan aktif detail;
- biodata personal sensitif seperti NIK, NPWP, dan kontak pribadi.

## 6. RLS dan Service Role Boundary

Boundary akses minimum:

1. `anon` deny penuh ke tabel `pegawai`.
2. `authenticated` hanya boleh baca record yang sesuai policy aplikasi.
3. mutasi `insert`, `update`, `delete` lewat backend route handler memakai service role.

Praktik keamanan yang disarankan:

- jangan expose service role key di client;
- gunakan RPC `security definer` atau API server untuk mutasi administratif;
- logging perubahan penting wajib ditulis ke `audit_log`.

## 7. Catatan Implementasi Next.js + Supabase

Pola implementasi aplikasi:

- query daftar pegawai dilakukan dari server component atau route handler;
- filter berbasis `opd_id`, `unit_kerja_id`, dan `status_pegawai_id` disiapkan di query layer;
- detail pegawai digabung dengan `pegawai_pribadi` hanya saat dibutuhkan;
- gunakan pagination untuk daftar besar agar beban query tetap stabil.

Catatan performa:

- index `nip` wajib unik;
- index komposit `opd_id, unit_kerja_id` membantu filter organisasi;
- index `is_active` berguna untuk daftar pegawai aktif.

## 8. Contoh Data

Contoh data sederhana untuk validasi kontrak kolom:

| pegawai_id | nip | nama_lengkap | status_pegawai_id | kedudukan_hukum_id | status_kerja_id | unit_kerja_id | opd_id | tmt_cpns | tmt_pns | tmt_pensiun | tmt_pensiun_source | no_karpeg | no_taspen | no_karis_karsu | is_active | created_at | updated_at | created_by | updated_by |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PGW-000001 | 198501012010011001 | Ahmad Fauzi | STS-001 | KDH-001 | SKR-001 | UK-001 | OPD-001 | 2010-01-01 | 2011-01-01 | 2045-01-01 | SYSTEM | KP-12345 | TS-12345 | KK-12345 | true | 2026-04-15 08:00:00+07 | 2026-04-15 08:00:00+07 | system_seed | system_seed |
| PGW-000002 | 197912312006041002 | Rina Kartika | STS-001 | KDH-001 | SKR-001 | UK-002 | OPD-001 | 2006-04-01 | 2007-04-01 | 2039-12-31 | MANUAL | KP-54321 | TS-54321 | KK-54321 | true | 2026-04-15 08:05:00+07 | 2026-04-15 08:05:00+07 | system_seed | system_seed |

## 9. Rekomendasi Migrasi dan Index

Checklist migrasi awal `pegawai`:

1. buat tabel dengan semua kolom parity;
2. pasang PK, unique, FK, dan check constraint;
3. pasang trigger `updated_at`;
4. seed data master sebelum seed data pegawai;
5. jalankan validasi data duplikat `nip` sebelum cutover.

Index yang direkomendasikan:

- `uq_pegawai_nip` unique (`nip`)
- `idx_pegawai_status_pegawai_id` (`status_pegawai_id`)
- `idx_pegawai_opd_unit` (`opd_id`, `unit_kerja_id`)
- `idx_pegawai_is_active` (`is_active`)

## 10. Kesimpulan

`pegawai` adalah sumber data inti yang menjaga identitas dan relasi seluruh domain SIMPEG pada Supabase. Dengan pemisahan data induk, histori, dan data pribadi, desain tetap mudah dirawat dan aman untuk dikembangkan di Next.js.

Konsistensi FK, RLS, serta jalur mutasi berbasis service role menjadi syarat penting agar data tetap valid saat sistem masuk fase produksi.

---

# B. Tabel `pegawai_pribadi`

**Template Type: T10 (Personal Biodata 1:1 Extension for Supabase).**

## 1. Tujuan Parity Supabase

Tabel `pegawai_pribadi` menampung biodata personal yang dipisah dari tabel induk `pegawai`. Pemisahan ini menjaga batas domain data inti kepegawaian dan data personal sensitif.

Target parity:

- relasi 1:1 dengan `pegawai` tetap dipertahankan melalui `pegawai_id` unique;
- data personal disimpan terstruktur agar mudah dikontrol aksesnya;
- kolom audit tetap tersedia untuk pelacakan perubahan.

## 2. Posisi Tabel dalam ERD

`pegawai_pribadi` adalah child table langsung dari `pegawai`.

```text
pegawai
  └── 1 : 1 -> pegawai_pribadi
```

Catatan relasi:

- setiap pegawai maksimal punya satu baris `pegawai_pribadi` aktif;
- data di tabel ini tidak boleh dibuat jika `pegawai_id` belum ada di tabel induk.

## 3. Struktur Kolom

Struktur parity minimum `pegawai_pribadi` pada Supabase:

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `pribadi_id` | text | Ya | PK data personal. |
| `pegawai_id` | text | Ya | FK ke `pegawai`, unique untuk relasi 1:1. |
| `foto_url` | text | Tidak | URL foto pegawai. |
| `tempat_lahir` | text | Tidak | Tempat lahir. |
| `tanggal_lahir` | date | Tidak | Tanggal lahir. |
| `jenis_kelamin` | text | Tidak | Kode jenis kelamin terstandar. |
| `agama_id` | text | Tidak | FK ke `master_agama`. |
| `status_perkawinan_id` | text | Tidak | FK ke `master_status_perkawinan`. |
| `alamat_domisili` | text | Tidak | Alamat domisili saat ini. |
| `alamat_ktp` | text | Tidak | Alamat sesuai identitas resmi. |
| `no_hp` | text | Tidak | Nomor HP aktif. |
| `email_pribadi` | text | Tidak | Email pribadi pegawai. |
| `nik` | text | Tidak | Nomor induk kependudukan, data sensitif. |
| `npwp` | text | Tidak | Nomor NPWP, data sensitif. |
| `no_bpjs` | text | Tidak | Nomor BPJS bila tersedia. |
| `created_at` | timestamptz | Ya | Default `now()`. |
| `updated_at` | timestamptz | Ya | Default `now()`. |
| `created_by` | text | Tidak | Audit pembuat data. |
| `updated_by` | text | Tidak | Audit pengubah data terakhir. |

## 4. Aturan Integritas dan Relasi

Aturan integritas untuk `pegawai_pribadi`:

1. `pribadi_id` primary key dan tidak boleh blank.
2. `pegawai_id` wajib unique agar relasi 1:1 terjaga.
3. `pegawai_id` harus valid di tabel `pegawai`.
4. FK master personal wajib valid saat terisi (`agama_id`, `status_perkawinan_id`).
5. `updated_at` dikelola trigger on update.

FK yang direkomendasikan:

- `pegawai_id -> pegawai.pegawai_id` (`on delete restrict`)
- `agama_id -> master_agama.agama_id`
- `status_perkawinan_id -> master_status_perkawinan.status_perkawinan_id`

Check constraint yang direkomendasikan:

- `trim(pribadi_id) <> ''`
- `trim(pegawai_id) <> ''`
- `jenis_kelamin in ('L', 'P')` jika kolom diisi

## 5. Aturan Bisnis Inti

Aturan bisnis utama:

- data personal tidak dipakai sebagai sumber keputusan workflow kepegawaian;
- perubahan data sensitif harus melalui jalur backend terproteksi;
- nomor identitas (`nik`, `npwp`, `no_bpjs`) disimpan sebagai teks;
- satu pegawai tidak boleh memiliki lebih dari satu profil personal aktif.

Data yang tidak masuk tabel ini:

- status kepegawaian dan status kerja;
- data jabatan, pangkat, dan riwayat;
- data akses akun aplikasi.

## 6. RLS dan Service Role Boundary

Boundary akses minimum:

1. `anon` deny penuh.
2. `authenticated` hanya bisa baca data personal yang berada dalam scope akses valid.
3. tulis data personal sensitif hanya lewat backend dengan service role.

Pengamanan tambahan yang disarankan:

- masking parsial untuk NIK atau NPWP saat ditampilkan di UI;
- endpoint update data pribadi wajib mencatat alasan perubahan;
- batasi kolom yang bisa diedit sendiri oleh user.

## 7. Catatan Implementasi Next.js + Supabase

Pola implementasi:

- detail profil pegawai diambil server side agar policy RLS tetap terjaga;
- form edit data personal dipisah dari form data induk `pegawai`;
- validasi format email dan nomor kontak dilakukan di backend sebelum write;
- gunakan selective column query untuk menghindari payload data sensitif berlebihan.

Pola caching yang aman:

- cache data profil dengan TTL pendek;
- invalidate cache setelah update profil sukses;
- jangan cache kolom sensitif di client storage jangka panjang.

## 8. Contoh Data

Contoh data sederhana `pegawai_pribadi`:

| pribadi_id | pegawai_id | foto_url | tempat_lahir | tanggal_lahir | jenis_kelamin | agama_id | status_perkawinan_id | alamat_domisili | alamat_ktp | no_hp | email_pribadi | nik | npwp | no_bpjs | created_at | updated_at | created_by | updated_by |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PRB-000001 | PGW-000001 | https://storage.example/pegawai/PGW-000001/profile.jpg | Bandung | 1985-01-01 | L | AGM-001 | SPW-002 | Jl. Melati No. 10, Bandung | Jl. Melati No. 10, Bandung | 081234567890 | ahmad.fauzi@example.id | 3273010101850001 | 12.345.678.9-012.000 | 0001234567890 | 2026-04-15 08:10:00+07 | 2026-04-15 08:10:00+07 | system_seed | system_seed |
| PRB-000002 | PGW-000002 | https://storage.example/pegawai/PGW-000002/profile.jpg | Garut | 1979-12-31 | P | AGM-001 | SPW-002 | Jl. Anggrek No. 2, Garut | Jl. Anggrek No. 2, Garut | 081298765432 | rina.kartika@example.id | 3205013112790002 | 98.765.432.1-098.000 | 0009876543210 | 2026-04-15 08:12:00+07 | 2026-04-15 08:12:00+07 | system_seed | system_seed |

## 9. Rekomendasi Migrasi dan Index

Checklist migrasi awal `pegawai_pribadi`:

1. buat tabel dan kolom parity lengkap;
2. pasang PK `pribadi_id` dan unique `pegawai_id`;
3. pasang FK ke `pegawai`, `master_agama`, dan `master_status_perkawinan`;
4. pasang trigger `updated_at`;
5. validasi data ganda pada `pegawai_id` sebelum impor final.

Index yang direkomendasikan:

- `uq_pegawai_pribadi_pegawai_id` unique (`pegawai_id`)
- `idx_pegawai_pribadi_agama_id` (`agama_id`)
- `idx_pegawai_pribadi_status_perkawinan_id` (`status_perkawinan_id`)

## 10. Kesimpulan

`pegawai_pribadi` menjaga pemisahan data personal dari data induk kepegawaian. Model ini membuat desain Supabase lebih aman, lebih jelas batas domainnya, dan lebih mudah diterapkan pada arsitektur Next.js berbasis server side data access.

Dengan relasi 1:1 yang ketat, kontrol RLS, dan jalur mutasi terproteksi, data biodata personal tetap konsisten serta sesuai kebutuhan privasi data pegawai.

# C. Tabel `riwayat_jabatan`

**Template Type: T10 (History Table with Current-Flag Enforcement).**

## 1. Tujuan Parity Supabase

`riwayat_jabatan` menyimpan histori jabatan pegawai dan menjadi sumber penentuan jabatan aktif melalui `is_current`.

Relasi inti:

```text
pegawai
  └── 1 : N -> riwayat_jabatan

master_jenis_jabatan
  └── 1 : N -> riwayat_jabatan

master_jabatan
  └── 1 : N -> riwayat_jabatan

master_eselon
  └── 1 : N -> riwayat_jabatan

master_unit_kerja
  └── 1 : N -> riwayat_jabatan

master_opd
  └── 1 : N -> riwayat_jabatan
```

## 2. Struktur Kolom (Definisi Final Supabase)

Header kolom yang dipertahankan:

```text
riwayat_jabatan_id
pegawai_id
jenis_jabatan_id
jabatan_id
eselon_id
kelas_jabatan
unit_kerja_id
opd_id
tmt_jabatan
tmt_akhir_jabatan
no_sk
tanggal_sk
pejabat_penetap
is_plt
is_plh
is_definitif
is_current
keterangan
created_at
updated_at
created_by
updated_by
```

## 3. Mapping Tipe Data Supabase

| Kolom | Tipe Supabase (PostgreSQL) | Wajib | Catatan |
|---|---|---:|---|
| `riwayat_jabatan_id` | `text` | Ya | PK, ID histori jabatan. |
| `pegawai_id` | `text` | Ya | FK ke `pegawai.pegawai_id`. |
| `jenis_jabatan_id` | `text` | Tidak | FK ke `master_jenis_jabatan.jenis_jabatan_id`. |
| `jabatan_id` | `text` | Ya | FK ke `master_jabatan.jabatan_id`. |
| `eselon_id` | `text` | Tidak | FK ke `master_eselon.eselon_id`. |
| `kelas_jabatan` | `numeric` atau `text` | Tidak | Tipe diseragamkan untuk kompatibilitas data migrasi. |
| `unit_kerja_id` | `text` | Tidak | FK ke `master_unit_kerja.unit_kerja_id`. |
| `opd_id` | `text` | Tidak | FK ke `master_opd.opd_id`. |
| `tmt_jabatan` | `date` | Ya | TMT mulai jabatan. |
| `tmt_akhir_jabatan` | `date` | Tidak | Null jika masih aktif. |
| `no_sk` | `text` | Tidak | Nomor SK jabatan. |
| `tanggal_sk` | `date` | Tidak | Tanggal SK diterbitkan. |
| `pejabat_penetap` | `text` | Tidak | Pejabat penetap. |
| `is_plt` | `boolean` | Tidak | Status PLT. |
| `is_plh` | `boolean` | Tidak | Status PLH. |
| `is_definitif` | `boolean` | Tidak | Status definitif. |
| `is_current` | `boolean` | Ya | Penanda jabatan aktif. |
| `keterangan` | `text` | Tidak | Catatan tambahan. |
| `created_at` | `timestamptz` | Ya | Audit pembuatan. |
| `updated_at` | `timestamptz` | Ya | Audit perubahan terakhir. |
| `created_by` | `text` | Tidak | Pelaku insert. |
| `updated_by` | `text` | Tidak | Pelaku update terakhir. |

## 4. Aturan Integritas dan Relasi

- Primary key: `riwayat_jabatan_id`.
- Foreign key:
  - `pegawai_id -> pegawai.pegawai_id`
  - `jenis_jabatan_id -> master_jenis_jabatan.jenis_jabatan_id`
  - `jabatan_id -> master_jabatan.jabatan_id`
  - `eselon_id -> master_eselon.eselon_id`
  - `unit_kerja_id -> master_unit_kerja.unit_kerja_id`
  - `opd_id -> master_opd.opd_id`
- Rekomendasi check bisnis:
  - `tmt_akhir_jabatan` harus `>= tmt_jabatan` jika terisi.
  - Jika `is_current = true`, maka `tmt_akhir_jabatan` sebaiknya null.
- Trigger audit:
  - `updated_at` diperbarui otomatis via trigger `public.tg_set_updated_at()`.

## 5. Aturan Unique Partial Index Supabase

Untuk menjaga hanya satu jabatan aktif per pegawai:

```sql
create unique index if not exists uq_riwayat_jabatan_current_per_pegawai
  on public.riwayat_jabatan(pegawai_id)
  where is_current;
```

Makna aturan:

- satu `pegawai_id` hanya boleh punya satu baris dengan `is_current = true`;
- histori nonaktif (`is_current = false`) tetap bisa lebih dari satu baris;
- validasi ini ditegakkan di level database, bukan hanya di aplikasi.

## 6. Aturan Validasi Data Operasional

- `riwayat_jabatan_id`, `pegawai_id`, dan `jabatan_id` tidak boleh blank.
- Kolom ID opsional (`jenis_jabatan_id`, `eselon_id`, `unit_kerja_id`, `opd_id`) bila diisi tidak boleh blank string.
- Kolom boolean (`is_plt`, `is_plh`, `is_definitif`, `is_current`) wajib format boolean.
- Index bantu query disarankan (dan sudah disiapkan di migrasi hardening):
  - `idx_riwayat_jabatan_pegawai_id`
  - `idx_riwayat_jabatan_jenis_jabatan_id`
  - `idx_riwayat_jabatan_jabatan_id`
  - `idx_riwayat_jabatan_eselon_id`
  - `idx_riwayat_jabatan_unit_kerja_id`
  - `idx_riwayat_jabatan_opd_id`

## 7. Catatan Transactional Update (Wajib untuk `is_current`)

Saat mengaktifkan jabatan baru, update harus dilakukan dalam **satu transaksi atomik** agar tidak melanggar unique partial index.

Pola aman:

```sql
begin;

-- 1) nonaktifkan record current lama milik pegawai
update public.riwayat_jabatan
set
  is_current = false,
  tmt_akhir_jabatan = coalesce(tmt_akhir_jabatan, current_date),
  updated_by = :actor_user_id,
  updated_at = now()
where pegawai_id = :pegawai_id
  and is_current = true;

-- 2) insert record jabatan baru sebagai current
insert into public.riwayat_jabatan (
  riwayat_jabatan_id,
  pegawai_id,
  jenis_jabatan_id,
  jabatan_id,
  eselon_id,
  kelas_jabatan,
  unit_kerja_id,
  opd_id,
  tmt_jabatan,
  tmt_akhir_jabatan,
  no_sk,
  tanggal_sk,
  pejabat_penetap,
  is_plt,
  is_plh,
  is_definitif,
  is_current,
  keterangan,
  created_at,
  updated_at,
  created_by,
  updated_by
) values (
  :riwayat_jabatan_id,
  :pegawai_id,
  :jenis_jabatan_id,
  :jabatan_id,
  :eselon_id,
  :kelas_jabatan,
  :unit_kerja_id,
  :opd_id,
  :tmt_jabatan,
  null,
  :no_sk,
  :tanggal_sk,
  :pejabat_penetap,
  :is_plt,
  :is_plh,
  :is_definitif,
  true,
  :keterangan,
  now(),
  now(),
  :actor_user_id,
  :actor_user_id
);

commit;
```

Catatan implementasi:

- jangan memecah langkah nonaktifkan dan insert ke request terpisah;
- jalankan lewat RPC/backend service-role path agar konsisten;
- jika transaksi gagal, rollback penuh untuk menghindari state setengah jadi.

## 8. Contoh Data

| riwayat_jabatan_id | pegawai_id | jenis_jabatan_id | jabatan_id | eselon_id | kelas_jabatan | unit_kerja_id | opd_id | tmt_jabatan | tmt_akhir_jabatan | no_sk | tanggal_sk | pejabat_penetap | is_plt | is_plh | is_definitif | is_current | keterangan | created_at | updated_at | created_by | updated_by |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RJB-000001 | PGW-000001 | JNJ-001 | JBT-001 | ESL-003 | 9 | UK-001 | OPD-001 | 2020-01-01 |  | SK-821/001 | 2019-12-20 | Bupati | FALSE | FALSE | TRUE | TRUE | Jabatan aktif saat ini | 2026-03-26 08:00:00+07 | 2026-03-26 08:00:00+07 | superadmin | superadmin |
| RJB-000000 | PGW-000001 | JNJ-001 | JBT-099 | ESL-004 | 8 | UK-010 | OPD-001 | 2017-01-01 | 2019-12-31 | SK-821/777 | 2016-12-20 | Bupati | FALSE | FALSE | TRUE | FALSE | Riwayat jabatan sebelumnya | 2026-03-20 08:00:00+07 | 2026-03-26 08:00:00+07 | superadmin | superadmin |

## 9. Catatan Implementasi Next.js + Supabase

- Gunakan server-side mutation untuk proses promosi/mutasi jabatan, jangan direct write dari client.
- Selalu baca jabatan aktif dengan filter `pegawai_id = ? and is_current = true`.
- Untuk histori, urutkan minimal berdasarkan `tmt_jabatan desc`, lalu `created_at desc`.
- Jika diperlukan locking ketat pada beban tinggi, gunakan RPC SQL terenkapsulasi.

## 10. Kesimpulan

`riwayat_jabatan` tetap menjadi sumber kebenaran jabatan aktif dan histori jabatan pegawai di Supabase dengan konsistensi kolom sesuai definisi skema pada dokumen ini.

Kunci konsistensi implementasi:

- unique partial index `uq_riwayat_jabatan_current_per_pegawai`;
- update `is_current` wajib atomik dalam satu transaksi;
- validasi FK dan audit timestamp aktif di level database.

---

# D. Tabel `riwayat_pangkat_golongan`

**Template Type: T10 (History Table with Current-Flag Enforcement).**

## 1. Tujuan Parity Supabase

`riwayat_pangkat_golongan` menyimpan histori pangkat/golongan pegawai dan menjadi sumber penentuan pangkat aktif melalui `is_current`.

Relasi inti:

```text
pegawai
  └── 1 : N -> riwayat_pangkat_golongan

master_pangkat
  └── 1 : N -> riwayat_pangkat_golongan

master_golongan
  └── 1 : N -> riwayat_pangkat_golongan

master_jenis_kenaikan_pangkat
  └── 1 : N -> riwayat_pangkat_golongan
```

## 2. Struktur Kolom (Definisi Final Supabase)

Header kolom yang dipertahankan:

```text
riwayat_pangkat_id
pegawai_id
pangkat_id
golongan_id
tmt_pangkat
masa_kerja_tahun
masa_kerja_bulan
masa_kerja_source
no_sk
tanggal_sk
pejabat_penetap
jenis_kenaikan_id
gaji_pokok
is_current
keterangan
created_at
updated_at
created_by
updated_by
```

## 3. Mapping Tipe Data Supabase

| Kolom | Tipe Supabase (PostgreSQL) | Wajib | Catatan |
|---|---|---:|---|
| `riwayat_pangkat_id` | `text` | Ya | PK, ID histori pangkat/golongan. |
| `pegawai_id` | `text` | Ya | FK ke `pegawai.pegawai_id`. |
| `pangkat_id` | `text` | Ya | FK ke `master_pangkat.pangkat_id`. |
| `golongan_id` | `text` | Ya | FK ke `master_golongan.golongan_id`. |
| `tmt_pangkat` | `date` | Ya | TMT pangkat/golongan berlaku. |
| `masa_kerja_tahun` | `integer` | Tidak | Masa kerja tahun pada SK. |
| `masa_kerja_bulan` | `integer` | Tidak | Masa kerja bulan pada SK. |
| `masa_kerja_source` | `text` | Tidak | Contoh: `MANUAL`, `IMPORT`, `BKN`, `SK`. |
| `no_sk` | `text` | Tidak | Nomor SK pangkat. |
| `tanggal_sk` | `date` | Tidak | Tanggal SK diterbitkan. |
| `pejabat_penetap` | `text` | Tidak | Pejabat penetap. |
| `jenis_kenaikan_id` | `text` | Tidak | FK ke `master_jenis_kenaikan_pangkat.jenis_kenaikan_id`. |
| `gaji_pokok` | `numeric` | Tidak | Nilai gaji pokok pada record histori. |
| `is_current` | `boolean` | Ya | Penanda pangkat aktif. |
| `keterangan` | `text` | Tidak | Catatan tambahan. |
| `created_at` | `timestamptz` | Ya | Audit pembuatan. |
| `updated_at` | `timestamptz` | Ya | Audit perubahan terakhir. |
| `created_by` | `text` | Tidak | Pelaku insert. |
| `updated_by` | `text` | Tidak | Pelaku update terakhir. |

## 4. Aturan Integritas dan Relasi

- Primary key: `riwayat_pangkat_id`.
- Foreign key:
  - `pegawai_id -> pegawai.pegawai_id`
  - `pangkat_id -> master_pangkat.pangkat_id`
  - `golongan_id -> master_golongan.golongan_id`
  - `jenis_kenaikan_id -> master_jenis_kenaikan_pangkat.jenis_kenaikan_id`
- Rekomendasi check bisnis:
  - `masa_kerja_tahun >= 0` jika terisi.
  - `masa_kerja_bulan >= 0 and masa_kerja_bulan <= 11` jika terisi.
  - `tanggal_sk <= tmt_pangkat` boleh, tapi harus konsisten dengan dokumen instansi.
- Trigger audit:
  - `updated_at` diperbarui otomatis via trigger `public.tg_set_updated_at()`.

## 5. Aturan Unique Partial Index Supabase

Untuk menjaga hanya satu pangkat aktif per pegawai:

```sql
create unique index if not exists uq_riwayat_pangkat_golongan_current_per_pegawai
  on public.riwayat_pangkat_golongan(pegawai_id)
  where is_current;
```

Makna aturan:

- satu `pegawai_id` hanya boleh punya satu baris dengan `is_current = true`;
- histori nonaktif tetap dapat menyimpan banyak record;
- enforcement berada di DB sehingga race condition aplikasi lebih terkontrol.

## 6. Aturan Validasi Data Operasional

- `riwayat_pangkat_id`, `pegawai_id`, `pangkat_id`, `golongan_id`, `tmt_pangkat` tidak boleh blank.
- Kolom ID opsional (`jenis_kenaikan_id`) bila diisi tidak boleh blank string.
- `masa_kerja_tahun` dan `masa_kerja_bulan` wajib angka non-negatif bila diisi.
- Index bantu query disarankan (dan sudah disiapkan di migrasi hardening):
  - `idx_riwayat_pangkat_golongan_pegawai_id`
  - `idx_riwayat_pangkat_golongan_pangkat_id`
  - `idx_riwayat_pangkat_golongan_golongan_id`
  - `idx_riwayat_pangkat_golongan_jenis_kenaikan_id`

## 7. Catatan Transactional Update (Wajib untuk `is_current`)

Saat menambahkan pangkat aktif baru, lakukan transisi current record dalam transaksi atomik yang sama.

Pola aman:

```sql
begin;

-- 1) nonaktifkan current lama
update public.riwayat_pangkat_golongan
set
  is_current = false,
  updated_by = :actor_user_id,
  updated_at = now()
where pegawai_id = :pegawai_id
  and is_current = true;

-- 2) insert current baru
insert into public.riwayat_pangkat_golongan (
  riwayat_pangkat_id,
  pegawai_id,
  pangkat_id,
  golongan_id,
  tmt_pangkat,
  masa_kerja_tahun,
  masa_kerja_bulan,
  masa_kerja_source,
  no_sk,
  tanggal_sk,
  pejabat_penetap,
  jenis_kenaikan_id,
  gaji_pokok,
  is_current,
  keterangan,
  created_at,
  updated_at,
  created_by,
  updated_by
) values (
  :riwayat_pangkat_id,
  :pegawai_id,
  :pangkat_id,
  :golongan_id,
  :tmt_pangkat,
  :masa_kerja_tahun,
  :masa_kerja_bulan,
  :masa_kerja_source,
  :no_sk,
  :tanggal_sk,
  :pejabat_penetap,
  :jenis_kenaikan_id,
  :gaji_pokok,
  true,
  :keterangan,
  now(),
  now(),
  :actor_user_id,
  :actor_user_id
);

commit;
```

Catatan implementasi:

- jangan jalankan update dan insert di transaksi berbeda;
- idealnya dibungkus RPC atau backend service agar policy konsisten;
- tangani conflict retry bila ada dua proses mutasi bersamaan.

## 8. Contoh Data

| riwayat_pangkat_id | pegawai_id | pangkat_id | golongan_id | tmt_pangkat | masa_kerja_tahun | masa_kerja_bulan | masa_kerja_source | no_sk | tanggal_sk | pejabat_penetap | jenis_kenaikan_id | gaji_pokok | is_current | keterangan | created_at | updated_at | created_by | updated_by |
|---|---|---|---|---|---:|---:|---|---|---|---|---|---:|---|---|---|---|---|---|
| RPG-000001 | PGW-000001 | PKT-003 | GOL-003 | 2022-04-01 | 12 | 6 | SK | SK-823/021 | 2022-03-20 | Gubernur | JKP-001 | 4500000 | TRUE | Pangkat aktif saat ini | 2026-03-26 08:00:00+07 | 2026-03-26 08:00:00+07 | superadmin | superadmin |
| RPG-000000 | PGW-000001 | PKT-002 | GOL-002 | 2019-04-01 | 9 | 0 | SK | SK-823/010 | 2019-03-20 | Gubernur | JKP-001 | 3900000 | FALSE | Riwayat pangkat sebelumnya | 2026-03-20 08:00:00+07 | 2026-03-26 08:00:00+07 | superadmin | superadmin |

## 9. Catatan Implementasi Next.js + Supabase

- Mutasi kenaikan pangkat dijalankan via backend route handler atau RPC SQL, bukan direct table write dari browser.
- Query pangkat aktif selalu pakai `pegawai_id = ? and is_current = true`.
- Untuk histori dan laporan DUK, urutkan `tmt_pangkat desc`, lalu `created_at desc`.
- Pastikan validasi numerik masa kerja dijalankan sebelum write untuk menghindari data out-of-range.

## 10. Kesimpulan

`riwayat_pangkat_golongan` menjaga histori pangkat/golongan lengkap dengan konsistensi kolom sesuai definisi Supabase final, sekaligus menjaga satu record aktif per pegawai.

Kunci konsistensi implementasi:

- unique partial index `uq_riwayat_pangkat_golongan_current_per_pegawai`;
- perubahan `is_current` dilakukan secara transaksional;
- validasi FK, check numerik, dan audit timestamp ditegakkan di level database.

# E. Tabel `riwayat_keluarga`

**Template Type: T10 (History Table for Supabase).**

## 1) Tujuan Parity Supabase

`riwayat_keluarga` menyimpan data anggota keluarga pegawai sebagai histori administratif yang tetap terhubung ke tabel induk `pegawai`.

Relasi inti:

```text
pegawai
  └── 1 : N -> riwayat_keluarga

master_status_keluarga
  └── 1 : N -> riwayat_keluarga

master_agama
  └── 1 : N -> riwayat_keluarga

master_tingkat_pendidikan
  └── 1 : N -> riwayat_keluarga   (via pendidikan_id)
```

Tujuan skema untuk Supabase:

- mempertahankan struktur kolom family record dari schema utama;
- menjaga kompatibilitas field `pendidikan_id` terhadap master tingkat pendidikan;
- memastikan data tanggungan dan status hidup tetap bisa diaudit;
- memisahkan data keluarga dari tabel induk agar kontrol akses lebih ketat.

## 2) Struktur Kolom

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `keluarga_id` | text | Ya | PK record keluarga. |
| `pegawai_id` | text | Ya | FK ke `pegawai`. |
| `status_keluarga_id` | text | Ya | FK ke `master_status_keluarga`. |
| `nama_keluarga` | text | Ya | Nama anggota keluarga. |
| `gelar_depan` | text | Tidak | Gelar depan bila ada. |
| `gelar_belakang` | text | Tidak | Gelar belakang bila ada. |
| `jenis_kelamin` | text | Tidak | Nilai terstandar, contoh `L` atau `P`. |
| `tempat_lahir` | text | Tidak | Tempat lahir anggota keluarga. |
| `tanggal_lahir` | date | Tidak | Tanggal lahir anggota keluarga. |
| `agama_id` | text | Tidak | FK ke `master_agama`. |
| `pendidikan_id` | text | Tidak | FK ke `master_tingkat_pendidikan`. |
| `pekerjaan` | text | Tidak | Pekerjaan anggota keluarga. |
| `nik` | text | Tidak | Nomor identitas keluarga, sensitif. |
| `status_hidup` | text | Tidak | Contoh: `HIDUP`, `MENINGGAL`. |
| `status_tanggungan` | boolean | Tidak | Penanda tanggungan pegawai. |
| `no_akta` | text | Tidak | Nomor dokumen keluarga. |
| `tanggal_menikah` | date | Tidak | Tanggal menikah jika relevan. |
| `tanggal_cerai` | date | Tidak | Tanggal cerai jika relevan. |
| `tanggal_meninggal` | date | Tidak | Tanggal meninggal jika relevan. |
| `urutan_anak` | integer | Tidak | Urutan anak untuk status anak. |
| `is_current` | boolean | Tidak | Status record keluarga masih aktif administratif. |
| `keterangan` | text | Tidak | Catatan tambahan. |
| `created_at` | timestamptz | Ya | Default `now()`. |
| `updated_at` | timestamptz | Ya | Default `now()`, update via trigger. |
| `created_by` | text | Tidak | Audit pembuat data. |
| `updated_by` | text | Tidak | Audit pengubah data. |

## 3) Aturan Integritas dan Relasi

Aturan integritas utama:

- PK: `keluarga_id` unik dan tidak blank.
- FK:
  - `pegawai_id -> pegawai.pegawai_id` (`on delete restrict`)
  - `status_keluarga_id -> master_status_keluarga.status_keluarga_id` (`on delete restrict`)
  - `agama_id -> master_agama.agama_id` (`on delete restrict`)
  - `pendidikan_id -> master_tingkat_pendidikan.tingkat_pendidikan_id` (`on delete restrict`)
- Check penting:
  - `trim(keluarga_id) <> ''`, `trim(pegawai_id) <> ''`, `trim(status_keluarga_id) <> ''`, `trim(nama_keluarga) <> ''`;
  - `jenis_kelamin` bila terisi hanya nilai yang diizinkan instansi;
  - `urutan_anak >= 1` bila terisi;
  - `tanggal_cerai >= tanggal_menikah` bila keduanya terisi;
  - `tanggal_meninggal >= tanggal_lahir` bila keduanya terisi.
- Index minimum:
  - `pegawai_id`, `status_keluarga_id`, `agama_id`, `pendidikan_id`;
  - komposit (`pegawai_id`, `is_current`) untuk baca data keluarga aktif.

Catatan integrity tambahan:

- Batasi satu pasangan aktif per pegawai dengan partial unique index pada record status pasangan yang aktif (`is_current=true`).

Contoh implementasi:

```sql
create unique index if not exists uq_riwayat_keluarga_pasangan_aktif
  on riwayat_keluarga (pegawai_id)
  where is_current = true
    and status_keluarga_id in ('SUAMI', 'ISTRI');
```

## 4) RLS dan Service Role Boundary

Boundary akses minimum untuk data keluarga:

1. `anon` deny penuh untuk `riwayat_keluarga`.
2. `authenticated` hanya boleh `select` data sesuai scope pegawai yang sah.
3. Insert, update, delete hanya melalui backend route handler Next.js atau RPC terproteksi dengan service role.

Guard implementasi:

- jangan izinkan client browser menulis langsung ke tabel ini;
- gunakan helper SQL atau view terkontrol untuk pembacaan data keluarga pada halaman profil;
- log mutasi sensitif ke `audit_log` dengan actor dan timestamp.

## 5) Catatan Privasi dan Data Sensitif

`riwayat_keluarga` memuat data personal dan keluarga yang sensitif, jadi kontrol privasi harus eksplisit.

Data yang perlu perlakuan khusus:

- `nik`, `no_akta`, `tanggal_lahir`, `tanggal_meninggal`;
- kombinasi `nama_keluarga` + hubungan keluarga + tanggal peristiwa;
- catatan bebas pada `keterangan` yang bisa berisi data sensitif tambahan.

Prinsip privasi minimum:

1. tampilkan data minimum di UI, lakukan masking parsial untuk NIK dan nomor akta;
2. batasi kolom sensitif pada query list, tampilkan lengkap hanya di detail terotorisasi;
3. hindari menyimpan dokumen keluarga mentah di kolom teks tabel ini;
4. audit setiap akses administratif untuk perubahan status tanggungan;
5. terapkan retensi data sesuai kebijakan instansi dan regulasi perlindungan data.

## 6) Penyesuaian dari Struktur Lama

Penyesuaian struktur dari schema awal ke implementasi Supabase:

- hubungan keluarga berbasis teks bebas dipaku ke `status_keluarga_id` agar konsisten;
- `pendidikan_id` dipertahankan namanya untuk kompatibilitas, tetapi relasi diarahkan ke master tingkat pendidikan;
- status tanggungan dibuat eksplisit pada `status_tanggungan` untuk kebutuhan tunjangan;
- kolom audit (`created_at`, `updated_at`, `created_by`, `updated_by`) wajib konsisten antar tabel riwayat;
- `is_current` dipakai untuk memilah data yang masih berlaku secara administratif.

## 7) Aturan Validasi yang Disarankan

Validasi aplikasi dan database:

- wajib isi: `keluarga_id`, `pegawai_id`, `status_keluarga_id`, `nama_keluarga`;
- validasi format tanggal untuk seluruh kolom tanggal;
- validasi teks identitas (`nik`, `no_akta`) sebagai string, bukan numerik;
- validasi relasi FK sebelum insert atau update;
- validasi rules keluarga, contoh `urutan_anak` hanya terisi untuk status keluarga anak.

Validasi mutasi backend Next.js:

- route handler hanya menerima payload terfilter field whitelist;
- normalisasi string kosong menjadi `null` untuk kolom opsional;
- update `updated_at` otomatis, dan isi `updated_by` dari actor terautentikasi.

## 8) Contoh Query Operasional

Contoh baca data keluarga aktif per pegawai untuk server side Next.js:

```sql
select
  rk.keluarga_id,
  rk.status_keluarga_id,
  rk.nama_keluarga,
  rk.jenis_kelamin,
  rk.status_tanggungan,
  rk.is_current
from riwayat_keluarga rk
where rk.pegawai_id = $1
  and coalesce(rk.is_current, true) = true
order by rk.status_keluarga_id, rk.nama_keluarga;
```

Contoh index pendukung:

```sql
create index if not exists idx_riwayat_keluarga_pegawai_current
  on riwayat_keluarga (pegawai_id, is_current);
```

## 9) Catatan Implementasi Next.js + Supabase

- lakukan baca data keluarga di server component atau route handler, jangan dari client langsung;
- pakai Supabase SSR client untuk session `authenticated`, service role hanya di backend private path;
- buat DTO response terpisah antara mode list (tanpa kolom sensitif penuh) dan mode detail;
- catat perubahan data keluarga ke `audit_log` agar jejak perubahan relasi keluarga tetap jelas;
- siapkan test integration untuk RLS, pastikan user tidak bisa membaca keluarga pegawai di luar scope.

## 10) Kesimpulan

`riwayat_keluarga` adalah tabel histori keluarga yang wajib dijaga integritas relasinya dan privasi datanya. Di Supabase, tabel ini perlu kombinasi FK ketat, RLS berbasis scope, service boundary yang jelas, serta minimisasi paparan data personal agar aman dipakai oleh aplikasi Next.js.

---

# F. Tabel `riwayat_pendidikan`

**Template Type: T10 (History Table for Supabase).**

## 1) Tujuan Parity Supabase

`riwayat_pendidikan` menyimpan histori pendidikan formal pegawai, termasuk dokumen pendidikan dan status studi atau tugas belajar.

Relasi inti:

```text
pegawai
  └── 1 : N -> riwayat_pendidikan

master_tingkat_pendidikan
  └── 1 : N -> riwayat_pendidikan

master_status_studi
  └── 1 : N -> riwayat_pendidikan
```

Tujuan parity untuk Supabase:

- menjaga histori pendidikan tetap lengkap dan dapat diaudit;
- mempertahankan pola satu record `is_terakhir=true` per pegawai;
- menjaga konsistensi gelar dan dokumen pendidikan dengan data induk pegawai;
- mendukung alur baca aman dari Next.js tanpa membocorkan data sensitif.

## 2) Struktur Kolom

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `riwayat_pendidikan_id` | text | Ya | PK record pendidikan. |
| `pegawai_id` | text | Ya | FK ke `pegawai`. |
| `tingkat_pendidikan_id` | text | Ya | FK ke `master_tingkat_pendidikan`. |
| `jurusan_nama` | text | Tidak | Jurusan atau program studi. |
| `institusi_pendidikan` | text | Tidak | Nama institusi pendidikan. |
| `no_ijazah` | text | Tidak | Nomor ijazah, sensitif administratif. |
| `tanggal_ijazah` | date | Tidak | Tanggal terbit ijazah. |
| `gelar_depan` | text | Tidak | Gelar di depan nama. |
| `gelar_belakang` | text | Tidak | Gelar di belakang nama. |
| `no_sk_pencantuman_gelar` | text | Tidak | Nomor SK pencantuman gelar. |
| `status_studi_id` | text | Tidak | FK ke `master_status_studi`. |
| `no_sk_tubel` | text | Tidak | Nomor SK tugas belajar. |
| `tanggal_sk_tubel` | date | Tidak | Tanggal SK tugas belajar. |
| `tmt_tubel_awal` | date | Tidak | Tanggal awal tugas belajar. |
| `tmt_tubel_akhir` | date | Tidak | Tanggal akhir tugas belajar. |
| `no_sk_pemberhentian` | text | Tidak | SK pemberhentian tubel bila ada. |
| `keterangan_perjanjian` | text | Tidak | Catatan perjanjian studi. |
| `is_terakhir` | boolean | Ya | Penanda pendidikan terakhir atau tertinggi. |
| `keterangan` | text | Tidak | Catatan tambahan. |
| `created_at` | timestamptz | Ya | Default `now()`. |
| `updated_at` | timestamptz | Ya | Default `now()`, update via trigger. |
| `created_by` | text | Tidak | Audit pembuat data. |
| `updated_by` | text | Tidak | Audit pengubah data. |

## 3) Aturan Integritas dan Relasi

Aturan integritas utama:

- PK: `riwayat_pendidikan_id` unik dan tidak blank.
- FK:
  - `pegawai_id -> pegawai.pegawai_id` (`on delete restrict`)
  - `tingkat_pendidikan_id -> master_tingkat_pendidikan.tingkat_pendidikan_id` (`on delete restrict`)
  - `status_studi_id -> master_status_studi.status_studi_id` (`on delete restrict`)
- Check penting:
  - `trim(riwayat_pendidikan_id) <> ''`, `trim(pegawai_id) <> ''`, `trim(tingkat_pendidikan_id) <> ''`;
  - `tmt_tubel_akhir >= tmt_tubel_awal` bila keduanya terisi;
  - `tanggal_sk_tubel` sebaiknya tidak lebih awal dari `tmt_tubel_awal` bila kebijakan instansi mewajibkan;
  - kolom boolean `is_terakhir` wajib non-null.
- Unique bisnis:
  - partial unique index untuk satu pendidikan terakhir per pegawai (`pegawai_id`) saat `is_terakhir = true`.
- Index minimum:
  - `pegawai_id`, `tingkat_pendidikan_id`, `status_studi_id`;
  - komposit (`pegawai_id`, `is_terakhir`) untuk lookup cepat pendidikan terakhir.

Contoh partial unique index:

```sql
create unique index if not exists uq_riwayat_pendidikan_terakhir
  on riwayat_pendidikan (pegawai_id)
  where is_terakhir = true;
```

## 4) RLS dan Service Role Boundary

Boundary akses minimum untuk data pendidikan:

1. `anon` deny penuh.
2. `authenticated` hanya `select` record dalam scope pegawai yang valid.
3. Insert, update, delete lewat backend route handler Next.js atau RPC `security definer`.

Guard implementasi:

- pembaruan flag `is_terakhir` harus atomik agar tidak ada dua record aktif bersamaan;
- service role key disimpan di server env, tidak boleh masuk client bundle;
- mutasi record pendidikan menulis jejak ke `audit_log`.

## 5) Catatan Privasi dan Data Sensitif

`riwayat_pendidikan` memuat data personal dan administratif yang tetap perlu perlindungan.

Data yang perlu perlakuan khusus:

- `no_ijazah`, `no_sk_pencantuman_gelar`, `no_sk_tubel`, `no_sk_pemberhentian`;
- `keterangan_perjanjian` jika memuat klausul personal;
- kombinasi identitas pegawai dan riwayat studi lengkap.

Prinsip privasi minimum:

1. tampilkan nomor dokumen dalam bentuk masking pada halaman umum;
2. batasi akses detail dokumen hanya untuk peran yang punya kebutuhan administratif;
3. hindari menyimpan lampiran ijazah biner langsung di tabel, simpan metadata saja;
4. lakukan audit akses untuk endpoint detail pendidikan;
5. terapkan retensi dan klasifikasi data sesuai kebijakan instansi.

## 6) Penyesuaian dari Struktur Lama

Penyesuaian parity dari schema awal ke implementasi Supabase:

- status pendidikan terakhir dipaku di `is_terakhir` dengan jaminan partial unique index;
- referensi tingkat pendidikan dan status studi dipindah ke master untuk konsistensi;
- riwayat gelar tetap disimpan di tabel ini, bukan duplikasi permanen di tabel `pegawai`;
- data tugas belajar dipertahankan di tabel yang sama agar migrasi bertahap tetap kompatibel;
- struktur audit diseragamkan dengan tabel riwayat lain.

## 7) Aturan Validasi yang Disarankan

Validasi aplikasi dan database:

- wajib isi: `riwayat_pendidikan_id`, `pegawai_id`, `tingkat_pendidikan_id`, `is_terakhir`;
- validasi tanggal: `tanggal_ijazah`, `tanggal_sk_tubel`, `tmt_tubel_awal`, `tmt_tubel_akhir`;
- validasi relasi FK sebelum mutasi;
- saat set `is_terakhir=true`, backend harus menonaktifkan record terakhir lama dalam transaksi yang sama;
- batasi panjang teks pada kolom dokumen agar input tetap bersih.

Validasi mutasi backend Next.js:

- payload whitelist agar field tak dikenal tidak ikut tersimpan;
- gunakan schema validator server side sebelum query Supabase;
- isi `updated_by` dari actor aktif, bukan dari input klien.

## 8) Contoh Query Operasional

Contoh baca pendidikan terakhir per pegawai:

```sql
select
  rp.riwayat_pendidikan_id,
  rp.tingkat_pendidikan_id,
  rp.jurusan_nama,
  rp.institusi_pendidikan,
  rp.gelar_depan,
  rp.gelar_belakang,
  rp.tanggal_ijazah
from riwayat_pendidikan rp
where rp.pegawai_id = $1
  and rp.is_terakhir = true
limit 1;
```

Contoh update atomik saat mengganti pendidikan terakhir:

```sql
begin;

update riwayat_pendidikan
set is_terakhir = false,
    updated_at = now(),
    updated_by = $2
where pegawai_id = $1
  and is_terakhir = true;

update riwayat_pendidikan
set is_terakhir = true,
    updated_at = now(),
    updated_by = $2
where riwayat_pendidikan_id = $3
  and pegawai_id = $1;

commit;
```

## 9) Catatan Implementasi Next.js + Supabase

- gunakan server actions atau route handlers untuk mutasi pendidikan agar constraint bisnis tetap terjaga;
- satukan query detail pendidikan dan master label di backend untuk mengurangi paparan data mentah di client;
- pakai cache server side untuk daftar pendidikan, lalu invalidasi saat mutasi berhasil;
- buat integration test untuk skenario race condition update `is_terakhir`;
- tambah guard endpoint agar hanya role berizin yang bisa mengakses nomor dokumen penuh.

## 10) Kesimpulan

`riwayat_pendidikan` adalah sumber histori pendidikan pegawai yang kritikal untuk profil ASN dan administrasi gelar. Implementasi Supabase perlu menjaga integritas referensi, konsistensi satu pendidikan terakhir, serta privasi nomor dokumen pendidikan melalui RLS, service boundary backend, dan query minim data pada Next.js.

# G. Tabel `riwayat_kgb`

**Template Type: T10 (History Table for Supabase).**

## 1) Tujuan Parity Supabase

`riwayat_kgb` menyimpan histori Kenaikan Gaji Berkala (KGB) pegawai, termasuk jejak nilai gaji pokok dan masa kerja pada dokumen KGB.

Relasi inti:

```text
pegawai
  └── 1 : N -> riwayat_kgb
```

Tujuan parity untuk Supabase:

- mempertahankan naming kolom sumber seperti `no_sk_kgb`, `tmt_kgb`, `gaji_pokok_lama`, dan `gaji_pokok_baru`;
- menjaga pola satu record `is_terakhir=true` per pegawai untuk KGB aktif;
- menyiapkan query operasional yang aman untuk Next.js server layer;
- menjaga audit mutasi agar perubahan KGB bisa ditelusuri.

## 2) Struktur Kolom

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `riwayat_kgb_id` | text | Ya | PK record KGB. |
| `pegawai_id` | text | Ya | FK ke `pegawai`. |
| `no_sk_kgb` | text | Tidak | Nomor SK KGB. |
| `tmt_kgb` | date | Ya | Tanggal mulai berlaku KGB. |
| `gaji_pokok_lama` | numeric(14,2) | Tidak | Nilai gaji pokok sebelum KGB. |
| `gaji_pokok_baru` | numeric(14,2) | Ya | Nilai gaji pokok setelah KGB. |
| `masa_kerja_tahun` | integer | Tidak | Masa kerja tahun pada SK KGB. |
| `masa_kerja_bulan` | integer | Tidak | Masa kerja bulan pada SK KGB. |
| `is_terakhir` | boolean | Ya | Penanda record KGB terakhir per pegawai. |
| `keterangan` | text | Tidak | Catatan administratif tambahan. |
| `created_at` | timestamptz | Ya | Default `now()`. |
| `updated_at` | timestamptz | Ya | Default `now()`, update via trigger. |
| `created_by` | text | Tidak | Audit pembuat data. |
| `updated_by` | text | Tidak | Audit pengubah data. |

## 3) Aturan Integritas dan Relasi

Aturan integritas utama:

- PK: `riwayat_kgb_id` unik dan tidak blank.
- FK:
  - `pegawai_id -> pegawai.pegawai_id` (`on delete restrict`)
- Check penting:
  - `trim(riwayat_kgb_id) <> ''`, `trim(pegawai_id) <> ''`;
  - `gaji_pokok_baru >= 0`;
  - `gaji_pokok_lama >= 0` bila terisi;
  - `gaji_pokok_baru >= gaji_pokok_lama` bila keduanya terisi;
  - `masa_kerja_tahun >= 0` bila terisi;
  - `masa_kerja_bulan between 0 and 11` bila terisi;
  - `is_terakhir` wajib non-null.
- Unique bisnis `is_terakhir`:
  - wajib hanya satu baris `is_terakhir=true` per `pegawai_id`.
- Index minimum:
  - `pegawai_id`, `tmt_kgb`;
  - komposit (`pegawai_id`, `is_terakhir`) untuk lookup KGB terakhir.

Contoh partial unique index untuk rule `is_terakhir`:

```sql
create unique index if not exists uq_riwayat_kgb_terakhir_per_pegawai
  on riwayat_kgb (pegawai_id)
  where is_terakhir = true;
```

## 4) RLS dan Service Role Boundary

Boundary akses minimum untuk data KGB:

1. `anon` deny penuh.
2. `authenticated` hanya `select` record KGB dalam scope pegawai yang sah.
3. Insert, update, delete hanya lewat backend route handler Next.js atau RPC terproteksi dengan service role.

Guard implementasi:

- jangan izinkan client browser mengubah `is_terakhir` langsung;
- mutasi KGB wajib menulis jejak actor ke `updated_by` dan audit ke `audit_log`;
- service role key hanya boleh hidup di server env.

## 5) Catatan Privasi dan Data Sensitif

`riwayat_kgb` memuat data finansial dan dokumen administratif yang perlu perlindungan.

Data yang perlu perlakuan khusus:

- `gaji_pokok_lama`, `gaji_pokok_baru`;
- `no_sk_kgb`;
- kombinasi data KGB per periode yang bisa dipakai untuk profiling finansial.

Prinsip privasi minimum:

1. tampilkan nilai gaji hanya untuk peran yang berwenang;
2. batasi query list agar kolom finansial tidak selalu ikut terambil;
3. hindari expose detail SK KGB di endpoint publik;
4. audit setiap mutasi nilai gaji dan perubahan status `is_terakhir`.

## 6) Penyesuaian dari Struktur Lama

Penyesuaian parity dari schema sumber ke implementasi Supabase:

- penanda KGB terakhir dipaku ke `is_terakhir` dengan jaminan partial unique index;
- kolom masa kerja (`masa_kerja_tahun`, `masa_kerja_bulan`) tetap dipertahankan sesuai naming sumber;
- format nilai gaji dibuat numerik agar aman untuk agregasi dan validasi;
- struktur audit diseragamkan dengan tabel riwayat lain.

## 7) Aturan Validasi yang Disarankan

Validasi aplikasi dan database:

- wajib isi: `riwayat_kgb_id`, `pegawai_id`, `tmt_kgb`, `gaji_pokok_baru`, `is_terakhir`;
- validasi tanggal untuk `tmt_kgb`;
- validasi relasi FK sebelum mutasi;
- validasi numerik untuk nilai gaji dan masa kerja;
- saat set `is_terakhir=true`, backend harus menonaktifkan record terakhir lama pada transaksi yang sama.

Validasi mutasi backend Next.js:

- payload whitelist, field tak dikenal harus ditolak;
- normalisasi string kosong ke `null` untuk kolom opsional;
- isi `updated_by` dari actor terautentikasi, bukan dari payload klien.

## 8) Contoh Query Operasional

Contoh baca KGB terakhir per pegawai:

```sql
select
  rk.riwayat_kgb_id,
  rk.no_sk_kgb,
  rk.tmt_kgb,
  rk.gaji_pokok_baru,
  rk.masa_kerja_tahun,
  rk.masa_kerja_bulan
from riwayat_kgb rk
where rk.pegawai_id = $1
  and rk.is_terakhir = true
limit 1;
```

Contoh update atomik saat mengganti KGB terakhir:

```sql
begin;

update riwayat_kgb
set is_terakhir = false,
    updated_at = now(),
    updated_by = $2
where pegawai_id = $1
  and is_terakhir = true;

update riwayat_kgb
set is_terakhir = true,
    updated_at = now(),
    updated_by = $2
where riwayat_kgb_id = $3
  and pegawai_id = $1;

commit;
```

## 9) Catatan Implementasi Next.js + Supabase

- mutasi KGB dilakukan di route handler atau server action agar rule `is_terakhir` tetap konsisten;
- gunakan query server side untuk daftar KGB, lalu batasi kolom finansial sesuai role;
- tambahkan integration test untuk race condition update `is_terakhir`;
- pakai index `pegawai_id` dan index partial `is_terakhir=true` untuk menjaga performa lookup;
- catat event perubahan gaji ke `audit_log` untuk kebutuhan audit internal.

## 10) Kesimpulan

`riwayat_kgb` adalah sumber histori KGB yang perlu dijaga integritas dan kerahasiaan datanya. Pada Supabase, rule satu record `is_terakhir=true` per pegawai harus ditegakkan dengan partial unique index, mutasi atomik backend, dan audit yang konsisten agar data tetap valid saat dipakai aplikasi Next.js.

---

# H. Tabel `riwayat_skp`

**Template Type: T10 (History Table for Supabase).**

## 1) Tujuan Parity Supabase

`riwayat_skp` menyimpan histori penilaian kinerja pegawai per periode, termasuk nilai kinerja, predikat, dan angka kredit bila dibutuhkan oleh instansi.

Relasi inti:

```text
pegawai
  └── 1 : N -> riwayat_skp

master_jenjang_skp
  └── 1 : N -> riwayat_skp

master_predikat_skp
  └── 1 : N -> riwayat_skp
```

Tujuan parity untuk Supabase:

- mempertahankan naming kolom sumber seperti `periode_awal`, `periode_akhir`, `tahun`, `nilai_kinerja`, dan `is_terakhir`;
- menjaga pola satu record `is_terakhir=true` per pegawai untuk SKP terbaru;
- memastikan referensi `jenjang_id` dan `predikat_id` tetap konsisten ke master;
- menyiapkan query periodik yang aman untuk dashboard kinerja Next.js.

## 2) Struktur Kolom

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `riwayat_skp_id` | text | Ya | PK record SKP. |
| `pegawai_id` | text | Ya | FK ke `pegawai`. |
| `periode_awal` | date | Tidak | Awal periode penilaian. |
| `periode_akhir` | date | Tidak | Akhir periode penilaian. |
| `tahun` | integer | Ya | Tahun penilaian. |
| `jumlah_bulan_penilaian` | integer | Tidak | Durasi bulan penilaian. |
| `jenjang_id` | text | Tidak | FK ke `master_jenjang_skp`. |
| `predikat_id` | text | Tidak | FK ke `master_predikat_skp`. |
| `koefisien_dasar` | numeric(8,4) | Tidak | Koefisien dasar evaluasi. |
| `nilai_kinerja` | numeric(6,2) | Ya | Nilai utama hasil SKP. |
| `angka_kredit` | numeric(8,2) | Tidak | Nilai angka kredit bila relevan. |
| `is_terakhir` | boolean | Ya | Penanda record SKP terbaru per pegawai. |
| `keterangan` | text | Tidak | Catatan tambahan. |
| `created_at` | timestamptz | Ya | Default `now()`. |
| `updated_at` | timestamptz | Ya | Default `now()`, update via trigger. |
| `created_by` | text | Tidak | Audit pembuat data. |
| `updated_by` | text | Tidak | Audit pengubah data. |

## 3) Aturan Integritas dan Relasi

Aturan integritas utama:

- PK: `riwayat_skp_id` unik dan tidak blank.
- FK:
  - `pegawai_id -> pegawai.pegawai_id` (`on delete restrict`)
  - `jenjang_id -> master_jenjang_skp.jenjang_id` (`on delete restrict`)
  - `predikat_id -> master_predikat_skp.predikat_id` (`on delete restrict`)
- Check penting:
  - `trim(riwayat_skp_id) <> ''`, `trim(pegawai_id) <> ''`;
  - `tahun >= 1900`;
  - `jumlah_bulan_penilaian between 1 and 12` bila terisi;
  - `periode_akhir >= periode_awal` bila keduanya terisi;
  - `nilai_kinerja >= 0`;
  - `angka_kredit >= 0` bila terisi;
  - `is_terakhir` wajib non-null.
- Unique bisnis `is_terakhir`:
  - wajib hanya satu baris `is_terakhir=true` per `pegawai_id`.
- Index minimum:
  - `pegawai_id`, `tahun`, `predikat_id`, `jenjang_id`;
  - komposit (`pegawai_id`, `is_terakhir`) untuk lookup SKP terbaru.

Contoh partial unique index untuk rule `is_terakhir`:

```sql
create unique index if not exists uq_riwayat_skp_terakhir_per_pegawai
  on riwayat_skp (pegawai_id)
  where is_terakhir = true;
```

## 4) RLS dan Service Role Boundary

Boundary akses minimum untuk data SKP:

1. `anon` deny penuh.
2. `authenticated` hanya `select` record SKP dalam scope pegawai yang valid.
3. Insert, update, delete lewat backend route handler Next.js atau RPC `security definer`.

Guard implementasi:

- update `is_terakhir` harus atomik agar tidak ada dua SKP terbaru untuk pegawai yang sama;
- service role key hanya di server env;
- mutasi nilai kinerja dan predikat wajib dicatat ke audit trail.

## 5) Catatan Privasi dan Data Sensitif

`riwayat_skp` berisi data evaluasi kinerja pegawai yang perlu dibatasi aksesnya.

Data yang perlu perlakuan khusus:

- `nilai_kinerja`, `angka_kredit`, `koefisien_dasar`;
- catatan penilaian pada `keterangan`;
- kombinasi periode dan hasil evaluasi yang dapat dipakai untuk profiling performa.

Prinsip privasi minimum:

1. tampilkan detail nilai hanya pada role yang memang berwenang;
2. pisahkan endpoint list ringkas dan endpoint detail evaluasi;
3. minimalkan kolom sensitif di query dashboard umum;
4. audit akses administratif ke detail SKP.

## 6) Penyesuaian dari Struktur Lama

Penyesuaian parity dari schema sumber ke implementasi Supabase:

- status SKP terbaru dipaku ke `is_terakhir` dengan jaminan partial unique index;
- referensi hasil penilaian dipisah ke master (`jenjang_id`, `predikat_id`) agar konsisten;
- kolom periode tetap dipertahankan (`periode_awal`, `periode_akhir`, `tahun`, `jumlah_bulan_penilaian`) untuk kebutuhan historis;
- struktur audit diseragamkan dengan tabel riwayat lain.

## 7) Aturan Validasi yang Disarankan

Validasi aplikasi dan database:

- wajib isi: `riwayat_skp_id`, `pegawai_id`, `tahun`, `nilai_kinerja`, `is_terakhir`;
- validasi tanggal untuk `periode_awal` dan `periode_akhir`;
- validasi relasi FK sebelum mutasi;
- validasi rentang nilai kinerja sesuai kebijakan instansi;
- saat set `is_terakhir=true`, backend harus menonaktifkan record terbaru lama dalam transaksi yang sama.

Validasi mutasi backend Next.js:

- payload whitelist dan schema validator server side;
- normalisasi input kosong ke `null` untuk kolom opsional;
- isi `updated_by` berdasarkan actor aktif.

## 8) Contoh Query Operasional

Contoh baca SKP terbaru per pegawai:

```sql
select
  rs.riwayat_skp_id,
  rs.tahun,
  rs.nilai_kinerja,
  rs.angka_kredit,
  rs.predikat_id,
  rs.jenjang_id
from riwayat_skp rs
where rs.pegawai_id = $1
  and rs.is_terakhir = true
limit 1;
```

Contoh update atomik saat mengganti SKP terbaru:

```sql
begin;

update riwayat_skp
set is_terakhir = false,
    updated_at = now(),
    updated_by = $2
where pegawai_id = $1
  and is_terakhir = true;

update riwayat_skp
set is_terakhir = true,
    updated_at = now(),
    updated_by = $2
where riwayat_skp_id = $3
  and pegawai_id = $1;

commit;
```

## 9) Catatan Implementasi Next.js + Supabase

- baca data SKP dari server component atau route handler agar policy akses tetap terjaga;
- gunakan cache server side untuk daftar SKP dan invalidasi saat mutasi berhasil;
- tambahkan integration test untuk race condition update `is_terakhir`;
- untuk dashboard, join label master (`master_predikat_skp`, `master_jenjang_skp`) di backend;
- batasi endpoint detail SKP agar hanya role berizin yang bisa melihat nilai penuh.

## 10) Kesimpulan

`riwayat_skp` adalah sumber histori evaluasi kinerja pegawai yang wajib dijaga konsistensi dan kerahasiaan aksesnya. Pada Supabase, rule satu record `is_terakhir=true` per pegawai harus ditegakkan dengan partial unique index, transaksi atomik backend, dan boundary RLS yang jelas agar data siap dipakai aman di aplikasi Next.js.

# I. Tabel `riwayat_pak`

**Template Type: T10 (History Table for Supabase).**

## 1) Tujuan Parity Supabase

`riwayat_pak` menyimpan histori Penetapan Angka Kredit (PAK) pegawai, terutama untuk jabatan fungsional yang butuh pelacakan nilai kredit secara periodik dan terstruktur.

Relasi inti:

```text
pegawai
  └── 1 : N -> riwayat_pak

master_jenis_pak
  └── 1 : N -> riwayat_pak

master_pangkat
  └── 1 : N -> riwayat_pak   (via target_pangkat_id)

master_jenis_jabatan
  └── 1 : N -> riwayat_pak   (via target_jenjang_id)

master_status_dokumen
  └── 1 : N -> riwayat_pak   (via status_dokumen_id)
```

Tujuan parity untuk Supabase:

- mempertahankan struktur komponen angka kredit `lama`, `baru`, dan `total` sesuai sumber legacy;
- menjaga pola satu record `is_terakhir=true` per `pegawai_id` untuk record PAK aktif terbaru;
- menjaga keterlacakan target pangkat, target jenjang, dan selisih capaian;
- menjaga metadata dokumen PAK tetap siap diaudit oleh backend Next.js + Supabase.

## 2) Struktur Kolom

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `riwayat_pak_id` | text | Ya | PK record PAK. |
| `pegawai_id` | text | Ya | FK ke `pegawai`. |
| `periode_awal` | date | Tidak | Tanggal awal periode penilaian atau perhitungan PAK. |
| `periode_akhir` | date | Tidak | Tanggal akhir periode penilaian atau perhitungan PAK. |
| `jenis_pak_id` | text | Tidak | FK ke `master_jenis_pak`. |
| `ak_dasar_lama` | numeric | Tidak | Angka kredit dasar sebelum penetapan terbaru. |
| `ak_dasar_baru` | numeric | Tidak | Tambahan angka kredit dasar pada penetapan terbaru. |
| `ak_dasar_total` | numeric | Tidak | Total angka kredit dasar setelah penetapan. |
| `ak_jf_lama` | numeric | Tidak | Angka kredit jabatan fungsional sebelum penetapan terbaru. |
| `ak_jf_baru` | numeric | Tidak | Tambahan angka kredit jabatan fungsional pada penetapan terbaru. |
| `ak_jf_total` | numeric | Tidak | Total angka kredit jabatan fungsional setelah penetapan. |
| `ak_penyesuaian_lama` | numeric | Tidak | Angka kredit penyesuaian sebelum penetapan terbaru. |
| `ak_penyesuaian_baru` | numeric | Tidak | Tambahan angka kredit penyesuaian pada penetapan terbaru. |
| `ak_penyesuaian_total` | numeric | Tidak | Total angka kredit penyesuaian setelah penetapan. |
| `ak_konversi_lama` | numeric | Tidak | Angka kredit konversi sebelum penetapan terbaru. |
| `ak_konversi_baru` | numeric | Tidak | Tambahan angka kredit konversi pada penetapan terbaru. |
| `ak_konversi_total` | numeric | Tidak | Total angka kredit konversi setelah penetapan. |
| `ak_peningkatan_lama` | numeric | Tidak | Angka kredit peningkatan sebelum penetapan terbaru. |
| `ak_peningkatan_baru` | numeric | Tidak | Tambahan angka kredit peningkatan pada penetapan terbaru. |
| `ak_peningkatan_total` | numeric | Tidak | Total angka kredit peningkatan setelah penetapan. |
| `ak_kumulatif_total` | numeric | Ya | Total kumulatif akhir semua komponen angka kredit. |
| `target_pangkat_id` | text | Tidak | FK ke `master_pangkat`. |
| `target_jenjang_id` | text | Tidak | FK ke `master_jenis_jabatan.jenis_jabatan_id` (rename jangka lanjut direkomendasikan ke `target_jenis_jabatan_id`). |
| `selisih_pangkat` | numeric | Tidak | Selisih capaian terhadap target pangkat. |
| `selisih_jenjang` | numeric | Tidak | Selisih capaian terhadap target jenjang jabatan. |
| `no_sk_pak` | text | Tidak | Nomor SK Penetapan Angka Kredit. |
| `tanggal_sk_pak` | date | Tidak | Tanggal SK PAK diterbitkan. |
| `pejabat_penetap` | text | Tidak | Nama pejabat yang menetapkan PAK. |
| `status_dokumen_id` | text | Tidak | FK ke `master_status_dokumen`. |
| `keterangan` | text | Tidak | Catatan administratif tambahan. |
| `is_terakhir` | boolean | Ya | Penanda record PAK terakhir per pegawai. |
| `created_at` | timestamptz | Ya | Default `now()`. |
| `updated_at` | timestamptz | Ya | Default `now()`, update via trigger. |
| `created_by` | text | Tidak | Audit pembuat data. |
| `updated_by` | text | Tidak | Audit pengubah data. |

## 3) Aturan Integritas dan Relasi

Aturan integritas utama:

- PK: `riwayat_pak_id` unik dan tidak blank.
- FK:
  - `pegawai_id -> pegawai.pegawai_id` (`on delete restrict`)
  - `jenis_pak_id -> master_jenis_pak.jenis_pak_id` (`on delete restrict`)
  - `target_pangkat_id -> master_pangkat.pangkat_id` (`on delete restrict`)
  - `status_dokumen_id -> master_status_dokumen.status_dokumen_id` (`on delete restrict`)
  - `target_jenjang_id -> master_jenis_jabatan.jenis_jabatan_id` (`on delete restrict`)
- Check penting:
  - `trim(riwayat_pak_id) <> ''`, `trim(pegawai_id) <> ''`;
  - `ak_kumulatif_total >= 0`;
  - seluruh kolom `ak_*` dan `selisih_*` bila terisi wajib numerik;
  - `periode_akhir >= periode_awal` bila keduanya terisi;
  - `is_terakhir` wajib non-null.
- Unique bisnis:
  - partial unique index satu record `is_terakhir=true` per `pegawai_id`.
- Index minimum:
  - `pegawai_id`, `jenis_pak_id`, `target_pangkat_id`, `status_dokumen_id`;
  - komposit (`pegawai_id`, `is_terakhir`);
  - index periode (`periode_awal`, `periode_akhir`) untuk filter histori.

Contoh partial unique index:

```sql
create unique index if not exists uq_riwayat_pak_terakhir
  on riwayat_pak (pegawai_id)
  where is_terakhir = true;
```

## 4) RLS dan Service Role Boundary

Boundary akses minimum untuk `riwayat_pak`:

1. `anon` deny penuh.
2. `authenticated` hanya boleh `select` record PAK sesuai scope akses pegawai yang sah.
3. Insert, update, delete dilakukan melalui backend route handler Next.js atau RPC terproteksi dengan service role.

Guard implementasi:

- update `is_terakhir` harus atomik agar tidak ada dua record terakhir dalam pegawai yang sama;
- service role key hanya ada di server environment;
- mutasi yang mengubah target dan komponen AK wajib dicatat ke `audit_log`.

## 5) Catatan Privasi dan Data Administratif

`riwayat_pak` bukan tabel biodata personal, tetapi tetap memuat data administratif sensitif karier pegawai.

Data yang perlu perlakuan ketat:

- `no_sk_pak`, `tanggal_sk_pak`, `pejabat_penetap`;
- rincian komponen `ak_*` dan nilai `ak_kumulatif_total`;
- target serta selisih capaian (`target_pangkat_id`, `target_jenjang_id`, `selisih_*`).

Prinsip minimum:

1. tampilkan ringkasan nilai di halaman list, rincian komponen tampil di detail terotorisasi;
2. validasi perubahan angka kredit hanya dari role admin yang berwenang;
3. hindari menaruh dokumen scan PAK langsung di tabel ini, simpan metadata dan tautkan ke tabel dokumen;
4. audit setiap perubahan nilai AK untuk kebutuhan forensik dan pembuktian administratif.

## 6) Penyesuaian dari Struktur Lama

Penyesuaian parity dari schema awal ke implementasi Supabase:

- struktur komponen angka kredit `lama`, `baru`, `total` dipertahankan utuh;
- `is_terakhir` dipaku sebagai penanda formal record terbaru per pegawai;
- target administratif dipisah ke `target_pangkat_id` dan `target_jenjang_id` agar pelaporan lebih jelas;
- metadata dokumen (`no_sk_pak`, `tanggal_sk_pak`, `pejabat_penetap`, `status_dokumen_id`) tetap disimpan di tabel yang sama untuk kemudahan audit;
- target `target_jenjang_id` dipatok ke `master_jenis_jabatan` untuk menjaga integritas referensi jenjang jabatan.

## 7) Aturan Validasi yang Disarankan

Validasi aplikasi dan database:

- wajib isi: `riwayat_pak_id`, `pegawai_id`, `ak_kumulatif_total`, `is_terakhir`;
- validasi tanggal: `periode_awal`, `periode_akhir`, `tanggal_sk_pak`;
- validasi relasi FK sebelum mutasi;
- saat set `is_terakhir=true`, backend harus menonaktifkan record sebelumnya pada transaksi yang sama;
- validasi numerik untuk seluruh kolom `ak_*`, `selisih_pangkat`, `selisih_jenjang`.

Validasi mutasi backend Next.js:

- payload whitelist agar field liar tidak tersimpan;
- normalisasi string kosong menjadi `null` untuk kolom opsional;
- isi `updated_by` dari actor aktif, bukan dari payload klien;
- enforce FK `target_jenjang_id` ke `master_jenis_jabatan` pada migrasi integritas.

## 8) Contoh Query Operasional

Contoh baca record PAK terakhir per pegawai:

```sql
select
  rp.riwayat_pak_id,
  rp.periode_awal,
  rp.periode_akhir,
  rp.jenis_pak_id,
  rp.ak_kumulatif_total,
  rp.target_pangkat_id,
  rp.target_jenjang_id,
  rp.selisih_pangkat,
  rp.selisih_jenjang,
  rp.status_dokumen_id,
  rp.no_sk_pak,
  rp.tanggal_sk_pak
from riwayat_pak rp
where rp.pegawai_id = $1
  and rp.is_terakhir = true
limit 1;
```

Contoh update atomik saat mengganti record PAK terakhir:

```sql
begin;

update riwayat_pak
set is_terakhir = false,
    updated_at = now(),
    updated_by = $2
where pegawai_id = $1
  and is_terakhir = true;

update riwayat_pak
set is_terakhir = true,
    updated_at = now(),
    updated_by = $2
where riwayat_pak_id = $3
  and pegawai_id = $1;

commit;
```

## 9) Catatan Implementasi Next.js + Supabase

- mutasi PAK dilakukan lewat route handler server side, bukan langsung dari client;
- gunakan schema validator di backend untuk memastikan payload numerik dan tanggal valid;
- satukan query label referensi (`jenis_pak`, `pangkat`, `status_dokumen`) di backend agar UI tidak memproses FK mentah;
- buat integration test untuk race condition update `is_terakhir`;
- pastikan validasi FK `target_jenjang_id` aktif di level database dan tercakup integration test mutasi PAK.

## 10) Kesimpulan

`riwayat_pak` adalah sumber histori angka kredit pegawai yang kritikal untuk evaluasi jabatan fungsional. Implementasi Supabase harus menjaga konsistensi komponen nilai, jaminan satu record terbaru per pegawai, kontrol akses berbasis RLS, serta jejak audit mutasi yang rapi, termasuk integritas FK `target_jenjang_id` ke `master_jenis_jabatan`.

---

# J. Tabel `riwayat_disiplin`

**Template Type: T10 (History Table for Supabase).**

## 1) Tujuan Parity Supabase

`riwayat_disiplin` menyimpan histori proses pemeriksaan dan hukuman disiplin pegawai secara end to end, dari panggilan awal sampai status penyelesaian.

Relasi inti:

```text
pegawai
  └── 1 : N -> riwayat_disiplin

master_tingkat_hukuman
  └── 1 : N -> riwayat_disiplin

master_jenis_hukuman
  └── 1 : N -> riwayat_disiplin

master_status_proses_disiplin
  └── 1 : N -> riwayat_disiplin
```

Tujuan parity untuk Supabase:

- mempertahankan metadata dokumen pemeriksaan dan hukuman sesuai baseline schema;
- menjaga klasifikasi tingkat dan jenis hukuman berbasis master referensi;
- mempertahankan status proses dan masa berlaku hukuman agar monitoring disiplin akurat;
- memastikan data sensitif disiplin diproteksi lewat RLS dan boundary service role.

## 2) Struktur Kolom

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `riwayat_disiplin_id` | text | Ya | PK record disiplin. |
| `pegawai_id` | text | Ya | FK ke `pegawai`. |
| `tingkat_hukuman_id` | text | Tidak | FK ke `master_tingkat_hukuman`. |
| `jenis_hukuman_id` | text | Tidak | FK ke `master_jenis_hukuman`. |
| `no_surat_panggilan` | text | Tidak | Nomor surat panggilan pemeriksaan. |
| `tanggal_panggilan` | date | Tidak | Tanggal surat panggilan. |
| `no_bap` | text | Tidak | Nomor Berita Acara Pemeriksaan. |
| `tanggal_bap` | date | Tidak | Tanggal BAP dibuat atau disahkan. |
| `no_sk_hukuman` | text | Tidak | Nomor SK hukuman disiplin. |
| `tanggal_sk_hukuman` | date | Tidak | Tanggal SK hukuman diterbitkan. |
| `tmt_hukuman` | date | Tidak | Tanggal mulai berlaku hukuman. |
| `tmt_akhir_hukuman` | date | Tidak | Tanggal akhir masa hukuman. |
| `status_proses_id` | text | Tidak | FK ke `master_status_proses_disiplin`. |
| `alasan_hukuman` | text | Tidak | Uraian alasan pelanggaran atau hukuman. |
| `keterangan` | text | Tidak | Catatan tambahan administratif. |
| `is_aktif` | boolean | Ya | Penanda record disiplin masih aktif atau sudah selesai. |
| `created_at` | timestamptz | Ya | Default `now()`. |
| `updated_at` | timestamptz | Ya | Default `now()`, update via trigger. |
| `created_by` | text | Tidak | Audit pembuat data. |
| `updated_by` | text | Tidak | Audit pengubah data. |

## 3) Aturan Integritas dan Relasi

Aturan integritas utama:

- PK: `riwayat_disiplin_id` unik dan tidak blank.
- FK:
  - `pegawai_id -> pegawai.pegawai_id` (`on delete restrict`)
  - `tingkat_hukuman_id -> master_tingkat_hukuman.tingkat_hukuman_id` (`on delete restrict`)
  - `jenis_hukuman_id -> master_jenis_hukuman.jenis_hukuman_id` (`on delete restrict`)
  - `status_proses_id -> master_status_proses_disiplin.status_proses_id` (`on delete restrict`)
- Check penting:
  - `trim(riwayat_disiplin_id) <> ''`, `trim(pegawai_id) <> ''`;
  - `tmt_akhir_hukuman >= tmt_hukuman` bila keduanya terisi;
  - `is_aktif` wajib non-null.
- Index minimum:
  - `pegawai_id`, `tingkat_hukuman_id`, `jenis_hukuman_id`, `status_proses_id`;
  - komposit (`pegawai_id`, `is_aktif`) untuk lookup kasus aktif;
  - index `tanggal_sk_hukuman` untuk laporan periodik.

## 4) RLS dan Service Role Boundary

Boundary akses minimum untuk `riwayat_disiplin`:

1. `anon` deny penuh.
2. `authenticated` hanya boleh `select` record sesuai scope kewenangan.
3. Insert, update, delete dilakukan dari backend route handler Next.js atau RPC `security definer` dengan service role.

Guard implementasi:

- endpoint mutasi disiplin wajib role-gated karena datanya sensitif;
- service role key hanya tersedia pada runtime server;
- perubahan status proses, status aktif, dan dokumen hukuman wajib dicatat ke `audit_log`.

## 5) Catatan Privasi dan Data Sensitif

`riwayat_disiplin` termasuk data sensitif karena berisi proses pemeriksaan dan hukuman pegawai.

Data yang perlu perlakuan ketat:

- `no_surat_panggilan`, `no_bap`, `no_sk_hukuman`;
- `alasan_hukuman` dan `keterangan` yang bisa memuat detail kasus;
- kombinasi status proses, masa berlaku hukuman, dan identitas pegawai.

Prinsip minimum:

1. tampilan list hanya menampilkan metadata minimum;
2. detail kasus lengkap hanya untuk role yang berwenang;
3. lakukan masking seperlunya untuk nomor dokumen saat ditampilkan di area umum;
4. audit akses untuk endpoint detail disiplin;
5. terapkan retensi data sesuai kebijakan instansi.

## 6) Penyesuaian dari Struktur Lama

Penyesuaian parity dari schema awal ke implementasi Supabase:

- `tingkat_hukuman_id` dan `jenis_hukuman_id` dipaku sebagai FK agar klasifikasi hukuman konsisten;
- `status_proses_id` dipisah agar alur administrasi disiplin mudah dipantau;
- `is_aktif` dipakai formal untuk membedakan kasus aktif dan tidak aktif;
- metadata dokumen pemeriksaan (`surat panggilan`, `BAP`, `SK hukuman`) tetap di tabel yang sama agar audit kronologi kasus mudah;
- kolom audit diseragamkan dengan tabel riwayat lain.

## 7) Aturan Validasi yang Disarankan

Validasi aplikasi dan database:

- wajib isi: `riwayat_disiplin_id`, `pegawai_id`, `is_aktif`;
- validasi tanggal: `tanggal_panggilan`, `tanggal_bap`, `tanggal_sk_hukuman`, `tmt_hukuman`, `tmt_akhir_hukuman`;
- validasi relasi FK sebelum mutasi;
- jika `status_proses_id` menandakan selesai, `is_aktif` sebaiknya `false`;
- jika hukuman masih berjalan, `is_aktif` dapat `true`.

Validasi mutasi backend Next.js:

- payload whitelist dan normalisasi string kosong ke `null`;
- isi `updated_by` dari actor aktif;
- batasi update kolom status proses dan hukuman hanya untuk role yang punya otorisasi disiplin.

## 8) Contoh Query Operasional

Contoh baca riwayat disiplin aktif per pegawai:

```sql
select
  rd.riwayat_disiplin_id,
  rd.tingkat_hukuman_id,
  rd.jenis_hukuman_id,
  rd.status_proses_id,
  rd.no_sk_hukuman,
  rd.tanggal_sk_hukuman,
  rd.tmt_hukuman,
  rd.tmt_akhir_hukuman,
  rd.is_aktif
from riwayat_disiplin rd
where rd.pegawai_id = $1
  and rd.is_aktif = true
order by coalesce(rd.tanggal_sk_hukuman, rd.created_at) desc;
```

Contoh menutup kasus disiplin yang sudah selesai:

```sql
update riwayat_disiplin
set status_proses_id = $2,
    is_aktif = false,
    updated_at = now(),
    updated_by = $3
where riwayat_disiplin_id = $1
  and pegawai_id = $4;
```

## 9) Catatan Implementasi Next.js + Supabase

- gunakan route handler server side untuk semua mutasi disiplin;
- pisahkan DTO list dan DTO detail agar paparan data sensitif tetap minim;
- gabungkan label master hukuman dan status proses di backend sebelum dikirim ke UI;
- tambahkan integration test untuk RLS lintas role agar data disiplin tidak bocor antar scope;
- simpan jejak perubahan kasus disiplin ke `audit_log` untuk kebutuhan investigasi internal.

## 10) Kesimpulan

`riwayat_disiplin` adalah sumber histori proses dan hukuman disiplin pegawai yang sensitif secara administratif. Implementasi Supabase perlu menyeimbangkan integritas relasi, kontrol akses ketat, dan audit trail yang lengkap agar data disiplin tetap valid, aman, dan bisa dipakai untuk monitoring pembinaan pegawai.

# K. Tabel `riwayat_diklat`

**Template Type: T10 (History Table for Supabase).**

## 1) Tujuan Parity Supabase

`riwayat_diklat` menyimpan histori diklat, pelatihan, workshop, kursus, atau sertifikasi nonformal pegawai dengan relasi langsung ke tabel `pegawai`.

Relasi inti:

```text
pegawai
  └── 1 : N -> riwayat_diklat
```

Tujuan parity untuk Supabase:

- menjaga pemisahan domain antara pendidikan formal (`riwayat_pendidikan`) dan pelatihan nonformal (`riwayat_diklat`);
- mempertahankan metadata pelatihan seperti penyelenggara, durasi, dan sertifikat;
- memastikan histori kompetensi tetap bisa diaudit lintas periode;
- mendukung kebutuhan laporan pengembangan kompetensi berbasis pegawai, tahun, atau jenis diklat.

## 2) Struktur Kolom

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `riwayat_diklat_id` | text | Ya | PK record diklat. |
| `pegawai_id` | text | Ya | FK ke `pegawai`. |
| `nama_diklat` | text | Ya | Nama kegiatan diklat atau pelatihan. |
| `jenis_diklat` | text | Tidak | Kategori diklat, contoh teknis, fungsional, workshop, kursus, sertifikasi. |
| `penyelenggara` | text | Tidak | Instansi atau lembaga penyelenggara. |
| `tempat` | text | Tidak | Lokasi pelaksanaan diklat. |
| `tahun` | integer | Tidak | Tahun pelaksanaan untuk filter cepat. |
| `tanggal_mulai` | date | Tidak | Tanggal mulai pelaksanaan. |
| `tanggal_selesai` | date | Tidak | Tanggal selesai pelaksanaan. |
| `jumlah_jam` | integer | Tidak | Jumlah jam pelatihan atau JP. |
| `no_sertifikat` | text | Tidak | Nomor sertifikat bila tersedia. |
| `tanggal_sertifikat` | date | Tidak | Tanggal terbit sertifikat. |
| `created_at` | timestamptz | Ya | Default `now()`. |
| `updated_at` | timestamptz | Ya | Default `now()`, update via trigger. |
| `created_by` | text | Tidak | Audit pembuat data. |
| `updated_by` | text | Tidak | Audit pengubah data. |

## 3) Aturan Integritas dan Relasi

Aturan integritas utama:

- PK: `riwayat_diklat_id` unik dan tidak blank.
- FK:
  - `pegawai_id -> pegawai.pegawai_id` (`on delete restrict`).
- Check penting:
  - `trim(riwayat_diklat_id) <> ''`, `trim(pegawai_id) <> ''`, `trim(nama_diklat) <> ''`;
  - `tahun` bila terisi berada pada rentang masuk akal instansi, misalnya `1900..2100`;
  - `tanggal_selesai >= tanggal_mulai` bila keduanya terisi;
  - `tanggal_sertifikat >= tanggal_mulai` bila keduanya terisi;
  - `jumlah_jam >= 0` bila terisi.
- Index minimum:
  - `pegawai_id`, `tahun`;
  - komposit (`pegawai_id`, `tahun`);
  - `tanggal_mulai` untuk filter periode.

Catatan integrity tambahan:

- Untuk mencegah duplikasi input diklat, aktifkan unique komposit berbasis (`pegawai_id`, `nama_diklat`, `tanggal_mulai`, `penyelenggara`) dengan normalisasi teks trim+lower di layer backend.

## 4) RLS dan Service Role Boundary

Boundary akses minimum:

1. `anon` deny penuh untuk `riwayat_diklat`.
2. `authenticated` hanya boleh `select` data dalam scope pegawai yang sah.
3. Insert, update, delete dilakukan melalui backend route handler Next.js atau RPC terproteksi dengan service role.

Guard implementasi:

- jangan izinkan client browser menulis langsung ke tabel histori;
- gunakan payload whitelist agar kolom tak dikenal tidak ikut tersimpan;
- log mutasi penting ke `audit_log`, termasuk perubahan nomor sertifikat;
- simpan service role key hanya di server environment.

## 5) Catatan Privasi dan Data Sensitif

`riwayat_diklat` bukan tabel paling sensitif, tetapi tetap dapat memuat nomor dokumen pelatihan dan metadata personal administratif.

Data yang perlu perlakuan khusus:

- `no_sertifikat` dan kombinasi metadata kegiatan;
- catatan bebas jika di masa depan ditambahkan kolom keterangan evaluasi;
- pola histori lengkap yang bisa dipakai untuk profiling kompetensi pegawai.

Prinsip privasi minimum:

1. tampilkan data minimum pada mode list, detail lengkap hanya untuk role berizin;
2. hindari menampilkan nomor sertifikat penuh pada view publik internal;
3. batasi export massal histori diklat pada role tertentu;
4. audit akses endpoint detail histori diklat;
5. terapkan retensi data sesuai kebijakan instansi.

## 6) Penyesuaian dari Struktur Lama

Penyesuaian parity dari struktur legacy ke Supabase:

- penamaan kolom diseragamkan ke snake_case;
- histori diklat dipertahankan sebagai domain nonformal, tidak dicampur dengan pendidikan formal;
- struktur audit (`created_at`, `updated_at`, `created_by`, `updated_by`) diseragamkan;
- tipe tanggal dipaku ke `date` agar validasi periode konsisten;
- `tahun` dipertahankan sebagai akselerator filter laporan meski tanggal lengkap tersedia.

## 7) Aturan Validasi yang Disarankan

Validasi aplikasi dan database:

- wajib isi: `riwayat_diklat_id`, `pegawai_id`, `nama_diklat`;
- validasi tanggal: `tanggal_mulai`, `tanggal_selesai`, `tanggal_sertifikat`;
- validasi format angka: `tahun`, `jumlah_jam`;
- validasi FK `pegawai_id` sebelum mutasi;
- normalisasi string kosong menjadi `null` untuk kolom opsional.

Validasi mutasi backend Next.js:

- gunakan schema validator server side untuk semua payload;
- isi `updated_by` dari actor aktif, bukan dari input klien;
- cegah update yang menurunkan kualitas data, misalnya menghapus `nama_diklat` pada record yang sudah tersimpan;
- validasi domain sederhana untuk `jenis_diklat` agar tidak liar jika instansi punya daftar terbatas.

## 8) Contoh Query Operasional

Contoh baca histori diklat per pegawai, urut terbaru:

```sql
select
  rd.riwayat_diklat_id,
  rd.nama_diklat,
  rd.jenis_diklat,
  rd.penyelenggara,
  rd.tahun,
  rd.tanggal_mulai,
  rd.tanggal_selesai,
  rd.jumlah_jam
from riwayat_diklat rd
where rd.pegawai_id = $1
order by coalesce(rd.tanggal_mulai, make_date(rd.tahun, 1, 1)) desc,
         rd.created_at desc;
```

Contoh index pendukung:

```sql
create index if not exists idx_riwayat_diklat_pegawai_tahun
  on riwayat_diklat (pegawai_id, tahun);
```

## 9) Catatan Implementasi Next.js + Supabase

- lakukan baca histori diklat pada server component atau route handler;
- siapkan mode list dan detail agar payload tetap efisien;
- gunakan invalidasi cache setelah mutasi berhasil;
- satukan query label referensi bila `jenis_diklat` nanti dinormalisasi ke master;
- buat integration test untuk validasi tanggal dan boundary RLS.

## 10) Kesimpulan

`riwayat_diklat` adalah tabel histori kompetensi nonformal yang penting untuk profil pengembangan pegawai. Pada Supabase, tabel ini perlu dijaga lewat FK ketat ke `pegawai`, validasi periode yang konsisten, dan boundary akses yang aman melalui backend service path.

---

# L. Tabel `riwayat_usulan`

**Template Type: T10 (Generic Workflow Submission Table for Supabase).**

## 1) Tujuan Parity Supabase

`riwayat_usulan` menyimpan transaksi usulan administratif pegawai lintas modul, lalu menjadi titik integrasi ke log approval pada `approval_log`.

Relasi inti:

```text
pegawai
  └── 1 : N -> riwayat_usulan

master_jenis_usulan
  └── 1 : N -> riwayat_usulan

master_status_usulan
  └── 1 : N -> riwayat_usulan

riwayat_usulan
  └── 1 : N -> approval_log
```

Tujuan parity untuk Supabase:

- mempertahankan model usulan generik lintas modul dengan tautan eksplisit ke data sumber;
- memisahkan status ringkas di `riwayat_usulan` dan kronologi aksi di `approval_log`;
- memastikan alur perubahan status berjalan transaksional agar tidak terjadi drift antara tabel usulan dan log approval;
- mendukung monitoring antrian verifikasi, persetujuan, dan penyelesaian usulan per role dan scope.

## 2) Struktur Kolom

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `riwayat_usulan_id` | text | Ya | PK usulan. |
| `pegawai_id` | text | Ya | FK ke `pegawai`. |
| `jenis_usulan_id` | text | Ya | FK ke `master_jenis_usulan`. |
| `modul_sumber` | text | Ya | Nama modul sumber usulan. |
| `referensi_record_id` | text | Ya | ID record pada modul sumber. |
| `periode_bulan` | integer | Tidak | Bulan periode bila relevan. |
| `periode_tahun` | integer | Tidak | Tahun periode bila relevan. |
| `tanggal_usulan` | date | Ya | Tanggal usulan dibuat atau diajukan. |
| `status_usulan_id` | text | Ya | FK ke `master_status_usulan`. |
| `tanggal_status` | date | Tidak | Tanggal perubahan status terakhir. |
| `keterangan` | text | Tidak | Catatan umum pengusul atau sistem. |
| `catatan_verifikator` | text | Tidak | Catatan verifikasi, revisi, atau alasan penolakan. |
| `is_aktif` | boolean | Ya | Penanda usulan masih berjalan. |
| `created_at` | timestamptz | Ya | Default `now()`. |
| `updated_at` | timestamptz | Ya | Default `now()`, update via trigger. |
| `created_by` | text | Tidak | Audit pembuat data. |
| `updated_by` | text | Tidak | Audit pengubah data. |

## 3) Aturan Integritas, Relasi, dan Transactional Workflow

Aturan integritas utama:

- PK: `riwayat_usulan_id` unik dan tidak blank.
- FK:
  - `pegawai_id -> pegawai.pegawai_id` (`on delete restrict`);
  - `jenis_usulan_id -> master_jenis_usulan.jenis_usulan_id` (`on delete restrict`);
  - `status_usulan_id -> master_status_usulan.status_usulan_id` (`on delete restrict`).
- Check penting:
  - `trim(riwayat_usulan_id) <> ''`, `trim(pegawai_id) <> ''`, `trim(jenis_usulan_id) <> ''`, `trim(modul_sumber) <> ''`, `trim(referensi_record_id) <> ''`, `trim(status_usulan_id) <> ''`;
  - `periode_bulan` bila terisi berada pada `1..12`;
  - `periode_tahun` bila terisi berada pada rentang masuk akal, misalnya `1900..2100`;
  - `is_aktif` wajib non-null.

Index minimum:

- `pegawai_id`, `jenis_usulan_id`, `status_usulan_id`;
- komposit (`modul_sumber`, `referensi_record_id`);
- komposit (`status_usulan_id`, `is_aktif`, `tanggal_status`) untuk queue kerja.

Guidance workflow transaksional wajib:

1. **Create usulan + initial status** harus dalam satu transaksi agar data usulan tidak orphan.
2. **Perubahan status usulan** harus menyertakan insert ke `approval_log` dalam transaksi yang sama.
3. Gunakan lock per usulan (`for update`) saat memproses approval untuk mencegah race condition.
4. Jika insert log gagal, update status usulan wajib rollback.

Linkage ke approval:

- setiap event approval penting harus menghasilkan baris `approval_log` dengan pasangan `status_sebelum_id` dan `status_sesudah_id`;
- status ringkas terkini tetap ada di `riwayat_usulan.status_usulan_id` agar query dashboard cepat;
- histori kronologis sumber kebenaran proses ada di `approval_log.tanggal_aksi`.

## 4) RLS dan Service Role Boundary

Boundary akses minimum:

1. `anon` deny penuh untuk `riwayat_usulan`.
2. `authenticated` hanya boleh `select` usulan sesuai scope akses organisasi atau pegawai.
3. Insert, update status, dan write ke `approval_log` hanya melalui backend route handler atau RPC `security definer`.

Guard implementasi:

- jangan izinkan client browser mengubah `status_usulan_id` secara langsung;
- endpoint approval wajib mengambil actor dari session terautentikasi;
- service role dipakai untuk workflow orchestration lintas role, tetapi actor operasional tetap dicatat eksplisit di log;
- gunakan policy tambahan agar user tanpa scope tidak bisa membaca usulan di luar domainnya.

## 5) Catatan Privasi dan Data Sensitif

`riwayat_usulan` bersifat administratif, tetapi tetap memuat catatan proses yang dapat berisi konteks sensitif.

Data yang perlu perlakuan khusus:

- `catatan_verifikator` dan `keterangan` yang bisa berisi alasan internal;
- kombinasi `modul_sumber` dan `referensi_record_id` yang dapat mengarah ke data sensitif modul sumber;
- metadata progres usulan yang memengaruhi keputusan kepegawaian.

Prinsip privasi minimum:

1. tampilkan catatan detail hanya pada role berwenang;
2. pisahkan mode list dan detail agar catatan sensitif tidak tersebar luas;
3. audit setiap aksi approval, reject, return, dan override status;
4. lakukan masking atau redaksi terbatas jika catatan dipublikasikan lintas unit;
5. tetapkan retensi histori sesuai regulasi instansi.

## 6) Penyesuaian dari Struktur Lama

Penyesuaian parity dari struktur legacy ke Supabase:

- penamaan kolom dinormalkan ke snake_case konsisten lintas tabel;
- `modul_sumber` dan `referensi_record_id` dipertahankan sebagai penghubung generik lintas modul;
- status proses dipaku pada master workflow (`master_status_usulan`) untuk konsistensi state;
- audit kolom diseragamkan (`created_at`, `updated_at`, `created_by`, `updated_by`);
- model linkage ke `approval_log` ditegaskan sebagai pola append-only untuk histori aksi.

## 7) Aturan Validasi yang Disarankan

Validasi aplikasi dan database:

- wajib isi: `riwayat_usulan_id`, `pegawai_id`, `jenis_usulan_id`, `modul_sumber`, `referensi_record_id`, `tanggal_usulan`, `status_usulan_id`, `is_aktif`;
- validasi FK ke `pegawai`, `master_jenis_usulan`, dan `master_status_usulan`;
- validasi referensi sumber: `referensi_record_id` harus ada pada `modul_sumber` yang dinyatakan;
- validasi transisi status: perubahan status harus sesuai matriks transisi yang berlaku;
- saat status final tercapai (`is_final=true` pada master status), `is_aktif` harus diset `false`.

Validasi mutasi backend Next.js:

- payload whitelist ketat untuk endpoint submit dan approval;
- `updated_by` diisi dari actor backend terautentikasi;
- enforce idempotency key untuk endpoint approval agar double submit tidak membuat log ganda;
- gunakan optimistic concurrency (`updated_at`) atau lock row (`for update`) pada update status.

## 8) Contoh Query Operasional

Contoh transaksi create usulan + log inisialisasi approval linkage:

```sql
begin;

insert into riwayat_usulan (
  riwayat_usulan_id,
  pegawai_id,
  jenis_usulan_id,
  modul_sumber,
  referensi_record_id,
  periode_bulan,
  periode_tahun,
  tanggal_usulan,
  status_usulan_id,
  tanggal_status,
  keterangan,
  is_aktif,
  created_at,
  updated_at,
  created_by,
  updated_by
)
values (
  $1, $2, $3, $4, $5,
  $6, $7, $8,
  $9, $8,
  $10,
  true,
  now(), now(),
  $11, $11
);

insert into approval_log (
  approval_log_id,
  riwayat_usulan_id,
  actor_user_id,
  aksi_approval_id,
  status_sebelum_id,
  status_sesudah_id,
  tanggal_aksi,
  catatan,
  created_at,
  updated_at,
  created_by,
  updated_by
)
values (
  $12,
  $1,
  $11,
  $13,
  null,
  $9,
  now(),
  $14,
  now(), now(),
  $11, $11
);

commit;
```

Contoh transaksi approval step dengan lock usulan dan insert log terhubung:

```sql
begin;

with locked as (
  select riwayat_usulan_id, status_usulan_id
  from riwayat_usulan
  where riwayat_usulan_id = $1
  for update
)
update riwayat_usulan ru
set status_usulan_id = $2,
    tanggal_status = current_date,
    catatan_verifikator = $3,
    is_aktif = $4,
    updated_at = now(),
    updated_by = $5
from locked
where ru.riwayat_usulan_id = locked.riwayat_usulan_id;

insert into approval_log (
  approval_log_id,
  riwayat_usulan_id,
  actor_user_id,
  aksi_approval_id,
  status_sebelum_id,
  status_sesudah_id,
  tanggal_aksi,
  catatan,
  created_at,
  updated_at,
  created_by,
  updated_by
)
select
  $6,
  locked.riwayat_usulan_id,
  $5,
  $7,
  locked.status_usulan_id,
  $2,
  now(),
  $3,
  now(), now(),
  $5, $5
from locked;

commit;
```

Contoh baca queue usulan aktif per status:

```sql
select
  ru.riwayat_usulan_id,
  ru.pegawai_id,
  ru.jenis_usulan_id,
  ru.modul_sumber,
  ru.referensi_record_id,
  ru.status_usulan_id,
  ru.tanggal_status,
  ru.is_aktif
from riwayat_usulan ru
where ru.status_usulan_id = $1
  and ru.is_aktif = true
order by ru.tanggal_status asc, ru.created_at asc;
```

## 9) Catatan Implementasi Next.js + Supabase

- jadikan backend sebagai satu-satunya jalur mutasi usulan dan approval;
- implementasikan helper service untuk `submitUsulan` dan `processApproval` agar aturan transaksional konsisten;
- setiap transisi status harus selalu menulis `approval_log` pada transaksi yang sama;
- sinkronkan kode status dan aksi dengan master (`kode_status_usulan`, `kode_aksi_approval`) sebagai contract lintas layer;
- siapkan integration test untuk skenario race condition, rollback saat insert log gagal, dan validasi scope akses.

## 10) Kesimpulan

`riwayat_usulan` adalah pusat transaksi workflow usulan lintas modul, sedangkan `approval_log` menjadi jejak kronologis aksi approval-nya. Implementasi Supabase harus memastikan kedua tabel bergerak sinkron secara transaksional agar status ringkas, histori approval, dan audit operasional tetap konsisten serta dapat dipercaya.

# M. Tabel `users`

**Template Type: T8 (Auth Bridge Core + RLS Boundary).**

## 1) Tujuan Parity Supabase

Tabel `public.users` tetap menjadi sumber data domain akun aplikasi, lalu di-bridge ke `auth.users` untuk login Supabase Auth pada Next.js.

Relasi inti:

```text
pegawai
  └── 1 : 0..1 -> users

auth.users
  └── 1 : 0..1 -> users   (bridge target untuk model hybrid)
```

## 2) Struktur Kolom

Struktur parity minimum saat ini, konsisten dengan migration batch akses:

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `user_id` | text | Ya | PK domain user.
| `pegawai_id` | text | Tidak | FK ke `pegawai`, unique bila terisi.
| `username` | text | Ya | Unique login handle internal.
| `email_login` | text | Tidak | Identitas email aplikasi.
| `auth_user_id` | uuid | Tidak | Unique FK ke `auth.users(id)` untuk bridge identitas auth.
| `password_hash` | text | Tidak | Nullable untuk skenario Supabase Auth bridge.
| `password_changed_at` | timestamptz | Tidak | Jejak update kredensial aplikasi.
| `last_login_at` | timestamptz | Tidak | Jejak login sukses.
| `failed_login_count` | integer | Ya | Default `0`, non-negatif.
| `is_locked` | boolean | Ya | Default `false`.
| `is_active` | boolean | Ya | Default `true`.
| `created_at` | timestamptz | Ya | Default `now()`.
| `updated_at` | timestamptz | Ya | Default `now()`.
| `created_by` | text | Tidak | Audit admin.
| `updated_by` | text | Tidak | Audit admin.

Bridge target untuk Supabase Auth:

- Gunakan model bridge langsung: `auth_user_id uuid unique references auth.users(id)` pada `public.users`.
- `username` tetap wajib sebagai identitas internal aplikasi, walaupun login utama menggunakan Supabase Auth.

## 3) Aturan Integritas

- Unique: `users.user_id`, `users.username`, `users.pegawai_id`, `users.auth_user_id`.
- Check: `username` tidak boleh kosong, `failed_login_count >= 0`.
- FK: `users.pegawai_id -> pegawai.pegawai_id` (`on delete set null`).
- `auth_user_id` menggunakan `on delete restrict` untuk mencegah orphan bridge.

## 4) RLS dan Service Role Boundary

Boundary minimal untuk Next.js + Supabase:

- `anon`: tidak boleh akses `public.users`.
- `authenticated`: hanya `select` row milik sendiri setelah mapping `auth.uid()` ke user domain.
- `service_role`: dipakai untuk provisioning akun, sinkronisasi bridge, reset lock state, dan operasi admin lintas user.

Guard penting:

1. Client browser tidak menulis langsung ke `public.users` untuk operasi sensitif.
2. Operasi admin ditaruh pada RPC `security definer` atau backend route yang pakai service role key.
3. Service role key tidak boleh ada di client bundle.

## 5) Catatan Implementasi Next.js

- Session auth diambil dari Supabase Auth (`auth.getUser()` / server session helper).
- Mapping domain dilakukan setelah login, lalu role dan scope diturunkan dari `user_roles` dan `access_scope`.
- `password_hash` diperlakukan sebagai jalur kompatibilitas transisi, bukan sumber utama login saat mode bridge aktif.

---

# N. Tabel `roles`

**Template Type: T7 (Access Reference Table).**

## 1) Tujuan Parity Supabase

`roles` menyimpan kamus peran aplikasi, tidak menyimpan data organisasi, dan menjadi sumber assignment di `user_roles`.

## 2) Struktur Kolom

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `role_id` | text | Ya | PK.
| `kode_role` | text | Ya | Unique, kode stabil untuk policy dan guard.
| `nama_role` | text | Ya | Nama tampilan.
| `deskripsi` | text | Tidak | Uraian peran.
| `is_system` | boolean | Ya | Role bawaan sistem.
| `is_active` | boolean | Ya | Status aktif role.
| `created_at` | timestamptz | Ya | Default `now()`.
| `updated_at` | timestamptz | Ya | Default `now()`.
| `created_by` | text | Tidak | Audit admin.
| `updated_by` | text | Tidak | Audit admin.

## 3) Aturan Integritas

- Unique: `role_id`, `kode_role`.
- Check: `kode_role` dan `nama_role` tidak boleh kosong.
- Disarankan kode role uppercase konsisten, contoh `SUPERADMIN`, `ADMIN_OPD`, `PEGAWAI`.

## 4) RLS dan Service Role Boundary

- `anon`: deny.
- `authenticated`: read-only untuk kebutuhan authorization mapping.
- Mutasi role hanya lewat service role atau jalur admin backend terproteksi.

Daftar role default dipatok lintas environment: `SUPERADMIN`, `ADMIN_OPD`, `VERIFIKATOR_BKD`, `APPROVER_BKD`, `PEGAWAI`.

---

# O. Tabel `user_roles`

**Template Type: T7 (Access Assignment Bridge).**

## 1) Tujuan Parity Supabase

`user_roles` mengikat user domain ke role aplikasi, termasuk masa berlaku assignment.

Relasi inti:

```text
users
  └── 1 : N -> user_roles

roles
  └── 1 : N -> user_roles
```

## 2) Struktur Kolom

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `user_role_id` | text | Ya | PK assignment.
| `user_id` | text | Ya | FK ke `users`.
| `role_id` | text | Ya | FK ke `roles`.
| `status` | text | Ya | Default `ACTIVE`.
| `assigned_at` | timestamptz | Ya | Default `now()`.
| `expired_at` | timestamptz | Tidak | Null berarti belum berakhir.
| `is_active` | boolean | Ya | Default `true`.
| `created_at` | timestamptz | Ya | Default `now()`.
| `updated_at` | timestamptz | Ya | Default `now()`.
| `created_by` | text | Tidak | Audit admin.
| `updated_by` | text | Tidak | Audit admin.

## 3) Aturan Integritas

- Unique komposit: (`user_id`, `role_id`).
- FK: `user_id -> users.user_id`, `role_id -> roles.role_id`.
- Check: `expired_at >= assigned_at` bila `expired_at` ada.
- Trigger `updated_at` saat update.

## 4) RLS dan Service Role Boundary

- `authenticated`: read assignment milik sendiri untuk membentuk claim role pada layer aplikasi.
- Penambahan atau pencabutan role hanya boleh lewat service role path.
- Penghapusan fisik tidak direkomendasikan, gunakan `is_active=false` atau `expired_at`.

Riwayat assignment role diizinkan lintas waktu dengan satu role aktif per user: ganti unique menjadi partial unique (`user_id`, `role_id`) saat `is_active=true`.

---

# P. Tabel `access_scope`

**Template Type: T7 (Scope Boundary Table).**

## 1) Tujuan Parity Supabase

`access_scope` menyimpan batas ruang data untuk setiap assignment role, agar query aplikasi bisa dibatasi sampai level OPD, unit kerja, self, atau bawahan langsung.

Relasi inti:

```text
user_roles
  └── 1 : N -> access_scope
```

## 2) Struktur Kolom

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `access_scope_id` | text | Ya | PK.
| `user_role_id` | text | Ya | FK ke `user_roles`.
| `scope_type` | text | Ya | Enum praktis: `GLOBAL`, `OPD`, `UNIT_KERJA`, `SELF`, `BAWAHAN_LANGSUNG`.
| `scope_ref_id` | text | Tidak | Referensi target scope, null hanya untuk `GLOBAL`.
| `valid_from` | timestamptz | Tidak | Mulai aktif.
| `valid_until` | timestamptz | Tidak | Selesai aktif.
| `keterangan` | text | Tidak | Catatan admin.
| `is_active` | boolean | Ya | Default `true`.
| `created_at` | timestamptz | Ya | Default `now()`.
| `updated_at` | timestamptz | Ya | Default `now()`.
| `created_by` | text | Tidak | Audit admin.
| `updated_by` | text | Tidak | Audit admin.

## 3) Aturan Integritas

- FK: `user_role_id -> user_roles.user_role_id` (`on delete cascade`).
- Check scope:
  - `GLOBAL` wajib `scope_ref_id is null`.
  - selain `GLOBAL` wajib `scope_ref_id` terisi.
- Check waktu: `valid_until >= valid_from` jika keduanya ada.
- Index penting: (`scope_type`, `scope_ref_id`) dan (`valid_from`, `valid_until`).

## 4) RLS dan Service Role Boundary

- User login boleh baca scope miliknya sendiri.
- Evaluasi policy per domain table sebaiknya memanggil helper SQL yang membaca `access_scope` aktif.
- Write scope hanya lewat service role atau admin RPC terproteksi.

Enforcement `scope_ref_id` dipatok ke relasi eksplisit bertipe (`scope_opd_id`, `scope_unit_kerja_id`, `scope_pegawai_id`) sesuai `scope_type`; validasi tambahan tetap dijaga di backend.

---

# Q. Tabel `approval_log`

**Template Type: T10-equivalent (Append-only Workflow Log Table).**

## 1) Tujuan Parity Supabase

`approval_log` adalah log event approval per `riwayat_usulan`, bukan penyimpan status akhir utama.

Relasi inti:

```text
riwayat_usulan
  └── 1 : N -> approval_log

users
  └── 1 : N -> approval_log
```

## 2) Struktur Kolom

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `approval_log_id` | text | Ya | PK log.
| `riwayat_usulan_id` | text | Ya | FK usulan.
| `actor_user_id` | text | Ya | FK ke user domain pelaku.
| `aksi_approval_id` | text | Ya | FK ke master aksi approval.
| `status_sebelum_id` | text | Tidak | FK status sebelum.
| `status_sesudah_id` | text | Tidak | FK status sesudah.
| `tanggal_aksi` | timestamptz | Ya | Waktu event.
| `catatan` | text | Tidak | Alasan dan konteks.
| `created_at` | timestamptz | Ya | Default `now()`.
| `updated_at` | timestamptz | Ya | Default `now()`.
| `created_by` | text | Tidak | Audit admin.
| `updated_by` | text | Tidak | Audit admin.

## 3) Aturan Integritas dan Immutability

- FK ke `riwayat_usulan`, `users`, dan `master_aksi_approval` wajib aktif.
- Nilai string penting tidak boleh blank.
- Pola kerja tabel: append-only. Update hanya untuk koreksi administratif terbatas.
- `tanggal_aksi` jadi sumber urutan proses, bukan `updated_at`.

## 4) RLS dan Service Role Boundary

- User login boleh baca log usulan yang memang ada di scope aksesnya.
- Insert log approval lewat RPC backend terkontrol, jangan direct insert dari client.
- Update dan delete ditutup untuk role `authenticated`, dibuka hanya pada service role dengan audit ketat.

`actor_user_id` wajib diturunkan dari `auth.uid()` untuk aksi interaktif dan boleh diisi akun sistem terdaftar untuk job terjadwal (tanpa menerima actor bebas dari payload klien).

---

# R. Tabel `audit_log`

**Template Type: T10-equivalent (Append-only System Audit Log Table).**

## 1) Tujuan Parity Supabase

`audit_log` menyimpan jejak aksi lintas modul secara generik, termasuk konteks keamanan dan troubleshooting.

Relasi inti:

```text
users
  └── 1 : N -> audit_log
```

## 2) Struktur Kolom

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `audit_log_id` | text | Ya | PK log.
| `actor_user_id` | text | Ya | FK pelaku ke `users`.
| `aksi_audit_id` | text | Tidak | FK ke master aksi audit bila dipakai.
| `target_table` | text | Ya | Nama objek target.
| `target_record_id` | text | Ya | ID objek target.
| `aksi_at` | timestamptz | Ya | Waktu event audit.
| `metadata` | jsonb | Tidak | Detail tambahan terstruktur.
| `keterangan` | text | Tidak | Uraian ringkas.
| `created_at` | timestamptz | Ya | Default `now()`.
| `updated_at` | timestamptz | Ya | Default `now()`.
| `created_by` | text | Tidak | Audit admin.
| `updated_by` | text | Tidak | Audit admin.

## 3) Aturan Integritas dan Immutability

- `actor_user_id`, `target_table`, `target_record_id` tidak boleh blank.
- `metadata` dipakai untuk konteks, hindari menaruh data sensitif mentah.
- Tabel dijalankan append-only, perubahan historis sangat dibatasi.
- Index disarankan pada `actor_user_id`, `aksi_at`, dan (`target_table`, `target_record_id`).

## 4) RLS dan Service Role Boundary

- `anon`: deny penuh.
- `authenticated`: tidak boleh baca seluruh log mentah lintas user kecuali lewat view terfilter kebijakan instansi.
- service role mengelola insert audit lintas proses backend, termasuk event non-interaktif.
- Jika butuh observability internal, buat `security definer view` untuk subset kolom aman.

Enforcement `target_record_id` tetap polymorphic dengan trigger validasi DB berbasis whitelist `target_table`, ditambah validasi backend.

---

## Ringkasan Keputusan Final di PART 3

1. Bridge auth dipatok dengan `public.users.auth_user_id -> auth.users(id)`.
2. Seed role default lintas environment dipatok ke daftar role inti.
3. `user_roles` memakai partial unique untuk satu role aktif per user.
4. `access_scope` memakai relasi eksplisit bertipe sesuai `scope_type`.
5. Actor `approval_log` wajib terikat identitas auth/sistem terdaftar.
6. `audit_log` polymorphic dijaga trigger whitelist + validasi backend.

# S. Kelompok `master_referensi_inti`

**Template Type: G5 (Master Group Bundle for Supabase).**

## 1) Tujuan Parity Supabase

Kelompok `master_referensi_inti` menjadi fondasi referensi baku lintas domain SIMPEG agar seluruh FK pada tabel inti dan tabel riwayat punya sumber nilai konsisten di PostgreSQL Supabase.

Paritas yang dipertahankan dari sumber legacy:

- setiap master tetap memakai `*_id` bertipe `text` sebagai PK;
- setiap `kode_*` tetap unique;
- `is_active` dipakai untuk nonaktifasi tanpa hapus historis;
- kolom audit (`created_at`, `updated_at`, `created_by`, `updated_by`) tetap disediakan di semua master.

## 2) Struktur Master Group Parity (Lengkap)

Seluruh detail tabel master pada chapter S dipertahankan di Supabase sebagai berikut.

### A. `master_status_pegawai`

Fungsi: referensi status pegawai.

```text
status_pegawai_id
kode_status_pegawai
nama_status_pegawai
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### B. `master_kedudukan_hukum`

Fungsi: referensi kedudukan hukum pegawai.

```text
kedudukan_hukum_id
kode_kedudukan_hukum
nama_kedudukan_hukum
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### C. `master_status_kerja`

Fungsi: referensi status kerja pegawai.

```text
status_kerja_id
kode_status_kerja
nama_status_kerja
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### D. `master_opd`

Fungsi: referensi OPD/SKPD.

```text
opd_id
kode_opd
nama_opd
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### E. `master_unit_kerja`

Fungsi: referensi unit kerja.

```text
unit_kerja_id
kode_unit_kerja
nama_unit_kerja
opd_id
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### F. `master_agama`

Fungsi: referensi agama.

```text
agama_id
kode_agama
nama_agama
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### G. `master_status_perkawinan`

Fungsi: referensi status perkawinan.

```text
status_perkawinan_id
kode_status_perkawinan
nama_status_perkawinan
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### H. `master_status_keluarga`

Fungsi: referensi status keluarga.

```text
status_keluarga_id
kode_status_keluarga
nama_status_keluarga
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### I. `master_tingkat_pendidikan`

Fungsi: referensi tingkat pendidikan formal.

```text
tingkat_pendidikan_id
kode_tingkat_pendidikan
nama_tingkat_pendidikan
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### K. `master_status_studi`

Fungsi: referensi status studi atau tugas belajar.

```text
status_studi_id
kode_status_studi
nama_status_studi
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### L. `master_jenis_jabatan`

Fungsi: referensi jenis atau jenjang jabatan.

```text
jenis_jabatan_id
kode_jenis_jabatan
nama_jenis_jabatan
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### M. `master_jabatan`

Fungsi: referensi jabatan.

```text
jabatan_id
kode_jabatan
nama_jabatan
jenis_jabatan_id
eselon_id
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### N. `master_eselon`

Fungsi: referensi eselon.

```text
eselon_id
kode_eselon
nama_eselon
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### O. `master_pangkat`

Fungsi: referensi pangkat.

```text
pangkat_id
kode_pangkat
nama_pangkat
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### P. `master_golongan`

Fungsi: referensi golongan.

```text
golongan_id
kode_golongan
nama_golongan
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### Q. `master_jenis_kenaikan_pangkat`

Fungsi: referensi jenis kenaikan pangkat.

```text
jenis_kenaikan_id
kode_jenis_kenaikan
nama_jenis_kenaikan
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### R. `master_jenis_pak`

Fungsi: referensi jenis PAK.

```text
jenis_pak_id
kode_jenis_pak
nama_jenis_pak
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### S. `master_status_dokumen`

Fungsi: referensi status dokumen.

```text
status_dokumen_id
kode_status_dokumen
nama_status_dokumen
is_final
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### T. `master_tingkat_hukuman`

Fungsi: referensi tingkat hukuman disiplin.

```text
tingkat_hukuman_id
kode_tingkat_hukuman
nama_tingkat_hukuman
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### U. `master_jenis_hukuman`

Fungsi: referensi jenis hukuman disiplin.

```text
jenis_hukuman_id
kode_jenis_hukuman
nama_jenis_hukuman
tingkat_hukuman_id
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### V. `master_status_proses_disiplin`

Fungsi: referensi status proses disiplin.

```text
status_proses_id
kode_status_proses
nama_status_proses
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### W. `master_predikat_skp`

Fungsi: referensi predikat hasil SKP.

```text
predikat_id
kode_predikat
nama_predikat
nilai_minimum
nilai_maksimum
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### X. `master_jenjang_skp`

Fungsi: referensi jenjang atau kategori SKP.

```text
jenjang_id
kode_jenjang
nama_jenjang
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### Y. `master_jenis_dokumen`

Fungsi: referensi jenis dokumen pegawai.

```text
jenis_dokumen_id
kode_jenis_dokumen
nama_jenis_dokumen
modul_sumber_default
is_wajib
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

## 3) Aturan Integritas Master Group

Aturan integritas Supabase untuk kelompok S:

- PK text unik pada semua `*_id`.
- `kode_*` unique di tabel masing masing.
- `urutan` non-negatif (`check urutan >= 0`).
- `is_active` default `true` untuk soft deactivation.
- Trigger `updated_at` aktif di semua tabel master.

Relasi antar master yang sudah dipatok:

1. `master_unit_kerja.opd_id -> master_opd.opd_id`
2. `master_jabatan.jenis_jabatan_id -> master_jenis_jabatan.jenis_jabatan_id`
3. `master_jabatan.eselon_id -> master_eselon.eselon_id`
4. `master_jenis_hukuman.tingkat_hukuman_id -> master_tingkat_hukuman.tingkat_hukuman_id`

## 4) RLS dan Service Role Boundary

Boundary minimal untuk group master referensi:

- `anon`: deny baca langsung tabel master internal.
- `authenticated`: read-only pada master yang dibutuhkan UI.
- `service_role`: write untuk seed, koreksi nomenklatur, dan sinkronisasi lintas environment.

Guard implementasi:

1. Mutasi master tidak dilakukan dari client browser.
2. Operasi CRUD master lewat backend route handler atau RPC `security definer`.
3. Seed master dijalankan idempotent per kode, bukan hard delete insert.

Policy RLS kelompok master dipatok: `authenticated` read-only terkontrol, write hanya service-role/admin RPC, dan deny default untuk anon.

## 5) Catatan Implementasi Next.js

- Buat cache master di server component atau route handler dengan invalidasi berbasis `updated_at`.
- Gunakan dictionary `kode_*` di layer aplikasi untuk mapping cepat antar modul.
- Pastikan fallback saat master tidak aktif agar form tidak menulis nilai yatim.
- Untuk dropdown besar, paginasi atau search-side query perlu disiapkan agar UI tidak menarik seluruh master sekaligus.

---

# T. Kelompok `master_workflow`

**Template Type: G5 (Workflow Master Group Bundle).**

## 1) Tujuan Parity Supabase

Kelompok `master_workflow` menjadi sumber nilai baku untuk alur `riwayat_usulan`, `approval_log`, dan `audit_log`, sehingga alur status dan aksi tidak ditulis bebas.

## 2) Struktur Master Workflow Parity (Lengkap)

### A. `master_jenis_usulan`

Fungsi: referensi jenis usulan lintas modul.

```text
jenis_usulan_id
kode_jenis_usulan
nama_jenis_usulan
modul_sumber_default
requires_approval
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### B. `master_status_usulan`

Fungsi: referensi status proses usulan.

```text
status_usulan_id
kode_status_usulan
nama_status_usulan
is_final
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### C. `master_aksi_approval`

Fungsi: referensi aksi approval atau review.

```text
aksi_approval_id
kode_aksi_approval
nama_aksi_approval
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

### D. `master_aksi_audit`

Fungsi: referensi aksi audit sistem.

```text
aksi_audit_id
kode_aksi_audit
nama_aksi_audit
kategori_aksi
urutan
is_active
keterangan
created_at
updated_at
created_by
updated_by
```

## 3) Aturan Integritas Master Workflow

- PK text unik pada seluruh `*_id` workflow master.
- `kode_*` unique per tabel.
- `is_final` hanya dipakai di `master_status_usulan` untuk status terminal.
- `requires_approval` hanya dipakai di `master_jenis_usulan` untuk kontrol jalur approval.
- Trigger `updated_at` aktif konsisten di tabel workflow master.

## 4) RLS dan Service Role Boundary

- `authenticated`: read-only untuk kebutuhan pembentukan state machine workflow di UI dan backend.
- write ke workflow master hanya oleh `service_role` atau jalur admin backend terproteksi.
- perubahan status terminal (`is_final`) wajib lewat review konfigurasi, tidak boleh edit bebas dari panel publik.

Matriks transisi status usulan dipatok ke tabel transisi eksplisit (`workflow_transition`) agar validasi tidak hanya bergantung pada logic aplikasi.

## 5) Catatan Implementasi Next.js

- Gunakan konstanta `kode_status_usulan` dan `kode_aksi_approval` sebagai contract antar frontend, backend, dan SQL helper.
- Simpan policy transisi sebagai helper server side agar UI tidak menjadi sumber kebenaran.
- Tambahkan guard CI untuk memastikan seed workflow tidak menghapus kode yang sudah dipakai histori.

---

# U. Tabel `dokumen_pegawai`

**Template Type: T7 (Document Metadata Table for Supabase).**

## 1) Tujuan Parity Supabase

`dokumen_pegawai` menyimpan metadata dokumen pegawai dan lampiran proses, sebagai jembatan antara data domain pegawai dan object storage pada arsitektur Supabase.

Relasi inti:

```text
pegawai
  └── 1 : N -> dokumen_pegawai

master_jenis_dokumen
  └── 1 : N -> dokumen_pegawai

master_status_dokumen
  └── 1 : N -> dokumen_pegawai

users
  └── 1 : N -> dokumen_pegawai   (uploaded_by)
```

## 2) Struktur Kolom

Struktur parity minimum saat ini, konsisten dengan migration batch dokumen:

| Kolom | Tipe | Wajib | Catatan |
|---|---|---:|---|
| `dokumen_pegawai_id` | text | Ya | PK metadata dokumen. |
| `pegawai_id` | text | Ya | FK ke `pegawai`. |
| `jenis_dokumen_id` | text | Ya | FK ke `master_jenis_dokumen`. |
| `status_dokumen_id` | text | Tidak | FK ke `master_status_dokumen`. |
| `modul_sumber` | text | Tidak | Kode modul sumber dokumen (mis. PROFIL, USULAN, DISIPLIN). |
| `referensi_record_id` | text | Tidak | ID record modul sumber yang terkait. |
| `nomor_dokumen` | text | Tidak | Nomor dokumen administratif. |
| `nama_dokumen` | text | Ya | Nama file atau label dokumen. |
| `object_path` | text | Ya | Path objek pada Supabase Storage bucket. |
| `file_url` | text | Tidak | URL hasil generate (signed/public terkontrol) untuk konsumsi aplikasi. |
| `file_mime_type` | text | Tidak | MIME type file. |
| `file_size_bytes` | bigint | Ya | Ukuran file, default `0`, non-negatif. |
| `tanggal_dokumen` | date | Tidak | Tanggal dokumen diterbitkan. |
| `tanggal_mulai_berlaku` | date | Tidak | Awal masa berlaku dokumen. |
| `tanggal_akhir_berlaku` | date | Tidak | Akhir masa berlaku dokumen. |
| `uploaded_at` | timestamptz | Ya | Waktu upload metadata, default `now()`. |
| `uploaded_by` | text | Tidak | FK ke `users.user_id` dengan `on delete set null`. |
| `keterangan` | text | Tidak | Catatan tambahan. |
| `is_active` | boolean | Ya | Status aktif dokumen, default `true`. |
| `created_at` | timestamptz | Ya | Default `now()`. |
| `updated_at` | timestamptz | Ya | Default `now()`. |
| `created_by` | text | Tidak | Audit admin. |
| `updated_by` | text | Tidak | Audit admin. |

Catatan final terhadap source legacy:

- Linkage dokumen lintas modul dipatok dengan kolom `modul_sumber` dan `referensi_record_id`, divalidasi trigger whitelist per modul.
- `file_drive_id` tidak dibawa ke skema final; identitas storage difokuskan pada `object_path`.

## 3) Aturan Integritas

- FK:
  - `pegawai_id -> pegawai.pegawai_id` (`on delete restrict`)
  - `jenis_dokumen_id -> master_jenis_dokumen.jenis_dokumen_id` (`on delete restrict`)
  - `status_dokumen_id -> master_status_dokumen.status_dokumen_id` (`on delete restrict`)
  - `uploaded_by -> users.user_id` (`on delete set null`)
- Check penting:
  - kolom ID wajib tidak blank untuk field mandatory;
  - `object_path` tidak boleh kosong;
  - `file_size_bytes >= 0`;
  - `tanggal_akhir_berlaku >= tanggal_mulai_berlaku` bila keduanya terisi.
- Index penting:
  - `pegawai_id`, `jenis_dokumen_id`, `status_dokumen_id`, `uploaded_by`;
  - komposit (`pegawai_id`, `jenis_dokumen_id`);
  - komposit linkage (`modul_sumber`, `referensi_record_id`);
  - `tanggal_dokumen` untuk filter periode.

## 4) RLS dan Service Role Boundary

- `anon`: deny.
- `authenticated`: read terbatas pada dokumen dalam scope pegawai yang boleh diakses.
- upload metadata dan perubahan status dokumen dilakukan via service role path.

Guard minimal:

1. Browser client tidak menulis langsung ke tabel untuk metadata sensitif.
2. URL file sebaiknya berasal dari signed URL atau object path terkontrol, bukan public URL permanen tanpa policy.
3. Sinkronisasi antara baris `dokumen_pegawai` dan object di storage bucket wajib punya mekanisme cleanup dua arah.

Model penyimpanan file dipatok kombinasi `object_path` (sumber kebenaran storage) dan `file_url` (opsional cache/view layer).

---

## Rekomendasi Implementasi Lintas Chapter untuk Next.js + Supabase

1. **Pisahkan jalur read dan write.**
   Read master dan dokumen dari session `authenticated`; write hanya dari backend route handler yang memakai service role key.

2. **Jadikan `kode_*` sebagai contract aplikasi.**
   Frontend dan backend harus berbasis kode stabil (`kode_status_usulan`, `kode_aksi_approval`, dan seterusnya), bukan mengandalkan nama label yang bisa berubah.

3. **Standarkan seed idempotent lintas environment.**
   Seed wajib `upsert` by `kode_*` agar dev, staging, dan production tidak drift.

4. **Bangun helper SQL untuk pembacaan master aktif.**
   Buat view atau function terkontrol yang hanya menampilkan `is_active = true` untuk kebutuhan dropdown UI.

5. **Gunakan invalidation strategy untuk cache master.**
   Cache di Next.js harus punya pemicu invalidasi saat `updated_at` master berubah agar UI tidak stale.

6. **Tetapkan pola naming storage dokumen.**
   Gunakan path object deterministik, misalnya `pegawai/{pegawai_id}/{dokumen_pegawai_id}/{filename}`, supaya cleanup dan audit lebih mudah.

7. **Audit wajib pada operasi konfigurasi master.**
   Perubahan master group dan workflow group harus menghasilkan log audit agar perubahan nomenklatur dapat ditelusuri.

8. **Siapkan checker konsistensi dokumen-storage.**
   Buat job berkala untuk menemukan baris dokumen tanpa object file, atau object file tanpa metadata baris.

9. **Batch policy rollout.**
   Rollout policy dilakukan bertahap per tabel dengan test akses role-per-role sebelum dipromosikan lintas environment.

10. **Lindungi evolusi skema lewat feature flag backend.**
    Perubahan kontrak modul (mis. linkage dokumen lintas domain) tetap digate agar rollout aman dan backward-compatible.

---

## Ringkasan Keputusan Final di PART 4

1. Policy RLS master groups (S dan T) dipatok read-only untuk authenticated dan write terbatas service-role/admin RPC.
2. Model transisi workflow dipatok ke tabel transisi khusus (`workflow_transition`).
3. Linkage dokumen lintas modul dipatok lewat `modul_sumber` + `referensi_record_id` dengan trigger whitelist.
4. Metadata storage file dipatok kombinasi `object_path` + `file_url` opsional.
