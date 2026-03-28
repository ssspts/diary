// src/components/DiarySidebar.jsx
// Sidebar 1 — shows the list of Diary books. User picks one to open.
import { useState } from "react";

export default function DiarySidebar({
  diaries, selectedDiary, loadingDiaries,
  deletingDiaryId, editingDiaryId, setEditingDiaryId,
  tempDiaryName, setTempDiaryName,
  onAdd, onDelete, onRename, onOpen,
}) {
  const [hovered, setHovered] = useState(null);

  return (
    <aside style={s.aside}>
      <div style={s.header}>
        <span style={s.headerTitle}>My Diaries</span>
        <button style={s.addBtn} onClick={onAdd} title="New diary">+</button>
      </div>

      <div style={s.list}>
        {loadingDiaries && <div style={s.empty}>Loading…</div>}
        {!loadingDiaries && diaries.length === 0 && (
          <div style={s.empty}>
            No diaries yet.
            <div style={{ marginTop:6, fontSize:11, color:"#9aa0a6" }}>Hit + to create one.</div>
          </div>
        )}

        {diaries.map((diary) => {
          const active    = selectedDiary?.id === diary.id;
          const isEditing = editingDiaryId === diary.id;
          const deleting  = deletingDiaryId === diary.id;

          return (
            <div
              key={diary.id}
              style={{
                ...s.row,
                background: active ? "#e8f0fe" : hovered === diary.id ? "#f8f9fa" : "transparent",
              }}
              onMouseEnter={() => setHovered(diary.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => !isEditing && onOpen(diary)}
            >
              <span style={s.emoji}>{diary.emoji || "📔"}</span>

              {isEditing ? (
                <input
                  autoFocus
                  value={tempDiaryName}
                  onChange={(e) => setTempDiaryName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter")  { await onRename(diary.id, tempDiaryName); setEditingDiaryId(null); }
                    if (e.key === "Escape") { setEditingDiaryId(null); }
                  }}
                  onBlur={async () => { await onRename(diary.id, tempDiaryName); setEditingDiaryId(null); }}
                  style={s.renameInput}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span style={{ ...s.name, color: active ? "#1a73e8" : "#202124", fontWeight: active ? 600 : 400 }}>
                  {diary.name}
                </span>
              )}

              {!isEditing && (hovered === diary.id || active) && (
                <div style={s.actions} onClick={(e) => e.stopPropagation()}>
                  <button style={s.iconBtn} title="Rename"
                    onClick={() => { setEditingDiaryId(diary.id); setTempDiaryName(diary.name); }}>✏️</button>
                  <button
                    style={{ ...s.iconBtn, opacity: deleting ? 0.4 : 1 }}
                    title="Delete" disabled={deleting}
                    onClick={async () => {
                      if (window.confirm(`Delete "${diary.name}" and all its entries?`))
                        await onDelete(diary.id);
                    }}
                  >🗑️</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

const s = {
  aside:       { width:200, borderRight:"1px solid #e8eaed", display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0 },
  header:      { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 12px 10px", borderBottom:"1px solid #f1f3f4", flexShrink:0 },
  headerTitle: { fontSize:13, fontWeight:700, color:"#202124" },
  addBtn:      { width:26, height:26, borderRadius:"50%", border:"none", background:"#1a73e8", color:"#fff", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1, paddingBottom:1 },
  list:        { flex:1, overflowY:"auto", padding:"6px 8px" },
  empty:       { padding:"24px 8px", textAlign:"center", fontSize:13, color:"#80868b" },
  row:         { display:"flex", alignItems:"center", padding:"9px 8px", borderRadius:8, cursor:"pointer", gap:8, marginBottom:2 },
  emoji:       { fontSize:18, flexShrink:0 },
  name:        { flex:1, fontSize:13, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" },
  actions:     { display:"flex", gap:2, flexShrink:0 },
  iconBtn:     { border:"none", background:"transparent", cursor:"pointer", fontSize:13, padding:"2px 4px", borderRadius:4 },
  renameInput: { flex:1, fontSize:13, padding:"2px 6px", border:"1px solid #1a73e8", borderRadius:4, outline:"none", minWidth:0 },
};
