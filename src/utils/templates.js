// src/utils/templates.js

// ── Handwriting font catalogue ────────────────────────────────────────────────
export const HANDWRITING_FONTS = {
  default:      { label:"Default",      googleFamily:null,                    pdfFont:"helvetica",    editorFamily:"inherit",                  emoji:"Aa", ttfUrl:null },
  dancingScript:{ label:"Dancing Script",googleFamily:"Dancing+Script:wght@400",pdfFont:"DancingScript", editorFamily:"'Dancing Script', cursive",  emoji:"𝒟", ttfUrl:"https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3ROp6.ttf" },
  pacifico:     { label:"Pacifico",      googleFamily:"Pacifico",              pdfFont:"Pacifico",      editorFamily:"'Pacifico', cursive",         emoji:"𝒫", ttfUrl:"https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6MmBp0u-.ttf" },
  caveat:       { label:"Caveat",        googleFamily:"Caveat:wght@400",       pdfFont:"Caveat",        editorFamily:"'Caveat', cursive",           emoji:"✍", ttfUrl:"https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfB9SIWpZA.ttf" },
  kalam:        { label:"Kalam",         googleFamily:"Kalam:wght@400",        pdfFont:"Kalam",         editorFamily:"'Kalam', cursive",            emoji:"✒", ttfUrl:"https://fonts.gstatic.com/s/kalam/v16/YA9dr0Wd4kDdMuhROCXXsA.ttf" },
  patrickHand:  { label:"Patrick Hand",  googleFamily:"Patrick+Hand",          pdfFont:"PatrickHand",   editorFamily:"'Patrick Hand', cursive",     emoji:"🖊", ttfUrl:"https://fonts.gstatic.com/s/patrickhand/v20/LDI1apSQOAYtSuYWp8ZhfYe8XsLL.ttf" },
  indieFlower:  { label:"Indie Flower",  googleFamily:"Indie+Flower",          pdfFont:"IndieFlower",   editorFamily:"'Indie Flower', cursive",     emoji:"🌸", ttfUrl:"https://fonts.gstatic.com/s/indieflower/v21/m8JVjfNVeKWVnh3QMuKkFcZlbkGG1dKEDw.ttf" },
  satisfy:      { label:"Satisfy",       googleFamily:"Satisfy",               pdfFont:"Satisfy",       editorFamily:"'Satisfy', cursive",          emoji:"✨", ttfUrl:"https://fonts.gstatic.com/s/satisfy/v21/rP2Hp2yn6lkG50LoOZSCHBeHFl0.ttf" },
};

export const FONT_KEYS = Object.keys(HANDWRITING_FONTS);

const _bufferCache = {};
export async function loadFontIntoDoc(doc, fontKey) {
  const def = HANDWRITING_FONTS[fontKey];
  if (!def || !def.ttfUrl) return false;
  if (!_bufferCache[fontKey]) {
    const res = await fetch(def.ttfUrl);
    if (!res.ok) throw new Error(`Failed to fetch font: ${def.ttfUrl}`);
    _bufferCache[fontKey] = await res.arrayBuffer();
  }
  const uint8 = new Uint8Array(_bufferCache[fontKey]);
  let binary = "";
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
  const base64 = btoa(binary);
  const fileName = `${def.pdfFont}.ttf`;
  doc.addFileToVFS(fileName, base64);
  doc.addFont(fileName, def.pdfFont, "normal");
  return true;
}

// ── Layout contract (PDF) ─────────────────────────────────────────────────────
const DEFAULT_LAYOUT = { firstLineY:42, lineSpacing:8, leftMargin:18, rightMargin:14, fontSize:11 };

// ── uiDecor contract (Browser UI) ────────────────────────────────────────────
// Each template exposes a `uiDecor` object that the Editor renders as pure CSS/SVG.
// Shape: {
//   // Whole editor container
//   containerBg        : CSS background string
//   containerBorder    : CSS border string (wraps entire editor)
//   // Toolbar  (header band)
//   headerBg           : CSS background for the toolbar area
//   headerBorderBottom : CSS border-bottom for toolbar
//   headerSvg          : SVG string injected into an absolutely-positioned overlay
//                        inside the toolbar (full-width, fixed height px)
//   headerSvgH         : height px of the SVG overlay
//   // Textarea writing area
//   textareaBg         : CSS background (can include repeating-linear-gradient for lines)
//   textareaColor      : CSS color for text
//   textareaBorderLeft : optional left margin stripe CSS
//   lineColor          : CSS color of the ruled lines (used in gradient)
//   lineSpacingPx      : px between ruled lines in the editor (= lineHeight of textarea)
//   // Footer band (pagination)
//   footerBg           : CSS background for pagination row
//   footerBorderTop    : CSS border-top for pagination row
//   footerSvg          : SVG string for footer overlay (full-width, fixed height)
//   footerSvgH         : height px of the footer SVG overlay
//   // Corner SVGs — absolutely positioned at each corner of the whole editor
//   cornerSvg          : SVG string for one corner (rotated for each corner)
//   cornerSize         : px size of corner SVG
//   // Button theming
//   btnBg              : background for action buttons (save, preview, etc.)
//   btnColor           : text color for action buttons
// }

// ── Helpers for building SVG decorations ─────────────────────────────────────
const rose = (x, y, s = 1) => `
  <circle cx="${x}" cy="${y}" r="${5*s}" fill="#ff6991"/>
  <circle cx="${x-4*s}" cy="${y+2*s}" r="${3*s}" fill="#ffb6cb"/>
  <circle cx="${x+4*s}" cy="${y+2*s}" r="${3*s}" fill="#ffb6cb"/>
  <circle cx="${x}" cy="${y-4*s}" r="${3*s}" fill="#ffb6cb"/>
  <circle cx="${x}" cy="${y}" r="${2*s}" fill="#dc5078"/>`;

const sunflower = (cx, cy, r = 1) => {
  let petals = "";
  for (let a = 0; a < 360; a += 45) {
    const rad = (a * Math.PI) / 180;
    petals += `<circle cx="${cx + Math.cos(rad)*r*1.6}" cy="${cy + Math.sin(rad)*r*1.6}" r="${r*0.55}" fill="#ffa500"/>`;
  }
  return `${petals}<circle cx="${cx}" cy="${cy}" r="${r}" fill="#8b5a00"/><circle cx="${cx}" cy="${cy}" r="${r*0.55}" fill="#654600"/>`;
};

const leaf = (x, y) => `
  <circle cx="${x}" cy="${y}" r="4" fill="#388e3c"/>
  <circle cx="${x+3}" cy="${y-3}" r="2.5" fill="#1b5e20"/>
  <circle cx="${x-2}" cy="${y-2}" r="1.8" fill="#81c784"/>`;

// Stars scattered for galaxy
const galaxyStars = (w, h) => {
  const pts = [[20,8],[50,14],[90,7],[130,16],[170,9],
               [w-20,8],[w-50,14],[w-90,7],[w-130,16],
               [30,h-8],[70,h-14],[w-30,h-8],[w-70,h-14]];
  return pts.map(([x,y]) => `<circle cx="${x}" cy="${y}" r="1" fill="white" opacity="0.9"/>`).join("");
};

// Rainbow strip for pastel
const rainbowStrip = (w, h, y0) => {
  const colors = ["#ff8a80","#ffbd69","#ffee58","#95dd80","#64c8ff","#c896ff"];
  const sw = w / colors.length;
  return colors.map((c, i) => `<rect x="${i*sw}" y="${y0}" width="${sw+1}" height="${h}" fill="${c}"/>`).join("");
};

// Tape strip for scrapbook
const tapeStrip = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" opacity="0.75" rx="2"/>`;

// ── Templates ─────────────────────────────────────────────────────────────────
export const TEMPLATES = {

  // ── Plain ────────────────────────────────────────────────────────────────
  plain: {
    label:"Plain", emoji:"🤍",
    editorStyle: { background:"#fff", color:"#202124" },
    layout: { ...DEFAULT_LAYOUT, leftMargin:14 },
    pdfDrawBackground: () => {},
    pdfTextColor:"#202124", pdfTitleColor:"#202124",
    uiDecor: {
      containerBg: "#fff",
      containerBorder: "1px solid #e8eaed",
      headerBg: "#fff",
      headerBorderBottom: "1px solid #e8eaed",
      headerSvg: null, headerSvgH: 0,
      textareaBg: "#fff",
      textareaColor: "#202124",
      lineColor: "#e0e0e0",
      lineSpacingPx: 28,
      footerBg: "#fafafa",
      footerBorderTop: "1px solid #f1f3f4",
      footerSvg: null, footerSvgH: 0,
      cornerSvg: null, cornerSize: 0,
      btnBg: "#1a73e8", btnColor: "#fff",
    },
  },

  // ── Rose Garden ──────────────────────────────────────────────────────────
  rosegarden: {
    label:"Rose Garden", emoji:"🌸",
    editorStyle: { background:"linear-gradient(160deg,#fff0f5 0%,#ffe4ec 100%)", color:"#5a2233" },
    layout: { ...DEFAULT_LAYOUT },
    pdfDrawBackground: (d, pw, ph, layout) => {
      d.setFillColor(255,240,245); d.rect(0,0,pw,ph,"F");
      d.setFillColor(255,182,203); d.rect(0,0,pw,8,"F");
      d.setFillColor(255,105,145); d.rect(0,0,pw,3,"F");
      d.setFillColor(255,182,203); d.rect(0,ph-8,pw,8,"F");
      d.setFillColor(255,105,145); d.rect(0,ph-3,pw,3,"F");
      const r=(x,y)=>{d.setFillColor(255,105,145);d.circle(x,y,5,"F");d.setFillColor(255,182,203);d.circle(x-4,y+2,3,"F");d.circle(x+4,y+2,3,"F");d.circle(x,y-4,3,"F");d.setFillColor(220,80,120);d.circle(x,y,2,"F");};
      r(14,14);r(pw-14,14);r(14,ph-14);r(pw-14,ph-14);
      d.setDrawColor(255,180,210);d.setLineWidth(0.35);
      for(let y=layout.firstLineY;y<ph-10;y+=layout.lineSpacing)d.line(layout.leftMargin,y,pw-layout.rightMargin,y);
    },
    pdfTextColor:"#5a2233", pdfTitleColor:"#c0185a",
    uiDecor: {
      containerBg: "linear-gradient(160deg,#fff0f5 0%,#ffe4ec 100%)",
      containerBorder: "2px solid #ffb6cb",
      headerBg: "linear-gradient(90deg,#ff6991 0%,#ffb6cb 40%,#ff6991 100%)",
      headerBorderBottom: "3px solid #ff6991",
      headerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="36" viewBox="0 0 ${w} 36">
        ${rose(18,18)} ${rose(w-18,18)} ${rose(w/2,18,0.7)}
        ${rose(w/4,18,0.5)} ${rose(3*w/4,18,0.5)}
        <rect x="0" y="0" width="${w}" height="4" fill="#ff6991" opacity="0.6"/>
      </svg>`,
      headerSvgH: 36,
      textareaBg: "linear-gradient(160deg,#fff8fb 0%,#fff0f5 100%)",
      textareaColor: "#5a2233",
      lineColor: "#ffb6cb",
      lineSpacingPx: 28,
      footerBg: "linear-gradient(90deg,#ff6991 0%,#ffb6cb 40%,#ff6991 100%)",
      footerBorderTop: "3px solid #ff6991",
      footerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="36" viewBox="0 0 ${w} 36">
        ${rose(18,18)} ${rose(w-18,18)} ${rose(w/2,18,0.7)}
        <rect x="0" y="32" width="${w}" height="4" fill="#ff6991" opacity="0.6"/>
      </svg>`,
      footerSvgH: 36,
      cornerSvg: (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${rose(s/2,s/2,s/20)}</svg>`,
      cornerSize: 60,
      btnBg: "#c0185a", btnColor: "#fff",
    },
  },

  // ── Sunflower ────────────────────────────────────────────────────────────
  sunflower: {
    label:"Sunflower", emoji:"🌻",
    editorStyle: { background:"linear-gradient(160deg,#fffde7 0%,#fff8c5 100%)", color:"#4a3500" },
    layout: { ...DEFAULT_LAYOUT, leftMargin:20 },
    pdfDrawBackground: (d,pw,ph,layout)=>{
      d.setFillColor(255,253,231);d.rect(0,0,pw,ph,"F");
      d.setFillColor(255,214,0);d.rect(0,0,pw,6,"F");d.setFillColor(255,165,0);d.rect(0,0,pw,2.5,"F");
      d.setFillColor(255,214,0);d.rect(0,ph-6,pw,6,"F");d.setFillColor(255,165,0);d.rect(0,ph-2.5,pw,2.5,"F");
      d.setFillColor(255,236,153);d.rect(0,0,14,ph,"F");d.setDrawColor(255,180,0);d.setLineWidth(0.5);d.line(14,0,14,ph);
      const s=(cx,cy,r)=>{d.setFillColor(255,165,0);for(let a=0;a<360;a+=45){const rad=(a*Math.PI)/180;d.circle(cx+Math.cos(rad)*r*1.6,cy+Math.sin(rad)*r*1.6,r*0.55,"F");}d.setFillColor(139,90,0);d.circle(cx,cy,r,"F");d.setFillColor(101,60,0);d.circle(cx,cy,r*0.55,"F");};
      s(7,14,4);s(pw-12,14,4);s(7,ph-14,4);s(pw-12,ph-14,4);
      d.setDrawColor(255,210,80);d.setLineWidth(0.35);
      for(let y=layout.firstLineY;y<ph-10;y+=layout.lineSpacing)d.line(layout.leftMargin,y,pw-layout.rightMargin,y);
    },
    pdfTextColor:"#4a3500", pdfTitleColor:"#b06000",
    uiDecor: {
      containerBg: "linear-gradient(160deg,#fffde7 0%,#fff8c5 100%)",
      containerBorder: "2px solid #ffd600",
      headerBg: "linear-gradient(90deg,#ffd600 0%,#ffe082 40%,#ffd600 100%)",
      headerBorderBottom: "4px solid #ffa000",
      headerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="40" viewBox="0 0 ${w} 40">
        <rect x="0" y="0" width="18" height="40" fill="#ffec99" opacity="0.9"/>
        <line x1="18" y1="0" x2="18" y2="40" stroke="#ffa000" stroke-width="2"/>
        ${sunflower(9,20,8)} ${sunflower(w-12,20,7)}
        ${sunflower(w/4,20,5)} ${sunflower(w/2,20,6)} ${sunflower(3*w/4,20,5)}
        <rect x="0" y="0" width="${w}" height="3" fill="#ffa000" opacity="0.7"/>
      </svg>`,
      headerSvgH: 40,
      textareaBg: "linear-gradient(160deg,#fffde7 0%,#fffbee 100%)",
      textareaColor: "#4a3500",
      lineColor: "#ffd54f",
      lineSpacingPx: 28,
      textareaBorderLeft: "18px solid #ffec99",
      footerBg: "linear-gradient(90deg,#ffd600 0%,#ffe082 40%,#ffd600 100%)",
      footerBorderTop: "4px solid #ffa000",
      footerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="40" viewBox="0 0 ${w} 40">
        <rect x="0" y="0" width="18" height="40" fill="#ffec99" opacity="0.9"/>
        ${sunflower(9,20,8)} ${sunflower(w-12,20,7)} ${sunflower(w/2,20,6)}
        <rect x="0" y="37" width="${w}" height="3" fill="#ffa000" opacity="0.7"/>
      </svg>`,
      footerSvgH: 40,
      cornerSvg: (sz) => `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">${sunflower(sz/2,sz/2,sz/5)}</svg>`,
      cornerSize: 56,
      btnBg: "#b06000", btnColor: "#fff",
    },
  },

  // ── Ocean ────────────────────────────────────────────────────────────────
  ocean: {
    label:"Ocean", emoji:"🌊",
    editorStyle: { background:"linear-gradient(160deg,#e3f2fd 0%,#e0f7fa 100%)", color:"#0d3349" },
    layout: { ...DEFAULT_LAYOUT },
    pdfDrawBackground: (d,pw,ph,layout)=>{
      d.setFillColor(227,242,253);d.rect(0,0,pw,ph,"F");
      d.setFillColor(3,169,244);d.rect(0,0,pw,10,"F");d.setFillColor(0,188,212);d.rect(0,3,pw,4,"F");d.setFillColor(2,136,209);d.rect(0,0,pw,2,"F");
      d.setFillColor(3,169,244);d.rect(0,ph-10,pw,10,"F");d.setFillColor(0,188,212);d.rect(0,ph-7,pw,4,"F");
      [[12,12],[pw-12,12],[12,ph-12],[pw-12,ph-12]].forEach(([x,y])=>{d.setFillColor(179,229,252);d.circle(x,y,5,"F");d.setFillColor(3,169,244);d.circle(x,y,3,"F");d.setFillColor(179,229,252);d.circle(x-1,y-1,1,"F");});
      d.setDrawColor(144,202,249);d.setLineWidth(0.35);
      for(let y=layout.firstLineY;y<ph-14;y+=layout.lineSpacing)d.line(layout.leftMargin,y,pw-layout.rightMargin,y);
    },
    pdfTextColor:"#0d3349", pdfTitleColor:"#0277bd",
    uiDecor: {
      containerBg: "linear-gradient(160deg,#e3f2fd 0%,#e0f7fa 100%)",
      containerBorder: "2px solid #03a9f4",
      headerBg: "linear-gradient(90deg,#0277bd 0%,#03a9f4 40%,#00bcd4 70%,#0277bd 100%)",
      headerBorderBottom: "3px solid #0277bd",
      headerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="44" viewBox="0 0 ${w} 44">
        <rect x="0" y="0" width="${w}" height="3" fill="#0277bd"/>
        <rect x="0" y="3" width="${w}" height="5" fill="#03a9f4" opacity="0.85"/>
        <rect x="0" y="8" width="${w}" height="3" fill="#00bcd4" opacity="0.7"/>
        <!-- Bubble corners -->
        <circle cx="16" cy="28" r="7" fill="#b3e5fc" opacity="0.8"/>
        <circle cx="16" cy="28" r="4" fill="#03a9f4"/>
        <circle cx="14" cy="26" r="1.5" fill="#b3e5fc"/>
        <circle cx="${w-16}" cy="28" r="7" fill="#b3e5fc" opacity="0.8"/>
        <circle cx="${w-16}" cy="28" r="4" fill="#03a9f4"/>
        <circle cx="${w-18}" cy="26" r="1.5" fill="#b3e5fc"/>
        <!-- Wave path -->
        <path d="M0 38 Q${w/6} 30 ${w/3} 38 Q${w/2} 46 ${2*w/3} 38 Q${5*w/6} 30 ${w} 38" fill="none" stroke="#b3e5fc" stroke-width="1.5" opacity="0.7"/>
      </svg>`,
      headerSvgH: 44,
      textareaBg: "linear-gradient(160deg,#e8f4fd 0%,#e0f7fa 100%)",
      textareaColor: "#0d3349",
      lineColor: "#90caf9",
      lineSpacingPx: 28,
      footerBg: "linear-gradient(90deg,#0277bd 0%,#03a9f4 40%,#00bcd4 70%,#0277bd 100%)",
      footerBorderTop: "3px solid #0277bd",
      footerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="44" viewBox="0 0 ${w} 44">
        <path d="M0 6 Q${w/6} 14 ${w/3} 6 Q${w/2} -2 ${2*w/3} 6 Q${5*w/6} 14 ${w} 6" fill="none" stroke="#b3e5fc" stroke-width="1.5" opacity="0.7"/>
        <rect x="0" y="36" width="${w}" height="3" fill="#00bcd4" opacity="0.7"/>
        <rect x="0" y="39" width="${w}" height="5" fill="#03a9f4" opacity="0.85"/>
        <circle cx="16" cy="16" r="7" fill="#b3e5fc" opacity="0.8"/>
        <circle cx="16" cy="16" r="4" fill="#03a9f4"/>
        <circle cx="${w-16}" cy="16" r="7" fill="#b3e5fc" opacity="0.8"/>
        <circle cx="${w-16}" cy="16" r="4" fill="#03a9f4"/>
      </svg>`,
      footerSvgH: 44,
      cornerSvg: (sz) => `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">
        <circle cx="${sz/2}" cy="${sz/2}" r="${sz*0.35}" fill="#b3e5fc" opacity="0.8"/>
        <circle cx="${sz/2}" cy="${sz/2}" r="${sz*0.22}" fill="#03a9f4"/>
        <circle cx="${sz/2-sz*0.08}" cy="${sz/2-sz*0.08}" r="${sz*0.07}" fill="#b3e5fc"/>
      </svg>`,
      cornerSize: 52,
      btnBg: "#0277bd", btnColor: "#fff",
    },
  },

  // ── Forest ───────────────────────────────────────────────────────────────
  forest: {
    label:"Forest", emoji:"🌿",
    editorStyle: { background:"linear-gradient(160deg,#e8f5e9 0%,#f1f8e9 100%)", color:"#1b3a1f" },
    layout: { ...DEFAULT_LAYOUT },
    pdfDrawBackground: (d,pw,ph,layout)=>{
      d.setFillColor(232,245,233);d.rect(0,0,pw,ph,"F");
      d.setFillColor(56,142,60);d.rect(0,0,pw,7,"F");d.setFillColor(27,94,32);d.rect(0,0,pw,2.5,"F");
      d.setFillColor(56,142,60);d.rect(0,ph-7,pw,7,"F");d.setFillColor(27,94,32);d.rect(0,ph-2.5,pw,2.5,"F");
      const lf=(x,y)=>{d.setFillColor(56,142,60);d.circle(x,y,4,"F");d.setFillColor(27,94,32);d.circle(x+3,y-3,2.5,"F");d.setFillColor(129,199,132);d.circle(x-2,y-2,1.8,"F");};
      lf(14,14);lf(pw-14,14);lf(14,ph-14);lf(pw-14,ph-14);
      d.setDrawColor(165,214,167);d.setLineWidth(0.35);
      for(let y=layout.firstLineY;y<ph-10;y+=layout.lineSpacing)d.line(layout.leftMargin,y,pw-layout.rightMargin,y);
    },
    pdfTextColor:"#1b3a1f", pdfTitleColor:"#2e7d32",
    uiDecor: {
      containerBg: "linear-gradient(160deg,#e8f5e9 0%,#f1f8e9 100%)",
      containerBorder: "2px solid #388e3c",
      headerBg: "linear-gradient(90deg,#1b5e20 0%,#388e3c 40%,#2e7d32 70%,#1b5e20 100%)",
      headerBorderBottom: "3px solid #1b5e20",
      headerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="40" viewBox="0 0 ${w} 40">
        <rect x="0" y="0" width="${w}" height="3" fill="#1b5e20"/>
        <rect x="0" y="3" width="${w}" height="4" fill="#388e3c" opacity="0.8"/>
        ${leaf(18,28)} ${leaf(w-18,28)}
        ${leaf(w/4,28)} ${leaf(w/2,28)} ${leaf(3*w/4,28)}
        <line x1="0" y1="38" x2="${w}" y2="38" stroke="#a5d6a7" stroke-width="1" opacity="0.6"/>
      </svg>`,
      headerSvgH: 40,
      textareaBg: "linear-gradient(160deg,#f0f9f0 0%,#f1f8e9 100%)",
      textareaColor: "#1b3a1f",
      lineColor: "#a5d6a7",
      lineSpacingPx: 28,
      footerBg: "linear-gradient(90deg,#1b5e20 0%,#388e3c 40%,#2e7d32 70%,#1b5e20 100%)",
      footerBorderTop: "3px solid #1b5e20",
      footerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="40" viewBox="0 0 ${w} 40">
        <line x1="0" y1="2" x2="${w}" y2="2" stroke="#a5d6a7" stroke-width="1" opacity="0.6"/>
        ${leaf(18,18)} ${leaf(w-18,18)} ${leaf(w/3,18)} ${leaf(2*w/3,18)}
        <rect x="0" y="34" width="${w}" height="6" fill="#388e3c" opacity="0.8"/>
      </svg>`,
      footerSvgH: 40,
      cornerSvg: (sz) => `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">${leaf(sz/2,sz/2)}</svg>`,
      cornerSize: 50,
      btnBg: "#2e7d32", btnColor: "#fff",
    },
  },

  // ── Galaxy ───────────────────────────────────────────────────────────────
  galaxy: {
    label:"Galaxy", emoji:"🌌",
    editorStyle: { background:"linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)", color:"#e8eaf6" },
    layout: { ...DEFAULT_LAYOUT },
    pdfDrawBackground: (d,pw,ph,layout)=>{
      d.setFillColor(22,33,62);d.rect(0,0,pw,ph,"F");
      d.setFillColor(63,0,125);d.rect(0,0,pw,7,"F");d.setFillColor(123,31,162);d.rect(0,0,pw,3,"F");
      d.setFillColor(63,0,125);d.rect(0,ph-7,pw,7,"F");d.setFillColor(123,31,162);d.rect(0,ph-3,pw,3,"F");
      d.setFillColor(255,255,255);
      [[20,20],[50,35],[90,18],[130,40],[170,22],[pw-20,20],[pw-50,35],[pw-90,18],[20,ph-20],[50,ph-35],[pw-20,ph-20],[pw-50,ph-35],[30,80],[70,65],[110,90],[150,70],[pw-30,80],[pw-70,65],[40,130],[80,115],[120,135],[pw-40,130],[pw-80,115]].forEach(([x,y])=>d.circle(x,y,0.6,"F"));
      [[pw/2,25],[pw/4,ph/2],[(pw*3)/4,ph/2]].forEach(([x,y])=>{d.setFillColor(200,180,255);d.circle(x,y,1.2,"F");});
      d.setDrawColor(80,100,180);d.setLineWidth(0.3);
      for(let y=layout.firstLineY;y<ph-10;y+=layout.lineSpacing)d.line(layout.leftMargin,y,pw-layout.rightMargin,y);
    },
    pdfTextColor:"#e8eaf6", pdfTitleColor:"#ce93d8",
    uiDecor: {
      containerBg: "linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)",
      containerBorder: "2px solid #7b1fa2",
      headerBg: "linear-gradient(90deg,#3f007d 0%,#7b1fa2 40%,#3f007d 100%)",
      headerBorderBottom: "3px solid #7b1fa2",
      headerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="40" viewBox="0 0 ${w} 40">
        <rect x="0" y="0" width="${w}" height="3" fill="#7b1fa2"/>
        <rect x="0" y="3" width="${w}" height="4" fill="#3f007d" opacity="0.8"/>
        ${galaxyStars(w, 40)}
        <circle cx="${w/2}" cy="24" r="3" fill="#ce93d8" opacity="0.9"/>
        <circle cx="${w/4}" cy="22" r="2" fill="white" opacity="0.6"/>
        <circle cx="${3*w/4}" cy="26" r="2" fill="white" opacity="0.6"/>
        <line x1="0" y1="38" x2="${w}" y2="38" stroke="#7b1fa2" stroke-width="1.5"/>
      </svg>`,
      headerSvgH: 40,
      textareaBg: "linear-gradient(160deg,#1a1a2e 0%,#16213e 100%)",
      textareaColor: "#e8eaf6",
      lineColor: "#3f4a80",
      lineSpacingPx: 28,
      footerBg: "linear-gradient(90deg,#3f007d 0%,#7b1fa2 40%,#3f007d 100%)",
      footerBorderTop: "3px solid #7b1fa2",
      footerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="40" viewBox="0 0 ${w} 40">
        <line x1="0" y1="2" x2="${w}" y2="2" stroke="#7b1fa2" stroke-width="1.5"/>
        ${galaxyStars(w, 40)}
        <circle cx="${w/2}" cy="20" r="3" fill="#ce93d8" opacity="0.9"/>
        <rect x="0" y="34" width="${w}" height="6" fill="#3f007d" opacity="0.9"/>
        <rect x="0" y="37" width="${w}" height="3" fill="#7b1fa2"/>
      </svg>`,
      footerSvgH: 40,
      cornerSvg: (sz) => `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">
        <circle cx="${sz/2}" cy="${sz/2}" r="${sz*0.32}" fill="#3f007d" opacity="0.8"/>
        <circle cx="${sz/2}" cy="${sz/2}" r="${sz*0.18}" fill="#ce93d8" opacity="0.9"/>
        <circle cx="${sz/2}" cy="${sz/2}" r="${sz*0.08}" fill="white"/>
        <circle cx="${sz*0.25}" cy="${sz*0.25}" r="${sz*0.05}" fill="white" opacity="0.7"/>
        <circle cx="${sz*0.75}" cy="${sz*0.3}" r="${sz*0.04}" fill="white" opacity="0.6"/>
      </svg>`,
      cornerSize: 52,
      btnBg: "#7b1fa2", btnColor: "#fff",
    },
  },

  // ── Scrapbook ────────────────────────────────────────────────────────────
  scrapbook: {
    label:"Scrapbook", emoji:"✂️",
    editorStyle: {
      background:"#fdf6ec", color:"#3e2723",
      backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 27px,#f0e0c8 28px),repeating-linear-gradient(90deg,transparent,transparent 27px,#f0e0c8 28px)",
    },
    layout: { ...DEFAULT_LAYOUT, leftMargin:16 },
    pdfDrawBackground: (d,pw,ph,layout)=>{
      d.setFillColor(253,246,236);d.rect(0,0,pw,ph,"F");
      d.setDrawColor(240,224,200);d.setLineWidth(0.2);
      for(let x=0;x<pw;x+=10)d.line(x,0,x,ph);
      for(let y=0;y<ph;y+=10)d.line(0,y,pw,y);
      const t=(x,y,w,h,r,g,b)=>{d.setFillColor(r,g,b);d.rect(x,y,w,h,"F");};
      t(8,8,20,8,255,230,100);t(pw-28,8,20,8,180,230,255);t(8,ph-16,20,8,255,180,180);t(pw-28,ph-16,20,8,200,255,200);
      d.setDrawColor(180,140,100);d.setLineWidth(1);d.rect(12,12,pw-24,ph-24);
      d.setDrawColor(210,170,130);d.setLineWidth(0.5);
      for(let y=layout.firstLineY;y<ph-18;y+=layout.lineSpacing)d.line(layout.leftMargin,y,pw-layout.rightMargin,y);
    },
    pdfTextColor:"#3e2723", pdfTitleColor:"#5d4037",
    uiDecor: {
      containerBg: "#fdf6ec",
      containerBorder: "2px solid #b0784a",
      headerBg: "#f5e6d0",
      headerBorderBottom: "3px solid #b0784a",
      headerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="40" viewBox="0 0 ${w} 40">
        <!-- Grid lines -->
        ${Array.from({length:Math.floor(w/12)},(_,i)=>`<line x1="${i*12}" y1="0" x2="${i*12}" y2="40" stroke="#e8d4b8" stroke-width="0.5"/>`).join("")}
        ${Array.from({length:4},(_,i)=>`<line x1="0" y1="${i*12}" x2="${w}" y2="${i*12}" stroke="#e8d4b8" stroke-width="0.5"/>`).join("")}
        <!-- Border line -->
        <rect x="4" y="4" width="${w-8}" height="32" fill="none" stroke="#b0784a" stroke-width="1.5"/>
        <!-- Tape strips -->
        ${tapeStrip(10, 0, 28, 10, "#ffe066")}
        ${tapeStrip(w-38, 0, 28, 10, "#b3e5fc")}
        ${tapeStrip(w/2-14, 0, 28, 10, "#ffc1cc")}
        <!-- Scissor icon hint -->
        <text x="${w/2}" y="28" text-anchor="middle" font-size="14" fill="#8d6e63" opacity="0.5">✂</text>
      </svg>`,
      headerSvgH: 40,
      textareaBg: "#fdf6ec",
      textareaColor: "#3e2723",
      lineColor: "#d4aa78",
      lineSpacingPx: 28,
      footerBg: "#f5e6d0",
      footerBorderTop: "3px solid #b0784a",
      footerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="40" viewBox="0 0 ${w} 40">
        ${Array.from({length:Math.floor(w/12)},(_,i)=>`<line x1="${i*12}" y1="0" x2="${i*12}" y2="40" stroke="#e8d4b8" stroke-width="0.5"/>`).join("")}
        ${Array.from({length:4},(_,i)=>`<line x1="0" y1="${i*12}" x2="${w}" y2="${i*12}" stroke="#e8d4b8" stroke-width="0.5"/>`).join("")}
        <rect x="4" y="4" width="${w-8}" height="32" fill="none" stroke="#b0784a" stroke-width="1.5"/>
        ${tapeStrip(10, 30, 28, 10, "#ffc1cc")}
        ${tapeStrip(w-38, 30, 28, 10, "#c8e6c9")}
        ${tapeStrip(w/2-14, 30, 28, 10, "#ffe066")}
      </svg>`,
      footerSvgH: 40,
      cornerSvg: (sz) => `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">
        <rect x="2" y="2" width="${sz-4}" height="${sz-4}" fill="none" stroke="#b0784a" stroke-width="1.5"/>
        ${tapeStrip(sz*0.1, sz*0.1, sz*0.35, sz*0.18, "#ffe066")}
      </svg>`,
      cornerSize: 48,
      btnBg: "#5d4037", btnColor: "#fff",
    },
  },

  // ── Pastel ───────────────────────────────────────────────────────────────
  pastel: {
    label:"Pastel", emoji:"🎀",
    editorStyle: { background:"linear-gradient(135deg,#fce4ec 0%,#f3e5f5 33%,#e8eaf6 66%,#e3f2fd 100%)", color:"#37474f" },
    layout: { ...DEFAULT_LAYOUT },
    pdfDrawBackground: (d,pw,ph,layout)=>{
      const bands=[[252,228,236],[248,225,241],[243,229,245],[235,234,245],[232,234,246],[227,242,253]];
      const bh=ph/bands.length;
      bands.forEach(([r,g,b],i)=>{d.setFillColor(r,g,b);d.rect(0,i*bh,pw,bh+1,"F");});
      d.setFillColor(255,255,255);
      for(let x=10;x<pw;x+=15)for(let y=10;y<ph;y+=15)d.circle(x,y,1.2,"F");
      const rainbow=[[255,138,128],[255,190,100],[255,238,88],[149,221,128],[100,200,255],[200,150,255]];
      const sw=pw/rainbow.length;
      rainbow.forEach(([r,g,b],i)=>{d.setFillColor(r,g,b);d.rect(i*sw,0,sw,5,"F");});
      [...rainbow].reverse().forEach(([r,g,b],i)=>{d.setFillColor(r,g,b);d.rect(i*sw,ph-5,sw,5,"F");});
      d.setDrawColor(200,160,210);d.setLineWidth(0.35);
      for(let y=layout.firstLineY;y<ph-10;y+=layout.lineSpacing)d.line(layout.leftMargin,y,pw-layout.rightMargin,y);
    },
    pdfTextColor:"#37474f", pdfTitleColor:"#7b1fa2",
    uiDecor: {
      containerBg: "linear-gradient(135deg,#fce4ec 0%,#f3e5f5 33%,#e8eaf6 66%,#e3f2fd 100%)",
      containerBorder: "2px solid #ce93d8",
      headerBg: "linear-gradient(90deg,#f48fb1,#ce93d8,#9fa8da,#80deea)",
      headerBorderBottom: "3px solid #ba68c8",
      headerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="44" viewBox="0 0 ${w} 44">
        ${rainbowStrip(w, 5, 0)}
        <!-- Polka dots -->
        ${Array.from({length:Math.floor(w/22)},(_,i)=>`<circle cx="${11+i*22}" cy="26" r="4" fill="white" opacity="0.5"/>`).join("")}
        <!-- Bow in center -->
        <polygon points="${w/2-14},22 ${w/2},16 ${w/2-14},10" fill="#f48fb1" opacity="0.8"/>
        <polygon points="${w/2+14},22 ${w/2},16 ${w/2+14},10" fill="#f48fb1" opacity="0.8"/>
        <circle cx="${w/2}" cy="16" r="4" fill="#e91e63"/>
        <line x1="0" y1="40" x2="${w}" y2="40" stroke="#f48fb1" stroke-width="1.5" opacity="0.7"/>
      </svg>`,
      headerSvgH: 44,
      textareaBg: "linear-gradient(135deg,#fce4ec 0%,#f3e5f5 50%,#e3f2fd 100%)",
      textareaColor: "#37474f",
      lineColor: "#ce93d8",
      lineSpacingPx: 28,
      footerBg: "linear-gradient(90deg,#f48fb1,#ce93d8,#9fa8da,#80deea)",
      footerBorderTop: "3px solid #ba68c8",
      footerSvg: (w) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="44" viewBox="0 0 ${w} 44">
        <line x1="0" y1="4" x2="${w}" y2="4" stroke="#f48fb1" stroke-width="1.5" opacity="0.7"/>
        ${Array.from({length:Math.floor(w/22)},(_,i)=>`<circle cx="${11+i*22}" cy="20" r="4" fill="white" opacity="0.5"/>`).join("")}
        ${rainbowStrip(w, 5, 39)}
      </svg>`,
      footerSvgH: 44,
      cornerSvg: (sz) => `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">
        <circle cx="${sz/2}" cy="${sz/2}" r="${sz*0.35}" fill="#f8bbd0" opacity="0.7"/>
        <polygon points="${sz/2-sz*0.22},${sz/2+sz*0.1} ${sz/2},${sz/2-sz*0.15} ${sz/2-sz*0.22},${sz/2-sz*0.1}" fill="#f48fb1" opacity="0.9"/>
        <polygon points="${sz/2+sz*0.22},${sz/2+sz*0.1} ${sz/2},${sz/2-sz*0.15} ${sz/2+sz*0.22},${sz/2-sz*0.1}" fill="#f48fb1" opacity="0.9"/>
        <circle cx="${sz/2}" cy="${sz/2-sz*0.05}" r="${sz*0.09}" fill="#e91e63"/>
      </svg>`,
      cornerSize: 52,
      btnBg: "#7b1fa2", btnColor: "#fff",
    },
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

export const ensureMeta = (page) => {
  if (typeof page === "string")
    return { data: page, meta: { template: "plain", font: "default" } };
  return {
    data: page?.data ?? "",
    meta: { template: page?.meta?.template ?? "plain", font: page?.meta?.font ?? "default" },
  };
};
