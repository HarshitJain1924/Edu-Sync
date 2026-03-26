import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const groupIntoLines = (items) => {
  const rows = [];
  const yTolerance = 2;

  for (const item of items) {
    const str = String(item?.str || "").trim();
    if (!str) continue;

    const x = Array.isArray(item.transform) ? Number(item.transform[4] || 0) : 0;
    const y = Array.isArray(item.transform) ? Number(item.transform[5] || 0) : 0;

    let row = rows.find((r) => Math.abs(r.y - y) <= yTolerance);
    if (!row) {
      row = { y, entries: [] };
      rows.push(row);
    }

    row.entries.push({ x, str });
  }

  rows.sort((a, b) => b.y - a.y);

  const lines = rows.map((row) => {
    row.entries.sort((a, b) => a.x - b.x);
    return row.entries.map((e) => e.str).join(" ").replace(/\s+/g, " ").trim();
  });

  return lines.filter(Boolean);
};

export const extractPdfText = async (buffer) => {
  let data;
  if (Buffer.isBuffer(buffer)) {
    // pdfjs rejects Node Buffer instances; pass a plain Uint8Array copy.
    data = Uint8Array.from(buffer);
  } else if (buffer instanceof Uint8Array) {
    data = buffer;
  } else {
    data = new Uint8Array(buffer);
  }

  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  const pageTexts = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent({
      normalizeWhitespace: true,
      disableCombineTextItems: false,
    });

    const lines = groupIntoLines(textContent.items || []);
    pageTexts.push(lines.join("\n"));
  }

  return pageTexts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
};
