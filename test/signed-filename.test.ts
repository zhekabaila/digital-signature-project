import { describe, it, expect } from "vitest";
import { signedFileName } from "@/lib/server/signed-filename";

describe("signedFileName — nama hasil sign mempertahankan nama dokumen asal", () => {
  it("memberi sufiks -signed sebelum ekstensi", () => {
    expect(signedFileName("laporan-keuangan-bulan-januari.pdf", "signed")).toBe("laporan-keuangan-bulan-januari-signed.pdf");
  });

  it("memberi sufiks -multi-signed", () => {
    expect(signedFileName("skripsi-rina.PDF", "multi-signed")).toBe("skripsi-rina-multi-signed.pdf");
  });

  it("sufiks lama dibuang, tidak menumpuk saat sign ulang", () => {
    const once = signedFileName("a.pdf", "signed");
    expect(signedFileName(once, "multi-signed")).toBe("a-multi-signed.pdf");
    expect(signedFileName("a-multi-signed.pdf", "multi-signed")).toBe("a-multi-signed.pdf");
  });

  it("nama kosong / tanpa ekstensi tetap menghasilkan nama valid", () => {
    expect(signedFileName(undefined, "signed")).toBe("document-signed.pdf");
    expect(signedFileName("", "multi-signed")).toBe("document-multi-signed.pdf");
    expect(signedFileName("dokumen-saya", "signed")).toBe("dokumen-saya-signed.pdf");
  });

  it("karakter yang merusak header Content-Disposition disanitasi", () => {
    expect(signedFileName('la"por\nan.pdf', "signed")).toBe("la_por_an-signed.pdf");
  });
});
