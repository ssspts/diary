// src/components/Navbar.jsx
import { navbar as s } from "../styles/tokens";
import HoverRow from "./HoverRow.jsx";

/**
 * Props:
 *   user            – Firebase user object
 *   menuRef         – ref for outside-click detection
 *   searchRef       – ref for outside-click detection
 *   showMenu        – boolean
 *   setShowMenu     – setter
 *   showProfile     – boolean (unused here, triggers parent)
 *   setShowProfile  – setter
 *   searchQuery     – string
 *   setSearchQuery  – setter
 *   searchFocused   – boolean
 *   setSearchFocused– setter
 *   searchResults   – array of file objects
 *   onSearchSelect  – (file) => void  called when user clicks a result
 *   onLogout        – () => void
 */
export default function Navbar({
  user, menuRef, searchRef,
  showMenu, setShowMenu, setShowProfile,
  searchQuery, setSearchQuery,
  searchFocused, setSearchFocused,
  searchResults, onSearchSelect,
  onLogout,
}) {
  const showDrop = searchFocused && searchQuery.trim().length > 0;

  return (
    <nav style={s.bar}>
      <span style={s.brand}>📖 Diary</span>

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
