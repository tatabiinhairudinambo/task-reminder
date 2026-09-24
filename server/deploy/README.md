# Deploy ke Oracle Cloud Free + Cloudflare Tunnel

Panduan ini men-deploy Task Reminder ke **satu domain** (`task.attaambo.dev`),
semua dijalankan di **satu VM Oracle Cloud Always Free**.

```
Browser -> https://task.attaambo.dev -> Cloudflare
                                            |
                                            v
                                   cloudflared tunnel
                                            |
                                            v
                          Oracle VM: FrankenPHP/Octane :8000
                             - /api/*   -> Laravel API
                             - lainnya  -> React SPA
                                            |
                             +--------------+--------------+
                             |              |              |
                        queue worker   scheduler      Supabase
                       (notifikasi)   (07:00 WIB)    (database)
```

Semua fitur tetap jalan: notifikasi Telegram, reminder harian, sinkron
Siakang, import Excel, dan autentikasi — tanpa mengubah logika aplikasi.

---

## 0. Prasyarat

| Hal | Keterangan |
|---|---|
| Domain | `attaambo.dev` sudah aktif di Cloudflare (NS mengarah ke Cloudflare) |
| VM | Oracle Cloud Always Free, ARM Ampere A1, Ubuntu 22.04 / 24.04 |
| Kartu kredit | Diperlukan Oracle saat daftar (tidak ditagih untuk Always Free) |
| Supabase | Sudah jalan; kredensial pooler ada di `server/.env` |

> **Penting — kapasitas ARM.** Oracle sering menolak "Out of capacity" untuk
> Ampere A1 di region populer. Kalau itu terjadi, coba ganti region atau
> coba lagi beberapa hari kemudian. Hindari membuat VM x86 (selalu bayar).

### Buka port di Oracle

Hanya SSH yang perlu terbuka — Cloudflare Tunnel membuat koneksi **keluar**,
jadi port 80/443 tidak perlu dibuka.

1. Oracle Console -> VM -> **Subnet** -> Security List
2. Pastikan ingress `22` (SSH) dari IP Anda diizinkan
3. Tidak perlu menambah aturan ingress lain

---

## 1. Setup VM

SSH ke VM, lalu pilih **salah satu** cara memindahkan project.

> Repo GitHub-nya **private**, jadi `git clone` polos akan gagal dengan
> `Repository not found` (GitHub menanyakan kredensial). Pilih cara di bawah.

### Cara A - upload dari komputer Anda (paling sederhana)

Jalankan dari komputer Anda (bukan di VM). Skrip ini mengirim project dan
**hanya** yang dibutuhkan - `node_modules`, `vendor`, `.git`, log storage, dan
`.env` tidak ikut:

```bash
# dari root project, ganti <vm-ip> dengan IP publik VM Anda
bash server/deploy/upload-to-server.sh ubuntu@<vm-ip>
```

**Windows (PowerShell)** - tanpa perlu Git Bash:

```powershell
.\server\deploy\upload-to-server.ps1 -Target ubuntu@<vm-ip>
```

Lalu di VM:

```bash
cd ~/task-reminder
sudo bash server/deploy/setup-oracle.sh
```

### Cara B - clone dengan token GitHub

Buat token di GitHub -> **Settings** -> **Developer settings** ->
**Personal access tokens** -> **Fine-grained tokens**, beri akses
**Read** hanya untuk repo `task-reminder`. Lalu di VM:

```bash
git clone https://<TOKEN>@github.com/tatabiinhairudinambo/task-reminder.git ~/task-reminder
cd ~/task-reminder
sudo bash server/deploy/setup-oracle.sh
```

Cabut token itu setelah selesai (GitHub -> token -> **Revoke**).

### Cara C - buat repo publik sementara

Ubah repo jadi **Public** di GitHub -> Settings -> General -> Danger Zone.
Clone seperti biasa, lalu kembalikan ke **Private**:

```bash
git clone https://github.com/tatabiinhairudinambo/task-reminder.git ~/task-reminder
cd ~/task-reminder
sudo bash server/deploy/setup-oracle.sh
```

Script setup memasang: PHP 8.3 + ekstensi (pdo_pgsql, intl, gd, zip, mbstring),
Composer, Node.js 20, `uv` + Python (bridge Siakang), binary FrankenPHP, dan
`cloudflared`.

> Binary FrankenPHP sudah membawa semua ekstensi yang dibutuhkan aplikasi
> (termasuk `pdo_pgsql` untuk Supabase dan `zip`/`gd` untuk import Excel),
> jadi API tidak bergantung pada PHP sistem.

---

## 2. Konfigurasi environment

```bash
cd ~/task-reminder/server
cp deploy/.env.production.example .env
php artisan key:generate
```

Edit `.env` dan isi bagian yang bertanda kosong:

| Variabel | Isi |
|---|---|
| `DB_PASSWORD` | password Supabase (sama seperti `.env` lokal) |
| `DB_USERNAME` | user pooler Supabase (`postgres.xxxx`) |
| `TELEGRAM_BOT_TOKEN` | token bot Telegram |
| `MAIL_*` | kredensial SMTP (kalau notifikasi email dipakai) |

Nilai `APP_URL` dan `FRONTEND_URL` **sudah** diisi `https://task.attaambo.dev`.
Jangan diganti — link verifikasi email dan reset password memakai keduanya.

> `APP_KEY` berbeda dengan yang di lokal itu **tidak masalah** untuk data di
> Supabase, **kecuali** kredensial Siakang yang tersimpan (`siakang_email` /
> `siakang_password` dienkripsi dengan `APP_KEY`). Kalau `APP_KEY` berubah,
> user perlu mengisi ulang kredensial Siakang di Pengaturan. Untuk
> menghindarinya, salin `APP_KEY` dari `.env` lokal ke `.env` server.

Install dependensi:

```bash
composer install --no-dev --optimize-autoloader
(cd siakang-sync && uv sync)
```

---

## 3. Deploy aplikasi

```bash
cd ~/task-reminder/server
bash deploy/deploy.sh
```

Perintah ini: build SPA -> salin ke `server/public/` -> install dependensi ->
migrate -> rebuild cache -> restart service.

---

## 4. Pasang systemd service

```bash
sudo bash deploy/install-services.sh
```

Tiga service yang dipasang dan otomatis start saat VM boot:

| Service | Fungsi |
|---|---|
| `task-reminder-octane` | HTTP server (API + SPA) |
| `task-reminder-queue` | Pengiriman notifikasi email/Telegram |
| `task-reminder-scheduler` | Reminder harian 07:00 WIB |

Cek status:

```bash
systemctl status task-reminder-octane task-reminder-queue task-reminder-scheduler
```

---

## 5. Cloudflare Tunnel

```bash
cloudflared tunnel login          # buka URL di browser, pilih attaambo.dev
cloudflared tunnel create task-reminder
```

Perintah kedua akan menampilkan **UUID tunnel**. Lalu:

```bash
cloudflared tunnel route dns task-reminder task.attaambo.dev
```

Salin konfigurasi:

```bash
sudo mkdir -p /root/.cloudflared
sudo cp ~/task-reminder/server/deploy/cloudflared.yml.example /root/.cloudflared/config.yml
sudo nano /root/.cloudflared/config.yml   # ganti <TUNNEL-UUID> dengan UUID Anda
sudo cp ~/.cloudflared/<TUNNEL-UUID>.json /root/.cloudflared/
```

Pasang sebagai service:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

> Kalau `cloudflared service install` menolak, jalankan manual sebagai
> service systemd dengan `cloudflared tunnel run task-reminder`.

---

## 6. Verifikasi

```bash
# API hidup?
curl -s https://task.attaambo.dev/up
curl -s -H "Accept: application/json" https://task.attaambo.dev/api/auth/check/token
# -> {"message":"Unauthenticated."}  (401 = routing benar)

# SPA termuat?
curl -s https://task.attaambo.dev/ | head -5

# Notifikasi jalan? (jalankan manual, bypass jadwal)
cd ~/task-reminder/server && php artisan notifications:reminder
```

Buka `https://task.attaambo.dev` di browser, login, dan cek aplikasi.

---

## 7. Update aplikasi di kemudian hari

```bash
cd ~/task-reminder
git pull
cd server
bash deploy/deploy.sh
```

---

## Perintah harian

```bash
# Log
sudo journalctl -u task-reminder-octane -f
sudo journalctl -u task-reminder-queue -f
sudo journalctl -u task-reminder-scheduler -f

# Tes reminder manual (tidak menunggu 07:00)
cd ~/task-reminder/server && php artisan notifications:reminder

# Restart
sudo systemctl restart task-reminder-octane task-reminder-queue task-reminder-scheduler

# Cek scheduler terdaftar
cd ~/task-reminder/server && php artisan schedule:list
```

---

## Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Halaman 502 dari Cloudflare | Octane mati | `sudo journalctl -u task-reminder-octane -n 50` |
| Refresh di `/dashboard` -> 404 | SPA belum di-build | `bash deploy/deploy.sh` |
| Login sukses tapi link email salah | `APP_URL` belum domain | Perbaiki `.env`, lalu `php artisan config:cache` |
| Notifikasi tidak terkirim | Queue worker mati | `sudo systemctl status task-reminder-queue` |
| Reminder 07:00 tidak jalan | Scheduler mati | `sudo systemctl status task-reminder-scheduler` |
| Sinkron Siakang gagal | `uv` tidak ketemu | Set `SIAKANG_UV` di `.env`, lihat `journalctl` |
| "Out of capacity" saat buat VM | Kapasitas ARM penuh | Ganti region atau coba lagi nanti |
| Import Excel gagal | ekstensi zip/gd hilang | Pakai binary FrankenPHP dari script setup |

---

## Catatan teknis

- **Satu domain, tanpa CORS.** SPA dan API berasal dari origin yang sama,
  jadi tidak ada preflight request dan tidak perlu `config/cors.php`.
- **Sertifikat SSL.** Cloudflare menangani TLS; VM hanya bicara HTTP ke
  `127.0.0.1:8000`. Karena itu `trustProxies` di `bootstrap/app.php` penting:
  tanpa itu Laravel mengira request datang lewat `http://` dan link di email
  jadi salah.
- **Notifikasi tidak bergantung pada kunjungan user.** Queue worker dan
  scheduler jalan sebagai service terpisah, jadi reminder 07:00 tetap
  terkirim walau tidak ada yang membuka aplikasi.
- **Telegram keluar, bukan masuk.** Server menghubungi `api.telegram.org`,
  jadi tidak perlu membuka port apa pun untuk notifikasi.
