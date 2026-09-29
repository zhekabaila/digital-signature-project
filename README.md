# Digital Signature Lab — ECDSA P-256 + QR-Code Verification + Multi-Signer

Proyek Tugas Kriptografi (Topik D) · Mata kuliah Keamanan Informasi · Universitas Siliwangi.

## Anggota Kelompok (NPM)

| Nama | NPM | Peran |
|---|---|---|
| _(Raden Annisa Dwi Mulyana)_ | _(247006111010)_ | Pengujian |
| _(Shafa Rabbani Fityatul Mukarramah)_ | _(247006111020)_ | User Interface |
| _(Zheka Baila Arkan)_ | _(247006111152)_ | Logic |

> Ganti tabel ini dengan data anggota kelompok sebelum submit.

## Fitur

- **Generate keypair ECDSA P-256** — private key langsung terenkripsi **AES-256-GCM**
  dengan key diturunkan dari passphrase via **scrypt** (format file `.dsk`). Private key
  plaintext tidak pernah ditulis ke disk.
- **Sign dokumen PDF** — hash SHA-256 dari konten kanonik PDF + identitas signer
  ditandatangani ECDSA; hasilnya QR-Code berisi metadata + signature ditanam sebagai
  halaman baru, plus salinan payload di metadata PDF (catalog key `/DSig`).
- **Verifikasi dua lapis** (menolak dokumen yang diubah **dan** kunci yang tidak cocok):
  unggah PDF **atau** scan QR langsung dari kamera browser (jsQR).
- **Multi-penandatangan chained** (desain Opsi A): `hash signer-i = SHA256(dokumen_asli ‖ sig_1 ‖ … ‖ sig_{i-1})`
  → urutan tanda tangan tidak bisa diubah/dilewati.
- **Attack lab & pengujian wajib**: benchmark ≥30 percobaan sign/verify, ukuran
  signature/public key, uji tamper, uji kunci salah, uji QR dipalsukan — tabel hasil +
  ekspor XLSX.

## Menjalankan

```bash
npm install
npm run dev            # http://localhost:3000
npx vitest run
npx tsx scripts/generate-data-uji.mts
npx tsx scripts/run-tests.mts
```

## Arsitektur

```
lib/crypto/     keypair (P-256), key-protection (scrypt+AES-GCM), sign-verify (ECDSA), hash (SHA-256)
lib/pdf/        pdf-utils (kanonisasi byte, embed halaman QR, metadata /DSig), multi-signer (chained sign/verify)
lib/qrcode/     qr-utils (generate PNG, decode RGBA via jsQR, validasi payload)
lib/metrics/    timing (rata-rata N percobaan)
app/api/        keys/generate · sign · verify · multi-sign/add · multi-sign/status · benchmark · export-xlsx
app/            page (landing) · keygen · sign · verify · multi-sign · attack-lab
test/           5 file vitest, 37 kasus (termasuk semua kasus negatif)
data-uji/       5 PDF sampel · hasil-uji/ tabel timing + attack (json/md/xlsx)
```

### Desain penting

- **Apa yang di-hash**: `documentHash` dihitung dari **byte kanonik konten PDF
  sebelum QR ditempel**. Kanonisasi = muat PDF → buang metadata `/DSig` → buang halaman tanda
  tangan → salin halaman asli ke dokumen baru tanpa timestamp (`updateMetadata:false`) → save.
  Deterministik (dibuktikan test) dan berubah jika 1 karakter teks dokumen diubah.
- **Yang ditandatangani**: `SHA256(byte kanonik ‖ signature signer sebelumnya) ‖ JSON([nama, jabatan, institusi, timestamp, fingerprint])`
  — metadata signer ikut terlindungi, sehingga QR dengan nama diganti akan gagal verifikasi.
- **Payload QR = payload metadata PDF** (JSON sama): hasil scan kamera bisa diverifikasi tanpa
  file PDF (bukti tanda tangan sah), sedangkan unggah PDF memverifikasi juga keutuhan dokumen.
- **`/api/multi-sign/status?docId=`** memakai store in-memory (dokumen tidak pernah ditulis ke
  disk); docId dikembalikan lewat header `X-Document-Id`. Sengaja non-persisten — sesuai
  ketentuan "tidak ada key/dokumen disimpan server".
- Endpoint `/api/export-xlsx` ditambahkan di luar struktur folder awal karena hasil pengujian wajib dapat diekspor.

## Keamanan

- Tidak ada key/passphrase/dokumen yang di-hardcode — semuanya input user (cek `grep`).
- Private key hanya ada dalam bentuk terenkripsi saat disimpan/ditransfer; plaintext di memori
  di-zero (`fill(0)`) segera setelah dipakai.
- Hash dokumen wajib SHA-256 (tidak ada MD5/SHA-1).
- `.gitignore` sudah mencakup `.env*` dan `*.pem`.
