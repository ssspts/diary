// src/App.jsx
import { useEffect } from "react";
import { useDiary }       from "./hooks/useDiary";
import { exportPdf }      from "./hooks/exportPdf.js";
import { ensureMeta, HANDWRITING_FONTS, FONT_KEYS } from "./utils/templates";
import { layout }         from "./styles/tokens";

import LoginPage      from "./components/LoginPage";
import Navbar         from "./components/Navbar";
import DateSidebar    from "./components/DateSidebar";
import FileSidebar    from "./components/FileSidebar";
import Editor         from "./components/Editor";
import TemplatePicker from "./components/TemplatePicker";
import ProfileModal   from "./components/ProfileModal";

// ── Build Google Fonts URL from the HANDWRITING_FONTS catalogue ───────────────
const googleFamilies = FONT_KEYS
  .map((k) => HANDWRITING_FONTS[k].googleFamily)
  .filter(Boolean);
const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=" +
  googleFamilies.map((f) => f.replace(/ /g, "+")).join("&family=") +
  "&display=swap";

const GLOBAL_CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #dadce0; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #bdc1c6; }
`;

export default function App() {
  const diary = useDiary();

  useEffect(() => {
    // Inject global CSS
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);

    // Inject Google Fonts link so handwriting fonts load in the browser editor
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(style);
      document.head.removeChild(link);
    };
  }, []);

  if (!diary.user) return <LoginPage onLogin={diary.googleLogin} />;

  const handleDateSelect = (date) => {
    diary.setSelectedDate(date);
    diary.setSelectedFile(null);
    diary.setIsDirty(false);
  };

  // FIX 3 — applyToAll flag from TemplatePicker
  const handleTemplateSelect = (key, applyToAll) => {
    const updated = diary.pages.map((page, i) => {
      if (!applyToAll && i !== diary.currentPage) return page;
      const cur = ensureMeta(page);
      return { ...cur, meta: { ...cur.meta, template: key } };
    });
    diary.setPages(updated);
    diary.setIsDirty(true);
    diary.setShowTemplatePicker(false);
  };

  return (
    <div style={layout.wrapper}>
      <Navbar
        user={diary.user}
        menuRef={diary.menuRef}
        searchRef={diary.searchRef}
        showMenu={diary.showMenu}
        setShowMenu={diary.setShowMenu}
        setShowProfile={diary.setShowProfile}
        searchQuery={diary.searchQuery}
        setSearchQuery={diary.setSearchQuery}
        searchFocused={diary.searchFocused}
        setSearchFocused={diary.setSearchFocused}
        searchResults={diary.searchResults}
        onSearchSelect={(f) => {
          diary.setSelectedDate(new Date(f.createdAt));
          diary.openFile(f);
        }}
        onLogout={diary.logout}
        diaryTitle={diary.diaryTitle}
        onDiaryTitleSave={diary.updateDiaryTitle}
      />

      <div style={layout.body}>
        <DateSidebar
          files={diary.files}
          selectedDate={diary.selectedDate}
          expandedMonths={diary.expandedMonths}
          setExpandedMonths={diary.setExpandedMonths}
          groupDatesByMonth={diary.groupDatesByMonth}
          isSameDay={diary.isSameDay}
          onDateSelect={handleDateSelect}
        />

        <FileSidebar
          filteredFiles={diary.filteredFiles}
          selectedFile={diary.selectedFile}
          searchQuery={diary.searchQuery}
          selectedDate={diary.selectedDate}
          loading={diary.loading}
          deletingFileId={diary.deletingFileId}
          editingFileId={diary.editingFileId}
          tempFileName={diary.tempFileName}
          setTempFileName={diary.setTempFileName}
          setEditingFileId={diary.setEditingFileId}
          onOpen={diary.openFile}
          onAdd={diary.addFile}
          onDelete={diary.deleteFile}
          onRename={diary.renameFile}
        />

        <Editor
          selectedFile={diary.selectedFile}
          pages={diary.pages}
          setPages={diary.setPages}
          currentPage={diary.currentPage}
          setCurrentPage={diary.setCurrentPage}
          isDirty={diary.isDirty}
          setIsDirty={diary.setIsDirty}
          saving={diary.saving}
          editingTitle={diary.editingTitle}
          setEditingTitle={diary.setEditingTitle}
          tempTitle={diary.tempTitle}
          setTempTitle={diary.setTempTitle}
          titleInputRef={diary.titleInputRef}
          onSave={diary.saveContent}
          onDownloadPdf={() => exportPdf(diary.selectedFile, diary.pages)}
          onOpenTemplatePicker={() => diary.setShowTemplatePicker(true)}
          onRenameFile={diary.renameFile}
        />
      </div>

      {diary.showTemplatePicker && (
        <TemplatePicker
          currentTplKey={diary.pages[diary.currentPage]?.meta?.template || "plain"}
          onSelect={handleTemplateSelect}
          onClose={() => diary.setShowTemplatePicker(false)}
        />
      )}

      {diary.showProfile && (
        <ProfileModal
          user={diary.user}
          onClose={() => diary.setShowProfile(false)}
          onLogout={diary.logout}
        />
      )}
    </div>
  );
}
