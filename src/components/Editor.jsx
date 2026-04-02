// src/components/Editor.jsx
import { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { shared } from "../styles/tokens";
import { TEMPLATES, HANDWRITING_FONTS, FONT_KEYS, ensureMeta } from "../utils/templates";
import PdfPreview from "./PdfPreview";
import { MAX_LINES_PER_PAGE, CANVAS, wrapWords } from "../utils/pageSpec";
import { buildDefaultTitle } from "../hooks/useDiary";

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

const EMOJI_CATS = [
  { label:"😊 Smileys", emojis:["😀","😂","😍","🥰","😘","😎","🤩","😢","😭","😡","🤔","😴","🥳","😇","🤗","😏","🙄","😤","🤯","🥺","😬","😳","🤭","🫡","💀","👻","🤡","💩","😈","👽"] },
  { label:"👋 People",  emojis:["👍","👎","👏","🙌","🤝","🤜","✌️","🤞","🫶","❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💕","💯","🔥","✨","⭐","🌟","💫","🎉","🎊","🎈","🎁","🏆"] },
  { label:"🐶 Animals", emojis:["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐙","🦋","🐝","🦄","🐳","🦈","🐬","🦭","🦓","🦒","🦘","🦙","🐉","🦕","🦖","🐾"] },
  { label:"🍕 Food",    emojis:["🍎","🍊","🍋","🍇","🍓","🍒","🍑","🥭","🍍","🥥","🍕","🍔","🌮","🍜","🍣","🍩","🍰","🎂","🧁","🍫","🍿","☕","🧋","🍵","🥤","🍺","🥂","🍾","🫖","🧃"] },
  { label:"🌸 Nature",  emojis:["🌸","🌺","🌻","🌹","🌷","💐","🌿","🍀","🍁","🍂","🍃","🌱","🌲","🌳","🌴","🌵","🎋","🎍","🪴","🌾","🍄","🐚","🪸","🌊","🌬️","🌈","⛅","🌤️","❄️","⚡"] },
];

function EmojiPicker({ onSelect, onClose, anchorRef }) {
  const [cat, setCat]       = useState(0);
  const [search, setSearch] = useState("");
  const pickerRef           = useRef(null);
  const [pos, setPos]       = useState({ top:0, left:0 });
  useEffect(() => {
    if (!anchorRef?.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setPos({ top: window.innerHeight - r.bottom > 320 ? r.bottom + 4 : r.top - 324, left: Math.min(r.left, window.innerWidth - 280) });
  }, [anchorRef]);
  useEffect(() => {
    const h = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target) && anchorRef?.current && !anchorRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose, anchorRef]);
  const filtered = search.trim() ? EMOJI_CATS.flatMap((c) => c.emojis).filter((e) => e.includes(search)) : EMOJI_CATS[cat].emojis;
  return createPortal(
    <div ref={pickerRef} style={{ position:"fixed", top:pos.top, left:pos.left, width:272, background:"#fff", border:"1px solid #e0e0e0", borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.18)", zIndex:10000, overflow:"hidden", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"8px 10px 4px" }}>
        <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search emoji…" style={{ width:"100%", padding:"6px 10px", border:"1px solid #e0e0e0", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box" }} />
      </div>
      {!search && (
        <div style={{ display:"flex", overflowX:"auto", padding:"4px 8px 0", gap:2, flexShrink:0, scrollbarWidth:"none" }}>
          {EMOJI_CATS.map((c, i) => <button key={i} onClick={() => setCat(i)} style={{ border:"none", borderRadius:6, padding:"4px 6px", cursor:"pointer", fontSize:16, flexShrink:0, background: cat===i ? "#f1f3f4" : "transparent" }}>{c.label.split(" ")[0]}</button>)}
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:2, padding:"6px 8px 8px", overflowY:"auto", maxHeight:230 }}>
        {filtered.map((emoji, i) => (
          <button key={i} onClick={() => onSelect(emoji)} style={{ border:"none", background:"transparent", fontSize:22, cursor:"pointer", borderRadius:6, padding:"3px 2px", lineHeight:1 }}
            onMouseEnter={(e) => e.currentTarget.style.background="#f1f3f4"} onMouseLeave={(e) => e.currentTarget.style.background="transparent"}>{emoji}</button>
        ))}
        {filtered.length === 0 && <div style={{ gridColumn:"1/-1", textAlign:"center", color:"#9aa0a6", fontSize:12, padding:"16px 0" }}>No results</div>}
      </div>
    </div>, document.body
  );
}

function SvgOverlay({ svgFn, height, style }) {
  if (!svgFn || !height) return null;
  return <div style={{ position:"absolute", left:0, right:0, ...style, height, pointerEvents:"none", overflow:"hidden" }} dangerouslySetInnerHTML={{ __html: svgFn(800).replace(/width="\d+"/, 'width="100%"') }} />;
}
function Corner({ svgFn, size, position }) {
  if (!svgFn || !size) return null;
  const p = {};
  if (position.includes("top"))    p.top    = 0;
  if (position.includes("bottom")) p.bottom = 0;
  if (position.includes("left"))   p.left   = 0;
  if (position.includes("right"))  p.right  = 0;
  const rot = { "top-left":0, "top-right":90, "bottom-right":180, "bottom-left":270 };
  return <div style={{ position:"absolute", ...p, width:size, height:size, pointerEvents:"none", zIndex:2, opacity:0.85, transform:`rotate(${rot[position]||0}deg)` }} dangerouslySetInnerHTML={{ __html: svgFn(size) }} />;
}

// ── Photo item — rendered directly inside the page wrapper ────────────────────
function PhotoItem({ photo, onUpdate, onDelete }) {
  const [hovered, setHovered] = useState(false);

  const startDrag = (e) => {
    if (e.target.dataset.handle) return;
    e.preventDefault(); e.stopPropagation();
    const ox = e.clientX - photo.x, oy = e.clientY - photo.y;
    const move = (ev) => onUpdate({ ...photo, x: Math.max(0, ev.clientX - ox), y: Math.max(0, ev.clientY - oy) });
    const up   = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const startResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sw = photo.w, ratio = photo.h / photo.w;
    const move = (ev) => { const nw = Math.max(60, sw + ev.clientX - sx); onUpdate({ ...photo, w: nw, h: Math.round(nw * ratio) }); };
    const up   = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div style={{ position:"absolute", left:photo.x, top:photo.y, width:photo.w, height:photo.h, transform:photo.rotation?`rotate(${photo.rotation}deg)`:undefined, cursor:"move", userSelect:"none", zIndex:20 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onMouseDown={startDrag}>
      <img src={photo.src} alt="" draggable={false}
        style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", borderRadius:4, border:hovered?"2px solid #1a73e8":"2px solid rgba(0,0,0,0.15)", boxShadow:"0 2px 8px rgba(0,0,0,0.2)", pointerEvents:"none" }} />
      {hovered && <>
        <button data-handle="del" onMouseDown={(e) => { e.stopPropagation(); onDelete(photo.id); }}
          style={{ position:"absolute", top:-10, right:-10, width:20, height:20, borderRadius:"50%", background:"#d93025", color:"#fff", border:"2px solid #fff", fontSize:11, cursor:"pointer", zIndex:25, padding:0, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        <div data-handle="resize" onMouseDown={startResize}
          style={{ position:"absolute", bottom:-6, right:-6, width:14, height:14, borderRadius:"50%", background:"#1a73e8", border:"2px solid #fff", cursor:"se-resize", zIndex:25 }} />
        <div style={{ position:"absolute", bottom:-28, left:"50%", transform:"translateX(-50%)", display:"flex", gap:3, zIndex:25 }}>
          {[[-15,"↺"],[15,"↻"]].map(([deg,label]) => (
            <button key={deg} data-handle="rot" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onUpdate({ ...photo, rotation:((photo.rotation||0)+deg+360)%360 }); }}
              style={{ width:22, height:22, fontSize:12, border:"1px solid #ddd", background:"#fff", borderRadius:4, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>{label}</button>
          ))}
        </div>
        <div style={{ position:"absolute", top:-20, left:0, fontSize:10, color:"#1a73e8", background:"rgba(255,255,255,0.9)", padding:"1px 5px", borderRadius:3, whiteSpace:"nowrap", pointerEvents:"none" }}>
          {Math.round(photo.w)} × {Math.round(photo.h)}
        </div>
      </>}
    </div>
  );
}

// ── PageSheet ─────────────────────────────────────────────────────────────────
function PageSheet({ pageIndex, totalPages, pageData, template, font, photos, onPhotoUpdate, onPhotoDelete, onChange, onFocus, pageWidth, textareaRef }) {
  const tpl   = TEMPLATES[template] || TEMPLATES.plain;
  const fDef  = HANDWRITING_FONTS[font] || HANDWRITING_FONTS.default;
  const decor = tpl.uiDecor;
  const sheetH      = Math.round(pageWidth * A4_RATIO);
  const headerBandH = decor.headerSvgH || 0;
  const footerBandH = decor.footerSvgH || 0;
  const bodyH       = sheetH - headerBandH - footerBandH - PAGE_PADDING_H * 2 - (footerBandH > 0 ? 24 : 0);
  const linesUsed   = countWrappedLines(pageData, fDef.editorFamily);
  const linesLeft   = MAX_LINES_PER_PAGE - linesUsed;
  const nearLimit   = linesLeft <= 3 && linesLeft > 0;
  const pageFull    = linesLeft <= 0;
  const ruledBg     = decor.lineColor ? `repeating-linear-gradient(to bottom, transparent, transparent ${CANVAS.lineSpacing-1}px, ${decor.lineColor} ${CANVAS.lineSpacing}px)` : "transparent";
  const textareaBg  = decor.lineColor ? `${ruledBg}, ${decor.textareaBg}` : (decor.textareaBg || "#fff");

  return (
    // wrapper: position relative, NO overflow — photos are absolutely positioned inside and fully visible
    <div style={{ position:"relative", width:"100%", height:sheetH }}>

      {/* Page surface with overflow:hidden for template decorations */}
      <div style={{ position:"absolute", inset:0, background:decor.containerBg||"#fff", border:decor.containerBorder||"1px solid #e8eaed", borderRadius:4, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.10)" }}>
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
            <div style={{ position:"absolute", bottom:4, right:PAGE_PADDING_W, fontSize:10, color:decor.textareaColor, opacity:0.5 }}>Page {pageIndex+1} of {totalPages}</div>
          </div>
        )}
        <textarea ref={textareaRef} value={pageData} onChange={(e) => onChange(pageIndex, e.target.value)} onFocus={() => onFocus(pageIndex)} placeholder={pageIndex===0?"Start writing…":""}
          style={{ position:"absolute", top:headerBandH+PAGE_PADDING_H, left:PAGE_PADDING_W+(decor.textareaBorderLeft?12:0), right:PAGE_PADDING_W, height:bodyH, border:"none", outline:"none", resize:"none", overflow:"hidden", fontSize:"16px", lineHeight:`${CANVAS.lineSpacing}px`, fontFamily:fDef.editorFamily, color:decor.textareaColor||"#202124", background:textareaBg, backgroundSize:`100% ${CANVAS.lineSpacing}px`, backgroundAttachment:"local", borderLeft:decor.textareaBorderLeft||"none", zIndex:1 }} />
        <div style={{ position:"absolute", bottom:footerBandH+(footerBandH>0?28:6), right:PAGE_PADDING_W, fontSize:10, zIndex:3, pointerEvents:"none", color:pageFull?"#d93025":nearLimit?"#f57c00":(decor.textareaColor||"#9aa0a6"), opacity:(nearLimit||pageFull)?1:0, background:"rgba(255,255,255,0.7)", padding:"1px 4px", borderRadius:3 }}>
          {pageFull?"↓ Page full — writing continues below":`${linesLeft} line${linesLeft===1?"":"s"} left`}
        </div>
      </div>

      {/* Photos — rendered OUTSIDE the overflow:hidden page div, as siblings inside the wrapper */}
      {/* The wrapper has no overflow set so photos are NOT clipped */}
      {(photos || []).map((photo) => (
        <PhotoItem
          key={photo.id}
          photo={photo}
          onUpdate={(updated) => onPhotoUpdate(pageIndex, updated)}
          onDelete={(id) => onPhotoDelete(pageIndex, id)}
        />
      ))}
    </div>
  );
}

function EditorEmpty() {
  return (
    <main style={{ flex:1, display:"flex", overflow:"hidden" }}>
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column" }}>
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

function EditorInner({ selectedDiary, selectedDate, pages, setPages, currentPage, setCurrentPage, isDirty, setIsDirty, saving, entryTitle, setEntryTitle, onSave, onOpenTemplatePicker }) {
  const scrollRef      = useRef(null);
  const containerRef   = useRef(null);
  const textareaRefs   = useRef([]);
  const emojiAnchorRef = useRef(null);
  const photoInputRef  = useRef(null);
  const [pageWidth,   setPageWidth]   = useState(600);
  const [showPreview, setShowPreview] = useState(false);
  const [focusedPage, setFocusedPage] = useState(0);
  const [showEmoji,   setShowEmoji]   = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => setPageWidth(Math.max(380, entries[0].contentRect.width - 48)));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { scrollRef.current?.scrollTo({ top:0 }); setFocusedPage(0); }, [selectedDiary?.id, selectedDate?.toDateString?.()]); // eslint-disable-line

  const safeIdx       = Math.min(focusedPage, Math.max(0, pages.length - 1));
  const currentTplKey = pages[safeIdx]?.meta?.template || "plain";
  const currentFntKey = pages[safeIdx]?.meta?.font     || "default";
  const currentTpl    = TEMPLATES[currentTplKey] || TEMPLATES.plain;
  const currentFont   = HANDWRITING_FONTS[currentFntKey] || HANDWRITING_FONTS.default;
  const decor         = currentTpl.uiDecor;

  const insertEmoji = useCallback((emoji) => {
    const ta = textareaRefs.current[focusedPage];
    if (!ta) {
      setPages((prev) => { const u = prev.map(ensureMeta); u[focusedPage] = { ...u[focusedPage], data:(u[focusedPage].data||"")+emoji }; return u; });
      setIsDirty(true); return;
    }
    const start = ta.selectionStart ?? ta.value.length, end = ta.selectionEnd ?? ta.value.length;
    const newVal = ta.value.slice(0, start) + emoji + ta.value.slice(end);
    setPages((prev) => { const u = prev.map(ensureMeta); u[focusedPage] = { ...u[focusedPage], data:newVal }; return u; });
    setIsDirty(true);
    requestAnimationFrame(() => { if (textareaRefs.current[focusedPage]) { textareaRefs.current[focusedPage].focus(); textareaRefs.current[focusedPage].setSelectionRange(start+emoji.length, start+emoji.length); } });
  }, [focusedPage, setPages, setIsDirty]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxW = Math.min(pageWidth * 0.45, 240), ratio = img.naturalHeight / img.naturalWidth;
        const photo = { id:`photo_${Date.now()}`, src:ev.target.result, x:60, y:100, w:maxW, h:Math.round(maxW*ratio), rotation:0 };
        setPages((prev) => {
          const updated = prev.map(ensureMeta);
          // ensureMeta now preserves photos — safe to use
          updated[focusedPage] = { ...updated[focusedPage], photos:[...(updated[focusedPage].photos||[]), photo] };
          return updated;
        });
        setIsDirty(true);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handlePhotoUpdate = useCallback((pageIdx, updated) => {
    setPages((prev) => {
      const next = prev.map(ensureMeta);
      next[pageIdx] = { ...next[pageIdx], photos:(next[pageIdx].photos||[]).map((p) => p.id===updated.id ? updated : p) };
      return next;
    });
    setIsDirty(true);
  }, [setPages, setIsDirty]);

  const handlePhotoDelete = useCallback((pageIdx, photoId) => {
    setPages((prev) => {
      const next = prev.map(ensureMeta);
      next[pageIdx] = { ...next[pageIdx], photos:(next[pageIdx].photos||[]).filter((p) => p.id!==photoId) };
      return next;
    });
    setIsDirty(true);
  }, [setPages, setIsDirty]);

  const handlePageChange = useCallback((pageIdx, newText) => {
    const fontFamily = (HANDWRITING_FONTS[pages[pageIdx]?.meta?.font] || HANDWRITING_FONTS.default).editorFamily;
    const updated    = pages.map(ensureMeta);
    if (countWrappedLines(newText, fontFamily) <= MAX_LINES_PER_PAGE) {
      updated[pageIdx] = { ...updated[pageIdx], data:newText };
      setPages(updated); setIsDirty(true); return;
    }
    const rawLines = newText.split("\n");
    let budget = MAX_LINES_PER_PAGE, splitIdx = rawLines.length;
    for (let i = 0; i < rawLines.length; i++) {
      const wc = Math.max(1, Math.ceil((rawLines[i].length||1)/CHARS_PER_LINE));
      if (budget - wc < 0) { splitIdx = i; break; }
      budget -= wc;
    }
    updated[pageIdx] = { ...updated[pageIdx], data:rawLines.slice(0,splitIdx).join("\n") };
    const nextIdx = pageIdx+1, overflow = rawLines.slice(splitIdx).join("\n");
    if (nextIdx < updated.length) {
      updated[nextIdx] = { ...updated[nextIdx], data:overflow+(updated[nextIdx].data?"\n"+updated[nextIdx].data:"") };
    } else {
      updated.push({ ...ensureMeta(""), meta:{ template:currentTplKey, font:currentFntKey }, data:overflow });
    }
    setPages(updated); setIsDirty(true);
    setTimeout(() => {
      const nextTA = textareaRefs.current[nextIdx];
      if (nextTA) { nextTA.focus(); nextTA.setSelectionRange(0,0); nextTA.scrollTop=0; }
      scrollRef.current?.querySelectorAll("[data-page-sheet]")?.[nextIdx]?.scrollIntoView({ behavior:"smooth", block:"nearest" });
    }, 30);
  }, [pages, currentTplKey, currentFntKey, setPages, setIsDirty]);

  const handleFontChange = (e) => {
    setPages((prev) => { const u = prev.map(ensureMeta); u[safeIdx] = { ...u[safeIdx], meta:{ template:currentTplKey, font:e.target.value } }; return u; });
    setIsDirty(true);
  };

  const addPage = () => {
    setPages((prev) => [...prev.map(ensureMeta), { ...ensureMeta(""), meta:{ template:currentTplKey, font:currentFntKey } }]);
    setIsDirty(true);
    setTimeout(() => scrollRef.current?.querySelectorAll("[data-page-sheet]")?.[pages.length]?.scrollIntoView({ behavior:"smooth", block:"start" }), 80);
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

          {/* Toolbar */}
          <div style={{ background:decor.headerBg||"#fff", borderBottom:decor.headerBorderBottom||"1px solid #e8eaed", flexShrink:0, zIndex:10, position:"relative", paddingBottom:decor.headerSvgH||0 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding:"10px 16px", gap:10 }}>
              <div style={{ display:"flex", flexDirection:"column", gap:3, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ fontSize:14 }}>{selectedDiary.emoji||"📔"}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:decor.textareaColor||"#202124", opacity:0.85 }}>{selectedDiary.name||"Diary"}</span>
                  {isDirty && <span style={{ width:6, height:6, borderRadius:"50%", background:"#fbbc04", display:"inline-block", flexShrink:0 }} />}
                </div>
                <span style={{ fontSize:11, color:decor.textareaColor||"#9aa0a6", opacity:0.55 }}>
                  {selectedDate.toLocaleDateString("default", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
                </span>
                <input type="text" value={entryTitle} onChange={(e) => { setEntryTitle(e.target.value); setIsDirty(true); }} placeholder="Entry title…"
                  style={{ fontSize:14, fontWeight:600, color:decor.textareaColor||"#202124", background:"transparent", border:"none", borderBottom:`1.5px solid ${decor.textareaColor||"#202124"}33`, outline:"none", padding:"2px 0", width:300, fontFamily:"inherit", cursor:"text" }}
                  onFocus={(e) => e.target.style.borderBottomColor=decor.btnBg||"#1a73e8"}
                  onBlur={(e)  => e.target.style.borderBottomColor=`${decor.textareaColor||"#202124"}33`} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
                <button style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 9px", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", cursor:"pointer", fontSize:12, color:decor.textareaColor||"#202124", whiteSpace:"nowrap" }} onClick={onOpenTemplatePicker}>
                  <span style={{ fontSize:14 }}>{currentTpl.emoji}</span><span>{currentTpl.label}</span><span style={{ fontSize:10, opacity:0.6 }}>▾</span>
                </button>
                <div style={{ display:"flex", alignItems:"center", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", padding:"0 6px 0 8px", gap:3, height:30 }}>
                  <span style={{ fontSize:13, color:decor.textareaColor||"#202124", flexShrink:0 }}>✍</span>
                  <select value={currentFntKey} onChange={handleFontChange} style={{ border:"none", outline:"none", background:"transparent", fontSize:12, color:decor.textareaColor||"#202124", cursor:"pointer", maxWidth:120, fontFamily:currentFont.editorFamily }}>
                    {FONT_KEYS.map((key) => { const f=HANDWRITING_FONTS[key]; return <option key={key} value={key} style={{ fontFamily:f.editorFamily }}>{f.emoji}  {f.label}</option>; })}
                  </select>
                </div>
                <button ref={emojiAnchorRef} style={{ padding:"5px 10px", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:showEmoji?(decor.btnBg||"#1a73e8"):"rgba(255,255,255,0.25)", cursor:"pointer", fontSize:18, color:showEmoji?(decor.btnColor||"#fff"):"inherit", lineHeight:1 }}
                  onClick={() => setShowEmoji((v) => !v)}>😊</button>
                <button style={{ padding:"5px 10px", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", cursor:"pointer", fontSize:18, lineHeight:1, color:decor.textareaColor||"#202124" }}
                  onClick={() => photoInputRef.current?.click()} title={`Add photo to page ${focusedPage+1}`}>📷</button>
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhotoUpload} />
                <button style={{ padding:"5px 9px", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", cursor:"pointer", fontSize:12, color:decor.textareaColor||"#202124" }} onClick={addPage}>+ Page</button>
                <button style={{ padding:"5px 9px", background:"rgba(255,255,255,0.25)", color:decor.textareaColor||"#202124", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, cursor:"pointer", fontSize:12 }} onClick={() => setShowPreview(true)}>👁 Preview</button>
                <button style={{ ...shared.btnPrimary, background:decor.btnBg||"#1a73e8", color:decor.btnColor||"#fff", opacity:saving?0.7:1, fontSize:12, padding:"5px 12px" }} onClick={onSave} disabled={saving}>
                  {saving ? <><span style={shared.spinner} />Saving…</> : isDirty ? "Save" : "✓ Saved"}
                </button>
              </div>
            </div>
            <SvgOverlay svgFn={decor.headerSvg} height={decor.headerSvgH} style={{ bottom:0 }} />
          </div>

          {/* Scroll container */}
          <div ref={(el) => { scrollRef.current = el; containerRef.current = el; }}
            style={{ flex:1, overflowY:"auto", padding:"24px", display:"flex", flexDirection:"column", gap:PAGE_GAP, alignItems:"center" }}>
            {pages.map((page, idx) => {
              const pg = ensureMeta(page);
              return (
                <div key={idx} data-page-sheet={idx} style={{ width:"100%", maxWidth:780 }}>
                  <PageSheet
                    pageIndex={idx} totalPages={pages.length}
                    pageData={pg.data} template={pg.meta.template} font={pg.meta.font}
                    photos={pg.photos || []}
                    pageWidth={Math.min(pageWidth, 780)}
                    textareaRef={(el) => { textareaRefs.current[idx] = el; }}
                    onChange={handlePageChange}
                    onFocus={(i) => { setFocusedPage(i); setCurrentPage(i); }}
                    onPhotoUpdate={handlePhotoUpdate}
                    onPhotoDelete={handlePhotoDelete}
                  />
                  {pages.length > 1 && (
                    <div style={{ textAlign:"right", marginTop:4 }}>
                      <button style={{ fontSize:11, color:"#d93025", border:"none", background:"transparent", cursor:"pointer", padding:"2px 4px", opacity:0.7 }} onClick={() => deletePage(idx)}>✕ Delete page {idx+1}</button>
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={addPage} style={{ marginTop:4, padding:"10px 28px", border:"2px dashed #bbb", borderRadius:8, background:"rgba(255,255,255,0.6)", color:"#666", cursor:"pointer", fontSize:13, fontWeight:500, width:"100%", maxWidth:780 }}>+ Add page</button>
          </div>
        </div>
      </main>

      {showEmoji && <EmojiPicker anchorRef={emojiAnchorRef} onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}
      {showPreview && (
        <PdfPreview
          selectedFile={{ name:entryTitle||buildDefaultTitle(selectedDiary?.name||"Diary",selectedDate), diaryName:selectedDiary?.name||"Diary", createdAt:selectedDate?.toISOString()||new Date().toISOString() }}
          pages={pages} onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
