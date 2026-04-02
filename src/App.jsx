// src/App.jsx
import { useEffect, useState } from "react";
import { useDiary }       from "./hooks/useDiary";
import { ensureMeta, HANDWRITING_FONTS, FONT_KEYS } from "./utils/templates";
import { layout }         from "./styles/tokens";

import LoginPage      from "./components/LoginPage";
import Navbar         from "./components/Navbar";
import DiarySidebar   from "./components/DiarySidebar";
import DateSidebar    from "./components/DateSidebar";
import Editor         from "./components/Editor";
import TemplatePicker from "./components/TemplatePicker";
import ProfileModal   from "./components/ProfileModal";
import FeedbackDialog from "./components/FeedbackDialog";

const googleFamilies = FONT_KEYS
    .map((k) => HANDWRITING_FONTS[k].googleFamily).filter(Boolean);
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
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
    return () => { document.head.removeChild(style); document.head.removeChild(link); };
  }, []);

  if (!diary.user) return <LoginPage onLogin={diary.googleLogin} />;

  const handleTemplateSelect = (key, applyToAll) => {
    const updated = diary.pages.map((page, i) => {
      const cur = ensureMeta(page);
      // applyToAll = true  → change every page
      // applyToAll = false → change only the focused/current page
      if (!applyToAll && i !== diary.currentPage) return cur; // preserve other pages unchanged
      return {
        ...cur,
        meta: { ...cur.meta, template: key },
      };
    });
    diary.setPages(updated);
    diary.setIsDirty(true);
    diary.setHasEdits(true);
    diary.setShowTemplatePicker(false);
  };

  return (
      <div style={layout.wrapper}>

        {/* Navbar */}
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
            onSearchSelect={(r) => { if (r.date) diary.selectDate(r.date); }}
            onLogout={diary.logout}
            appTitle={diary.appTitle}
            onAppTitleSave={diary.updateAppTitle}
            onFeedback={() => setShowFeedback(true)}
        />

        <div style={layout.body}>

          {/* Sidebar 1: Diaries */}
          <DiarySidebar
              diaries={diary.diaries}
              selectedDiary={diary.selectedDiary}
              loadingDiaries={diary.loadingDiaries}
              deletingDiaryId={diary.deletingDiaryId}
              editingDiaryId={diary.editingDiaryId}
              setEditingDiaryId={diary.setEditingDiaryId}
              tempDiaryName={diary.tempDiaryName}
              setTempDiaryName={diary.setTempDiaryName}
              onAdd={diary.addDiary}
              onDelete={diary.deleteDiary}
              onRename={diary.renameDiary}
              onOpen={diary.openDiary}
          />

          {/* Sidebar 2: Dates */}
          <DateSidebar
              selectedDiary={diary.selectedDiary}
              entriesMeta={diary.entriesMeta}
              selectedDate={diary.selectedDate}
              expandedMonths={diary.expandedMonths}
              setExpandedMonths={diary.setExpandedMonths}
              groupDatesByMonth={diary.groupDatesByMonth}
              isSameDay={diary.isSameDay}
              onDateSelect={diary.selectDate}
          />

          {/* Editor */}
          <Editor
              selectedDiary={diary.selectedDiary}
              selectedDate={diary.selectedDate}
              pages={diary.pages}
              setPages={diary.setPages}
              currentPage={diary.currentPage}
              setCurrentPage={diary.setCurrentPage}
              isDirty={diary.isDirty}
              setIsDirty={diary.setIsDirty}
              hasEdits={diary.hasEdits}
              setHasEdits={diary.setHasEdits}
              saving={diary.saving}
              entryTitle={diary.entryTitle}
              setEntryTitle={diary.setEntryTitle}
              onSave={diary.saveContent}
              onOpenTemplatePicker={() => diary.setShowTemplatePicker(true)}
          />
        </div>

        {/* Template picker modal */}
        {diary.showTemplatePicker && (
            <TemplatePicker
                currentTplKey={
                    diary.pages[diary.currentPage]?.meta?.template || "plain"
                }
                onSelect={handleTemplateSelect}
                onClose={() => diary.setShowTemplatePicker(false)}
            />
        )}

        {/* Profile modal */}
        {diary.showProfile && (
            <ProfileModal
                user={diary.user}
                onClose={() => diary.setShowProfile(false)}
                onLogout={diary.logout}
            />
        )}

        {/* Feedback dialog */}
        {showFeedback && (
            <FeedbackDialog
                user={diary.user}
                onClose={() => setShowFeedback(false)}
            />
        )}
      </div>
  );
}