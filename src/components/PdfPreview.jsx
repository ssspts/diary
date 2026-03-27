// src/components/PdfPreview.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Full-screen PDF preview with editable sticker / image overlays.
//
// Architecture:
//   • Each page is rendered onto an off-screen <canvas> using the same jsPDF
//     drawing logic, then displayed as an <img> (dataURL).
//   • On top of the page image we render absolutely-positioned sticker/image
//     overlays stored in `overlays[pageIndex]` — an array of overlay objects:
//       { id, type:"sticker"|"image", src, x, y, size, rotation }
//   • Overlays are draggable (pointer events), resizable (corner handle),
//     and deletable (× button on hover).
//   • When the user clicks Download, we flatten overlays onto each PDF page
//     via jsPDF's addImage before saving.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import jsPDF from "jspdf";
import { TEMPLATES, HANDWRITING_FONTS, loadFontIntoDoc, ensureMeta } from "../utils/templates";
import { STICKER_CATEGORIES, STICKER_MAP } from "../utils/stickers";

// ── A4 canvas render dimensions (px) ─────────────────────────────────────────
const CANVAS_W = 595;   // 210mm @ 72dpi
const CANVAS_H = 842;   // 297mm @ 72dpi
const MM_TO_PX = CANVAS_W / 210;

// Pre-cache images to avoid flicker
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

// Render one page to an offscreen canvas and return its dataURL
async function renderPageToCanvas(page, selectedFile, pageIndex, totalPages) {
  const canvas  = document.createElement("canvas");
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");

  const rawText = typeof page === "string" ? page : (page?.data ?? "");
  const tplKey  = page?.meta?.template || "plain";
  const tpl     = TEMPLATES[tplKey] || TEMPLATES.plain;
  const layout  = tpl.layout;

  // ── Background colour ──────────────────────────────────────────────────────
  // We draw the CSS gradient/color as a rect on canvas (approximate)
  const bgStyle = tpl.editorStyle?.background || "#fff";
  // Parse simple solid colours
  if (bgStyle.startsWith("#") || bgStyle.startsWith("rgb")) {
    ctx.fillStyle = bgStyle;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else {
    // Gradient — approximate with first colour stop
    const match = bgStyle.match(/#[0-9a-f]{3,6}/i);
    ctx.fillStyle = match ? match[0] : "#fff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // ── Ruled lines ───────────────────────────────────────────────────────────
  const ly = layout.firstLineY * MM_TO_PX;
  const ls = layout.lineSpacing * MM_TO_PX;
  const lm = layout.leftMargin * MM_TO_PX;
  const rm = layout.rightMargin * MM_TO_PX;

  ctx.strokeStyle = tpl.pdfTitleColor + "44"; // semi-transparent
  ctx.lineWidth   = 0.8;
  for (let y = ly; y < CANVAS_H - 20; y += ls) {
    ctx.beginPath();
    ctx.moveTo(lm, y);
    ctx.lineTo(CANVAS_W - rm, y);
    ctx.stroke();
  }

  // ── Title ─────────────────────────────────────────────────────────────────
  ctx.fillStyle  = tpl.pdfTitleColor;
  ctx.font       = "bold 18px -apple-system, sans-serif";
  ctx.fillText(selectedFile?.name || "Diary Entry", lm, 24);

  // ── Date + page number ────────────────────────────────────────────────────
  ctx.fillStyle = tpl.pdfTextColor || "#555";
  ctx.font      = "11px -apple-system, sans-serif";
  ctx.globalAlpha = 0.6;
  ctx.fillText(new Date(selectedFile?.createdAt).toDateString(), lm, 37);
  ctx.textAlign  = "right";
  ctx.fillText(`Page ${pageIndex + 1} of ${totalPages}`, CANVAS_W - rm, 37);
  ctx.textAlign  = "left";
  ctx.globalAlpha = 1;

  // ── Separator ─────────────────────────────────────────────────────────────
  ctx.strokeStyle = tpl.pdfTitleColor;
  ctx.lineWidth   = 0.8;
  ctx.beginPath();
  ctx.moveTo(lm, 42); ctx.lineTo(CANVAS_W - rm, 42);
  ctx.stroke();

  // ── Body text ─────────────────────────────────────────────────────────────
  ctx.fillStyle = tpl.pdfTextColor || "#202124";
  ctx.font      = "14px -apple-system, sans-serif";

  const charW  = 7.8; // approximate px per char at 14px
  const maxChr = Math.floor((CANVAS_W - lm - rm) / charW);
  const lines  = rawText.split("\n").flatMap((ln) => {
    if (!ln) return [""];
    const chunks = [];
    for (let i = 0; i < ln.length; i += maxChr) chunks.push(ln.slice(i, i + maxChr));
    return chunks;
  });

  lines.forEach((line, i) => {
    ctx.fillText(line, lm, ly + i * ls);
  });

  return canvas.toDataURL("image/png");
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PdfPreview({ selectedFile, pages, onClose }) {
  const [previewImgs, setPreviewImgs]   = useState([]);     // dataURL per page
  const [rendering, setRendering]       = useState(true);
  const [previewPage, setPreviewPage]   = useState(0);
  const [overlays, setOverlays]         = useState(() => pages.map(() => [])); // [[overlay,...],...]
  const [activeTab, setActiveTab]       = useState("stickers"); // "stickers" | "image"
  const [activeCat, setActiveCat]       = useState(0);
  const [downloading, setDownloading]   = useState(false);
  const [dragState, setDragState]       = useState(null); // { id, startX, startY, origX, origY }
  const [resizeState, setResizeState]   = useState(null);
  const [hoveredId, setHoveredId]       = useState(null);
  const pageRef    = useRef(null);
  const fileInputRef = useRef(null);

  // Render all pages on mount
  useEffect(() => {
    (async () => {
      setRendering(true);
      const imgs = [];
      for (let i = 0; i < pages.length; i++) {
        imgs.push(await renderPageToCanvas(pages[i], selectedFile, i, pages.length));
      }
      setPreviewImgs(imgs);
      setRendering(false);
    })();
  }, []); // eslint-disable-line

  // ── Overlay helpers ───────────────────────────────────────────────────────
  const addOverlay = (overlay) => {
    setOverlays((prev) => {
      const next = prev.map((arr, i) => i === previewPage ? [...arr, overlay] : arr);
      return next;
    });
  };

  const updateOverlay = (id, patch) => {
    setOverlays((prev) =>
      prev.map((arr, i) =>
        i === previewPage
          ? arr.map((o) => o.id === id ? { ...o, ...patch } : o)
          : arr
      )
    );
  };

  const removeOverlay = (id) => {
    setOverlays((prev) =>
      prev.map((arr, i) => i === previewPage ? arr.filter((o) => o.id !== id) : arr)
    );
  };

  const addSticker = (sticker) => {
    addOverlay({
      id:       `s-${Date.now()}-${Math.random()}`,
      type:     "sticker",
      src:      sticker.url,
      alt:      sticker.alt,
      x:        80, y: 80, size: 60, rotation: 0,
    });
  };

  const addUserImage = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      addOverlay({
        id:       `img-${Date.now()}`,
        type:     "image",
        src:      e.target.result,
        x:        60, y: 120, size: 120, rotation: 0,
      });
    };
    reader.readAsDataURL(file);
  };

  // ── Pointer drag for moving overlays ─────────────────────────────────────
  const onPointerDownOverlay = useCallback((e, overlay) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragState({
      id: overlay.id,
      startX: e.clientX, startY: e.clientY,
      origX: overlay.x,  origY: overlay.y,
    });
  }, []);

  const onPointerMoveOverlay = useCallback((e) => {
    if (!dragState) return;
    const rect  = pageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = CANVAS_W / rect.width;
    const dx = (e.clientX - dragState.startX) * scale;
    const dy = (e.clientY - dragState.startY) * scale;
    updateOverlay(dragState.id, { x: dragState.origX + dx, y: dragState.origY + dy });
  }, [dragState]); // eslint-disable-line

  const onPointerUpOverlay = useCallback(() => setDragState(null), []);

  // ── Resize handle ─────────────────────────────────────────────────────────
  const onPointerDownResize = useCallback((e, overlay) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizeState({ id: overlay.id, startX: e.clientX, origSize: overlay.size });
  }, []);

  const onPointerMoveResize = useCallback((e) => {
    if (!resizeState) return;
    const rect  = pageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = CANVAS_W / rect.width;
    const dx = (e.clientX - resizeState.startX) * scale;
    updateOverlay(resizeState.id, { size: Math.max(24, resizeState.origSize + dx) });
  }, [resizeState]); // eslint-disable-line

  const onPointerUpResize = useCallback(() => setResizeState(null), []);

  // ── Download with overlays ────────────────────────────────────────────────
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const pdfdoc = new jsPDF({ unit: "mm", format: "a4" });
      const pw = pdfdoc.internal.pageSize.getWidth();
      const ph = pdfdoc.internal.pageSize.getHeight();

      for (let index = 0; index < pages.length; index++) {
        const page    = pages[index];
        if (index !== 0) pdfdoc.addPage();

        const rawText = typeof page === "string" ? page : (page?.data ?? "");
        const tplKey  = page?.meta?.template || "plain";
        const fontKey = page?.meta?.font     || "default";
        const tpl     = TEMPLATES[tplKey] || TEMPLATES.plain;
        const fontDef = HANDWRITING_FONTS[fontKey] || HANDWRITING_FONTS.default;
        const layout  = tpl.layout;

        tpl.pdfDrawBackground(pdfdoc, pw, ph, layout);

        // Font
        let fontLoaded = false;
        if (fontDef.ttfUrl) {
          try { fontLoaded = await loadFontIntoDoc(pdfdoc, fontKey); } catch {}
        }
        const bodyFont = fontLoaded ? fontDef.pdfFont : "helvetica";

        // Title
        pdfdoc.setFontSize(14); pdfdoc.setTextColor(tpl.pdfTitleColor);
        pdfdoc.setFont("helvetica", "bold");
        pdfdoc.text(selectedFile.name || "Diary Entry", layout.leftMargin, 18);

        // Date
        pdfdoc.setFont("helvetica", "normal"); pdfdoc.setFontSize(8);
        pdfdoc.setTextColor(tpl.pdfTextColor);
        pdfdoc.setGState(new pdfdoc.GState({ opacity: 0.55 }));
        pdfdoc.text(new Date(selectedFile.createdAt).toDateString(), layout.leftMargin, 26);
        pdfdoc.text(`Page ${index + 1} of ${pages.length}`, pw - layout.rightMargin, 26, { align: "right" });
        pdfdoc.setGState(new pdfdoc.GState({ opacity: 1 }));

        // Separator
        pdfdoc.setDrawColor(tpl.pdfTitleColor); pdfdoc.setLineWidth(0.4);
        pdfdoc.line(layout.leftMargin, 30, pw - layout.rightMargin, 30);

        // Body text
        pdfdoc.setFont(bodyFont, "normal"); pdfdoc.setFontSize(layout.fontSize);
        pdfdoc.setTextColor(tpl.pdfTextColor);
        const textWidth = pw - layout.leftMargin - layout.rightMargin;
        const allLines  = pdfdoc.splitTextToSize(rawText || "", textWidth);
        const maxLines  = Math.floor((ph - layout.firstLineY - 14) / layout.lineSpacing);
        allLines.slice(0, maxLines).forEach((line, i) => {
          pdfdoc.text(line, layout.leftMargin, layout.firstLineY + i * layout.lineSpacing);
        });

        // ── Overlays ───────────────────────────────────────────────────────
        const pageOverlays = overlays[index] || [];
        for (const ov of pageOverlays) {
          try {
            const imgEl  = await loadImg(ov.src);
            // Convert canvas px coords to mm
            const xMm    = ov.x / MM_TO_PX;
            const yMm    = ov.y / MM_TO_PX;
            const sizeMm = ov.size / MM_TO_PX;
            // Draw into a small canvas to get a PNG dataURL (needed for addImage)
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
            pdfdoc.addImage(c.toDataURL("image/png"), "PNG", xMm, yMm, sizeMm, sizeMm);
          } catch (e) {
            console.warn("Overlay render failed:", e.message);
          }
        }
      }

      const safeName = (selectedFile.name || "diary").replace(/[^a-z0-9_-]/gi, "_");
      pdfdoc.save(`${safeName}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const curOverlays = overlays[previewPage] || [];
  const pageImg     = previewImgs[previewPage];

  return (
    <div style={st.backdrop} onPointerMove={(e) => { onPointerMoveOverlay(e); onPointerMoveResize(e); }}
      onPointerUp={() => { onPointerUpOverlay(); onPointerUpResize(); }}>
      <div style={st.modal}>

        {/* ── Header ── */}
        <div style={st.header}>
          <span style={st.headerTitle}>Preview & Decorate</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ ...st.btnPrimary, opacity: downloading ? 0.7 : 1 }}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? "⏳ Saving…" : "⬇ Download PDF"}
            </button>
            <button style={st.btnClose} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={st.body}>

          {/* ── Left panel: page preview ── */}
          <div style={st.previewPanel}>
            <div style={st.pageWrapper}>
              {rendering ? (
                <div style={st.loadingBox}>Rendering preview…</div>
              ) : (
                <div
                  ref={pageRef}
                  style={{ position: "relative", display: "inline-block", lineHeight: 0 }}
                >
                  {/* Page background image */}
                  <img
                    src={pageImg}
                    alt="page preview"
                    style={{ width: "100%", borderRadius: 4, display: "block" }}
                    draggable={false}
                  />

                  {/* Overlay stickers/images */}
                  {curOverlays.map((ov) => {
                    const rect = pageRef.current?.getBoundingClientRect() || { width: CANVAS_W };
                    const scale = rect.width / CANVAS_W;
                    const left  = ov.x * scale;
                    const top   = ov.y * scale;
                    const size  = ov.size * scale;
                    const isHov = hoveredId === ov.id;
                    return (
                      <div
                        key={ov.id}
                        style={{
                          position: "absolute",
                          left, top,
                          width: size, height: size,
                          cursor: "move",
                          transform: ov.rotation ? `rotate(${ov.rotation}deg)` : undefined,
                          userSelect: "none",
                        }}
                        onPointerDown={(e) => onPointerDownOverlay(e, ov)}
                        onPointerEnter={() => setHoveredId(ov.id)}
                        onPointerLeave={() => setHoveredId(null)}
                      >
                        <img
                          src={ov.src}
                          alt={ov.alt || ""}
                          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                          draggable={false}
                          crossOrigin="anonymous"
                        />
                        {/* Delete button */}
                        {isHov && (
                          <button
                            style={st.deleteBtn}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => removeOverlay(ov.id)}
                          >×</button>
                        )}
                        {/* Resize handle */}
                        {isHov && (
                          <div
                            style={st.resizeHandle}
                            onPointerDown={(e) => onPointerDownResize(e, ov)}
                          />
                        )}
                        {/* Rotation buttons */}
                        {isHov && (
                          <div style={st.rotRow}>
                            <button style={st.rotBtn}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => updateOverlay(ov.id, { rotation: ((ov.rotation || 0) - 15 + 360) % 360 })}>↺</button>
                            <button style={st.rotBtn}
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={() => updateOverlay(ov.id, { rotation: ((ov.rotation || 0) + 15) % 360 })}>↻</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Page navigation */}
            <div style={st.pageNav}>
              <button style={st.navBtn} disabled={previewPage === 0}
                onClick={() => setPreviewPage((p) => p - 1)}>← Prev</button>
              <span style={{ fontSize: 12, color: "#5f6368" }}>
                Page {previewPage + 1} / {pages.length}
              </span>
              <button style={st.navBtn} disabled={previewPage >= pages.length - 1}
                onClick={() => setPreviewPage((p) => p + 1)}>Next →</button>
            </div>
          </div>

          {/* ── Right panel: sticker / image picker ── */}
          <div style={st.sidePanel}>
            <div style={st.tabRow}>
              <button
                style={{ ...st.tab, ...(activeTab === "stickers" ? st.tabActive : {}) }}
                onClick={() => setActiveTab("stickers")}
              >🎨 Stickers</button>
              <button
                style={{ ...st.tab, ...(activeTab === "image" ? st.tabActive : {}) }}
                onClick={() => setActiveTab("image")}
              >📷 My Photo</button>
            </div>

            {activeTab === "stickers" && (
              <div style={st.stickerPanel}>
                {/* Category tabs */}
                <div style={st.catRow}>
                  {STICKER_CATEGORIES.map((cat, i) => (
                    <button
                      key={i}
                      style={{ ...st.catBtn, ...(activeCat === i ? st.catBtnActive : {}) }}
                      onClick={() => setActiveCat(i)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <div style={st.stickerGrid}>
                  {STICKER_CATEGORIES[activeCat].stickers.map((sticker) => (
                    <button
                      key={sticker.id}
                      style={st.stickerBtn}
                      title={sticker.alt}
                      onClick={() => addSticker(sticker)}
                    >
                      <img
                        src={sticker.url}
                        alt={sticker.alt}
                        style={{ width: 40, height: 40, objectFit: "contain" }}
                        crossOrigin="anonymous"
                      />
                    </button>
                  ))}
                </div>
                <p style={st.hint}>Click a sticker to add it. Drag to reposition, use handles to resize/rotate.</p>
              </div>
            )}

            {activeTab === "image" && (
              <div style={st.imagePanel}>
                <div
                  style={st.dropZone}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f && f.type.startsWith("image/")) addUserImage(f);
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                  <div style={{ fontSize: 13, color: "#5f6368" }}>Click or drag & drop an image</div>
                  <div style={{ fontSize: 11, color: "#9aa0a6", marginTop: 4 }}>PNG, JPG, GIF, WebP</div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => { if (e.target.files[0]) addUserImage(e.target.files[0]); }}
                />
                <p style={st.hint}>Your image will be added to the current page. Drag to reposition.</p>
              </div>
            )}

            {/* Overlay list for current page */}
            {curOverlays.length > 0 && (
              <div style={st.overlayList}>
                <div style={st.overlayListTitle}>On this page ({curOverlays.length})</div>
                {curOverlays.map((ov, i) => (
                  <div key={ov.id} style={st.overlayListRow}>
                    <img src={ov.src} alt="" style={{ width: 24, height: 24, objectFit: "contain" }} crossOrigin="anonymous" />
                    <span style={{ fontSize: 12, flex: 1, color: "#3c4043" }}>
                      {ov.type === "sticker" ? (STICKER_MAP[ov.id.split("-")[0]]?.alt || "Sticker") : "Photo"} #{i + 1}
                    </span>
                    <button style={st.removeListBtn} onClick={() => removeOverlay(ov.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const st = {
  backdrop:     { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 600, display: "flex", alignItems: "stretch", justifyContent: "center" },
  modal:        { background: "#fff", width: "100%", maxWidth: 1100, margin: "20px auto", borderRadius: 14, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,0.25)" },
  header:       { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #e8eaed", flexShrink: 0 },
  headerTitle:  { fontSize: 16, fontWeight: 700, color: "#202124" },
  btnPrimary:   { padding: "8px 18px", background: "#1a73e8", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13, fontWeight: 500 },
  btnClose:     { width: 32, height: 32, border: "none", background: "#f1f3f4", borderRadius: "50%", cursor: "pointer", fontSize: 16, color: "#5f6368", display: "flex", alignItems: "center", justifyContent: "center" },
  body:         { display: "flex", flex: 1, overflow: "hidden" },

  // Left preview
  previewPanel: { flex: 1, display: "flex", flexDirection: "column", background: "#f8f9fa", overflow: "hidden", padding: 20, gap: 12 },
  pageWrapper:  { flex: 1, overflow: "auto", display: "flex", justifyContent: "center", alignItems: "flex-start" },
  loadingBox:   { display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#80868b", fontSize: 14 },
  pageNav:      { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexShrink: 0 },
  navBtn:       { padding: "5px 12px", border: "1px solid #dadce0", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#3c4043" },

  // Right panel
  sidePanel:    { width: 280, borderLeft: "1px solid #e8eaed", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 },
  tabRow:       { display: "flex", borderBottom: "1px solid #e8eaed", flexShrink: 0 },
  tab:          { flex: 1, padding: "11px 6px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "#5f6368", borderBottom: "2px solid transparent" },
  tabActive:    { color: "#1a73e8", borderBottomColor: "#1a73e8", fontWeight: 500 },
  stickerPanel: { flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 0 },
  catRow:       { display: "flex", flexWrap: "wrap", gap: 4, padding: "10px 10px 6px", flexShrink: 0 },
  catBtn:       { padding: "3px 8px", border: "1px solid #e0e0e0", borderRadius: 12, background: "#fff", fontSize: 11, cursor: "pointer", color: "#5f6368" },
  catBtnActive: { background: "#e8f0fe", borderColor: "#c5d8fb", color: "#1a73e8", fontWeight: 500 },
  stickerGrid:  { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, padding: "4px 10px 8px" },
  stickerBtn:   { border: "1px solid #f1f3f4", background: "#fafafa", borderRadius: 8, padding: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  hint:         { fontSize: 11, color: "#9aa0a6", padding: "6px 10px 10px", margin: 0, lineHeight: 1.5 },

  // Image upload
  imagePanel:   { flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 },
  dropZone:     { border: "2px dashed #dadce0", borderRadius: 10, padding: "28px 16px", textAlign: "center", cursor: "pointer", background: "#fafafa" },

  // Overlay controls
  deleteBtn:    { position: "absolute", top: -8, right: -8, width: 18, height: 18, borderRadius: "50%", background: "#d93025", color: "#fff", border: "none", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 },
  resizeHandle: { position: "absolute", bottom: -6, right: -6, width: 14, height: 14, background: "#1a73e8", borderRadius: "50%", cursor: "se-resize", border: "2px solid #fff" },
  rotRow:       { position: "absolute", bottom: -22, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2 },
  rotBtn:       { width: 20, height: 20, fontSize: 12, border: "1px solid #ddd", background: "#fff", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },

  // Overlay list
  overlayList:     { borderTop: "1px solid #f1f3f4", padding: "8px 10px", flexShrink: 0 },
  overlayListTitle:{ fontSize: 11, fontWeight: 600, color: "#80868b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" },
  overlayListRow:  { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  removeListBtn:   { border: "none", background: "transparent", color: "#d93025", cursor: "pointer", fontSize: 13, padding: "2px 4px" },
};
