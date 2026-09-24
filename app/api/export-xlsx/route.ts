import ExcelJS from "exceljs";

export const runtime = "nodejs";

/**
 * TASK.md §3.5 "kumpulkan semua hasil ke tabel → tampilkan di UI → export XLSX".
 * Menerima { title, headers: string[], rows: (string|number)[][] } → file .xlsx.
 * (Endpoint pendukung UI; tambahan kecil di luar daftar §2 karena kebutuhan ekspor wajib §3.5.)
 */
export async function POST(request: Request) {
  const { title, headers, rows } = (await request.json()) as {
    title?: string;
    headers: string[];
    rows: (string | number)[][];
  };
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title?.slice(0, 30) || "Hasil Uji");
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true };
  (rows ?? []).forEach((r) => ws.addRow(r));
  ws.columns.forEach((c) => {
    let max = 10;
    c.eachCell?.((cell: ExcelJS.Cell) => (max = Math.max(max, String(cell.value ?? "").length + 2)));
    c.width = Math.min(max, 60);
  });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="hasil-uji-${Date.now()}.xlsx"`,
    },
  });
}
