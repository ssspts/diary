// src/components/PdfPreview.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import jsPDF from "jspdf";
import { TEMPLATES, HANDWRITING_FONTS, loadFontIntoDoc } from "../utils/templates";
import { STICKER_CATEGORIES, STICKER_MAP } from "../utils/stickers";
import ShareDialog from "./ShareDialog";

const CANVAS_W = 595;
const CANVAS_H = 842;
const MM_TO_PX  = CANVAS_W / 210;

const _imgCache = {};
function loadImg(src) {
  if (_imgCache[src]) return Promise.resolve(_imgCache[src]);
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload  = () => { _imgCache[src] = img; res(img); };
    img.onerror = rej;
    img.src = src;
  });
}

// Draw an SVG string onto a canvas at a given y offset using a temporary Image
async function drawSvgOnCanvas(ctx, svgFn, canvasW, y, h) {
  if (!svgFn || !h) return;
  const svgString = svgFn(canvasW).replace(/width="\d+"/, `width="${canvasW}"`);
  const blob  = new Blob([svgString], { type: "image/svg+xml" });
  const url   = URL.createObjectURL(blob);
  await new Promise((res, rej) => {
    const img = new Image();
    img.onload  = () => { ctx.drawImage(img, 0, y, canvasW, h); URL.revokeObjectURL(url); res(); };
    img.onerror = () => { URL.revokeObjectURL(url); res(); }; // silently skip on error
    img.src = url;
  });
}

async function renderPageToCanvas(page, selectedFile, pageIndex, totalPages) {
  const canvas  = document.createElement("canvas");
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");

  const rawText = typeof page === "string" ? page : (page?.data ?? "");
  const tplKey  = page?.meta?.template || "plain";
  const tpl     = TEMPLATES[tplKey] || TEMPLATES.plain;
  const layout  = tpl.layout;
  const decor   = tpl.uiDecor;

  // ── 1. Main background ────────────────────────────────────────────────────
  const bgStyle = decor?.containerBg || tpl.editorStyle?.background || "#fff";
  const solidMatch = bgStyle.match(/#[0-9a-f]{3,6}/i);
  ctx.fillStyle = (bgStyle.startsWith("#") || bgStyle.startsWith("rgb")) ? bgStyle : (solidMatch ? solidMatch[0] : "#fff");
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // ── 2. Header SVG band ────────────────────────────────────────────────────
  const hH = (decor?.headerSvgH || 0) + 56; // header band total height (controls + svg)
  if (decor?.headerSvg && decor.headerSvgH) {
    // Header background
    const hbg = decor.headerBg || tpl.pdfTitleColor;
    const hMatch = hbg.match(/#[0-9a-f]{3,6}/i);
    ctx.fillStyle = hMatch ? hMatch[0] : "#eee";
    ctx.fillRect(0, 0, CANVAS_W, hH);
    // Header SVG decoration
    await drawSvgOnCanvas(ctx, decor.headerSvg, CANVAS_W, hH - decor.headerSvgH, decor.headerSvgH);
    // Header border line
    ctx.strokeStyle = tpl.pdfTitleColor; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, hH); ctx.lineTo(CANVAS_W, hH); ctx.stroke();
  }

  // ── 3. Footer SVG band ────────────────────────────────────────────────────
  const fH = (decor?.footerSvgH || 0) + 40;
  if (decor?.footerSvg && decor.footerSvgH) {
    const fbg = decor.footerBg || tpl.pdfTitleColor;
    const fMatch = fbg.match(/#[0-9a-f]{3,6}/i);
    ctx.fillStyle = fMatch ? fMatch[0] : "#eee";
    ctx.fillRect(0, CANVAS_H - fH, CANVAS_W, fH);
    await drawSvgOnCanvas(ctx, decor.footerSvg, CANVAS_W, CANVAS_H - fH, decor.footerSvgH);
    ctx.strokeStyle = tpl.pdfTitleColor; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, CANVAS_H - fH); ctx.lineTo(CANVAS_W, CANVAS_H - fH); ctx.stroke();
  }

  // ── 4. Corner SVGs ────────────────────────────────────────────────────────
  if (decor?.cornerSvg && decor.cornerSize) {
    const sz = decor.cornerSize * 1.6; // scale up for canvas resolution
    const corners = [
      { x:0,          y:hH,            rot:0   },
      { x:CANVAS_W-sz,y:hH,            rot:90  },
      { x:0,          y:CANVAS_H-fH-sz,rot:270 },
      { x:CANVAS_W-sz,y:CANVAS_H-fH-sz,rot:180 },
    ];
    for (const c of corners) {
      ctx.save();
      ctx.translate(c.x + sz/2, c.y + sz/2);
      ctx.rotate((c.rot * Math.PI) / 180);
      ctx.translate(-sz/2, -sz/2);
      await drawSvgOnCanvas(ctx, decor.cornerSvg.bind(null, sz), sz, 0, sz);
      ctx.restore();
    }
  }

  // ── 5. Ruled lines ────────────────────────────────────────────────────────
  const lm  = layout.leftMargin * MM_TO_PX;
  const rm  = layout.rightMargin * MM_TO_PX;
  const ls  = layout.lineSpacing * MM_TO_PX;
  const ly0 = hH + 28; // first line y — below header
  ctx.strokeStyle = (decor?.lineColor || tpl.pdfTitleColor) + "66";
  ctx.lineWidth   = 0.8;
  for (let y = ly0; y < CANVAS_H - fH - 10; y += ls) {
    ctx.beginPath(); ctx.moveTo(lm, y); ctx.lineTo(CANVAS_W - rm, y); ctx.stroke();
  }

  // ── 6. Title ──────────────────────────────────────────────────────────────
  ctx.fillStyle = decor?.textareaColor || tpl.pdfTextColor || "#202124";
  ctx.font      = "bold 20px -apple-system, sans-serif";
  ctx.fillText(selectedFile?.name || "Diary Entry", lm, hH - 36);

  // ── 7. Date + page number ─────────────────────────────────────────────────
  ctx.font        = "13px -apple-system, sans-serif";
  ctx.globalAlpha = 0.65;
  ctx.fillText(new Date(selectedFile?.createdAt).toDateString(), lm, hH - 18);
  ctx.textAlign   = "right";
  ctx.fillText(`Page ${pageIndex + 1} of ${totalPages}`, CANVAS_W - rm, hH - 18);
  ctx.textAlign   = "left";
  ctx.globalAlpha = 1;

  // ── 8. Body text ──────────────────────────────────────────────────────────
  ctx.fillStyle = decor?.textareaColor || tpl.pdfTextColor || "#202124";
  ctx.font      = "15px -apple-system, sans-serif";
  const charW  = 8;
  const maxChr = Math.floor((CANVAS_W - lm - rm) / charW);
  const lines  = rawText.split("\n").flatMap((ln) => {
    if (!ln) return [""];
    const chunks = [];
    for (let i = 0; i < ln.length; i += maxChr) chunks.push(ln.slice(i, i + maxChr));
    return chunks;
  });
  lines.forEach((line, i) => { ctx.fillText(line, lm, ly0 + i * ls); });

  return canvas;
}

// Flatten overlays onto a canvas and return dataURL
async function flattenPageCanvas(baseCanvas, pageOverlays) {
  const out = document.createElement("canvas");
  out.width = CANVAS_W; out.height = CANVAS_H;
  const ctx = out.getContext("2d");
  ctx.drawImage(baseCanvas, 0, 0);
  for (const ov of pageOverlays) {
    try {
      const imgEl = await loadImg(ov.src);
      ctx.save();
      ctx.translate(ov.x + ov.size / 2, ov.y + ov.size / 2);
      if (ov.rotation) ctx.rotate((ov.rotation * Math.PI) / 180);
      ctx.drawImage(imgEl, -ov.size / 2, -ov.size / 2, ov.size, ov.size);
      ctx.restore();
    } catch {}
  }
  return out;
}

export default function PdfPreview({ selectedFile, pages, onClose }) {
  const [baseCanvases, setBaseCanvases] = useState([]);  // raw page canvases (no overlays)
  const [previewImgs, setPreviewImgs]   = useState([]);  // dataURLs with overlays composited
  const [rendering, setRendering]       = useState(true);
  const [previewPage, setPreviewPage]   = useState(0);
  const [overlays, setOverlays]         = useState(() => pages.map(() => []));
  const [activeTab, setActiveTab]       = useState("stickers");
  const [activeCat, setActiveCat]       = useState(0);
  const [downloading, setDownloading]   = useState(false);
  const [dlFormat, setDlFormat]         = useState(null);     // "pdf" | "image" | null
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [dragState, setDragState]       = useState(null);
  const [resizeState, setResizeState]   = useState(null);
  const [hoveredId, setHoveredId]       = useState(null);
  const pageRef   = useRef(null);
  const fileInputRef = useRef(null);

  // Render base canvases on mount
  useEffect(() => {
    (async () => {
      setRendering(true);
      const canvases = [];
      for (let i = 0; i < pages.length; i++)
        canvases.push(await renderPageToCanvas(pages[i], selectedFile, i, pages.length));
      setBaseCanvases(canvases);
      setRendering(false);
    })();
  }, []); // eslint-disable-line

  // Re-composite preview image whenever base canvas or overlays change
  useEffect(() => {
    if (!baseCanvases.length) return;
    (async () => {
      const imgs = [];
      for (let i = 0; i < baseCanvases.length; i++) {
        const out = await flattenPageCanvas(baseCanvases[i], overlays[i] || []);
        imgs.push(out.toDataURL("image/png"));
      }
      setPreviewImgs(imgs);
    })();
  }, [baseCanvases, overlays]);

  // ── Overlay helpers ───────────────────────────────────────────────────────
  const addOverlay = (o) =>
    setOverlays((prev) => prev.map((arr, i) => i === previewPage ? [...arr, o] : arr));

  const updateOverlay = useCallback((id, patch) =>
    setOverlays((prev) =>
      prev.map((arr, i) =>
        i === previewPage ? arr.map((o) => o.id === id ? { ...o, ...patch } : o) : arr
      )
    ), [previewPage]);

  const removeOverlay = (id) =>
    setOverlays((prev) => prev.map((arr, i) => i === previewPage ? arr.filter((o) => o.id !== id) : arr));

  const addSticker = (s) =>
    addOverlay({ id: `s-${Date.now()}`, type: "sticker", src: s.url, alt: s.alt, x: 80, y: 80, size: 60, rotation: 0 });

  const addUserImage = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => addOverlay({ id: `img-${Date.now()}`, type: "image", src: e.target.result, x: 60, y: 120, size: 120, rotation: 0 });
    reader.readAsDataURL(file);
  };

  // ── Drag ─────────────────────────────────────────────────────────────────
  const onPointerDownOverlay = useCallback((e, ov) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragState({ id: ov.id, startX: e.clientX, startY: e.clientY, origX: ov.x, origY: ov.y });
  }, []);

  const onPointerMoveOverlay = useCallback((e) => {
    if (!dragState) return;
    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = CANVAS_W / rect.width;
    updateOverlay(dragState.id, {
      x: dragState.origX + (e.clientX - dragState.startX) * scale,
      y: dragState.origY + (e.clientY - dragState.startY) * scale,
    });
  }, [dragState, updateOverlay]);

  // ── Resize ────────────────────────────────────────────────────────────────
  const onPointerDownResize = useCallback((e, ov) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizeState({ id: ov.id, startX: e.clientX, origSize: ov.size });
  }, []);

  const onPointerMoveResize = useCallback((e) => {
    if (!resizeState) return;
    const rect = pageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = CANVAS_W / rect.width;
    updateOverlay(resizeState.id, { size: Math.max(24, resizeState.origSize + (e.clientX - resizeState.startX) * scale) });
  }, [resizeState, updateOverlay]);

  // ── Download PDF ─────────────────────────────────────────────────────────
  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const pdfdoc = new jsPDF({ unit: "mm", format: "a4" });
      const pw = pdfdoc.internal.pageSize.getWidth();
      const ph = pdfdoc.internal.pageSize.getHeight();

      for (let index = 0; index < pages.length; index++) {
        const page = pages[index];
        if (index !== 0) pdfdoc.addPage();
        const rawText = typeof page === "string" ? page : (page?.data ?? "");
        const tplKey  = page?.meta?.template || "plain";
        const fontKey = page?.meta?.font     || "default";
        const tpl     = TEMPLATES[tplKey] || TEMPLATES.plain;
        const fontDef = HANDWRITING_FONTS[fontKey] || HANDWRITING_FONTS.default;
        const layout  = tpl.layout;

        tpl.pdfDrawBackground(pdfdoc, pw, ph, layout);

        let fontLoaded = false;
        if (fontDef.ttfUrl) { try { fontLoaded = await loadFontIntoDoc(pdfdoc, fontKey); } catch {} }
        const bodyFont = fontLoaded ? fontDef.pdfFont : "helvetica";

        pdfdoc.setFontSize(14); pdfdoc.setTextColor(tpl.pdfTitleColor);
        pdfdoc.setFont("helvetica", "bold");
        pdfdoc.text(selectedFile.name || "Diary Entry", layout.leftMargin, 18);

        pdfdoc.setFont("helvetica", "normal"); pdfdoc.setFontSize(8);
        pdfdoc.setTextColor(tpl.pdfTextColor);
        pdfdoc.setGState(new pdfdoc.GState({ opacity: 0.55 }));
        pdfdoc.text(new Date(selectedFile.createdAt).toDateString(), layout.leftMargin, 26);
        pdfdoc.text(`Page ${index + 1} of ${pages.length}`, pw - layout.rightMargin, 26, { align: "right" });
        pdfdoc.setGState(new pdfdoc.GState({ opacity: 1 }));

        pdfdoc.setDrawColor(tpl.pdfTitleColor); pdfdoc.setLineWidth(0.4);
        pdfdoc.line(layout.leftMargin, 30, pw - layout.rightMargin, 30);

        pdfdoc.setFont(bodyFont, "normal"); pdfdoc.setFontSize(layout.fontSize);
        pdfdoc.setTextColor(tpl.pdfTextColor);
        const textWidth = pw - layout.leftMargin - layout.rightMargin;
        const allLines  = pdfdoc.splitTextToSize(rawText || "", textWidth);
        const maxLines  = Math.floor((ph - layout.firstLineY - 14) / layout.lineSpacing);
        allLines.slice(0, maxLines).forEach((line, i) => {
          pdfdoc.text(line, layout.leftMargin, layout.firstLineY + i * layout.lineSpacing);
        });

        // Overlays
        for (const ov of (overlays[index] || [])) {
          try {
            const imgEl  = await loadImg(ov.src);
            const c = document.createElement("canvas");
            c.width = c.height = Math.round(ov.size);
            const cx = c.getContext("2d");
            if (ov.rotation) {
              cx.translate(ov.size / 2, ov.size / 2);
              cx.rotate((ov.rotation * Math.PI) / 180);
              cx.drawImage(imgEl, -ov.size / 2, -ov.size / 2, ov.size, ov.size);
            } else {
              cx.drawImage(imgEl, 0, 0, ov.size, ov.size);
            }
            pdfdoc.addImage(c.toDataURL("image/png"), "PNG", ov.x / MM_TO_PX, ov.y / MM_TO_PX, ov.size / MM_TO_PX, ov.size / MM_TO_PX);
          } catch {}
        }
      }
      const safeName = (selectedFile.name || "diary").replace(/[^a-z0-9_-]/gi, "_");
      pdfdoc.save(`${safeName}.pdf`);
    } finally { setDownloading(false); setDlFormat(null); }
  };

  // ── Download Image (all pages stacked as a single tall PNG) ──────────────
  const downloadImage = async () => {
    setDownloading(true);
    try {
      // Composite each page with its overlays, then stack vertically
      const flatCanvases = [];
      for (let i = 0; i < baseCanvases.length; i++)
        flatCanvases.push(await flattenPageCanvas(baseCanvases[i], overlays[i] || []));

      const combined = document.createElement("canvas");
      combined.width  = CANVAS_W;
      combined.height = CANVAS_H * flatCanvases.length;
      const ctx = combined.getContext("2d");
      flatCanvases.forEach((c, i) => ctx.drawImage(c, 0, i * CANVAS_H));

      const a = document.createElement("a");
      a.href     = combined.toDataURL("image/png");
      a.download = `${(selectedFile.name || "diary").replace(/[^a-z0-9_-]/gi, "_")}.png`;
      a.click();
    } finally { setDownloading(false); setDlFormat(null); }
  };

  const curOverlays = overlays[previewPage] || [];
  const pageImg     = previewImgs[previewPage];
  const firstPageText = typeof pages[0] === "string" ? pages[0] : (pages[0]?.data ?? "");

  return (
    <div
      style={st.backdrop}
      onPointerMove={(e) => { onPointerMoveOverlay(e); onPointerMoveResize(e); }}
      onPointerUp={() => { setDragState(null); setResizeState(null); }}
    >
      <div style={st.modal}>

        {/* ── Header ── */}
        <div style={st.header}>
          <span style={st.headerTitle}>Preview & Export</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

            {/* Share button */}
            <button style={st.btnShare} onClick={() => setShowShareDialog(true)}>
              ↗ Share
            </button>

            {/* Download dropdown */}
            <div style={{ position: "relative" }}>
              <button
                style={{ ...st.btnPrimary, opacity: downloading ? 0.7 : 1 }}
                onClick={() => setDlFormat((v) => v ? null : "menu")}
                disabled={downloading}
              >
                {downloading ? "⏳ Saving…" : "⬇ Download ▾"}
              </button>
              {dlFormat === "menu" && (
                <div style={st.dlMenu}>
                  <button style={st.dlItem} onClick={() => { setDlFormat(null); downloadPdf(); }}>
                    📄 Download as PDF
                  </button>
                  <button style={st.dlItem} onClick={() => { setDlFormat(null); downloadImage(); }}>
                    🖼 Download as Image (PNG)
                  </button>
                </div>
              )}
            </div>

            <button style={st.btnClose} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={st.body}>

          {/* ── Left: page preview ── */}
          <div style={st.previewPanel}>
            <div style={st.pageWrapper}>
              {rendering ? (
                <div style={st.loadingBox}>Rendering preview…</div>
              ) : (
                <div ref={pageRef} style={{ position: "relative", display: "inline-block", lineHeight: 0, maxWidth: "100%" }}>
                  <img src={pageImg} alt="page" style={{ width: "100%", borderRadius: 4, display: "block", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }} draggable={false} />

                  {curOverlays.map((ov) => {
                    const rect  = pageRef.current?.getBoundingClientRect() || { width: CANVAS_W };
                    const scale = rect.width / CANVAS_W;
                    const isHov = hoveredId === ov.id;
                    return (
                      <div key={ov.id}
                        style={{ position: "absolute", left: ov.x * scale, top: ov.y * scale, width: ov.size * scale, height: ov.size * scale, cursor: "move", transform: ov.rotation ? `rotate(${ov.rotation}deg)` : undefined, userSelect: "none" }}
                        onPointerDown={(e) => onPointerDownOverlay(e, ov)}
                        onPointerEnter={() => setHoveredId(ov.id)}
                        onPointerLeave={() => setHoveredId(null)}
                      >
                        <img src={ov.src} alt={ov.alt || ""} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} draggable={false} crossOrigin="anonymous" />
                        {isHov && <button style={st.deleteBtn} onPointerDown={(e) => e.stopPropagation()} onClick={() => removeOverlay(ov.id)}>×</button>}
                        {isHov && <div style={st.resizeHandle} onPointerDown={(e) => onPointerDownResize(e, ov)} />}
                        {isHov && (
                          <div style={st.rotRow}>
                            <button style={st.rotBtn} onPointerDown={(e) => e.stopPropagation()} onClick={() => updateOverlay(ov.id, { rotation: ((ov.rotation || 0) - 15 + 360) % 360 })}>↺</button>
                            <button style={st.rotBtn} onPointerDown={(e) => e.stopPropagation()} onClick={() => updateOverlay(ov.id, { rotation: ((ov.rotation || 0) + 15) % 360 })}>↻</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={st.pageNav}>
              <button style={st.navBtn} disabled={previewPage === 0} onClick={() => setPreviewPage((p) => p - 1)}>← Prev</button>
              <span style={{ fontSize: 12, color: "#5f6368" }}>Page {previewPage + 1} / {pages.length}</span>
              <button style={st.navBtn} disabled={previewPage >= pages.length - 1} onClick={() => setPreviewPage((p) => p + 1)}>Next →</button>
            </div>
          </div>

          {/* ── Right: decorate panel ── */}
          <div style={st.sidePanel}>
            <div style={st.tabRow}>
              <button style={{ ...st.tab, ...(activeTab === "stickers" ? st.tabActive : {}) }} onClick={() => setActiveTab("stickers")}>🎨 Stickers</button>
              <button style={{ ...st.tab, ...(activeTab === "image" ? st.tabActive : {}) }} onClick={() => setActiveTab("image")}>📷 My Photo</button>
            </div>

            {activeTab === "stickers" && (
              <div style={st.stickerPanel}>
                <div style={st.catRow}>
                  {STICKER_CATEGORIES.map((cat, i) => (
                    <button key={i} style={{ ...st.catBtn, ...(activeCat === i ? st.catBtnActive : {}) }} onClick={() => setActiveCat(i)}>{cat.label}</button>
                  ))}
                </div>
                <div style={st.stickerGrid}>
                  {STICKER_CATEGORIES[activeCat].stickers.map((s) => (
                    <button key={s.id} style={st.stickerBtn} title={s.alt} onClick={() => addSticker(s)}>
                      <img src={s.url} alt={s.alt} style={{ width: 40, height: 40, objectFit: "contain" }} crossOrigin="anonymous" />
                    </button>
                  ))}
                </div>
                <p style={st.hint}>Click a sticker to place it. Drag, resize, rotate, or delete on hover.</p>
              </div>
            )}

            {activeTab === "image" && (
              <div style={st.imagePanel}>
                <div style={st.dropZone} onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) addUserImage(f); }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                  <div style={{ fontSize: 13, color: "#5f6368" }}>Click or drag & drop an image</div>
                  <div style={{ fontSize: 11, color: "#9aa0a6", marginTop: 4 }}>PNG · JPG · GIF · WebP</div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => { if (e.target.files[0]) addUserImage(e.target.files[0]); }} />
                <p style={st.hint}>Your photo is added to the current page and embedded in exports.</p>
              </div>
            )}

            {curOverlays.length > 0 && (
              <div style={st.overlayList}>
                <div style={st.overlayListTitle}>On this page ({curOverlays.length})</div>
                {curOverlays.map((ov, i) => (
                  <div key={ov.id} style={st.overlayListRow}>
                    <img src={ov.src} alt="" style={{ width: 24, height: 24, objectFit: "contain" }} crossOrigin="anonymous" />
                    <span style={{ fontSize: 12, flex: 1, color: "#3c4043" }}>{ov.type === "sticker" ? ov.alt || "Sticker" : "Photo"} #{i + 1}</span>
                    <button style={st.removeListBtn} onClick={() => removeOverlay(ov.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share dialog */}
      {showShareDialog && (
        <ShareDialog
          title={selectedFile?.name || "Diary Entry"}
          text={firstPageText}
          imageUrl={previewImgs[0]}
          onClose={() => setShowShareDialog(false)}
        />
      )}
    </div>
  );
}

const st = {
  backdrop:     { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 600, display: "flex", alignItems: "stretch", justifyContent: "center" },
  modal:        { background: "#fff", width: "100%", maxWidth: 1100, margin: "20px auto", borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,0.25)" },
  header:       { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #e8eaed", flexShrink: 0 },
  headerTitle:  { fontSize: 16, fontWeight: 700, color: "#202124" },
  btnPrimary:   { padding: "8px 16px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 500 },
  btnShare:     { padding: "7px 14px", background: "#fff", color: "#1a73e8", border: "1px solid #c5d8fb", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 500 },
  btnClose:     { width: 32, height: 32, border: "none", background: "#f1f3f4", borderRadius: "50%", cursor: "pointer", fontSize: 16, color: "#5f6368", display: "flex", alignItems: "center", justifyContent: "center" },
  dlMenu:       { position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: 210, zIndex: 10, overflow: "hidden" },
  dlItem:       { display: "block", width: "100%", padding: "11px 16px", border: "none", background: "transparent", textAlign: "left", fontSize: 13, cursor: "pointer", color: "#202124" },
  body:         { display: "flex", flex: 1, overflow: "hidden" },
  previewPanel: { flex: 1, display: "flex", flexDirection: "column", background: "#f8f9fa", overflow: "hidden", padding: 20, gap: 12 },
  pageWrapper:  { flex: 1, overflow: "auto", display: "flex", justifyContent: "center", alignItems: "flex-start" },
  loadingBox:   { display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#80868b", fontSize: 14 },
  pageNav:      { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexShrink: 0 },
  navBtn:       { padding: "5px 12px", border: "1px solid #dadce0", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#3c4043" },
  sidePanel:    { width: 280, borderLeft: "1px solid #e8eaed", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 },
  tabRow:       { display: "flex", borderBottom: "1px solid #e8eaed", flexShrink: 0 },
  tab:          { flex: 1, padding: "11px 6px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "#5f6368", borderBottom: "2px solid transparent" },
  tabActive:    { color: "#1a73e8", borderBottomColor: "#1a73e8", fontWeight: 500 },
  stickerPanel: { flex: 1, overflow: "auto", display: "flex", flexDirection: "column" },
  catRow:       { display: "flex", flexWrap: "wrap", gap: 4, padding: "10px 10px 6px", flexShrink: 0 },
  catBtn:       { padding: "3px 8px", border: "1px solid #e0e0e0", borderRadius: 12, background: "#fff", fontSize: 11, cursor: "pointer", color: "#5f6368" },
  catBtnActive: { background: "#e8f0fe", borderColor: "#c5d8fb", color: "#1a73e8", fontWeight: 500 },
  stickerGrid:  { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, padding: "4px 10px 8px" },
  stickerBtn:   { border: "1px solid #f1f3f4", background: "#fafafa", borderRadius: 8, padding: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  hint:         { fontSize: 11, color: "#9aa0a6", padding: "6px 10px 10px", margin: 0, lineHeight: 1.5 },
  imagePanel:   { flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 },
  dropZone:     { border: "2px dashed #dadce0", borderRadius: 10, padding: "28px 16px", textAlign: "center", cursor: "pointer", background: "#fafafa" },
  deleteBtn:    { position: "absolute", top: -8, right: -8, width: 18, height: 18, borderRadius: "50%", background: "#d93025", color: "#fff", border: "none", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 },
  resizeHandle: { position: "absolute", bottom: -6, right: -6, width: 14, height: 14, background: "#1a73e8", borderRadius: "50%", cursor: "se-resize", border: "2px solid #fff" },
  rotRow:       { position: "absolute", bottom: -22, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2 },
  rotBtn:       { width: 20, height: 20, fontSize: 12, border: "1px solid #ddd", background: "#fff", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
  overlayList:      { borderTop: "1px solid #f1f3f4", padding: "8px 10px", flexShrink: 0 },
  overlayListTitle: { fontSize: 11, fontWeight: 600, color: "#80868b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" },
  overlayListRow:   { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  removeListBtn:    { border: "none", background: "transparent", color: "#d93025", cursor: "pointer", fontSize: 13, padding: "2px 4px" },
};
