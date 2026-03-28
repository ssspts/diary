// src/components/Editor.jsx
import { useRef, useEffect, useState } from "react";
import { shared } from "../styles/tokens";
import { TEMPLATES, HANDWRITING_FONTS, FONT_KEYS, ensureMeta } from "../utils/templates";
import PdfPreview from "./PdfPreview";

import { MAX_LINES_PER_PAGE, CANVAS, wrapWords } from "../utils/pageSpec";

// Count lines using the same word-wrap logic as the PDF and preview.
// We use a temporary offscreen canvas to measure text width accurately.
let _measureCtx = null;
function getMeasureCtx() {
  if (!_measureCtx) {
    const c = document.createElement("canvas");
    _measureCtx = c.getContext("2d");
  }
  return _measureCtx;
}

function countWrappedLines(text, fontFamily) {
  if (!text) return 0;
  const ctx   = getMeasureCtx();
  const font  = `${CANVAS.lineSpacing * 0.7}px ${fontFamily || "sans-serif"}`;
  const lines = wrapWords(ctx, text, CANVAS.textWidth, font);
  return lines.length;
}

// Render a uiDecor SVG string (which is a function of width) into a div overlay.
// We use a fixed width reference since SVG is responsive via viewBox.
function SvgOverlay({ svgFn, height, style }) {
  if (!svgFn || !height) return null;
  const svgString = svgFn(800); // reference width; SVG will scale via width="100%"
  // Inject width="100%" so it scales to any container
  const scalable = svgString.replace(/width="\d+"/, 'width="100%"');
  return (
    <div
      style={{
        position: "absolute", left: 0, right: 0, ...style,
        height: height, pointerEvents: "none", overflow: "hidden",
      }}
      dangerouslySetInnerHTML={{ __html: scalable }}
    />
  );
}

// Corner SVG placed absolutely at one corner of the editor
function Corner({ svgFn, size, position }) {
  if (!svgFn || !size) return null;
  const svgString = svgFn(size);
  const posStyle = {};
  if (position.includes("top"))    posStyle.top    = 0;
  if (position.includes("bottom")) posStyle.bottom = 0;
  if (position.includes("left"))   posStyle.left   = 0;
  if (position.includes("right"))  posStyle.right  = 0;

  // Rotate for each corner
  const rotMap = { "top-left": 0, "top-right": 90, "bottom-right": 180, "bottom-left": 270 };
  const rot = rotMap[position] || 0;

  return (
    <div
      style={{
        position: "absolute", ...posStyle, width: size, height: size,
        pointerEvents: "none", zIndex: 2, opacity: 0.85,
        transform: `rotate(${rot}deg)`,
      }}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
}

export default function Editor({
  selectedFile,
  pages, setPages, currentPage, setCurrentPage,
  isDirty, setIsDirty, saving,
  editingTitle, setEditingTitle, tempTitle, setTempTitle, titleInputRef,
  onSave, onOpenTemplatePicker, onRenameFile,
}) {
  const textareaRef  = useRef(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.scrollTop = 0;
  }, [currentPage, selectedFile?.id]);

  if (!selectedFile) {
    return (
      <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ fontSize:44, marginBottom:12 }}>📝</div>
          <div style={{ fontSize:15, color:"#80868b" }}>Select an entry or create a new one</div>
        </div>
      </main>
    );
  }

  const currentTplKey  = pages[currentPage]?.meta?.template || "plain";
  const currentFontKey = pages[currentPage]?.meta?.font     || "default";
  const currentTpl     = TEMPLATES[currentTplKey]           || TEMPLATES.plain;
  const currentFont    = HANDWRITING_FONTS[currentFontKey]  || HANDWRITING_FONTS.default;
  const decor          = currentTpl.uiDecor;

  // ── Line overflow handler ─────────────────────────────────────────────────
  const handleTextChange = (e) => {
    const newText   = e.target.value;
    const lineCount = countWrappedLines(newText, currentFont.editorFamily);
    if (lineCount <= MAX_LINES_PER_PAGE) {
      const updated = [...pages];
      updated[currentPage] = { ...ensureMeta(updated[currentPage]), data: newText };
      setPages(updated);
      setIsDirty(true);
      return;
    }
    const rawLines = newText.split("\n");
    let budget = MAX_LINES_PER_PAGE, splitIndex = rawLines.length;
    for (let i = 0; i < rawLines.length; i++) {
      const wc = Math.max(1, Math.ceil((rawLines[i].length || 1) / CHARS_PER_LINE));
      if (budget - wc < 0) { splitIndex = i; break; }
      budget -= wc;
    }
    const thisText     = rawLines.slice(0, splitIndex).join("\n");
    const overflowText = rawLines.slice(splitIndex).join("\n");
    const updated = [...pages];
    updated[currentPage] = { ...ensureMeta(updated[currentPage]), data: thisText };
    const nextIdx = currentPage + 1;
    if (nextIdx < updated.length) {
      const np = ensureMeta(updated[nextIdx]);
      updated[nextIdx] = { ...np, data: overflowText + (np.data ? "\n" + np.data : "") };
    } else {
      updated.push({ ...ensureMeta(""), meta:{ template:currentTplKey, font:currentFontKey }, data:overflowText });
    }
    setPages(updated);
    setIsDirty(true);
    setCurrentPage(nextIdx);
  };

  const handleFontChange = (e) => {
    const updated = [...pages];
    updated[currentPage] = { ...ensureMeta(updated[currentPage]), meta:{ template:currentTplKey, font:e.target.value } };
    setPages(updated);
    setIsDirty(true);
  };

  const addPage = () => {
    setPages((prev) => [...prev, { ...ensureMeta(""), meta:{ template:currentTplKey, font:currentFontKey } }]);
    setCurrentPage(pages.length);
    setIsDirty(true);
  };

  const deletePage = () => {
    if (!window.confirm("Delete this page?")) return;
    const updated = pages.filter((_, i) => i !== currentPage);
    setPages(updated);
    setCurrentPage(Math.min(currentPage, updated.length - 1));
    setIsDirty(true);
  };

  const linesLeft = MAX_LINES_PER_PAGE - countWrappedLines(pages[currentPage]?.data ?? "", currentFont.editorFamily);
  const nearLimit = linesLeft <= 3;

  // Ruled-line background for textarea
  const ruledBg = decor.lineColor
    ? `repeating-linear-gradient(to bottom, transparent, transparent ${decor.lineSpacingPx - 1}px, ${decor.lineColor} ${decor.lineSpacingPx}px)`
    : "transparent";

  // Combine base texture + ruled lines
  const textareaBackground = decor.lineColor
    ? `${ruledBg}, ${decor.textareaBg}`
    : decor.textareaBg;

  return (
    <>
      {/* ── Whole editor container with template background + border ── */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column", overflow: "hidden",
        position: "relative",
        background: decor.containerBg,
        border: decor.containerBorder,
        borderRadius: 4,
        transition: "background 0.3s, border-color 0.3s",
      }}>

        {/* Corner decorations */}
        <Corner svgFn={decor.cornerSvg} size={decor.cornerSize} position="top-left" />
        <Corner svgFn={decor.cornerSvg} size={decor.cornerSize} position="top-right" />
        <Corner svgFn={decor.cornerSvg} size={decor.cornerSize} position="bottom-left" />
        <Corner svgFn={decor.cornerSvg} size={decor.cornerSize} position="bottom-right" />

        {/* ── TOOLBAR (header band) ── */}
        <div style={{
          position: "relative",
          background: decor.headerBg,
          borderBottom: decor.headerBorderBottom,
          flexShrink: 0,
          // Extra bottom padding to accommodate the SVG overlay
          paddingBottom: decor.headerSvgH ? decor.headerSvgH : 0,
          transition: "background 0.3s",
          zIndex: 3,
        }}>
          {/* Toolbar controls sit above the SVG overlay */}
          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            padding: "12px 20px 10px", gap: 12,
          }}>
            {/* Left: title + date */}
            <div style={{ display:"flex", flexDirection:"column", gap:2, minWidth:0 }}>
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")  { onRenameFile(selectedFile.id, tempTitle); setEditingTitle(false); }
                    if (e.key === "Escape") { setEditingTitle(false); }
                  }}
                  onBlur={() => { onRenameFile(selectedFile.id, tempTitle); setEditingTitle(false); }}
                  style={{ fontSize:15, fontWeight:600, border:"none", borderBottom:"2px solid " + decor.btnBg, outline:"none", padding:"1px 0", color: decor.textareaColor, background:"transparent", width:260 }}
                />
              ) : (
                <div
                  style={{ margin:0, fontSize:16, fontWeight:600, color: decor.textareaColor, cursor:"pointer", display:"flex", alignItems:"center", gap:7, userSelect:"none" }}
                  title="Click to rename"
                  onClick={() => { setTempTitle(selectedFile.name); setEditingTitle(true); }}
                >
                  {selectedFile.name}
                  {isDirty && <span style={{ width:7, height:7, borderRadius:"50%", background:"#fbbc04", display:"inline-block" }} title="Unsaved" />}
                </div>
              )}
              <span style={{ fontSize:11, color: decor.textareaColor, opacity:0.6 }}>
                {new Date(selectedFile.createdAt).toLocaleDateString("default", { weekday:"short", year:"numeric", month:"short", day:"numeric" })}
              </span>
            </div>

            {/* Right: controls */}
            <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
              {/* Theme button */}
              <button
                style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 10px", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", cursor:"pointer", fontSize:13, color: decor.textareaColor, whiteSpace:"nowrap", backdropFilter:"blur(2px)" }}
                onClick={onOpenTemplatePicker}
                title="Change page theme"
              >
                <span style={{ fontSize:15 }}>{currentTpl.emoji}</span>
                <span style={{ fontSize:12 }}>{currentTpl.label}</span>
                <span style={{ fontSize:10, opacity:0.6 }}>▾</span>
              </button>

              {/* Font picker */}
              <div style={{ display:"flex", alignItems:"center", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", padding:"0 6px 0 8px", gap:4, height:32 }}>
                <span style={{ fontSize:14, color: decor.textareaColor, flexShrink:0 }}>✍</span>
                <select
                  value={currentFontKey}
                  onChange={handleFontChange}
                  style={{ border:"none", outline:"none", background:"transparent", fontSize:13, color: decor.textareaColor, cursor:"pointer", maxWidth:130, fontFamily: currentFont.editorFamily }}
                >
                  {FONT_KEYS.map((key) => {
                    const f = HANDWRITING_FONTS[key];
                    return <option key={key} value={key} style={{ fontFamily:f.editorFamily }}>{f.emoji}  {f.label}</option>;
                  })}
                </select>
              </div>

              {/* Preview & Download */}
              <button
                style={{ padding:"7px 12px", background:"rgba(255,255,255,0.25)", color: decor.textareaColor, border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, cursor:"pointer", fontSize:13, backdropFilter:"blur(2px)" }}
                onClick={() => setShowPreview(true)}
              >👁 Preview</button>

              {/* Save */}
              <button
                style={{ ...shared.btnPrimary, background: decor.btnBg, color: decor.btnColor, opacity: saving ? 0.7 : 1 }}
                onClick={onSave}
                disabled={saving}
                title="Save (Ctrl+S / Cmd+S)"
              >
                {saving ? <><span style={shared.spinner} /> Saving…</> : isDirty ? "Save" : "✓ Saved"}
              </button>
            </div>
          </div>

          {/* Header SVG decoration band */}
          <SvgOverlay
            svgFn={decor.headerSvg}
            height={decor.headerSvgH}
            style={{ bottom: 0 }}
          />
        </div>

        {/* ── WRITING AREA ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>
          <textarea
            ref={textareaRef}
            style={{
              flex: 1,
              padding: "16px 24px",
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: "16px",
              lineHeight: `${CANVAS.lineSpacing}px`,
              fontFamily: currentFont.editorFamily,
              color: decor.textareaColor,
              background: textareaBackground,
              backgroundSize: `100% ${decor.lineSpacingPx}px`,
              backgroundAttachment: "local",
              // Left margin stripe for sunflower / notebook style
              paddingLeft: decor.textareaBorderLeft ? "28px" : "24px",
              borderLeft: decor.textareaBorderLeft || "none",
              transition: "background 0.3s, color 0.3s",
            }}
            value={pages[currentPage]?.data ?? ""}
            placeholder="Start writing…"
            onChange={handleTextChange}
          />
          {/* Line counter */}
          <div style={{ fontSize:11, padding:"3px 24px 4px", textAlign:"right", flexShrink:0, color: nearLimit ? "#d93025" : decor.textareaColor, opacity: nearLimit ? 1 : 0.5, background: decor.textareaBg }}>
            {linesLeft > 0 ? `${linesLeft} line${linesLeft === 1 ? "" : "s"} left` : "Page full — continues on next page"}
          </div>
        </div>

        {/* ── PAGINATION (footer band) ── */}
        <div style={{
          position: "relative",
          background: decor.footerBg,
          borderTop: decor.footerBorderTop,
          flexShrink: 0,
          // Extra top padding to accommodate the footer SVG overlay
          paddingTop: decor.footerSvgH ? decor.footerSvgH : 0,
          transition: "background 0.3s",
          zIndex: 3,
        }}>
          {/* Footer SVG decoration */}
          <SvgOverlay
            svgFn={decor.footerSvg}
            height={decor.footerSvgH}
            style={{ top: 0 }}
          />

          {/* Pagination controls */}
          <div style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 16px" }}>
            <button
              style={{ padding:"5px 10px", border:"1px solid rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.2)", borderRadius:6, cursor:"pointer", fontSize:12, color: decor.textareaColor, backdropFilter:"blur(2px)" }}
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => p - 1)}
            >← Prev</button>

            <span style={{ fontSize:12, color: decor.textareaColor, opacity:0.8, margin:"0 4px" }}>
              Page {currentPage + 1} / {pages.length || 1}
            </span>

            <button
              style={{ padding:"5px 10px", border:"1px solid rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.2)", borderRadius:6, cursor:"pointer", fontSize:12, color: decor.textareaColor, backdropFilter:"blur(2px)" }}
              disabled={currentPage >= pages.length - 1}
              onClick={() => setCurrentPage((p) => p + 1)}
            >Next →</button>

            <button
              style={{ padding:"5px 10px", border:"1px solid rgba(255,255,255,0.35)", background:"rgba(255,255,255,0.2)", borderRadius:6, cursor:"pointer", fontSize:12, color: decor.textareaColor, marginLeft:6, backdropFilter:"blur(2px)" }}
              onClick={addPage}
            >+ Page</button>

            {pages.length > 1 && (
              <button
                style={{ padding:"5px 10px", border:"1px solid rgba(255,100,80,0.5)", background:"rgba(255,100,80,0.15)", borderRadius:6, cursor:"pointer", fontSize:12, color:"#d93025" }}
                onClick={deletePage}
              >✕ Page</button>
            )}
          </div>
        </div>
      </main>

      {showPreview && (
        <PdfPreview
          selectedFile={selectedFile}
          pages={pages}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
