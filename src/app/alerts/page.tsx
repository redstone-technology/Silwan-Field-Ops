"use client";
import { useMemo, useState } from "react";
import { useData, useNow, useAlerts, useStore, useMe } from "@/lib/store";
import { ALERT_META, canSee, isManager } from "@/lib/rules";
import type { AlertType } from "@/lib/types";
import { ago, format } from "@/lib/time";
import { Avatar, Icon, useUI, Empty } from "@/components/ui";

const FILTERS: { id: "all" | AlertType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "late", label: "Late" },
  { id: "checkin-rejected", label: "Outside site" },
  { id: "still-on-site", label: "Still on site" },
  { id: "report-late", label: "Report late" },
  { id: "early-checkout", label: "Left early" },
  { id: "overdue", label: "Overdue" },
];

export default function Alerts() {
  const d = useData();
  const me = useMe();
  const now = useNow();
  const { all, ack } = useAlerts(now);
  const acknowledge = useStore((s) => s.acknowledge);
  const open = useUI((s) => s.open);
  const [f, setF] = useState<"all" | AlertType>("all");
  const [handled, setHandled] = useState(false);

  const mine = useMemo(
    () => all.filter((a) => { const x = d.assignments.find((y) => y.id === a.assignmentId); return x && canSee(d, me, x); }),
    [all, d, me],
  );
  const list = mine.filter((a) => (f === "all" || a.type === f) && (handled || !ack[a.id]));
  const count = (t: "all" | AlertType) => mine.filter((a) => (t === "all" || a.type === t) && !ack[a.id]).length;

  return (
    <div className="boardwrap">
      <div className="toolbar">
        <div className="row wrap" style={{ gap: 6 }}>
          {FILTERS.map((x) => (
            <button key={x.id} className={`chip${f === x.id ? " on" : ""}`} onClick={() => setF(x.id)}>
              {x.id !== "all" && <i className="dot" style={{ background: ALERT_META[x.id].color }} />}
              {x.label} <span style={{ opacity: .7 }}>{count(x.id)}</span>
            </button>
          ))}
        </div>
        <span className="grow" />
        <button className={`chip${handled ? " on" : ""}`} onClick={() => setHandled(!handled)}>Show handled</button>
        {isManager(me) && <button className="btn ghost sm" onClick={() => open({ type: "settings" })}><Icon n="gear" s={16} /> Alert rules</button>}
      </div>
      <div className="card">
        <div className="list">
          {list.map((al) => {
            const p = d.people.find((x) => x.id === al.personId);
            const done = !!ack[al.id];
            return (
              <div key={al.id} className={`alertrow withav${done ? " handled" : ""}`}>
                <span className="bar" style={{ background: ALERT_META[al.type].color }} />
                <Avatar p={p} lg />
                <button style={{ all: "unset", cursor: "pointer", minWidth: 0 }} onClick={() => open({ type: "assignment", id: al.assignmentId })}>
                  <span className="row wrap" style={{ gap: 8 }}>
                    <span className="cap" style={{ color: ALERT_META[al.type].color }}>{ALERT_META[al.type].label}</span>
                    {al.live && !done && <span className="pill red">Now</span>}
                    <span className="muted small">{format(new Date(al.at), "EEE d MMM, H:mm")} · {ago(al.at, now)}</span>
                  </span>
                  <span className="t" style={{ display: "block" }}>{al.title}</span>
                  <span className="s" style={{ display: "block" }}>{al.detail}</span>
                </button>
                {done ? (
                  <span className="pill green"><Icon n="check" s={14} /> Handled</span>
                ) : (
                  <button className="btn ghost sm" style={{ background: "var(--card)" }} onClick={() => acknowledge(al.id)}>Got it</button>
                )}
              </div>
            );
          })}
          {!list.length && <Empty title="No alerts here" text="Nothing matches this filter." />}
        </div>
      </div>
    </div>
  );
}
