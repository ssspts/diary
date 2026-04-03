// src/utils/pageSpec.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for page dimensions shared by:
//   • jsPDF export  (exportPdf.js)
//   • Canvas preview (PdfPreview.jsx)
//   • Editor line-count enforcement (Editor.jsx)
//
// ALL measurements are in mm for jsPDF, then converted to px for canvas/editor.
// ─────────────────────────────────────────────────────────────────────────────

// A4 dimensions in mm
export const PAGE_W_MM = 210;
export const PAGE_H_MM = 297;

// Header zone (title + date + border) in mm
export const HEADER_H_MM   = 35;  // total header band
export const TITLE_Y_MM    = 20;  // title baseline
export const DATE_Y_MM     = 28;  // date/pageno baseline
export const HEADER_LINE_Y = 32;  // separator line

// Footer zone in mm
export const FOOTER_H_MM = 18;  // decoration + controls band

// Body text settings (used by BOTH pdf and canvas)
export const BODY_FONT_SIZE_PT = 11;   // pt — jsPDF unit
export const LINE_SPACING_MM   = 7.5;  // mm between baselines
export const FIRST_LINE_Y_MM   = HEADER_H_MM + 6; // first text baseline
export const LEFT_MARGIN_MM    = 18;
export const RIGHT_MARGIN_MM   = 14;
export const TEXT_WIDTH_MM     = PAGE_W_MM - LEFT_MARGIN_MM - RIGHT_MARGIN_MM; // 178 mm

// How many body lines fit on one page
export const MAX_LINES_PER_PAGE = Math.floor(
    (PAGE_H_MM - FIRST_LINE_Y_MM - FOOTER_H_MM - 4) / LINE_SPACING_MM
); // ≈ 28 lines

// Canvas (preview) dimensions at 96dpi equivalent
export const CANVAS_W = 794;   // 210mm @ 96dpi  (210 * 96/25.4 ≈ 794)
export const CANVAS_H = 1123;  // 297mm @ 96dpi
export const MM_TO_PX = CANVAS_W / PAGE_W_MM; // 3.78 px/mm

// Font size in px for canvas (pt → px: 1pt = 1.333px at 96dpi)
export const BODY_FONT_PX = Math.round(BODY_FONT_SIZE_PT * 1.333); // ≈ 15px

// Derive canvas equivalents from mm constants
export const CANVAS = {
    headerH:   Math.round(HEADER_H_MM   * MM_TO_PX),
    footerH:   Math.round(FOOTER_H_MM   * MM_TO_PX),
    titleY:    Math.round(TITLE_Y_MM    * MM_TO_PX),
    dateY:     Math.round(DATE_Y_MM     * MM_TO_PX),
    lineY:     Math.round(HEADER_LINE_Y * MM_TO_PX),
    firstLineY:Math.round(FIRST_LINE_Y_MM * MM_TO_PX),
    lineSpacing:Math.round(LINE_SPACING_MM * MM_TO_PX),  // ≈ 28px
    leftMargin: Math.round(LEFT_MARGIN_MM  * MM_TO_PX),
    rightMargin:Math.round(RIGHT_MARGIN_MM * MM_TO_PX),
    textWidth:  Math.round(TEXT_WIDTH_MM   * MM_TO_PX),
};

/**
 * Word-wrap a string to fit within `maxWidthPx` using canvas measureText.
 * Returns an array of line strings — NO word is ever split mid-word.
 * Used by both the preview canvas and the editor's line counter.
 *
 * @param {CanvasRenderingContext2D|null} ctx   Pass null to use character-width estimate
 * @param {string} text
 * @param {number} maxWidthPx
 * @param {string} fontSpec  e.g. "15px sans-serif"
 */
export function wrapWords(ctx, text, maxWidthPx, fontSpec) {
    if (!text) return [""];
    if (ctx && fontSpec) ctx.font = fontSpec;

    const measure = (s) => ctx
        ? ctx.measureText(s).width
        : s.length * (maxWidthPx / 55); // fallback: ~55 chars per line

    const result = [];
    for (const paragraph of text.split("\n")) {
        if (!paragraph) { result.push(""); continue; }
        const words = paragraph.split(" ");
        let line = "";
        for (const word of words) {
            const candidate = line ? line + " " + word : word;
            if (measure(candidate) <= maxWidthPx) {
                line = candidate;
            } else {
                if (line) result.push(line);
                // If a single word is wider than the line, break it by character
                if (measure(word) > maxWidthPx) {
                    let chunk = "";
                    for (const ch of word) {
                        if (measure(chunk + ch) > maxWidthPx) { result.push(chunk); chunk = ch; }
                        else chunk += ch;
                    }
                    line = chunk;
                } else {
                    line = word;
                }
            }
        }
        if (line !== undefined) result.push(line);
    }
    return result;
}
