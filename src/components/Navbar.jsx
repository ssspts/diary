// src/components/Navbar.jsx
import { useState } from "react";
import { navbar as s } from "../styles/tokens";
import HoverRow from "./HoverRow";

export default function Navbar({
  user, menuRef, searchRef,
  showMenu, setShowMenu, setShowProfile,
  searchQuery, setSearchQuery,
  searchFocused, setSearchFocused,
  searchResults,          // [{ dateKey, date, contentText, diaryName }]
  onSearchSelect,         // ({ dateKey, diary }) => void
  onLogout,
  appTitle, onAppTitleSave,
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle]       = useState("");
  const showDrop = searchFocused && searchQuery.trim().length > 0;

  return (
    <nav style={s.bar}>
      {/* Customisable app title */}
      {editingTitle ? (
        <input
          autoFocus
          value={tempTitle}
          onChange={(e) => setTempTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")  { onAppTitleSave(tempTitle); setEditingTitle(false); }
            if (e.key === "Escape") { setEditingTitle(false); }
          }}
          onBlur={() => { onAppTitleSave(tempTitle); setEditingTitle(false); }}
          style={st.titleInput}
        />
      ) : (
        <span style={{ ...s.brand, cursor:"pointer" }} title="Click to rename" onClick={() => { setTempTitle(appTitle); setEditingTitle(true); }}>
          📖 {appTitle}
        </span>
      )}

      {/* Search */}
      <div ref={searchRef} style={s.center}>
        <div style={s.searchWrapper}>
          <span style={s.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search entries…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            style={s.searchInput}
          />
          {searchQuery && (
            <button style={s.searchClear} onClick={() => { setSearchQuery(""); setSearchFocused(false); }}>✕</button>
          )}
          {showDrop && (
            <div style={s.dropdown}>
              {searchResults.length > 0 ? searchResults.map((r, i) => (
                <HoverRow key={i} style={s.searchItem} onClick={() => { onSearchSelect(r); setSearchQuery(""); setSearchFocused(false); }}>
                  <div style={s.searchName}>{r.date?.toDateString?.() || r.dateKey}</div>
                  <div style={s.searchDate}>{(r.contentText || "").slice(0, 60)}{r.contentText?.length > 60 ? "…" : ""}</div>
                </HoverRow>
              )) : <div style={s.noResult}>No results found</div>}
            </div>
          )}
        </div>
      </div>

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
  titleInput: { fontSize:15, fontWeight:700, border:"none", borderBottom:"2px solid #1a73e8", outline:"none", padding:"2px 4px", color:"#202124", background:"transparent", minWidth:120, maxWidth:220 },
};
