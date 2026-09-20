# Alur Sistem & Panduan Pengguna — Task Reminder

Dokumen ini menjelaskan **untuk apa aplikasi ini**, **bagaimana sistem berjalan**, dan **urutan pemakaian yang benar** agar pengguna baru tidak bingung.

> **Bahasa:** seluruh antarmuka, pesan notifikasi (email/Telegram), dan pesan dari API memakai **Bahasa Indonesia**. Tanggal dan nama hari juga ditampilkan dalam format Indonesia.

---

## 1. Aplikasi ini untuk apa?

Task Reminder adalah **aplikasi pengingat tugas kuliah**. Tujuan utamanya: mahasiswa tidak lagi lupa deadline tugas, dan bisa memantau nilai/IPK sekaligus.

| Kebutuhan mahasiswa | Disediakan oleh fitur |
|---|---|
| "Kapan tenggat tugas ini?" | Beranda → Tugas (kalender + status) |
| "Apa saja jadwal kuliah saya minggu ini?" | Jadwal |
| "Mata kuliah apa saja yang saya ambil?" | Mata Kuliah |
| "Berapa nilai & IPK saya?" | Penilaian + Nilai |
| "Ingatkan saya sebelum tenggat" | Notifikasi Email / Telegram |
| "Masih ada tugas apa yang belum selesai?" | Statistik & Diagram Batang di Beranda |

**Catatan penting:** aplikasi ini **tidak punya role/admin**. Setiap user adalah pengguna biasa dan hanya melihat data miliknya sendiri (`user_id`). Jadi `admin@admin.com` di data contoh hanyalah nama, bukan akun administrator.

---

## 2. Bagaimana sistem berjalan (arsitektur)

Aplikasi terdiri dari dua proses terpisah yang **harus jalan bersamaan**:

```mermaid
flowchart LR
    U([Pengguna]) -->|buka browser| UI["Port 5173<br/>React SPA<br/>(tampilan)"]
    UI -->|"request JSON /api/*"| API["Port 8000<br/>Laravel API<br/>(otak + gudang)"]
    API --> DB[(MySQL)]
    API --> Q[["Queue Worker<br/>(proses latar)"]]
    Q -->|email| MAIL[/Email/]
    Q -->|telegram| TG[/Telegram Bot/]
    API -->|"bridge Python"| SIAK[/Siakang/]
```

- **Port 5173** = etalase. Hanya menampilkan halaman, tidak menyimpan data.
- **Port 8000** = gudang + kasir. Menyimpan data, cek password, kirim notifikasi, ambil data Siakang.
- **Queue worker** = pekerja latar untuk mengirim email/Telegram.

> Pengguna **tidak perlu membuka port 8000 di browser**. Cukup buka `http://localhost:5173`, tetapi port 8000 tidak boleh dimatikan.

---

## 3. Alur pemakaian pertama kali

```mermaid
flowchart TD
    A([Mulai]) --> B[Buka localhost:5173]
    B --> C{Sudah punya akun?}
    C -->|belum| D[Register: nama + email + password]
    D --> E[Cek inbox email → klik link verifikasi]
    E --> F[Login]
    C -->|sudah| F
    F --> G[Pilih semester di Header<br/>misal: Semester 1]
    G --> H[Isi Mata Kuliah<br/>manual / Excel / Sinkron dari Siakang]
    H --> I[Isi jadwal<br/>otomatis dari Mata Kuliah]
    I --> J[Tambah Tugas di Beranda]
    J --> K[Atur notifikasi di Pengaturan]
    K --> L([Aplikasi siap dipakai])
```

**Urutan yang disarankan (penting):**

1. **Register → verifikasi email → login.** Tanpa verifikasi, halaman lain akan memantulkan kembali ke halaman verifikasi.
2. **Pilih semester** di bagian header (Semester 1–8). Pilihan ini tersimpan dan dipakai oleh semua halaman.
3. **Isi Mata Kuliah dahulu.** Ini fondasi aplikasi — Tugas, Jadwal, dan Penilaian bergantung pada Mata Kuliah.
4. **Baru tambah Tugas**, karena setiap tugas harus dipilihkan mata kuliahnya.
5. **Atur notifikasi** di Pengaturan (email, Telegram, atau keduanya).

---

## 4. Alur per fitur

### 4.1 Beranda & Tugas

```mermaid
flowchart TD
    A[Buka Beranda] --> B[Pilih tanggal di kalender]
    B --> C[Klik Tugas Baru]
    C --> D[Isi: Semester, Mata Kuliah,<br/>Nama Tugas, Tenggat, Prioritas]
    D --> E[Simpan]
    E --> F["Notifikasi 'tugas dibuat' terkirim (jika aktif)"]
    F --> G{Tugas selesai?}
    G -->|selesai| H[Ubah status → Selesai]
    G -->|belum| I[Biarkan Belum Selesai]
    H --> J["Notifikasi 'tugas selesai' terkirim (jika aktif)"]
    I --> K[Reminder otomatis H-N tenggat<br/>atau saat Prioritas aktif]
```

Tab di Beranda:

| Tab | Isi |
|---|---|
| **Daftar Tugas** | Statistik, kalender bulanan, tabel tugas per tanggal |
| **Diagram Batang** | Grafik distribusi tugas |
| **Ringkasan Semester** | Ringkasan per semester |

**Prioritas** = tanda tugas penting. Tugas berprioritas akan ikut dikirim di reminder harian, bahkan jika tenggat-nya masih jauh.

**Klik badge tugas di kalender** untuk membuka detail tugas: nama mata kuliah, semester, tenggat lengkap, status, dan deskripsi. Badge menampilkan nama tugas (bukan hanya kode mata kuliah).

### 4.2 Mata Kuliah

```mermaid
flowchart LR
    A[Buka Mata Kuliah] --> B{Cara isi?}
    B -->|manual| C[Mata Kuliah Baru]
    B -->|dari file| D[Menu ⋯ → Excel Import]
    B -->|dari kampus| E[Sinkron dari Siakang]
    C --> F[(Tersimpan)]
    D --> F
    E --> F
    F --> G[Jadwal mingguan otomatis terbentuk]
    F --> H[Siap dinilai di Penilaian]
```

- **Sinkron dari Siakang hanya bisa untuk semester kosong.** Jika sudah ada isinya, gunakan **Bersihkan Semester** dahulu (menghapus Mata Kuliah + Tugas + nilai di semester itu).
- **Bersihkan Semester** bersifat permanen dan tidak bisa dibatalkan.

### 4.3 Jadwal

Menampilkan jadwal kuliah mingguan dari data Mata Kuliah (hari + jam). Tidak ada input di halaman ini — jadwal berasal dari Mata Kuliah, baik manual, Excel, maupun Sinkron dari Siakang.

**Klik blok mata kuliah** (mis. Basic Networking hari Senin) untuk membuka detail: kode, dosen, SKS, jam, dan **daftar seluruh tugas mata kuliah itu** beserta tenggat, status, dan deskripsinya. Jumlah tugas juga tampil di blok jadwal.

### 4.4 Penilaian & Nilai

```mermaid
flowchart TD
    A[Pastikan Mata Kuliah sudah terisi] --> B[Buka Penilaian]
    B --> C[Isi nilai tiap mata kuliah]
    C --> D["IPK semester & kumulatif otomatis dihitung"]
    B --> E[Sinkron dari Siakang → ambil nilai dari kampus]
    E --> D
    D --> F[Atur skala nilai di<br/>Pengaturan → Nilai bila perlu]
```

### 4.5 Pengaturan & Notifikasi

```mermaid
flowchart TD
    A[Buka Pengaturan] --> B[Tentukan channel:<br/>Email / Telegram / Keduanya]
    B --> C{Channel Telegram?}
    C -->|ya| D[Isi Telegram Chat ID]
    C -->|tidak| E[Lewati]
    D --> F[Tombol Kirim Notifikasi Uji<br/>untuk memastikan terkirim]
    E --> F
    F --> G[Atur H-N pengingat<br/>misal: 5 hari lagi]
    G --> H[Toggle notifikasi<br/>tugas dibuat / tugas selesai]
```

Tab **Pengaturan**:

| Tab | Fungsi |
|---|---|
| **Notifikasi** | Channel (email/Telegram/Keduanya), H-N pengingat, toggle tugas dibuat/selesai, tombol tes |
| **Siakang** | Simpan email & password Siakang (terenkripsi) + tombol tes koneksi |
| **Nilai** | Skala nilai kustom (misal A = 85–100) |
| **Profil** | Ubah nama/email/password. Ganti email → wajib verifikasi ulang |

> **Kirim Notifikasi Uji** bersifat instan (langsung tampil sukses/gagal). Notifikasi biasa masuk antrean, jadi **queue worker harus jalan** (`php artisan queue:listen`).

**Isi pesan Telegram** — reminder tenggat, tugas dibuat, dan tugas selesai semuanya memuat nama mata kuliah, nama tugas, serta **deskripsi tugas** (otomatis dipotong jika terlalu panjang). Deskripsi kosong tidak menampilkan barisnya.

### 4.6 Alur Sinkron Siakang

```mermaid
flowchart TD
    A[Pengaturan → Siakang] --> B[Simpan email + password]
    B --> C[Validasi & simpan terenkripsi]
    C --> D{Mau sinkron apa?}
    D -->|jadwal/kelas| E[Mata Kuliah → Sinkron dari Siakang<br/>syarat: semester kosong]
    D -->|nilai| F[Penilaian → Sinkron dari Siakang]
    E --> G[Dipetakan ke semester<br/>yang sedang dibuka di aplikasi]
    F --> G
    G --> H[Import selesai,<br/>data siap dilihat]
```

---

## 5. Peta halaman

| Halaman | URL | Akses |
|---|---|---|
| Login | `/auth/login` | Publik |
| Register | `/auth/register` | Publik |
| Lupa Password | `/auth/forgot-password` | Publik |
| Verifikasi Email | `/auth/verify-email` | Setelah register |
| Beranda | `/dashboard` | Perlu login |
| Mata Kuliah | `/course-contents` | Perlu login |
| Jadwal | `/schedule` | Perlu login |
| Penilaian | `/assessments` | Perlu login |
| Pengaturan | `/settings` | Perlu login |

---

## 6. Jika terjadi masalah

| Gejala | Kemungkinan penyebab | Solusi |
|---|---|---|
| Data tidak muncul / "Network Error" | Port 8000 mati | `cd server && composer run dev` |
| Halaman hanya menampilkan `Menyala abangkuh` | Membuka port 8000, bukan 5173 | Buka `http://localhost:5173` |
| Login gagal, halaman balik ke verifikasi | Email belum diverifikasi | Cek inbox & klik link verifikasi |
| Notifikasi email/Telegram tidak terkirim | Queue worker mati | `cd server && php artisan queue:listen --tries=1` |
| Tombol "Sinkron dari Siakang" mati | Semester belum kosong | Bersihkan Semester dahulu (permanen!) |
| Ingin memastikan reminder berjalan tanpa menunggu | — | `cd server && php artisan notifications:reminder` |

> **Catatan teknis:** perintah `notifications:reminder` saat ini belum terpasang di scheduler (`server/routes/console.php`). Untuk pengiriman otomatis harian, tambahkan penjadwalannya, atau jalankan manual seperti di atas.
