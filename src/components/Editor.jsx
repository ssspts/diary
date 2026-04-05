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

// ── Helper: get clientX/Y from mouse OR touch event
function getXY(e) {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}

// 8 resize handles: corners + edges
const HANDLES = [
    { id:"nw", cursor:"nw-resize", top:-7,  left:-7,                  dx:-1, dy:-1 },
    { id:"n",  cursor:"n-resize",  top:-7,  left:"calc(50% - 7px)",   dx: 0, dy:-1 },
    { id:"ne", cursor:"ne-resize", top:-7,  right:-7,                 dx: 1, dy:-1 },
    { id:"e",  cursor:"e-resize",  top:"calc(50% - 7px)", right:-7,   dx: 1, dy: 0 },
    { id:"se", cursor:"se-resize", bottom:-7, right:-7,               dx: 1, dy: 1 },
    { id:"s",  cursor:"s-resize",  bottom:-7, left:"calc(50% - 7px)", dx: 0, dy: 1 },
    { id:"sw", cursor:"sw-resize", bottom:-7, left:-7,                dx:-1, dy: 1 },
    { id:"w",  cursor:"w-resize",  top:"calc(50% - 7px)", left:-7,    dx:-1, dy: 0 },
];

// scale: ratio of current page width to original desktop page width (780px)
// All stored coords are in desktop (780px) space.
// We display at scale, but save back in desktop space.
function PhotoItem({ photo, onUpdate, onDelete, scale = 1 }) {
    const [selected, setSelected] = useState(false);
    const isTouch = useRef(false);

    // Displayed position/size (scaled for screen)
    const dx = photo.x * scale;
    const dy = photo.y * scale;
    const dw = photo.w * scale;
    const dh = photo.h * scale;

    const addListeners = (move, up) => {
        if (isTouch.current) { window.addEventListener("touchmove", move, { passive:false }); window.addEventListener("touchend", up); }
        else { window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); }
    };
    const removeListeners = (move, up) => {
        window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up);
        window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
    };

    const startDrag = (e) => {
        if (e.target.dataset.handle) return;
        isTouch.current = e.type === "touchstart";
        e.preventDefault(); e.stopPropagation();
        if (isTouch.current) setSelected(true);
        const { x, y } = getXY(e);
        // offset in screen px from pointer to photo origin
        const ox = x - dx, oy = y - dy;
        const move = (ev) => {
            ev.preventDefault();
            const p = getXY(ev);
            // convert screen px back to desktop coords
            onUpdate({ ...photo,
                x: Math.max(0, (p.x - ox) / scale),
                y: Math.max(0, (p.y - oy) / scale),
            });
        };
        const up = () => removeListeners(move, up);
        addListeners(move, up);
    };

    const startResize = (e, handle) => {
        isTouch.current = e.type === "touchstart";
        e.preventDefault(); e.stopPropagation();
        const { x: sx, y: sy } = getXY(e);
        const { w: sw, h: sh, x: px, y: py } = photo;
        const aspect = sh / sw;
        const move = (ev) => {
            ev.preventDefault();
            const { x: cx, y: cy } = getXY(ev);
            // delta in screen px → convert to desktop px
            const ddx = (cx - sx) / scale, ddy = (cy - sy) / scale;
            let newW = sw, newH = sh, newX = px, newY = py;
            if (handle.dx === 1)  { newW = Math.max(60, sw + ddx); }
            if (handle.dx === -1) { newW = Math.max(60, sw - ddx); newX = px + (sw - newW); }
            const isCorner = handle.dx !== 0 && handle.dy !== 0;
            if (isCorner) {
                newH = Math.round(newW * aspect);
                if (handle.dy === -1) newY = py + (sh - newH);
            } else if (handle.dy === 1)  { newH = Math.max(40, sh + ddy); }
            else if (handle.dy === -1) { newH = Math.max(40, sh - ddy); newY = py + (sh - newH); }
            onUpdate({ ...photo, x: newX, y: newY, w: newW, h: newH });
        };
        const up = () => removeListeners(move, up);
        addListeners(move, up);
    };

    const rotate = (e, deg) => {
        e.preventDefault(); e.stopPropagation();
        onUpdate({ ...photo, rotation: ((photo.rotation || 0) + deg + 360) % 360 });
    };

    return (
        <div
            style={{ position:"absolute", left:dx, top:dy, width:dw, height:dh,
                transform:photo.rotation?`rotate(${photo.rotation}deg)`:undefined,
                cursor:"move", userSelect:"none", zIndex:20, touchAction:"none" }}
            onMouseEnter={() => { if (!isTouch.current) setSelected(true); }}
            onMouseLeave={() => { if (!isTouch.current) setSelected(false); }}
            onMouseDown={startDrag}
            onTouchStart={startDrag}
            onClick={(e) => { if (isTouch.current) { e.stopPropagation(); setSelected((v) => !v); } }}
        >
            <img src={photo.src} alt="" draggable={false}
                 style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", borderRadius:4,
                     border:selected?"2px solid #1a73e8":"2px solid rgba(0,0,0,0.12)",
                     boxShadow:"0 2px 8px rgba(0,0,0,0.2)", pointerEvents:"none" }} />

            {selected && <>
                <button data-handle="del"
                        onMouseDown={(e) => { e.stopPropagation(); onDelete(photo.id); }}
                        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(photo.id); }}
                        style={{ position:"absolute", top:-12, right:-12, width:26, height:26, borderRadius:"50%", background:"#d93025", color:"#fff", border:"2px solid #fff", fontSize:13, cursor:"pointer", zIndex:30, padding:0, display:"flex", alignItems:"center", justifyContent:"center", touchAction:"none" }}>✕</button>

                <div style={{ position:"absolute", top:-22, left:0, fontSize:10, color:"#1a73e8", background:"rgba(255,255,255,0.92)", padding:"1px 5px", borderRadius:3, whiteSpace:"nowrap", pointerEvents:"none" }}>
                    {Math.round(photo.w)} × {Math.round(photo.h)}
                </div>

                {HANDLES.map((h) => (
                    <div key={h.id} data-handle={h.id}
                         onMouseDown={(e) => startResize(e, h)}
                         onTouchStart={(e) => startResize(e, h)}
                         style={{ position:"absolute", width:16, height:16, borderRadius:"50%", background:"#1a73e8", border:"2px solid #fff", cursor:h.cursor, zIndex:30, touchAction:"none", top:h.top, left:h.left, right:h.right, bottom:h.bottom }} />
                ))}

                <div style={{ position:"absolute", bottom:-34, left:"50%", transform:"translateX(-50%)", display:"flex", gap:4, zIndex:30 }}>
                    {[[-15,"↺"],[15,"↻"]].map(([deg,label]) => (
                        <button key={deg} data-handle="rot"
                                onMouseDown={(e) => rotate(e, deg)}
                                onTouchEnd={(e) => rotate(e, deg)}
                                style={{ width:26, height:26, fontSize:13, border:"1px solid #ddd", background:"#fff", borderRadius:5, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0, touchAction:"none" }}>{label}</button>
                    ))}
                </div>
            </>}
        </div>
    );
}

function PageSheet({ pageIndex, totalPages, pageData, template, font, photos, onPhotoUpdate, onPhotoDelete, onChange, onFocus, pageWidth, textareaRef, isMobile }) {
    const tpl   = TEMPLATES[template] || TEMPLATES.plain;
    const fDef  = HANDWRITING_FONTS[font] || HANDWRITING_FONTS.default;
    const decor = tpl.uiDecor;
    const w            = Math.min(pageWidth, 780);
    const headerBandH  = decor.headerSvgH || 0;
    const footerBandH  = decor.footerSvgH || 0;
    const textareaCapH = MAX_LINES_PER_PAGE * CANVAS.lineSpacing;
    const sheetH       = headerBandH + footerBandH + PAGE_PADDING_H * 2
        + (footerBandH > 0 ? 24 : 0) + textareaCapH;
    const bodyH        = textareaCapH;
    const linesUsed   = countWrappedLines(pageData, fDef.editorFamily);
    const linesLeft   = MAX_LINES_PER_PAGE - linesUsed;
    const nearLimit   = linesLeft <= 3 && linesLeft > 0;
    const pageFull    = linesLeft <= 0;
    const ruledBg     = decor.lineColor ? `repeating-linear-gradient(to bottom, transparent, transparent ${CANVAS.lineSpacing-1}px, ${decor.lineColor} ${CANVAS.lineSpacing}px)` : "transparent";
    const textareaBg  = decor.lineColor ? `${ruledBg}, ${decor.textareaBg}` : (decor.textareaBg || "#fff");

    // Auto-resize textarea height on mobile so page grows with content
    const mobileTextareaRef = useRef(null);
    useEffect(() => {
        if (!isMobile) return;
        const ta = textareaRef?.current || mobileTextareaRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = ta.scrollHeight + "px";
    });

    if (isMobile) {
        // ── Mobile: page grows to full content length, no internal scroll ─────────
        // scale everything horizontally to fit screen width
        // but let height grow freely so all content is visible
        const DESKTOP_W = 780;
        const scale     = w / DESKTOP_W;
        const mSheetH   = Math.round(sheetH * scale);   // minimum height (A4 proportion)
        const mHdrH     = Math.round(headerBandH * scale);
        const mFtrH     = Math.round(footerBandH * scale);
        const mPadH     = Math.round(PAGE_PADDING_H * scale);
        const mPadW     = Math.round(PAGE_PADDING_W * scale);
        const mFontSize = Math.round(16 * scale);
        const mLineH    = Math.round(CANVAS.lineSpacing * scale);

        // Build a scaled ruled-line gradient that matches mLineH exactly,
        // offset by mPadH so lines align with the first line of text
        const mRuledBg = decor.lineColor
            ? `repeating-linear-gradient(to bottom, transparent, transparent ${mLineH - 1}px, ${decor.lineColor} ${mLineH}px)`
            : "transparent";
        const mTextareaBg = decor.lineColor
            ? `${mRuledBg}, ${decor.textareaBg || "#fff"}`
            : (decor.textareaBg || "#fff");

        return (
            // Outer: position:relative, height:auto — grows with content
            <div style={{ position:"relative", width:"100%", minHeight:mSheetH }}>

                {/* Page surface: normal flow — height wraps content */}
                <div style={{ width:"100%", background:decor.containerBg||"#fff", border:decor.containerBorder||"1px solid #e8eaed", borderRadius:4, boxShadow:"0 2px 8px rgba(0,0,0,0.10)", overflow:"hidden" }}>

                    {/* Header band */}
                    {mHdrH > 0 && decor.headerSvg && (
                        <div style={{ position:"relative", height:mHdrH, background:decor.headerBg||"transparent", borderBottom:decor.headerBorderBottom, overflow:"hidden" }}>
                            <SvgOverlay svgFn={decor.headerSvg} height={mHdrH} style={{ top:0 }} />
                        </div>
                    )}

                    {/* Textarea: grows with content, ruled lines aligned to text */}
                    <textarea
                        ref={(el) => {
                            if (textareaRef) { if (typeof textareaRef === "function") textareaRef(el); else textareaRef.current = el; }
                            mobileTextareaRef.current = el;
                            if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
                        }}
                        value={pageData}
                        onChange={(e) => {
                            onChange(pageIndex, e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height = e.target.scrollHeight + "px";
                        }}
                        onFocus={() => onFocus(pageIndex)}
                        placeholder={pageIndex===0?"Start writing…":""}
                        style={{
                            display:    "block",
                            width:      "100%",
                            minHeight:  Math.round((mSheetH - mHdrH - mFtrH) * 0.85),
                            padding:    `${mPadH}px ${mPadW}px`,
                            border:     "none",
                            outline:    "none",
                            resize:     "none",
                            overflow:   "hidden",
                            fontSize:   mFontSize,
                            lineHeight: `${mLineH}px`,
                            fontFamily: fDef.editorFamily,
                            color:      decor.textareaColor||"#202124",
                            // Use scaled gradient so line height matches exactly
                            background:           mTextareaBg,
                            backgroundSize:       `100% ${mLineH}px`,
                            // Offset gradient by top padding so first line aligns under rule
                            backgroundPositionY:  `${mPadH}px`,
                            backgroundAttachment: "local",
                            boxSizing:  "border-box",
                        }}
                    />

                    {/* Footer band */}
                    {mFtrH > 0 && decor.footerSvg && (
                        <div style={{ position:"relative", height:mFtrH+16, background:decor.footerBg||"transparent", borderTop:decor.footerBorderTop, overflow:"hidden" }}>
                            <SvgOverlay svgFn={decor.footerSvg} height={mFtrH} style={{ top:0 }} />
                        </div>
                    )}
                </div>

                {/* Photos: absolutely positioned using scaled coords */}
                {(photos || []).map((photo) => (
                    <PhotoItem key={photo.id} photo={photo} scale={scale}
                               onUpdate={(updated) => onPhotoUpdate(pageIndex, updated)}
                               onDelete={(id)      => onPhotoDelete(pageIndex, id)} />
                ))}
            </div>
        );
    }

    // ── Desktop: fixed A4 proportions with absolute positioning ───────────────
    return (
        <div style={{ position:"relative", width:"100%", height:sheetH }}>
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
            {(photos || []).map((photo) => (
                <PhotoItem key={photo.id} photo={photo}
                           onUpdate={(updated) => onPhotoUpdate(pageIndex, updated)}
                           onDelete={(id) => onPhotoDelete(pageIndex, id)} />
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

function EditorInner({
                         selectedDiary, selectedDate, pages, setPages, currentPage, setCurrentPage,
                         isDirty, setIsDirty, hasEdits, setHasEdits, saving,
                         entryTitle, setEntryTitle, onSave, onOpenTemplatePicker,
                         isMobile = false,
                     }) {
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
        const ro = new ResizeObserver((entries) => {
            const w = entries[0].contentRect.width;
            // padding is 8px each side on mobile (16px total), 16px each side on desktop (32px total)
            const pad = isMobile ? 16 : 32;
            setPageWidth(Math.max(280, w - pad));
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [isMobile]);

    useEffect(() => { scrollRef.current?.scrollTo({ top:0 }); setFocusedPage(0); }, [selectedDiary?.id, selectedDate?.toDateString?.()]); // eslint-disable-line

    const safeIdx       = Math.min(focusedPage, Math.max(0, pages.length - 1));
    const currentTplKey = pages[safeIdx]?.meta?.template || "plain";
    const currentFntKey = pages[safeIdx]?.meta?.font     || "default";
    const currentTpl    = TEMPLATES[currentTplKey] || TEMPLATES.plain;
    const currentFont   = HANDWRITING_FONTS[currentFntKey] || HANDWRITING_FONTS.default;
    const decor         = currentTpl.uiDecor;

    const markEdited = useCallback(() => { setIsDirty(true); setHasEdits(true); }, [setIsDirty, setHasEdits]);

    const insertEmoji = useCallback((emoji) => {
        const ta = textareaRefs.current[focusedPage];
        if (!ta) { setPages((prev) => { const u = prev.map(ensureMeta); u[focusedPage] = { ...u[focusedPage], data:(u[focusedPage].data||"")+emoji }; return u; }); markEdited(); return; }
        const start = ta.selectionStart ?? ta.value.length, end = ta.selectionEnd ?? ta.value.length;
        setPages((prev) => { const u = prev.map(ensureMeta); u[focusedPage] = { ...u[focusedPage], data: ta.value.slice(0,start)+emoji+ta.value.slice(end) }; return u; });
        markEdited();
        requestAnimationFrame(() => { if (textareaRefs.current[focusedPage]) { textareaRefs.current[focusedPage].focus(); textareaRefs.current[focusedPage].setSelectionRange(start+emoji.length, start+emoji.length); } });
    }, [focusedPage, setPages, markEdited]);

    const handlePhotoUpload = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const maxW = Math.min(pageWidth * 0.45, 240), ratio = img.naturalHeight / img.naturalWidth;
                const photo = { id:`photo_${Date.now()}`, src:ev.target.result, x:60, y:100, w:maxW, h:Math.round(maxW*ratio), rotation:0 };
                setPages((prev) => { const u = prev.map(ensureMeta); u[focusedPage] = { ...u[focusedPage], photos:[...(u[focusedPage].photos||[]), photo] }; return u; });
                markEdited();
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file); e.target.value = "";
    };

    const handlePhotoUpdate = useCallback((idx, updated) => {
        setPages((prev) => { const n = prev.map(ensureMeta); n[idx] = { ...n[idx], photos:(n[idx].photos||[]).map((p) => p.id===updated.id?updated:p) }; return n; });
        markEdited();
    }, [setPages, markEdited]);

    const handlePhotoDelete = useCallback((idx, id) => {
        setPages((prev) => { const n = prev.map(ensureMeta); n[idx] = { ...n[idx], photos:(n[idx].photos||[]).filter((p) => p.id!==id) }; return n; });
        markEdited();
    }, [setPages, markEdited]);

    const handlePageChange = useCallback((pageIdx, newText) => {
        const ta = textareaRefs.current[pageIdx];
        const savedStart = ta?.selectionStart ?? newText.length;
        const savedEnd   = ta?.selectionEnd   ?? newText.length;

        const updated = pages.map(ensureMeta);

        // Helper: split text into [keep, overflow] at MAX_LINES_PER_PAGE
        const splitAtLimit = (text, fontKey) => {
            const fontFamily = (HANDWRITING_FONTS[fontKey] || HANDWRITING_FONTS.default).editorFamily;
            if (countWrappedLines(text, fontFamily) <= MAX_LINES_PER_PAGE) return [text, null];
            const ctx = getMCtx();
            const fontSpec = `${CANVAS.lineSpacing * 0.7}px ${fontFamily || "sans-serif"}`;
            ctx.font = fontSpec;
            const rawLines = text.split("\n");
            let usedLines = 0, splitPara = rawLines.length;
            for (let i = 0; i < rawLines.length; i++) {
                const paraLines = wrapWords(ctx, rawLines[i], CANVAS.textWidth, fontSpec).length || 1;
                if (usedLines + paraLines > MAX_LINES_PER_PAGE) { splitPara = i; break; }
                usedLines += paraLines;
            }
            return [rawLines.slice(0, splitPara).join("\n"), rawLines.slice(splitPara).join("\n")];
        };

        // Apply the edit to the current page
        updated[pageIdx] = { ...updated[pageIdx], data: newText };

        // Cascade overflow forward through all subsequent pages
        let idx = pageIdx;
        let currentPageOverflowed = false;
        while (idx < updated.length) {
            const fontKey = updated[idx]?.meta?.font || currentFntKey;
            const [keep, overflow] = splitAtLimit(updated[idx].data || "", fontKey);
            if (overflow === null) break;
            if (idx === pageIdx) currentPageOverflowed = true;
            updated[idx] = { ...updated[idx], data: keep };
            const nextIdx = idx + 1;
            if (nextIdx < updated.length) {
                const existingNext = updated[nextIdx].data || "";
                updated[nextIdx] = {
                    ...updated[nextIdx],
                    data: overflow + (existingNext ? "\n" + existingNext : ""),
                };
            } else {
                updated.push({
                    ...ensureMeta(""),
                    meta: { template: currentTplKey, font: currentFntKey },
                    data: overflow,
                });
            }
            idx++;
        }

        setPages(updated); markEdited();

        // Restore cursor to exactly where the user was typing.
        // If the current page was trimmed, clamp the cursor to the kept text length.
        if (currentPageOverflowed) {
            const keptLen = (updated[pageIdx].data || "").length;
            const clampedPos = Math.min(savedStart, keptLen);
            requestAnimationFrame(() => {
                const t = textareaRefs.current[pageIdx];
                if (t) { t.focus(); t.setSelectionRange(clampedPos, Math.min(savedEnd, keptLen)); }
            });
        }
    }, [pages, currentTplKey, currentFntKey, setPages, markEdited]);

    const handleFontChange = (e) => { setPages((prev) => { const u = prev.map(ensureMeta); u[safeIdx] = { ...u[safeIdx], meta:{ template:currentTplKey, font:e.target.value } }; return u; }); markEdited(); };
    const addPage = () => { setPages((prev) => [...prev.map(ensureMeta), { ...ensureMeta(""), meta:{ template:currentTplKey, font:currentFntKey } }]); markEdited(); setTimeout(() => scrollRef.current?.querySelectorAll("[data-page-sheet]")?.[pages.length]?.scrollIntoView({ behavior:"smooth", block:"start" }), 80); };
    const deletePage = (idx) => { if (pages.length<=1) return; if (!window.confirm("Delete this page?")) return; setPages(pages.filter((_,i)=>i!==idx).map(ensureMeta)); markEdited(); };

    // ── Toolbar: desktop = full labels, mobile = icon-only scrollable row ─────
    const btnBase = { border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", cursor:"pointer", color:decor.textareaColor||"#202124" };

    const toolbarContent = isMobile ? (
        // ── Mobile toolbar: single scrollable icon row ──────────────────────────
        <div style={{ display:"flex", gap:6, overflowX:"auto", alignItems:"center", padding:"6px 10px", scrollbarWidth:"none" }}>
            {/* Title input - full width on own row handled below */}
            {/* Theme */}
            <button style={{ ...btnBase, padding:"6px 8px", fontSize:16, flexShrink:0 }} onClick={onOpenTemplatePicker} title="Theme">{currentTpl.emoji}</button>
            {/* Font */}
            <select value={currentFntKey} onChange={handleFontChange}
                    style={{ ...btnBase, padding:"5px 6px", fontSize:12, maxWidth:100, flexShrink:0, fontFamily:currentFont.editorFamily, outline:"none" }}>
                {FONT_KEYS.map((key) => { const f=HANDWRITING_FONTS[key]; return <option key={key} value={key}>{f.emoji} {f.label}</option>; })}
            </select>
            {/* Emoji */}
            <button ref={emojiAnchorRef} style={{ ...btnBase, padding:"6px 8px", fontSize:18, flexShrink:0, background:showEmoji?(decor.btnBg||"#1a73e8"):"rgba(255,255,255,0.25)", color:showEmoji?(decor.btnColor||"#fff"):"inherit" }}
                    onClick={() => setShowEmoji((v)=>!v)} title="Emoji">😊</button>
            {/* Photo */}
            <button style={{ ...btnBase, padding:"6px 8px", fontSize:18, flexShrink:0 }} onClick={() => photoInputRef.current?.click()} title="Add photo">📷</button>
            {/* Add page */}
            <button style={{ ...btnBase, padding:"6px 8px", fontSize:12, flexShrink:0 }} onClick={addPage} title="Add page">+ Pg</button>
            {/* Preview */}
            <button style={{ ...btnBase, padding:"6px 8px", fontSize:16, flexShrink:0 }} onClick={() => setShowPreview(true)} title="Preview">👁</button>
            {/* Save */}
            <button style={{ ...btnBase, padding:"6px 10px", background:decor.btnBg||"#1a73e8", color:decor.btnColor||"#fff", fontSize:12, fontWeight:600, flexShrink:0, border:"none", opacity:saving?0.7:1 }}
                    onClick={onSave} disabled={saving}>
                {saving ? "…" : isDirty ? "Save" : "✓"}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhotoUpload} />
        </div>
    ) : (
        // ── Desktop toolbar: full labels ────────────────────────────────────────
        <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
            <button style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 9px", ...btnBase, fontSize:12, whiteSpace:"nowrap" }} onClick={onOpenTemplatePicker}>
                <span style={{ fontSize:14 }}>{currentTpl.emoji}</span><span>{currentTpl.label}</span><span style={{ fontSize:10, opacity:0.6 }}>▾</span>
            </button>
            <div style={{ display:"flex", alignItems:"center", border:"1px solid rgba(255,255,255,0.4)", borderRadius:6, background:"rgba(255,255,255,0.25)", padding:"0 6px 0 8px", gap:3, height:30 }}>
                <span style={{ fontSize:13, color:decor.textareaColor||"#202124", flexShrink:0 }}>✍</span>
                <select value={currentFntKey} onChange={handleFontChange} style={{ border:"none", outline:"none", background:"transparent", fontSize:12, color:decor.textareaColor||"#202124", cursor:"pointer", maxWidth:120, fontFamily:currentFont.editorFamily }}>
                    {FONT_KEYS.map((key) => { const f=HANDWRITING_FONTS[key]; return <option key={key} value={key} style={{ fontFamily:f.editorFamily }}>{f.emoji}  {f.label}</option>; })}
                </select>
            </div>
            <button ref={emojiAnchorRef} style={{ padding:"5px 10px", ...btnBase, fontSize:18, background:showEmoji?(decor.btnBg||"#1a73e8"):"rgba(255,255,255,0.25)", color:showEmoji?(decor.btnColor||"#fff"):"inherit", lineHeight:1 }}
                    onClick={() => setShowEmoji((v)=>!v)}>😊</button>
            <button style={{ padding:"5px 10px", ...btnBase, fontSize:18, lineHeight:1 }} onClick={() => photoInputRef.current?.click()} title={`Add photo to page ${focusedPage+1}`}>📷</button>
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhotoUpload} />
            <button style={{ padding:"5px 9px", ...btnBase, fontSize:12 }} onClick={addPage}>+ Page</button>
            <button style={{ padding:"5px 9px", ...btnBase, fontSize:12 }} onClick={() => setShowPreview(true)}>👁 Preview</button>
            <button style={{ ...shared.btnPrimary, background:decor.btnBg||"#1a73e8", color:decor.btnColor||"#fff", opacity:saving?0.7:1, fontSize:12, padding:"5px 12px" }} onClick={onSave} disabled={saving}>
                {saving ? <><span style={shared.spinner} />Saving…</> : isDirty ? "Save" : "✓ Saved"}
            </button>
        </div>
    );

    return (
        <>
            <main style={{ flex:1, display:"flex", overflow:"hidden", background:"#e8eaed" }}>
                <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

                    {/* Toolbar */}
                    <div style={{ background:decor.headerBg||"#fff", borderBottom:decor.headerBorderBottom||"1px solid #e8eaed", flexShrink:0, zIndex:10, position:"relative", paddingBottom:decor.headerSvgH||0 }}>

                        {/* Entry info row: diary name + date + title */}
                        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", padding: isMobile ? "8px 10px 4px" : "10px 16px", gap:10 }}>
                            <div style={{ display:"flex", flexDirection:"column", gap:3, minWidth:0, flex:1 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                                    <span style={{ fontSize:14 }}>{selectedDiary.emoji||"📔"}</span>
                                    <span style={{ fontSize:13, fontWeight:700, color:decor.textareaColor||"#202124", opacity:0.85 }}>{selectedDiary.name||"Diary"}</span>
                                    {isDirty && <span style={{ width:6, height:6, borderRadius:"50%", background:"#fbbc04", display:"inline-block", flexShrink:0 }} />}
                                </div>
                                {!isMobile && (
                                    <span style={{ fontSize:11, color:decor.textareaColor||"#9aa0a6", opacity:0.55 }}>
                    {selectedDate.toLocaleDateString("default", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
                  </span>
                                )}
                                <input type="text" value={entryTitle} onChange={(e) => { setEntryTitle(e.target.value); markEdited(); }} placeholder="Entry title…"
                                       style={{ fontSize: isMobile ? 13 : 14, fontWeight:600, color:decor.textareaColor||"#202124", background:"transparent", border:"none", borderBottom:`1.5px solid ${decor.textareaColor||"#202124"}33`, outline:"none", padding:"2px 0", width:"100%", maxWidth:300, fontFamily:"inherit", cursor:"text" }}
                                       onFocus={(e) => e.target.style.borderBottomColor=decor.btnBg||"#1a73e8"}
                                       onBlur={(e)  => e.target.style.borderBottomColor=`${decor.textareaColor||"#202124"}33`} />
                            </div>
                            {/* Desktop toolbar buttons inline */}
                            {!isMobile && toolbarContent}
                        </div>

                        {/* Mobile toolbar — separate row below title */}
                        {isMobile && toolbarContent}

                        <SvgOverlay svgFn={decor.headerSvg} height={decor.headerSvgH} style={{ bottom:0 }} />
                    </div>

                    {/* Page stack — scrollable, fills full width */}
                    <div ref={(el) => { scrollRef.current = el; containerRef.current = el; }}
                         style={{ flex:1, overflowY:"auto", padding: isMobile ? "8px" : "16px", display:"flex", flexDirection:"column", gap:PAGE_GAP }}>
                        {pages.map((page, idx) => {
                            const pg = ensureMeta(page);
                            return (
                                <div key={idx} data-page-sheet={idx} style={{ width:"100%" }}>
                                    <PageSheet
                                        pageIndex={idx} totalPages={pages.length}
                                        pageData={pg.data} template={pg.meta.template} font={pg.meta.font}
                                        photos={pg.photos||[]}
                                        pageWidth={pageWidth}
                                        textareaRef={(el) => { textareaRefs.current[idx] = el; }}
                                        onChange={handlePageChange}
                                        onFocus={(i) => { setFocusedPage(i); setCurrentPage(i); }}
                                        onPhotoUpdate={handlePhotoUpdate}
                                        onPhotoDelete={handlePhotoDelete}
                                        isMobile={isMobile}
                                    />
                                    {pages.length > 1 && (
                                        <div style={{ textAlign:"right", marginTop:4 }}>
                                            <button style={{ fontSize:11, color:"#d93025", border:"none", background:"transparent", cursor:"pointer", padding:"2px 4px", opacity:0.7 }} onClick={() => deletePage(idx)}>✕ Delete page {idx+1}</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <button onClick={addPage} style={{ marginTop:4, padding:"10px 28px", border:"2px dashed #bbb", borderRadius:8, background:"rgba(255,255,255,0.6)", color:"#666", cursor:"pointer", fontSize:13, fontWeight:500, width:"100%" }}>+ Add page</button>
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