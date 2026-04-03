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

// Detect mobile via CSS media query — avoids any JS window sizing issues
function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        setIsMobile(mq.matches);
        const handler = (e) => setIsMobile(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    return isMobile;
}

export default function App() {
    const diary      = useDiary();
    const isMobile   = useIsMobile();
    const [showFeedback,   setShowFeedback]   = useState(false);
    const [showDiaries,    setShowDiaries]    = useState(false); // mobile collapsed state
    const [showDates,      setShowDates]      = useState(false); // mobile collapsed state

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
            if (!applyToAll && i !== diary.currentPage) return cur;
            return { ...cur, meta: { ...cur.meta, template: key } };
        });
        diary.setPages(updated);
        diary.setIsDirty(true);
        diary.setHasEdits(true);
        diary.setShowTemplatePicker(false);
    };

    // ── Desktop layout (unchanged) ────────────────────────────────────────────
    if (!isMobile) {
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
                    onSearchSelect={(r) => { if (r.date) diary.selectDate(r.date); }}
                    onLogout={diary.logout}
                    appTitle={diary.appTitle}
                    onAppTitleSave={diary.updateAppTitle}
                    onFeedback={() => setShowFeedback(true)}
                />
                <div style={layout.body}>
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
                {diary.showTemplatePicker && (
                    <TemplatePicker
                        currentTplKey={diary.pages[diary.currentPage]?.meta?.template || "plain"}
                        onSelect={handleTemplateSelect}
                        onClose={() => diary.setShowTemplatePicker(false)}
                    />
                )}
                {diary.showProfile && (
                    <ProfileModal user={diary.user} onClose={() => diary.setShowProfile(false)} onLogout={diary.logout} />
                )}
                {showFeedback && (
                    <FeedbackDialog user={diary.user} onClose={() => setShowFeedback(false)} />
                )}
            </div>
        );
    }

    // ── Mobile layout ─────────────────────────────────────────────────────────
    // Sidebars are collapsible drawers at top. Editor fills the rest.
    return (
        <div style={{ display:"flex", flexDirection:"column", height:"100svh", background:"#f1f3f4", overflow:"hidden" }}>

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

            {/* ── Mobile top pill bar: toggle diary + date selectors ── */}
            <div style={{
                display:        "flex",
                gap:            8,
                padding:        "8px 12px",
                background:     "#fff",
                borderBottom:   "1px solid #e8eaed",
                flexShrink:     0,
                alignItems:     "center",
                overflowX:      "auto",
                scrollbarWidth: "none",
            }}>
                {/* Diary pill */}
                <button
                    onClick={() => { setShowDiaries((v) => !v); setShowDates(false); }}
                    style={{
                        display:      "flex",
                        alignItems:   "center",
                        gap:          5,
                        padding:      "6px 12px",
                        borderRadius: 20,
                        border:       `1.5px solid ${showDiaries ? "#1a73e8" : "#dadce0"}`,
                        background:   showDiaries ? "#e8f0fe" : "#fff",
                        color:        showDiaries ? "#1a73e8" : "#5f6368",
                        fontSize:     12,
                        fontWeight:   600,
                        cursor:       "pointer",
                        whiteSpace:   "nowrap",
                        flexShrink:   0,
                    }}
                >
                    📔 {diary.selectedDiary?.name || "Select Diary"}
                    <span style={{ fontSize:10 }}>{showDiaries ? "▲" : "▼"}</span>
                </button>

                {/* Date pill */}
                <button
                    onClick={() => { setShowDates((v) => !v); setShowDiaries(false); }}
                    style={{
                        display:      "flex",
                        alignItems:   "center",
                        gap:          5,
                        padding:      "6px 12px",
                        borderRadius: 20,
                        border:       `1.5px solid ${showDates ? "#1a73e8" : "#dadce0"}`,
                        background:   showDates ? "#e8f0fe" : "#fff",
                        color:        showDates ? "#1a73e8" : "#5f6368",
                        fontSize:     12,
                        fontWeight:   600,
                        cursor:       "pointer",
                        whiteSpace:   "nowrap",
                        flexShrink:   0,
                    }}
                >
                    📅 {diary.selectedDate?.toLocaleDateString("default", { day:"numeric", month:"short" }) || "Date"}
                    <span style={{ fontSize:10 }}>{showDates ? "▲" : "▼"}</span>
                </button>

                {/* Save pill — shown when dirty */}
                {diary.isDirty && (
                    <button
                        onClick={diary.saveContent}
                        style={{
                            marginLeft:   "auto",
                            padding:      "6px 14px",
                            borderRadius: 20,
                            border:       "none",
                            background:   "#1a73e8",
                            color:        "#fff",
                            fontSize:     12,
                            fontWeight:   600,
                            cursor:       "pointer",
                            flexShrink:   0,
                        }}
                    >
                        {diary.saving ? "Saving…" : "💾 Save"}
                    </button>
                )}
            </div>

            {/* ── Collapsible: Diary sidebar ── */}
            {showDiaries && (
                <div style={{
                    background:   "#fff",
                    borderBottom: "2px solid #1a73e8",
                    maxHeight:    260,
                    overflowY:    "auto",
                    flexShrink:   0,
                }}>
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
                        onOpen={async (d, uid) => {
                            await diary.openDiary(d, uid);
                            setShowDiaries(false); // collapse after selection
                        }}
                    />
                </div>
            )}

            {/* ── Collapsible: Date sidebar ── */}
            {showDates && (
                <div style={{
                    background:   "#fff",
                    borderBottom: "2px solid #1a73e8",
                    maxHeight:    260,
                    overflowY:    "auto",
                    flexShrink:   0,
                }}>
                    <DateSidebar
                        selectedDiary={diary.selectedDiary}
                        entriesMeta={diary.entriesMeta}
                        selectedDate={diary.selectedDate}
                        expandedMonths={diary.expandedMonths}
                        setExpandedMonths={diary.setExpandedMonths}
                        groupDatesByMonth={diary.groupDatesByMonth}
                        isSameDay={diary.isSameDay}
                        onDateSelect={async (date, d) => {
                            await diary.selectDate(date, d);
                            setShowDates(false); // collapse after selection
                        }}
                    />
                </div>
            )}

            {/* ── Editor — fills remaining space ── */}
            <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", minHeight:0 }}>
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
                    isMobile={isMobile}
                />
            </div>

            {/* Modals */}
            {diary.showTemplatePicker && (
                <TemplatePicker
                    currentTplKey={diary.pages[diary.currentPage]?.meta?.template || "plain"}
                    onSelect={handleTemplateSelect}
                    onClose={() => diary.setShowTemplatePicker(false)}
                />
            )}
            {diary.showProfile && (
                <ProfileModal user={diary.user} onClose={() => diary.setShowProfile(false)} onLogout={diary.logout} />
            )}
            {showFeedback && (
                <FeedbackDialog user={diary.user} onClose={() => setShowFeedback(false)} />
            )}
        </div>
    );
}