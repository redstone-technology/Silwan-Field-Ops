"use client";
import { useData, useNow, useMe } from "@/lib/store";
import { isManager } from "@/lib/rules";
import { isToday } from "@/lib/hooks";
import { Icon, useUI } from "@/components/ui";
import { Map } from "@/components/Map";

export default function Sites() {
  const d = useData();
  const now = useNow();
  const me = useMe();
  const open = useUI((s) => s.open);
  return (
    <div className="dash" style={{ gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)" }}>
      <div className="col">
        <div className="card fill" style={{ flex: 1 }}>
          <div className="card-h">
            <h2>{d.sites.length} sites</h2>
            {isManager(me) && <button className="btn lime sm" onClick={() => open({ type: "site" })}><Icon n="plus" s={16} /> New site</button>}
          </div>
          <div className="body">
            <table className="tbl">
              <thead>
                <tr><th>Site</th><th>Stage</th><th className="num">Jobs</th><th className="num">Today</th></tr>
              </thead>
              <tbody>
                {d.sites.map((s) => {
                  const all = d.assignments.filter((a) => a.siteId === s.id);
                  const today = all.filter((a) => isToday(a, now)).length;
                  return (
                    <tr key={s.id} onClick={() => open({ type: "site", id: s.id })}>
                      <td>
                        <span className="row"><i className="dot" style={{ background: s.color }} /><b className="ell" style={{ fontWeight: 500 }}>{s.name}</b></span>
                        <span className="muted small" style={{ paddingInlineStart: 17 }}>{s.client}</span>
                      </td>
                      <td><span className="pill">{s.stage}</span></td>
                      <td className="num">{all.length}</td>
                      <td className="num">{today || <span className="muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="col">
        <div className="card fill mapfill" style={{ flex: 1, padding: 14 }}>
          <div className="card-h" style={{ padding: "4px 6px 0" }}>
            <h2>All sites</h2>
            <span className="muted small">Circle = check-in zone</span>
          </div>
          <div className="mapbox" style={{ flex: 1 }}>
            <Map sites={d.sites} fitKey={String(d.sites.length)} onSiteClick={(id) => open({ type: "site", id })} />
          </div>
        </div>
      </div>
    </div>
  );
}
