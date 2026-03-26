// src/components/FileSidebar.jsx
import { fileSidebar as s } from "../styles/tokens";

/**
 * Props:
 *   filteredFiles   – array of file objects to display
 *   selectedFile    – currently open file (or null)
 *   searchQuery     – string (controls header label)
 *   selectedDate    – Date  (controls header label)
 *   loading         – boolean (disables + button while creating)
 *   deletingFileId  – string | null
 *   editingFileId   – string | null
 *   tempFileName    – string
 *   setTempFileName – setter
 *   setEditingFileId– setter
 *   onOpen          – (file) => void
 *   onAdd           – () => void
 *   onDelete        – (id) => void
 *   onRename        – (id, newName) => void
 */
export default function FileSidebar({
  filteredFiles, selectedFile, searchQuery, selectedDate,
  loading, deletingFileId, editingFileId, tempFileName,
  setTempFileName, setEditingFileId,
  onOpen, onAdd, onDelete, onRename,
}) {
  const headerLabel = searchQuery
    ? `Results (${filteredFiles.length})`
    : selectedDate.toLocaleDateString("default", { month: "short", day: "numeric" });

  return (
    <aside style={s.aside}>
      {/* Header row */}
      <div style={s.header}>
        <span style={s.title}>{headerLabel}</span>
        <button style={s.addBtn} onClick={onAdd} disabled={loading} title="New entry">
          {loading ? "…" : "+"}
        </button>
      </div>

      {/* File list */}
      <div style={s.scroll}>
        {filteredFiles.length === 0 && (
          <div style={s.empty}>
            {searchQuery ? "No matches." : "No entries yet."}
            {!searchQuery && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#9aa0a6" }}>
                Hit + to add one.
              </div>
            )}
          </div>
        )}

        {filteredFiles.map((f) => {
          const active    = selectedFile?.id === f.id;
          const isEditing = editingFileId === f.id;
          const deleting  = deletingFileId === f.id;

          return (
            <div
              key={f.id}
              style={{ ...s.row, background: active ? "#e8f0fe" : "transparent" }}
              onClick={() => !isEditing && onOpen(f)}
            >
              {/* Name / rename input */}
              {isEditing ? (
                <input
                  autoFocus
                  value={tempFileName}
                  onChange={(e) => setTempFileName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter")  { await onRename(f.id, tempFileName); setEditingFileId(null); }
                    if (e.key === "Escape") { setEditingFileId(null); }
                  }}
                  style={s.renameInput}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span style={{
                  ...s.name,
                  color:      active ? "#1a73e8" : "#202124",
                  fontWeight: active ? 500 : 400,
                }}>
                  {f.name}
                </span>
              )}

              {/* Action buttons */}
              {!isEditing && (
                <div style={s.actions} onClick={(e) => e.stopPropagation()}>
                  <button
                    style={s.iconBtn}
                    title="Rename"
                    onClick={() => { setEditingFileId(f.id); setTempFileName(f.name); }}
                  >✏️</button>
                  <button
                    style={{ ...s.iconBtn, opacity: deleting ? 0.4 : 1 }}
                    title="Delete"
                    disabled={deleting}
                    onClick={async () => {
                      if (window.confirm(`Delete "${f.name}"?`)) await onDelete(f.id);
                    }}
                  >🗑️</button>
                </div>
              )}

              {isEditing && (
                <div style={s.actions} onClick={(e) => e.stopPropagation()}>
                  <button style={s.iconBtn} title="Confirm"
                    onClick={async () => { await onRename(f.id, tempFileName); setEditingFileId(null); }}>
                    ✔️
                  </button>
                  <button style={s.iconBtn} title="Cancel"
                    onClick={() => setEditingFileId(null)}>
                    ❌
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
