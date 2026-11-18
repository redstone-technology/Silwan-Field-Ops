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
  const me = useMe();
  const open = useUI((s) => s.open);
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
      <div className="tabs">
        <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}><Icon n="home" s={16} /> Main table</button>
        <button className={view === "kanban" ? "on" : ""} onClick={() => setView("kanban")}><Icon n="kanban" s={16} /> Kanban</button>
        <button className={view === "calendar" ? "on" : ""} onClick={() => setView("calendar")}><Icon n="cal" s={16} /> Calendar</button>
      </div>
      <div className="toolbar">
        {canEdit(d, me) && (
          <span className="split">
            <button className="btn" onClick={() => open({ type: "assign" })}>New task</button>
            <button className="btn" aria-label="New maintenance ticket" title="New task" onClick={() => open({ type: "assign" })}><Icon n="chev" s={14} /></button>
          </span>
        )}
        <label className="tbtn search-t">
          <Icon n="search" s={17} />
          <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {view !== "calendar" ? (
          <label className="tbtn">
            <Icon n="cal" s={17} />
            <select value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Dates">
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="all">All dates</option>
            </select>
          </label>
        ) : (
          <span className="row" style={{ gap: 2 }}>
            <button className="tbtn" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week"><Icon n="back" s={16} /></button>
            <button className="tbtn" onClick={() => setWeekOffset(0)}>This week</button>
            <button className="tbtn" onClick={() => setWeekOffset(weekOffset + 1)} aria-label="Next week"><Icon n="fwd" s={16} /></button>
          </span>
        )}
        <label className="tbtn">
          <Icon n="person" s={17} />
          <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
            <option value="">Person: all teams</option>
            {d.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="tbtn">
          <Icon n="filter" s={17} />
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter">
            <option value="">Filter</option>
            <option value="task">Project tasks</option>
            <option value="maintenance">Maintenance tickets</option>
          </select>
        </label>
        {view === "table" && (
          <label className="tbtn">
            <Icon n="layers" s={17} />
            <select value={group} onChange={(e) => setGroup(e.target.value as Group)} aria-label="Group by">
              <option value="site">Group by: Site</option>
              <option value="team">Group by: Team</option>
            </select>
          </label>
        )}
      </div>
      <div className="card">
        {view === "table" && <TableView items={filtered} group={group} now={now} />}
        {view === "kanban" && <KanbanView items={filtered} now={now} />}
        {view === "calendar" && <CalendarView items={filtered} now={now} weekOffset={weekOffset} />}
      </div>
    </div>
  );
}

/* ---------------- table (monday main table) ---------------- */
function Battery({ keys }: { keys: StatusKey[] }) {
  const counts = new Map<StatusKey, number>();
  keys.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1));
  return (
    <span className="battery" title={[...counts].map(([k, n]) => `${STATUS[k].label}: ${n}`).join(" · ")}>
      {[...counts].map(([k, n]) => (
        <i key={k} style={{ background: STATUS[k].color, flex: n }} />
      ))}
    </span>
  );
}

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
  if (!shown.length) return <Empty title="No tasks match" text="Try another filter, or add a task." action={canEdit(d, me) ? <button className="btn" onClick={() => open({ type: "assign" })}>New task</button> : undefined} />;

  const multiDay = new Set(items.map((a) => new Date(a.start).toDateString())).size > 1;
  return (
    <div style={{ overflowX: "auto" }}>
      {shown.map((g) => {
        const keys = g.items.map((a) => statusOf(a));
        const first = g.items[0];
        const last = g.items[g.items.length - 1];
        return (
          <section className="group" key={g.id} style={{ ["--g" as string]: g.color, minWidth: 900 }}>
            <div className="group-h">
              <span className="gchev"><Icon n="chev" s={16} /></span>
              <h3>{g.name}</h3>
              <span className="muted small">{g.items.length} {g.items.length === 1 ? "task" : "tasks"} · {g.sub}</span>
            </div>
            <table className="mtable">
              <colgroup>
                <col style={{ width: 36 }} />
                <col />
                <col style={{ width: 96 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: multiDay ? 190 : 140 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 96 }} />
                <col style={{ width: 120 }} />
              </colgroup>
              <thead>
                <tr><th className="cb"><span className="box-cb" /></th><th className="name">Task</th><th>Person</th><th>Status</th><th>Time slot</th><th>Check in</th><th>Check out</th><th>Report</th></tr>
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
                  const st = statusOf(a);
                  const rep = !a.reportRequired
                    ? { t: "Not needed", c: "#C4C4C4" }
                    : reps === a.assigneeIds.length
                      ? { t: "Sent", c: "#00C875" }
                      : st === "report" || st === "missed"
                        ? { t: "Missing", c: "#DF2F4A" }
                        : { t: reps ? `${reps}/${a.assigneeIds.length} sent` : "Waiting", c: "#C4C4C4" };
                  return (
                    <tr key={a.id} onClick={() => open({ type: "assignment", id: a.id })}>
                      <td className="cb"><span className="box-cb" /></td>
                      <td className="name">
                        <span className="row" style={{ gap: 8 }}>
                          <span className="ell grow">{a.title}</span>
                          {a.kind === "maintenance" && <span className="tag-t">Ticket</span>}
                          {group === "team" && <span className="tag-t ell" style={{ maxWidth: 140 }}>{d.sites.find((s) => s.id === a.siteId)?.name}</span>}
                          {a.visibility === "assigned" && <span className="muted" title="Only assigned people can see this"><Icon n="lock" s={14} /></span>}
                          <span className="upd" title="Open details"><Icon n="chat" s={18} /></span>
                        </span>
                      </td>
                      <td><Avatars people={ppl} max={3} /></td>
                      <td className="stat"><StatusLabel k={st} cell /></td>
                      <td>
                        <span className="tl-pill">
                          <i style={{ width: `${Math.min(100, Math.max(0, ((now - ms(a.start)) / (ms(a.end) - ms(a.start))) * 100))}%` }} />
                          <span>{multiDay && `${format(new Date(a.start), "MMM d")}, `}{slot(a.start, a.end)}</span>
                        </span>
                      </td>
                      <td style={{ color: late ? "var(--down)" : undefined, fontWeight: late ? 600 : undefined }}>{hm(firstIn)}</td>
                      <td style={{ color: early ? "var(--down)" : undefined, fontWeight: early ? 600 : undefined }}>{lastOut ? hm(lastOut) : "—"}</td>
                      <td className="stat"><span className={`status cell${rep.c === "#C4C4C4" ? " dark" : ""}`} style={{ background: rep.t === "Not needed" ? "var(--ui-bg)" : rep.c, color: rep.t === "Not needed" ? "var(--muted)" : undefined }}>{rep.t}</span></td>
                    </tr>
                  );
                })}
                {canEdit(d, me) && (
                  <tr className="addrow" onClick={() => open({ type: "assign", siteId: group === "site" ? g.id : undefined })}>
                    <td className="cb"><span className="box-cb" /></td>
                    <td colSpan={7}>+ Add task</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} />
                  <td><Battery keys={keys} /></td>
                  <td><span className="tl-pill sum"><span>{format(new Date(first.start), "MMM d")}{format(new Date(first.start), "MMM d") !== format(new Date(last.end), "MMM d") ? ` – ${format(new Date(last.end), "MMM d")}` : ""}</span></span></td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </section>
        );
      })}
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
