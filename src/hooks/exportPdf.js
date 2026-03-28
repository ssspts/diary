// src/utils/exportPdf.js
import jsPDF from "jspdf";
import { TEMPLATES, HANDWRITING_FONTS, loadFontIntoDoc } from "./templates";
import {
  HEADER_H_MM, TITLE_Y_MM, DATE_Y_MM, HEADER_LINE_Y,
  FIRST_LINE_Y_MM, LINE_SPACING_MM, LEFT_MARGIN_MM, RIGHT_MARGIN_MM,
  TEXT_WIDTH_MM, MAX_LINES_PER_PAGE, BODY_FONT_SIZE_PT,
  FOOTER_H_MM,
} from "./pageSpec";

/**
 * Export diary pages as a themed PDF.
 * @param {object} selectedFile  – { name, createdAt }
 * @param {Array}  pages         – [{data, meta:{template,font}}, ...]
 */
export async function exportPdf(selectedFile, pages) {
  if (!selectedFile || !pages?.length) return;

  const pdfdoc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = pdfdoc.internal.pageSize.getWidth();   // 210
  const ph = pdfdoc.internal.pageSize.getHeight();  // 297

  for (let index = 0; index < pages.length; index++) {
    const page    = pages[index];
    if (index !== 0) pdfdoc.addPage();

    const rawText = typeof page === "string" ? page : (page?.data ?? "");
    const tplKey  = (typeof page === "object" && page?.meta?.template) || "plain";
    const fontKey = (typeof page === "object" && page?.meta?.font)     || "default";
    const tpl     = TEMPLATES[tplKey]  || TEMPLATES.plain;
    const fontDef = HANDWRITING_FONTS[fontKey] || HANDWRITING_FONTS.default;

    // ── 1. Template background ────────────────────────────────────────────
    // Pass the shared pageSpec layout so ruled lines land on exact same positions
    const pdfLayout = {
      firstLineY:  FIRST_LINE_Y_MM,
      lineSpacing: LINE_SPACING_MM,
      leftMargin:  LEFT_MARGIN_MM,
      rightMargin: RIGHT_MARGIN_MM,
      fontSize:    BODY_FONT_SIZE_PT,
    };
    tpl.pdfDrawBackground(pdfdoc, pw, ph, pdfLayout);

    // ── 2. Load handwriting font ──────────────────────────────────────────
    let fontLoaded = false;
    if (fontDef.ttfUrl) {
      try { fontLoaded = await loadFontIntoDoc(pdfdoc, fontKey); }
      catch (e) { console.warn("Font load failed:", e.message); }
    }
    const bodyFont = fontLoaded ? fontDef.pdfFont : "helvetica";

    // ── 3. Title ──────────────────────────────────────────────────────────
    pdfdoc.setFontSize(13);
    pdfdoc.setTextColor(tpl.pdfTitleColor);
    pdfdoc.setFont("helvetica", "bold");
    pdfdoc.text(selectedFile.name || "Diary Entry", LEFT_MARGIN_MM, TITLE_Y_MM);

    // ── 4. Date + page number ─────────────────────────────────────────────
    pdfdoc.setFont("helvetica", "normal");
    pdfdoc.setFontSize(8);
    pdfdoc.setTextColor(tpl.pdfTextColor);
    pdfdoc.setGState(new pdfdoc.GState({ opacity: 0.55 }));
    pdfdoc.text(new Date(selectedFile.createdAt).toDateString(), LEFT_MARGIN_MM, DATE_Y_MM);
    pdfdoc.text(`Page ${index + 1} of ${pages.length}`, pw - RIGHT_MARGIN_MM, DATE_Y_MM, { align: "right" });
    pdfdoc.setGState(new pdfdoc.GState({ opacity: 1 }));

    // ── 5. Separator ──────────────────────────────────────────────────────
    pdfdoc.setDrawColor(tpl.pdfTitleColor);
    pdfdoc.setLineWidth(0.4);
    pdfdoc.line(LEFT_MARGIN_MM, HEADER_LINE_Y, pw - RIGHT_MARGIN_MM, HEADER_LINE_Y);

    // ── 6. Body text — set chosen font, then wrap with jsPDF ─────────────
    pdfdoc.setFont(bodyFont, "normal");
    pdfdoc.setFontSize(BODY_FONT_SIZE_PT);
    pdfdoc.setTextColor(tpl.pdfTextColor);

    // jsPDF's splitTextToSize does proper word-wrap for the current font at
    // the given mm width — no mid-word cuts.
    const wrappedLines = pdfdoc.splitTextToSize(rawText || "", TEXT_WIDTH_MM);

    // Render up to MAX_LINES_PER_PAGE lines, one per ruled baseline
    wrappedLines.slice(0, MAX_LINES_PER_PAGE).forEach((line, i) => {
      pdfdoc.text(line, LEFT_MARGIN_MM, FIRST_LINE_Y_MM + i * LINE_SPACING_MM);
    });

    // Overflow notice
    if (wrappedLines.length > MAX_LINES_PER_PAGE) {
      pdfdoc.setFont("helvetica", "italic");
      pdfdoc.setFontSize(7);
      pdfdoc.setTextColor(150, 150, 150);
      pdfdoc.text("(text continues on next page…)", LEFT_MARGIN_MM, ph - 6);
    }
  }

  const safeName = (selectedFile.name || "diary").replace(/[^a-z0-9_-]/gi, "_");
  pdfdoc.save(`${safeName}.pdf`);
}
