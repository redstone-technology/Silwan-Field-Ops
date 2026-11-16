"use client";
import { useData, useMe, useNow } from "@/lib/store";
import { weekRows } from "@/components/Drawers";
import { format, hm, hoursText, slot, weekStart } from "@/lib/time";
import { Empty } from "@/components/ui";

export default function TechWeek() {
  const d = useData();
  const me = useMe();
  const now = useNow();
  const rows = weekRows(d, me.id, new Date(now).toISOString(), now);
  const planned = rows.reduce((s, r) => s + r.planned, 0);
  const actual = rows.reduce((s, r) => s + r.actual, 0);
  return (
    <div className="phonepage">
      <div className="phone">
        <div className="grid2">
          <div className="card"><span className="cap">Planned</span><div className="big">{hoursText(planned)}</div></div>
          <div className="card"><span className="cap">Worked</span><div className="big">{hoursText(actual)}</div></div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="card-h"><h2 style={{ fontSize: 17 }}>Week of {format(weekStart(new Date(now)), "d MMM")}</h2></div>
          <div className="list">
            {rows.map((r) => (
              <div key={r.a.id} className="task" style={{ gridTemplateColumns: "54px minmax(0,1fr) auto" }}>
                <span style={{ textAlign: "center" }}><b>{format(new Date(r.a.start), "EEE")}</b><br /><span className="muted small">{format(new Date(r.a.start), "d")}</span></span>
                <span style={{ minWidth: 0 }}>
                  <span className="t ell" style={{ display: "block" }}>{r.site?.name}</span>
                  <span className="s">{slot(r.a.start, r.a.end)} · in {hm(r.att?.checkInAt)} · out {hm(r.att?.checkOutAt)}</span>
                </span>
                <span className={`pill ${r.late || r.early || r.missed ? "red" : r.actual ? "green" : ""}`}>{r.missed ? "Missed" : hoursText(r.actual)}</span>
              </div>
            ))}
            {!rows.length && <Empty title="No jobs this week" />}
          </div>
        </div>
      </div>
    </div>
  );
}
