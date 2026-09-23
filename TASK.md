# Tugas Proyek Kriptografi — Digital Signature
**Topik D — ECDSA P-256 + QR-Code Verification + Multi-Signer**
Mata kuliah Keamanan Informasi · Universitas Siliwangi

Target: memenuhi seluruh fitur wajib, seluruh pengujian wajib, dan fitur pengayaan
"beberapa penandatangan pada satu dokumen".

---

## 1. Keputusan Arsitektur

### 1.1 Stack
- **Next.js 16 (App Router)** — satu project, full JavaScript/TypeScript, sama seperti project
  watermarking. Tidak ada endpoint Python/bahasa lain.
- **Primitif tanda tangan**: `node:crypto` bawaan Node.js — `generateKeyPairSync('ec', { namedCurve:
  'P-256' })`, `crypto.sign()`, `crypto.verify()`. Ini SEMUA boleh pakai library teruji (PDF eksplisit
  mengizinkan pustaka kriptografi untuk algoritma modern seperti ECDSA).
- **Hash dokumen**: SHA-256 via `node:crypto` (`createHash('sha256')`).
- **Enkripsi private key saat disimpan**: AES-256-GCM, key diturunkan dari passphrase user via `scrypt`
  (private key TIDAK PERNAH disimpan/ditulis dalam bentuk plaintext, sesuai ketentuan wajib PDF).
- **PDF handling**: `pdf-lib` — untuk membaca metadata dokumen, menyisipkan QR-Code ke halaman PDF, dan
  menghitung hash byte-content dokumen.
- **QR-Code**: `qrcode` (generate) + `jsqr` atau kamera browser (scan/verifikasi) untuk sisi client.
- **Alur yang TIDAK butuh library khusus**: logika "apa yang di-hash", "apa yang ditandatangani",
  "urutan verifikasi", "gabungan multi-signer" — ini semua ditulis sendiri sebagai orkestrasi di atas
  primitif crypto bawaan.

### 1.2 Kenapa ECDSA P-256 (bukan RSA atau Ed25519)?
- **Dibanding RSA 2048**: signature ECDSA P-256 jauh lebih kecil (~70 byte vs ~256 byte RSA), sehingga
  lebih ringan dimuat dalam QR-Code (QR-Code kapasitasnya terbatas — makin kecil data, makin mudah
  di-scan dengan akurat).
- **Dibanding Ed25519**: `node:crypto` mendukung P-256 secara native tanpa perlu library tambahan untuk
  encoding/decoding; ekosistem `pdf-lib` + `qrcode` juga lebih banyak contoh referensinya dengan
  ECDSA/RSA dibanding Ed25519. Untuk cakupan tugas 1 minggu, ini pilihan paling rendah risiko.

### 1.3 Kenapa Node.js `crypto` boleh dipakai penuh di sini (beda dengan topik watermarking)?
Di tugas Watermarking, DCT/LSB **wajib** ditulis manual karena itu topik intinya. Di tugas ini, topik
intinya adalah **alur tanda tangan digital** (apa yang di-hash, kapan ditandatangani, bagaimana
verifikasi menolak dokumen yang diubah) — bukan implementasi ulang algoritma ECDSA dari nol. PDF tugas
eksplisit mengizinkan pustaka kriptografi teruji untuk RSA/ECDSA/SHA-256. Jadi effort tim difokuskan ke
**orkestrasi alur yang benar** dan **keamanan penyimpanan kunci**, bukan re-implementasi matematika
kurva eliptik.

### 1.4 Pembagian kerja (2–3 orang)
| Peran | Tanggung jawab |
|---|---|
| **A — Core Crypto & Key Management** | generate keypair, private key encryption (AES-GCM+scrypt), sign(), verify(), hash dokumen, unit test crypto |
| **B — PDF & QR-Code** | baca/tulis PDF (`pdf-lib`), generate QR-Code berisi metadata+signature, scan/decode QR-Code, layout penempatan QR di halaman |
| **C — UI, Multi-Signer Flow, Pengujian** | Next.js pages, alur multi-penandatangan (urutan, status per signer), timing test (30x sign/verify), uji tamper & kunci salah, laporan |

Jika hanya 2 orang: gabungkan B+C (keduanya terkait "alur & presentasi"), A tetap terpisah karena
paling sensitif dari sisi keamanan dan butuh fokus penuh.

---

## 2. Struktur Folder Project

```
digital-signature-project/
├── app/
│   ├── page.tsx                        # Landing / pilih mode (generate key / sign / verify)
│   ├── keygen/page.tsx                 # UI generate keypair + set passphrase private key
│   ├── sign/page.tsx                   # UI upload PDF + pilih private key + sign → download PDF+QR
│   ├── verify/page.tsx                 # UI upload PDF bertanda tangan / scan QR → hasil verifikasi
│   ├── multi-sign/page.tsx             # UI alur multi-penandatangan (invite signer, urutan, status)
│   ├── attack-lab/page.tsx             # UI simulasi: tamper 1 byte, kunci salah, QR dipalsukan
│   └── api/
│       ├── keys/generate/route.ts      # generate ECDSA keypair, enkripsi private key, return public key
│       ├── sign/route.ts               # terima PDF + private key (terenkripsi+passphrase) → PDF+QR tertanda
│       ├── verify/route.ts             # terima PDF bertanda tangan / data QR → { valid, signer, reason? }
│       ├── multi-sign/add/route.ts     # tambahkan tanda tangan ke-N pada dokumen yang sudah ditandatangani
│       ├── multi-sign/status/route.ts  # cek status siapa saja yang sudah/belum tanda tangan
│       └── benchmark/route.ts          # jalankan N kali sign/verify, kembalikan rata-rata waktu
├── lib/
│   ├── crypto/
│   │   ├── keypair.ts                  # generateKeypair(), exportPublicKey(), exportEncryptedPrivateKey()
│   │   ├── key-protection.ts           # encryptPrivateKey(), decryptPrivateKey() — AES-GCM+scrypt
│   │   ├── sign-verify.ts              # signHash(), verifySignature()
│   │   └── hash.ts                     # hashDocument() — SHA-256 dari buffer PDF
│   ├── pdf/
│   │   ├── pdf-utils.ts                # extractContentForHashing(), embedQRCode(), readEmbeddedQR()
│   │   └── multi-signer.ts             # appendSignatureMetadata(), listSigners(), verifyAllSignatures()
│   ├── qrcode/
│   │   └── qr-utils.ts                 # generateQR(), decodeQR(), payload schema (JSON→QR)
│   └── metrics/
│       └── timing.ts                   # benchmarkSign(), benchmarkVerify() — rata-rata dari N percobaan
├── test/
│   ├── keypair.test.ts                 # generate, export, round-trip
│   ├── key-protection.test.ts          # encrypt/decrypt private key, passphrase salah harus gagal
│   ├── sign-verify.test.ts             # sign→verify sukses; tamper 1 byte→verify gagal; kunci salah→gagal
│   ├── multi-signer.test.ts            # 2-3 signer berurutan, verifikasi semua tanda tangan
│   └── qr-utils.test.ts                # generate→decode round-trip, payload rusak→ditolak
├── data-uji/                           # 5 dokumen PDF sampel untuk demo & pengujian
├── hasil-uji/                          # tabel timing, ukuran signature/key (auto-generated)
├── README.md
└── TASK.md                             # file ini
```

---

## 3. Alur Logic per Fitur Wajib

### 3.1 Generate Keypair & Proteksi Private Key
```
User input: passphrase (untuk melindungi private key)
        │
        ▼
crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' })
        │
        ├──► publicKey  → export format SPKI/PEM → boleh disimpan/dibagikan bebas
        │
        └──► privateKey → export format PKCS8/DER (raw)
                    │
                    ▼
             scrypt(passphrase, salt_random) → derived key
                    │
                    ▼
             AES-256-GCM encrypt(privateKeyRaw, derived key, iv_random)
                    │
                    ▼
             Simpan: [salt | iv | authTag | ciphertext] → ini yang disimpan/diunduh user
             (TIDAK PERNAH menulis privateKeyRaw plaintext ke disk/DB/kode)
```
- Ini memenuhi requirement wajib: **"Kunci privat disimpan terenkripsi, tidak boleh ditulis langsung
  di kode sumber."**

### 3.2 Alur Sign (Menandatangani Dokumen)
```
User upload: PDF dokumen + private key terenkripsi (file) + passphrase
        │
        ▼
decryptPrivateKey(fileTerenkripsi, passphrase)   ← gagal jika passphrase salah (authTag AES-GCM)
        │
        ▼
hashDocument(PDF buffer) → SHA-256 digest
        │
        ▼
signHash(digest, privateKey) → signature (ECDSA)
        │
        ▼
Susun payload metadata:
   {
     signerName, signerRole, timestamp, institution,
     documentHash (hex), signature (base64),
     publicKeyFingerprint  ← agar verifier tahu key mana yang harus dicocokkan
   }
        │
        ▼
generateQR(JSON.stringify(payload)) → gambar QR-Code
        │
        ▼
embedQRCode(PDF, QR image, posisi halaman terakhir) → PDF baru siap diunduh
```

### 3.3 Alur Verify (Verifikasi)
```
User upload: PDF bertanda tangan (atau scan QR langsung dari kamera)
        │
        ▼
readEmbeddedQR(PDF) atau decodeQR(gambar hasil scan) → payload metadata
        │
        ▼
Ambil documentHash dari payload → cocokkan dengan hashDocument(PDF saat ini)
   │
   ├─ jika PDF sudah diubah (walau 1 karakter) → hash berbeda → TOLAK, alasan: "dokumen telah diubah"
   │
   └─ jika hash cocok →
        ▼
     verifySignature(documentHash, signature, publicKey_dari_fingerprint)
        │
        ├─ signature valid  → TAMPILKAN: valid, nama penandatangan, waktu tanda tangan
        │
        └─ signature invalid (kunci salah / signature dipalsukan) → TOLAK, alasan: "tanda tangan tidak
          cocok dengan kunci publik"
```
- Dua lapis penolakan ini memenuhi requirement wajib: **"Verifikasi yang menolak dokumen yang diubah
  DAN tanda tangan dengan kunci yang tidak cocok"** — dua kasus kegagalan berbeda, harus dites terpisah.

### 3.4 Alur Multi-Penandatangan (Fitur Pengayaan)
```
Dokumen awal → Signer 1 sign → payload_1 tertanam (QR ke-1 atau metadata list ke-1)
        │
        ▼
Dokumen (sudah ada tanda tangan 1) → Signer 2 sign
        │
   PENTING: apa yang di-hash oleh Signer 2?
   Opsi A (sequential/chained): hash = SHA256(dokumen_asli + semua_signature_sebelumnya)
                                 → setiap signer "mengunci" tanda tangan sebelumnya juga
   Opsi B (independent): setiap signer menandatangani hash dokumen ASLI yang sama
                          → semua signature independen, urutan tidak masalah
        │
        ▼
Simpan daftar signature sebagai array di metadata:
   signatures: [
     { signer: "A", signature: "...", timestamp: "...", publicKeyFingerprint: "..." },
     { signer: "B", signature: "...", timestamp: "...", publicKeyFingerprint: "..." }
   ]
        │
        ▼
Verifikasi: loop tiap entry di signatures[] → verifySignature() masing-masing
            → tampilkan status per-signer: [✓ Signer A valid] [✓ Signer B valid] atau [✗ gagal di sini]
```
- **Rekomendasi**: pakai **Opsi A (chained)** untuk nilai tambah — ini membuktikan urutan tanda tangan
  tidak bisa diubah/dilewati (Signer 2 tidak bisa sign duluan sebelum Signer 1), dan lebih menarik untuk
  dijelaskan di laporan sebagai "integrity chain".

### 3.5 Alur Pengujian Wajib
```
Untuk setiap dari 5 dokumen uji:
   ▸ Timing: jalankan sign() dan verify() masing-masing 30 kali → catat waktu tiap percobaan → rata-rata
   ▸ Ukuran: catat panjang byte signature dan panjang byte public key
   ▸ Uji tamper: ambil PDF bertanda tangan, ubah 1 byte di konten (misal 1 karakter teks),
                 jalankan verify() → HARUS gagal, catat pesan alasan
   ▸ Uji kunci salah: verify() pakai public key BERBEDA (bukan pasangan dari private key penandatangan)
                       → HARUS gagal, catat pesan alasan
   ▸ Uji QR-Code dipalsukan: generate QR baru dengan payload yang diubah manual (misal ganti nama
                              signer atau ganti signature dengan string acak) → decode → verify()
                              → HARUS gagal
        │
        ▼
Kumpulkan semua hasil ke tabel → tampilkan di UI → export XLSX
```

---

## 4. API Contract (ringkas)

| Endpoint | Input | Output |
|---|---|---|
| `POST /api/keys/generate` | `passphrase` (string) | `{ publicKeyPem, encryptedPrivateKeyFile (blob) }` |
| `POST /api/sign` | `document` (PDF file), `encryptedPrivateKey` (file), `passphrase`, `signerMeta` (nama, jabatan, institusi) | `signed-document.pdf` (blob, dengan QR tertanam) |
| `POST /api/verify` | `document` (PDF file) ATAU `qrPayload` (string hasil scan) | `{ valid, signers: [{name, timestamp, valid}], reason? }` |
| `POST /api/multi-sign/add` | `document` (PDF sudah ada ≥1 tanda tangan), `encryptedPrivateKey`, `passphrase`, `signerMeta` | `signed-document.pdf` (tanda tangan bertambah) |
| `GET  /api/multi-sign/status?docId=...` | — | `{ signers: [{name, signed:boolean}] }` |
| `POST /api/benchmark` | `document`, `encryptedPrivateKey`, `passphrase`, `iterations` (default 30) | `{ avgSignMs, avgVerifyMs, signatureSizeBytes, publicKeySizeBytes }` |

---

## 5. Checklist Pemetaan ke Rubrik Tugas

| Requirement PDF | Dipenuhi oleh |
|---|---|
| Pembangkitan pasangan kunci RSA/ECDSA/Ed25519 | `lib/crypto/keypair.ts` — ECDSA P-256 |
| Tanda tangan atas hash SHA-256 dari dokumen | `lib/crypto/hash.ts` + `lib/crypto/sign-verify.ts` |
| Verifikasi menolak dokumen diubah | §3.3 — pengecekan hash mismatch |
| Verifikasi menolak kunci tidak cocok | §3.3 — verifySignature gagal |
| QR-Code berisi metadata (nama, jabatan, tanggal, institusi) + signature/link verifikasi | §3.2 payload schema |
| Kunci privat disimpan terenkripsi, tidak hardcode | §3.1 — AES-GCM + scrypt, tidak ada di kode sumber |
| Waktu sign & verify rata-rata dari ≥30 percobaan | `lib/metrics/timing.ts` + `/api/benchmark` |
| Ukuran signature & public key | dicatat di hasil benchmark |
| Uji tamper (ubah 1 byte → verify gagal) | attack-lab §3.5 |
| Uji kunci salah | attack-lab §3.5 |
| Uji QR-Code dipalsukan | attack-lab §3.5 |
| **Pengayaan: multi-penandatangan** | §3.4 — chained signature, `lib/pdf/multi-signer.ts` |
| ≥5 unit test | `test/*.test.ts` (5 file di atas) |
| README lengkap + NPM anggota | `README.md` |
| Tidak ada key hardcoded | semua key dari upload/generate user, cek `.gitignore` |

---

## 6. Rencana Hari (mengikuti Bagian 7 PDF)

- **Hari 1**: setup repo (`create-next-app` sudah ada) → tambah `pdf-lib`, `qrcode`, `jsqr`, `exceljs`;
  buat struktur folder di atas; commit skeleton tiap API route (dummy return) agar semua anggota bisa
  mulai paralel.
- **Hari 2–4**: A kerjakan keypair generation + key protection + sign/verify inti (validasi dengan unit
  test dulu sebelum wiring UI), B kerjakan PDF read/write + QR embed/decode, C bangun UI keygen/sign/
  verify page + wiring ke API (pakai stub A/B dulu jika belum selesai).
- **Hari 5–6**: integrasi multi-sign flow (chained hashing, status tracking), jalankan benchmark 30x
  pada 5 dokumen, jalankan semua skenario attack-lab, isi tabel hasil.
- **Hari 7**: tulis laporan (Bagian 6 PDF), rekam video demo (skenario §7 di bawah, 3–5 menit), export
  XLSX, isi README, cek checklist §5 di atas, submit.

---

## 7. Skenario Demo UTS (sesuai PDF)

1. Tandatangani sebuah dokumen PDF (tunjukkan proses generate key sudah dilakukan sebelumnya).
2. Pindai QR-Code hasilnya → tunjukkan verifikasi **berhasil** (nama, jabatan, waktu muncul).
3. Ubah satu karakter isi dokumen PDF → verifikasi lagi → tunjukkan **gagal**, alasan "dokumen diubah".
4. Verifikasi pakai public key yang salah/berbeda → tunjukkan **gagal**, alasan "kunci tidak cocok".
5. (Pengayaan, jika waktu cukup) Tunjukkan alur 2 penandatangan pada satu dokumen dan status masing-
   masing tervalidasi.

---

## 8. Catatan Keamanan Implementasi (wajib dihindari)

- **Jangan** taruh passphrase atau contoh private key di kode — selalu dari form input user.
- **Jangan** simpan private key mentah (plaintext) di mana pun — di memory sekalipun, minimalkan waktu
  hidup variabel plaintext-nya (dekripsi → langsung dipakai sign → buang referensi).
- **Boleh** pakai `node:crypto` penuh untuk ECDSA, SHA-256, scrypt, AES-GCM, `randomBytes` — ini
  primitif kriptografi yang PDF izinkan pakai library teruji.
- Pastikan `documentHash` dihitung dari **konten PDF sebelum QR ditempelkan** (kalau dihitung setelah
  QR ditempel, maka setiap kali PDF dibuka-simpan ulang, hash akan berubah karena QR image berubah
  posisi/metadata — desain ini harus dipikirkan tim di awal, diskusikan sebelum coding dimulai).
- Jangan gunakan MD5/SHA-1 untuk hashing dokumen — wajib SHA-256.

---

## 9. Dependencies untuk ditambahkan

```bash
cd ~/digital-signature-project
npm install pdf-lib qrcode jsqr exceljs
npm install -D vitest @vitest/ui
```

`node:crypto` tidak perlu instalasi (built-in Node.js).