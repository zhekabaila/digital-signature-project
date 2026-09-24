/**
 * Penyimpanan IN-MEMORI sementara untuk alur multi-signer (§4: GET
 * /api/multi-sign/status?docId=...). Dokumen TIDAK pernah disimpan di disk;
 * isi memori hilang saat server restart — cukup untuk demo perkuliahan.
 * Private key tidak pernah menyentuh store ini.
 */
const g = globalThis as unknown as {
  __dsigStore?: Map<string, { bytes: Buffer; filename: string; updatedAt: number }>;
};

function store() {
  if (!g.__dsigStore) g.__dsigStore = new Map();
  return g.__dsigStore;
}

export function putDocument(id: string, bytes: Buffer, filename: string): void {
  const s = store();
  s.set(id, { bytes, filename, updatedAt: Date.now() });
  for (const [k, v] of s) if (Date.now() - v.updatedAt > 60 * 60 * 1000) s.delete(k);
}

export function getDocument(id: string): { bytes: Buffer; filename: string } | null {
  const v = store().get(id);
  return v ? { bytes: v.bytes, filename: v.filename } : null;
}
