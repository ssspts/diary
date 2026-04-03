// src/components/PdfPreview.jsx
import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import { TEMPLATES, HANDWRITING_FONTS } from "../utils/templates";
import ShareDialog from "./ShareDialog";
import {
  CANVAS_W, CANVAS_H, MM_TO_PX,
  wrapWords, MAX_LINES_PER_PAGE,
  DATE_Y_MM, TITLE_Y_MM, HEADER_LINE_Y,
  FIRST_LINE_Y_MM, LINE_SPACING_MM, LEFT_MARGIN_MM, RIGHT_MARGIN_MM,
  BODY_FONT_SIZE_PT,
} from "../utils/pageSpec";

const PT_TO_PX      = 96 / 72;
const EDITOR_PAGE_W = 780;   // max editor page width in px
const PAGE_W_MM     = 210;
const PAGE_H_MM     = 297;
// Editor textarea top offset for plain template (no SVG header band)
const EDITOR_BODY_TOP_PLAIN = 20; // PAGE_PADDING_H

// Clean font for title/date
const CLEAN_FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif";
// Emoji-capable font for body text
const EMOJI_FONT  = (base) =>
    base && base !== "inherit"
        ? `${base}, 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif`
        : "'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";

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

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function cssHex(hex, alpha = 1) {
  if (!hex || !hex.startsWith("#")) return `rgba(150,150,150,${alpha})`;
  const [r,g,b] = hexToRgb(hex);
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function drawTemplateBackground(ctx, tpl, pw, ph) {
  const decor       = tpl.uiDecor;
  const firstLineY  = FIRST_LINE_Y_MM * MM_TO_PX;
  const lineSpacing = LINE_SPACING_MM  * MM_TO_PX;
  const leftMargin  = LEFT_MARGIN_MM   * MM_TO_PX;
  const rightMargin = RIGHT_MARGIN_MM  * MM_TO_PX;
  const bgHex = (decor?.containerBg || "#fff").match(/#[0-9a-f]{3,6}/i)?.[0] || "#fff";
  ctx.fillStyle = bgHex; ctx.fillRect(0, 0, pw, ph);
  const key = tpl.label?.toLowerCase() || "";
  if (key.includes("rose")) {
    ctx.fillStyle="rgb(255,182,203)"; ctx.fillRect(0,0,pw,8*MM_TO_PX);
    ctx.fillStyle="rgb(255,105,145)"; ctx.fillRect(0,0,pw,3*MM_TO_PX);
    ctx.fillStyle="rgb(255,182,203)"; ctx.fillRect(0,ph-8*MM_TO_PX,pw,8*MM_TO_PX);
    ctx.fillStyle="rgb(255,105,145)"; ctx.fillRect(0,ph-3*MM_TO_PX,pw,3*MM_TO_PX);
  } else if (key.includes("ocean")) {
    ctx.fillStyle="rgb(3,169,244)"; ctx.fillRect(0,0,pw,10*MM_TO_PX);
    ctx.fillStyle="rgb(0,188,212)"; ctx.fillRect(0,3*MM_TO_PX,pw,4*MM_TO_PX);
    ctx.fillStyle="rgb(3,169,244)"; ctx.fillRect(0,ph-10*MM_TO_PX,pw,10*MM_TO_PX);
  } else if (key.includes("galaxy")) {
    ctx.fillStyle="rgb(22,33,62)"; ctx.fillRect(0,0,pw,ph);
    ctx.fillStyle="rgb(63,0,125)"; ctx.fillRect(0,0,pw,7*MM_TO_PX);
    ctx.fillStyle="rgb(63,0,125)"; ctx.fillRect(0,ph-7*MM_TO_PX,pw,7*MM_TO_PX);
  } else if (key.includes("forest")) {
    ctx.fillStyle="rgb(56,142,60)"; ctx.fillRect(0,0,pw,7*MM_TO_PX);
    ctx.fillStyle="rgb(56,142,60)"; ctx.fillRect(0,ph-7*MM_TO_PX,pw,7*MM_TO_PX);
  } else if (key.includes("pastel")) {
    const bands=[[252,228,236],[248,225,241],[243,229,245],[235,234,245],[232,234,246],[227,242,253]];
    const bh=ph/bands.length;
    bands.forEach(([r,g,b],i)=>{ ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fillRect(0,i*bh,pw,bh+1); });
  } else if (key.includes("scrapbook")) {
    ctx.fillStyle="rgb(253,246,236)"; ctx.fillRect(0,0,pw,ph);
  }
  ctx.strokeStyle = cssHex(decor?.lineColor || "#ccc", 0.5);
  ctx.lineWidth   = 0.35 * MM_TO_PX;
  for (let y = firstLineY; y < ph - lineSpacing; y += lineSpacing) {
    ctx.beginPath(); ctx.moveTo(leftMargin, y); ctx.lineTo(pw - rightMargin, y); ctx.stroke();
  }
}

// ── Compute photo position in canvas/PDF coordinates ─────────────────────────
//
// In the editor:
//   - photo.x / photo.y are in editor-page pixels (page width up to 780px)
//   - The writing area starts at: editorBodyTop = headerBandH + PAGE_PADDING_H
//     where PAGE_PADDING_H = 20, headerBandH = decor.headerSvgH (0 for plain, 36-44 for themed)
//
// In the canvas/PDF:
//   - The writing area starts at: canvasBodyTop = FIRST_LINE_Y_MM * MM_TO_PX (~155px on canvas)
//   - Horizontal scale = CANVAS_W / actualPageWidth
//
// Formula:
//   canvasX = photo.x * scaleX
//   canvasY = (photo.y - editorBodyTop) * scaleY + canvasBodyTop
//
// This maps "photo placed at y=50 in editor body" → correct y in canvas body.
//
function photoToCanvas(photo, editorBodyTop, actualPageWidthPx) {
  const scaleX       = CANVAS_W / actualPageWidthPx;
  const scaleY       = CANVAS_H / (actualPageWidthPx * (297 / 210)); // proportional
  const canvasBodyTop = FIRST_LINE_Y_MM * MM_TO_PX;

  // photo.y is from page top. editorBodyTop is where text starts.
  // Offset = how far photo is below the text start in editor.
  const photoOffsetInBody = photo.y - editorBodyTop;

  return {
    x: photo.x * scaleX,
    y: canvasBodyTop + photoOffsetInBody * scaleY,
    w: photo.w * scaleX,
    h: photo.h * scaleY,
  };
}

// Same but output in mm for jsPDF
function photoToMm(photo, editorBodyTop, actualPageWidthPx) {
  const scaleX        = PAGE_W_MM / actualPageWidthPx;
  const scaleY        = PAGE_H_MM / (actualPageWidthPx * (297 / 210));
  const pdfBodyTopMm  = FIRST_LINE_Y_MM;   // mm

  const photoOffsetInBody = photo.y - editorBodyTop;

  return {
    x: photo.x * scaleX,
    y: pdfBodyTopMm + photoOffsetInBody * scaleY,
    w: photo.w * scaleX,
    h: photo.h * scaleY,
  };
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

  // ── Ensure the handwriting font is fully loaded before measuring/drawing ──
  // Without this, ctx.measureText() uses fallback font metrics → wrong line wrapping
  const bodyFontFamily = fontDef.editorFamily;
  if (bodyFontFamily && bodyFontFamily !== "inherit") {
    try {
      await document.fonts.load(`${Math.round(BODY_FONT_SIZE_PT * (96/72))}px ${bodyFontFamily}`);
    } catch (e) { /* font load failed, continue with fallback */ }
  }

  const pw = CANVAS_W, ph = CANVAS_H;
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

  // Title — clean font
  ctx.fillStyle = cssHex(tpl.pdfTitleColor || "#202124");
  ctx.font      = `bold ${titleFontPx}px ${CLEAN_FONT}`;
  ctx.fillText(selectedFile?.name || "Diary Entry", leftMargin, titleY);

  // Date + page number — clean font
  ctx.font        = `${dateFontPx}px ${CLEAN_FONT}`;
  ctx.fillStyle   = cssHex(tpl.pdfTextColor || "#555555");
  ctx.globalAlpha = 0.55;
  ctx.fillText(new Date(selectedFile?.createdAt || Date.now()).toDateString(), leftMargin, dateY);
  ctx.textAlign   = "right";
  ctx.fillText(`Page ${pageIndex + 1} of ${totalPages}`, pw - rightMargin, dateY);
  ctx.textAlign   = "left";
  ctx.globalAlpha = 1;

  // Separator
  ctx.strokeStyle = cssHex(tpl.pdfTitleColor || "#202124");
  ctx.lineWidth   = 0.4 * MM_TO_PX;
  ctx.beginPath(); ctx.moveTo(leftMargin, sepY); ctx.lineTo(pw - rightMargin, sepY); ctx.stroke();

  // "inherit" is meaningless on canvas — map it to the same system font the browser uses
  const CANVAS_DEFAULT_FONT = "-apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif";
  const resolvedFamily = (!bodyFontFamily || bodyFontFamily === "inherit")
      ? CANVAS_DEFAULT_FONT
      : bodyFontFamily;

  // Body text — measure and draw with the resolved concrete font
  const measureFontSpec = `${bodyFontPx}px ${resolvedFamily}`;
  const bodyFontSpec    = `${bodyFontPx}px ${EMOJI_FONT(resolvedFamily)}`;
  const textWidthPx     = pw - leftMargin - rightMargin;
  // Measure with exact font so line wrap points match the editor
  ctx.font = measureFontSpec;
  const wrappedLines = wrapWords(ctx, rawText, textWidthPx, measureFontSpec);
  // Draw with emoji stack so emoji glyphs render correctly
  ctx.font      = bodyFontSpec;
  ctx.fillStyle = cssHex(tpl.pdfTextColor || "#202124");
  wrappedLines.slice(0, MAX_LINES_PER_PAGE).forEach((line, i) => {
    ctx.fillText(line, leftMargin, firstLineY + i * lineSpacing);
  });

  // ── Photos — position adjusted for canvas header ──────────────────────────
  // editorBodyTop = where the textarea starts in editor page pixels
  // = headerBandH (template SVG header) + PAGE_PADDING_H (20px)
  const PAGE_PADDING_H  = 20;
  const editorHeaderH   = tpl.uiDecor?.headerSvgH || 0;
  const editorBodyTop   = editorHeaderH + PAGE_PADDING_H;
  // actual editor page width (photos are stored at up to 780px width)
  const actualPageW     = EDITOR_PAGE_W;

  for (const photo of (page?.photos || [])) {
    try {
      const img = await loadImg(photo.src);
      const { x, y, w, h } = photoToCanvas(photo, editorBodyTop, actualPageW);
      ctx.save();
      // Rotate around photo centre
      ctx.translate(x + w / 2, y + h / 2);
      if (photo.rotation) ctx.rotate((photo.rotation * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    } catch (e) { console.warn("Photo render failed:", e.message); }
  }

  return canvas;
}

export default function PdfPreview({ selectedFile, pages, onClose }) {
  const [previewImgs,     setPreviewImgs]     = useState([]);
  const [rendering,       setRendering]       = useState(true);
  const [previewPage,     setPreviewPage]     = useState(0);
  const [downloading,     setDownloading]     = useState(false);
  const [dlFormat,        setDlFormat]        = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);

  useEffect(() => {
    (async () => {
      setRendering(true);
      const imgs = [];
      for (let i = 0; i < pages.length; i++) {
        const c = await renderPageToCanvas(pages[i], selectedFile, i, pages.length);
        imgs.push(c.toDataURL("image/png"));
      }
      setPreviewImgs(imgs);
      setRendering(false);
    })();
  }, [pages, selectedFile]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const pdfdoc = new jsPDF({ unit:"mm", format:"a4", compress:true });
      const pw = pdfdoc.internal.pageSize.getWidth();
      const ph = pdfdoc.internal.pageSize.getHeight();
      for (let i = 0; i < pages.length; i++) {
        if (i !== 0) pdfdoc.addPage();
        const canvas  = await renderPageToCanvas(pages[i], selectedFile, i, pages.length);
        pdfdoc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pw, ph);
      }
      const safeName = (selectedFile?.name || "diary").replace(/[^a-z0-9_-]/gi, "_");
      pdfdoc.save(`${safeName}.pdf`);
    } catch (e) {
      console.error("PDF failed:", e);
      alert("PDF download failed. Please try again.");
    } finally { setDownloading(false); setDlFormat(null); }
  };

  const downloadImage = async () => {
    setDownloading(true);
    try {
      const canvases = [];
      for (let i = 0; i < pages.length; i++)
        canvases.push(await renderPageToCanvas(pages[i], selectedFile, i, pages.length));
      const combined     = document.createElement("canvas");
      combined.width     = CANVAS_W;
      combined.height    = CANVAS_H * canvases.length;
      const ctx = combined.getContext("2d");
      canvases.forEach((c, i) => ctx.drawImage(c, 0, i * CANVAS_H));
      const a   = document.createElement("a");
      a.href     = combined.toDataURL("image/png");
      a.download = `${(selectedFile?.name || "diary").replace(/[^a-z0-9_-]/gi, "_")}.png`;
      a.click();
    } finally { setDownloading(false); setDlFormat(null); }
  };

  const pageImg       = previewImgs[previewPage];
  const firstPageText = typeof pages[0] === "string" ? pages[0] : (pages[0]?.data ?? "");
  const curPhotos     = pages[previewPage]?.photos || [];

  return (
      <div style={st.backdrop}>
        <div style={st.modal}>
          <div style={st.header}>
            <span style={st.headerTitle}>Preview & Export</span>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <button style={st.btnShare} onClick={() => setShowShareDialog(true)}>↗ Share</button>
              <div style={{ position:"relative" }}>
                <button style={{ ...st.btnPrimary, opacity:downloading?0.7:1 }}
                        onClick={() => setDlFormat((v) => v ? null : "menu")} disabled={downloading}>
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
            <div style={st.previewPanel}>
              <div style={st.pageWrapper}>
                {rendering ? (
                    <div style={st.loadingBox}><div style={{ fontSize:24, marginBottom:8 }}>⏳</div><div>Rendering preview…</div></div>
                ) : pageImg ? (
                    <img src={pageImg} alt="page" style={{ width:"100%", borderRadius:4, display:"block", boxShadow:"0 4px 20px rgba(0,0,0,0.15)" }} draggable={false} />
                ) : (
                    <div style={st.loadingBox}>Nothing to preview yet.</div>
                )}
              </div>
              {pages.length > 1 && (
                  <div style={st.pageNav}>
                    <button style={st.navBtn} disabled={previewPage===0} onClick={() => setPreviewPage((p) => p-1)}>← Prev</button>
                    <span style={{ fontSize:12, color:"#5f6368" }}>Page {previewPage+1} / {pages.length}</span>
                    <button style={st.navBtn} disabled={previewPage>=pages.length-1} onClick={() => setPreviewPage((p) => p+1)}>Next →</button>
                  </div>
              )}
              {curPhotos.length > 0 && (
                  <div style={st.photoList}>
                    <div style={st.photoListTitle}>Photos on page {previewPage+1}</div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      {curPhotos.map((p) => (
                          <img key={p.id} src={p.src} alt="photo" style={{ width:52, height:52, objectFit:"cover", borderRadius:6, border:"1px solid #e0e0e0" }} />
                      ))}
                    </div>
                  </div>
              )}
            </div>
          </div>
        </div>

        {showShareDialog && (
            <ShareDialog title={selectedFile?.name||"Diary Entry"} text={firstPageText} imageUrl={previewImgs[0]} allPageUrls={previewImgs} onClose={() => setShowShareDialog(false)} />
        )}
      </div>
  );
}

const st = {
  backdrop:      { position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:600, display:"flex", alignItems:"stretch", justifyContent:"center" },
  modal:         { background:"#fff", width:"100%", maxWidth:860, margin:"20px auto", borderRadius:14, display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 16px 60px rgba(0,0,0,0.25)" },
  header:        { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", borderBottom:"1px solid #e8eaed", flexShrink:0 },
  headerTitle:   { fontSize:16, fontWeight:700, color:"#202124" },
  btnPrimary:    { padding:"8px 16px", background:"#1a73e8", color:"#fff", border:"none", borderRadius:7, cursor:"pointer", fontSize:13, fontWeight:500 },
  btnShare:      { padding:"7px 14px", background:"#fff", color:"#1a73e8", border:"1px solid #c5d8fb", borderRadius:7, cursor:"pointer", fontSize:13, fontWeight:500 },
  btnClose:      { width:32, height:32, border:"none", background:"#f1f3f4", borderRadius:"50%", cursor:"pointer", fontSize:16, color:"#5f6368", display:"flex", alignItems:"center", justifyContent:"center" },
  dlMenu:        { position:"absolute", top:"calc(100% + 6px)", right:0, background:"#fff", border:"1px solid #e0e0e0", borderRadius:8, boxShadow:"0 4px 16px rgba(0,0,0,0.1)", minWidth:210, zIndex:10, overflow:"hidden" },
  dlItem:        { display:"block", width:"100%", padding:"11px 16px", border:"none", background:"transparent", textAlign:"left", fontSize:13, cursor:"pointer", color:"#202124" },
  body:          { display:"flex", flex:1, overflow:"hidden" },
  previewPanel:  { flex:1, display:"flex", flexDirection:"column", background:"#f8f9fa", overflow:"hidden", padding:20, gap:12 },
  pageWrapper:   { flex:1, overflow:"auto", display:"flex", justifyContent:"center", alignItems:"flex-start" },
  loadingBox:    { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:200, color:"#80868b", fontSize:14 },
  pageNav:       { display:"flex", alignItems:"center", justifyContent:"center", gap:12, flexShrink:0 },
  navBtn:        { padding:"5px 12px", border:"1px solid #dadce0", background:"#fff", borderRadius:6, cursor:"pointer", fontSize:12, color:"#3c4043" },
  photoList:     { borderTop:"1px solid #e8eaed", paddingTop:10, flexShrink:0 },
  photoListTitle:{ fontSize:11, fontWeight:600, color:"#80868b", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.04em" },
};