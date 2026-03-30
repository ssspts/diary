// src/components/Editor.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Pages are rendered as a vertical stack of "paper sheets" — like a word
// processor. The user scrolls up/down to see all pages continuously.
// Text automatically overflows from one page into the next as it fills up.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useEffect, useState, useCallback } from "react";
import { shared } from "../styles/tokens";
import { TEMPLATES, HANDWRITING_FONTS, FONT_KEYS, ensureMeta } from "../utils/templates";
import PdfPreview from "./PdfPreview";
import { MAX_LINES_PER_PAGE, CANVAS, wrapWords } from "../utils/pageSpec";

// ── Page sheet dimensions ─────────────────────────────────────────────────────
// We render each page as an A4-proportioned card.
// Width is set by CSS (fills container), height is derived from A4 ratio.
const A4_RATIO       = 297 / 210;   // height / width
const PAGE_PADDING_H = 24;          // px top+bottom padding inside each sheet
const PAGE_PADDING_W = 32;          // px left+right padding inside each sheet
const PAGE_GAP       = 24;          // px gap between consecutive page sheets

// ── Line wrapping helpers ─────────────────────────────────────────────────────
const CHARS_PER_LINE = 72;

let _measureCtx = null;
function getMeasureCtx() {
  if (!_measureCtx) _measureCtx = document.createElement("canvas").getContext("2d");
  return _measureCtx;
}

function countWrappedLines(text, fontFamily) {
  if (!text) return 0;
  const ctx  = getMeasureCtx();
  const font = `${CANVAS.lineSpacing * 0.7}px ${fontFamily || "sans-serif"}`;
  return wrapWords(ctx, text, CANVAS.textWidth, font).length;
}

// Split text so that each chunk fits within MAX_LINES_PER_PAGE
function splitIntoPages(text, fontFamily) {
  if (!text) return [""];
  const ctx  = getMeasureCtx();
  const font = `${CANVAS.lineSpacing * 0.7}px ${fontFamily || "sans-serif"}`;
  const allLines = wrapWords(ctx, text, CANVAS.textWidth, font);
  const chunks = [];
  for (let i = 0; i < allLines.length; i += MAX_LINES_PER_PAGE) {
    chunks.push(allLines.slice(i, i + MAX_LINES_PER_PAGE).join("\n"));
  }
  return chunks.length ? chunks : [""];
}

// ── SVG overlay helper (same as before) ──────────────────────────────────────
function SvgOverlay({ svgFn, height, style }) {
  if (!svgFn || !height) return null;
  const scalable = svgFn(800).replace(/width="\d+"/, 'width="100%"');
  return (
      <div
          style={{ position:"absolute", left:0, right:0, ...style, height, pointerEvents:"none", overflow:"hidden" }}
          dangerouslySetInnerHTML={{ __html: scalable }}
      />
  );
}

function Corner({ svgFn, size, position }) {
  if (!svgFn || !size) return null;
  const posStyle = {};
  if (position.includes("top"))    posStyle.top    = 0;
  if (position.includes("bottom")) posStyle.bottom = 0;
  if (position.includes("left"))   posStyle.left   = 0;
  if (position.includes("right"))  posStyle.right  = 0;
  const rotMap = { "top-left":0, "top-right":90, "bottom-right":180, "bottom-left":270 };
  return (
      <div
          style={{ position:"absolute", ...posStyle, width:size, height:size, pointerEvents:"none", zIndex:2, opacity:0.85, transform:`rotate(${rotMap[position]||0}deg)` }}
          dangerouslySetInnerHTML={{ __html: svgFn(size) }}
      />
  );
}

// ── Single page sheet ─────────────────────────────────────────────────────────
function PageSheet({
                     pageIndex, totalPages, pageData, template, font,
                     onChange, onFocus, isLast, pageWidth,
                   }) {
  const tpl   = TEMPLATES[template] || TEMPLATES.plain;
  const fDef  = HANDWRITING_FONTS[font] || HANDWRITING_FONTS.default;
  const decor = tpl.uiDecor;
  const textareaRef = useRef(null);

  // Fixed height = A4 proportion minus the header/footer bands of this sheet
  const sheetH      = Math.round(pageWidth * A4_RATIO);
  const headerBandH = (decor.headerSvgH || 0);
  const footerBandH = (decor.footerSvgH || 0);
  const bodyH       = sheetH - headerBandH - footerBandH - PAGE_PADDING_H * 2;

  const linesUsed = countWrappedLines(pageData, fDef.editorFamily);
  const linesLeft = MAX_LINES_PER_PAGE - linesUsed;
  const nearLimit = linesLeft <= 3;

  const ruledBg = decor.lineColor
      ? `repeating-linear-gradient(to bottom, transparent, transparent ${CANVAS.lineSpacing - 1}px, ${decor.lineColor} ${CANVAS.lineSpacing}px)`
      : "transparent";
  const textareaBg = decor.lineColor
      ? `${ruledBg}, ${decor.textareaBg}`
      : (decor.textareaBg || "#fff");

  return (
      <div style={{
        position: "relative",
        width: "100%",
        height: sheetH,
        background: decor.containerBg || "#fff",
        border: decor.containerBorder || "1px solid #e8eaed",
        borderRadius: 4,
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
      }}>
        {/* Corners */}
        <Corner svgFn={decor.cornerSvg} size={decor.cornerSize} position="top-left" />
        <Corner svgFn={decor.cornerSvg} size={decor.cornerSize} position="top-right" />
        <Corner svgFn={decor.cornerSvg} size={decor.cornerSize} position="bottom-left" />
        <Corner svgFn={decor.cornerSvg} size={decor.cornerSize} position="bottom-right" />

        {/* Header decoration band */}
        {decor.headerSvg && headerBandH > 0 && (
            <div style={{ position:"absolute", top:0, left:0, right:0, height:headerBandH, background: decor.headerBg || "transparent", borderBottom: decor.headerBorderBottom, zIndex:2, overflow:"hidden" }}>
              <SvgOverlay svgFn={decor.headerSvg} height={headerBandH} style={{ top:0 }} />
            </div>
        )}

        {/* Footer decoration band */}
        {decor.footerSvg && footerBandH > 0 && (
            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:footerBandH + 24, background: decor.footerBg || "transparent", borderTop: decor.footerBorderTop, zIndex:2, overflow:"hidden" }}>
              <SvgOverlay svgFn={decor.footerSvg} height={footerBandH} style={{ top:0 }} />
              {/* Page number inside footer */}
              <div style={{ position:"absolute", bottom:4, right:PAGE_PADDING_W, fontSize:10, color: decor.textareaColor, opacity:0.5 }}>
                Page {pageIndex + 1} of {totalPages}
              </div>
            </div>
        )}

        {/* Writing area */}
        <textarea
            ref={textareaRef}
            value={pageData}
            onChange={(e) => onChange(pageIndex, e.target.value)}
            onFocus={() => onFocus(pageIndex)}
            placeholder={pageIndex === 0 ? "Start writing…" : ""}
            style={{
              position: "absolute",
              top:    headerBandH + PAGE_PADDING_H,
              left:   PAGE_PADDING_W + (decor.textareaBorderLeft ? 12 : 0),
              right:  PAGE_PADDING_W,
              height: bodyH,
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: "16px",
              lineHeight: `${CANVAS.lineSpacing}px`,
              fontFamily: fDef.editorFamily,
              color: decor.textareaColor || "#202124",
              background: textareaBg,
              backgroundSize: `100% ${CANVAS.lineSpacing}px`,
              backgroundAttachment: "local",
              borderLeft: decor.textareaBorderLeft || "none",
              transition: "background 0.3s, color 0.3s",
              zIndex: 1,
            }}
        />

        {/* Line counter — bottom right of writing area */}
        <div style={{
          position: "absolute",
          bottom: footerBandH + (footerBandH > 0 ? 28 : 6),
          right: PAGE_PADDING_W,
          fontSize: 10,
          color: nearLimit ? "#d93025" : (decor.textareaColor || "#9aa0a6"),
          opacity: nearLimit ? 1 : 0.45,
          zIndex: 3,
          pointerEvents: "none",
        }}>
          {linesLeft > 0
              ? (nearLimit ? `${linesLeft} line${linesLeft === 1 ? "" : "s"} left` : "")
              : "↓ continues on next page"}
        </div>
      </div>
  );
}

// ── Empty-state placeholder ───────────────────────────────────────────────────
function EditorEmpty() {
  return (
      <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ fontSize:44, marginBottom:12 }}>📔</div>
          <div style={{ fontSize:15, color:"#80868b" }}>Select a diary and a date to start writing</div>
        </div>
      </main>
  );
}

// ── Main Editor component ─────────────────────────────────────────────────────
// Wrapper ensures hooks are never called conditionally based on selectedDiary.
export default function Editor(props) {
  if (!props.selectedDiary) return <EditorEmpty />;
  return <EditorInner {...props} />;
}

function EditorInner({
                       selectedDiary,
                       selectedDate,
                       pages, setPages, currentPage, setCurrentPage,
                       isDirty, setIsDirty, saving,
                       entryTitle, setEntryTitle,
                       onSave, onOpenTemplatePicker,
                     }) {
  const scrollRef    = useRef(null);
  const containerRef = useRef(null);
  const [pageWidth, setPageWidth]     = useState(600);
  const [showPreview, setShowPreview] = useState(false);
  const [focusedPage, setFocusedPage] = useState(0);

  // Measure container width so sheets scale correctly
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setPageWidth(Math.max(400, w - 48));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Reset scroll to top when diary/date changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setFocusedPage(0);
  }, [selectedDiary?.id, selectedDate?.toDateString?.()]); // eslint-disable-line

  // Use the focused page's template/font for toolbar display
  const safeIdx       = Math.min(focusedPage, pages.length - 1);
  const currentTplKey = pages[safeIdx]?.meta?.template || "plain";
  const currentFntKey = pages[safeIdx]?.meta?.font     || "default";
  const currentTpl    = TEMPLATES[currentTplKey] || TEMPLATES.plain;
  const currentFont   = HANDWRITING_FONTS[currentFntKey] || HANDWRITING_FONTS.default;
  const decor         = currentTpl.uiDecor;

  // ── Text change handler ───────────────────────────────────────────────────
  // When the user types on a page, we:
  //   1. Accept the text if it fits within MAX_LINES_PER_PAGE
  //   2. If it overflows, split at the boundary and push overflow to the next page
  //   3. If a page's text shrinks below the previous page's capacity, pull text back up
  const handlePageChange = useCallback((pageIdx, newText) => {
    const fontFamily = (HANDWRITING_FONTS[pages[pageIdx]?.meta?.font] || HANDWRITING_FONTS.default).editorFamily;
    const updated    = pages.map(ensureMeta);

    const lineCount = countWrappedLines(newText, fontFamily);

    if (lineCount <= MAX_LINES_PER_PAGE) {
      // Text fits — just update this page
      updated[pageIdx] = { ...updated[pageIdx], data: newText };
      setPages(updated);
      setIsDirty(true);
      return;
    }

    // Overflow — split at boundary
    const rawLines  = newText.split("\n");
    let budget      = MAX_LINES_PER_PAGE;
    let splitIdx    = rawLines.length;
    for (let i = 0; i < rawLines.length; i++) {
      const wc = Math.max(1, Math.ceil((rawLines[i].length || 1) / CHARS_PER_LINE));
      if (budget - wc < 0) { splitIdx = i; break; }
      budget -= wc;
    }
    const thisText     = rawLines.slice(0, splitIdx).join("\n");
    const overflowText = rawLines.slice(splitIdx).join("\n");

    updated[pageIdx] = { ...updated[pageIdx], data: thisText };

    const nextIdx = pageIdx + 1;
    if (nextIdx < updated.length) {
      // Prepend overflow to existing next page
      const next = updated[nextIdx];
      updated[nextIdx] = { ...next, data: overflowText + (next.data ? "\n" + next.data : "") };
    } else {
      // Create a new page carrying the overflow and same template/font
      updated.push({
        ...ensureMeta(""),
        meta: { template: currentTplKey, font: currentFntKey },
        data: overflowText,
      });
    }

    setPages(updated);
    setIsDirty(true);

    // Scroll new page into view after render
    setTimeout(() => {
      const sheets = scrollRef.current?.querySelectorAll("[data-page-sheet]");
      sheets?.[nextIdx]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [pages, currentTplKey, currentFntKey, setPages, setIsDirty]);

  const handleFontChange = (e) => {
    const updated = pages.map(ensureMeta);
    updated[safeIdx] = { ...updated[safeIdx], meta: { template: currentTplKey, font: e.target.value } };
    setPages(updated);
    setIsDirty(true);
  };

  const addPage = () => {
    setPages((prev) => [
      ...prev.map(ensureMeta),
      { ...ensureMeta(""), meta: { template: currentTplKey, font: currentFntKey } },
    ]);
    setIsDirty(true);
    // Scroll to new page
    setTimeout(() => {
      const sheets = scrollRef.current?.querySelectorAll("[data-page-sheet]");
      sheets?.[pages.length]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const deletePage = (idx) => {
    if (pages.length <= 1) return;
    if (!window.confirm("Delete this page?")) return;
    const updated = pages.filter((_, i) => i !== idx).map(ensureMeta);
    setPages(updated);
    setIsDirty(true);
  };

  return (
      <>
        <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#f0f2f5" }}>

          {/* ── Fixed toolbar ─────────────────────────────────────────────── */}
          <div style={{
            background: decor.headerBg || "#fff",
            borderBottom: decor.headerBorderBottom || "1px solid #e8eaed",
            flexShrink: 0,
            zIndex: 10,
            position: "relative",
            paddingBottom: decor.headerSvgH || 0,
            transition: "background 0.3s",
          }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"12px 20px 10px", gap:12 }}>

              {/* Left: diary name → date → entry title */}
              <div style={{ display:"flex", flexDirection:"column", gap:4, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:15 }}>{selectedDiary.emoji || "📔"}</span>
                  <span style={{ fontSize:14, fontWeight:700, color: decor.textareaColor || "#202124", opacity:0.85 }}>
                  {selectedDiary.name || "Diary"}
                </span>
                  {isDirty && <span style={{ width:6, height:6, borderRadius:"50%", background:"#fbbc04", display:"inline-block", flexShrink:0 }} title="Unsaved changes" />}
                </div>
                <span style={{ fontSize:11, color: decor.textareaColor || "#9aa0a6", opacity:0.55 }}>
                {selectedDate.toLocaleDateString("default", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
              </span>
                <input
                    type="text"
                    value={entryTitle}
                    onChange={(e) => { setEntryTitle(e.target.value); setIsDirty(true); }}
                    placeholder="Add a title for this entry…"
                    style={{
                      fontSize:15, fontWeight:600,
                      color: decor.textareaColor || "#202124",
                      background:"transparent", border:"none",
                      borderBottom:`1.5px solid ${decor.textareaColor || "#202124"}33`,
                      outline:"none", padding:"2px 0", width:260, fontFamily:"inherit",
                    }}
                    onFocus={(e) => e.target.style.borderBottomColor = decor.btnBg || "#1a73e8"}
                    onBlur={(e) => e.target.style.borderBottomColor = `${decor.textareaColor || "#202124"}33`}
                />
              </div>

              {/* Right: controls */}
              <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                {/* Theme */}
                <button
                    style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 10px", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", cursor:"pointer", fontSize:13, color: decor.textareaColor || "#202124", whiteSpace:"nowrap" }}
                    onClick={onOpenTemplatePicker} title="Change page theme"
                >
                  <span style={{ fontSize:15 }}>{currentTpl.emoji}</span>
                  <span style={{ fontSize:12 }}>{currentTpl.label}</span>
                  <span style={{ fontSize:10, opacity:0.6 }}>▾</span>
                </button>

                {/* Font */}
                <div style={{ display:"flex", alignItems:"center", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", padding:"0 6px 0 8px", gap:4, height:32 }}>
                  <span style={{ fontSize:14, color: decor.textareaColor || "#202124", flexShrink:0 }}>✍</span>
                  <select
                      value={currentFntKey}
                      onChange={handleFontChange}
                      style={{ border:"none", outline:"none", background:"transparent", fontSize:13, color: decor.textareaColor || "#202124", cursor:"pointer", maxWidth:130, fontFamily: currentFont.editorFamily }}
                  >
                    {FONT_KEYS.map((key) => {
                      const f = HANDWRITING_FONTS[key];
                      return <option key={key} value={key} style={{ fontFamily: f.editorFamily }}>{f.emoji}  {f.label}</option>;
                    })}
                  </select>
                </div>

                {/* Add page */}
                <button
                    style={{ padding:"6px 10px", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", cursor:"pointer", fontSize:13, color: decor.textareaColor || "#202124" }}
                    onClick={addPage} title="Add a new page"
                >+ Page</button>

                {/* Preview */}
                <button
                    style={{ padding:"7px 12px", background:"rgba(255,255,255,0.25)", color: decor.textareaColor || "#202124", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, cursor:"pointer", fontSize:13 }}
                    onClick={() => setShowPreview(true)}
                >👁 Preview</button>

                {/* Save */}
                <button
                    style={{ ...shared.btnPrimary, background: decor.btnBg || "#1a73e8", color: decor.btnColor || "#fff", opacity: saving ? 0.7 : 1 }}
                    onClick={onSave} disabled={saving} title="Save (Ctrl+S)"
                >
                  {saving ? <><span style={shared.spinner} /> Saving…</> : isDirty ? "Save" : "✓ Saved"}
                </button>
              </div>
            </div>

            <SvgOverlay svgFn={decor.headerSvg} height={decor.headerSvgH} style={{ bottom:0 }} />
          </div>

          {/* ── Scrollable page stack ─────────────────────────────────────── */}
          <div
              ref={(el) => { scrollRef.current = el; containerRef.current = el; }}
              style={{
                flex: 1,
                overflowY: "auto",
                overflowX: "hidden",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: PAGE_GAP,
                alignItems: "center",
                background: "#e8eaed",
              }}
          >
            {pages.map((page, idx) => {
              const pg = ensureMeta(page);
              return (
                  <div
                      key={idx}
                      data-page-sheet={idx}
                      style={{ width: "100%", maxWidth: 780 }}
                  >
                    <PageSheet
                        pageIndex={idx}
                        totalPages={pages.length}
                        pageData={pg.data}
                        template={pg.meta.template}
                        font={pg.meta.font}
                        pageWidth={Math.min(pageWidth, 780)}
                        onChange={handlePageChange}
                        onFocus={(i) => { setFocusedPage(i); setCurrentPage(i); }}
                        isLast={idx === pages.length - 1}
                    />
                    {/* Delete page button — shown between pages */}
                    {pages.length > 1 && (
                        <div style={{ textAlign:"right", marginTop:4 }}>
                          <button
                              style={{ fontSize:11, color:"#d93025", border:"none", background:"transparent", cursor:"pointer", padding:"2px 4px", opacity:0.7 }}
                              onClick={() => deletePage(idx)}
                          >✕ Delete page {idx + 1}</button>
                        </div>
                    )}
                  </div>
              );
            })}

            {/* Add page at bottom */}
            <button
                onClick={addPage}
                style={{
                  marginTop:8, padding:"10px 28px",
                  border:"2px dashed #bbb", borderRadius:8,
                  background:"rgba(255,255,255,0.6)", color:"#666",
                  cursor:"pointer", fontSize:13, fontWeight:500,
                  width:"100%", maxWidth:780,
                }}
            >+ Add page</button>
          </div>
        </main>

        {showPreview && (
            <PdfPreview
                selectedFile={{
                  name: entryTitle || selectedDiary?.name || "Diary Entry",
                  diaryName: selectedDiary?.name || "Diary",
                  createdAt: selectedDate?.toISOString() || new Date().toISOString(),
                }}
                pages={pages}
                onClose={() => setShowPreview(false)}
            />
        )}
      </>
  );
}
