"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useData, useNow, useAlerts, useStore } from "@/lib/store";
import { useVisible, useTeamNow, isToday, useStatusOf } from "@/lib/hooks";
import { ALERT_META } from "@/lib/rules";
import { ago, hm, slot, ms } from "@/lib/time";
import { Avatar, Avatars, Icon, StatusLabel, useUI, Empty } from "@/components/ui";
import { Map } from "@/components/Map";

type Bucket = "all" | "scheduled" | "onsite" | "late" | "done";

export default function Today() {
  const d = useData();
  const now = useNow();
  const visible = useVisible();
  const statusOf = useStatusOf(now);
  const team = useTeamNow(now);
  const { open: alerts } = useAlerts(now);
  const ack = useStore((s) => s.acknowledge);
  const openDrawer = useUI((s) => s.open);
  const [bucket, setBucket] = useState<Bucket>("all");

  const today = useMemo(
    () => visible.filter((a) => isToday(a, now)).sort((x, y) => ms(x.start) - ms(y.start)),
    [visible, now],
  );
  const bucketOf = (k: string): Bucket =>
    k === "onsite" ? "onsite" : k === "done" || k === "report" ? "done" : k === "late" || k === "missed" || k === "stuck" ? "late" : "scheduled";
  const counts = { scheduled: 0, onsite: 0, late: 0, done: 0 };
  today.forEach((a) => counts[bucketOf(statusOf(a)) as keyof typeof counts]++);
  const list = bucket === "all" ? today : today.filter((a) => bucketOf(statusOf(a)) === bucket);

  const onSite = team.filter((t) => t.state === "onsite");
  const pins = onSite.map((t) => ({ person: t.person, lat: t.site!.lat, lng: t.site!.lng, note: `At ${t.site!.name} since ${hm(t.since)}` }));
  const activeSites = d.sites.filter((s) => today.some((a) => a.siteId === s.id));
  const person = (id: string) => d.people.find((p) => p.id === id);

  const TEAM_LABEL = { onsite: "On site", late: "Not arrived", next: "Coming up", free: "Free" };

  return (
    <div className="dash">
      {/* left: today's jobs */}
      <div className="col">
        <div className="feature">
          <svg className="star" viewBox="0 0 100 100" aria-hidden><path d="M50 0l12 38 38 12-38 12-12 38-12-38L0 50l38-12z" fill="#fff" /></svg>
          <span className="tag">Today · {today.length} jobs <i /></span>
          <div className="tiles">
            {(["scheduled", "onsite", "late", "done"] as const).map((k) => (
              <button key={k} className="tile" onClick={() => setBucket(bucket === k ? "all" : k)} style={bucket === k ? { boxShadow: "inset 0 0 0 2px var(--forest)" } : undefined}>
                <b>{counts[k]}</b>
                <span>{k === "scheduled" ? "Coming" : k === "onsite" ? "On site" : k === "late" ? "Late" : "Done"}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="card fill" style={{ flex: 1 }}>
          <div className="card-h">
            <h2>{bucket === "all" ? "Today's jobs" : `Today · ${bucket === "scheduled" ? "coming" : bucket === "onsite" ? "on site" : bucket}`}</h2>
            <Link href="/board" className="linkbtn">Board →</Link>
          </div>
          <div className="body list">
            {list.map((a) => {
              const site = d.sites.find((s) => s.id === a.siteId);
              return (
                <button key={a.id} className="task" onClick={() => openDrawer({ type: "assignment", id: a.id })}>
                  <span className="ic"><Icon n={a.kind === "maintenance" ? "wrench" : "cam"} /></span>
                  <span style={{ minWidth: 0 }}>
                    <span className="t ell" style={{ display: "block" }}>{a.title}</span>
                    <span className="s ell" style={{ display: "block" }}>{site?.name} · {slot(a.start, a.end)}</span>
                    <span style={{ display: "block", marginTop: 4 }}><Avatars people={a.assigneeIds.map(person)} /></span>
                  </span>
                  <StatusLabel k={statusOf(a)} />
                </button>
              );
            })}
            {!list.length && <Empty title="Nothing here" text="No jobs in this group today." />}
          </div>
        </div>
      </div>

      {/* middle: where is my team now */}
      <div className="col">
        <div className="card fill mapfill" style={{ flex: 1.35, padding: 14 }}>
          <div className="card-h" style={{ padding: "4px 6px 0" }}>
            <h2>Where is my team now</h2>
            <span className="pill lime">{onSite.length} on site</span>
          </div>
          <div className="mapbox" style={{ flex: 1 }}>
            <Map sites={activeSites} people={pins} fitKey={activeSites.map((s) => s.id).join()} zoom={13} onSiteClick={(id) => openDrawer({ type: "site", id })} />
          </div>
        </div>
        <div className="card fill" style={{ flex: 1 }}>
          <div className="card-h">
            <h2>Team</h2>
            <span className="muted small">From check-ins, not live tracking</span>
          </div>
          <div className="body list">
            {(["onsite", "late", "next", "free"] as const).map((k) =>
              team
                .filter((t) => t.state === k)
                .map((t) => (
                  <button key={t.person.id} className="task" style={{ gridTemplateColumns: "34px minmax(0,1fr) auto", padding: "8px 10px" }} onClick={() => t.a && openDrawer({ type: "assignment", id: t.a.id })}>
                    <Avatar p={t.person} />
                    <span style={{ minWidth: 0 }}>
                      <span className="t ell" style={{ display: "block", fontSize: 14.5 }}>{t.person.name}</span>
                      <span className="s ell" style={{ display: "block" }}>
                        {k === "onsite" && `${t.site?.name} since ${hm(t.since)}`}
                        {k === "late" && `Expected at ${t.site?.name} ${hm(t.a?.start)}`}
                        {k === "next" && `${t.site?.name} at ${hm(t.a?.start)}`}
                        {k === "free" && "No job right now"}
                      </span>
                    </span>
                    <span className={`pill ${k === "onsite" ? "lime" : k === "late" ? "red" : ""}`}>{TEAM_LABEL[k]}</span>
                  </button>
                )),
            )}
          </div>
        </div>
      </div>

      {/* right: live alerts */}
      <div className="col">
        <div className="card fill" style={{ flex: 1 }}>
          <div className="card-h">
            <h2>Live alerts</h2>
            <Link href="/alerts" className="linkbtn">All →</Link>
          </div>
          <div className="body list">
            {alerts.map((al) => (
              <div key={al.id} className="alertrow">
                <span className="bar" style={{ background: ALERT_META[al.type].color }} />
                <button style={{ all: "unset", cursor: "pointer", minWidth: 0 }} onClick={() => openDrawer({ type: "assignment", id: al.assignmentId })}>
                  <span className="cap" style={{ color: ALERT_META[al.type].color }}>{ALERT_META[al.type].label}</span>
                  <span className="t" style={{ display: "block" }}>{al.title}</span>
                  <span className="s" style={{ display: "block" }}>{al.detail}</span>
                  <span className="s" style={{ display: "block" }}>{ago(al.at, now)}</span>
                </button>
                <button className="btn ghost sm" style={{ background: "var(--card)" }} onClick={() => ack(al.id)} title="Mark as handled">Got it</button>
              </div>
            ))}
            {!alerts.length && <Empty title="All good" text="No alerts right now." />}
          </div>
        </div>
      </div>
    </div>
  );
}
