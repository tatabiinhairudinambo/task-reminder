# Panduan Pindah Database ke Supabase

Aplikasi ini bisa memakai **Supabase (PostgreSQL)** sebagai database. Semua kode sudah kompatibel dengan PostgreSQL — tidak perlu ubah kode lagi, cukup konfigurasi.

## 1. Buat Proyek di Supabase

1. Buka [supabase.com](https://supabase.com) → **New Project**
2. Isi nama, password database (catat!), dan region terdekat
3. Tunggu sampai proyek selesai dibuat

## 2. Ambil Kredensial Koneksi

Di dashboard Supabase → **Project Settings** → **Database** → **Connection string** → tab **Session pooler**.

Formatnya:

```
postgresql://postgres.xxxxxxxx:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:5432/postgres
```

| Bagian | Masuk ke `.env` |
|---|---|
| Host (`aws-0-region.pooler.supabase.com`) | `DB_HOST` |
| Port (`5432` untuk session pooler) | `DB_PORT` |
| Database (`postgres`) | `DB_DATABASE` |
| User (`postgres.xxxxxxxx`) | `DB_USERNAME` |
| Password | `DB_PASSWORD` |

> **Penting:** gunakan **Session Pooler** (port `5432`), bukan Direct Connection. Aplikasi ini memakai Octane + queue worker yang membuka banyak koneksi — direct connection cepat menghabiskan kuota koneksi Supabase.

## 3. Ubah `server/.env`

```dotenv
DB_CONNECTION=pgsql
DB_HOST=aws-0-region.pooler.supabase.com
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres.xxxxxxxx
DB_PASSWORD=password-database-anda
DB_SSLMODE=require
APP_TIMEZONE=Asia/Jakarta
```

Catatan:

- `DB_SSLMODE=require` **wajib** untuk Supabase (koneksi dienkripsi). Variable ini dibaca dari `config/database.php`.
- `APP_TIMEZONE=Asia/Jakarta` penting agar label tenggat benar. Server default `UTC`; jika user berada di WIB (UTC+7), tugas yang jatuh tempo **hari ini** akan salah dilabeli "1 hari lagi" pada dini hari (00:00–07:00 WIB).
- **Jangan ubah `APP_KEY`.** Kredensial Siakang (`siakang_email` / `siakang_password`) dienkripsi dengan `APP_KEY`. Kalau `APP_KEY` berubah, kredensial itu tidak bisa dibaca lagi dan user harus mengisi ulang.

## 4. Buat Tabel

```bash
cd server
php artisan config:clear
php artisan migrate --force
```

## 5. Isi Data Awal (opsional)

```bash
php artisan db:seed --force
```

Atau biarkan kosong dan isi manual / Sync Siakang dari halaman Mata Kuliah.

## 6. Verifikasi

```bash
# Cek koneksi + tabel
php artisan migrate:status

# Cek API berjalan normal
php artisan serve
```

Login dengan akun yang ada, lalu buka Beranda — angka Total/Selesai/Belum Selesai harus muncul.

## Pindah Data dari MySQL yang Sudah Ada

Kalau ingin membawa data lama (user, mata kuliah, tugas, nilai), ekspor dari MySQL lalu impor ke PostgreSQL:

```bash
# 1. Ekspor dari MySQL
mysqldump -u root server > backup-mysql.sql

# 2. Impor ke PostgreSQL (butuh pgloader atau konversi manual)
#    Alternatif paling praktis: ekspor per tabel sebagai CSV lalu COPY
```

Cara termudah: pakai **pgloader** (mendukung konversi MySQL → PostgreSQL otomatis):

```bash
pgloader mysql://root@127.0.0.1/server postgresql://postgres.xxx:pass@aws-0-region.pooler.supabase.com:5432/postgres
```

Tabel yang perlu dibawa: `users`, `course_contents`, `tasks`, `settings`, `grades`. Tabel `cache`, `sessions`, `jobs`, `migrations` tidak perlu (dibuat ulang otomatis).

> Kalau memakai `migrate:fresh --seed`, **semua data lama akan terhapus**.

## Untuk Testing

`server/phpunit.xml` sudah dikonfigurasi untuk PostgreSQL/Supabase (`task_reminder_pg_test`); host dan kredensial diwarisi dari `server/.env`. Buat database test-nya sekali:

```bash
cd server
php artisan tinker --execute="DB::statement('CREATE DATABASE task_reminder_pg_test')"
php artisan test
```

Untuk menjalankan tes terhadap MySQL, timpa lewat environment variable:

```bash
cd server
DB_CONNECTION=mysql DB_DATABASE=task_reminder_test php artisan test
```

## Perbedaan Perilaku MySQL vs PostgreSQL

Hal-hal yang perlu diketahui setelah pindah:

| Aspek | MySQL | PostgreSQL | Ditangani? |
|---|---|---|---|
| Kolom `boolean` (`status`, `priority`) | `0` / `1` | `true` / `false` | Ya — di-cast ke integer di `Task` & `Setting` sehingga API tetap mengirim `0`/`1` |
| `sum(status = 1)` | Berfungsi | Error | Ya — diubah ke `case when` portabel di `DashboardService` |
| Nama alias huruf besar | Dipertahankan | Jadi huruf kecil | Ya — alias memakai `snake_case` |
| `->after()` di migrasi | Berfungsi | Diabaikan (aman) | Ya — Laravel mengabaikannya |
| `CASE LOWER(day)` / `CASE grade` | Berfungsi | Berfungsi | Ya — kompatibel keduanya |
| Token Sanctum | Coercion diam-diam | Error cast | Ya — memakai `PersonalAccessToken::findToken()` |

## Catatan Keamanan

- Jangan commit `server/.env` (sudah masuk `.gitignore`).
- Password database Supabase bersifat sensitif — perlakukan seperti `APP_KEY`.
- Jika password bocor, reset di **Project Settings → Database → Reset database password**.
