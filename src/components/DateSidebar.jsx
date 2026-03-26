// src/components/DateSidebar.jsx
import { dateSidebar as s } from "../styles/tokens";

/**
 * Props:
 *   files             – all file objects (used to show entry dots)
 *   selectedDate      – Date
 *   expandedMonths    – { [monthKey]: boolean }
 *   setExpandedMonths – setter
 *   groupDatesByMonth – () => [monthKey, Date[]][]
 *   isSameDay         – (d1, d2) => boolean
 *   onDateSelect      – (date: Date) => void  called when user picks a day or uses the input
 */
export default function DateSidebar({
  files, selectedDate,
  expandedMonths, setExpandedMonths,
  groupDatesByMonth, isSameDay,
  onDateSelect,
}) {
  return (
    <aside style={s.aside}>
      {/* Date picker input */}
      <div style={s.pickerWrap}>
        <input
          type="date"
          style={s.picker}
          max={new Date().toISOString().split("T")[0]}
          value={selectedDate.toISOString().split("T")[0]}
          onChange={(e) => onDateSelect(new Date(e.target.value + "T00:00:00"))}
        />
      </div>

      {/* Scrollable month / date list */}
      <div style={s.list}>
        {groupDatesByMonth().map(([month, dates]) => (
          <div key={month}>
            <div
              style={s.monthHeader}
              onClick={() => setExpandedMonths((p) => ({ ...p, [month]: !p[month] }))}
            >
              <span>{month}</span>
              <span style={{ fontSize: 9, opacity: 0.55 }}>
                {expandedMonths[month] ? "▲" : "▼"}
              </span>
            </div>

            {expandedMonths[month] && [...dates].reverse().map((d) => {
              const active     = isSameDay(d, selectedDate);
              const hasEntries = files.some((f) => isSameDay(f.createdAt, d));
              return (
                <div
                  key={d.toDateString()}
                  onClick={() => onDateSelect(d)}
                  style={{
                    ...s.dateItem,
                    background:  active ? "#e8f0fe" : "transparent",
                    fontWeight:  active ? 600 : 400,
                    color:       active ? "#1a73e8" : "#3c4043",
                  }}
                >
                  {d.toDateString().slice(4, 10)}
                  {hasEntries && <span style={s.entryDot} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
