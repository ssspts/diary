// src/components/Navbar.jsx
import { useState } from "react";
import { navbar as s } from "../styles/tokens";
import HoverRow from "./HoverRow";

/**
 * Props:
 *   user, menuRef, searchRef, showMenu, setShowMenu, setShowProfile,
 *   searchQuery, setSearchQuery, searchFocused, setSearchFocused,
 *   searchResults, onSearchSelect, onLogout,
 *   diaryTitle        – string, the customizable app title
 *   onDiaryTitleSave  – (newTitle: string) => void
 */
export default function Navbar({
  user, menuRef, searchRef,
  showMenu, setShowMenu, setShowProfile,
  searchQuery, setSearchQuery,
  searchFocused, setSearchFocused,
  searchResults, onSearchSelect,
  onLogout,
  diaryTitle, onDiaryTitleSave,
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle]       = useState("");
  const showDrop = searchFocused && searchQuery.trim().length > 0;

  const startEdit = () => { setTempTitle(diaryTitle); setEditingTitle(true); };
  const commitEdit = () => {
    onDiaryTitleSave(tempTitle);
    setEditingTitle(false);
  };

  return (
    <nav style={s.bar}>

      {/* ── Customizable diary title ── */}
      {editingTitle ? (
        <input
          autoFocus
          value={tempTitle}
          onChange={(e) => setTempTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")  commitEdit();
            if (e.key === "Escape") setEditingTitle(false);
          }}
          onBlur={commitEdit}
          style={st.titleInput}
        />
      ) : (
        <span
          style={s.brand}
          title="Click to rename your diary"
          onClick={startEdit}
        >
          📖 {diaryTitle}
          <span style={st.editHint}>✎</span>
        </span>
      )}

      {/* ── Search ── */}
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
            <button
              style={s.searchClear}
              onClick={() => { setSearchQuery(""); setSearchFocused(false); }}
            >✕</button>
          )}
          {showDrop && (
            <div style={s.dropdown}>
              {searchResults.length > 0 ? searchResults.map((f) => (
                <HoverRow
                  key={f.id}
                  style={s.searchItem}
                  onClick={() => {
                    onSearchSelect(f);
                    setSearchQuery("");
                    setSearchFocused(false);
                  }}
                >
                  <div style={s.searchName}>{f.name}</div>
                  <div style={s.searchDate}>{new Date(f.createdAt).toDateString()}</div>
                </HoverRow>
              )) : (
                <div style={s.noResult}>No results found</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── User avatar + dropdown ── */}
      <div ref={menuRef} style={s.userSection}>
        <img
          src={user.photoURL}
          alt="avatar"
          style={s.avatar}
          onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
        />
        {showMenu && (
          <div style={s.userDropdown}>
            <HoverRow
              style={s.dropdownRow}
              onClick={() => { setShowProfile(true); setShowMenu(false); }}
            >
              <img src={user.photoURL} alt="" style={s.dropdownAvatar} />
              <div>
                <div style={s.dropdownName}>{user.displayName || "User"}</div>
                <div style={s.dropdownEmail}>{user.email}</div>
              </div>
            </HoverRow>
            <div style={s.divider} />
            <HoverRow style={s.dropdownRow} onClick={onLogout}>
              <span style={{ fontSize: 14, color: "#3c4043" }}>Sign out</span>
            </HoverRow>
          </div>
        )}
      </div>
    </nav>
  );
}

const st = {
  titleInput: {
    fontSize: 15, fontWeight: 700, border: "none",
    borderBottom: "2px solid #1a73e8", outline: "none",
    padding: "2px 4px", color: "#202124", background: "transparent",
    minWidth: 120, maxWidth: 220,
  },
  editHint: {
    fontSize: 11, marginLeft: 5, opacity: 0,
    transition: "opacity 0.15s",
    // We show it on parent hover via CSS injection below — approximated with always-dim
    color: "#9aa0a6",
  },
};
