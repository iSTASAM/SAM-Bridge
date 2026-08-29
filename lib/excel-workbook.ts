import ExcelJS from "exceljs";

type SheetRows = {
  name: string;
  rows: Array<Record<string, unknown>>;
};

function sheetName(name: string) {
  return name.replace(/[\\/*?[\]:]/g, "_").slice(0, 31) || "Sheet1";
}

export async function buildExcelWorkbook(sheets: SheetRows[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SAM Bridge";
  workbook.created = new Date();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheetName(sheet.name));
    const columns = [...new Set(sheet.rows.flatMap((row) => Object.keys(row)))];
    if (columns.length === 0) {
      worksheet.addRow(["(no rows)"]);
      continue;
    }
    worksheet.columns = columns.map((header) => ({
      header,
      key: header,
      width: Math.min(28, Math.max(12, header.length + 2)),
    }));
    worksheet.getRow(1).font = { bold: true };
    for (const row of sheet.rows) {
      worksheet.addRow(Object.fromEntries(columns.map((column) => [column, row[column] ?? null])));
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function excelFilename(exportName: string) {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const safe = exportName.trim().replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim() || "SAM-export";
  return `${safe} ${stamp}.xlsx`;
}
