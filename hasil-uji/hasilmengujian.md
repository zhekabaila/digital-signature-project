# Hasil Pengujian Wajib (TASK.md §3.5)

ECDSA P-256 · SHA-256 · Node.js v24.14.0 · 30 percobaan per dokumen · digenerate: 2026-09-23T00:53:19.189Z

| Dokumen | Ukuran PDF (B) | Ukuran PDF bertanda (B) | Rata2 sign (ms) | Min sign (ms) | Max sign (ms) | Rata2 verify (ms) | Min verify (ms) | Max verify (ms) | Iterasi | Ukuran signature (B) | Ukuran public key SPKI DER (B) | Tamper ditolak | Alasan tamper | Kunci salah ditolak | Alasan kunci salah | QR palsu ditolak |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| surat-keterangan.pdf | 1225 | 25521 | 70.996 | 58.156 | 124.079 | 1.186 | 0.667 | 9.356 | 30 | 72 | 91 | YA | Dokumen telah diubah setelah ditandatangani (hash tidak cocok) | YA | Tanda tangan tidak cocok dengan kunci publik yang diberikan (fingerprint signer: 49229fa9f99bc06f) | YA |
| kontrak-karya.pdf | 1224 | 23588 | 60.003 | 52.689 | 78.532 | 0.83 | 0.685 | 1.288 | 30 | 70 | 91 | YA | Dokumen telah diubah setelah ditandatangani (hash tidak cocok) | YA | Tanda tangan tidak cocok dengan kunci publik yang diberikan (fingerprint signer: 6d1cc32758aee268) | YA |
| hasil-rapat.pdf | 1209 | 23406 | 58.267 | 53.705 | 80.904 | 0.863 | 0.561 | 4.978 | 30 | 72 | 91 | YA | Dokumen telah diubah setelah ditandatangani (hash tidak cocok) | YA | Tanda tangan tidak cocok dengan kunci publik yang diberikan (fingerprint signer: 40255374027f2f10) | YA |
| sertifikat-training.pdf | 1224 | 25581 | 62.357 | 57.419 | 87.263 | 0.935 | 0.626 | 3.355 | 30 | 71 | 91 | YA | Dokumen telah diubah setelah ditandatangani (hash tidak cocok) | YA | Tanda tangan tidak cocok dengan kunci publik yang diberikan (fingerprint signer: 593a2194641f04fe) | YA |
| proposal-penelitian.pdf | 1206 | 25375 | 66.909 | 57.704 | 88.471 | 0.808 | 0.726 | 1.026 | 30 | 72 | 91 | YA | Dokumen telah diubah setelah ditandatangani (hash tidak cocok) | YA | Tanda tangan tidak cocok dengan kunci publik yang diberikan (fingerprint signer: 5913013a077b4424) | YA |