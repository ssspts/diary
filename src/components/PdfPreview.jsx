// src/components/PdfPreview.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import jsPDF from "jspdf";
import { TEMPLATES, HANDWRITING_FONTS, loadFontIntoDoc } from "../utils/templates";
import ShareDialog from "./ShareDialog";
import {
  CANVAS, CANVAS_W, CANVAS_H, MM_TO_PX,
  wrapWords, MAX_LINES_PER_PAGE,
  HEADER_H_MM, DATE_Y_MM, TITLE_Y_MM, HEADER_LINE_Y,
  FIRST_LINE_Y_MM, LINE_SPACING_MM, LEFT_MARGIN_MM, RIGHT_MARGIN_MM,
  TEXT_WIDTH_MM, BODY_FONT_SIZE_PT, FOOTER_H_MM,
} from "../utils/pageSpec";

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

// ── Canvas renderer — pixel-accurate mirror of exportPdf.js ─────────────────
// All sizes are derived from pageSpec mm constants converted to px via MM_TO_PX.
// Font sizes match the PDF: 13pt title, 8pt date, 11pt body (1pt = 96/72 px).
// Template decorations use the same pdfDrawBackground colour logic translated
// to Canvas 2D — no uiDecor SVG bands (those are browser-only chrome).
const PT_TO_PX = 96 / 72;  // 1 CSS px = 72/96 pt, so 1pt = 96/72 px ≈ 1.333

function hexToRgb(hex) {
  const h = hex.replace("#","");
  if (h.length === 3) {
    return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
  }
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

// Translate a CSS hex colour to canvas fillStyle, with optional alpha
function cssHex(hex, alpha = 1) {
  if (!hex || !hex.startsWith("#")) return `rgba(150,150,150,${alpha})`;
  const [r,g,b] = hexToRgb(hex);
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

// Draw template background decorations onto the canvas.
// This reproduces what pdfDrawBackground does, but using Canvas 2D calls.
// We keep it simple: fill background, draw the main colour bands, draw ruled lines.
// Detailed decorations (rose circles, sunflower petals, stars) are drawn via the
// same pixel maths as the PDF — scaled by MM_TO_PX.
function drawTemplateBackground(ctx, tpl, pw, ph) {
  const decor  = tpl.uiDecor;
  const layout = {
    firstLineY:  FIRST_LINE_Y_MM * MM_TO_PX,
    lineSpacing: LINE_SPACING_MM  * MM_TO_PX,
    leftMargin:  LEFT_MARGIN_MM   * MM_TO_PX,
    rightMargin: RIGHT_MARGIN_MM  * MM_TO_PX,
  };

  // 1. Page background
  const bg = decor?.containerBg || "#fff";
  const bgHex = bg.match(/#[0-9a-f]{3,6}/i)?.[0] || "#fff";
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, pw, ph);

  // 2. Template-specific bands — mirror the PDF mm values scaled to px
  const key = tpl.label?.toLowerCase() || "";

  if (key.includes("rose")) {
    // Top band
    ctx.fillStyle = "rgb(255,182,203)"; ctx.fillRect(0, 0, pw, 8*MM_TO_PX);
    ctx.fillStyle = "rgb(255,105,145)"; ctx.fillRect(0, 0, pw, 3*MM_TO_PX);
    ctx.fillStyle = "rgb(255,182,203)"; ctx.fillRect(0, ph-8*MM_TO_PX, pw, 8*MM_TO_PX);
    ctx.fillStyle = "rgb(255,105,145)"; ctx.fillRect(0, ph-3*MM_TO_PX, pw, 3*MM_TO_PX);
    // Roses at corners (simplified circles)
    const rose = (x,y) => {
      const r = 5*MM_TO_PX;
      ctx.fillStyle="rgb(255,105,145)"; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgb(255,182,203)"; ctx.beginPath(); ctx.arc(x-4*MM_TO_PX,y+2*MM_TO_PX,3*MM_TO_PX,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgb(255,182,203)"; ctx.beginPath(); ctx.arc(x+4*MM_TO_PX,y+2*MM_TO_PX,3*MM_TO_PX,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgb(255,182,203)"; ctx.beginPath(); ctx.arc(x,y-4*MM_TO_PX,3*MM_TO_PX,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgb(220,80,120)";  ctx.beginPath(); ctx.arc(x,y,2*MM_TO_PX,0,Math.PI*2); ctx.fill();
    };
    rose(14*MM_TO_PX,14*MM_TO_PX); rose(pw-14*MM_TO_PX,14*MM_TO_PX);
    rose(14*MM_TO_PX,ph-14*MM_TO_PX); rose(pw-14*MM_TO_PX,ph-14*MM_TO_PX);

  } else if (key.includes("sunflower")) {
    ctx.fillStyle="rgb(255,214,0)";  ctx.fillRect(0,0,pw,6*MM_TO_PX);
    ctx.fillStyle="rgb(255,165,0)";  ctx.fillRect(0,0,pw,2.5*MM_TO_PX);
    ctx.fillStyle="rgb(255,214,0)";  ctx.fillRect(0,ph-6*MM_TO_PX,pw,6*MM_TO_PX);
    ctx.fillStyle="rgb(255,165,0)";  ctx.fillRect(0,ph-2.5*MM_TO_PX,pw,2.5*MM_TO_PX);
    ctx.fillStyle="rgb(255,236,153)";ctx.fillRect(0,0,14*MM_TO_PX,ph);
    ctx.strokeStyle="rgb(255,180,0)"; ctx.lineWidth=0.5*MM_TO_PX;
    ctx.beginPath(); ctx.moveTo(14*MM_TO_PX,0); ctx.lineTo(14*MM_TO_PX,ph); ctx.stroke();
    // Sunflower corners (simplified)
    const sun = (cx,cy,r) => {
      ctx.fillStyle="rgb(255,165,0)";
      for (let a=0;a<360;a+=45) {
        const rad=a*Math.PI/180;
        ctx.beginPath(); ctx.arc(cx+Math.cos(rad)*r*1.6,cy+Math.sin(rad)*r*1.6,r*0.55,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle="rgb(139,90,0)";  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgb(101,60,0)";  ctx.beginPath(); ctx.arc(cx,cy,r*0.55,0,Math.PI*2); ctx.fill();
    };
    const r=4*MM_TO_PX;
    sun(7*MM_TO_PX,14*MM_TO_PX,r); sun(pw-12*MM_TO_PX,14*MM_TO_PX,r);
    sun(7*MM_TO_PX,ph-14*MM_TO_PX,r); sun(pw-12*MM_TO_PX,ph-14*MM_TO_PX,r);

  } else if (key.includes("ocean")) {
    ctx.fillStyle="rgb(3,169,244)";  ctx.fillRect(0,0,pw,10*MM_TO_PX);
    ctx.fillStyle="rgb(0,188,212)";  ctx.fillRect(0,3*MM_TO_PX,pw,4*MM_TO_PX);
    ctx.fillStyle="rgb(2,136,209)";  ctx.fillRect(0,0,pw,2*MM_TO_PX);
    ctx.fillStyle="rgb(3,169,244)";  ctx.fillRect(0,ph-10*MM_TO_PX,pw,10*MM_TO_PX);
    ctx.fillStyle="rgb(0,188,212)";  ctx.fillRect(0,ph-7*MM_TO_PX,pw,4*MM_TO_PX);
    [[12,12],[pw/MM_TO_PX-12,12],[12,ph/MM_TO_PX-12],[pw/MM_TO_PX-12,ph/MM_TO_PX-12]].forEach(([x,y])=>{
      const xp=x*MM_TO_PX, yp=y*MM_TO_PX;
      ctx.fillStyle="rgb(179,229,252)"; ctx.beginPath(); ctx.arc(xp,yp,5*MM_TO_PX,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgb(3,169,244)";   ctx.beginPath(); ctx.arc(xp,yp,3*MM_TO_PX,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgb(179,229,252)"; ctx.beginPath(); ctx.arc(xp-MM_TO_PX,yp-MM_TO_PX,MM_TO_PX,0,Math.PI*2); ctx.fill();
    });

  } else if (key.includes("forest")) {
    ctx.fillStyle="rgb(56,142,60)";  ctx.fillRect(0,0,pw,7*MM_TO_PX);
    ctx.fillStyle="rgb(27,94,32)";   ctx.fillRect(0,0,pw,2.5*MM_TO_PX);
    ctx.fillStyle="rgb(56,142,60)";  ctx.fillRect(0,ph-7*MM_TO_PX,pw,7*MM_TO_PX);
    ctx.fillStyle="rgb(27,94,32)";   ctx.fillRect(0,ph-2.5*MM_TO_PX,pw,2.5*MM_TO_PX);
    const leaf=(x,y)=>{
      ctx.fillStyle="rgb(56,142,60)";   ctx.beginPath(); ctx.arc(x,y,4*MM_TO_PX,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgb(27,94,32)";    ctx.beginPath(); ctx.arc(x+3*MM_TO_PX,y-3*MM_TO_PX,2.5*MM_TO_PX,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="rgb(129,199,132)"; ctx.beginPath(); ctx.arc(x-2*MM_TO_PX,y-2*MM_TO_PX,1.8*MM_TO_PX,0,Math.PI*2); ctx.fill();
    };
    leaf(14*MM_TO_PX,14*MM_TO_PX); leaf(pw-14*MM_TO_PX,14*MM_TO_PX);
    leaf(14*MM_TO_PX,ph-14*MM_TO_PX); leaf(pw-14*MM_TO_PX,ph-14*MM_TO_PX);

  } else if (key.includes("galaxy")) {
    ctx.fillStyle="rgb(22,33,62)";   ctx.fillRect(0,0,pw,ph);
    ctx.fillStyle="rgb(63,0,125)";   ctx.fillRect(0,0,pw,7*MM_TO_PX);
    ctx.fillStyle="rgb(123,31,162)"; ctx.fillRect(0,0,pw,3*MM_TO_PX);
    ctx.fillStyle="rgb(63,0,125)";   ctx.fillRect(0,ph-7*MM_TO_PX,pw,7*MM_TO_PX);
    ctx.fillStyle="rgb(123,31,162)"; ctx.fillRect(0,ph-3*MM_TO_PX,pw,3*MM_TO_PX);
    ctx.fillStyle="rgb(255,255,255)";
    [[20,20],[50,35],[90,18],[130,40],[170,22],[pw/MM_TO_PX-20,20],[pw/MM_TO_PX-50,35],
     [20,ph/MM_TO_PX-20],[50,ph/MM_TO_PX-35],[pw/MM_TO_PX-20,ph/MM_TO_PX-20],
     [30,80],[70,65],[110,90],[150,70],[pw/MM_TO_PX-30,80]
    ].forEach(([x,y])=>{ ctx.beginPath(); ctx.arc(x*MM_TO_PX,y*MM_TO_PX,0.6*MM_TO_PX,0,Math.PI*2); ctx.fill(); });
    ctx.fillStyle="rgb(200,180,255)";
    [[pw/MM_TO_PX/2,25],[pw/MM_TO_PX/4,ph/MM_TO_PX/2]].forEach(([x,y])=>{
      ctx.beginPath(); ctx.arc(x*MM_TO_PX,y*MM_TO_PX,1.2*MM_TO_PX,0,Math.PI*2); ctx.fill();
    });

  } else if (key.includes("scrapbook")) {
    ctx.fillStyle="rgb(253,246,236)"; ctx.fillRect(0,0,pw,ph);
    ctx.strokeStyle="rgb(240,224,200)"; ctx.lineWidth=0.2*MM_TO_PX;
    for(let x=0;x<pw;x+=10*MM_TO_PX){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,ph); ctx.stroke(); }
    for(let y=0;y<ph;y+=10*MM_TO_PX){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(pw,y); ctx.stroke(); }
    const tape=(x,y,w,h,r,g,b)=>{ ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fillRect(x,y,w,h); };
    tape(8*MM_TO_PX,8*MM_TO_PX,20*MM_TO_PX,8*MM_TO_PX,255,230,100);
    tape(pw-28*MM_TO_PX,8*MM_TO_PX,20*MM_TO_PX,8*MM_TO_PX,180,230,255);
    tape(8*MM_TO_PX,ph-16*MM_TO_PX,20*MM_TO_PX,8*MM_TO_PX,255,180,180);
    tape(pw-28*MM_TO_PX,ph-16*MM_TO_PX,20*MM_TO_PX,8*MM_TO_PX,200,255,200);
    ctx.strokeStyle="rgb(180,140,100)"; ctx.lineWidth=MM_TO_PX;
    ctx.strokeRect(12*MM_TO_PX,12*MM_TO_PX,pw-24*MM_TO_PX,ph-24*MM_TO_PX);

  } else if (key.includes("pastel")) {
    const bands=[[252,228,236],[248,225,241],[243,229,245],[235,234,245],[232,234,246],[227,242,253]];
    const bh=ph/bands.length;
    bands.forEach(([r,g,b],i)=>{ ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fillRect(0,i*bh,pw,bh+1); });
    ctx.fillStyle="rgba(255,255,255,0.6)";
    for(let x=10*MM_TO_PX;x<pw;x+=15*MM_TO_PX) for(let y=10*MM_TO_PX;y<ph;y+=15*MM_TO_PX){
      ctx.beginPath(); ctx.arc(x,y,1.2*MM_TO_PX,0,Math.PI*2); ctx.fill();
    }
    const rainbow=[[255,138,128],[255,190,100],[255,238,88],[149,221,128],[100,200,255],[200,150,255]];
    const sw=pw/rainbow.length;
    rainbow.forEach(([r,g,b],i)=>{ ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fillRect(i*sw,0,sw,5*MM_TO_PX); });
    [...rainbow].reverse().forEach(([r,g,b],i)=>{ ctx.fillStyle=`rgb(${r},${g},${b})`; ctx.fillRect(i*sw,ph-5*MM_TO_PX,sw,5*MM_TO_PX); });
  }

  // 3. Ruled lines — match PDF exactly (firstLineY onwards, lineSpacing apart)
  ctx.strokeStyle = cssHex(decor?.lineColor || tpl.pdfTitleColor || "#ccc", 0.5);
  ctx.lineWidth   = 0.35 * MM_TO_PX;
  for (let y = layout.firstLineY; y < ph - layout.lineSpacing; y += layout.lineSpacing) {
    ctx.beginPath(); ctx.moveTo(layout.leftMargin, y); ctx.lineTo(pw - layout.rightMargin, y); ctx.stroke();
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

  // ── All positions derived from mm → px, matching exportPdf.js exactly ──
  const titleY     = TITLE_Y_MM     * MM_TO_PX;   // ~75px
  const dateY      = DATE_Y_MM      * MM_TO_PX;   // ~105px
  const sepY       = HEADER_LINE_Y  * MM_TO_PX;   // ~121px
  const firstLineY = FIRST_LINE_Y_MM* MM_TO_PX;   // ~155px
  const lineSpacing= LINE_SPACING_MM * MM_TO_PX;  // ~28px
  const leftMargin = LEFT_MARGIN_MM  * MM_TO_PX;  // ~68px
  const rightMargin= RIGHT_MARGIN_MM * MM_TO_PX;  // ~53px

  // Font sizes: PDF pt → screen px  (1pt = 96/72 px)
  const titleFontPx= Math.round(13 * PT_TO_PX);   // 13pt → ~17px
  const dateFontPx = Math.round(8  * PT_TO_PX);   // 8pt  → ~11px
  const bodyFontPx = Math.round(BODY_FONT_SIZE_PT * PT_TO_PX); // 11pt → ~15px

  // ── 1. Template background + decorations + ruled lines ──────────────────
  drawTemplateBackground(ctx, tpl, pw, ph);

  // ── 2. Title (bold, 13pt) ────────────────────────────────────────────────
  ctx.fillStyle = cssHex(tpl.pdfTitleColor || "#202124");
  ctx.font      = `bold ${titleFontPx}px -apple-system, Helvetica, sans-serif`;
  ctx.fillText(selectedFile?.name || "Diary Entry", leftMargin, titleY);

  // ── 3. Date + page number (8pt, dimmed) ─────────────────────────────────
  ctx.font        = `${dateFontPx}px -apple-system, Helvetica, sans-serif`;
  ctx.fillStyle   = cssHex(tpl.pdfTextColor || "#555555");
  ctx.globalAlpha = 0.55;
  ctx.fillText(new Date(selectedFile?.createdAt).toDateString(), leftMargin, dateY);
  ctx.textAlign   = "right";
  ctx.fillText(`Page ${pageIndex + 1} of ${totalPages}`, pw - rightMargin, dateY);
  ctx.textAlign   = "left";
  ctx.globalAlpha = 1;

  // ── 4. Separator line ────────────────────────────────────────────────────
  ctx.strokeStyle = cssHex(tpl.pdfTitleColor || "#202124");
  ctx.lineWidth   = 0.4 * MM_TO_PX;
  ctx.beginPath(); ctx.moveTo(leftMargin, sepY); ctx.lineTo(pw - rightMargin, sepY); ctx.stroke();

  // ── 5. Body text (11pt, chosen handwriting font if loaded) ──────────────
  const bodyFamily = fontDef.editorFamily !== "inherit"
    ? fontDef.editorFamily + ", -apple-system, sans-serif"
    : "-apple-system, Helvetica, sans-serif";
  const fontSpec = `${bodyFontPx}px ${bodyFamily}`;
  ctx.font      = fontSpec;
  ctx.fillStyle = cssHex(tpl.pdfTextColor || "#202124");

  const textWidthPx = pw - leftMargin - rightMargin;
  const wrappedLines = wrapWords(ctx, rawText, textWidthPx, fontSpec);
  wrappedLines.slice(0, MAX_LINES_PER_PAGE).forEach((line, i) => {
    ctx.fillText(line, leftMargin, firstLineY + i * lineSpacing);
  });

  return canvas;
}

// Flatten overlays onto a canvas.
// Sticker x/y/size are stored in editor "pageWidth" coords (max 780px logical width).
// The canvas is CANVAS_W (794px) wide, so we scale by CANVAS_W / 780.
const EDITOR_PAGE_W = 780;
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

export default function PdfPreview({ selectedFile, pages, onClose }) {
  const [baseCanvases, setBaseCanvases] = useState([]);  // raw page canvases (no overlays)
  const [previewImgs, setPreviewImgs]   = useState([]);  // dataURLs with overlays composited
  const [rendering, setRendering]       = useState(true);
  const [previewPage, setPreviewPage]   = useState(0);
  // Overlays are seeded from pages[i].overlays (stickers added in Editor)
  // Preview-only additions (if any) are merged on top in local state.
  const [downloading, setDownloading]   = useState(false);
  const [dlFormat, setDlFormat]         = useState(null);     // "pdf" | "image" | null
  const [showShareDialog, setShowShareDialog] = useState(false);

  const pageRef = useRef(null);

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
        // Merge: editor overlays (pages[i].overlays) + preview-added overlays
        const editorOvs  = pages[i]?.overlays || [];
        const previewOvs = overlays[i] || [];
        // deduplicate by id: editor overlays take precedence
        const editorIds  = new Set(editorOvs.map((o) => o.id));
        const merged     = [...editorOvs, ...previewOvs.filter((o) => !editorIds.has(o.id))];
        const out = await flattenPageCanvas(baseCanvases[i], merged);
        imgs.push(out.toDataURL("image/png"));
      }
      setPreviewImgs(imgs);
    })();
  }, [baseCanvases, overlays, pages]);

  // ── (overlays removed) ──

  // ── (drag removed) ──

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

        // Overlays — merge editor overlays + preview-only overlays
        const editorOvs2  = pages[index]?.overlays || [];
        const previewOvs2 = overlays[index] || [];
        const editorIds2  = new Set(editorOvs2.map((o) => o.id));
        const allOvs      = [...editorOvs2, ...previewOvs2.filter((o) => !editorIds2.has(o.id))];

        // Sticker coords are stored in editor pageWidth (780px) units.
        // Convert to mm for jsPDF: (coord_px / 780) * PAGE_W_MM
        const PAGE_W_MM_PDF = 210;
        const coordToMm = (px) => (px / EDITOR_PAGE_W) * PAGE_W_MM_PDF;

        for (const ov of allOvs) {
          try {
            const imgEl  = await loadImg(ov.src);
            const szPx   = Math.round(ov.size);
            const c      = document.createElement("canvas");
            c.width = c.height = szPx;
            const cx = c.getContext("2d");
            if (ov.rotation) {
              cx.translate(szPx/2, szPx/2);
              cx.rotate((ov.rotation * Math.PI) / 180);
              cx.drawImage(imgEl, -szPx/2, -szPx/2, szPx, szPx);
            } else {
              cx.drawImage(imgEl, 0, 0, szPx, szPx);
            }
            // x, y, w, h all in mm
            pdfdoc.addImage(c.toDataURL("image/png"), "PNG",
              coordToMm(ov.x), coordToMm(ov.y),
              coordToMm(ov.size), coordToMm(ov.size));
          } catch (e) { console.warn("PDF overlay failed:", e.message); }
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
      for (let i = 0; i < baseCanvases.length; i++) {
        const editorOvs3  = pages[i]?.overlays || [];
        const previewOvs3 = overlays[i] || [];
        const editorIds3  = new Set(editorOvs3.map((o) => o.id));
        const merged3     = [...editorOvs3, ...previewOvs3.filter((o) => !editorIds3.has(o.id))];
        flatCanvases.push(await flattenPageCanvas(baseCanvases[i], merged3));
      }

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

  const pageImg     = previewImgs[previewPage];
  const firstPageText = typeof pages[0] === "string" ? pages[0] : (pages[0]?.data ?? "");

  return (
    <div
      style={st.backdrop}
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
