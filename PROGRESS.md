# Progres — Pasaran

Catatan status project agar bisa dilanjutkan kapan saja tanpa membaca ulang percakapan.
Terakhir diperbarui: **11 November 2026**.

## Status sekarang

**Milestone M2 selesai — 55%.** Contract, contoh pemakai, dan UI lengkap; alur lapor sampai harga terkonfirmasi teruji di chain lokal. Belum ada yang di-deploy ke jaringan publik.

Pekerjaan dijeda di sini karena langkah berikutnya menunggu repo dan wallet deployer dari pemilik project.

| Tahap | Isi | Progres | Status |
|---|---|---|---|
| M0 | PRD | 5% | Selesai |
| M1 | Smart contract + contoh pemakai + test | 25% | Selesai |
| M2 | UI/UX lengkap, alur lapor di chain lokal | 55% | Selesai |
| M3 | Deploy testnet (968) + uji dengan tiga wallet sungguhan | 70% | **Berikutnya** |
| M4 | Deploy mainnet (677) + verifikasi source | 85% | Belum |
| M5 | Vercel produksi, harga awal nyata, pengumuman X, audit checklist | 100% | Belum |

## Yang sudah jadi

### Dokumen
- [PRD.md](PRD.md) versi 1.1 — scope, metode median, spesifikasi contract, biaya terukur.
- [README.md](README.md) — cara menjalankan, deploy, setting Vercel, dan 12 screenshot (desktop, 768 px, 375 px) di `docs/screenshots/`.

### Smart contract (`contracts/`)
- `contracts/Pasaran.sol` — Solidity 0.8.24, target EVM `paris`, optimizer 200 runs, tanpa dependensi, tanpa fungsi payable. Bytecode 13.814 byte.
- `contracts/examples/PriceReader.sol` — contoh contract pemakai: menolak harga yang belum terkonfirmasi atau terlalu tua, dan menghitung harga keranjang belanja.
- `test/Pasaran.test.js` — **31 test lulus**, termasuk pemeriksaan median terhadap 80 laporan acak.
- `scripts/catalog.js` — 12 komoditas awal dengan rentang wajar (perkiraan saya, perlu ditinjau).
- `scripts/deploy.js` — deploy, menambah katalog, lalu menulis alamat ke `deployments/<network>.json` dan `web/src/config/deployments.json`.
- `scripts/seed.js` — 580 laporan contoh di 6 kota selama 9 sepasar; hanya mau jalan di chain lokal.
- `scripts/export-abi.js` — menulis ABI ke `web/src/config/abi.ts`.

Aturan yang ditegakkan contract: satu wallet satu suara per komoditas–kota, jendela 14 hari, maksimal 15 pelapor terbaru, jeda 20 jam, terkonfirmasi pada 3 pelapor, rentang harga wajar, kode wilayah valid, riwayat per sepasar, pemilik hanya bisa mengatur katalog dan menyembunyikan nama pasar.

### Frontend (`web/`)
Vite + React + TypeScript + viem. Delapan halaman dan satu dialog:

| Rute | Halaman | File |
|---|---|---|
| `#/`, `#/city/:kode` | Papan harga satu kota | `src/pages/Board.tsx` |
| `#/price/:item/:kode` | Detail harga, grafik per sepasar, laporan terbaru | `src/pages/PricePage.tsx` |
| `#/report` | Lapor harga | `src/pages/ReportPage.tsx` |
| `#/compare/:item` | Banding antar-kota | `src/pages/Compare.tsx` |
| `#/reporters` | Papan pelapor | `src/pages/Reporters.tsx` |
| `#/me` | Laporan saya | `src/pages/Me.tsx` |
| `#/builders` | Panduan pengembang | `src/pages/Builders.tsx` |
| `#/about` | Cara kerja dan batasan | `src/pages/About.tsx` |
| — | Dialog wallet | `src/components/WalletDialog.tsx` |

- Desain lapak pasar: bilah biru dengan tenda bergaris biru-putih, label harga putih berangka tebal (Archivo), tombol oranye bertepi tinta.
- Naik-turun harga ditandai ▲/▼ dan persen, tidak hanya warna. Status ditulis sebagai teks.
- Tabel di layar lebar, tumpukan label harga di layar sempit; tombol "Report a price" menempel di bawah layar ponsel.
- Footer memuat "Built on BOT Chain" dengan tautan `https://botchain.ai` dan `https://scan.botchain.ai`, plus alamat contract.
- Usia data dihitung terhadap jam chain, bukan jam perangkat.
- Data dibaca lewat fungsi view, bukan event, karena RPC mainnet mematikan `eth_getLogs`.

## Yang sudah diverifikasi

Semua dijalankan pada 11 November 2026.

| Pemeriksaan | Hasil |
|---|---|
| `npm test` di `contracts/` | 31 lulus |
| `npm run typecheck` di `web/` | Lulus |
| `npm run build` di `web/` | Lulus |
| Kode wallet dev di bundle produksi | Tidak ada |
| Lapor harga ketiga untuk daging sapi di Bandung | Status berubah dari Provisional menjadi Confirmed, acuan Rp 139.500 |
| Harga dengan kelebihan satu nol | Ditolak di form, fokus kembali ke isian, rentang ditampilkan |
| Harga 45% di atas acuan | Muncul konfirmasi "Is that the price you saw?" |
| Lapor ulang dalam 20 jam | Catatan waktu boleh lagi muncul, tombol kirim nonaktif |
| Laporan yang digantikan atau kedaluwarsa | Ditandai "Not counted" |
| Papan, detail, banding, pelapor, laporan saya, pengembang, about, 404 | Tampil tanpa error konsol (dicek di tab baru) |
| Viewport 375 px, 768 px, 1440 px | Tanpa scroll horizontal |
| Grafik harga di layar 375 px | Label sumbu terbaca (grafik digambar selebar layarnya; diperbaiki setelah screenshot menunjukkan label terlalu kecil) |
| Keyboard: skip link, menu, label harga, form | Urutan benar, cincin fokus terlihat di latar terang dan biru |
| Build produksi tanpa alamat mainnet | Menampilkan pemberitahuan "belum di-deploy" |
| Kontras warna | 25 dari 26 pasangan lulus WCAG AA; tepi tombol oranye (2,4:1) diselesaikan dengan garis tinta |

### Biaya gas terukur (20 gwei)

| Aksi | Gas | BOT |
|---|---|---|
| Deploy | 3.061.977 | 0,061 |
| Katalog awal (12 komoditas) | 1.248.540 | 0,025 |
| Laporan pertama untuk satu komoditas–kota | 440.813 | 0,0088 |
| Pelapor baru | 288.130 | 0,0058 |
| Pelapor lama memperbarui | 201.065 | 0,0040 |

## Yang belum dikerjakan

### M3 — Testnet
- [ ] **Kamu:** setup repo git dari folder `pasaran/` dan hubungkan ke Vercel (Root Directory `web`).
- [ ] **Kamu:** siapkan wallet deployer, ambil BOT testnet di `https://faucet.botchain.ai/basic`.
- [ ] **Kamu:** salin `contracts/.env.example` menjadi `.env`, isi `PRIVATE_KEY`.
- [ ] **Kamu:** jalankan `npm run deploy:testnet` di `contracts/`.
- [ ] **Saya:** uji dengan MetaMask atau BO Wallet sungguhan di testnet (`VITE_CHAIN=testnet`).
- [ ] **Saya:** cari tahu cara verifikasi source di explorer BOT Chain.

### Sebelum mainnet
- [ ] **Kamu:** izinkan saya mengunduh daftar resmi kode kabupaten/kota (± 514 wilayah) untuk menggantikan daftar 60 wilayah buatan tangan.
- [ ] **Kamu:** tinjau rentang harga wajar di `contracts/scripts/catalog.js`.
- [ ] **Kamu:** putuskan apakah katalog dipangkas menjadi 6–8 komoditas untuk peluncuran (PRD bagian 19).

### M4 — Mainnet
- [ ] **Kamu:** buat group project. **Wajib sebelum deploy mainnet.**
- [ ] **Kamu:** isi BOT mainnet (± 0,1 BOT cukup untuk deploy dan katalog).
- [ ] **Kamu:** jalankan `npm run deploy:mainnet`, lalu commit `deployments/botchain.json` dan `web/src/config/deployments.json`.
- [ ] **Saya:** verifikasi source contract di `scan.botchain.ai`.

### M5 — Peluncuran
- [ ] **Kamu:** buat akun X Pasaran; isi URL-nya di `web/src/config/site.ts` (`xUrl`).
- [ ] **Saya:** draft minimal 5 post, termasuk pengumuman dengan kalimat "Officially launched on BOT Chain Mainnet."
- [ ] **Kamu:** publikasikan post.
- [ ] **Kamu:** laporkan harga nyata dari pasar atau struk belanja, dan ajak 2–3 orang melaporkan komoditas yang sama di kota yang sama (memenuhi 3 wallet dan 5 transaksi).
- [ ] **Saya:** gambar Open Graph untuk pratinjau tautan.
- [ ] **Saya:** audit akhir terhadap checklist eligibility di dokumen program.

## Hal yang diketahui dan belum ditangani

- **Wallet sungguhan belum diuji.** Alur lapor diuji lewat akun node Hardhat, bukan ekstensi wallet.
- **Tampilan error RPC belum diuji** (pesan dan tombol "Try again" ada di kode, tetapi node lokal tidak dimatikan untuk mengujinya).
- **Pesan error `TooSoon` dari contract belum terlihat di UI**, karena form sudah mencegah pengiriman sebelum jeda habis.
- **Daftar wilayah baru 60 kabupaten/kota**, ditulis tangan; kodenya perlu dicocokkan dengan daftar resmi.
- **Rentang harga wajar adalah perkiraan saya**, bukan data harga resmi.
- **Linter menyisakan 5 peringatan**, tanpa error (`only-export-components` tiga kali, `set-state-in-effect` dua kali di kode wallet bersama).
- **Bundle JS 610 kB (183 kB gzip)**, sebagian besar dari viem.
- **Nama hari pasaran (Legi, Pahing, …) tidak ditampilkan**; sepasar dihitung sebagai periode 5 hari sejak 1 Januari 1970.

## Keputusan yang sudah diambil

| Keputusan | Alasan |
|---|---|
| Satu wallet satu suara, median, maksimal 15 pelapor | Satu laporan ngawur tidak menggeser harga; biaya gas terbatas |
| Riwayat ditulis saat laporan pertama di sepasar baru | Grafik tersusun tanpa tugas terjadwal |
| Katalog ditambahkan oleh script deploy, bukan constructor | Verifikasi source di explorer tanpa argumen constructor |
| Wilayah divalidasi dari format kode, bukan daftar | Contract tidak perlu menyimpan ± 514 nama |
| Chain lokal di port 8549, web di 5177 | Tidak bentrok dengan empat project lain di mesin yang sama |
| Jam chain lokal dimundurkan 45 hari saat `npm run node` | Data contoh punya riwayat dan berakhir di waktu nyata |
| Native `<select>` untuk pemilih kota | Bekerja di semua keyboard, ponsel, dan pembaca layar |
| Infrastruktur wallet dipakai ulang dari Sambung | Pola teruji; desain, copy, dan contract sepenuhnya baru |
| Deploy dijalankan pemilik project | Private key tidak pernah keluar dari mesin pemilik |

## Cara melanjutkan

Chain lokal tidak menyimpan data: setiap kali node dihentikan, deploy dan seed harus diulang.

```bash
cd contracts
npm run node
```

```bash
cd contracts
npm run deploy:local
npm run seed:local
```

```bash
cd web
npm run dev
```

Buka `http://localhost:5177`, klik **Connect**, pilih salah satu "Dev wallet". Akun Lestari, Made, dan Rahmat belum pernah melapor di data contoh, jadi bisa langsung melapor di mana saja.

Kalau contract diubah, jalankan `npm run export-abi` di `contracts/` supaya frontend memakai ABI terbaru.

## Informasi jaringan

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 677 | 968 |
| RPC | `https://rpc.botchain.ai` | `https://rpc.bohr.life` |
| Explorer | `https://scan.botchain.ai` | `https://scan.bohr.life` |

Alamat contract: belum ada di testnet maupun mainnet.
