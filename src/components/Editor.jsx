// src/components/Editor.jsx
import { useRef, useEffect, useState } from "react";
import { editor as s, shared } from "../styles/tokens";
import { TEMPLATES, HANDWRITING_FONTS, FONT_KEYS, ensureMeta } from "../utils/templates";
import PdfPreview from "./PdfPreview";

// ── Line-limit constants ──────────────────────────────────────────────────────
// The textarea uses fontSize 16px and lineHeight 28px.
// We calculate how many lines fit in the visible textarea height.
// Rather than measuring DOM height (which is complex), we use a fixed line
// budget that matches the PDF layout: 25 lines per page (matches PDF maxLines).
const LINES_PER_PAGE = 30;

// Count logical lines in a string at a given character width.
// We approximate wrap by splitting on \n and counting each physical line
// as ceil(chars / CHARS_PER_LINE). This is a proxy — actual wrap depends on
// font metrics, but gives a consistent budget that matches PDF export.
const CHARS_PER_LINE = 72; // approx for 16px font in a typical editor width

function countLines(text) {
  if (!text) return 0;
  return text.split("\n").reduce((sum, line) => {
    return sum + Math.max(1, Math.ceil((line.length || 1) / CHARS_PER_LINE));
  }, 0);
}

export default function Editor({
  selectedFile,
  pages, setPages, currentPage, setCurrentPage,
  isDirty, setIsDirty, saving,
  editingTitle, setEditingTitle, tempTitle, setTempTitle, titleInputRef,
  onSave, onDownloadPdf, onOpenTemplatePicker, onRenameFile,
}) {
  const textareaRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false);

  // FIX 2 — auto-scroll textarea to bottom when switching pages
  useEffect(() => {
    if (textareaRef.current) textareaRef.current.scrollTop = 0;
  }, [currentPage, selectedFile?.id]);

  if (!selectedFile) {
    return (
      <main style={s.pane}>
        <div style={s.empty}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📝</div>
          <div style={{ fontSize: 15, color: "#80868b" }}>
            Select an entry or create a new one
          </div>
        </div>
      </main>
    );
  }

  const currentTplKey  = pages[currentPage]?.meta?.template || "plain";
  const currentFontKey = pages[currentPage]?.meta?.font     || "default";
  const currentTpl     = TEMPLATES[currentTplKey]           || TEMPLATES.plain;
  const currentFont    = HANDWRITING_FONTS[currentFontKey]  || HANDWRITING_FONTS.default;

  // ── FIX 2: handle text change with line-limit enforcement ─────────────────
  const handleTextChange = (e) => {
    const newText  = e.target.value;
    const lineCount = countLines(newText);

    if (lineCount <= LINES_PER_PAGE) {
      // Normal case — still within this page's budget
      const updated = [...pages];
      updated[currentPage] = {
        ...ensureMeta(updated[currentPage]),
        data: newText,
      };
      setPages(updated);
      setIsDirty(true);
      return;
    }

    // Over the limit — split at the boundary and push overflow to next page.
    // Find the character position where lineCount would equal LINES_PER_PAGE.
    const rawLines = newText.split("\n");
    let budget = LINES_PER_PAGE;
    let splitIndex = rawLines.length; // default: all lines fit (shouldn't happen here)

    for (let i = 0; i < rawLines.length; i++) {
      const wrappedCount = Math.max(1, Math.ceil((rawLines[i].length || 1) / CHARS_PER_LINE));
      if (budget - wrappedCount < 0) {
        splitIndex = i;
        break;
      }
      budget -= wrappedCount;
    }

    const thisPageText     = rawLines.slice(0, splitIndex).join("\n");
    const overflowText     = rawLines.slice(splitIndex).join("\n");

    const updated = [...pages];
    // Write current page content up to the limit
    updated[currentPage] = {
      ...ensureMeta(updated[currentPage]),
      data: thisPageText,
    };

    const nextPageIndex = currentPage + 1;

    if (nextPageIndex < updated.length) {
      // Prepend overflow to the existing next page
      const nextPage = ensureMeta(updated[nextPageIndex]);
      updated[nextPageIndex] = {
        ...nextPage,
        data: overflowText + (nextPage.data ? "\n" + nextPage.data : ""),
      };
    } else {
      // Create a brand new next page carrying the overflow and same template/font
      updated.push({
        ...ensureMeta(""),
        meta: { template: currentTplKey, font: currentFontKey },
        data: overflowText,
      });
    }

    setPages(updated);
    setIsDirty(true);
    // Navigate to the next page automatically
    setCurrentPage(nextPageIndex);
  };

  const handleFontChange = (e) => {
    const updated = [...pages];
    updated[currentPage] = {
      ...ensureMeta(updated[currentPage]),
      meta: { template: currentTplKey, font: e.target.value },
    };
    setPages(updated);
    setIsDirty(true);
  };

  const addPage = () => {
    setPages((prev) => [
      ...prev,
      { ...ensureMeta(""), meta: { template: currentTplKey, font: currentFontKey } },
    ]);
    setCurrentPage(pages.length);
    setIsDirty(true);
  };

  const deletePage = () => {
    if (!window.confirm("Delete this page?")) return;
    const updated = pages.filter((_, i) => i !== currentPage);
    setPages(updated);
    setCurrentPage(Math.min(currentPage, updated.length - 1));
    setIsDirty(true);
  };

  const linesUsed     = countLines(pages[currentPage]?.data ?? "");
  const linesLeft     = LINES_PER_PAGE - linesUsed;
  const nearLimit     = linesLeft <= 3;

  return (
    <>
    <main style={s.pane}>
      <div style={s.inner}>

        {/* ── Toolbar ── */}
        <div style={s.toolbar}>
          <div style={s.toolbarLeft}>
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  { onRenameFile(selectedFile.id, tempTitle); setEditingTitle(false); }
                  if (e.key === "Escape") { setEditingTitle(false); }
                }}
                onBlur={() => { onRenameFile(selectedFile.id, tempTitle); setEditingTitle(false); }}
                style={s.titleInput}
              />
            ) : (
              <div
                style={s.entryTitle}
                title="Click to rename"
                onClick={() => { setTempTitle(selectedFile.name); setEditingTitle(true); }}
              >
                {selectedFile.name}
                {isDirty && <span style={s.dirtyDot} title="Unsaved changes" />}
              </div>
            )}
            <span style={s.entryMeta}>
              {new Date(selectedFile.createdAt).toLocaleDateString("default", {
                weekday: "short", year: "numeric", month: "short", day: "numeric",
              })}
            </span>
          </div>

          <div style={s.toolbarRight}>
            <button style={s.themeBtn} onClick={onOpenTemplatePicker} title="Change page theme">
              <span style={{ fontSize: 15 }}>{currentTpl.emoji}</span>
              <span style={{ fontSize: 12 }}>{currentTpl.label}</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
            </button>

            <div style={st.fontPickerWrap} title="Handwriting style">
              <span style={st.fontPickerIcon}>✍</span>
              <select
                value={currentFontKey}
                onChange={handleFontChange}
                style={{ ...st.fontSelect, fontFamily: currentFont.editorFamily }}
              >
                {FONT_KEYS.map((key) => {
                  const f = HANDWRITING_FONTS[key];
                  return (
                    <option key={key} value={key} style={{ fontFamily: f.editorFamily }}>
                      {f.emoji}  {f.label}
                    </option>
                  );
                })}
              </select>
            </div>

            <button style={shared.btnOutline} onClick={() => setShowPreview(true)}>👁 Preview & Download</button>

            <button
              style={{ ...shared.btnPrimary, background: isDirty ? "#1a73e8" : "#34a853", opacity: saving ? 0.7 : 1 }}
              onClick={onSave}
              disabled={saving}
              title="Save (Ctrl+S / Cmd+S)"
            >
              {saving ? <><span style={shared.spinner} /> Saving…</> : isDirty ? "Save" : "✓ Saved"}
            </button>
          </div>
        </div>

        {/* ── Themed + fonted textarea ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <textarea
            ref={textareaRef}
            style={{
              ...s.textarea,
              ...currentTpl.editorStyle,
              color:      currentTpl.editorStyle.color,
              fontFamily: currentFont.editorFamily,
              fontSize:   "16px",
              lineHeight: "28px",
            }}
            value={pages[currentPage]?.data ?? ""}
            placeholder="Start writing…"
            onChange={handleTextChange}
          />
          {/* FIX 2 — line counter indicator */}
          <div style={{
            ...st.lineCounter,
            color: nearLimit ? "#d93025" : "#9aa0a6",
          }}>
            {linesLeft > 0
              ? `${linesLeft} line${linesLeft === 1 ? "" : "s"} left on this page`
              : "Page full — overflow goes to next page automatically"}
          </div>
        </div>

        {/* ── Pagination ── */}
        <div style={s.pagination}>
          <button style={s.pageBtn} disabled={currentPage === 0}
            onClick={() => setCurrentPage((p) => p - 1)}>← Prev</button>
          <span style={s.pageLabel}>Page {currentPage + 1} / {pages.length || 1}</span>
          <button style={s.pageBtn} disabled={currentPage >= pages.length - 1}
            onClick={() => setCurrentPage((p) => p + 1)}>Next →</button>
          <button style={{ ...s.pageBtn, marginLeft: 6 }} onClick={addPage}>+ Page</button>
          {pages.length > 1 && (
            <button style={{ ...s.pageBtn, color: "#d93025", borderColor: "#f5c6c6" }} onClick={deletePage}>
              ✕ Page
            </button>
          )}
        </div>
      </div>
    </main>

      {/* ── PDF Preview modal ── */}
      {showPreview && (
        <PdfPreview
          selectedFile={selectedFile}
          pages={pages}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}

const st = {
  fontPickerWrap: {
    display: "flex", alignItems: "center", border: "1px solid #dadce0",
    borderRadius: 6, background: "#fff", padding: "0 6px 0 8px", gap: 4, height: 32,
  },
  fontPickerIcon: { fontSize: 14, color: "#5f6368", flexShrink: 0 },
  fontSelect: {
    border: "none", outline: "none", background: "transparent",
    fontSize: 13, color: "#3c4043", cursor: "pointer", maxWidth: 130,
  },
  lineCounter: {
    fontSize: 11, padding: "3px 24px 4px", textAlign: "right", flexShrink: 0,
  },
};
