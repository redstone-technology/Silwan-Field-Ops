"use client";
import { useMemo, useState } from "react";
import { useData, useNow, useMe } from "@/lib/store";
import { isManager, leadOf } from "@/lib/rules";
import { addDays, format, hoursText, weekDays, isSameDay, ms } from "@/lib/time";
import { Avatar, Icon, useUI } from "@/components/ui";
import { weekRows } from "@/components/Drawers";

export default function Timesheets() {
  const d = useData();
  const me = useMe();
  const now = useNow();
  const open = useUI((s) => s.open);
  const [offset, setOffset] = useState(0);
  const [team, setTeam] = useState("");
  const ref = addDays(new Date(now), offset * 7);
  const days = weekDays(ref);
  const weekISO = days[0].toISOString();

  const people = d.people.filter(
    (p) => (p.role === "technician" || p.role === "lead") && (!team || p.teamId === team) && (isManager(me) || leadOf(d, me, p.teamId) || p.id === me.id),
  );

  const data = useMemo(
    () =>
      people.map((p) => {
        const rows = weekRows(d, p.id, weekISO, now);
        const perDay = days.map((day) => {
          const r = rows.filter((x) => isSameDay(new Date(x.a.start), day));
          return { planned: r.reduce((s, x) => s + x.planned, 0), actual: r.reduce((s, x) => s + x.actual, 0), flag: r.some((x) => x.late || x.early || x.missed), future: day.getTime() > now };
        });
        return {
          p,
          perDay,
          planned: rows.reduce((s, x) => s + x.planned, 0),
          actual: rows.reduce((s, x) => s + x.actual, 0),
          plannedSoFar: rows.reduce((s, x) => s + Math.max(0, Math.min(now, ms(x.a.end)) - ms(x.a.start)) / 3_600_000, 0),
          late: rows.filter((x) => x.late).length,
          early: rows.filter((x) => x.early).length,
          missed: rows.filter((x) => x.missed).length,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d, weekISO, now, team, me.id],
  );

  const csv = () => {
    const head = ["Technician", "Team", ...days.map((x) => format(x, "EEE d MMM") + " plan"), ...days.map((x) => format(x, "EEE d MMM") + " actual"), "Planned", "Actual", "Late", "Left early", "Missed"];
    const lines = data.map((r) => [
      r.p.name,
      d.teams.find((t) => t.id === r.p.teamId)?.name ?? "",
      ...r.perDay.map((x) => x.planned.toFixed(2)),
      ...r.perDay.map((x) => x.actual.toFixed(2)),
      r.planned.toFixed(2),
      r.actual.toFixed(2),
      r.late,
      r.early,
      r.missed,
    ]);
    const text = [head, ...lines].map((l) => l.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `silwan-timesheet-${format(days[0], "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="boardwrap">
      <div className="toolbar">
        <div className="row" style={{ gap: 6 }}>
          <button className="chip" onClick={() => setOffset(offset - 1)} aria-label="Previous week"><Icon n="back" s={16} /></button>
          <button className={`chip${offset === 0 ? " on" : ""}`} onClick={() => setOffset(0)}>This week</button>
          <button className="chip" onClick={() => setOffset(offset + 1)} aria-label="Next week"><Icon n="fwd" s={16} /></button>
        </div>
        <b>{format(days[0], "d MMM")} – {format(days[6], "d MMM yyyy")}</b>
        <select className="search" style={{ minWidth: 0 }} value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
          <option value="">All teams</option>
          {d.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span className="grow" />
        <button className="btn ghost sm" onClick={csv}><Icon n="down" s={16} /> Export CSV</button>
      </div>
      <div className="card" style={{ padding: "12px 14px" }}>
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Technician</th>
              {days.map((x) => (
                <th key={x.toISOString()} className="num" style={isSameDay(x, new Date(now)) ? { color: "var(--forest)" } : undefined}>{format(x, "EEE d")}</th>
              ))}
              <th className="num">Planned</th>
              <th className="num">Actual</th>
              <th className="num">Gap so far</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const gap = r.actual - r.plannedSoFar;
              return (
                <tr key={r.p.id} onClick={() => open({ type: "person-week", id: r.p.id, week: weekISO })}>
                  <td>
                    <span className="row"><Avatar p={r.p} /> <span><b>{r.p.name}</b><br /><span className="muted small">{d.teams.find((t) => t.id === r.p.teamId)?.name}</span></span></span>
                  </td>
                  {r.perDay.map((x, i) => (
                    <td key={i} className="num small">
                      {x.planned ? (
                        <>
                          <span style={{ fontWeight: 700, color: x.flag ? "var(--down)" : undefined }}>{x.future ? "—" : hoursText(x.actual)}</span>
                          <span className="muted"> / {hoursText(x.planned)}</span>
                        </>
                      ) : (
                        <span className="muted">·</span>
                      )}
                    </td>
                  ))}
                  <td className="num">{hoursText(r.planned)}</td>
                  <td className="num"><b>{hoursText(r.actual)}</b></td>
                  <td className="num" style={{ color: gap < -0.5 ? "var(--down)" : "var(--up)", fontWeight: 700 }}>{gap >= 0 ? "+" : ""}{hoursText(gap)}</td>
                  <td>
                    <span className="row" style={{ gap: 4 }}>
                      {r.late > 0 && <span className="pill red">{r.late} late</span>}
                      {r.early > 0 && <span className="pill red">{r.early} early</span>}
                      {r.missed > 0 && <span className="pill red">{r.missed} missed</span>}
                      {!r.late && !r.early && !r.missed && <span className="pill green">Clean</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted small" style={{ marginTop: 10 }}>Each day shows actual / planned hours. Red = late in, early out or missed. Click a person for the details.</p>
      </div>
    </div>
  );
}
