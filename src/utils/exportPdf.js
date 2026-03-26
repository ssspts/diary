// src/utils/exportPdf.js
import jsPDF from "jspdf";
import { TEMPLATES, HANDWRITING_FONTS, loadFontIntoDoc } from "./templates";

/**
 * @param {object} selectedFile – { name, createdAt }
 * @param {Array}  pages        – array of {data, meta:{template, font}} objects
 */
export async function exportPdf(selectedFile, pages) {
  if (!selectedFile || !pages?.length) return;

  const pdfdoc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = pdfdoc.internal.pageSize.getWidth();
  const ph = pdfdoc.internal.pageSize.getHeight();

  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    if (index !== 0) pdfdoc.addPage();

    const rawText = typeof page === "string" ? page : (page?.data ?? "");
    const tplKey  = (typeof page === "object" && page?.meta?.template) || "plain";
    const fontKey = (typeof page === "object" && page?.meta?.font)     || "default";
    const tpl     = TEMPLATES[tplKey]  || TEMPLATES.plain;
    const fontDef = HANDWRITING_FONTS[fontKey] || HANDWRITING_FONTS.default;
    const layout  = tpl.layout;

    // ── 1. Draw themed background + ruled lines ────────────────────────────
    tpl.pdfDrawBackground(pdfdoc, pw, ph, layout);

    // ── 2. Load handwriting font into this doc instance ────────────────────
    let fontLoaded = false;
    if (fontDef.ttfUrl) {
      try {
        fontLoaded = await loadFontIntoDoc(pdfdoc, fontKey);
      } catch (e) {
        console.warn("Font load failed, falling back to helvetica:", e.message);
      }
    }

    const bodyFont  = fontLoaded ? fontDef.pdfFont : "helvetica";

    // ── 3. Title ───────────────────────────────────────────────────────────
    pdfdoc.setFontSize(14);
    pdfdoc.setTextColor(tpl.pdfTitleColor);
    // Custom fonts only register "normal" weight — always use helvetica bold for title
    pdfdoc.setFont("helvetica", "bold");
    pdfdoc.text(selectedFile.name || "Diary Entry", layout.leftMargin, 18);

    // ── 4. Date + page number (dimmed, helvetica normal) ───────────────────
    // FIX: setGlobalAlpha doesn't exist in jsPDF — use GState for opacity
    pdfdoc.setFont("helvetica", "normal");
    pdfdoc.setFontSize(8);
    pdfdoc.setTextColor(tpl.pdfTextColor);

    const dimState = new pdfdoc.GState({ opacity: 0.55 });
    pdfdoc.setGState(dimState);
    pdfdoc.text(new Date(selectedFile.createdAt).toDateString(), layout.leftMargin, 26);
    pdfdoc.text(
        `Page ${index + 1} of ${pages.length}`,
        pw - layout.rightMargin, 26,
        { align: "right" }
    );
    // Reset opacity to fully opaque
    pdfdoc.setGState(new pdfdoc.GState({ opacity: 1 }));

    // ── 5. Body text — one line per ruled baseline ─────────────────────────
    pdfdoc.setFont(bodyFont, "normal");
    pdfdoc.setFontSize(layout.fontSize);
    pdfdoc.setTextColor(tpl.pdfTextColor);

    const textWidth = pw - layout.leftMargin - layout.rightMargin;
    const allLines  = pdfdoc.splitTextToSize(rawText || "", textWidth);
    const maxLines  = Math.floor((ph - layout.firstLineY - 14) / layout.lineSpacing);

    allLines.slice(0, maxLines).forEach((line, i) => {
      pdfdoc.text(line, layout.leftMargin, layout.firstLineY + i * layout.lineSpacing);
    });

    // ── 6. Truncation notice ───────────────────────────────────────────────
    if (allLines.length > maxLines) {
      pdfdoc.setFont("helvetica", "italic");
      pdfdoc.setFontSize(7.5);
      pdfdoc.setTextColor(150, 150, 150);
      pdfdoc.text("(continued on next page…)", layout.leftMargin, ph - 8);
    }
  }

  const safeName = (selectedFile.name || "diary").replace(/[^a-z0-9_-]/gi, "_");
  pdfdoc.save(`${safeName}.pdf`);
}