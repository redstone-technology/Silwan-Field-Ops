"use client";
import { useMemo, useState } from "react";
import { useStore, useData, useMe, useNow } from "@/lib/store";
import {
  ALERT_META,
  EDIT_LABEL,
  VIS_LABEL,
  attFor,
  canEdit,
  computeAlerts,
  personState,
  reportFor,
  statusOf,
  plannedHours,
  actualHours,
} from "@/lib/rules";
import type { Assignment, Kind, Priority, Site, Stage, Visibility, Editors } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { fmtDist } from "@/lib/geo";
import { addDays, dayLabel, format, hm, hoursText, minsText, ms, newId, slot, weekStart } from "@/lib/time";
import { Avatar, Drawer, Icon, StatusLabel, useUI } from "./ui";
import { Map } from "./Map";
import { IS_ARTIFACT } from "./AppLink";

export function Drawers() {
  const d = useUI((s) => s.drawer);
  const close = useUI((s) => s.close);
  if (!d) return null;
  switch (d.type) {
    case "assignment":
      return <AssignmentDetails id={d.id} onClose={close} />;
    case "assign":
      return <AssignForm id={d.id} siteId={d.siteId} start={d.start} onClose={close} />;
    case "site":
      return <SiteForm id={d.id} back={d.back} onClose={close} />;
    case "person-week":
      return <PersonWeek id={d.id} week={d.week} onClose={close} />;
    case "settings":
      return <SettingsDrawer onClose={close} />;
  }
}

const STATE_PILL: Record<string, { t: string; c: string }> = {
  waiting: { t: "Not started", c: "" },
  late: { t: "Late, not here", c: "red" },
  onsite: { t: "On site", c: "lime" },
  report: { t: "Report missing", c: "red" },
  done: { t: "Done", c: "green" },
  missed: { t: "Missed", c: "red" },
};

/* ================= assignment details ================= */
function AssignmentDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useData();
  const me = useMe();
  const now = useNow();
  const open = useUI((s) => s.open);
  const say = useUI((s) => s.say);
  const setManualStatus = useStore((s) => s.setManualStatus);
  const a = d.assignments.find((x) => x.id === id);
  const alerts = useMemo(() => computeAlerts(d, now).filter((x) => x.assignmentId === id), [d, now, id]);
  if (!a) return null;
  const site = d.sites.find((s) => s.id === a.siteId)!;
  const team = d.teams.find((t) => t.id === a.teamId);
  const st = statusOf(d, a, now);
  const people = a.assigneeIds.map((p) => d.people.find((x) => x.id === p)!).filter(Boolean);

  const dots = people.flatMap((p) => {
    const att = attFor(d, a.id, p.id);
    const out = [];
    if (att?.checkInLoc) out.push({ ...att.checkInLoc, color: "#00C875", label: `${p.name}: checked in ${hm(att.checkInAt)}` });
    if (att?.checkOutLoc) out.push({ ...att.checkOutLoc, color: "#FDAB3D", label: `${p.name}: checked out ${hm(att.checkOutAt)}` });
    const tries = d.attempts.filter((t) => t.assignmentId === a.id && t.personId === p.id);
    tries.forEach((t) => out.push({ lat: t.lat, lng: t.lng, color: "#E2445C", label: `${p.name}: blocked check-in, ${fmtDist(t.dist)} away` }));
    return out;
  });

  return (
    <Drawer
      title={a.title}
      sub={<span className="row wrap">{a.kind === "maintenance" ? <span className="pill red">Maintenance ticket</span> : <span className="pill">Task</span>} {site.name} · {dayLabel(a.start)} · {slot(a.start, a.end)}</span>}
      onClose={onClose}
      footer={
        canEdit(d, me, a) ? (
          <>
            {a.manualStatus ? (
              <button className="btn ghost" onClick={() => { setManualStatus(a.id, undefined); say("Status back to automatic"); }}>Undo manual status</button>
            ) : st !== "done" ? (
              <button className="btn ghost" onClick={() => { setManualStatus(a.id, "done"); say("Marked as done"); }}>Mark done</button>
            ) : null}
            <button className="btn" onClick={() => open({ type: "assign", id: a.id })}>Edit</button>
          </>
        ) : (
          <span className="muted small row"><Icon n="lock" s={16} /> You can view this task but not change it.</span>
        )
      }
    >
      <div className="row wrap" style={{ gap: 10 }}>
        <StatusLabel k={st} />
        {a.priority === "urgent" || a.priority === "high" ? <span className="pill red">{a.priority === "urgent" ? "Urgent" : "High priority"}</span> : null}
      </div>
      {a.description && <p>{a.description}</p>}

      <div className="mapbox" style={{ height: 210 }}>
        <Map sites={[site]} dots={dots} fitKey={a.id + dots.length} zoom={16} />
      </div>
      <div className="row wrap small muted" style={{ gap: 14, marginTop: -6 }}>
        <span className="row"><i className="dot" style={{ background: "#00C875" }} /> Check-in</span>
        <span className="row"><i className="dot" style={{ background: "#FDAB3D" }} /> Check-out</span>
        <span className="row"><i className="dot" style={{ background: "#E2445C" }} /> Blocked try</span>
        <span>Zone: {site.radius} m</span>
      </div>

      {alerts.length > 0 && (
        <div className="list">
          {alerts.map((al) => (
            <div key={al.id} className="note">
              <b>{ALERT_META[al.type].label}</b>
              {al.title}. {al.detail}
            </div>
          ))}
        </div>
      )}

      {people.map((p) => {
        const att = attFor(d, a.id, p.id);
        const rep = reportFor(d, a.id, p.id);
        const ps = personState(d, a, p.id, now);
        const pill = STATE_PILL[ps];
        return (
          <div className="box" key={p.id}>
            <div className="row">
              <Avatar p={p} />
              <b className="grow">{p.name}</b>
              <span className={`pill ${pill.c}`}>{pill.t}</span>
            </div>
            <div className="tl">
              <div className={att?.checkInAt ? "" : "off"}>
                {att?.checkInAt ? <>Checked in <b>{hm(att.checkInAt)}</b> <time>· {fmtDist(att.checkInDist ?? 0)} from site centre</time></> : <span className="muted">Not checked in</span>}
              </div>
              <div className={att?.checkOutAt ? "" : "off"}>
                {att?.checkOutAt ? <>Checked out <b>{hm(att.checkOutAt)}</b> <time>· worked {minsText((ms(att.checkOutAt) - ms(att.checkInAt)) / 60000)}</time></> : <span className="muted">Not checked out</span>}
              </div>
              {a.reportRequired && (
                <div className={rep ? "" : ps === "report" ? "bad" : "off"}>
                  {rep ? (
                    <>
                      Report <b>{hm(rep.at)}</b> <time>· {rep.outcome === "fixed" ? "Fixed" : rep.outcome === "partly" ? "Partly done" : "Needs follow-up"}</time>
                      <div style={{ marginTop: 4 }}>&ldquo;{rep.text}&rdquo;</div>
                    </>
                  ) : (
                    <span className="muted">No report yet</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="box">
        <span className="cap">Details & permissions</span>
        <dl className="kv">
          <dt>Site</dt><dd>{site.name}</dd>
          <dt>Client</dt><dd>{site.client}</dd>
          <dt>Stage</dt><dd>{site.stage}</dd>
          <dt>Team</dt><dd>{team?.name ?? "—"}</dd>
          <dt>Time slot</dt><dd>{dayLabel(a.start)}, {slot(a.start, a.end)}</dd>
          <dt>Report needed</dt><dd>{a.reportRequired ? "Yes" : "No"}</dd>
          <dt>Who can see</dt><dd>{VIS_LABEL[a.visibility]}</dd>
          <dt>Who can edit</dt><dd>{EDIT_LABEL[a.editors]}</dd>
          <dt>Who can check in</dt><dd>Only assigned people</dd>
        </dl>
      </div>
    </Drawer>
  );
}

/* ================= new / edit assignment ================= */
function toLocalDate(iso: string) {
  return format(new Date(iso), "yyyy-MM-dd");
}
function combine(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function AssignForm({ id, siteId, start, onClose }: { id?: string; siteId?: string; start?: string; onClose: () => void }) {
  const d = useData();
  const me = useMe();
  const save = useStore((s) => s.saveAssignment);
  const open = useUI((s) => s.open);
  const say = useUI((s) => s.say);
  const existing = d.assignments.find((x) => x.id === id);

  const [defStart] = useState(() => start ?? new Date(Math.ceil((Date.now() + 30 * 60000) / 1_800_000) * 1_800_000).toISOString());
  const [kind, setKind] = useState<Kind>(existing?.kind ?? "task");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [site, setSite] = useState(existing?.siteId ?? siteId ?? "");
  const [date, setDate] = useState(toLocalDate(existing?.start ?? defStart));
  const [from, setFrom] = useState(hm(existing?.start ?? defStart).padStart(5, "0"));
  const [to, setTo] = useState(hm(existing?.end ?? new Date(ms(defStart) + 3_600_000).toISOString()).padStart(5, "0"));
  const [teamId, setTeamId] = useState(existing?.teamId ?? "");
  const [who, setWho] = useState<string[]>(existing?.assigneeIds ?? []);
  const [desc, setDesc] = useState(existing?.description ?? "");
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? "normal");
  const [report, setReport] = useState(existing?.reportRequired ?? true);
  const [vis, setVis] = useState<Visibility>(existing?.visibility ?? "team");
  const [editors, setEditors] = useState<Editors>(existing?.editors ?? "managers+lead");
  const [err, setErr] = useState("");

  const field = d.people.filter((p) => p.role === "technician" || p.role === "lead");
  const ordered = teamId ? [...field.filter((p) => p.teamId === teamId), ...field.filter((p) => p.teamId !== teamId)] : field;

  const pickTeam = (t: string) => {
    setTeamId(t);
    if (t) setWho(d.people.filter((p) => p.teamId === t).map((p) => p.id));
  };
  const toggle = (pid: string) => setWho((w) => (w.includes(pid) ? w.filter((x) => x !== pid) : [...w, pid]));

  const s = combine(date, from);
  const e = combine(date, to);
  const clashes = who
    .map((pid) => {
      const c = d.assignments.find(
        (x) => x.id !== id && x.manualStatus !== "cancelled" && x.assigneeIds.includes(pid) && ms(x.start) < ms(e) && ms(x.end) > ms(s),
      );
      return c ? `${d.people.find((p) => p.id === pid)?.name} already has "${c.title}" ${slot(c.start, c.end)}` : null;
    })
    .filter(Boolean);

  const submit = () => {
    if (!title.trim()) return setErr(kind === "maintenance" ? "Write the issue." : "Write what the task is.");
    if (!site) return setErr("Pick a site.");
    if (!who.length) return setErr("Pick at least one person.");
    if (ms(e) <= ms(s)) return setErr("End time must be after start time.");
    const firstTeam = teamId || d.people.find((p) => p.id === who[0])?.teamId;
    const a: Assignment = {
      id: existing?.id ?? newId("a"),
      kind,
      title: title.trim(),
      description: desc.trim(),
      siteId: site,
      teamId: firstTeam,
      assigneeIds: who,
      start: s,
      end: e,
      visibility: vis,
      editors,
      priority: kind === "maintenance" ? priority : "normal",
      reportRequired: report,
      createdBy: existing?.createdBy ?? me.id,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      manualStatus: existing?.manualStatus,
    };
    save(a);
    say(existing ? "Task updated" : `Assigned to ${who.length} ${who.length === 1 ? "person" : "people"}`);
    onClose();
  };

  return (
    <Drawer
      title={existing ? "Edit task" : "New task"}
      sub="Who goes where, when, and who can see it."
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn lime" onClick={submit}>{existing ? "Save" : "Assign"}</button>
        </>
      }
    >
      <div className="form">
        <div className="seg">
          <button className={kind === "task" ? "on" : ""} onClick={() => setKind("task")}><Icon n="cam" s={16} /> Project task</button>
          <button className={kind === "maintenance" ? "on" : ""} onClick={() => { setKind("maintenance"); setVis("assigned"); }}><Icon n="wrench" s={16} /> Maintenance ticket</button>
        </div>
        <label className="f">
          {kind === "maintenance" ? "Issue" : "Task"}
          <input className="input" value={title} onChange={(x) => setTitle(x.target.value)} placeholder={kind === "maintenance" ? "e.g. Camera offline in lobby" : "e.g. Pull cables, floors 3–5"} />
        </label>
        <label className="f">
          <span className="row">Site <span className="grow" /><button type="button" className="linkbtn" onClick={() => open({ type: "site", back: true })}>+ New site</button></span>
          <select className="input" value={site} onChange={(x) => setSite(x.target.value)}>
            <option value="">Choose a site…</option>
            {d.sites.map((st: Site) => (
              <option key={st.id} value={st.id}>{st.name} · {st.client}</option>
            ))}
          </select>
        </label>
        <div className="grid3">
          <label className="f">Date<input type="date" className="input" value={date} onChange={(x) => setDate(x.target.value)} /></label>
          <label className="f">From<input type="time" className="input" value={from} onChange={(x) => setFrom(x.target.value)} /></label>
          <label className="f">To<input type="time" className="input" value={to} onChange={(x) => setTo(x.target.value)} /></label>
        </div>
        <label className="f">
          Team <span className="hint">Picking a team selects all its members. You can untick people.</span>
          <select className="input" value={teamId} onChange={(x) => pickTeam(x.target.value)}>
            <option value="">No team (pick people)</option>
            {d.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <div className="f" style={{ display: "grid", gap: 8 }}>
          <b style={{ fontSize: 14 }}>People</b>
          <div className="row wrap" style={{ gap: 6 }}>
            {ordered.map((p) => (
              <button key={p.id} type="button" className={`chip${who.includes(p.id) ? " on" : ""}`} onClick={() => toggle(p.id)}>
                {who.includes(p.id) && <Icon n="check" s={14} />} {p.name}
              </button>
            ))}
          </div>
          {clashes.length > 0 && (
            <div className="note"><b>Time clash</b>{clashes.join(". ")}.</div>
          )}
        </div>
        <label className="f">
          Details <span className="hint">Optional. What to do, who to ask for on site.</span>
          <textarea className="input" value={desc} onChange={(x) => setDesc(x.target.value)} />
        </label>
        {kind === "maintenance" && (
          <div className="f" style={{ display: "grid", gap: 8 }}>
            <b style={{ fontSize: 14 }}>Priority</b>
            <div className="seg">
              {(["normal", "high", "urgent"] as Priority[]).map((p) => (
                <button key={p} className={priority === p ? "on" : ""} onClick={() => setPriority(p)}>{p[0].toUpperCase() + p.slice(1)}</button>
              ))}
            </div>
          </div>
        )}
        <div className="box">
          <span className="cap row"><Icon n="lock" s={15} /> Permissions</span>
          <div style={{ display: "grid", gap: 8 }}>
            <b style={{ fontSize: 14 }}>Who can see this task</b>
            <div className="seg" style={{ flexWrap: "wrap" }}>
              {(["assigned", "team", "everyone"] as Visibility[]).map((v) => (
                <button key={v} className={vis === v ? "on" : ""} onClick={() => setVis(v)}>{VIS_LABEL[v]}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <b style={{ fontSize: 14 }}>Who can change it</b>
            <div className="seg">
              {(["managers", "managers+lead"] as Editors[]).map((v) => (
                <button key={v} className={editors === v ? "on" : ""} onClick={() => setEditors(v)}>{EDIT_LABEL[v]}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <b style={{ fontSize: 14 }}>Report needed when done</b>
            <div className="seg">
              <button className={report ? "on" : ""} onClick={() => setReport(true)}>Yes</button>
              <button className={!report ? "on" : ""} onClick={() => setReport(false)}>No</button>
            </div>
          </div>
          <span className="muted small">Only the assigned people can check in, and only inside the site zone.</span>
        </div>
        {err && <div className="note"><b>Missing</b>{err}</div>}
      </div>
    </Drawer>
  );
}

/* ================= new / edit site ================= */
interface Hit { display_name: string; lat: string; lon: string }

function SiteForm({ id, back, onClose }: { id?: string; back?: boolean; onClose: () => void }) {
  const d = useData();
  const save = useStore((s) => s.saveSite);
  const say = useUI((s) => s.say);
  const openDrawer = useUI((s) => s.open);
  const existing = d.sites.find((s) => s.id === id);
  const [name, setName] = useState(existing?.name ?? "");
  const [client, setClient] = useState(existing?.client ?? "");
  const [stage, setStage] = useState<Stage>(existing?.stage ?? "Installation");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [pick, setPick] = useState<{ lat: number; lng: number } | null>(existing ? { lat: existing.lat, lng: existing.lng } : null);
  const [radius, setRadius] = useState(existing?.radius ?? 150);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [fitKey, setFitKey] = useState("start");

  const search = async () => {
    if (!q.trim()) return;
    setBusy("search");
    setErr("");
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=qa&q=${encodeURIComponent(q)}`, {
        headers: { "Accept-Language": "en" },
      });
      const j: Hit[] = await r.json();
      setHits(j);
      if (!j.length) setErr("No match. Try a shorter name, or tap the map to drop a pin.");
    } catch {
      setErr("Search didn't work. Tap the map to drop a pin instead.");
    }
    setBusy("");
  };
  const choose = (h: Hit) => {
    setPick({ lat: +h.lat, lng: +h.lon });
    setFitKey(h.lat + h.lon);
    if (!address) setAddress(h.display_name.split(",").slice(0, 3).join(","));
    if (!name) setName(h.display_name.split(",")[0]);
    setHits([]);
  };
  const here = () => {
    if (!navigator.geolocation) return setErr("This browser can't read location.");
    setBusy("gps");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPick({ lat: p.coords.latitude, lng: p.coords.longitude });
        setFitKey(String(p.timestamp));
        setBusy("");
      },
      (e) => {
        setErr(e.code === 1 ? "Location permission was blocked. Allow it in the browser settings." : "Couldn't get location. Try again outside.");
        setBusy("");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const submit = () => {
    if (!name.trim()) return setErr("Give the site a name.");
    if (!pick) return setErr("Set the location: search, use your location, or tap the map.");
    const siteId = existing?.id ?? newId("site");
    save({
      id: siteId,
      name: name.trim(),
      client: client.trim() || "—",
      address: address.trim(),
      stage,
      lat: pick.lat,
      lng: pick.lng,
      radius,
      color: existing?.color ?? ["#579BFC", "#A25DDC", "#00C875", "#FDAB3D", "#E2445C", "#FF642E", "#66CCFF", "#037F4C"][d.sites.length % 8],
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
    say(existing ? "Site saved" : `Site "${name}" added`);
    if (back) openDrawer({ type: "assign", siteId });
    else onClose();
  };

  return (
    <Drawer
      title={existing ? "Edit site" : "New site"}
      sub="Set the location once. Check-in only works inside the circle."
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn lime" onClick={submit}>Save site</button>
        </>
      }
    >
      <div className="form">
        <div className="grid2">
          <label className="f">Site name<input className="input" value={name} onChange={(x) => setName(x.target.value)} placeholder="e.g. Fairmont Hotel" /></label>
          <label className="f">Client<input className="input" value={client} onChange={(x) => setClient(x.target.value)} placeholder="e.g. Hotel facilities team" /></label>
        </div>
        <label className="f">
          Stage <span className="hint">Just a label for now.</span>
          <select className="input" value={stage} onChange={(x) => setStage(x.target.value as Stage)}>
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <div className="box">
          <span className="cap">Location</span>
          {IS_ARTIFACT ? (
            <span className="muted small">Tap the map to drop a pin. (Place search and &ldquo;use my location&rdquo; work on the live link, not in this Claude preview.)</span>
          ) : (
            <>
          <div className="row">
            <input
              className="input grow"
              value={q}
              onChange={(x) => setQ(x.target.value)}
              onKeyDown={(x) => x.key === "Enter" && search()}
              placeholder='Search, e.g. "Fairmont Doha"'
            />
            <button className="btn sm" onClick={search} disabled={busy === "search"}><Icon n="search" s={16} /> {busy === "search" ? "…" : "Find"}</button>
          </div>
          {hits.length > 0 && (
            <div className="searchres">
              {hits.map((h, i) => <button key={i} onClick={() => choose(h)}>{h.display_name}</button>)}
            </div>
          )}
          <div className="row wrap">
            <button className="btn ghost sm" onClick={here} disabled={busy === "gps"}><Icon n="gps" s={16} /> {busy === "gps" ? "Getting location…" : "Use my location"}</button>
            <span className="muted small">or tap the map to drop a pin</span>
          </div>
            </>
          )}
          <div className="mapbox" style={{ height: 260 }}>
            <Map sites={IS_ARTIFACT || !pick ? d.sites.filter((x) => x.id !== id) : []} pick={pick} pickRadius={radius} onPick={setPick} fitKey={fitKey} zoom={pick ? 16 : 11} showLabels={IS_ARTIFACT} />
          </div>
          <label className="f">
            <span className="row">Check-in zone <span className="grow" /><span className="pill forest">{radius} m</span></span>
            <input type="range" min={50} max={500} step={10} value={radius} onChange={(x) => setRadius(+x.target.value)} />
            <span className="hint">The invisible circle around the site. 150 m fits most buildings. Bigger for malls and compounds.</span>
          </label>
          <label className="f">Address <span className="hint">Optional</span><input className="input" value={address} onChange={(x) => setAddress(x.target.value)} /></label>
          {pick && <span className="muted small">Pin: {pick.lat.toFixed(5)}, {pick.lng.toFixed(5)}</span>}
        </div>
        {err && <div className="note"><b>Check</b>{err}</div>}
      </div>
    </Drawer>
  );
}

/* ================= one technician's week ================= */
export function weekRows(d: ReturnType<typeof useData>, personId: string, weekISO: string, now: number) {
  const ws = weekStart(new Date(weekISO));
  const we = addDays(ws, 7);
  return d.assignments
    .filter((a) => a.assigneeIds.includes(personId) && ms(a.start) >= ws.getTime() && ms(a.start) < we.getTime() && a.manualStatus !== "cancelled")
    .sort((x, y) => ms(x.start) - ms(y.start))
    .map((a) => {
      const att = attFor(d, a.id, personId);
      const lateMin = att?.checkInAt ? (ms(att.checkInAt) - ms(a.start)) / 60000 : 0;
      const earlyMin = att?.checkOutAt ? (ms(a.end) - ms(att.checkOutAt)) / 60000 : 0;
      return {
        a,
        att,
        site: d.sites.find((s) => s.id === a.siteId),
        planned: plannedHours(a),
        actual: actualHours(att, now),
        late: lateMin > d.settings.lateGraceMin ? lateMin : 0,
        early: earlyMin > d.settings.earlyLeaveMin ? earlyMin : 0,
        missed: !att?.checkInAt && ms(a.end) < now,
      };
    });
}

function PersonWeek({ id, week, onClose }: { id: string; week: string; onClose: () => void }) {
  const d = useData();
  const now = useNow();
  const open = useUI((s) => s.open);
  const p = d.people.find((x) => x.id === id)!;
  const rows = weekRows(d, id, week, now);
  const planned = rows.reduce((s, r) => s + r.planned, 0);
  const actual = rows.reduce((s, r) => s + r.actual, 0);
  const ws = weekStart(new Date(week));
  return (
    <Drawer title={p.name} sub={`Week of ${format(ws, "d MMM")} · ${d.teams.find((t) => t.id === p.teamId)?.name ?? ""}`} onClose={onClose}>
      <div className="grid2">
        <div className="box"><span className="cap">Planned</span><span className="big">{hoursText(planned)}</span></div>
        <div className="box"><span className="cap">Actual</span><span className="big" style={{ color: actual < planned - 1 ? "var(--down)" : undefined }}>{hoursText(actual)}</span></div>
      </div>
      <div className="card" style={{ padding: 8 }}>
        <table className="tbl">
          <thead>
            <tr><th>Day</th><th>Site</th><th>Slot</th><th>In</th><th>Out</th><th className="num">Plan</th><th className="num">Actual</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.a.id} onClick={() => open({ type: "assignment", id: r.a.id })}>
                <td>{format(new Date(r.a.start), "EEE d")}</td>
                <td className="ell" style={{ maxWidth: 130 }}>{r.site?.name}</td>
                <td>{slot(r.a.start, r.a.end)}</td>
                <td style={{ color: r.late ? "var(--down)" : undefined }}>{r.missed ? <span className="pill red">Missed</span> : hm(r.att?.checkInAt)}</td>
                <td style={{ color: r.early ? "var(--down)" : undefined }}>{hm(r.att?.checkOutAt)}</td>
                <td className="num">{hoursText(r.planned)}</td>
                <td className="num">{hoursText(r.actual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="muted small" style={{ padding: 12 }}>No tasks this week.</p>}
      </div>
      <span className="muted small">Red = late in or early out. Actual hours come from GPS-checked check-in and check-out.</span>
    </Drawer>
  );
}

/* ================= alert rules ================= */
function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const settings = useStore((s) => s.settings);
  const saveSettings = useStore((s) => s.saveSettings);
  const say = useUI((s) => s.say);
  const [v, setV] = useState(settings);
  const rows: [keyof typeof v, string, string][] = [
    ["lateGraceMin", "Late after", "Minutes after the start time with no check-in"],
    ["earlyLeaveMin", "Left early if", "Checked out this many minutes before the end"],
    ["stillOnSiteMin", "Still on site after", "Minutes after check-out, phone still inside the site"],
    ["reportDueMin", "Report due within", "Minutes after check-out"],
  ];
  return (
    <Drawer
      title="Alert rules"
      sub="When should the manager get an alert?"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn lime" onClick={() => { saveSettings(v); say("Alert rules saved"); onClose(); }}>Save</button>
        </>
      }
    >
      <div className="form">
        {rows.map(([k, label, hint]) => (
          <label className="f" key={k}>
            {label} <span className="hint">{hint}</span>
            <div className="row">
              <input type="number" min={1} max={240} className="input" style={{ maxWidth: 120 }} value={v[k]} onChange={(x) => setV({ ...v, [k]: Math.max(1, +x.target.value) })} />
              <span className="muted">minutes</span>
            </div>
          </label>
        ))}
      </div>
    </Drawer>
  );
}
