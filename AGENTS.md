<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

## Sumber kebenaran spesifikasi

**`TASK.md` di root project adalah spesifikasi utama tugas ini.** Sebelum mengerjakan fitur apa pun,
baca `TASK.md` terlebih dahulu — jangan berasumsi. Jika instruksi di prompt user bertentangan dengan
`TASK.md`, tanyakan konfirmasi ke user sebelum melanjutkan, karena `TASK.md` mencerminkan requirement
dosen yang tidak boleh menyimpang tanpa sepengetahuan user.

Bagian yang WAJIB dibaca ulang sebelum mengerjakan modul terkait:
- Sebelum kerja di `lib/crypto/*` → baca §3.1 dan §1.3 di TASK.md (kenapa boleh pakai library di sini)
- Sebelum kerja di `lib/pdf/*` atau `lib/qrcode/*` → baca §3.2 dan §3.3
- Sebelum kerja di `lib/pdf/multi-signer.ts` atau `app/multi-sign` → baca §3.4 (opsi chained vs
  independent hashing — desain ini menentukan struktur data signature)
- Sebelum kerja di `app/attack-lab` → baca §3.5
- Sebelum submit / final check → baca §5 (Checklist Pemetaan ke Rubrik)

## Stack & Constraints

- Next.js 16 App Router, TypeScript, satu bahasa (JavaScript/TypeScript) — tidak ada endpoint bahasa
  lain.
- Primitif kriptografi (ECDSA P-256, SHA-256, AES-GCM, scrypt) **boleh dan seharusnya** pakai
  `node:crypto` bawaan — ini pengecualian eksplisit yang diizinkan tugas, BUKAN pelanggaran. Jangan
  reinvent implementasi kurva eliptik atau hashing sendiri.
- PDF manipulation: `pdf-lib`. QR-Code: `qrcode` (generate) + `jsqr` (decode).
- Yang HARUS ditulis sendiri (bukan dari library): logika alur (apa yang di-hash, kapan sign, urutan
  verifikasi, skema payload QR, logika multi-signer/chained hashing). Ini bagian yang dinilai sebagai
  "kebenaran implementasi", bukan sekadar pemanggilan API crypto.

## Konvensi Kode

- Fungsi crypto inti (`sign`, `verify`, `hashDocument`, `encryptPrivateKey`, `decryptPrivateKey`) harus
  pure function: input Buffer/string/key → output Buffer/boolean, tanpa side effect I/O. Memudahkan
  unit test.
- API routes di `app/api/**/route.ts` hanya orkestrasi: parse `request.formData()` → panggil fungsi di
  `lib/` → kembalikan response. Jangan taruh logic crypto/PDF di dalam route handler.
- Private key **tidak boleh** ditulis ke disk dalam bentuk plaintext dalam kondisi apa pun, termasuk
  saat testing/debugging — pakai key dummy yang di-generate ulang tiap kali test dijalankan, bukan
  disimpan sebagai fixture file.
- Setiap fungsi baru di `lib/crypto/` atau `lib/pdf/multi-signer.ts` wajib punya unit test pendamping
  di `test/` sebelum dianggap selesai (target total ≥5 test — syarat wajib tugas).

## Keamanan (jangan dilanggar meski diminta mempercepat development)

- Jangan hardcode passphrase, private key, atau contoh key apa pun di kode sumber — selalu dari input
  form/env, dan private key selalu dalam bentuk terenkripsi saat disimpan/diunduh.
- Jangan gunakan MD5/SHA-1 untuk hashing dokumen — wajib SHA-256.
- Pastikan `documentHash` selalu dihitung dari konten PDF **sebelum** QR-Code ditempelkan (lihat
  catatan §8 TASK.md) — kesalahan urutan ini akan membuat verifikasi selalu gagal meski dokumen tidak
  diubah.
- Sebelum commit, pastikan tidak ada key/secret di history — cek `.gitignore` mencakup `.env*` dan
  folder key dummy hasil testing manual (jika ada).

## Alur Kerja yang Disarankan

1. Baca bagian relevan `TASK.md`.
2. Implementasi di `lib/` dulu (pure logic), tulis unit test, pastikan lolos — termasuk kasus negatif
   (passphrase salah, tamper, kunci salah) bukan cuma happy path.
3. Baru wire ke `app/api/`.
4. Baru wire ke UI di `app/`.
5. Update `hasil-uji/` dan checklist §5 TASK.md kalau ada fitur yang selesai.

## Command

```bash
npm run dev          # jalankan dev server
npx vitest run        # jalankan semua unit test
npx vitest watch       # unit test mode watch selama development
```

## Catatan untuk Agent

- Jangan mengubah struktur folder di §2 TASK.md tanpa alasan kuat — struktur ini sudah dipetakan ke
  pembagian kerja tim (2-3 anggota) dan ke rubrik penilaian (§5).
- Kalau ragu antara "cepat tapi menyimpang dari TASK.md" vs "sesuai TASK.md tapi lebih lama", selalu
  pilih sesuai TASK.md — nilai tugas ini dinilai berdasarkan kesesuaian dengan spesifikasi, bukan
  kecepatan development.
- Keputusan desain multi-signer (chained vs independent hashing, §3.4 TASK.md) sudah difinalisasi
  sebagai **chained** — jangan ganti ke independent tanpa didiskusikan ulang dengan user, karena ini
  memengaruhi struktur data signature dan cara laporan menjelaskan "integrity chain".

<!-- END:nextjs-agent-rules -->
