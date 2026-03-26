// src/components/Editor.jsx
import { editor as s, shared } from "../styles/tokens";
import { TEMPLATES, HANDWRITING_FONTS, FONT_KEYS, ensureMeta } from "../utils/templates";

/**
 * Props:
 *   selectedFile         – file object | null
 *   pages                – array of {data, meta:{template,font}}
 *   setPages             – setter
 *   currentPage          – number
 *   setCurrentPage       – setter
 *   isDirty              – boolean
 *   setIsDirty           – setter
 *   saving               – boolean
 *   editingTitle         – boolean
 *   setEditingTitle      – setter
 *   tempTitle            – string
 *   setTempTitle         – setter
 *   titleInputRef        – ref
 *   onSave               – () => void
 *   onDownloadPdf        – () => void   (async-safe — exportPdf handles async)
 *   onOpenTemplatePicker – () => void
 *   onRenameFile         – (id, name) => void
 */
export default function Editor({
  selectedFile,
  pages, setPages, currentPage, setCurrentPage,
  isDirty, setIsDirty, saving,
  editingTitle, setEditingTitle, tempTitle, setTempTitle, titleInputRef,
  onSave, onDownloadPdf, onOpenTemplatePicker, onRenameFile,
}) {
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

  const updateCurrentPage = (patch) => {
    const updated = [...pages];
    updated[currentPage] = { ...ensureMeta(updated[currentPage]), ...patch };
    setPages(updated);
    setIsDirty(true);
  };

  const handleTextChange = (e) =>
    updateCurrentPage({ data: e.target.value });

  const handleFontChange = (e) =>
    updateCurrentPage({ meta: { template: currentTplKey, font: e.target.value } });

  const handleTemplateChange = (key) =>
    updateCurrentPage({ meta: { template: key, font: currentFontKey } });

  const addPage = () => {
    setPages((prev) => [...prev, ensureMeta("")]);
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

  return (
    <main style={s.pane}>
      <div style={s.inner}>

        {/* ── Toolbar ── */}
        <div style={s.toolbar}>

          {/* Left: title + date */}
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

          {/* Right: theme, font, PDF, save */}
          <div style={s.toolbarRight}>

            {/* Theme picker button */}
            <button style={s.themeBtn} onClick={onOpenTemplatePicker} title="Change page theme">
              <span style={{ fontSize: 15 }}>{currentTpl.emoji}</span>
              <span style={{ fontSize: 12 }}>{currentTpl.label}</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
            </button>

            {/* ── Font / handwriting selector ── */}
            <div style={st.fontPickerWrap} title="Handwriting style">
              <span style={st.fontPickerIcon}>✍</span>
              <select
                value={currentFontKey}
                onChange={handleFontChange}
                style={{
                  ...st.fontSelect,
                  fontFamily: currentFont.editorFamily,
                }}
              >
                {FONT_KEYS.map((key) => {
                  const f = HANDWRITING_FONTS[key];
                  return (
                    <option
                      key={key}
                      value={key}
                      style={{ fontFamily: f.editorFamily }}
                    >
                      {f.emoji}  {f.label}
                    </option>
                  );
                })}
              </select>
            </div>

            <button style={shared.btnOutline} onClick={onDownloadPdf}>⬇ PDF</button>

            <button
              style={{
                ...shared.btnPrimary,
                background: isDirty ? "#1a73e8" : "#34a853",
                opacity: saving ? 0.7 : 1,
              }}
              onClick={onSave}
              disabled={saving}
              title="Save (Ctrl+S / Cmd+S)"
            >
              {saving
                ? <><span style={shared.spinner} /> Saving…</>
                : isDirty ? "Save" : "✓ Saved"}
            </button>
          </div>
        </div>

        {/* ── Themed + fonted textarea ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <textarea
            style={{
              ...s.textarea,
              ...currentTpl.editorStyle,
              color:      currentTpl.editorStyle.color,
              fontFamily: currentFont.editorFamily,
              fontSize:   "16px",
              lineHeight: "28px",   // visually matches the CSS ruled-line spacing
            }}
            value={pages[currentPage]?.data ?? ""}
            placeholder="Start writing…"
            onChange={handleTextChange}
          />
        </div>

        {/* ── Pagination ── */}
        <div style={s.pagination}>
          <button style={s.pageBtn} disabled={currentPage === 0}
            onClick={() => setCurrentPage((p) => p - 1)}>← Prev</button>

          <span style={s.pageLabel}>
            Page {currentPage + 1} / {pages.length || 1}
          </span>

          <button style={s.pageBtn} disabled={currentPage >= pages.length - 1}
            onClick={() => setCurrentPage((p) => p + 1)}>Next →</button>

          <button style={{ ...s.pageBtn, marginLeft: 6 }} onClick={addPage}>
            + Page
          </button>

          {pages.length > 1 && (
            <button
              style={{ ...s.pageBtn, color: "#d93025", borderColor: "#f5c6c6" }}
              onClick={deletePage}
            >✕ Page</button>
          )}
        </div>
      </div>
    </main>
  );
}

// ── Local styles just for this component ─────────────────────────────────────
const st = {
  fontPickerWrap: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #dadce0",
    borderRadius: 6,
    background: "#fff",
    padding: "0 6px 0 8px",
    gap: 4,
    height: 32,
  },
  fontPickerIcon: {
    fontSize: 14,
    color: "#5f6368",
    flexShrink: 0,
  },
  fontSelect: {
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 13,
    color: "#3c4043",
    cursor: "pointer",
    maxWidth: 130,
  },
};
