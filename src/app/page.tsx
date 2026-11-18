"use client";
import { useMemo } from "react";
import { useData, useNow, useAlerts, useStore } from "@/lib/store";
import { useVisible, useTeamNow, isToday, useStatusOf } from "@/lib/hooks";
import { ALERT_META } from "@/lib/rules";
import { ago, hm, slot, ms } from "@/lib/time";
import { Avatar, Icon, StatusLabel, useUI, Empty } from "@/components/ui";
import { AppLink } from "@/components/AppLink";
import { Map } from "@/components/Map";

export default function Home() {
  const d = useData();
  const now = useNow();
  const visible = useVisible();
  const statusOf = useStatusOf(now);
  const team = useTeamNow(now);
  const { open: alerts } = useAlerts(now);
  const ack = useStore((s) => s.acknowledge);
  const openDrawer = useUI((s) => s.open);

  const today = useMemo(() => visible.filter((a) => isToday(a, now)).sort((x, y) => ms(x.start) - ms(y.start)), [visible, now]);
  const onSite = team.filter((t) => t.state === "onsite");
  const late = team.filter((t) => t.state === "late");
  const pins = onSite.map((t) => ({ person: t.person, lat: t.site!.lat, lng: t.site!.lng, note: `At ${t.site!.name} since ${hm(t.since)}` }));
  const activeSites = d.sites.filter((s) => today.some((a) => a.siteId === s.id));
  const person = (id: string) => d.people.find((p) => p.id === id);

  return (
    <div className="dash">
      {/* today's jobs */}
      <div className="col">
        <div className="card fill" style={{ flex: 1 }}>
          <div className="card-h">
            <h2>Today&apos;s jobs <span className="muted">· {today.length}</span></h2>
            <AppLink href="/board" className="linkbtn">Board →</AppLink>
          </div>
          <div className="body list">
            {today.map((a) => {
              const site = d.sites.find((s) => s.id === a.siteId);
              return (
                <button key={a.id} className="srow" onClick={() => openDrawer({ type: "assignment", id: a.id })}>
                  <Avatar p={person(a.assigneeIds[0])} />
                  <span className="grow">
                    <span className="t ell">{site?.name}</span>
                    <span className="s ell">{slot(a.start, a.end)} · {a.title}</span>
                  </span>
                  <StatusLabel k={statusOf(a)} />
                </button>
              );
            })}
            {!today.length && <Empty title="No jobs today" />}
          </div>
        </div>
      </div>

      {/* where is my team */}
      <div className="col">
        <div className="card fill mapfill" style={{ flex: 1.3, padding: 12 }}>
          <div className="card-h" style={{ padding: "4px 4px 0" }}>
            <h2>Where is my team now</h2>
            <span className="row small">
              <span className="pill lime">{onSite.length} on site</span>
              {late.length > 0 && <span className="pill red">{late.length} late</span>}
            </span>
          </div>
          <div className="mapbox" style={{ flex: 1 }}>
            <Map sites={activeSites} people={pins} fitKey={activeSites.map((s) => s.id).join()} zoom={13} showLabels={false} onSiteClick={(id) => openDrawer({ type: "site", id })} />
          </div>
        </div>
        <div className="card fill" style={{ flex: 1 }}>
          <div className="body list">
            {team
              .filter((t) => t.state === "onsite" || t.state === "late")
              .sort((x, y) => (x.state === "late" ? 0 : 1) - (y.state === "late" ? 0 : 1))
              .map((t) => (
                <button key={t.person.id} className="srow" onClick={() => t.a && openDrawer({ type: "assignment", id: t.a.id })}>
                  <Avatar p={t.person} />
                  <span className="grow">
                    <span className="t ell">{t.person.name}</span>
                    <span className="s ell">{t.site?.name}</span>
                  </span>
                  {t.state === "onsite" ? <span className="pill lime">On site · {hm(t.since)}</span> : <span className="pill red">Not arrived</span>}
                </button>
              ))}
            <span className="muted small" style={{ padding: "4px 2px" }}>
              Free now: {team.filter((t) => t.state === "free" || t.state === "next").map((t) => t.person.name.split(" ")[0]).join(", ") || "nobody"}
            </span>
          </div>
        </div>
      </div>

      {/* alerts */}
      <div className="col">
        <div className="card fill" style={{ flex: 1 }}>
          <div className="card-h">
            <h2>Alerts <span className="muted">· {alerts.length}</span></h2>
            <AppLink href="/alerts" className="linkbtn">All →</AppLink>
          </div>
          <div className="body list">
            {alerts.map((al) => (
              <div key={al.id} className="srow">
                <i className="dot" style={{ background: ALERT_META[al.type].color, width: 10, height: 10 }} />
                <button className="grow plain" onClick={() => openDrawer({ type: "assignment", id: al.assignmentId })}>
                  <span className="t">{al.title}</span>
                  <span className="s">{ALERT_META[al.type].label} · {ago(al.at, now)}</span>
                </button>
                <button className="ok" onClick={() => ack(al.id)} title="Got it" aria-label="Mark as handled"><Icon n="check" s={16} /></button>
              </div>
            ))}
            {!alerts.length && <Empty title="All good" text="No alerts right now." />}
          </div>
        </div>
      </div>
    </div>
  );
}
