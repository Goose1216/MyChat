import React from "react";
import * as XLSX from "xlsx";
import "../design.css";

// ─── colour palette for users ───────────────────────────────────────────────
const USER_COLORS = [
  "#2563eb", "#0891b2", "#059669", "#d97706",
  "#dc2626", "#7c3aed", "#db2777", "#65a30d",
];
const userColor = (idx: number) => USER_COLORS[idx % USER_COLORS.length];
const userBg    = (idx: number) => USER_COLORS[idx % USER_COLORS.length] + "18";

// ─── status / priority meta ──────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  NEW:         { label: "Новая",     color: "#2563eb", bg: "#eff4ff" },
  IN_PROGRESS: { label: "В работе",  color: "#d97706", bg: "#fffbeb" },
  DONE:        { label: "Выполнена", color: "#16a34a", bg: "#f0fdf4" },
  CANCELLED:   { label: "Отменена",  color: "#6b6b6b", bg: "#f2f2ef" },
};
const PRIORITY_META: Record<string, { label: string; color: string; bg: string }> = {
  LOW:    { label: "Низкий",  color: "#6b6b6b", bg: "#f2f2ef" },
  MEDIUM: { label: "Средний", color: "#d97706", bg: "#fffbeb" },
  HIGH:   { label: "Высокий", color: "#dc2626", bg: "#fef2f2" },
};

// Нормализованный поиск — работает с любым регистром и форматом:
// "new", "NEW", "New", "in_progress", "IN_PROGRESS", "In Progress", "in progress"
const normalizeKey = (k: string) => {
  if (!k) return "";

  return k
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .replace("INPROGRESS", "IN_PROGRESS")
    .replace("IN PROGRESS", "IN_PROGRESS")
    .replace("CANCELED", "CANCELLED");
};
const getStatus   = (k: string) => {
  const nk = normalizeKey(k);
  return STATUS_META[nk] ?? STATUS_META[k] ?? { label: k ?? "—", color: "#6b6b6b", bg: "#f2f2ef" };
};
const getPriority = (k: string) => {
  const nk = normalizeKey(k);
  return PRIORITY_META[nk] ?? PRIORITY_META[k] ?? { label: k ?? "—", color: "#6b6b6b", bg: "#f2f2ef" };
};

// ─── tiny donut SVG ──────────────────────────────────────────────────────────
function DonutChart({ slices }: { slices: { value: number; color: string; label: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <div style={ds.donutEmpty}>—</div>;

  const R = 36, CIRC = 2 * Math.PI * R;
  let offset = 0;
  const parts = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const dash = (s.value / total) * CIRC;
      const part = { ...s, dash, offset };
      offset += dash;
      return part;
    });

  return (
    <svg width={90} height={90} viewBox="0 0 90 90">
      <circle cx={45} cy={45} r={R} fill="none" stroke="#e4e4e0" strokeWidth={14} />
      {parts.map((p, i) => (
        <circle
          key={i}
          cx={45} cy={45} r={R}
          fill="none"
          stroke={p.color}
          strokeWidth={14}
          strokeDasharray={`${p.dash} ${CIRC - p.dash}`}
          strokeDashoffset={CIRC / 4 - p.offset}
          style={{ transform: "rotate(0deg)", transformOrigin: "center" }}
        />
      ))}
      <text x={45} y={49} textAnchor="middle" fontSize={12} fontWeight={600} fill="#0f0f0f"
        style={{ fontFamily: "var(--font-mono)" }}>
        {total}
      </text>
    </svg>
  );
}

// ─── horizontal bar ──────────────────────────────────────────────────────────
function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={ds.hbarWrap}>
      <div style={{ ...ds.hbarFill, width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── main export ─────────────────────────────────────────────────────────────
export interface StatEntry {
  user_id: number;
  total_tasks: number;
  by_status:   { status: string;   count: number }[];
  by_priority: { priority: string; count: number }[];
}

interface Props {
  stats: StatEntry[];
  loading: boolean;
  /** optional: map user_id → display name */
  getName?: (id: number) => string;
}

export default function TaskStatsPanel({ stats, loading, getName }: Props) {
  if (loading) {
    return (
      <div style={ds.loading}>
        <span className="spinner" />
        <span style={{ fontSize: 13, color: "var(--c-ink-muted)" }}>Загрузка статистики...</span>
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div style={ds.empty}>
        <span style={{ fontSize: 28 }}>📊</span>
        <span style={{ fontSize: 13, color: "var(--c-ink-muted)" }}>Нет данных</span>
      </div>
    );
  }

  const maxTotal = Math.max(...stats.map((s) => s.total_tasks), 1);

  const allStatuses = Array.from(
    new Set(stats.flatMap((s) => s.by_status.map((x) => normalizeKey(x.status))))
  );
  const allPriorities = Array.from(
    new Set(stats.flatMap((s) => s.by_priority.map((x) => normalizeKey(x.priority))))
  );

  // ── Excel export ──────────────────────────────────────────────────────────

  const downloadExcel = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("ru", { day: "2-digit", month: "2-digit", year: "numeric" });
    const wb = XLSX.utils.book_new();

    // ── Лист 1: Сводная таблица ──────────────────────────────────────────────
    const summaryHeader = [
      "Пользователь",
      "ID",
      "Всего задач",
      ...allStatuses.map(s => getStatus(s).label),
      ...allPriorities.map(p => getPriority(p).label),
      "% выполнено",
    ];

    const summaryRows = [...stats]
      .sort((a, b) => b.total_tasks - a.total_tasks)
      .map((s, idx) => {
        const name = getName ? getName(s.user_id) : `#${s.user_id}`;
        const done = s.by_status.find(x => normalizeKey(x.status) === "DONE")?.count ?? 0;
        const pct  = s.total_tasks > 0 ? Math.round((done / s.total_tasks) * 100) : 0;

        return [
          name,
          s.user_id,
          s.total_tasks,
          ...allStatuses.map(st => s.by_status.find(x => normalizeKey(x.status) === st)?.count ?? 0),
          ...allPriorities.map(pr => s.by_priority.find(x => normalizeKey(x.priority) === pr)?.count ?? 0),
          `${pct}%`,
        ];
      });

    // Итоговая строка
    const totalsRow = [
      "ИТОГО",
      "",
      stats.reduce((n, s) => n + s.total_tasks, 0),
      ...allStatuses.map(st => stats.reduce((n, s) => n + (s.by_status.find(x => normalizeKey(x.status) === st)?.count ?? 0), 0)),
      ...allPriorities.map(pr => stats.reduce((n, s) => n + (s.by_priority.find(x => normalizeKey(x.priority) === pr)?.count ?? 0), 0)),
      "",
    ];

    const summaryData = [summaryHeader, ...summaryRows, [], totalsRow];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);

    // Ширина колонок
    ws1["!cols"] = [
      { wch: 24 }, { wch: 6 }, { wch: 12 },
      ...allStatuses.map(() => ({ wch: 14 })),
      ...allPriorities.map(() => ({ wch: 14 })),
      { wch: 14 },
    ];

    XLSX.utils.book_append_sheet(wb, ws1, "Сводная таблица");

    // ── Лист 2: Рейтинг ─────────────────────────────────────────────────────
    const ratingHeader = ["Место", "Пользователь", "Всего задач", "Выполнено", "% выполнено"];
    const ratingRows = [...stats]
      .sort((a, b) => b.total_tasks - a.total_tasks)
      .map((s, idx) => {
        const name = getName ? getName(s.user_id) : `#${s.user_id}`;
        const done = s.by_status.find(x => normalizeKey(x.status) === "DONE")?.count ?? 0;
        const pct  = s.total_tasks > 0 ? Math.round((done / s.total_tasks) * 100) : 0;
        return [idx + 1, name, s.total_tasks, done, `${pct}%`];
      });

    const ws2 = XLSX.utils.aoa_to_sheet([ratingHeader, ...ratingRows]);
    ws2["!cols"] = [{ wch: 8 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Рейтинг");

    // ── Лист 3: По статусам подробно ─────────────────────────────────────────
    const statusHeader = ["Пользователь", "Статус", "Количество", "% от всех задач"];
    const statusRows: any[] = [];
    [...stats]
      .sort((a, b) => b.total_tasks - a.total_tasks)
      .forEach(s => {
        const name = getName ? getName(s.user_id) : `#${s.user_id}`;
        s.by_status.forEach(x => {
          const pct = s.total_tasks > 0 ? Math.round((x.count / s.total_tasks) * 100) : 0;
          statusRows.push([name, getStatus(normalizeKey(x.status)).label, x.count, `${pct}%`]);
        });
      });

    const ws3 = XLSX.utils.aoa_to_sheet([statusHeader, ...statusRows]);
    ws3["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws3, "По статусам");

    // ── Лист 4: По приоритетам ────────────────────────────────────────────────
    const prioHeader = ["Пользователь", "Приоритет", "Количество", "% от всех задач"];
    const prioRows: any[] = [];
    [...stats]
      .sort((a, b) => b.total_tasks - a.total_tasks)
      .forEach(s => {
        const name = getName ? getName(s.user_id) : `#${s.user_id}`;
        s.by_priority.forEach(x => {
          const pct = s.total_tasks > 0 ? Math.round((x.count / s.total_tasks) * 100) : 0;
          prioRows.push([name, getPriority(normalizeKey(x.priority)).label, x.count, `${pct}%`]);
        });
      });

    const ws4 = XLSX.utils.aoa_to_sheet([prioHeader, ...prioRows]);
    ws4["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws4, "По приоритетам");

    // ── Скачать ───────────────────────────────────────────────────────────────
    const filename = `Отчёт_по_задачам_${dateStr.replace(/\./g, "-")}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={ds.root}>

      {/* Кнопка скачать */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          className="btn btn-primary"
          onClick={downloadExcel}
          style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}
        >
          <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
          Скачать отчёт (.xlsx)
        </button>
      </div>

      {/* ── LEADERBOARD ───────────────────────────────────────── */}
      <section>
        <div style={ds.sectionTitle}>Рейтинг по задачам</div>
        <div style={ds.leaderboard}>
          {[...stats]
            .sort((a, b) => b.total_tasks - a.total_tasks)
            .map((s, idx) => {
              const name = getName ? getName(s.user_id) : `#${s.user_id}`;
              const done = s.by_status.find((x) => normalizeKey(x.status) === "DONE")?.count ?? 0;
              const pct  = s.total_tasks > 0 ? Math.round((done / s.total_tasks) * 100) : 0;
              return (
                <div key={s.user_id} style={ds.leaderRow}>
                  <div style={{ ...ds.leaderRank, background: userBg(idx), color: userColor(idx) }}>
                    {idx + 1}
                  </div>
                  <div style={ds.leaderInfo}>
                    <div style={ds.leaderName}>{name}</div>
                    <HBar value={s.total_tasks} max={maxTotal} color={userColor(idx)} />
                  </div>
                  <div style={ds.leaderMeta}>
                    <span style={ds.leaderTotal}>{s.total_tasks}</span>
                    <span style={{ ...ds.leaderDone, color: pct >= 50 ? "var(--c-success)" : "var(--c-ink-ghost)" }}>
                      {pct}% выполнено
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* ── PER-USER CARDS ────────────────────────────────────── */}
      <section>
        <div style={ds.sectionTitle}>По пользователям</div>
        <div style={ds.cards}>
          {stats.map((s, idx) => {
            const name = getName ? getName(s.user_id) : `#${s.user_id}`;

            const statusSlices = s.by_status.map((x) => ({
              value: x.count,
              color: getStatus(normalizeKey(x.status)).color,
              label: getStatus(normalizeKey(x.status))?.label ?? getStatus(normalizeKey(x.status)).label,
            }));

            const prioritySlices = s.by_priority.map((x) => ({
              value: x.count,
              color: getPriority(x.priority).color,
              label: getPriority(x.priority)?.label ?? getPriority(x.priority).label,
            }));

            return (
              <div key={s.user_id} style={ds.card} className="card">
                {/* card header */}
                <div style={ds.cardHeader}>
                  <div style={{ ...ds.cardAvatar, background: userBg(idx), color: userColor(idx) }}>
                    {name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <div style={ds.cardName}>{name}</div>
                    <div style={ds.cardSub}>Всего задач: <strong>{s.total_tasks}</strong></div>
                  </div>
                </div>

                {/* two donuts side by side */}
                <div style={ds.doubleDonut}>
                  {/* status donut */}
                  <div style={ds.donutBlock}>
                    <DonutChart slices={statusSlices} />
                    <div style={ds.donutLabel}>Статусы</div>
                    <div style={ds.legend}>
                      {s.by_status.filter((x) => x.count > 0).map((x) => (
                        <div key={normalizeKey(x.status)} style={ds.legendItem}>
                          <span style={{ ...ds.legendDot, background: getStatus(normalizeKey(x.status)).color }} />
                          <span style={ds.legendText}>{getStatus(normalizeKey(x.status)).label}</span>
                          <span style={ds.legendCount}>{x.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={ds.donutDivider} />

                  {/* priority donut */}
                  <div style={ds.donutBlock}>
                    <DonutChart slices={prioritySlices} />
                    <div style={ds.donutLabel}>Приоритеты</div>
                    <div style={ds.legend}>
                      {s.by_priority.filter((x) => x.count > 0).map((x) => (
                        <div key={x.priority} style={ds.legendItem}>
                          <span style={{ ...ds.legendDot, background: getPriority(x.priority).color }} />
                          <span style={ds.legendText}>{getPriority(x.priority).label}</span>
                          <span style={ds.legendCount}>{x.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* status progress bars */}
                <div style={ds.bars}>
                  {s.by_status.map((x) => {
                    const meta = getStatus(normalizeKey(x.status));
                    const pct  = s.total_tasks > 0 ? (x.count / s.total_tasks) * 100 : 0;
                    return (
                      <div key={normalizeKey(x.status)} style={ds.barRow}>
                        <span style={{ ...ds.barLabel, color: meta.color ?? "#6b6b6b" }}>
                          {meta.label}
                        </span>
                        <div style={ds.hbarWrap}>
                          <div style={{ ...ds.hbarFill, width: `${pct}%`, background: meta.color ?? "#6b6b6b" }} />
                        </div>
                        <span style={ds.barCount}>{x.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── AGGREGATE TABLE ──────────────────────────────────── */}
      {stats.length > 1 && (
        <section>
          <div style={ds.sectionTitle}>Сводная таблица по статусам</div>
          <div style={ds.tableWrap}>
            <table style={ds.table}>
              <thead>
                <tr>
                  <th style={ds.th}>Пользователь</th>
                  {allStatuses.map((s) => (
                    <th key={s} style={{ ...ds.th, color: getStatus(s).color }}>
                      {getStatus(s).label}
                    </th>
                  ))}
                  <th style={ds.th}>Всего</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row, idx) => {
                  const name = getName ? getName(row.user_id) : `#${row.user_id}`;
                  return (
                    <tr key={row.user_id}>
                      <td style={ds.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ ...ds.tableAvatar, background: userBg(idx), color: userColor(idx) }}>
                            {name[0]?.toUpperCase()}
                          </span>
                          {name}
                        </div>
                      </td>
                      {allStatuses.map((st) => {
                        const val =
  row.by_status.find(
    (x) => (normalizeKey(x.status)) === st
  )?.count ?? 0;
                        return (
                          <td key={st} style={{ ...ds.td, textAlign: "center" }}>
                            {val > 0
                              ? <span style={{ ...ds.tableCell, background: getStatus(st).bg, color: getStatus(st).color }}>{val}</span>
                              : <span style={{ color: "var(--c-ink-ghost)", fontSize: 11 }}>—</span>
                            }
                          </td>
                        );
                      })}
                      <td style={{ ...ds.td, textAlign: "center", fontWeight: 600 }}>{row.total_tasks}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const ds: Record<string, React.CSSProperties> = {
  root:          { display: "flex", flexDirection: "column", gap: 24 },
  loading:       { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "40px 0" },
  empty:         { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "40px 0" },
  sectionTitle:  { fontSize: 11, fontWeight: 600, color: "var(--c-ink-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontFamily: "var(--font-mono)" },

  // leaderboard
  leaderboard:   { display: "flex", flexDirection: "column", gap: 6 },
  leaderRow:     { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--c-paper)", border: "1px solid var(--c-line)", borderRadius: "var(--r-md)" },
  leaderRank:    { width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, fontFamily: "var(--font-mono)" },
  leaderInfo:    { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 },
  leaderName:    { fontSize: 13, fontWeight: 500, color: "var(--c-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  leaderMeta:    { display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 },
  leaderTotal:   { fontSize: 14, fontWeight: 700, color: "var(--c-ink)", fontFamily: "var(--font-mono)" },
  leaderDone:    { fontSize: 10, fontFamily: "var(--font-mono)" },

  // bar
  hbarWrap:      { flex: 1, height: 6, background: "var(--c-surface)", borderRadius: 3, overflow: "hidden" },
  hbarFill:      { height: "100%", borderRadius: 3, transition: "width 0.4s ease" },

  // cards
  cards:         { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 },
  card:          { padding: 16, display: "flex", flexDirection: "column", gap: 14 },
  cardHeader:    { display: "flex", alignItems: "center", gap: 10 },
  cardAvatar:    { width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0, fontFamily: "var(--font-mono)" },
  cardName:      { fontSize: 14, fontWeight: 600, color: "var(--c-ink)" },
  cardSub:       { fontSize: 11, color: "var(--c-ink-muted)", marginTop: 1 },

  // donut
  doubleDonut:   { display: "flex", gap: 0 },
  donutBlock:    { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  donutDivider:  { width: 1, background: "var(--c-line)", margin: "0 8px" },
  donutLabel:    { fontSize: 10, fontWeight: 600, color: "var(--c-ink-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "var(--font-mono)" },
  donutEmpty:    { width: 90, height: 90, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "var(--c-ink-ghost)" },

  // legend
  legend:        { display: "flex", flexDirection: "column", gap: 3, width: "100%" },
  legendItem:    { display: "flex", alignItems: "center", gap: 5, fontSize: 10 },
  legendDot:     { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  legendText:    { flex: 1, color: "var(--c-ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  legendCount:   { fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--c-ink)", fontSize: 10 },

  // bars
  bars:          { display: "flex", flexDirection: "column", gap: 6 },
  barRow:        { display: "flex", alignItems: "center", gap: 8 },
  barLabel:      { fontSize: 10, fontWeight: 600, width: 76, flexShrink: 0, fontFamily: "var(--font-mono)" },
  barCount:      { fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--c-ink)", width: 18, textAlign: "right", flexShrink: 0 },

  // table
  tableWrap:     { overflowX: "auto", border: "1px solid var(--c-line)", borderRadius: "var(--r-md)" },
  table:         { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th:            { padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.04em", background: "var(--c-surface)", borderBottom: "1px solid var(--c-line)", whiteSpace: "nowrap" },
  td:            { padding: "8px 12px", borderBottom: "1px solid var(--c-line-soft)", color: "var(--c-ink-soft)", verticalAlign: "middle" },
  tableAvatar:   { width: 20, height: 20, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 },
  tableCell:     { padding: "1px 7px", borderRadius: "var(--r-full)", fontWeight: 600, fontSize: 11, fontFamily: "var(--font-mono)" },
};