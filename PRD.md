# PRD — Pasaran

**Papan harga sembako dari laporan warga, dengan harga acuan yang dihitung di BOT Chain.**
Versi 1.1 · 11 November 2026 · Project 5 dari 5 (BOT Chain Ecosystem Support Program)

**Status: M2 selesai (55%).** Contract, contoh pemakai, dan test selesai; UI lengkap dan alur lapor sampai terkonfirmasi sudah diuji di chain lokal. Berikutnya: testnet. Rincian di [PROGRESS.md](PROGRESS.md).

---

## 1. Ringkasan

Pasaran menjawab pertanyaan yang ditanyakan orang setiap hari: *berapa harga beras, cabai, dan telur di kotaku sekarang?* Siapa pun yang baru belanja melaporkan harga yang ia bayar atau lihat. Untuk setiap komoditas di setiap kota, smart contract mengambil laporan terbaru dari tiap pelapor dan menghitung **median**-nya sebagai harga acuan. Median dipilih karena satu laporan ngawur tidak menggesernya.

Hasilnya ada dua. Bagi warga: papan harga per kota, lengkap dengan seberapa segar dan seberapa banyak pelapornya. Bagi pengembang: harga acuan yang bisa dibaca langsung oleh contract lain di BOT Chain.

"Pasaran" punya dua arti yang sama-sama dipakai: *harga pasaran*, dan siklus lima hari pasar Jawa (Legi, Pahing, Pon, Wage, Kliwon). Riwayat harga di Pasaran dicatat per **sepasar**, yaitu satu putaran lima hari.

| | |
|---|---|
| Kategori | RWA / Infra |
| Jaringan | BOT Chain Mainnet (chain ID 677) |
| Bentuk | Satu smart contract + satu web app |
| Token | Tidak ada. Tidak ada biaya selain gas |
| Mata uang harga | Rupiah |
| Bahasa UI | Inggris; nama komoditas ditampilkan dalam dua bahasa |
| Folder | `D:\Project Web3\pasaran` |

## 2. Latar belakang dan tujuan

### Masalah
Harga sembako berbeda antar-kota dan bergerak tiap pekan. Data resmi tersedia, tetapi dirangkum per provinsi atau kota besar dan terbit dengan jeda. Informasi yang paling dicari orang — harga di pasar dekat rumah, minggu ini — beredar lewat obrolan dan tidak pernah terkumpul.

Di direktori BOT Chain ada beberapa project oracle umum dan satu pelaporan cuaca, tetapi tidak ada yang mengumpulkan harga barang kebutuhan pokok dari warga.

### Tujuan produk
1. Menampilkan harga acuan per komoditas per kota, beserta ukuran kepercayaannya: jumlah pelapor dan umur data.
2. Membuat melapor harga semudah mengisi tiga isian.
3. Menyediakan harga itu untuk contract lain dalam satu panggilan fungsi.
4. Jujur soal batasnya: ini acuan komunitas, bukan data resmi dan bukan oracle untuk penyelesaian dana.
5. Memenuhi seluruh kriteria eligibility program lewat pemakaian wajar.

### Bukan tujuan (v1)
- Tidak ada token, hadiah melapor, atau jaminan yang bisa dipotong.
- Tidak ada mata uang selain rupiah dan tidak ada wilayah di luar Indonesia.
- Tidak ada harga per pasar; agregasi berhenti di tingkat kabupaten/kota.
- Tidak ada komoditas usulan pengguna; katalog dikelola pemilik contract.
- Tidak ada foto struk atau bukti belanja.
- Tidak ada backend, database, atau indexer.

## 3. Pengguna sasaran

| Persona | Kebutuhan | Yang didapat |
|---|---|---|
| **Yang belanja** | Tahu harga wajar sebelum ke pasar | Papan harga kotanya, bisa dibaca tanpa wallet |
| **Pelapor** | Membagikan harga yang baru ia bayar | Form tiga isian, satu transaksi |
| **Pedagang kecil dan pengelola warung** | Membandingkan harga antar-kota | Halaman banding per komoditas |
| **Pengembang** | Butuh harga dunia nyata di contract-nya | Fungsi `priceOf` dan halaman panduan |

## 4. Pemetaan ke kriteria program

| Kriteria | Cara dipenuhi |
|---|---|
| Akun X aktif, 5 post | Akun X khusus Pasaran. Draft post disiapkan di tahap akhir. **Dikerjakan olehmu.** |
| Pengumuman mainnet | Post dengan kalimat wajib "Officially launched on BOT Chain Mainnet." |
| BOT Chain di website | Footer menampilkan nama BOT Chain dengan tautan ke `https://botchain.ai` dan `https://scan.botchain.ai` |
| Produk usable | Frontend lengkap, connect wallet, melapor harga dan membaca papan berjalan |
| Independen dan orisinal | Tidak ada papan harga sembako di direktori; mekanik median satu-wallet-satu-suara dan riwayat per sepasar ditulis dari nol; tampilan berbeda dari empat project sebelumnya |
| 3 wallet, 5 transaksi | Satu harga baru berstatus terkonfirmasi setelah 3 pelapor berbeda; dua komoditas sudah melewati 5 transaksi |
| Deployment + verification | Contract di-deploy ke mainnet dan source-nya diverifikasi di scan.botchain.ai |

## 5. Cara harga acuan dihitung

Ini inti produk. Aturannya ditampilkan di halaman About dan dijalankan oleh contract.

### 5.1 Satu wallet, satu suara
Untuk setiap pasangan komoditas–kota, contract menyimpan **laporan terbaru dari tiap pelapor**. Melapor lagi mengganti laporan lamamu, bukan menambah suara. Membanjiri papan dengan satu wallet tidak ada gunanya.

### 5.2 Jendela dan median

| Parameter | Nilai |
|---|---|
| Umur laporan yang dihitung | Maksimal 14 hari |
| Jumlah pelapor yang dihitung | Maksimal 15 terbaru |
| Jeda melapor ulang harga yang sama | 20 jam |
| Batas **terkonfirmasi** | Minimal 3 pelapor berbeda |

Harga acuan adalah **median** dari laporan yang masuk jendela. Kalau jumlahnya genap, dipakai rata-rata dua nilai tengah.

### 5.3 Status harga

| Status | Syarat | Tampilan |
|---|---|---|
| **Confirmed** | 3 pelapor atau lebih dalam 14 hari | Harga tebal |
| **Provisional** | 1–2 pelapor dalam 14 hari | Harga dengan label "provisional" |
| **No recent data** | Tidak ada laporan dalam 14 hari | Tanda pisah, dengan harga terakhir yang diketahui dan tanggalnya |

### 5.4 Rentang wajar
Setiap komoditas punya harga minimum dan maksimum yang masuk akal. Laporan di luar rentang ditolak; ini menangkap salah ketik seperti kelebihan satu nol. Rentang bisa diubah pemilik contract mengikuti inflasi, dan setiap perubahan tercatat.

### 5.5 Riwayat per sepasar
Waktu dibagi menjadi putaran lima hari. Saat laporan pertama di putaran baru masuk, contract menyimpan median putaran sebelumnya sebagai satu titik riwayat. Dengan begitu grafik harga tersusun sendiri dari pemakaian, tanpa perlu ada yang menjalankan tugas terjadwal.

### 5.6 Yang tidak bisa dilakukan pemilik contract
Pemilik **tidak bisa** mengubah atau menghapus laporan, dan tidak bisa menetapkan harga. Wewenangnya hanya: menambah komoditas, mengubah rentang wajar, menonaktifkan komoditas, dan menyembunyikan teks nama pasar yang tidak pantas.

## 6. Katalog

### 6.1 Komoditas awal
Satuan dan mutu ditulis eksplisit agar semua orang melaporkan barang yang sama.

| Komoditas | Satuan |
|---|---|
| Beras medium | per kg |
| Beras premium | per kg |
| Minyak goreng kemasan | per liter |
| Gula pasir | per kg |
| Telur ayam ras | per kg |
| Daging ayam ras | per kg |
| Daging sapi | per kg |
| Cabai merah keriting | per kg |
| Cabai rawit merah | per kg |
| Bawang merah | per kg |
| Bawang putih | per kg |
| Tepung terigu | per kg |

Rentang wajar tiap komoditas ditetapkan saat pengembangan dari data harga publik dan dicantumkan di README.

### 6.2 Wilayah
Wilayah memakai **kode kabupaten/kota resmi** (empat digit). Contract hanya menyimpan kodenya; nama wilayah disertakan di frontend dari data publik pemerintah, dengan sumber yang dicantumkan. Tidak perlu ada yang "mendaftarkan" kota: kota muncul di papan begitu ada laporan pertamanya.

## 7. Lingkup fitur

### 7.1 Masuk v1

**F1 — Papan harga kota.**
Pilih kota; tampil tabel semua komoditas: harga acuan, perubahan dari sepasar sebelumnya, jumlah pelapor, umur data, dan grafik mini. Kota terakhir yang dibuka diingat di perangkat.

**F2 — Detail harga.**
Untuk satu komoditas di satu kota: harga besar dengan statusnya, grafik riwayat per sepasar, dan daftar laporan terbaru (harga, nama pasar, pelapor, waktu).

**F3 — Melapor harga.**
Tiga isian wajib: kota, komoditas, harga dalam rupiah. Satu isian opsional: nama pasar atau toko (maksimal 40 byte). Form menampilkan satuan dengan jelas, rentang wajar, dan harga acuan saat ini; bila laporanmu jauh dari acuan, muncul pertanyaan konfirmasi sebelum transaksi.

**F4 — Banding antar-kota.**
Satu komoditas di semua kota yang punya data, diurutkan dari termurah.

**F5 — Pelapor.**
Papan pelapor (jumlah laporan dan jumlah kota) dan halaman "My reports" yang menunjukkan laporan mana yang sudah boleh diperbarui.

**F6 — Untuk pengembang.**
Halaman berisi alamat contract, tanda tangan fungsi `priceOf`, arti nilai kembaliannya, dan contoh contract Solidity yang membaca harga sambil memeriksa status dan umur data.

**F7 — Halaman About.**
Cara perhitungan (bagian 5) dan batasan data (bagian 13).

**F8 — Statistik langsung.**
Jumlah laporan, pelapor, kota aktif, dan komoditas. Jumlah harga terkonfirmasi ditampilkan per kota di papan, karena menghitungnya untuk semua kota sekaligus butuh memindai seluruh data.

### 7.2 Tidak masuk v1 (kandidat v2)
- Skor ketepatan pelapor.
- Jaminan yang dipotong untuk laporan menyimpang.
- Harga per pasar.
- Median nasional yang dihitung on-chain.
- Negara dan mata uang lain.
- Toggle bahasa Indonesia/Inggris penuh.

## 8. Alur pengguna

### 8.1 Melihat harga
1. Buka situs. Papan menampilkan kota terakhir yang dibuka, atau kota paling aktif bila baru pertama kali.
2. Ganti kota lewat pemilih yang bisa dicari.
3. Ketuk satu baris untuk melihat grafik dan laporan-laporannya.

### 8.2 Melapor
1. **Report a price** → hubungkan wallet bila perlu.
2. Pilih kota dan komoditas; ketik harga. Satuan tertulis di samping isian.
3. Konfirmasi di wallet → laporan muncul di daftar; harga acuan dan status diperbarui.
4. Pada laporan ketiga dari wallet berbeda, status berubah menjadi Confirmed.

### 8.3 Memakai harga di contract lain
1. Buka **For builders** → salin alamat contract dan contoh kode.
2. Panggil `priceOf(commodityId, regionCode)`; periksa status dan umur data sebelum memakai nilainya.

### 8.4 Keadaan yang ditangani
Tanpa wallet · jaringan salah · kota tanpa data · komoditas tanpa data · harga di luar rentang wajar · masih dalam jeda 20 jam (dengan waktu boleh lagi) · harga jauh dari acuan · komoditas nonaktif · transaksi ditolak atau gagal · RPC gagal · saldo BOT tidak cukup.

## 9. Halaman dan layar

| Rute | Isi |
|---|---|
| `#/` Papan | Pemilih kota, tabel harga semua komoditas, statistik, tombol lapor |
| `#/price/:commodity/:region` Detail | Harga, status, grafik per sepasar, daftar laporan, tombol lapor |
| `#/report` Lapor | Form laporan |
| `#/compare/:commodity` Banding | Tabel dan grafik batang antar-kota |
| `#/reporters` Pelapor | Papan pelapor |
| `#/me` Laporan saya | Riwayat dan yang sudah boleh diperbarui |
| `#/builders` Pengembang | Cara membaca harga dari contract |
| `#/about` Tentang | Metode dan batasan |
| Footer (semua halaman) | "Built on BOT Chain" dengan tautan wajib, alamat contract, akun X |

## 10. Arah desain

Lima project, lima wajah.

| | Sambung | Dakon | Colok | Jamkita | Pasaran |
|---|---|---|---|---|---|
| Suasana | Kertas terang | Panggung gelap | Papan penunjuk arah | Koperasi warga | Lapak pasar |
| Motif | Benang merah | Papan kayu | Stopkontak | Cincin jam | Terpal bergaris dan label harga |
| Aksen | Merah | Kuningan | Kuning rambu | Hijau dan jingga | Biru terpal dan oranye |
| Tipografi | Serif buku | Grotesk berkarakter | Sans rambu | Sans humanis membulat | Angka tebal rapat, seperti tulisan papan harga |
| Pusat layar | Kolom baca | Papan permainan | Peta | Dasbor | Tabel harga dan grafik |

- **Tiga atribut:** lantang, padat, apa adanya.
- **Motif:** terpal biru bergaris putih khas pasar tradisional sebagai bilah kepala; setiap harga ditampilkan seperti label harga lapak, angka besar dengan satuan kecil.
- **Angka adalah isi utama:** tabular, rata kanan, tebal; naik-turun ditandai panah dan persen, tidak hanya warna.
- **Grafik** sederhana dan terbaca: satu garis per grafik, sumbu berlabel, dan selalu ada tabel sebagai padanannya.
- **Mobile dulu:** tabel menjadi daftar label harga; tombol lapor selalu dalam jangkauan ibu jari.
- **Yang dihindari:** tampilan bursa kripto — lilin harga, kedip hijau-merah, ticker berjalan.

Kontras minimal WCAG AA. Tabel bermarkup benar; grafik punya deskripsi teks.

## 11. Spesifikasi smart contract

**Contract:** `Pasaran.sol` · Solidity 0.8.24 · EVM target `paris` · tanpa dependensi eksternal · tanpa fungsi payable.

### 11.1 Penyimpanan
- Tiap pasangan komoditas–kota punya **papan suara** berisi maksimal 15 entri, satu per pelapor. Satu entri (pelapor, harga, waktu) muat dalam satu slot.
- Pelapor yang sudah punya entri menimpanya; pelapor baru pada papan penuh menggantikan entri tertua.
- Seluruh laporan juga disimpan sebagai daftar tambah-saja untuk riwayat, karena RPC mainnet mematikan `eth_getLogs`.
- Titik riwayat per sepasar disimpan saat putaran berganti (5.5).

### 11.2 Fungsi tulis

| Fungsi | Aturan |
|---|---|
| `report(commodityId, regionCode, price, market)` | Komoditas aktif; kode wilayah valid; harga dalam rentang wajar; nama pasar ≤ 40 byte; di luar jeda 20 jam untuk pasangan yang sama |
| `addCommodity(name, unit, minPrice, maxPrice)` | Hanya pemilik |
| `setBounds(commodityId, minPrice, maxPrice)` | Hanya pemilik |
| `setCommodityActive(commodityId, active)` | Hanya pemilik |
| `setReportHidden(reportId, hidden)` | Hanya pemilik; hanya menyembunyikan teks nama pasar di frontend |
| `transferOwnership(newOwner)` | Hanya pemilik |

### 11.3 Fungsi baca

**Untuk contract lain:**

`priceOf(commodityId, regionCode)` → harga acuan, jumlah pelapor, waktu laporan terbaru, dan penanda terkonfirmasi.

**Untuk frontend:**

`commodityCount()` · `getCommodities()` · `isValidRegion(regionCode)` · `getBoard(regionCode)` · `getFeed(commodityId, regionCode)` · `getAcrossRegions(commodityId, cursor, limit)` · `activeRegions()` · `history(commodityId, regionCode, count)` · `getReports(commodityId, regionCode, cursor, limit)` · `reportsBy(wallet, cursor, limit)` · `reportCount()` · `nextReportTime(wallet, commodityId, regionCode)` · `reporterOf(wallet)` · `getReporters(cursor, limit)` · `stats()`

`getBoard` mengembalikan seluruh komoditas satu kota dalam satu panggilan, supaya papan tampil cepat.

### 11.4 Event
`PriceReported` · `SepasarClosed` · `CommodityAdded` · `BoundsChanged` · `CommodityActiveSet` · `ReportHiddenSet` · `OwnershipTransferred` — untuk keterbacaan di explorer.

### 11.5 Keamanan
- Tidak ada dana yang disimpan atau dipindahkan.
- Perhitungan median bekerja pada maksimal 15 angka, sehingga biaya gasnya terbatas dan bisa diprediksi, termasuk saat dipanggil contract lain.
- Laporan tidak bisa diubah atau dihapus siapa pun.
- Setiap perubahan rentang wajar tercatat sebagai event dan terbaca lewat `getCommodities`.

### 11.6 Biaya terukur (gas 20 gwei, BOT ≈ $12,6)

Diukur dari test suite. Ukuran bytecode contract: 13.814 byte (batas 24.576).

| Aksi | Gas | BOT | ± USD |
|---|---|---|---|
| Deploy contract | 3.061.977 | 0,061 | $0,77 |
| Katalog awal (12 × `addCommodity`) | 1.248.540 | 0,025 | $0,31 |
| Laporan pertama untuk satu komoditas–kota | 440.813 | 0,0088 | $0,11 |
| Pelapor baru di komoditas–kota yang sudah ada | 288.130 | 0,0058 | $0,07 |
| Papan penuh (15 pelapor) sekaligus menutup sepasar | 377.510 | 0,0076 | $0,10 |
| Pelapor lama memperbarui laporannya | 201.065 | 0,0040 | $0,05 |
| `priceOf` dibaca contract lain (lewat PriceReader) | 83.957 | 0,0017 | $0,02 |

Laporan pertama paling mahal karena menulis banyak slot penyimpanan baru (daftar wilayah, daftar pelapor, papan suara). Perkiraan awal di PRD v1.0 (± 0,005 BOT per laporan) terlalu rendah.

## 12. Arsitektur teknis

```
pasaran/
├── PRD.md
├── README.md
├── PROGRESS.md
├── contracts/            Hardhat 2 + ethers + chai (JavaScript)
│   ├── contracts/Pasaran.sol
│   ├── contracts/examples/PriceReader.sol   contoh contract pemakai harga
│   ├── test/             median, jendela waktu, satu-wallet-satu-suara, sepasar, rentang wajar
│   ├── scripts/          deploy (dengan katalog awal), seed (lokal saja), export-abi
│   └── .env.example      (PRIVATE_KEY diisi olehmu, tidak pernah di-commit)
└── web/                  Vite + React + TypeScript + viem
    └── src/
        ├── data/         kode dan nama kabupaten/kota, nama komoditas dua bahasa
        ├── config/       chain, alamat contract, ABI
        ├── lib/          wallet, client baca, format rupiah dan sepasar
        ├── components/   label harga, tabel papan, grafik, pemilih kota
        ├── pages/
        └── styles/
```

- **Grafik** digambar dengan SVG buatan sendiri, tanpa pustaka grafik.
- **Data wilayah:** v1 memakai daftar 60 kabupaten/kota besar yang ditulis tangan dengan kode Kemendagri (`web/src/data/regions.ts`). Contract menerima kode apa pun yang formatnya benar, jadi daftar ini hanya menentukan nama di pemilih kota. Daftar lengkap (± 514 wilayah) perlu diunduh dari sumber resmi sebelum mainnet; saya akan meminta izinmu dulu.
- **Wallet:** EIP-6963 dengan cadangan `window.ethereum`; lapisan koneksinya memakai pola yang sudah teruji di Sambung, tampilannya dibuat baru.
- **Routing:** hash router. **Hosting:** Vercel, root directory `web`.
- **Wallet dev:** hanya di mode development pada chain lokal; tidak ikut build produksi.

## 13. Batasan data dan kejujuran

Ditulis jelas di aplikasi dan di halaman pengembang.

- **Ini acuan komunitas.** Bukan data resmi pemerintah dan bukan nasihat harga.
- **Harga dengan sedikit pelapor mudah digeser.** Karena itu status Provisional ditampilkan apa adanya, dan `priceOf` mengembalikan jumlah pelapor agar pemakainya bisa menetapkan ambang sendiri.
- **Jangan dipakai untuk menyelesaikan dana** tanpa pengaman tambahan. Wallet baru mudah dibuat, dan v1 tidak punya jaminan yang bisa dipotong.
- **Laporan bersifat publik dan permanen**, termasuk nama pasar yang ditulis pelapor.
- **Tidak ada data karangan di mainnet.** Harga awal harus harga yang benar-benar dilihat pelapornya. Data contoh hanya dipakai di chain lokal.

## 14. Kebutuhan non-fungsional

| Aspek | Target |
|---|---|
| Ketepatan | Median contract sama dengan median hitungan test untuk kumpulan data acak |
| Kecepatan | Papan satu kota tampil dari satu panggilan baca |
| Responsif | Papan terbaca di 375 px tanpa scroll horizontal |
| Aksesibilitas | Tabel bermarkup benar, grafik berdeskripsi, naik-turun tidak bergantung warna |
| Ketahanan | Kegagalan RPC menampilkan pesan dan tombol coba lagi |

## 15. Tahapan dan progres

| Tahap | Isi | Progres |
|---|---|---|
| M0 | PRD — selesai | 5% |
| M1 | Smart contract + contoh pemakai + 31 test lulus — selesai | 25% |
| M2 | **UI/UX lengkap: papan, detail dengan grafik, lapor, banding, pelapor, pengembang; alur lapor sampai terkonfirmasi berjalan di chain lokal — selesai** | **55%** |
| M3 | Deploy testnet (968) + uji dengan tiga wallet sungguhan | 70% |
| M4 | Deploy mainnet (677) + verifikasi source | 85% |
| M5 | Vercel produksi, harga awal yang nyata, pengumuman X, audit checklist | 100% |

**Titik lapor:** di akhir M2 saya berhenti dan memberi tahu kamu, supaya kamu bisa menyiapkan repo dan menghubungkannya.

## 16. Pembagian kerja

| Saya | Kamu |
|---|---|
| PRD, contract, test, frontend, script deploy | Membuat group project **sebelum** deploy mainnet |
| Uji lokal dan panduan uji testnet | Setup repo dan menghubungkan ke Vercel |
| Draft post X dan teks pengumuman | Membuat akun X dan mempublikasikan post |
| Panduan verifikasi contract | Menjalankan deploy dengan private key-mu sendiri |
| Audit checklist eligibility | **Melaporkan harga nyata** dari pasar atau struk belanjamu dan mengajak 2–3 orang melakukan hal yang sama |

## 17. Risiko

| Risiko | Mitigasi |
|---|---|
| Harga dimanipulasi di kota berpelapor sedikit | Satu wallet satu suara; median; rentang wajar; status Provisional; jumlah pelapor selalu ditampilkan dan dikembalikan `priceOf` |
| Papan kosong di awal | Peluncuran difokuskan pada satu kota dan enam sampai delapan komoditas; harga awal nyata dari kamu dan tester |
| Dipakai sebagai oracle penyelesaian dana | Peringatan di halaman pengembang; contoh kode memeriksa status dan umur data |
| Orang melaporkan barang atau satuan yang berbeda | Katalog tetap dengan satuan dan mutu eksplisit; satuan ditulis besar di form |
| Rentang wajar tertinggal dari inflasi | Bisa diubah pemilik; perubahan tercatat; ditinjau saat ada laporan yang tertolak |
| Daftar kode wilayah tidak akurat | Diambil dari sumber pemerintah dan sumbernya dicantumkan |
| Harga basi dikira harga hari ini | Umur data di setiap baris; setelah 14 hari berubah menjadi "No recent data" |
| Dinilai mirip project oracle yang sudah ada | Domain berbeda (sembako), metode berbeda (median pelapor unik), bentuk berbeda (papan harga untuk warga) |

## 18. Kriteria terima

1. Tiga wallet melaporkan harga satu komoditas di satu kota; status berubah dari Provisional menjadi Confirmed dan harga acuannya adalah median ketiganya.
2. Laporan kedua dari wallet yang sama mengganti laporan lamanya dan tidak menambah jumlah pelapor.
3. Contract menolak: harga di luar rentang wajar, melapor ulang dalam 20 jam, komoditas nonaktif, kode wilayah tidak valid.
4. Laporan berumur lebih dari 14 hari tidak ikut dihitung, dibuktikan dengan test yang memajukan waktu.
5. Pergantian sepasar menyimpan satu titik riwayat yang benar.
6. Contoh contract pemakai berhasil membaca harga dan menolak data yang tidak terkonfirmasi atau terlalu tua.
7. Papan dan form lapor nyaman dipakai di 375 px.
8. Footer memuat nama BOT Chain dan kedua tautan wajib.
9. Contract terverifikasi di scan.botchain.ai dan alamatnya tampil di situs.

## 19. Hal yang masih terbuka

- Daftar komoditas awal: dua belas di atas, atau dipangkas menjadi enam sampai delapan untuk peluncuran.
- Angka metode: jendela 14 hari, maksimal 15 pelapor, jeda 20 jam, batas terkonfirmasi 3 pelapor.
- Kota peluncuran, yang menentukan harga awal.
- Apakah nama hari pasaran (Legi, Pahing, Pon, Wage, Kliwon) ditampilkan di antarmuka sebagai sentuhan identitas; penanggalannya perlu diverifikasi dulu.
- Nama akun X dan domain.
- Kriteria ketujuh program, yang belum tercantum di materi.
