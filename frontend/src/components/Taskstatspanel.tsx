import React from "react";
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
  NEW:         { label: "New",         color: "#2563eb", bg: "#eff4ff" },
  IN_PROGRESS: { label: "In Progress", color: "#d97706", bg: "#fffbeb" },
  DONE:        { label: "Done",        color: "#16a34a", bg: "#f0fdf4" },
  CANCELLED:   { label: "Cancelled",   color: "#6b6b6b", bg: "#f2f2ef" },
};
const PRIORITY_META: Record<string, { label: string; color: string; bg: string }> = {
  LOW:    { label: "Low",    color: "#6b6b6b", bg: "#f2f2ef" },
  MEDIUM: { label: "Medium", color: "#d97706", bg: "#fffbeb" },
  HIGH:   { label: "High",   color: "#dc2626", bg: "#fef2f2" },
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

  // aggregate for global summary bar
  const allStatuses  = Array.from(new Set(stats.flatMap((s) => s.by_status.map((x) => x.status))));
  const allPriorities = Array.from(new Set(stats.flatMap((s) => s.by_priority.map((x) => x.priority))));

  return (
    <div style={ds.root}>

      {/* ── LEADERBOARD ───────────────────────────────────────── */}
      <section>
        <div style={ds.sectionTitle}>Рейтинг по задачам</div>
        <div style={ds.leaderboard}>
          {[...stats]
            .sort((a, b) => b.total_tasks - a.total_tasks)
            .map((s, idx) => {
              const name = getName ? getName(s.user_id) : `#${s.user_id}`;
              const done = s.by_status.find((x) => x.status === "DONE")?.count ?? 0;
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
                      {pct}% done
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
              color: STATUS_META[x.status]?.color ?? "#6b6b6b",
              label: STATUS_META[x.status]?.label ?? x.status,
            }));

            const prioritySlices = s.by_priority.map((x) => ({
              value: x.count,
              color: PRIORITY_META[x.priority]?.color ?? "#6b6b6b",
              label: PRIORITY_META[x.priority]?.label ?? x.priority,
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
                        <div key={x.status} style={ds.legendItem}>
                          <span style={{ ...ds.legendDot, background: STATUS_META[x.status]?.color ?? "#6b6b6b" }} />
                          <span style={ds.legendText}>{STATUS_META[x.status]?.label ?? x.status}</span>
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
                          <span style={{ ...ds.legendDot, background: PRIORITY_META[x.priority]?.color ?? "#6b6b6b" }} />
                          <span style={ds.legendText}>{PRIORITY_META[x.priority]?.label ?? x.priority}</span>
                          <span style={ds.legendCount}>{x.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* status progress bars */}
                <div style={ds.bars}>
                  {s.by_status.map((x) => {
                    const meta = STATUS_META[x.status];
                    const pct  = s.total_tasks > 0 ? (x.count / s.total_tasks) * 100 : 0;
                    return (
                      <div key={x.status} style={ds.barRow}>
                        <span style={{ ...ds.barLabel, color: meta?.color ?? "#6b6b6b" }}>
                          {meta?.label ?? x.status}
                        </span>
                        <div style={ds.hbarWrap}>
                          <div style={{ ...ds.hbarFill, width: `${pct}%`, background: meta?.color ?? "#6b6b6b" }} />
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
                    <th key={s} style={{ ...ds.th, color: STATUS_META[s]?.color ?? "#6b6b6b" }}>
                      {STATUS_META[s]?.label ?? s}
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
                        const val = row.by_status.find((x) => x.status === st)?.count ?? 0;
                        return (
                          <td key={st} style={{ ...ds.td, textAlign: "center" }}>
                            {val > 0
                              ? <span style={{ ...ds.tableCell, background: STATUS_META[st]?.bg, color: STATUS_META[st]?.color }}>{val}</span>
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