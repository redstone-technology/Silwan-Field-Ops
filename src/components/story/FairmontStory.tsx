"use client";
// The Fairmont story in ~10 seconds, built with the Stageshow kit (MIT, Benji Taylor,
// see src/stageshow/LICENSE). Layout: device pair. The jobs board is the hero,
// pinned top-left and running off the bottom; the technician's phone straddles
// its right edge. One job, one technician, one payoff: the alert.
import { Avatar, Bar, Button, Phone, Roll, Stage, Text, Window, type Act } from "@/stageshow";
import "./story.css";

type Phase = "scheduled" | "onsite" | "done";
type S = { phase: Phase; inAt: string; outAt: string; alert: boolean };

const initial: S = { phase: "scheduled", inAt: "", outAt: "", alert: false };
const POSTER: S = { phase: "done", inAt: "6:02", outAt: "7:00", alert: true };

const LABEL: Record<Phase, { t: string; c: string }> = {
  scheduled: { t: "Scheduled", c: "#579BFC" },
  onsite: { t: "On site", c: "#FDAB3D" },
  done: { t: "Done", c: "#00C875" },
};

const FILLER = [
  { w: 120, s: "#00C875", p: 58 },
  { w: 96, s: "#FDAB3D", p: 64 },
  { w: 132, s: "#579BFC", p: 52 },
];

async function script(a: Act<S>) {
  await a.wait(900);
  // 1. He arrives and checks in: the phone is inside the site circle
  await a.move("checkin");
  await a.wait(250);
  await a.click();
  await a.set({ phase: "onsite", inAt: "6:02" });
  await a.wait(1600);
  // 2. He finishes and taps check-out
  await a.move("checkout");
  await a.wait(250);
  await a.click();
  await a.set({ phase: "done", outAt: "7:00" });
  await a.wait(1400);
  // 3. Thirty minutes later his phone is still at the hotel: the manager is told
  await a.set({ alert: true });
  await a.wait(3400);
  // Reset with a cause: the next morning's job starts over
  await a.set({ alert: false });
  await a.wait(500);
  await a.set({ ...initial });
  await a.wait(600);
}

export function FairmontStory() {
  return (
    <Stage
      width={720}
      height={420}
      compact={{ below: 600, width: 358, height: 460 }}
      initial={initial}
      poster={POSTER}
      script={script}
      cursor={{ at: { wide: { x: 600, y: 330 }, compact: { x: 250, y: 400 } }, style: "touch" }}
      className="fs"
    >
      {(s, _rect, layout) => {
        const st = LABEL[s.phase];
        return (
          <>
            <Window title="Jobs board" className="fs-window">
              <div className="fs-board">
                <div className="fs-group">
                  <span className="fs-group-name">Fairmont Hotel</span>
                </div>
                <div className="fs-table">
                  <div className="fs-th">
                    <span>Task</span>
                    <span>Person</span>
                    <span>Status</span>
                    <span>Check in</span>
                    {layout === "wide" && <span>Check out</span>}
                  </div>
                  <div className="fs-tr fs-real">
                    <Text className="fs-task">Lobby camera offline</Text>
                    <span className="fs-cell"><Avatar name="Ravi" size={22} tone="accent" /></span>
                    <span className="fs-status" style={{ background: st.c }}>
                      <Roll>{st.t}</Roll>
                    </span>
                    <span className="fs-cell fs-time"><Roll>{s.inAt || " "}</Roll></span>
                    {layout === "wide" && <span className="fs-cell fs-time"><Roll>{s.outAt || " "}</Roll></span>}
                  </div>
                  {FILLER.map((f, i) => (
                    <div key={i} className="fs-tr">
                      <span className="fs-cell-l"><Bar w={f.w} tone={2} /></span>
                      <span className="fs-cell"><Avatar plain size={22} /></span>
                      <span className="fs-status" style={{ background: f.s, opacity: 0.55 }} />
                      <span className="fs-cell"><Bar w={30} tone={1} /></span>
                      {layout === "wide" && <span className="fs-cell"><Bar w={30} tone={1} /></span>}
                    </div>
                  ))}
                </div>

                <div className="fs-alert" data-show={s.alert || undefined}>
                  <span className="fs-alert-dot" />
                  <div>
                    <Text className="fs-alert-title">Ravi checked out but is still on site</Text>
                    <Text className="fs-alert-sub">Fairmont Hotel · 30 min after check-out</Text>
                  </div>
                </div>
              </div>
            </Window>

            <Phone width={layout === "wide" ? 212 : 196} frame="pro" time="6:58" className="fs-phone">
              <div className="fs-app">
                <div className="fs-card">
                  <Text className="fs-card-k">Your job</Text>
                  <Text className="fs-card-t">Lobby camera offline</Text>
                  <Text className="fs-card-s">Fairmont Hotel · 6:00–7:00</Text>
                </div>
                <div className="fs-zone">
                  <span className="fs-zone-ring"><span className="fs-zone-dot" /></span>
                  <Text className="fs-zone-t">{s.phase === "scheduled" ? "Inside the site circle" : s.phase === "onsite" ? "Checked in · 25 m" : "Checked out 7:00"}</Text>
                </div>
                <div className="fs-actions">
                  {/* one Button whose label changes, so the change animates on itself */}
                  <Button
                    variant={s.phase === "done" ? "secondary" : "primary"}
                    size="large"
                    className="fs-btn"
                    data-target={s.phase === "scheduled" ? "checkin" : "checkout"}
                    data-cursor="pointer"
                  >
                    {s.phase === "scheduled" ? "Check in" : s.phase === "onsite" ? "Check out" : "Done"}
                  </Button>
                </div>
              </div>
            </Phone>
          </>
        );
      }}
    </Stage>
  );
}
