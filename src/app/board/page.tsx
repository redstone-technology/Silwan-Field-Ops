"use client";
import { useMemo, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useData, useNow, useStore, useMe } from "@/lib/store";
import { useVisible, useStatusOf, isToday } from "@/lib/hooks";
import { attFor, canEdit, reportFor, STATUS, type StatusKey } from "@/lib/rules";
import type { Assignment } from "@/lib/types";
import { format, hm, ms, slot, weekDays, isSameDay, addDays, weekStart } from "@/lib/time";
import { Avatars, Icon, StatusLabel, useUI, Empty } from "@/components/ui";

type View = "table" | "kanban" | "calendar";
type Range = "today" | "week" | "all";
type Group = "site" | "team";

export default function Board() {
  const d = useData();
  const now = useNow();
  const visible = useVisible();
  const [view, setView] = useState<View>("table");
  const [range, setRange] = useState<Range>("today");
  const [group, setGroup] = useState<Group>("site");
  const [team, setTeam] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [weekOffset, setWeekOffset] = useState(0);

  const ws = weekStart(new Date(now)).getTime();
  const filtered = useMemo(() => {
    return visible
      .filter((a) => {
        if (view !== "calendar") {
          if (range === "today" && !isToday(a, now)) return false;
          if (range === "week" && (ms(a.start) < ws || ms(a.start) >= ws + 7 * 86_400_000)) return false;
        }
        if (team && a.teamId !== team) return false;
        if (kind && a.kind !== kind) return false;
        if (q) {
          const site = d.sites.find((s) => s.id === a.siteId);
          const names = a.assigneeIds.map((p) => d.people.find((x) => x.id === p)?.name).join(" ");
          if (!`${a.title} ${site?.name} ${site?.client} ${names}`.toLowerCase().includes(q.toLowerCase())) return false;
        }
        return true;
      })
      .sort((x, y) => ms(x.start) - ms(y.start));
  }, [visible, view, range, team, kind, q, now, ws, d]);

  return (
    <div className="boardwrap">
      <div className="toolbar">
        <div className="seg">
          <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}><Icon n="board" s={16} /> Table</button>
          <button className={view === "kanban" ? "on" : ""} onClick={() => setView("kanban")}><Icon n="kanban" s={16} /> Kanban</button>
          <button className={view === "calendar" ? "on" : ""} onClick={() => setView("calendar")}><Icon n="cal" s={16} /> Calendar</button>
        </div>
        {view !== "calendar" ? (
          <div className="row" style={{ gap: 6 }}>
            {(["today", "week", "all"] as Range[]).map((r) => (
              <button key={r} className={`chip${range === r ? " on" : ""}`} onClick={() => setRange(r)}>{r === "today" ? "Today" : r === "week" ? "This week" : "All"}</button>
            ))}
          </div>
        ) : (
          <div className="row" style={{ gap: 6 }}>
            <button className="chip" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week"><Icon n="back" s={16} /></button>
            <button className={`chip${weekOffset === 0 ? " on" : ""}`} onClick={() => setWeekOffset(0)}>This week</button>
            <button className="chip" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Next week"><Icon n="fwd" s={16} /></button>
          </div>
        )}
        <select className="search" style={{ minWidth: 0 }} value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
          <option value="">All teams</option>
          {d.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="search" style={{ minWidth: 0 }} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
          <option value="">Tasks + tickets</option>
          <option value="task">Project tasks</option>
          <option value="maintenance">Maintenance tickets</option>
        </select>
        {view === "table" && (
          <select className="search" style={{ minWidth: 0 }} value={group} onChange={(e) => setGroup(e.target.value as Group)} aria-label="Group by">
            <option value="site">Group: Site</option>
            <option value="team">Group: Team</option>
          </select>
        )}
        <input className="search grow" placeholder="Search task, site, person" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card" style={{ padding: view === "table" ? "16px 18px" : 14 }}>
        {view === "table" && <TableView items={filtered} group={group} now={now} />}
        {view === "kanban" && <KanbanView items={filtered} now={now} />}
        {view === "calendar" && <CalendarView items={filtered} now={now} weekOffset={weekOffset} />}
      </div>
    </div>
  );
}

/* ---------------- table (monday style) ---------------- */
function TableView({ items, group, now }: { items: Assignment[]; group: Group; now: number }) {
  const d = useData();
  const me = useMe();
  const statusOf = useStatusOf(now);
  const open = useUI((s) => s.open);
  const groups =
    group === "site"
      ? d.sites.map((s) => ({ id: s.id, name: s.name, sub: `${s.client} · ${s.stage}`, color: s.color, items: items.filter((a) => a.siteId === s.id) }))
      : d.teams.map((t) => ({ id: t.id, name: t.name, sub: "Team", color: t.color, items: items.filter((a) => a.teamId === t.id) }));
  const shown = groups.filter((g) => g.items.length);
  if (!shown.length) return <Empty title="No tasks match" text="Try another filter, or add a task." action={canEdit(d, me) ? <button className="btn lime" onClick={() => open({ type: "assign" })}>New task</button> : undefined} />;

  const multiDay = new Set(items.map((a) => new Date(a.start).toDateString())).size > 1;
  return (
    <div style={{ overflowX: "auto" }}>
      {shown.map((g) => (
        <section className="group" key={g.id} style={{ ["--g" as string]: g.color, minWidth: 820 }}>
          <div className="group-h">
            <h3 style={{ color: g.color }}>{g.name}</h3>
            <span className="muted small">{g.sub}</span>
            <span className="pill">{g.items.length}</span>
          </div>
          <table className="mtable">
            <colgroup>
              <col style={{ width: "30%" }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 128 }} />
              <col style={{ width: multiDay ? 150 : 110 }} />
              <col style={{ width: 82 }} />
              <col style={{ width: 82 }} />
              <col style={{ width: 82 }} />
            </colgroup>
            <thead>
              <tr><th>Task</th><th>Owner</th><th>Status</th><th>Time slot</th><th>Check in</th><th>Check out</th><th>Report</th></tr>
            </thead>
            <tbody>
              {g.items.map((a) => {
                const ppl = a.assigneeIds.map((p) => d.people.find((x) => x.id === p));
                const atts = a.assigneeIds.map((p) => attFor(d, a.id, p));
                const firstIn = atts.map((x) => x?.checkInAt).filter(Boolean).sort()[0];
                const allOut = atts.every((x) => x?.checkOutAt);
                const lastOut = allOut ? atts.map((x) => x?.checkOutAt).sort().reverse()[0] : undefined;
                const reps = a.assigneeIds.filter((p) => reportFor(d, a.id, p)).length;
                const late = firstIn && ms(firstIn) > ms(a.start) + d.settings.lateGraceMin * 60000;
                const early = lastOut && ms(lastOut) < ms(a.end) - d.settings.earlyLeaveMin * 60000;
                return (
                  <tr key={a.id} onClick={() => open({ type: "assignment", id: a.id })}>
                    <td>
                      <span className="row" style={{ gap: 8 }}>
                        <span className="muted" style={{ display: "inline-flex" }}><Icon n={a.kind === "maintenance" ? "wrench" : "cam"} s={16} /></span>
                        <span className="ell" style={{ fontWeight: 600 }}>{a.title}</span>
                        {group === "team" && <span className="pill ell" style={{ maxWidth: 140 }}>{d.sites.find((s) => s.id === a.siteId)?.name}</span>}
                        {a.visibility === "assigned" && <span className="muted" title="Only assigned people can see this"><Icon n="lock" s={14} /></span>}
                      </span>
                    </td>
                    <td><Avatars people={ppl} max={3} /></td>
                    <td><StatusLabel k={statusOf(a)} cell /></td>
                    <td className="small">{multiDay && <span className="muted">{format(new Date(a.start), "EEE d")} · </span>}{slot(a.start, a.end)}</td>
                    <td className="small" style={{ color: late ? "var(--down)" : undefined, fontWeight: late ? 700 : undefined }}>{hm(firstIn)}</td>
                    <td className="small" style={{ color: early ? "var(--down)" : undefined, fontWeight: early ? 700 : undefined }}>{lastOut ? hm(lastOut) : "—"}</td>
                    <td className="small">{!a.reportRequired ? <span className="muted">Not needed</span> : reps === a.assigneeIds.length ? <span style={{ color: "var(--up)", fontWeight: 700 }}>Sent</span> : reps ? `${reps}/${a.assigneeIds.length}` : "—"}</td>
                  </tr>
                );
              })}
              {canEdit(d, me) && (
                <tr className="addrow" onClick={() => open({ type: "assign", siteId: group === "site" ? g.id : undefined })}>
                  <td colSpan={7}>+ Add task</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

/* ---------------- kanban ---------------- */
const COLS: { id: string; label: string; color: string; keys: StatusKey[] }[] = [
  { id: "todo", label: "Scheduled", color: STATUS.scheduled.color, keys: ["scheduled", "starting"] },
  { id: "onsite", label: "On site", color: STATUS.onsite.color, keys: ["onsite"] },
  { id: "attention", label: "Needs attention", color: STATUS.late.color, keys: ["late", "missed", "report", "stuck"] },
  { id: "done", label: "Done", color: STATUS.done.color, keys: ["done", "cancelled"] },
];

function KanbanView({ items, now }: { items: Assignment[]; now: number }) {
  const statusOf = useStatusOf(now);
  const setManual = useStore((s) => s.setManualStatus);
  const say = useUI((s) => s.say);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onEnd = (e: DragEndEvent) => {
    const col = e.over?.id as string | undefined;
    const id = e.active.id as string;
    if (!col) return;
    const a = items.find((x) => x.id === id)!;
    const from = COLS.find((c) => c.keys.includes(statusOf(a)))?.id;
    if (from === col) return;
    if (col === "done") { setManual(id, "done"); say("Marked as done"); }
    else if (col === "attention") { setManual(id, "stuck"); say("Marked as stuck"); }
    else { setManual(id, undefined); say("Status follows check-in again"); }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onEnd}>
      <div className="kanban">
        {COLS.map((c) => (
          <KCol key={c.id} col={c} items={items.filter((a) => c.keys.includes(statusOf(a)))} now={now} />
        ))}
      </div>
    </DndContext>
  );
}

function KCol({ col, items, now }: { col: (typeof COLS)[number]; items: Assignment[]; now: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div ref={setNodeRef} className={`kcol${isOver ? " over" : ""}`}>
      <div className="kcol-h" style={{ background: col.color }}>
        <span>{col.label}</span>
        <span>{items.length}</span>
      </div>
      <div className="kcards">
        {items.map((a) => <KCard key={a.id} a={a} now={now} />)}
        {!items.length && <span className="muted small" style={{ padding: 8 }}>Drop here</span>}
      </div>
    </div>
  );
}

function KCard({ a, now }: { a: Assignment; now: number }) {
  const d = useData();
  const statusOf = useStatusOf(now);
  const open = useUI((s) => s.open);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: a.id });
  const site = d.sites.find((s) => s.id === a.siteId);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`kcard${isDragging ? " dragging" : ""}`}
      style={{ ["--g" as string]: site?.color, transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined, zIndex: isDragging ? 5 : undefined }}
      onClick={() => open({ type: "assignment", id: a.id })}
    >
      <div className="row" style={{ alignItems: "flex-start" }}>
        <b className="grow" style={{ fontSize: 14.5 }}>{a.title}</b>
        {a.kind === "maintenance" && <span className="muted"><Icon n="wrench" s={15} /></span>}
      </div>
      <span className="muted small">{site?.name} · {format(new Date(a.start), "EEE")} {slot(a.start, a.end)}</span>
      <div className="row">
        <Avatars people={a.assigneeIds.map((p) => d.people.find((x) => x.id === p))} />
        <span className="grow" />
        <StatusLabel k={statusOf(a)} />
      </div>
    </div>
  );
}

/* ---------------- calendar (week) ---------------- */
const H0 = 6;
const H1 = 21;
const PX = 46; // px per hour

function CalendarView({ items, now, weekOffset }: { items: Assignment[]; now: number; weekOffset: number }) {
  const d = useData();
  const me = useMe();
  const statusOf = useStatusOf(now);
  const open = useUI((s) => s.open);
  const days = weekDays(addDays(new Date(now), weekOffset * 7));
  const hours = Array.from({ length: H1 - H0 + 1 }, (_, i) => H0 + i);
  const top = (iso: string) => {
    const t = new Date(iso);
    return Math.max(0, (t.getHours() + t.getMinutes() / 60 - H0) * PX);
  };
  const nowDate = new Date(now);
  return (
    <div style={{ overflow: "auto", height: "100%" }}>
      <div className="cal">
        <div className="cal-hd" />
        {days.map((day) => (
          <div key={day.toISOString()} className={`cal-hd${isSameDay(day, nowDate) ? " today" : ""}`}>
            <span>{format(day, "EEE d")}</span>
          </div>
        ))}
        <div className="cal-times" style={{ height: (H1 - H0) * PX }}>
          {hours.map((h) => <div key={h} style={{ top: (h - H0) * PX }}>{h}:00</div>)}
        </div>
        {days.map((day) => {
          const evs = items.filter((a) => isSameDay(new Date(a.start), day));
          // side-by-side layout for overlapping jobs
          const lanes: Assignment[][] = [];
          evs.forEach((a) => {
            const lane = lanes.find((l) => ms(l[l.length - 1].end) <= ms(a.start));
            if (lane) lane.push(a);
            else lanes.push([a]);
          });
          const laneOf = (a: Assignment) => lanes.findIndex((l) => l.includes(a));
          return (
            <div
              key={day.toISOString()}
              className={`cal-col${isSameDay(day, nowDate) ? " today" : ""}`}
              style={{ height: (H1 - H0) * PX }}
              onDoubleClick={(e) => {
                if (!canEdit(d, me)) return;
                const y = e.nativeEvent.offsetY;
                const h = Math.floor(y / PX) + H0;
                const s = new Date(day);
                s.setHours(h, 0, 0, 0);
                open({ type: "assign", start: s.toISOString() });
              }}
              title="Double-click to add a task"
            >
              {hours.map((h) => <div key={h} className="cal-line" style={{ top: (h - H0) * PX }} />)}
              {isSameDay(day, nowDate) && nowDate.getHours() >= H0 && nowDate.getHours() < H1 && <div className="cal-now" style={{ top: top(nowDate.toISOString()) }} />}
              {evs.map((a) => {
                const st = STATUS[statusOf(a)];
                const lane = laneOf(a);
                const w = 100 / lanes.length;
                const site = d.sites.find((s) => s.id === a.siteId);
                return (
                  <button
                    key={a.id}
                    className="cal-ev"
                    onClick={() => open({ type: "assignment", id: a.id })}
                    style={{
                      background: st.color,
                      color: st.color === "#FFCB00" ? "#1d1d1d" : "#fff",
                      top: top(a.start),
                      height: Math.max(22, top(a.end) - top(a.start) - 2),
                      insetInlineStart: `calc(${lane * w}% + 3px)`,
                      width: `calc(${w}% - 6px)`,
                    }}
                    title={`${a.title} · ${site?.name} · ${slot(a.start, a.end)} · ${st.label}`}
                  >
                    <b className="ell">{site?.name}</b>
                    <span className="ell" style={{ display: "block" }}>{hm(a.start)} {a.title}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="muted small" style={{ marginTop: 8 }}>Colours = status. Double-click an empty slot to add a task.</p>
    </div>
  );
}
