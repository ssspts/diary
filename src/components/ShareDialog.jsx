// src/components/ShareDialog.jsx
import { useState } from "react";
import { layout } from "../styles/tokens";

const PLATFORMS = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    color: "#25D366",
    icon: "💬",
    getUrl: (text) => `https://wa.me/?text=${encodeURIComponent(text)}`,
  },
  {
    id: "telegram",
    label: "Telegram",
    color: "#2CA5E0",
    icon: "✈️",
    getUrl: (text) =>
        `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: "twitter",
    label: "Twitter / X",
    color: "#000",
    icon: "𝕏",
    getUrl: (text) =>
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877F2",
    icon: "f",
    getUrl: () =>
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`,
  },
];

// Convert a base64 dataURL to a File object
function dataURLtoFile(dataUrl, fileName, mimeType) {
  const arr    = dataUrl.split(",");
  const bstr   = atob(arr[1]);
  let   n      = bstr.length;
  const u8arr  = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], fileName, { type: mimeType });
}

// Generate a PDF blob from the imageUrl (single page image → PDF)
async function imageToPdfBlob(imageUrl, title) {
  // Dynamically import jsPDF only when needed
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw  = doc.internal.pageSize.getWidth();
  const ph  = doc.internal.pageSize.getHeight();
  doc.addImage(imageUrl, "PNG", 0, 0, pw, ph);
  return doc.output("blob");
}

/**
 * Props:
 *   title       – entry title
 *   text        – first page text content
 *   imageUrl    – dataURL of the rendered page (PNG)
 *   allPageUrls – array of dataURLs for all pages (optional)
 *   onClose     – () => void
 */
export default function ShareDialog({ title, text, imageUrl, allPageUrls, onClose }) {
  const [copied,       setCopied]       = useState(false);
  const [sharing,      setSharing]      = useState(false);
  const [shareStatus,  setShareStatus]  = useState(""); // feedback message

  const shareText = `📖 ${title}\n\n${text.slice(0, 280)}${text.length > 280 ? "…" : ""}`;
  const safeName  = (title || "diary").replace(/[^a-z0-9_-]/gi, "_");

  // ── Native file share (mobile) ────────────────────────────────────────────
  // Tries to share image + text as files via Web Share API
  const handleNativeShare = async () => {
    setSharing(true);
    setShareStatus("");
    try {
      const files = [];

      // Attach all pages as a single image if available, otherwise first page
      const pagesToShare = allPageUrls?.length ? allPageUrls : (imageUrl ? [imageUrl] : []);

      if (pagesToShare.length > 0 && navigator.canShare) {
        if (pagesToShare.length === 1) {
          // Single page → share as PNG
          const imgFile = dataURLtoFile(pagesToShare[0], `${safeName}.png`, "image/png");
          files.push(imgFile);
        } else {
          // Multiple pages → stitch into one tall image
          const combined = await stitchImages(pagesToShare);
          const imgFile  = dataURLtoFile(combined, `${safeName}.png`, "image/png");
          files.push(imgFile);
        }

        const shareData = { title, text: shareText, files };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setShareStatus("✓ Shared successfully!");
          return;
        }
      }

      // Fallback: share text only
      await navigator.share({ title, text: shareText, url: window.location.href });
      setShareStatus("✓ Shared (text only — image not supported on this device)");
    } catch (e) {
      if (e.name !== "AbortError") setShareStatus("Share cancelled or not supported.");
    } finally {
      setSharing(false);
    }
  };

  // ── Stitch multiple page images into one tall PNG ─────────────────────────
  const stitchImages = async (dataUrls) => {
    const imgs = await Promise.all(dataUrls.map((url) => new Promise((res) => {
      const img = new Image(); img.onload = () => res(img); img.src = url;
    })));
    const w = imgs[0].naturalWidth;
    const h = imgs.reduce((sum, img) => sum + img.naturalHeight, 0);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    let y = 0;
    imgs.forEach((img) => { ctx.drawImage(img, 0, y); y += img.naturalHeight; });
    return canvas.toDataURL("image/png");
  };

  // ── Download image ────────────────────────────────────────────────────────
  const downloadImage = async () => {
    const pagesToSave = allPageUrls?.length ? allPageUrls : (imageUrl ? [imageUrl] : []);
    if (!pagesToSave.length) return;
    const dataUrl = pagesToSave.length === 1 ? pagesToSave[0] : await stitchImages(pagesToSave);
    const a = document.createElement("a");
    a.href = dataUrl; a.download = `${safeName}.png`; a.click();
  };

  // ── Download PDF ──────────────────────────────────────────────────────────
  const downloadPdf = async () => {
    setSharing(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit:"mm", format:"a4", compress:true });
      const pw  = doc.internal.pageSize.getWidth();
      const ph  = doc.internal.pageSize.getHeight();
      const pages = allPageUrls?.length ? allPageUrls : (imageUrl ? [imageUrl] : []);
      pages.forEach((url, i) => {
        if (i > 0) doc.addPage();
        doc.addImage(url, "PNG", 0, 0, pw, ph);
      });
      doc.save(`${safeName}.pdf`);
    } finally { setSharing(false); }
  };

  // ── Copy text ─────────────────────────────────────────────────────────────
  const handleCopyText = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const canNativeShare = typeof navigator.share === "function";

  return (
      <div style={layout.overlay} onClick={onClose}>
        <div style={st.modal} onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div style={st.header}>
            <span style={st.headerTitle}>Share Entry</span>
            <button style={st.closeBtn} onClick={onClose}>✕</button>
          </div>

          {/* Preview card */}
          <div style={st.previewCard}>
            <div style={st.previewTitle}>{title}</div>
            <div style={st.previewText}>{text.slice(0, 120)}{text.length > 120 ? "…" : ""}</div>
          </div>

          {/* ── Share with image (mobile native share) ── */}
          {canNativeShare && (
              <div style={st.section}>
                <div style={st.sectionLabel}>Share image + text</div>
                <button
                    style={{ ...st.bigBtn, opacity: sharing ? 0.7 : 1 }}
                    onClick={handleNativeShare}
                    disabled={sharing}
                >
                  <span style={{ fontSize:20 }}>↗</span>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13 }}>
                      {sharing ? "Sharing…" : "Share via device…"}
                    </div>
                    <div style={{ fontSize:11, opacity:0.7, marginTop:2 }}>
                      WhatsApp, iMessage, Email and more — includes image
                    </div>
                  </div>
                </button>
                {shareStatus && (
                    <div style={st.statusMsg}>{shareStatus}</div>
                )}
              </div>
          )}

          {/* ── Share text via platform links ── */}
          <div style={st.section}>
            <div style={st.sectionLabel}>Share text link</div>
            <div style={st.platformGrid}>
              {PLATFORMS.map((p) => (
                  <button
                      key={p.id}
                      style={{ ...st.platformBtn, borderColor: p.color + "55" }}
                      onClick={() => window.open(p.getUrl(shareText), "_blank", "noopener")}
                  >
                    <span style={{ ...st.platformIcon, background: p.color }}>{p.icon}</span>
                    <span style={st.platformLabel}>{p.label}</span>
                  </button>
              ))}
            </div>
          </div>

          {/* ── Download section ── */}
          <div style={st.section}>
            <div style={st.sectionLabel}>Download</div>
            <div style={st.downloadRow}>
              {imageUrl && (
                  <button style={st.downloadBtn} onClick={downloadImage}>
                    🖼 Save as Image
                  </button>
              )}
              {imageUrl && (
                  <button style={{ ...st.downloadBtn, ...st.downloadBtnPdf }} onClick={downloadPdf} disabled={sharing}>
                    📄 Save as PDF
                  </button>
              )}
              <button style={st.downloadBtn} onClick={handleCopyText}>
                {copied ? "✓ Copied!" : "📋 Copy text"}
              </button>
            </div>
          </div>

          {/* Instagram note */}
          <p style={st.footerNote}>
            💡 For Instagram: download the image first, then share it from your camera roll.
          </p>
        </div>
      </div>
  );
}

const st = {
  modal:        { background:"#fff", borderRadius:14, width:440, maxWidth:"95vw", boxShadow:"0 12px 40px rgba(0,0,0,0.18)", overflow:"hidden" },
  header:       { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px 12px", borderBottom:"1px solid #f1f3f4" },
  headerTitle:  { fontSize:16, fontWeight:700, color:"#202124" },
  closeBtn:     { border:"none", background:"#f1f3f4", borderRadius:"50%", width:28, height:28, cursor:"pointer", fontSize:14, color:"#5f6368" },
  previewCard:  { margin:"12px 16px 0", background:"#f8f9fa", borderRadius:10, padding:"12px 14px", borderLeft:"3px solid #1a73e8" },
  previewTitle: { fontSize:13, fontWeight:600, color:"#202124", marginBottom:4 },
  previewText:  { fontSize:12, color:"#5f6368", lineHeight:1.5 },
  section:      { padding:"12px 16px 0" },
  sectionLabel: { fontSize:11, fontWeight:600, color:"#9aa0a6", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 },
  bigBtn:       { display:"flex", alignItems:"center", gap:12, width:"100%", padding:"12px 14px", border:"1px solid #dadce0", borderRadius:10, background:"#fff", cursor:"pointer", textAlign:"left", color:"#202124" },
  statusMsg:    { fontSize:12, color:"#1a73e8", marginTop:6, padding:"4px 2px" },
  platformGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
  platformBtn:  { display:"flex", alignItems:"center", gap:8, padding:"9px 10px", border:"1px solid #e8eaed", borderRadius:10, background:"#fff", cursor:"pointer" },
  platformIcon: { width:30, height:30, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:"#fff", fontWeight:700, flexShrink:0 },
  platformLabel:{ fontSize:12, fontWeight:500, color:"#202124" },
  downloadRow:  { display:"flex", gap:8, flexWrap:"wrap" },
  downloadBtn:  { flex:1, minWidth:100, padding:"9px 12px", border:"1px solid #dadce0", borderRadius:8, background:"#fff", cursor:"pointer", fontSize:12, color:"#3c4043", fontWeight:500, textAlign:"center" },
  downloadBtnPdf:{ background:"#e8f0fe", color:"#1a73e8", border:"1px solid #c5d8fb" },
  footerNote:   { fontSize:11, color:"#9aa0a6", margin:"12px 16px 16px", lineHeight:1.5 },
};