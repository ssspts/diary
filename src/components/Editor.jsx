// src/components/Editor.jsx
import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { shared } from "../styles/tokens";
import { TEMPLATES, HANDWRITING_FONTS, FONT_KEYS, ensureMeta } from "../utils/templates";
import PdfPreview from "./PdfPreview";
import { MAX_LINES_PER_PAGE, CANVAS, wrapWords } from "../utils/pageSpec";

const A4_RATIO       = 297 / 210;
const PAGE_PADDING_H = 20;
const PAGE_PADDING_W = 32;
const PAGE_GAP       = 28;
const CHARS_PER_LINE = 72;

let _ctx = null;
function getMCtx() {
  if (!_ctx) _ctx = document.createElement("canvas").getContext("2d");
  return _ctx;
}
function countWrappedLines(text, fontFamily) {
  if (!text) return 0;
  const ctx  = getMCtx();
  const font = `${CANVAS.lineSpacing * 0.7}px ${fontFamily || "sans-serif"}`;
  return wrapWords(ctx, text, CANVAS.textWidth, font).length;
}

// ── Emoji catalogue (WhatsApp-style categories) ───────────────────────────────
const EMOJI_CATS = [
  { label:"😊 Smileys",  emojis:["😀","😂","😍","🥰","😘","😎","🤩","😢","😭","😡","🤔","😴","🥳","😇","🤗","😏","🙄","😤","🤯","🥺","😬","😳","🤭","🫡","💀","👻","🤡","💩","😈","👽"] },
  { label:"👋 People",   emojis:["👍","👎","👏","🙌","🤝","🤜","✌️","🤞","🫶","❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💕","💯","🔥","✨","⭐","🌟","💫","🎉","🎊","🎈","🎁","🏆"] },
  { label:"🐶 Animals",  emojis:["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐙","🦋","🐝","🦄","🐳","🦈","🐬","🦭","🦓","🦒","🦘","🦙","🐉","🦕","🦖","🐾"] },
  { label:"🍕 Food",     emojis:["🍎","🍊","🍋","🍇","🍓","🍒","🍑","🥭","🍍","🥥","🍕","🍔","🌮","🍜","🍣","🍩","🍰","🎂","🧁","🍫","🍿","☕","🧋","🍵","🥤","🍺","🥂","🍾","🫖","🧃"] },
  { label:"⚽ Sports",   emojis:["⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥊","🎯","🏹","🎣","🤿","🎿","🛷","🥌","🏋️","🤸","⛷️","🏄","🚴","🏇","🤺","🥋","🥅","⛳","🎮","🕹️"] },
  { label:"🌍 Travel",   emojis:["🚗","✈️","🚀","🛸","⛵","🚂","🏖️","🏔️","🗺️","🧭","🏕️","🌋","🗼","🏰","🌉","🌃","🌄","🌅","🌆","🎡","🎢","🎠","⛺","🌍","🌏","🌐","🗾","🧳","📸","🌌"] },
  { label:"💡 Objects",  emojis:["💡","🔦","📱","💻","⌨️","🖥️","🖨️","📷","📸","🎥","📺","📻","🎙️","🎚️","🎛️","📡","🔋","💾","💿","📀","🖱️","🖲️","💠","🔮","🧿","🪬","🧲","🔑","🗝️","🪄"] },
  { label:"🌸 Nature",   emojis:["🌸","🌺","🌻","🌹","🌷","💐","🌿","🍀","🍁","🍂","🍃","🌱","🌲","🌳","🌴","🌵","🎋","🎍","🪴","🌾","🍄","🐚","🪸","🌊","🌬️","🌈","⛅","🌤️","❄️","⚡"] },
];

// ── Emoji Picker popover ──────────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose, anchorRef }) {
  const [cat, setCat]     = useState(0);
  const [search, setSearch] = useState("");
  const pickerRef           = useRef(null);

  // Position the picker above/below the anchor button
  const [pos, setPos] = useState({ top:0, left:0 });
  useEffect(() => {
    if (!anchorRef?.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const pickerH = 320;
    const spaceBelow = window.innerHeight - r.bottom;
    const top  = spaceBelow > pickerH ? r.bottom + 4 : r.top - pickerH - 4;
    const left = Math.min(r.left, window.innerWidth - 280);
    setPos({ top, left });
  }, [anchorRef]);

  // Close on outside click
  useEffect(() => {
    const h = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target) &&
          anchorRef?.current && !anchorRef.current.contains(e.target))
        onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose, anchorRef]);

  const filtered = search.trim()
    ? EMOJI_CATS.flatMap((c) => c.emojis).filter((e) => e.includes(search))
    : EMOJI_CATS[cat].emojis;

  return createPortal(
    <div
      ref={pickerRef}
      style={{
        position: "fixed",
        top:      pos.top,
        left:     pos.left,
        width:    272,
        background: "#fff",
        border:   "1px solid #e0e0e0",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        zIndex:   10000,
        overflow: "hidden",
        display:  "flex",
        flexDirection: "column",
      }}
    >
      {/* Search */}
      <div style={{ padding:"8px 10px 4px" }}>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search emoji…"
          style={{ width:"100%", padding:"6px 10px", border:"1px solid #e0e0e0", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" }}
        />
      </div>

      {/* Category tabs */}
      {!search && (
        <div style={{ display:"flex", overflowX:"auto", padding:"4px 8px 0", gap:2, flexShrink:0, scrollbarWidth:"none" }}>
          {EMOJI_CATS.map((c, i) => (
            <button key={i} onClick={() => setCat(i)} style={{
              border:"none", borderRadius:6, padding:"4px 6px", cursor:"pointer", fontSize:16, flexShrink:0,
              background: cat===i ? "#f1f3f4" : "transparent",
            }} title={c.label.split(" ").slice(1).join(" ")}>
              {c.label.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:2, padding:"6px 8px 8px", overflowY:"auto", maxHeight:230 }}>
        {filtered.map((emoji, i) => (
          <button key={i} onClick={() => onSelect(emoji)} style={{
            border:"none", background:"transparent", fontSize:22, cursor:"pointer",
            borderRadius:6, padding:"3px 2px", lineHeight:1,
            transition:"background 0.1s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.background="#f1f3f4"}
          onMouseLeave={(e) => e.currentTarget.style.background="transparent"}
          >
            {emoji}
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn:"1/-1", textAlign:"center", color:"#9aa0a6", fontSize:12, padding:"16px 0" }}>No results</div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── SVG helpers ───────────────────────────────────────────────────────────────
function SvgOverlay({ svgFn, height, style }) {
  if (!svgFn || !height) return null;
  const scalable = svgFn(800).replace(/width="\d+"/, 'width="100%"');
  return (
    <div style={{ position:"absolute", left:0, right:0, ...style, height, pointerEvents:"none", overflow:"hidden" }}
      dangerouslySetInnerHTML={{ __html: scalable }} />
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
    <div style={{ position:"absolute", ...posStyle, width:size, height:size, pointerEvents:"none", zIndex:2, opacity:0.85, transform:`rotate(${rotMap[position]||0}deg)` }}
      dangerouslySetInnerHTML={{ __html: svgFn(size) }} />
  );
}

// ── Single page sheet ─────────────────────────────────────────────────────────
function PageSheet({
  pageIndex, totalPages, pageData, template, font,
  onChange, onFocus, pageWidth, textareaRef,
}) {
  const tpl   = TEMPLATES[template] || TEMPLATES.plain;
  const fDef  = HANDWRITING_FONTS[font] || HANDWRITING_FONTS.default;
  const decor = tpl.uiDecor;
  const sheetRef = useRef(null);

  const sheetH      = Math.round(pageWidth * A4_RATIO);
  const headerBandH = decor.headerSvgH || 0;
  const footerBandH = decor.footerSvgH || 0;
  const bodyH = sheetH - headerBandH - footerBandH - PAGE_PADDING_H * 2 - (footerBandH > 0 ? 24 : 0);

  const linesUsed = countWrappedLines(pageData, fDef.editorFamily);
  const linesLeft = MAX_LINES_PER_PAGE - linesUsed;
  const nearLimit = linesLeft <= 3 && linesLeft > 0;
  const pageFull  = linesLeft <= 0;

  const ruledBg    = decor.lineColor
    ? `repeating-linear-gradient(to bottom, transparent, transparent ${CANVAS.lineSpacing - 1}px, ${decor.lineColor} ${CANVAS.lineSpacing}px)`
    : "transparent";
  const textareaBg = decor.lineColor ? `${ruledBg}, ${decor.textareaBg}` : (decor.textareaBg || "#fff");

  return (
    <div
      ref={sheetRef}
      style={{ position:"relative", width:"100%", height:sheetH }}
    >
      <div style={{
        position:"absolute", inset:0,
        background:   decor.containerBg   || "#fff",
        border:       decor.containerBorder || "1px solid #e8eaed",
        borderRadius: 4,
        overflow:     "hidden",
        boxShadow:    "0 2px 12px rgba(0,0,0,0.10)",
      }}>
        <Corner svgFn={decor.cornerSvg} size={decor.cornerSize} position="top-left" />
        <Corner svgFn={decor.cornerSvg} size={decor.cornerSize} position="top-right" />
        <Corner svgFn={decor.cornerSvg} size={decor.cornerSize} position="bottom-left" />
        <Corner svgFn={decor.cornerSvg} size={decor.cornerSize} position="bottom-right" />

        {decor.headerSvg && headerBandH > 0 && (
          <div style={{ position:"absolute", top:0, left:0, right:0, height:headerBandH, background:decor.headerBg||"transparent", borderBottom:decor.headerBorderBottom, zIndex:2, overflow:"hidden" }}>
            <SvgOverlay svgFn={decor.headerSvg} height={headerBandH} style={{ top:0 }} />
          </div>
        )}
        {decor.footerSvg && footerBandH > 0 && (
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:footerBandH+24, background:decor.footerBg||"transparent", borderTop:decor.footerBorderTop, zIndex:2, overflow:"hidden" }}>
            <SvgOverlay svgFn={decor.footerSvg} height={footerBandH} style={{ top:0 }} />
            <div style={{ position:"absolute", bottom:4, right:PAGE_PADDING_W, fontSize:10, color:decor.textareaColor, opacity:0.5 }}>
              Page {pageIndex + 1} of {totalPages}
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={pageData}
          onChange={(e) => onChange(pageIndex, e.target.value)}
          onFocus={() => onFocus(pageIndex)}
          placeholder={pageIndex === 0 ? "Start writing…" : ""}
          style={{
            position:"absolute",
            top:    headerBandH + PAGE_PADDING_H,
            left:   PAGE_PADDING_W + (decor.textareaBorderLeft ? 12 : 0),
            right:  PAGE_PADDING_W,
            height: bodyH,
            border:"none", outline:"none", resize:"none",
            overflow:"hidden",
            fontSize:"16px",
            lineHeight:`${CANVAS.lineSpacing}px`,
            fontFamily: fDef.editorFamily,
            color: decor.textareaColor || "#202124",
            background: textareaBg,
            backgroundSize:`100% ${CANVAS.lineSpacing}px`,
            backgroundAttachment:"local",
            borderLeft: decor.textareaBorderLeft || "none",
            zIndex:1,
          }}
        />

        <div style={{
          position:"absolute",
          bottom: footerBandH + (footerBandH > 0 ? 28 : 6),
          right:  PAGE_PADDING_W,
          fontSize:10, zIndex:3, pointerEvents:"none",
          color:   pageFull ? "#d93025" : nearLimit ? "#f57c00" : (decor.textareaColor||"#9aa0a6"),
          opacity: (nearLimit || pageFull) ? 1 : 0,
          background: "rgba(255,255,255,0.7)",
          padding: "1px 4px", borderRadius: 3,
        }}>
          {pageFull ? "↓ Page full — writing continues below" : `${linesLeft} line${linesLeft===1?"":"s"} left`}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
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

export default function Editor(props) {
  if (!props.selectedDiary) return <EditorEmpty />;
  return <EditorInner {...props} />;
}

// ── Main editor ───────────────────────────────────────────────────────────────
function EditorInner({
  selectedDiary, selectedDate,
  pages, setPages, currentPage, setCurrentPage,
  isDirty, setIsDirty, saving,
  entryTitle, setEntryTitle,
  onSave, onOpenTemplatePicker,
}) {
  const scrollRef      = useRef(null);
  const containerRef   = useRef(null);
  const textareaRefs   = useRef([]);    // direct DOM nodes
  const emojiAnchorRef = useRef(null);
  const [pageWidth, setPageWidth]     = useState(600);
  const [showPreview, setShowPreview] = useState(false);
  const [focusedPage, setFocusedPage] = useState(0);
  const [showEmoji, setShowEmoji]     = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      setPageWidth(Math.max(380, entries[0].contentRect.width - 48));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top:0 });
    setFocusedPage(0);
  }, [selectedDiary?.id, selectedDate?.toDateString?.()]); // eslint-disable-line

  const safeIdx       = Math.min(focusedPage, Math.max(0, pages.length - 1));
  const currentTplKey = pages[safeIdx]?.meta?.template || "plain";
  const currentFntKey = pages[safeIdx]?.meta?.font     || "default";
  const currentTpl    = TEMPLATES[currentTplKey] || TEMPLATES.plain;
  const currentFont   = HANDWRITING_FONTS[currentFntKey] || HANDWRITING_FONTS.default;
  const decor         = currentTpl.uiDecor;

  // ── Insert emoji at cursor in the focused textarea ─────────────────────────
  const insertEmoji = useCallback((emoji) => {
    const ta = textareaRefs.current[focusedPage];
    if (!ta) {
      // fallback: append to end
      const updated = pages.map(ensureMeta);
      updated[focusedPage] = { ...updated[focusedPage], data: (updated[focusedPage].data || "") + emoji };
      setPages(updated); setIsDirty(true);
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end   = ta.selectionEnd   ?? ta.value.length;
    const before = ta.value.slice(0, start);
    const after  = ta.value.slice(end);
    const newVal = before + emoji + after;

    const updated = pages.map(ensureMeta);
    updated[focusedPage] = { ...updated[focusedPage], data: newVal };
    setPages(updated);
    setIsDirty(true);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      if (textareaRefs.current[focusedPage]) {
        const pos = start + emoji.length;
        textareaRefs.current[focusedPage].focus();
        textareaRefs.current[focusedPage].setSelectionRange(pos, pos);
      }
    });
  }, [focusedPage, pages, setPages, setIsDirty]);

  // ── Page text overflow handler ────────────────────────────────────────────
  const handlePageChange = useCallback((pageIdx, newText) => {
    const fontFamily = (HANDWRITING_FONTS[pages[pageIdx]?.meta?.font] || HANDWRITING_FONTS.default).editorFamily;
    const updated    = pages.map(ensureMeta);
    const lineCount  = countWrappedLines(newText, fontFamily);

    if (lineCount <= MAX_LINES_PER_PAGE) {
      updated[pageIdx] = { ...updated[pageIdx], data: newText };
      setPages(updated); setIsDirty(true);
      return;
    }

    const rawLines = newText.split("\n");
    let budget = MAX_LINES_PER_PAGE, splitIdx = rawLines.length;
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
      const next = updated[nextIdx];
      updated[nextIdx] = { ...next, data: overflowText + (next.data ? "\n" + next.data : "") };
    } else {
      updated.push({ ...ensureMeta(""), meta:{ template:currentTplKey, font:currentFntKey }, data:overflowText });
    }
    setPages(updated); setIsDirty(true);

    setTimeout(() => {
      const nextTA = textareaRefs.current[nextIdx];
      if (nextTA) { nextTA.focus(); nextTA.setSelectionRange(0,0); nextTA.scrollTop=0; }
      const sheets = scrollRef.current?.querySelectorAll("[data-page-sheet]");
      sheets?.[nextIdx]?.scrollIntoView({ behavior:"smooth", block:"nearest" });
    }, 30);
  }, [pages, currentTplKey, currentFntKey, setPages, setIsDirty]);

  const handleFontChange = (e) => {
    const updated = pages.map(ensureMeta);
    updated[safeIdx] = { ...updated[safeIdx], meta:{ template:currentTplKey, font:e.target.value } };
    setPages(updated); setIsDirty(true);
  };

  const addPage = () => {
    setPages((prev) => [...prev.map(ensureMeta), { ...ensureMeta(""), meta:{ template:currentTplKey, font:currentFntKey } }]);
    setIsDirty(true);
    setTimeout(() => {
      const sheets = scrollRef.current?.querySelectorAll("[data-page-sheet]");
      sheets?.[pages.length]?.scrollIntoView({ behavior:"smooth", block:"start" });
    }, 80);
  };

  const deletePage = (idx) => {
    if (pages.length <= 1) return;
    if (!window.confirm("Delete this page?")) return;
    setPages(pages.filter((_,i)=>i!==idx).map(ensureMeta)); setIsDirty(true);
  };

  return (
    <>
      <main style={{ flex:1, display:"flex", overflow:"hidden", background:"#e8eaed" }}>
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* ── Fixed toolbar ── */}
          <div style={{
            background: decor.headerBg || "#fff",
            borderBottom: decor.headerBorderBottom || "1px solid #e8eaed",
            flexShrink:0, zIndex:10, position:"relative",
            paddingBottom: decor.headerSvgH || 0,
          }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"10px 16px", gap:10 }}>

              {/* Left: diary name + date + entry title */}
              <div style={{ display:"flex", flexDirection:"column", gap:3, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ fontSize:14 }}>{selectedDiary.emoji || "📔"}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:decor.textareaColor||"#202124", opacity:0.85 }}>
                    {selectedDiary.name || "Diary"}
                  </span>
                  {isDirty && <span style={{ width:6, height:6, borderRadius:"50%", background:"#fbbc04", display:"inline-block", flexShrink:0 }} title="Unsaved" />}
                </div>
                <span style={{ fontSize:11, color:decor.textareaColor||"#9aa0a6", opacity:0.55 }}>
                  {selectedDate.toLocaleDateString("default", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
                </span>
                <input
                  type="text" value={entryTitle}
                  onChange={(e)=>{ setEntryTitle(e.target.value); setIsDirty(true); }}
                  placeholder="Add a title for this entry…"
                  style={{ fontSize:14, fontWeight:600, color:decor.textareaColor||"#202124", background:"transparent", border:"none", borderBottom:`1.5px solid ${decor.textareaColor||"#202124"}33`, outline:"none", padding:"2px 0", width:240, fontFamily:"inherit" }}
                  onFocus={(e) => e.target.style.borderBottomColor = decor.btnBg||"#1a73e8"}
                  onBlur={(e)  => e.target.style.borderBottomColor = `${decor.textareaColor||"#202124"}33`}
                />
              </div>

              {/* Right: controls */}
              <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>

                {/* Theme */}
                <button style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 9px", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", cursor:"pointer", fontSize:12, color:decor.textareaColor||"#202124", whiteSpace:"nowrap" }}
                  onClick={onOpenTemplatePicker} title="Change theme">
                  <span style={{ fontSize:14 }}>{currentTpl.emoji}</span>
                  <span>{currentTpl.label}</span>
                  <span style={{ fontSize:10, opacity:0.6 }}>▾</span>
                </button>

                {/* Font */}
                <div style={{ display:"flex", alignItems:"center", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", padding:"0 6px 0 8px", gap:3, height:30 }}>
                  <span style={{ fontSize:13, color:decor.textareaColor||"#202124", flexShrink:0 }}>✍</span>
                  <select value={currentFntKey} onChange={handleFontChange}
                    style={{ border:"none", outline:"none", background:"transparent", fontSize:12, color:decor.textareaColor||"#202124", cursor:"pointer", maxWidth:120, fontFamily:currentFont.editorFamily }}>
                    {FONT_KEYS.map((key) => {
                      const f = HANDWRITING_FONTS[key];
                      return <option key={key} value={key} style={{ fontFamily:f.editorFamily }}>{f.emoji}  {f.label}</option>;
                    })}
                  </select>
                </div>

                {/* 😊 Emoji button */}
                <button
                  ref={emojiAnchorRef}
                  style={{ padding:"5px 10px", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background: showEmoji ? (decor.btnBg||"#1a73e8") : "rgba(255,255,255,0.25)", cursor:"pointer", fontSize:18, color: showEmoji ? (decor.btnColor||"#fff") : "inherit", lineHeight:1 }}
                  onClick={() => setShowEmoji((v) => !v)}
                  title="Insert emoji"
                >😊</button>

                {/* + Page */}
                <button style={{ padding:"5px 9px", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", cursor:"pointer", fontSize:12, color:decor.textareaColor||"#202124" }}
                  onClick={addPage}>+ Page</button>

                {/* Preview */}
                <button style={{ padding:"5px 9px", background:"rgba(255,255,255,0.25)", color:decor.textareaColor||"#202124", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, cursor:"pointer", fontSize:12 }}
                  onClick={() => setShowPreview(true)}>👁 Preview</button>

                {/* Save */}
                <button style={{ ...shared.btnPrimary, background:decor.btnBg||"#1a73e8", color:decor.btnColor||"#fff", opacity:saving?0.7:1, fontSize:12, padding:"5px 12px" }}
                  onClick={onSave} disabled={saving} title="Save (Ctrl+S)">
                  {saving ? <><span style={shared.spinner} /> Saving…</> : isDirty ? "Save" : "✓ Saved"}
                </button>
              </div>
            </div>
            <SvgOverlay svgFn={decor.headerSvg} height={decor.headerSvgH} style={{ bottom:0 }} />
          </div>

          {/* ── Scrollable page stack ── */}
          <div
            ref={(el) => { scrollRef.current = el; containerRef.current = el; }}
            style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:"24px", display:"flex", flexDirection:"column", gap:PAGE_GAP, alignItems:"center" }}
          >
            {pages.map((page, idx) => {
              const pg = ensureMeta(page);
              return (
                <div key={idx} data-page-sheet={idx} style={{ width:"100%", maxWidth:780 }}>
                  <PageSheet
                    pageIndex={idx}
                    totalPages={pages.length}
                    pageData={pg.data}
                    template={pg.meta.template}
                    font={pg.meta.font}
                    pageWidth={Math.min(pageWidth, 780)}
                    textareaRef={(el) => { textareaRefs.current[idx] = el; }}
                    onChange={handlePageChange}
                    onFocus={(i) => { setFocusedPage(i); setCurrentPage(i); }}
                  />
                  {pages.length > 1 && (
                    <div style={{ textAlign:"right", marginTop:4 }}>
                      <button style={{ fontSize:11, color:"#d93025", border:"none", background:"transparent", cursor:"pointer", padding:"2px 4px", opacity:0.7 }}
                        onClick={() => deletePage(idx)}>✕ Delete page {idx+1}</button>
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={addPage}
              style={{ marginTop:4, padding:"10px 28px", border:"2px dashed #bbb", borderRadius:8, background:"rgba(255,255,255,0.6)", color:"#666", cursor:"pointer", fontSize:13, fontWeight:500, width:"100%", maxWidth:780 }}>
              + Add page
            </button>
          </div>
        </div>
      </main>

      {/* Emoji picker popover */}
      {showEmoji && (
        <EmojiPicker
          anchorRef={emojiAnchorRef}
          onSelect={(emoji) => { insertEmoji(emoji); /* keep picker open like WhatsApp */ }}
          onClose={() => setShowEmoji(false)}
        />
      )}

      {/* Preview modal */}
      {showPreview && (
        <PdfPreview
          selectedFile={{ name:entryTitle||selectedDiary?.name||"Diary Entry", diaryName:selectedDiary?.name||"Diary", createdAt:selectedDate?.toISOString()||new Date().toISOString() }}
          pages={pages}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
