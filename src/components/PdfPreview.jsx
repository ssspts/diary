// src/components/PdfPreview.jsx
import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import { TEMPLATES, HANDWRITING_FONTS, loadFontIntoDoc } from "../utils/templates";
import ShareDialog from "./ShareDialog";
import {
  CANVAS_W, CANVAS_H, MM_TO_PX,
  wrapWords, MAX_LINES_PER_PAGE,
  DATE_Y_MM, TITLE_Y_MM, HEADER_LINE_Y,
  FIRST_LINE_Y_MM, LINE_SPACING_MM, LEFT_MARGIN_MM, RIGHT_MARGIN_MM,
  BODY_FONT_SIZE_PT,
} from "../utils/pageSpec";

const PT_TO_PX = 96 / 72;
const EDITOR_PAGE_W = 780;

// ── Sticker categories ────────────────────────────────────────────────────────
const STICKER_CATEGORIES = [
  {
    label: "⭐ Stars",
    stickers: [
      { id: "s1", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/2b50.svg", alt: "Star" },
      { id: "s2", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f31f.svg", alt: "Glowing Star" },
      { id: "s3", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f4ab.svg", alt: "Dizzy" },
      { id: "s4", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/2728.svg", alt: "Sparkles" },
    ],
  },
  {
    label: "❤️ Hearts",
    stickers: [
      { id: "h1", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/2764.svg", alt: "Heart" },
      { id: "h2", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f497.svg", alt: "Growing Heart" },
      { id: "h3", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f48b.svg", alt: "Kiss Mark" },
      { id: "h4", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f495.svg", alt: "Two Hearts" },
    ],
  },
  {
    label: "🌸 Nature",
    stickers: [
      { id: "n1", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f338.svg", alt: "Cherry Blossom" },
      { id: "n2", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f33b.svg", alt: "Sunflower" },
      { id: "n3", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f342.svg", alt: "Fallen Leaf" },
      { id: "n4", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f340.svg", alt: "Four Leaf Clover" },
    ],
  },
  {
    label: "😊 Faces",
    stickers: [
      { id: "f1", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f600.svg", alt: "Grinning" },
      { id: "f2", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f602.svg", alt: "Laughing" },
      { id: "f3", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f60d.svg", alt: "Heart Eyes" },
      { id: "f4", url: "https://cdn.jsdelivr.net/npm/twemoji@14/assets/svg/1f622.svg", alt: "Crying" },
    ],
  },
];

// ── Image cache ───────────────────────────────────────────────────────────────
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

async function drawSvgOnCanvas(ctx, svgFn, canvasW, y, h) {
  if (!svgFn || !h) return;
  const svgString = svgFn(canvasW).replace(/width="\d+"/, `width="${canvasW}"`);
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url  = URL.createObjectURL(blob);
  await new Promise((res) => {
    const img = new Image();
    img.onload  = () => { ctx.drawImage(img, 0, y, canvasW, h); URL.revokeObjectURL(url); res(); };
    img.onerror = () => { URL.revokeObjectURL(url); res(); };
    img.src = url;
  });
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  if (h.length === 3)
    return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function cssHex(hex, alpha = 1) {
  if (!hex || !hex.startsWith("#")) return `rgba(150,150,150,${alpha})`;
  const [r,g,b] = hexToRgb(hex);
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function drawTemplateBackground(ctx, tpl, pw, ph) {
  const decor = tpl.uiDecor;
  const firstLineY  = FIRST_LINE_Y_MM * MM_TO_PX;
  const lineSpacing = LINE_SPACING_MM  * MM_TO_PX;
  const leftMargin  = LEFT_MARGIN_MM   * MM_TO_PX;
  const rightMargin = RIGHT_MARGIN_MM  * MM_TO_PX;

  // 1. Background
  const bgHex = (decor?.containerBg || "#fff").match(/#[0-9a-f]{3,6}/i)?.[0] || "#fff";
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, pw, ph);

  // 2. Template bands
  const key = tpl.label?.toLowerCase() || "";

  if (key.includes("rose")) {
    ctx.fillStyle="rgb(255,182,203)"; ctx.fillRect(0,0,pw,8*MM_TO_PX);
    ctx.fillStyle="rgb(255,105,145)"; ctx.fillRect(0,0,pw,3*MM_TO_PX);
    ctx.fillStyle="rgb(255,182,203)"; ctx.fillRect(0,ph-8*MM_TO_PX,pw,8*MM_TO_PX);
    ctx.fillStyle="rgb(255,105,145)"; ctx.fillRect(0,ph-3*MM_TO_PX,pw,3*MM_TO_PX);
  } else if (key.includes("ocean")) {
    ctx.fillStyle="rgb(3,169,244)";  ctx.fillRect(0,0,pw,10*MM_TO_PX);
    ctx.fillStyle="rgb(0,188,212)";  ctx.fillRect(0,3*MM_TO_PX,pw,4*MM_TO_PX);
    ctx.fillStyle="rgb(3,169,244)";  ctx.fillRect(0,ph-10*MM_TO_PX,pw,10*MM_TO_PX);
  } else if (key.includes("galaxy")) {
    ctx.fillStyle="rgb(22,33,62)";   ctx.fillRect(0,0,pw,ph);
    ctx.fillStyle="rgb(63,0,125)";   ctx.fillRect(0,0,pw,7*MM_TO_PX);
    ctx.fillStyle="rgb(63,0,125)";   ctx.fillRect(0,ph-7*MM_TO_PX,pw,7*MM_TO_PX);
  } else if (key.includes("forest")) {
    ctx.fillStyle="rgb(56,142,60)";  ctx.fillRect(0,0,pw,7*MM_TO_PX);
    ctx.fillStyle="rgb(56,142,60)";  ctx.fillRect(0,ph-7*MM_TO_PX,pw,7*MM_TO_PX);
  } else if (key.includes("pastel")) {
    const bands=[[252,228,236],[248,225,241],[243,229,245],[235,234,245],[232,234,246],[227,242,253]];
    const bh=ph/bands.length;
    bands.forEach(([r,g,b],i)=>{ ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fillRect(0,i*bh,pw,bh+1); });
  } else if (key.includes("scrapbook")) {
    ctx.fillStyle="rgb(253,246,236)"; ctx.fillRect(0,0,pw,ph);
  }

  // 3. Ruled lines
  ctx.strokeStyle = cssHex(decor?.lineColor || "#ccc", 0.5);
  ctx.lineWidth   = 0.35 * MM_TO_PX;
  for (let y = firstLineY; y < ph - lineSpacing; y += lineSpacing) {
    ctx.beginPath(); ctx.moveTo(leftMargin, y); ctx.lineTo(pw - rightMargin, y); ctx.stroke();
  }
}

async function renderPageToCanvas(page, selectedFile, pageIndex, totalPages) {
  const canvas  = document.createElement("canvas");
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");

  const rawText = typeof page === "string" ? page : (page?.data ?? "");
  const tplKey  = page?.meta?.template || "plain";
  const fontKey = page?.meta?.font     || "default";
  const tpl     = TEMPLATES[tplKey]  || TEMPLATES.plain;
  const fontDef = HANDWRITING_FONTS[fontKey] || HANDWRITING_FONTS.default;

  const pw = CANVAS_W;
  const ph = CANVAS_H;

  const titleY      = TITLE_Y_MM      * MM_TO_PX;
  const dateY       = DATE_Y_MM       * MM_TO_PX;
  const sepY        = HEADER_LINE_Y   * MM_TO_PX;
  const firstLineY  = FIRST_LINE_Y_MM * MM_TO_PX;
  const lineSpacing = LINE_SPACING_MM * MM_TO_PX;
  const leftMargin  = LEFT_MARGIN_MM  * MM_TO_PX;
  const rightMargin = RIGHT_MARGIN_MM * MM_TO_PX;

  const titleFontPx = Math.round(13 * PT_TO_PX);
  const dateFontPx  = Math.round(8  * PT_TO_PX);
  const bodyFontPx  = Math.round(BODY_FONT_SIZE_PT * PT_TO_PX);

  drawTemplateBackground(ctx, tpl, pw, ph);

  ctx.fillStyle = cssHex(tpl.pdfTitleColor || "#202124");
  ctx.font      = `bold ${titleFontPx}px -apple-system, Helvetica, sans-serif`;
  ctx.fillText(selectedFile?.name || "Diary Entry", leftMargin, titleY);

  ctx.font        = `${dateFontPx}px -apple-system, Helvetica, sans-serif`;
  ctx.fillStyle   = cssHex(tpl.pdfTextColor || "#555555");
  ctx.globalAlpha = 0.55;
  ctx.fillText(new Date(selectedFile?.createdAt || Date.now()).toDateString(), leftMargin, dateY);
  ctx.textAlign   = "right";
  ctx.fillText(`Page ${pageIndex + 1} of ${totalPages}`, pw - rightMargin, dateY);
  ctx.textAlign   = "left";
  ctx.globalAlpha = 1;

  ctx.strokeStyle = cssHex(tpl.pdfTitleColor || "#202124");
  ctx.lineWidth   = 0.4 * MM_TO_PX;
  ctx.beginPath(); ctx.moveTo(leftMargin, sepY); ctx.lineTo(pw - rightMargin, sepY); ctx.stroke();

  const bodyFamily = fontDef.editorFamily !== "inherit"
    ? fontDef.editorFamily + ", -apple-system, sans-serif"
    : "-apple-system, Helvetica, sans-serif";
  const fontSpec = `${bodyFontPx}px ${bodyFamily}`;
  ctx.font      = fontSpec;
  ctx.fillStyle = cssHex(tpl.pdfTextColor || "#202124");

  const textWidthPx  = pw - leftMargin - rightMargin;
  const wrappedLines = wrapWords(ctx, rawText, textWidthPx, fontSpec);
  wrappedLines.slice(0, MAX_LINES_PER_PAGE).forEach((line, i) => {
    ctx.fillText(line, leftMargin, firstLineY + i * lineSpacing);
  });

  return canvas;
}

async function flattenPageCanvas(baseCanvas, pageOverlays) {
  const out = document.createElement("canvas");
  out.width = CANVAS_W; out.height = CANVAS_H;
  const ctx = out.getContext("2d");
  ctx.drawImage(baseCanvas, 0, 0);
  const scale = CANVAS_W / EDITOR_PAGE_W;
  for (const ov of (pageOverlays || [])) {
    try {
      const imgEl  = await loadImg(ov.src);
      const cx     = (ov.x + ov.size / 2) * scale;
      const cy     = (ov.y + ov.size / 2) * scale;
      const halfSz = (ov.size / 2) * scale;
      ctx.save();
      ctx.translate(cx, cy);
      if (ov.rotation) ctx.rotate((ov.rotation * Math.PI) / 180);
      ctx.drawImage(imgEl, -halfSz, -halfSz, halfSz * 2, halfSz * 2);
      ctx.restore();
    } catch (e) { console.warn("overlay render failed:", e.message); }
  }
  return out;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PdfPreview({ selectedFile, pages, onClose }) {
  const [baseCanvases, setBaseCanvases] = useState([]);
  const [previewImgs,  setPreviewImgs]  = useState([]);
  const [rendering,    setRendering]    = useState(true);
  const [previewPage,  setPreviewPage]  = useState(0);
  const [overlays,     setOverlays]     = useState({});   // { [pageIdx]: overlay[] }
  const [downloading,  setDownloading]  = useState(false);
  const [dlFormat,     setDlFormat]     = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [activeTab,    setActiveTab]    = useState("stickers");
  const [activeCat,    setActiveCat]    = useState(0);

  const fileInputRef = useRef(null);

  // Current page overlays
  const curOverlays = overlays[previewPage] || [];

  // ── Render base canvases on mount ─────────────────────────────────────────
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

  // ── Re-composite preview whenever overlays or base canvases change ────────
  useEffect(() => {
    if (!baseCanvases.length) return;
    (async () => {
      const imgs = [];
      for (let i = 0; i < baseCanvases.length; i++) {
        const editorOvs  = pages[i]?.overlays || [];
        const previewOvs = overlays[i] || [];
        const editorIds  = new Set(editorOvs.map((o) => o.id));
        const merged     = [...editorOvs, ...previewOvs.filter((o) => !editorIds.has(o.id))];
        const out = await flattenPageCanvas(baseCanvases[i], merged);
        imgs.push(out.toDataURL("image/png"));
      }
      setPreviewImgs(imgs);
    })();
  }, [baseCanvases, overlays]); // eslint-disable-line

  // ── Add sticker ───────────────────────────────────────────────────────────
  const addSticker = (s) => {
    const newSticker = {
      id: `sticker_${Date.now()}`,
      type: "sticker",
      src: s.url,
      alt: s.alt,
      x: 100, y: 100,
      size: 80,
      rotation: 0,
    };
    setOverlays((prev) => ({
      ...prev,
      [previewPage]: [...(prev[previewPage] || []), newSticker],
    }));
  };

  // ── Add user image ────────────────────────────────────────────────────────
  const addUserImage = (file) => {
    const url = URL.createObjectURL(file);
    const newImg = {
      id: `photo_${Date.now()}`,
      type: "photo",
      src: url,
      alt: "Photo",
      x: 80, y: 80,
      size: 120,
      rotation: 0,
    };
    setOverlays((prev) => ({
      ...prev,
      [previewPage]: [...(prev[previewPage] || []), newImg],
    }));
  };

  // ── Remove overlay ────────────────────────────────────────────────────────
  const removeOverlay = (id) => {
    setOverlays((prev) => ({
      ...prev,
      [previewPage]: (prev[previewPage] || []).filter((o) => o.id !== id),
    }));
  };

  // ── Download PDF ──────────────────────────────────────────────────────────
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
        if (fontDef.ttfUrl) {
          try { fontLoaded = await loadFontIntoDoc(pdfdoc, fontKey); } catch {}
        }
        const bodyFont = fontLoaded ? fontDef.pdfFont : "helvetica";

        pdfdoc.setFontSize(14);
        pdfdoc.setTextColor(tpl.pdfTitleColor);
        pdfdoc.setFont("helvetica", "bold");
        pdfdoc.text(selectedFile?.name || "Diary Entry", layout.leftMargin, 18);

        pdfdoc.setFont("helvetica", "normal");
        pdfdoc.setFontSize(8);
        pdfdoc.setTextColor(tpl.pdfTextColor);
        pdfdoc.setGState(new pdfdoc.GState({ opacity: 0.55 }));
        pdfdoc.text(new Date(selectedFile?.createdAt || Date.now()).toDateString(), layout.leftMargin, 26);
        pdfdoc.text(`Page ${index + 1} of ${pages.length}`, pw - layout.rightMargin, 26, { align: "right" });
        pdfdoc.setGState(new pdfdoc.GState({ opacity: 1 }));

        pdfdoc.setDrawColor(tpl.pdfTitleColor);
        pdfdoc.setLineWidth(0.4);
        pdfdoc.line(layout.leftMargin, 30, pw - layout.rightMargin, 30);

        pdfdoc.setFont(bodyFont, "normal");
        pdfdoc.setFontSize(layout.fontSize);
        pdfdoc.setTextColor(tpl.pdfTextColor);
        const textWidth = pw - layout.leftMargin - layout.rightMargin;
        const allLines  = pdfdoc.splitTextToSize(rawText || "", textWidth);
        const maxLines  = Math.floor((ph - layout.firstLineY - 14) / layout.lineSpacing);
        allLines.slice(0, maxLines).forEach((line, i) => {
          pdfdoc.text(line, layout.leftMargin, layout.firstLineY + i * layout.lineSpacing);
        });
      }
      const safeName = (selectedFile?.name || "diary").replace(/[^a-z0-9_-]/gi, "_");
      pdfdoc.save(`${safeName}.pdf`);
    } finally {
      setDownloading(false);
      setDlFormat(null);
    }
  };

  // ── Download Image ────────────────────────────────────────────────────────
  const downloadImage = async () => {
    setDownloading(true);
    try {
      const flatCanvases = [];
      for (let i = 0; i < baseCanvases.length; i++) {
        const editorOvs  = pages[i]?.overlays || [];
        const previewOvs = overlays[i] || [];
        const editorIds  = new Set(editorOvs.map((o) => o.id));
        const merged     = [...editorOvs, ...previewOvs.filter((o) => !editorIds.has(o.id))];
        flatCanvases.push(await flattenPageCanvas(baseCanvases[i], merged));
      }
      const combined = document.createElement("canvas");
      combined.width  = CANVAS_W;
      combined.height = CANVAS_H * flatCanvases.length;
      const ctx = combined.getContext("2d");
      flatCanvases.forEach((c, i) => ctx.drawImage(c, 0, i * CANVAS_H));
      const a = document.createElement("a");
      a.href     = combined.toDataURL("image/png");
      a.download = `${(selectedFile?.name || "diary").replace(/[^a-z0-9_-]/gi, "_")}.png`;
      a.click();
    } finally {
      setDownloading(false);
      setDlFormat(null);
    }
  };

  const pageImg       = previewImgs[previewPage];
  const firstPageText = typeof pages[0] === "string" ? pages[0] : (pages[0]?.data ?? "");

  return (
    <div style={st.backdrop}>
      <div style={st.modal}>

        {/* Header */}
        <div style={st.header}>
          <span style={st.headerTitle}>Preview & Export</span>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button style={st.btnShare} onClick={() => setShowShareDialog(true)}>↗ Share</button>
            <div style={{ position:"relative" }}>
              <button
                style={{ ...st.btnPrimary, opacity: downloading ? 0.7 : 1 }}
                onClick={() => setDlFormat((v) => v ? null : "menu")}
                disabled={downloading}
              >
                {downloading ? "⏳ Saving…" : "⬇ Download ▾"}
              </button>
              {dlFormat === "menu" && (
                <div style={st.dlMenu}>
                  <button style={st.dlItem} onClick={() => { setDlFormat(null); downloadPdf(); }}>📄 Download as PDF</button>
                  <button style={st.dlItem} onClick={() => { setDlFormat(null); downloadImage(); }}>🖼 Download as Image</button>
                </div>
              )}
            </div>
            <button style={st.btnClose} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={st.body}>

          {/* Left: page preview */}
          <div style={st.previewPanel}>
            <div style={st.pageWrapper}>
              {rendering ? (
                <div style={st.loadingBox}>Rendering preview…</div>
              ) : pageImg ? (
                <img
                  src={pageImg}
                  alt="page"
                  style={{ width:"100%", borderRadius:4, display:"block", boxShadow:"0 4px 20px rgba(0,0,0,0.15)" }}
                  draggable={false}
                />
              ) : (
                <div style={st.loadingBox}>Nothing to preview yet.</div>
              )}
            </div>
            <div style={st.pageNav}>
              <button style={st.navBtn} disabled={previewPage === 0} onClick={() => setPreviewPage((p) => p - 1)}>← Prev</button>
              <span style={{ fontSize:12, color:"#5f6368" }}>Page {previewPage + 1} / {pages.length}</span>
              <button style={st.navBtn} disabled={previewPage >= pages.length - 1} onClick={() => setPreviewPage((p) => p + 1)}>Next →</button>
            </div>
          </div>

          {/* Right: decorate panel */}
          <div style={st.sidePanel}>
            <div style={st.tabRow}>
              <button style={{ ...st.tab, ...(activeTab === "stickers" ? st.tabActive : {}) }} onClick={() => setActiveTab("stickers")}>🎨 Stickers</button>
              <button style={{ ...st.tab, ...(activeTab === "image"    ? st.tabActive : {}) }} onClick={() => setActiveTab("image")}>📷 My Photo</button>
            </div>

            {activeTab === "stickers" && (
              <div style={st.stickerPanel}>
                <div style={st.catRow}>
                  {STICKER_CATEGORIES.map((cat, i) => (
                    <button key={i}
                      style={{ ...st.catBtn, ...(activeCat === i ? st.catBtnActive : {}) }}
                      onClick={() => setActiveCat(i)}
                    >{cat.label}</button>
                  ))}
                </div>
                <div style={st.stickerGrid}>
                  {STICKER_CATEGORIES[activeCat].stickers.map((s) => (
                    <button key={s.id} style={st.stickerBtn} title={s.alt} onClick={() => addSticker(s)}>
                      <img src={s.url} alt={s.alt} style={{ width:40, height:40, objectFit:"contain" }} crossOrigin="anonymous" />
                    </button>
                  ))}
                </div>
                <p style={st.hint}>Click a sticker to add it to the page.</p>
              </div>
            )}

            {activeTab === "image" && (
              <div style={st.imagePanel}>
                <div style={st.dropZone}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) addUserImage(f); }}
                >
                  <div style={{ fontSize:32, marginBottom:8 }}>📁</div>
                  <div style={{ fontSize:13, color:"#5f6368" }}>Click or drag & drop an image</div>
                  <div style={{ fontSize:11, color:"#9aa0a6", marginTop:4 }}>PNG · JPG · GIF · WebP</div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display:"none" }}
                  onChange={(e) => { if (e.target.files[0]) addUserImage(e.target.files[0]); }} />
                <p style={st.hint}>Your photo is added to the current page.</p>
              </div>
            )}

            {curOverlays.length > 0 && (
              <div style={st.overlayList}>
                <div style={st.overlayListTitle}>On this page ({curOverlays.length})</div>
                {curOverlays.map((ov, i) => (
                  <div key={ov.id} style={st.overlayListRow}>
                    <img src={ov.src} alt="" style={{ width:24, height:24, objectFit:"contain" }} crossOrigin="anonymous" />
                    <span style={{ fontSize:12, flex:1, color:"#3c4043" }}>{ov.type === "sticker" ? ov.alt || "Sticker" : "Photo"} #{i+1}</span>
                    <button style={st.removeListBtn} onClick={() => removeOverlay(ov.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
  backdrop:         { position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:600, display:"flex", alignItems:"stretch", justifyContent:"center" },
  modal:            { background:"#fff", width:"100%", maxWidth:1100, margin:"20px auto", borderRadius:14, display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 16px 60px rgba(0,0,0,0.25)" },
  header:           { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderBottom:"1px solid #e8eaed", flexShrink:0 },
  headerTitle:      { fontSize:16, fontWeight:700, color:"#202124" },
  btnPrimary:       { padding:"8px 16px", background:"#1a73e8", color:"#fff", border:"none", borderRadius:7, cursor:"pointer", fontSize:13, fontWeight:500 },
  btnShare:         { padding:"7px 14px", background:"#fff", color:"#1a73e8", border:"1px solid #c5d8fb", borderRadius:7, cursor:"pointer", fontSize:13, fontWeight:500 },
  btnClose:         { width:32, height:32, border:"none", background:"#f1f3f4", borderRadius:"50%", cursor:"pointer", fontSize:16, color:"#5f6368", display:"flex", alignItems:"center", justifyContent:"center" },
  dlMenu:           { position:"absolute", top:"calc(100% + 6px)", right:0, background:"#fff", border:"1px solid #e0e0e0", borderRadius:8, boxShadow:"0 4px 16px rgba(0,0,0,0.1)", minWidth:210, zIndex:10, overflow:"hidden" },
  dlItem:           { display:"block", width:"100%", padding:"11px 16px", border:"none", background:"transparent", textAlign:"left", fontSize:13, cursor:"pointer", color:"#202124" },
  body:             { display:"flex", flex:1, overflow:"hidden" },
  previewPanel:     { flex:1, display:"flex", flexDirection:"column", background:"#f8f9fa", overflow:"hidden", padding:20, gap:12 },
  pageWrapper:      { flex:1, overflow:"auto", display:"flex", justifyContent:"center", alignItems:"flex-start" },
  loadingBox:       { display:"flex", alignItems:"center", justifyContent:"center", height:200, color:"#80868b", fontSize:14 },
  pageNav:          { display:"flex", alignItems:"center", justifyContent:"center", gap:12, flexShrink:0 },
  navBtn:           { padding:"5px 12px", border:"1px solid #dadce0", background:"#fff", borderRadius:6, cursor:"pointer", fontSize:12, color:"#3c4043" },
  sidePanel:        { width:280, borderLeft:"1px solid #e8eaed", display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0 },
  tabRow:           { display:"flex", borderBottom:"1px solid #e8eaed", flexShrink:0 },
  tab:              { flex:1, padding:"11px 6px", border:"none", background:"transparent", cursor:"pointer", fontSize:13, color:"#5f6368", borderBottom:"2px solid transparent" },
  tabActive:        { color:"#1a73e8", borderBottomColor:"#1a73e8", fontWeight:500 },
  stickerPanel:     { flex:1, overflow:"auto", display:"flex", flexDirection:"column" },
  catRow:           { display:"flex", flexWrap:"wrap", gap:4, padding:"10px 10px 6px", flexShrink:0 },
  catBtn:           { padding:"3px 8px", border:"1px solid #e0e0e0", borderRadius:12, background:"#fff", fontSize:11, cursor:"pointer", color:"#5f6368" },
  catBtnActive:     { background:"#e8f0fe", borderColor:"#c5d8fb", color:"#1a73e8", fontWeight:500 },
  stickerGrid:      { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4, padding:"4px 10px 8px" },
  stickerBtn:       { border:"1px solid #f1f3f4", background:"#fafafa", borderRadius:8, padding:4, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  hint:             { fontSize:11, color:"#9aa0a6", padding:"6px 10px 10px", margin:0, lineHeight:1.5 },
  imagePanel:       { flex:1, overflow:"auto", padding:12, display:"flex", flexDirection:"column", gap:12 },
  dropZone:         { border:"2px dashed #dadce0", borderRadius:10, padding:"28px 16px", textAlign:"center", cursor:"pointer", background:"#fafafa" },
  overlayList:      { borderTop:"1px solid #f1f3f4", padding:"8px 10px", flexShrink:0 },
  overlayListTitle: { fontSize:11, fontWeight:600, color:"#80868b", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.04em" },
  overlayListRow:   { display:"flex", alignItems:"center", gap:8, marginBottom:4 },
  removeListBtn:    { border:"none", background:"transparent", color:"#d93025", cursor:"pointer", fontSize:13, padding:"2px 4px" },
};
