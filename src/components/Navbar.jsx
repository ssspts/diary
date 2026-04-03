// src/components/Navbar.jsx
import { useState } from "react";
import { navbar as s } from "../styles/tokens";
import HoverRow from "./HoverRow";

// Highlight matched query inside text
function Highlight({ text, query }) {
  if (!query || !text) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
      <span>
      {text.slice(0, idx)}
        <mark style={{ background:"#fbbc04", color:"#202124", borderRadius:2, padding:"0 1px" }}>
        {text.slice(idx, idx + query.length)}
      </mark>
        {text.slice(idx + query.length)}
    </span>
  );
}

// Format dateKey "YYYY-MM-DD" → "Mon, 2 Jun 2025"
function formatDate(dateKey) {
  if (!dateKey) return "";
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday:"short", day:"numeric", month:"short", year:"numeric",
  });
}

// Trim body text to a short snippet around the matched query
function bodySnippet(text, query, maxLen = 80) {
  if (!text) return "";
  const idx = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? "…" : "");
  const start  = Math.max(0, idx - 30);
  const end    = Math.min(text.length, idx + query.length + 40);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end) + suffix;
}

export default function Navbar({
                                 user, menuRef, searchRef,
                                 showMenu, setShowMenu, setShowProfile, onFeedback,
                                 searchQuery, setSearchQuery,
                                 searchFocused, setSearchFocused,
                                 searchResults,
                                 onSearchSelect,
                                 onLogout,
                                 appTitle, onAppTitleSave,
                               }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle,    setTempTitle]    = useState("");
  const showDrop = searchFocused && searchQuery.trim().length > 0;

  return (
      <nav style={s.bar}>
        {/* App title */}
        {editingTitle ? (
            <input
                autoFocus value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  { onAppTitleSave(tempTitle); setEditingTitle(false); }
                  if (e.key === "Escape") { setEditingTitle(false); }
                }}
                onBlur={() => { onAppTitleSave(tempTitle); setEditingTitle(false); }}
                style={st.titleInput}
            />
        ) : (
            <span style={{ ...s.brand, cursor:"pointer" }} title="Click to rename"
                  onClick={() => { setTempTitle(appTitle); setEditingTitle(true); }}>
          📖 {appTitle}
        </span>
        )}

        {/* Search */}
        <div ref={searchRef} style={s.center}>
          <div style={s.searchWrapper}>
            <span style={s.searchIcon}>🔍</span>
            <input
                type="text"
                placeholder="Search entries by title, date or content…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                style={s.searchInput}
            />
            {searchQuery && (
                <button style={s.searchClear}
                        onClick={() => { setSearchQuery(""); setSearchFocused(false); }}>✕</button>
            )}

            {/* ── Dropdown ── */}
            {showDrop && (
                <div style={st.dropdown}>
                  {searchResults.length === 0 ? (
                      <div style={st.noResult}>
                        <span style={{ fontSize:20 }}>🔍</span>
                        <div style={{ marginTop:6, fontSize:13, color:"#80868b" }}>No entries found</div>
                        <div style={{ fontSize:11, color:"#9aa0a6", marginTop:2 }}>Try a different title, date or keyword</div>
                      </div>
                  ) : (
                      <>
                        <div style={st.resultCount}>
                          {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                        </div>
                        {searchResults.map((r, i) => (
                            <HoverRow
                                key={i}
                                style={st.resultRow}
                                onClick={() => {
                                  onSearchSelect(r);
                                  setSearchQuery("");
                                  setSearchFocused(false);
                                }}
                            >
                              {/* Left: diary emoji badge */}
                              <div style={st.resultEmoji}>{r.diaryEmoji}</div>

                              {/* Right: details */}
                              <div style={st.resultBody}>
                                {/* Row 1: diary name */}
                                <div style={st.resultDiary}>
                                  <Highlight text={r.diaryName} query={searchQuery} />
                                </div>

                                {/* Row 2: entry title */}
                                <div style={st.resultTitle}>
                                  <Highlight
                                      text={r.entryTitle || formatDate(r.dateKey)}
                                      query={searchQuery}
                                  />
                                </div>

                                {/* Row 3: date + body snippet */}
                                <div style={st.resultMeta}>
                                  <span style={st.resultDate}>{formatDate(r.dateKey)}</span>
                                  {r.contentText && (
                                      <>
                                        <span style={{ color:"#dadce0", margin:"0 4px" }}>·</span>
                                        <span style={st.resultSnippet}>
                                <Highlight
                                    text={bodySnippet(r.contentText, searchQuery)}
                                    query={searchQuery}
                                />
                              </span>
                                      </>
                                  )}
                                </div>
                              </div>
                            </HoverRow>
                        ))}
                      </>
                  )}
                </div>
            )}
          </div>
        </div>

        {/* Feedback button */}
        <button
            style={st2.feedbackBtn}
            onClick={onFeedback}
            title="Send feedback"
        >
          💬 Feedback
        </button>

        {/* Avatar */}
        <div ref={menuRef} style={s.userSection}>
          <img src={user.photoURL} alt="avatar" style={s.avatar}
               onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }} />
          {showMenu && (
              <div style={s.userDropdown}>
                <HoverRow style={s.dropdownRow} onClick={() => { setShowProfile(true); setShowMenu(false); }}>
                  <img src={user.photoURL} alt="" style={s.dropdownAvatar} />
                  <div>
                    <div style={s.dropdownName}>{user.displayName || "User"}</div>
                    <div style={s.dropdownEmail}>{user.email}</div>
                  </div>
                </HoverRow>
                <div style={s.divider} />
                <HoverRow style={s.dropdownRow} onClick={onLogout}>
                  <span style={{ fontSize:14, color:"#3c4043" }}>Sign out</span>
                </HoverRow>
              </div>
          )}
        </div>
      </nav>
  );
}

const st = {
  titleInput: {
    fontSize:15, fontWeight:700, border:"none",
    borderBottom:"2px solid #1a73e8", outline:"none",
    padding:"2px 4px", color:"#202124", background:"transparent",
    minWidth:120, maxWidth:220,
  },
  dropdown: {
    position:"absolute", top:"calc(100% + 8px)", left:0, right:0,
    background:"#fff", border:"1px solid #e0e0e0",
    borderRadius:12, boxShadow:"0 6px 24px rgba(0,0,0,0.12)",
    zIndex:200, maxHeight:420, overflowY:"auto",
    minWidth:360,
  },
  resultCount: {
    padding:"8px 14px 6px",
    fontSize:11, fontWeight:600, color:"#9aa0a6",
    textTransform:"uppercase", letterSpacing:"0.05em",
    borderBottom:"1px solid #f1f3f4",
  },
  resultRow: {
    display:"flex", alignItems:"flex-start", gap:10,
    padding:"10px 14px", borderBottom:"1px solid #f8f9fa",
    cursor:"pointer",
  },
  resultEmoji: {
    fontSize:22, flexShrink:0, marginTop:2,
    width:28, textAlign:"center",
  },
  resultBody: {
    flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:2,
  },
  resultDiary: {
    fontSize:11, color:"#1a73e8", fontWeight:600,
    textTransform:"uppercase", letterSpacing:"0.04em",
  },
  resultTitle: {
    fontSize:14, fontWeight:600, color:"#202124",
    overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis",
  },
  resultMeta: {
    display:"flex", alignItems:"center", gap:0, flexWrap:"wrap",
  },
  resultDate: {
    fontSize:11, color:"#80868b", flexShrink:0,
  },
  resultSnippet: {
    fontSize:11, color:"#9aa0a6",
    overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis",
    maxWidth:220,
  },
  noResult: {
    padding:"28px 16px", textAlign:"center",
    display:"flex", flexDirection:"column", alignItems:"center",
  },
};

const st2 = {
  feedbackBtn: {
    display:      "flex",
    alignItems:   "center",
    gap:          5,
    padding:      "6px 12px",
    border:       "1px solid #dadce0",
    borderRadius: 20,
    background:   "#fff",
    cursor:       "pointer",
    fontSize:     12,
    fontWeight:   500,
    color:        "#3c4043",
    whiteSpace:   "nowrap",
    flexShrink:   0,
  },
};