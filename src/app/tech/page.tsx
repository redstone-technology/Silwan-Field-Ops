"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useData, useMe, useNow, useStore, type LocMode } from "@/lib/store";
import { attFor, personState, reportFor, statusOf } from "@/lib/rules";
import type { Assignment, GeoPoint, Outcome, Site } from "@/lib/types";
import { distanceM, fmtDist, offset } from "@/lib/geo";
import { ageMs, hm, isSameDay, minsText, ms, newId, slot } from "@/lib/time";
import { Icon, StatusLabel, useUI, Empty } from "@/components/ui";
import { Map } from "@/components/Map";
import { IS_ARTIFACT } from "@/components/AppLink";

/** Read the phone's real position (or a demo position). */
function readLocation(mode: LocMode, site: Site): Promise<GeoPoint> {
  if (mode === "at-site") return Promise.resolve({ ...offset(site, 20, -15), accuracy: 8 });
  if (mode === "away") return Promise.resolve({ ...offset(site, 1000, 700), accuracy: 12 });
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This browser can't read location."));
    if (!window.isSecureContext) return reject(new Error("Location needs a secure (https) link."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (e) =>
        reject(
          new Error(
            e.code === 1
              ? "Location is blocked. Allow location for this site in your phone settings, then try again."
              : e.code === 3
                ? "GPS took too long. Step outside or near a window and try again."
                : "Couldn't read your location. Try again.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

export default function TechDay() {
  const d = useData();
  const me = useMe();
  const now = useNow(10_000);
  const consented = useStore((s) => s.consented[me.id]);
  const consent = useStore((s) => s.consent);

  const mine = useMemo(
    () =>
      d.assignments
        .filter((a) => a.assigneeIds.includes(me.id) && a.manualStatus !== "cancelled" && isSameDay(new Date(a.start), new Date(now)))
        .sort((x, y) => ms(x.start) - ms(y.start)),
    [d, me.id, now],
  );
  // focus: open job first, then the next one not finished
  const auto = useMemo(() => {
    const open = mine.find((a) => personState(d, a, me.id, now) === "onsite");
    if (open) return open;
    return mine.find((a) => ["waiting", "late", "report"].includes(personState(d, a, me.id, now))) ?? mine[mine.length - 1];
  }, [mine, d, me.id, now]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const focus = mine.find((a) => a.id === pickedId) ?? auto;

  return (
    <div className="phonepage">
      <div className="phone">
        {!consented && (
          <div className="consent">
            <span className="row"><Icon n="gps" /> <b>Location, only during your tasks</b></span>
            <p className="small">
              Silwan checks your phone&apos;s location only when you check in and check out, and while you are at the job site.
              No tracking outside your tasks or after work.
            </p>
            <button className="btn" onClick={() => consent(me.id)}>OK, I understand</button>
          </div>
        )}

        {focus ? <JobCard a={focus} now={now} disabled={!consented} /> : <Empty title="No jobs today" text="Enjoy your day. New jobs will show here." />}

        {mine.length > 1 && (
          <div className="card" style={{ padding: 16 }}>
            <div className="card-h"><h2 style={{ fontSize: 17 }}>Today</h2><span className="muted small">{mine.length} jobs</span></div>
            <div className="list">
              {mine.map((a) => {
                const site = d.sites.find((s) => s.id === a.siteId);
                return (
                  <button key={a.id} className="task" onClick={() => setPickedId(a.id)} style={a.id === focus?.id ? { boxShadow: "inset 0 0 0 2px var(--lime)" } : undefined}>
                    <span className="ic"><Icon n={a.kind === "maintenance" ? "wrench" : "cam"} /></span>
                    <span style={{ minWidth: 0 }}>
                      <span className="t ell" style={{ display: "block" }}>{a.title}</span>
                      <span className="s ell" style={{ display: "block" }}>{site?.name} · {slot(a.start, a.end)}</span>
                    </span>
                    <StatusLabel k={statusOf(d, a, now)} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <DemoTools onCreated={setPickedId} />
      </div>
    </div>
  );
}

function JobCard({ a, now, disabled }: { a: Assignment; now: number; disabled: boolean }) {
  const d = useData();
  const me = useMe();
  const say = useUI((s) => s.say);
  const mode = useStore((s) => s.locMode);
  const checkIn = useStore((s) => s.checkIn);
  const checkOut = useStore((s) => s.checkOut);
  const sendReport = useStore((s) => s.sendReport);
  const simulate = useStore((s) => s.simulateStillOnSite);
  const site = d.sites.find((s) => s.id === a.siteId)!;
  const att = attFor(d, a.id, me.id);
  const rep = reportFor(d, a.id, me.id);
  const state = personState(d, a, me.id, now);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [here, setHere] = useState<GeoPoint | null>(null);
  const [text, setText] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("fixed");

  // Live distance while this screen is open and the job isn't finished (real GPS only).
  // The latest fix is reused for check-in/out if it is fresh, because some phones
  // hang when asking for a second position while a watch is running.
  const active = !att?.checkOutAt && !disabled;
  const fixRef = useRef<{ loc: GeoPoint; t: number } | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!active || paused || mode !== "gps" || !("geolocation" in navigator) || !window.isSecureContext) return;
    const w = navigator.geolocation.watchPosition(
      (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) };
        fixRef.current = { loc, t: Date.now() };
        setHere(loc);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(w);
  }, [active, paused, mode, a.id]);
  const shownHere = mode === "gps" && active ? here : null;
  const dist = shownHere ? distanceM(shownHere, site) : null;

  const locate = async (): Promise<GeoPoint> => {
    if (mode !== "gps") return readLocation(mode, site);
    const f = fixRef.current;
    if (f && ageMs(f.t) < 15_000) return f.loc;
    setPaused(true);
    await new Promise((r) => setTimeout(r, 60));
    try {
      return await readLocation("gps", site);
    } finally {
      setPaused(false);
    }
  };

  const doCheckIn = async () => {
    setBusy(true);
    setErr("");
    try {
      const loc = await locate();
      const r = checkIn(a.id, me.id, loc);
      if (r.ok) say(`Checked in ✓ You are ${fmtDist(r.dist)} from the site`);
      else setErr(`You are ${fmtDist(r.dist)} from ${site.name}. Check-in only works inside the ${site.radius} m zone. Your manager can see this try.`);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  const doCheckOut = async () => {
    setBusy(true);
    setErr("");
    try {
      const loc = await locate();
      const r = checkOut(a.id, me.id, loc);
      say(`Checked out ✓ ${r.dist > site.radius ? `(${fmtDist(r.dist)} from site)` : ""}`);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  const doReport = () => {
    if (text.trim().length < 3) return setErr("Write a short report first.");
    sendReport(a.id, me.id, text.trim(), outcome);
    setText("");
    setErr("");
    say("Report sent ✓");
  };

  const yourTurn = state === "waiting" || state === "late" || state === "onsite";
  const startsIn = (ms(a.start) - now) / 60000;
  const worked = att?.checkInAt ? ((att.checkOutAt ? ms(att.checkOutAt) : now) - ms(att.checkInAt)) / 60000 : 0;
  const needReport = a.reportRequired && !rep && att?.checkInAt;

  return (
    <>
      <div className={`nowbox${yourTurn ? " you" : ""}`}>
        <div className="row">
          <span className="cap" style={{ color: "inherit", opacity: 0.75 }}>{state === "onsite" ? "You are on this job" : state === "done" ? "Finished" : startsIn > 0 ? `Starts in ${minsText(startsIn)}` : state === "late" ? "You are late" : "Your job"}</span>
          <span className="grow" />
          {a.kind === "maintenance" && <span className="pill forest">Ticket{a.priority === "urgent" ? " · urgent" : ""}</span>}
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>{a.title}</h1>
          <p style={{ marginTop: 4 }} className="muted">{site.name} · {site.address}</p>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="pill" style={{ background: "var(--card)", color: "var(--ink)" }}><Icon n="clock" s={14} /> {slot(a.start, a.end)}</span>
          <span className="pill" style={{ background: "var(--card)", color: "var(--ink)" }}><Icon n="pin" s={14} /> Zone {site.radius} m</span>
        </div>
        {a.description && <p className="small">{a.description}</p>}
      </div>

      <div className="mapbox" style={{ height: 190 }}>
        <Map
          sites={[site]}
          dots={shownHere ? [{ ...shownHere, color: "#1E4A16", label: "You" }] : att?.checkInLoc ? [{ ...att.checkInLoc, color: "#00C875", label: "Your check-in" }] : []}
          fitKey={a.id + (shownHere ? "h" : "")}
          zoom={16}
          showLabels={false}
        />
      </div>

      {active && (
        <div className="gpsline">
          <Icon n="gps" s={16} />
          {mode !== "gps" ? (
            <span className="muted">Demo location is on ({mode === "at-site" ? "at the site" : "1.2 km away"}).</span>
          ) : dist == null ? (
            <span className="muted">Finding your location…</span>
          ) : (
            <span>
              You are <b>{fmtDist(dist)}</b> from the site{" "}
              {dist <= site.radius ? <span className="pill lime">inside zone</span> : <span className="pill red">outside zone</span>}
              {shownHere?.accuracy && shownHere.accuracy > 60 ? <span className="muted"> · GPS ±{shownHere.accuracy} m</span> : null}
            </span>
          )}
        </div>
      )}

      {err && <div className="note"><b>Not done</b>{err}</div>}

      {(state === "waiting" || state === "late" || state === "missed") && !att?.checkInAt && (
        <button className="btn lime big" onClick={doCheckIn} disabled={busy || disabled}>
          <Icon n="login" s={22} /> {busy ? "Checking your location…" : "Check in"}
        </button>
      )}

      {att?.checkInAt && !att.checkOutAt && (
        <div className="card" style={{ display: "grid", gap: 6 }}>
          <span className="cap">On site since {hm(att.checkInAt)}</span>
          <span className="timer">{minsText(worked)}</span>
          <span className="muted small">Ends at {hm(a.end)}. Checked in {fmtDist(att.checkInDist ?? 0)} from the site.</span>
        </div>
      )}

      {needReport && (
        <div className="card" style={{ display: "grid", gap: 10 }}>
          <span className="row"><Icon n="doc" /> <b>Short report</b></span>
          <div className="seg" style={{ flexWrap: "wrap" }}>
            {([["fixed", "Fixed"], ["partly", "Partly done"], ["follow-up", "Needs follow-up"]] as [Outcome, string][]).map(([k, l]) => (
              <button key={k} className={outcome === k ? "on" : ""} onClick={() => setOutcome(k)}>{l}</button>
            ))}
          </div>
          <textarea className="input" placeholder="What did you do? Anything the client or office should know?" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn" onClick={doReport}>Send report</button>
        </div>
      )}
      {rep && (
        <div className="goodnote"><b>Report sent {hm(rep.at)}</b> · {rep.text}</div>
      )}

      {att?.checkInAt && !att.checkOutAt && (
        <button className="btn big" onClick={doCheckOut} disabled={busy}>
          <Icon n="logout" s={22} /> {busy ? "Checking your location…" : needReport ? "Check out (report later)" : "Check out"}
        </button>
      )}

      {att?.checkOutAt && (
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <span className="row"><span className="pill green"><Icon n="check" s={14} /> Checked out {hm(att.checkOutAt)}</span></span>
          <span>Worked <b>{minsText(worked)}</b> ({hm(att.checkInAt)}–{hm(att.checkOutAt)})</span>
          <div className="box" style={{ background: "var(--sunk)" }}>
            <span className="cap">Demo · what the final app does</span>
            <span className="small">The phone app notices if you stay inside the site after check-out and tells your manager. Tap to see the alert without waiting {d.settings.stillOnSiteMin} min.</span>
            <button
              className="btn red sm"
              onClick={() => {
                simulate(a.id, me.id);
                say("Simulated: manager got 'checked out but still on site'");
              }}
            >
              Simulate: still on site {d.settings.stillOnSiteMin} min later
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function DemoTools({ onCreated }: { onCreated: (id: string) => void }) {
  const mode = useStore((s) => s.locMode);
  const setMode = useStore((s) => s.setLocMode);
  const saveSite = useStore((s) => s.saveSite);
  const saveAssignment = useStore((s) => s.saveAssignment);
  const me = useMe();
  const say = useUI((s) => s.say);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Puts a 150 m site where the phone is now, plus a job for this person starting now.
  const testHere = () => {
    if (!("geolocation" in navigator) || !window.isSecureContext) return setErr("Location needs a secure (https) link.");
    setBusy(true);
    setErr("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const id = newId("site");
        const t = Date.now();
        saveSite({ id, name: "Test site (here)", client: "Demo", address: "Where the phone was", lat: p.coords.latitude, lng: p.coords.longitude, radius: 150, stage: "Maintenance", color: "#037F4C", createdAt: new Date(t).toISOString() });
        const aId = newId("a");
        saveAssignment({
          id: aId,
          kind: "maintenance",
          title: "Test job: check camera",
          description: "Demo job created where you are standing.",
          siteId: id,
          teamId: me.teamId,
          assigneeIds: [me.id],
          start: new Date(t - 60_000).toISOString(),
          end: new Date(t + 60 * 60_000).toISOString(),
          visibility: "team",
          editors: "managers",
          priority: "normal",
          reportRequired: true,
          createdBy: me.id,
          createdAt: new Date(t).toISOString(),
        });
        setMode("gps");
        setBusy(false);
        onCreated(aId);
        window.scrollTo({ top: 0, behavior: "smooth" });
        say("Test job created where you are. Now tap Check in.");
      },
      (e) => {
        setBusy(false);
        setErr(e.code === 1 ? "Location is blocked. Allow it in the phone settings." : "Couldn't read location. Try again.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  return (
    <details className="card" style={{ padding: 16 }} open={IS_ARTIFACT}>
      <summary className="muted small" style={{ cursor: "pointer", fontWeight: 600 }}>Demo tools (not in the real app)</summary>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <span className="small">Where should the app think you are?</span>
        <div className="seg" style={{ flexWrap: "wrap" }}>
          {!IS_ARTIFACT && <button className={mode === "gps" ? "on" : ""} onClick={() => setMode("gps")}>Real GPS</button>}
          <button className={mode === "at-site" ? "on" : ""} onClick={() => setMode("at-site")}>At the site</button>
          <button className={mode === "away" ? "on" : ""} onClick={() => setMode("away")}>1.2 km away</button>
        </div>
        {IS_ARTIFACT ? (
          <span className="muted small">This Claude preview can&apos;t read the phone&apos;s GPS, so it uses a pretend location. The live link checks real GPS.</span>
        ) : (
          <>
            <span className="muted small">Keep &ldquo;Real GPS&rdquo; for the live test. The sample sites are around Doha, so a real check-in from the office will be blocked (that&apos;s correct!). To see a real check-in pass, make a test job right where you are:</span>
            <button className="btn ghost sm" onClick={testHere} disabled={busy}><Icon n="gps" s={16} /> {busy ? "Reading GPS…" : "Create a test job where I am"}</button>
          </>
        )}
        {err && <span className="small" style={{ color: "var(--down)" }}>{err}</span>}
      </div>
    </details>
  );
}
