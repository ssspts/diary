// src/styles/tokens.js
// ─────────────────────────────────────────────────────────────────────────────
// All shared inline-style objects.  Import only the slice you need in each
// component — this avoids shipping the entire token map to every file.
// ─────────────────────────────────────────────────────────────────────────────

export const layout = {
  wrapper:    { height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff" },
  body:       { display: "flex", flex: 1, overflow: "hidden" },
  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 },
};

export const login = {
  page:       { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#f8f9fa" },
  card:       { background: "#fff", padding: "40px 48px", borderRadius: 16, border: "1px solid #e8eaed", textAlign: "center", maxWidth: 360, width: "90%" },
  title:      { margin: "0 0 4px", fontSize: 26, fontWeight: 700, color: "#202124" },
  sub:        { margin: "0 0 28px", color: "#5f6368", fontSize: 14 },
  googleBtn:  { display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "10px 16px", border: "1px solid #dadce0", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 500, color: "#3c4043" },
};

export const navbar = {
  bar:          { height: 56, display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid #e8eaed", gap: 12, flexShrink: 0 },
  brand:        { fontWeight: 700, fontSize: 16, color: "#202124", whiteSpace: "nowrap" },
  center:       { flex: 1, display: "flex", justifyContent: "center", maxWidth: 480, margin: "0 auto" },
  searchWrapper:{ position: "relative", width: "100%" },
  searchIcon:   { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none" },
  searchInput:  { width: "100%", padding: "7px 34px", borderRadius: 20, border: "1px solid #e0e0e0", background: "#f1f3f4", outline: "none", fontSize: 13, color: "#202124" },
  searchClear:  { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "#80868b", padding: 2 },
  dropdown:     { position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 200, maxHeight: 280, overflowY: "auto" },
  searchItem:   { padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f3f4" },
  searchName:   { fontSize: 13, color: "#202124", fontWeight: 500 },
  searchDate:   { fontSize: 11, color: "#80868b", marginTop: 2 },
  noResult:     { padding: 16, fontSize: 13, color: "#80868b", textAlign: "center" },
  userSection:  { position: "relative", marginLeft: "auto" },
  avatar:       { width: 32, height: 32, borderRadius: "50%", cursor: "pointer", border: "2px solid #e8eaed" },
  userDropdown: { position: "absolute", top: 42, right: 0, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", minWidth: 220, zIndex: 300 },
  dropdownRow:  { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" },
  dropdownAvatar:{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 },
  dropdownName: { fontSize: 13, fontWeight: 600, color: "#202124" },
  dropdownEmail:{ fontSize: 11, color: "#80868b" },
  divider:      { height: 1, background: "#f1f3f4", margin: "2px 0" },
};

export const dateSidebar = {
  aside:       { width: 180, borderRight: "1px solid #e8eaed", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 },
  pickerWrap:  { padding: "10px 10px 6px" },
  picker:      { width: "100%", padding: "7px 8px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 12, color: "#202124", outline: "none", background: "#fff" },
  list:        { flex: 1, overflowY: "auto", padding: "0 6px 8px" },
  monthHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 6px 4px", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#80868b", textTransform: "uppercase", letterSpacing: "0.05em", userSelect: "none" },
  dateItem:    { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", cursor: "pointer", fontSize: 12, margin: "1px 0", borderRadius: 6 },
  entryDot:    { width: 5, height: 5, borderRadius: "50%", background: "#1a73e8", flexShrink: 0 },
};

export const fileSidebar = {
  aside:      { width: 220, borderRight: "1px solid #e8eaed", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 },
  header:     { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 12px 10px", borderBottom: "1px solid #f1f3f4", flexShrink: 0 },
  title:      { fontSize: 13, fontWeight: 600, color: "#3c4043" },
  addBtn:     { width: 26, height: 26, borderRadius: "50%", border: "none", background: "#1a73e8", color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, paddingBottom: 1 },
  scroll:     { flex: 1, overflowY: "auto", padding: "6px 8px" },
  empty:      { padding: "28px 12px", textAlign: "center", fontSize: 13, color: "#80868b" },
  row:        { display: "flex", alignItems: "center", padding: "7px 8px", borderRadius: 8, cursor: "pointer", gap: 4, marginBottom: 1 },
  name:       { flex: 1, fontSize: 13, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  actions:    { display: "flex", gap: 0, flexShrink: 0 },
  iconBtn:    { border: "none", background: "transparent", cursor: "pointer", fontSize: 13, padding: "3px 5px", borderRadius: 4 },
  renameInput:{ flex: 1, fontSize: 13, padding: "2px 6px", border: "1px solid #1a73e8", borderRadius: 4, outline: "none", minWidth: 0 },
};

export const editor = {
  pane:       { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  empty:      { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  inner:      { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" },
  toolbar:    { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "12px 20px 10px", borderBottom: "1px solid #f1f3f4", gap: 12, flexShrink: 0 },
  toolbarLeft:{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  toolbarRight:{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  entryTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: "#202124", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, userSelect: "none" },
  dirtyDot:   { width: 7, height: 7, borderRadius: "50%", background: "#fbbc04", display: "inline-block", flexShrink: 0 },
  entryMeta:  { fontSize: 11, color: "#9aa0a6" },
  titleInput: { fontSize: 15, fontWeight: 600, border: "none", borderBottom: "2px solid #1a73e8", outline: "none", padding: "1px 0", color: "#202124", width: 260, background: "transparent" },
  themeBtn:   { display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", border: "1px solid #dadce0", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 13, color: "#3c4043", whiteSpace: "nowrap" },
  textarea:   { flex: 1, padding: "20px 24px", border: "none", outline: "none", resize: "none", fontSize: 14, lineHeight: 1.8, fontFamily: "inherit", width: "100%", height: "100%" },
  pagination: { display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderTop: "1px solid #f1f3f4", flexShrink: 0, background: "#fafafa" },
  pageBtn:    { padding: "5px 10px", border: "1px solid #e0e0e0", background: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#3c4043" },
  pageLabel:  { fontSize: 12, color: "#9aa0a6", margin: "0 4px" },
};

export const shared = {
  btnPrimary: { padding: "7px 14px", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" },
  btnOutline: { padding: "6px 12px", background: "#fff", color: "#3c4043", border: "1px solid #dadce0", borderRadius: 6, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" },
  spinner:    { width: 12, height: 12, border: "2px solid rgba(255,255,255,0.35)", borderTop: "2px solid #fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" },
};

export const templatePicker = {
  modal:      { background: "#fff", borderRadius: 16, padding: "24px 28px", width: 620, maxWidth: "95vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.15)" },
  header:     { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title:      { fontSize: 17, fontWeight: 700, color: "#202124" },
  closeBtn:   { border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: "#80868b", padding: 4 },
  sub:        { fontSize: 13, color: "#80868b", margin: "0 0 20px" },
  grid:       { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 },
  card:       { borderRadius: 12, border: "2px solid #e8eaed", cursor: "pointer", overflow: "hidden", position: "relative", transition: "border-color 0.15s, box-shadow 0.15s" },
  cardActive: { borderColor: "#1a73e8", boxShadow: "0 0 0 3px rgba(26,115,232,0.15)" },
  preview:    { height: 110, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 6px 6px" },
  label:      { fontSize: 12, fontWeight: 600, color: "#3c4043", padding: "7px 8px", textAlign: "center", background: "#fafafa", borderTop: "1px solid #f1f3f4" },
  check:      { position: "absolute", top: 6, right: 8, fontSize: 13, color: "#1a73e8", fontWeight: 700 },
};

export const profileModal = {
  modal:      { background: "#fff", borderRadius: 14, padding: "32px 36px", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", alignItems: "center" },
  img:        { width: 72, height: 72, borderRadius: "50%", marginBottom: 12, border: "3px solid #e8eaed" },
  name:       { fontSize: 17, fontWeight: 700, color: "#202124", marginBottom: 2 },
  email:      { fontSize: 13, color: "#80868b" },
};
