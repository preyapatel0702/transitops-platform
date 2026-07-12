import PDFDocument from "pdfkit";

export interface PdfSummaryItem {
  label: string;
  value: string | number;
}

/**
 * Renders an optional KPI summary grid followed by a paginated data table,
 * with a numbered footer ("Page X of Y") on every page.
 * Minimal-dependency approach: one shared renderer for every exportable entity.
 */
export function generateTablePdf(
  title: string,
  rows: Record<string, unknown>[],
  summary?: PdfSummaryItem[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape", bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).fillColor("#000").text(title, { align: "left" });
    doc.fontSize(9).fillColor("#666").text(`Generated ${new Date().toLocaleString()}`);
    doc.moveDown(0.5);
    doc.fillColor("#000");

    if (summary && summary.length > 0) {
      drawSummary(doc, summary);
      doc.moveDown(0.5);
    }

    if (rows.length === 0) {
      doc.fontSize(11).text("No records found.");
      finalizeWithPageNumbers(doc);
      return;
    }

    const columns = Object.keys(rows[0]);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / columns.length;
    const rowHeight = 20;

    const formatCell = (value: unknown): string => {
      if (value === null || value === undefined) return "-";
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      return String(value);
    };

    const drawHeader = () => {
      const y = doc.y;
      doc.fontSize(8).fillColor("#fff");
      doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill("#1f2937");
      columns.forEach((col, i) => {
        doc.fillColor("#fff").text(col, doc.page.margins.left + i * colWidth + 4, y + 6, {
          width: colWidth - 8,
          ellipsis: true,
        });
      });
      doc.y = y + rowHeight;
      doc.fillColor("#000");
    };

    drawHeader();

    rows.forEach((row, idx) => {
      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      if (idx % 2 === 0) {
        doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill("#f3f4f6");
      }
      doc.fillColor("#000").fontSize(8);
      columns.forEach((col, i) => {
        doc.text(formatCell(row[col]), doc.page.margins.left + i * colWidth + 4, y + 6, {
          width: colWidth - 8,
          ellipsis: true,
        });
      });
      doc.y = y + rowHeight;
    });

    finalizeWithPageNumbers(doc);
  });
}

/**
 * Renders KPI values as a card grid (4 per row) above the table.
 */
function drawSummary(doc: PDFKit.PDFDocument, summary: PdfSummaryItem[]) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const cols = 4;
  const cardWidth = pageWidth / cols;
  const cardHeight = 38;
  const startY = doc.y;

  summary.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = doc.page.margins.left + col * cardWidth;
    const y = startY + row * cardHeight;

    doc.rect(x, y, cardWidth - 6, cardHeight - 6).fillAndStroke("#f3f4f6", "#e5e7eb");
    doc.fillColor("#6b7280").fontSize(7).text(item.label, x + 6, y + 6, { width: cardWidth - 18 });
    doc.fillColor("#111827").fontSize(12).text(String(item.value), x + 6, y + 17, { width: cardWidth - 18 });
  });

  const rowsUsed = Math.ceil(summary.length / cols);
  doc.y = startY + rowsUsed * cardHeight + 4;
  doc.fillColor("#000");
}

/**
 * Second pass over every buffered page to stamp "Page X of Y" in the footer —
 * pdfkit doesn't know the total page count until the document is fully laid out.
 */
function finalizeWithPageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.height - doc.page.margins.bottom + 12;
    doc.fontSize(8).fillColor("#999").text(
      `Page ${i - range.start + 1} of ${range.count}`,
      doc.page.margins.left,
      bottom,
      { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: "center" }
    );
  }
  doc.end();
}

export function pdfResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
