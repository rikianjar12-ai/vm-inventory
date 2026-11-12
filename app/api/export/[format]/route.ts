import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  cellValue,
  getExportDataset,
  stamp,
  xmlEscape,
} from "@/lib/export";
import type { InventoryColumn, VirtualMachine } from "@/lib/types";

export const dynamic = "force-dynamic";

function excelXml(columns: InventoryColumn[], rows: VirtualMachine[]) {
  const header = columns
    .map(
      (col) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(col.label)}</Data></Cell>`
    )
    .join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map(
          (col) =>
            `<Cell><Data ss:Type="String">${xmlEscape(cellValue(row, col))}</Data></Cell>`
        )
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#123E68" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="VM Inventory">
  <Table>
   <Row>${header}</Row>
   ${body}
  </Table>
 </Worksheet>
</Workbook>`;
}

function wordHtml(columns: InventoryColumn[], rows: VirtualMachine[]) {
  const head = columns
    .map((col) => `<th>${xmlEscape(col.label)}</th>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((col) => `<td>${xmlEscape(cellValue(row, col))}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:w="urn:schemas-microsoft-com:office:word"
 xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<title>VM Inventory</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; }
  h1 { font-size: 18pt; }
  table { border-collapse: collapse; width: 100%; font-size: 10pt; }
  th, td { border: 1px solid #999; padding: 6px; text-align: left; }
  th { background: #123E68; color: #fff; }
</style>
</head>
<body>
<h1>Inventory Server — LRT Jabodebek</h1>
<p>Diekspor ${new Date().toLocaleString("id-ID")}</p>
<table>
  <thead><tr>${head}</tr></thead>
  <tbody>${body || `<tr><td colspan="${columns.length}">Tidak ada data</td></tr>`}</tbody>
</table>
</body>
</html>`;
}

function pdfEscape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function buildPdf(columns: InventoryColumn[], rows: VirtualMachine[]) {
  const pageW = 842;
  const pageH = 595;
  const margin = 28;
  const colCount = Math.max(columns.length, 1);
  const usable = pageW - margin * 2;
  const colW = usable / colCount;
  const fontSize = colCount > 10 ? 6 : colCount > 7 ? 7 : 8;
  const rowH = 16;
  const rowsPerPage = Math.max(1, Math.floor((pageH - margin * 2 - 40) / rowH) - 1);

  const chunks: VirtualMachine[][] = [];
  if (rows.length === 0) chunks.push([]);
  else {
    for (let i = 0; i < rows.length; i += rowsPerPage) {
      chunks.push(rows.slice(i, i + rowsPerPage));
    }
  }

  const drawRow = (y: number, values: string[], header: boolean) => {
    let x = margin;
    let ops = "";
    values.forEach((value) => {
      const maxChars = Math.max(4, Math.floor(colW / (fontSize * 0.52)));
      const text = pdfEscape(value).slice(0, maxChars);
      if (header) {
        ops += `0.07 0.24 0.41 rg ${x.toFixed(1)} ${y.toFixed(1)} ${colW.toFixed(1)} ${rowH} re f\n`;
        ops += `1 1 1 rg BT /F1 ${fontSize} Tf ${(x + 3).toFixed(1)} ${(y + 5).toFixed(1)} Td (${text}) Tj ET\n`;
      } else {
        ops += `0.90 0.93 0.96 rg ${x.toFixed(1)} ${y.toFixed(1)} ${colW.toFixed(1)} ${rowH} re f\n`;
        ops += `0 0 0 rg BT /F1 ${fontSize} Tf ${(x + 3).toFixed(1)} ${(y + 5).toFixed(1)} Td (${text}) Tj ET\n`;
      }
      x += colW;
    });
    return ops;
  };

  const pageStreams = chunks.map((chunk, pageIndex) => {
    let y = pageH - margin - 14;
    let content = `BT /F1 12 Tf ${margin} ${y} Td (Inventory Server - LRT Jabodebek) Tj ET\n`;
    y -= 14;
    content += `BT /F1 8 Tf ${margin} ${y} Td (Halaman ${pageIndex + 1} / ${chunks.length}) Tj ET\n`;
    y -= 22;
    content += drawRow(
      y,
      columns.map((c) => c.label),
      true
    );
    y -= rowH;
    if (chunk.length === 0) {
      content += `0 0 0 rg BT /F1 9 Tf ${margin} ${y} Td (Tidak ada data) Tj ET\n`;
    } else {
      for (const row of chunk) {
        content += drawRow(
          y,
          columns.map((c) => cellValue(row, c)),
          false
        );
        y -= rowH;
      }
    }
    return content;
  });

  const objects: string[] = [];
  const pageObjectNumbers = pageStreams.map((_, i) => 4 + i * 2);
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageStreams.length} >>`
  );
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pageStreams.forEach((stream, i) => {
    const contentId = pageObjectNumbers[i] + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    const length = Buffer.byteLength(stream, "latin1");
    objects.push(`<< /Length ${length} >>\nstream\n${stream}endstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ format: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Harus login" }, { status: 401 });
  }
  const { format } = await params;
  const { columns, rows } = await getExportDataset();
  const name = `vm-inventory-${stamp()}`;

  if (format === "excel") {
    const body = excelXml(columns, rows);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.xls"`,
      },
    });
  }

  if (format === "word") {
    const body = wordHtml(columns, rows);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.doc"`,
      },
    });
  }

  if (format === "pdf") {
    const body = buildPdf(columns, rows);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Format tidak didukung" }, { status: 400 });
}
