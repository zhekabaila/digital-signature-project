# Cara Kerja Project Ini — Penjelasan dari Nol

> Ditulis berdasarkan pembacaan ulang seluruh kode di repo ini.
> Setiap klaim di bawah bisa dicek di file & fungsi yang disebut namanya.
> Project: **Studio Tanda Tangan Digital** — ECDSA P-256 + SHA-256 + QR-Code + Multi-Signer chained
> (Tugas Keamanan Informasi, Universitas Siliwangi, spesifikasi di `TASK.md`).

---

## 0. gambaran besar: masalah apa yang diselesaikan?

Bayar tanda tangan basah di atas kertas bisa dipalsukan, dan dokumen digital
bisa diedit diam-diam lalu dikirim ulang. Pertanyaan yang dijawab aplikasi ini:

1. **Apakah dokumen ini benar-benar ditandatangani oleh orang yang tertera?**
2. **Apakah isinya masih utuh sejak ditandatangani (tidak diubah 1 karakter pun)?**

Jawabannya dibangun dari dua primitif matematika:

| Primitif |-library yang dipakai | Peran |
|---|---|---|
| **SHA-256** (hash/fingerprint konten) | `node:crypto` → `lib/crypto/hash.ts` | mengubah dokumen berapa pun jadi "ringkasan" 32 byte yang berubah total jika 1 bit saja berbeda |
| **ECDSA P-256** (tanda tangan asimetrik) | `node:crypto` → `lib/crypto/sign-verify.ts` | hanya private key yang bisa menghasilkan signature; hanya public key pasangannya yang bisa mengesahkannya |

Aturan keamanan proyek (dari `AGENTS.md`): logika *apa yang di-hash, kapan sign,
urutan verifikasi* ditulis sendiri (itu yang dinilai), tapi primitif matematikanya
wajib pakai `node:crypto` — bukan reinvent elliptic curve.

---

## 1. Peta folder

```
app/                     ← UI (Next.js App Router) + API route tipis
  page.tsx                  beranda: daftar 5 langkah
  keygen/                   buat keypair
  sign/                     tanda tangani 1 dokumen, 1 signer
  verify/                   verifikasi PDF / scan QR kamera
  multi-sign/               beberapa signer berantai + rantai status
  attack-lab/               benchmark + 3 skenario serangan + export XLSX
  api/                      route handler (HANYA orkestrasi: parse form → panggil lib → response)
    keys/generate, sign, verify, multi-sign/add, multi-sign/status,
    benchmark, export-xlsx

lib/                     ← SEMUA logic sebenarnya ada di sini (pure function)
  crypto/
    hash.ts                 sha256Hex, sha256Digest, hashForSigner (chained)
    keypair.ts              generateKeypair, fingerprint, export/import .dsk
    key-protection.ts       AES-256-GCM + scrypt untuk private key
    sign-verify.ts          signData / verifySignature + helper attack
  pdf/
    pdf-utils.ts            kanonisasi byte, metadata /DSig, halaman QR
    multi-signer.ts         signDocument / verifyAllSignatures / verifyQrPayload
    sign-session-store.ts   penyimpanan sementara PDF di memori (untuk status multi-sign)
  qrcode/qr-utils.ts        bikin PNG QR, decode QR, validasi bentuk payload
  metrics/timing.ts         measure(fn, n) untuk benchmark
  server/sign-form.ts       parser form sign (route handler tetap tipis)

test/                    ← 37 unit test (vitest), wajib lolos
scripts/                 ← generate-data-uji.mts & run-tests.mts → folder hasil-uji/
hasil-uji/               ← laporan hasil pengujian (json/md/xlsx) untuk lampiran
```

Arah alurnya selalu: **halaman UI → `app/api/.../route.ts` (tipis) → `lib/...` (logic) → hasil**.

---

## 2. Konsep dasar yang sering ditanyakan

### 2.1 Apa itu private key & public key, dan bedanya dengan password biasa?

ECDSA menghasilkan **sepasang** kunci yang saling terkait secara matematika
(kurva elips P-256):

- **Private key** — rahasia, hanya boleh diketahui signer. Fungsinya *menghasilkan*
  signature. Di kode: PKCS#8 DER, disimpan **selalu terenkripsi** dalam file `.dsk`
  (`lib/crypto/keypair.ts` → `generateKeypair`).
- **Public key** — boleh disebar ke siapa pun. Fungsinya *memeriksa* signature.
  Format SPKI/PEM (`-----BEGIN PUBLIC KEY-----`).

Sifat kuncinya: signature yang dibuat private key A **hanya** bisa diverifikasi
public key A. Kalau verifikasi pakai public key B → selalu gagal. Inilah dasar
"siapa yang menandatangani": hanya pemilik private key A yang bisa menghasilkan
signature yang sah untuk A, jadi identitas signer melekat pada matematikanya,
bukan pada tulisan nama.

### 2.2 Fingerprint itu hasil dari apa? Kenapa harus ada?

Didefinisikan di `lib/crypto/keypair.ts` → `fingerprintFromPublicKeyPem`:

```
fingerprint = 16 karakter hex pertama dari SHA-256( public key dalam bentuk DER/SPKI )
```

- **Hasil dari apa?** Dari *public key*, bukan dari private key dan bukan dari dokumen.
- **Kegunaannya:**
  1. Cara singkat bagi manusia untuk mengenali kunci. SHA-256 penuh = 64 hex,
     merepotkan; 16 hex pertama cukup unik untuk demo/pencocokan visual.
  2. Muncul di pesan error saat uji "kunci salah" di verifikasi
     (`multi-signer.ts` → alasan *"fingerprint signer: ..."*) supaya jelas
     dokumen ini aslinya ditandatangani oleh kunci yang mana.
  3. **Ikut ditandatangani** (ada di `metaSignableBytes`), jadi memalsukan
     pasangan kunci di payload juga membatalkan signature.

### 2.3 Apa itu "hash dokumen" (documentHash)?

`sha256Digest(kanonik byte PDF)` → 32 byte, ditulis hex (64 karakter) di payload.
Ini "sidik jari konten". Kalau dokumen berubah 1 karakter pun, hash-nya berubah
total (efek avalanche), sehingga verifikasi bisa mengklaim: *isi masih utuh*.

### 2.4 Kenapa harus ada "kanonisasi" byte? (`computeCanonicalBytes`, lib/pdf/pdf-utils.ts)

Masalah: file PDF tidak bisa di-hash mentah-mentah, karena:

- menyimpan metadata waktu (ModDate) yang bisa berubah tanpa isi berubah;
- tanda tangan kita sendiri (halaman QR + metadata) ikut menjadi byte →
  hash akan berbeda terus dan verifikasi tidak akan pernah cocok.

Solusi: **bentuk kanonik** = versi PDF yang dibersihkan secara deterministic:

1. buang key metadata `/DSig` (tempat kita menyimpan data signature);
2. buang semua halaman tanda tangan (sisakan hanya `origPageCount` halaman asli);
3. salin halaman-halaman itu ke dokumen PDF *baru* tanpa metadata
   (`PDFDocument.create({ updateMetadata: false })` — wajib, tanpa ini hasil
   hash flaky karena timestamp detik).

Sign dan verify menghitung kanonisasi dengan resep yang sama → kalau isi asli
sama, hash pasti sama; kalau isi diubah, hash pasti beda.

---

## 3. Format data di project ini (benda-benda yang "disimpan")

### 3.1 File `.dsk` (private key terenkripsi) — `lib/crypto/key-protection.ts`

```
base64( "DSG1" | salt(16B) | iv(12B) | authTag(16B) | ciphertext )
ciphertext = AES-256-GCM( JSON { d: privatekey-DER-base64, p: public-key-PEM } )
key AES   = scryptSync(passphrase, salt, 32)
```

- **scrypt** mengubah passphrase → key 32 byte; salt acak per file (passphrase
  sama → file berbeda).
- **AES-GCM** mendeteksi file rusak / passphrase salah lewat authTag →
  error `"Gagal dekripsi: passphrase salah atau file rusak"`.
- Public key ikut di dalam bundel karena saat sign, payload QR membutuhkan
  pasangan publiknya; private key plaintext tidak pernah ditulis ke disk,
  dan buffer-nya di-zero (`fill(0)`) segera setelah dipakai sign.

### 3.2 Metadata `/DSig` di dalam PDF — `pdf-utils.ts` + `multi-signer.ts`

Di PDF catalog, key custom `DSig` berisi JSON:

```ts
SignInfo = {
  v: 1,
  origPageCount: number,        // jumlah halaman dokumen ASLI
  signatures: SignerPayload[]   // per signer, berurutan sesuai urutan sign
}
```

### 3.3 Payload (isi QR-Code = satu entri signatures[]) 

```ts
SignerPayload = {
  signerName, signerRole, institution, timestamp,  // identitas signer
  documentHash,          // hex SHA-256 digest chained saat sign
  signature,             // base64 DER ECDSA — hasil sign DATA lengkap
  publicKeyFingerprint,  // 16 hex, lihat §2.2
  publicKeyPem           // kunci utk memverifikasi payload ini
}
```

`generateQRPng(JSON.stringify(payload))` (`lib/qrcode/qr-utils.ts`) mengemas JSON
itu menjadi gambar QR PNG yang ditempel ke halaman tanda tangan. QR = salinan
yang bisa di-scan; `/DSig` = salinan yang bisa dibaca mesin.

---

## 4. Alur per halaman + logika di baliknya

### 4.1 Keygen (`/keygen` → `POST /api/keys/generate`)

1. User mengetik passphrase (≥ 8 karakter, diverifikasi UI & server).
2. `exportEncryptedKeyBundle(passphrase)`:
   - `generateKeyPairSync("ec", { namedCurve: "P-256" })` → pasangan kunci;
   - hitung fingerprint dari public key;
   - bungkus private+public jadi satu, enkripsi AES-GCM+scrypt → file `.dsk`;
   - plaintext DER langsung `fill(0)`.
3. Response: `{ publicKeyPem, fingerprint, encryptedPrivateKeyFile }` → UI
   menyediakan unduhan `public-key.pem` dan `private-key.dsk`.

PENTAH: server tidak pernah menyimpan apa pun di langkah ini; keduanya diunduh user.

### 4.2 Sign (`/sign` → `POST /api/sign` → `signDocument`, lib/pdf/multi-signer.ts)

**"Apa yang sebenarnya terjadi saat menandatangani? Apa yang disisipkan?"**
Tiga hal disisipkan, tapi **hash dihitung dulu sebelum penyisipan** (kesalahan
urutan ini = verifikasi selalu gagal; lihat catatan §8 TASK.md):

```
(a) canonical = computeCanonicalBytes(pdf)            // bersihkan → tinggal halaman asli
(b) digest    = SHA256(canonical ‖ sig_1 ‖ … ‖ sig_{i-1})   // chained, §4.4
(c) metaBytes = JSON.stringify([nama, jabatan, institusi, timestamp, fingerprint])
(d) DATA      = digest ‖ metaBytes                    // DUA potongan digabung
(e) signature = ECDSA-P256-SHA256( DATA, private key )
```

Yang kemudian **disisipkan ke dokumen**:

1. **Halaman tanda tangan baru** (paling akhir): gambar QR-Code berisi payload
   JSON + teks "Halaman Tanda Tangan Digital — {nama}", identitas signer, dan
   keterangan "Scan QR untuk verifikasi…". (`embedSignaturePage`, A4, Helvetica.)
2. **Metadata `/DSig`** di PDF catalog: `SignInfo` dengan payload signer baru
   ditambahkan ke array `signatures`.
3. QR PNG + signature DER-nya ±70 byte; hasil akhir PDF diturunkan sebagai
   `signed-document.pdf` (+ header `X-Document-Id` untuk alur multi-sign).

Perhatikan poin (d): yang ditandatangani **bukan cuma hash dokumen**, tapi
hash ‖ identitas signer. Jadi memalsukan *nama/institusi/waktu di payload*
juga membatalkan signature — itu yang dipakai menyerang "QR dipalsukan" §4.6.

### 4.3 Verify (`/verify` → `POST /api/verify`)

**"Credential apa saja yang diverifikasi, diambil dari mana, dan bagaimana caranya?"**

Input: PDF tertanda (atau payload hasil scan QR). Opsional: `publicKeyPem` override.

Verifikasi lewat PDF (`verifyAllSignatures`) mengecek 2 lapis, berurutan:

| Lapis | Pertanyaan | Cara | Sumber data |
|---|---|---|---|
| 1 — integritas dokumen | Apakah isi berubah setelah ditandatangani? | hitung ulang `digest'` dari file yang diunggah (kanonisasi + chained digest yang sama seperti §4.2), bandingkan dengan `documentHash` tersimpan | `documentHash` ← metadata `/DSig` (juga tercetak di QR); konten ← halaman asli PDF |
| 2 — keaslian signer | Apakah signature ini benar dibuat oleh pemilik public key ini? | `verifySignature(DATA', signature, publicKeyPem)` — rekonstruksi `DATA' = digest' ‖ metaBytes(payload)`, lalu ECDSA verify | `signature`, `publicKeyPem` ← payload `/DSig`; kalau ada override → pakai key unggahan user |

Alasan penolakan berbeda, dan itu disengaja:

- hash beda → **"Dokumen telah diubah setelah ditandatangani (hash tidak cocok)"**
- hash cocok tapi ECDSA gagal → **"Tanda tangan tidak cocok dengan kunci publik…"**
  (dengan fingerprint signer) / **"Tanda tangan tidak valid (dipalsukan…)"**.

Multi-signer: loop per entri `signatures[i]`, masing-masing memakai publik key-nya
sendiri dan digest chained-nya sendiri; `valid = semua signer valid`.

**Scan QR dengan kamera** (panel kanan halaman Verify): halaman `verify` membuka
kamera (`getUserMedia`), tiap frame dikirim ke `<canvas>` → `jsQR` decode.
Kalau ketemu QR, payload-nya dikirim sebagai `qrPayload` → server menjalankan
`verifyQrPayload` yang **hanya bisa** membuktikan lapis 2 (signature sah terhadap
public key di payload, dan data identitas tidak diubah) — keutuhan dokumen fisik
tidak bisa dibuktikan tanpa PDF-nya, karena itu UI menampilkan catatan itu juga.

### 4.4 Multi-Signer (`/multi-sign` → `POST /api/multi-sign/add` + `GET /api/multi-sign/status`)

Skema **chained** (TASK.md §3.4 Opsi A, sudah finalisasi — jangan diganti):

```
signer 1: digest₁ = SHA256(kanonik)
signer 2: digest₂ = SHA256(kanonik ‖ sig₁)
signer 3: digest₃ = SHA256(kanonik ‖ sig₁ ‖ sig₂)
```

Efeknya:

- **urutan tanda tangan terkunci** — sisip tukar signer 2 dan 1 mengubah digest₂/₃ → gagal;
- **buang salah satu tanda tangan** → signer berikutnya kehilangan `sig` yang harusnya
  ikut di-hash → gagal;
- dokumen lama ikut menandatangani "riwayat" signer sebelumnya — seperti dokumen
  yang distaples rangkap.

Alur UI: upload PDF → signer pertama sign (dokumen aktif di browser diganti blob
hasil), lalu signer kedua upload `.dsk`-nya sendiri → tombol "Tanda Tangani
(Signer ke-N)" memanggil `/api/multi-sign/add` (logic-nya sama persis dengan
`signDocument` — alur sign tunggal dan multi identik karena chained). Respons
membawa `X-Document-Id`; frontend memanggil `GET /api/multi-sign/status?docId=…`
untuk menggambar "rantai" (panel kanan). Store status ada di
`lib/pdf/sign-session-store.ts`: **hanya di memori server** (TTL 1 jam, hilang
saat restart — cukup untuk demo; private key tidak pernah masuk store ini),
dengan fallback verifikasi ulang via `/api/verify` bila sesi habis.

### 4.5 Attack Lab — bagian A: Benchmark sign & verify

**"Apa gunanya iterasi?"** Satu kali pengukuran tidak berarti: waktu eksekusi
berfluktuasi (GC, CPU load, panas laptop). `measure()` (`lib/metrics/timing.ts`)
menjalankan fungsi **N kali** (UI default 30, server membatasi 1–500; syarat
tugas §3.5 minimal 30), lalu melaporkan `avg/min/max` dari semua sampel.
Jadi angka "sign ≈ 50–70 ms" yang muncul adalah *rata-rata statistik*, bukan one-shot.

Yang diukur `/api/benchmark`:

- `avgSignMs/min/max` — N× `signDocument` penuh pada dokumen yang sama;
- `avgVerifyMs/min/max` — N× `verifyAllSignatures` atas hasil sign pertama
  (kenapa verify jauh lebih cepat? tidak ada pembuatan key EC baru per iterasi
  dan tidak ada scrypt; sign mencakup pembangkitan nonce + operasi kurva dua arah);
- `signatureSizeBytes` (≈70–72 B, DER ECDSA P-256), `publicKeySizeBytes`
  (91 B, SPKI DER), ukuran dokumen sebelum/sesudah.

### 4.6 Attack Lab — bagian B–D: Skenario serangan

Idenya: **serang sistemmu sendiri dan buktikan setiap serangan DITOLAK.**
Butuh satu PDF bertanda tangan (hasil dari halaman Sign). Hasil tiap skenario
masuk ke tabel, bisa diekspor XLSX (`POST /api/export-xlsx`, ExcelJS) untuk
lampiran laporan. Label kolom "Hasil": `LOLOS` berarti **sistem berhasil menolak
serangan** (kode menandai LOLOS bila `valid === false`); `DITOLAK` di kolom itu
justru berarti penyerang berhasil — yang tidak boleh terjadi.

- **Uji tamper 1 karakter** (`runTamper`): di *browser*, `pdf-lib` membuka PDF
  tertanda, menggambar teks `"TAMPERED-by-attack-lab"` di halaman 1, menyimpan
  ulang → file dikirim ke `/api/verify`. Kanonisasi membaca halaman asli → byte
  berubah → `digest' ≠ documentHash` → lapis 1 menolak: *"dokumen diubah"*.
- **Uji kunci publik salah** (`runWrongKey`): panggil `/api/keys/generate`
  dengan passphrase sekali-pakai `crypto.randomUUID()` (key buang-buang, tidak
  pernah disimpan — aturan no-fixtures), dapat public key *lain*, lalu verifikasi
  PDF yang sama dengan `publicKeyPem` override. Lapis 1 lolos (dokumen utuh),
  tapi ECDSA fail → lapis 2 menolak dengan pesan "kunci tidak cocok".
  Inilah bukti bahwa penyerang tidak bisa mengaku signer hanya dengan menyodorkan kunci sendiri.
- **Uji QR dipalsukan** (`runForgedQr`): baca metadata `/DSig` dari PDF,
  ubah `signerName` jadi `"Penyusup Attack Lab"` di payload JSON (seolah orang
  mem-print QR palsu), kirim sebagai `qrPayload` → `verifyQrPayload` menyusun
  kembali `DATA = digest ‖ metaBytes(payload yang sudah diubah)`. Karena
  metaBytes ikut ditandatangani (§4.2 poin c–d), signature ECDSA tidak cocok →
  ditolak. Ini membuktikan identitas signer tidak bisa diedit di QR.

---

## 5. Fitur-fitur lain yang ada tapi tidak sempat kamu sebut

1. **Verifikasi via scan kamera** — sudah dibahas §4.3; fitur UI nyata dengan
   `getUserMedia` + jsQR per-frame.
2. **Status rantai multi-sign via docId** — `GET /api/multi-sign/status` §4.4.
3. **Export XLSX** di Attack Lab (juga dipakai `scripts/` untuk laporan).
4. **`scripts/generate-data-uji.mts` & `scripts/run-tests.mts`** → menghasilkan
   `hasil-uji/hasilmengujian.{json,md,xlsx}` (angka benchmark + tabel serangan
   otomatis, untuk lampiran laporan/lslide demo).
5. **37 unit test di `test/`** (vitest) — termasuk kasus negatif yang wajib
   tugas: passphrase salah, tamper byte-level (meng-flip 1 byte stream halaman
   lalu memastikan verify gagal), reorder signature, payload QR rusak.
   Ini bagian "≥5 test" di rubrik; jalankan `npx vitest run`.
6. **Beranda 5 langkah** (`app/page.tsx`) dan **design system** tema kertas/batik
   (`app/globals.css`, `components/ui.tsx`, `components/site-nav.tsx`).
7. **README.md** — dokumentasi lengkap + script demo §7.
8. **Keamanan di level kode** (bukan fitur UI, tapi bagian sistem): private key
   tidak pernah plaintext di disk, buffer `fill(0)` setelah sign, tidak ada
   secret di source, route handler tipis (logic semua di `lib/`).

---

## 6. Rangkuman satu paragraf (untuk menjawab dosen)

> Setiap signer memiliki pasangan kunci ECDSA P-256; private key disimpan
> terenkripsi AES-256-GCM dengan passphrase yang diturunkan via scrypt (file
> `.dsk`), public key bebas dibagikan. Saat menandatangani, konten asli PDF
> dibersihkan ke bentuk kanonik yang deterministik, di-hash SHA-256 bersama
> seluruh signature signer sebelumnya (skema chained), lalu hash ‖ identitas
> signer ditandatangani; hasilnya beserta public key dan fingerprint dikemas
> jadi payload JSON yang dicetak sebagai QR-Code di halaman tanda tangan baru
> dan disimpan di metadata `/DSig`. Verifikasi menghitung ulang hash dan
> memeriksa ECDSA — dua lapis penolakan yang terpisah pesannya: dokumen diubah
> vs kunci tidak cocok. Attack Lab membuktikan ketiganya dengan serangan nyata
> (tamper byte, kunci salah, QR palsu), plus benchmark timing ≥30 iterasi
> untuk menunjukkan performa dan ukuran artefak.
