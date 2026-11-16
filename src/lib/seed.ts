// Sample data for the demo. Times are built around "now" so the board always looks live.
// Sites and people are invented examples, not real client data.

import type {
  Assignment,
  Attempt,
  Attendance,
  Person,
  Ping,
  Report,
  Site,
  Team,
  Outcome,
} from "./types";
import { DEFAULT_SETTINGS, type Data } from "./rules";
import { offset } from "./geo";
import { mins, toISO, weekDays } from "./time";

export const TEAMS: Team[] = [
  { id: "t-infra", name: "Infrastructure", short: "Infra", color: "#579BFC", leadId: "p-rajesh" },
  { id: "t-inst", name: "Installation", short: "Install", color: "#FDAB3D", leadId: "p-joel" },
  { id: "t-eng", name: "Engineering", short: "Eng", color: "#A25DDC", leadId: "p-ahmed" },
];

export const PEOPLE: Person[] = [
  { id: "p-owner", name: "Abdelazim Salih", role: "owner", color: "#1E4A16" },
  { id: "p-khalid", name: "Khalid Mansour", role: "manager", color: "#0086C0" },
  { id: "p-rajesh", name: "Rajesh Nair", role: "lead", teamId: "t-infra", color: "#579BFC" },
  { id: "p-suresh", name: "Suresh Thapa", role: "technician", teamId: "t-infra", color: "#66CCFF" },
  { id: "p-bikash", name: "Bikash Gurung", role: "technician", teamId: "t-infra", color: "#037F4C" },
  { id: "p-joel", name: "Joel Santos", role: "lead", teamId: "t-inst", color: "#FDAB3D" },
  { id: "p-mark", name: "Mark Reyes", role: "technician", teamId: "t-inst", color: "#FF642E" },
  { id: "p-anil", name: "Anil Kumar", role: "technician", teamId: "t-inst", color: "#CAB641" },
  { id: "p-hari", name: "Hari Shrestha", role: "technician", teamId: "t-inst", color: "#9D50DD" },
  { id: "p-ahmed", name: "Ahmed Fathy", role: "lead", teamId: "t-eng", color: "#A25DDC" },
  { id: "p-omar", name: "Omar Hassan", role: "technician", teamId: "t-eng", color: "#E2445C" },
  { id: "p-ravi", name: "Ravi Menon", role: "technician", teamId: "t-eng", color: "#00C875" },
];

const created = "2026-11-01T08:00:00.000Z";
export const SITES: Site[] = [
  { id: "s-fairmont", name: "Fairmont Hotel", client: "Hotel facilities team", address: "Lusail Marina, Lusail", lat: 25.3989, lng: 51.5296, radius: 150, stage: "Maintenance", color: "#579BFC", createdAt: created },
  { id: "s-villa", name: "Villa 27, Al Waab", client: "Private client", address: "Al Waab, Doha", lat: 25.2619, lng: 51.4631, radius: 100, stage: "Installation", color: "#A25DDC", createdAt: created },
  { id: "s-mall", name: "City Centre Mall", client: "Mall operations", address: "West Bay, Doha", lat: 25.3268, lng: 51.5312, radius: 200, stage: "Engineering", color: "#00C875", createdAt: created },
  { id: "s-tower", name: "Msheireb Office Tower", client: "Property developer", address: "Msheireb Downtown", lat: 25.2867, lng: 51.5263, radius: 150, stage: "Infrastructure", color: "#FDAB3D", createdAt: created },
  { id: "s-pearl", name: "Pearl Residence Tower", client: "Owners association", address: "Porto Arabia, The Pearl", lat: 25.3709, lng: 51.551, radius: 150, stage: "Inspection", color: "#E2445C", createdAt: created },
  { id: "s-warehouse", name: "Logistics Warehouse", client: "Logistics company", address: "Industrial Area, Street 24", lat: 25.199, lng: 51.437, radius: 250, stage: "MOI approval", color: "#FF642E", createdAt: created },
  { id: "s-school", name: "International School", client: "School board", address: "Al Gharrafa, Doha", lat: 25.342, lng: 51.451, radius: 200, stage: "Installation", color: "#66CCFF", createdAt: created },
];

const JOBS: Record<string, string[]> = {
  "t-infra": ["Lay conduit for camera runs", "Install camera poles", "Trench and duct work", "Fix cable trays"],
  "t-inst": ["Pull CAT6 cables, floors 3–5", "Mount dome cameras", "Install PTZ cameras on roof", "Terminate and label cables"],
  "t-eng": ["Configure NVR and storage", "Set up remote viewing app", "Camera angle tuning", "Network switch setup"],
};
const TICKETS = [
  "Camera offline in lobby",
  "NVR not recording",
  "Night vision blurry, gate camera",
  "Remote app can't connect",
  "Replace damaged camera, parking",
];

// tiny seeded random so the demo looks the same every reset
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function buildSeed(now = Date.now()): Data {
  const r = rng(20261119);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const between = (a: number, b: number) => a + r() * (b - a);

  const assignments: Assignment[] = [];
  const attendance: Attendance[] = [];
  const reports: Report[] = [];
  const pings: Ping[] = [];
  const attempts: Attempt[] = [];
  let n = 0;
  const id = (p: string) => `${p}-${++n}`;
  const site = (sid: string) => SITES.find((s) => s.id === sid)!;
  const near = (sid: string, m = 30) => {
    const s = site(sid);
    return offset(s, between(-m, m), between(-m, m));
  };

  function job(
    a: Partial<Assignment> & Pick<Assignment, "title" | "siteId" | "assigneeIds" | "start" | "end">,
  ): Assignment {
    const team = PEOPLE.find((p) => p.id === a.assigneeIds[0])?.teamId;
    const full: Assignment = {
      id: id("a"),
      kind: "task",
      description: "",
      teamId: team,
      visibility: "team",
      editors: "managers+lead",
      priority: "normal",
      reportRequired: true,
      createdBy: "p-khalid",
      createdAt: created,
      ...a,
    };
    assignments.push(full);
    return full;
  }
  function attend(a: Assignment, pId: string, inAt?: number, outAt?: number, repAt?: number, outcome: Outcome = "fixed") {
    const rec: Attendance = { id: id("att"), assignmentId: a.id, personId: pId };
    if (inAt) {
      const p = near(a.siteId);
      rec.checkInAt = toISO(inAt);
      rec.checkInLoc = { ...p, accuracy: 12 };
      rec.checkInDist = Math.round(between(5, 40));
    }
    if (outAt) {
      const p = near(a.siteId);
      rec.checkOutAt = toISO(outAt);
      rec.checkOutLoc = { ...p, accuracy: 15 };
      rec.checkOutDist = Math.round(between(5, 50));
    }
    attendance.push(rec);
    if (repAt) {
      reports.push({
        id: id("r"),
        assignmentId: a.id,
        personId: pId,
        at: toISO(repAt),
        outcome,
        text:
          outcome === "fixed"
            ? pick(["Done. All cameras tested and recording.", "Finished, tested with client on site.", "Work complete, photos sent on WhatsApp."])
            : pick(["Half done, need more cable tomorrow.", "Waiting for ladder access from building security."]),
      });
    }
  }

  const today = new Date(now);
  const todayKey = today.toDateString();
  const days = weekDays(today);
  const siteIds = SITES.map((s) => s.id);

  // Regular week (except today, which gets hand-made live cases)
  for (const day of days) {
    if (day.getDay() === 5) continue; // Friday off
    if (day.toDateString() === todayKey) continue;
    const past = day.getTime() < now;
    for (const team of TEAMS) {
      const members = PEOPLE.filter((p) => p.teamId === team.id).map((p) => p.id);
      const morning = members.slice(0, 2);
      const afternoon = members.slice(1);
      const blocks: [string[], number, number][] = [
        [morning, 7, 11.5],
        [afternoon, 12.5, 16],
      ];
      for (const [who, h1, h2] of blocks) {
        const start = new Date(day);
        start.setHours(Math.floor(h1), (h1 % 1) * 60, 0, 0);
        const end = new Date(day);
        end.setHours(Math.floor(h2), (h2 % 1) * 60, 0, 0);
        const a = job({
          title: pick(JOBS[team.id]),
          siteId: pick(siteIds.filter((s) => s !== "s-fairmont")),
          assigneeIds: who,
          teamId: team.id,
          start: toISO(start),
          end: toISO(end),
        });
        if (past) {
          for (const p of who) {
            const late = r() < 0.15 ? between(15, 35) : between(-8, 8);
            const early = r() < 0.1 ? between(-50, -20) : between(-8, 15);
            const inAt = start.getTime() + mins(late);
            const outAt = end.getTime() + mins(early);
            const rep = r() < 0.08 ? undefined : outAt + mins(r() < 0.1 ? between(40, 70) : between(2, 20));
            attend(a, p, inAt, outAt, rep, r() < 0.85 ? "fixed" : "partly");
          }
        }
      }
    }
    // one maintenance ticket a day
    const s = new Date(day);
    s.setHours(17, 0, 0, 0);
    const e = new Date(day);
    e.setHours(18, 30, 0, 0);
    const t = job({
      kind: "maintenance",
      title: pick(TICKETS),
      siteId: pick(["s-fairmont", "s-villa", "s-mall"]),
      assigneeIds: [pick(["p-omar", "p-ravi"])],
      start: toISO(s),
      end: toISO(e),
      priority: "high",
      visibility: "assigned",
      editors: "managers",
    });
    if (past) attend(t, t.assigneeIds[0], s.getTime() + mins(between(-5, 12)), e.getTime() + mins(between(-10, 10)), e.getTime() + mins(between(3, 15)));
  }

  // ----- Today: live cases built around now -----
  const base = Math.floor(now / mins(30)) * mins(30); // clean :00 / :30 slots
  const at = (m: number) => base + mins(m);
  const ago = (m: number) => now - mins(m);
  const ping = (pId: string, t: number, p: { lat: number; lng: number }) =>
    pings.push({ personId: pId, at: toISO(t), lat: p.lat, lng: p.lng, accuracy: 15 });

  // 1. The demo job: Ravi at Fairmont, starts soon
  const startSoon = Math.ceil((now + mins(5)) / mins(15)) * mins(15);
  job({
    kind: "maintenance",
    title: "Camera offline in hotel lobby",
    description: "Lobby camera 4 shows 'no signal' since last night. Check power and cable, replace if needed.",
    siteId: "s-fairmont",
    assigneeIds: ["p-ravi"],
    start: toISO(startSoon),
    end: toISO(startSoon + mins(60)),
    priority: "urgent",
    visibility: "assigned",
    editors: "managers",
  });

  // 2. Mark + Anil on site at Msheireb
  const a2 = job({ title: "Pull CAT6 cables, floors 3–5", siteId: "s-tower", assigneeIds: ["p-mark", "p-anil"], start: toISO(at(-120)), end: toISO(at(60)) });
  attend(a2, "p-mark", at(-118));
  attend(a2, "p-anil", at(-112));
  ping("p-mark", ago(2), near("s-tower"));
  ping("p-anil", ago(3), near("s-tower"));

  // 3. Suresh late at The Pearl
  job({ title: "Lay conduit for camera runs", siteId: "s-pearl", assigneeIds: ["p-suresh"], start: toISO(at(-30)), end: toISO(at(90)) });
  ping("p-suresh", ago(4), offset(site("s-pearl"), -2600, -900));

  // 4. Omar checked out but phone still at the mall
  const a4 = job({ title: "Configure NVR and storage", siteId: "s-mall", assigneeIds: ["p-omar"], start: toISO(at(-180)), end: toISO(at(-60)) });
  attend(a4, "p-omar", at(-178), at(-62), at(-55));
  ping("p-omar", ago(20), near("s-mall", 40));
  ping("p-omar", ago(4), near("s-mall", 40));

  // 5. Hari tried to check in from 2 km away
  const a5 = job({ title: "Mount dome cameras, Block B", siteId: "s-school", assigneeIds: ["p-hari"], start: toISO(at(-30)), end: toISO(at(90)) });
  const far = offset(site("s-school"), 1800, 1100);
  attempts.push({ id: id("try"), personId: "p-hari", assignmentId: a5.id, at: toISO(at(-24)), lat: far.lat, lng: far.lng, dist: 2110, kind: "checkin-rejected" });
  ping("p-hari", at(-24), far);

  // 6. Joel left the warehouse an hour early, no report yet
  const a6 = job({ title: "Site survey for camera layout", siteId: "s-warehouse", assigneeIds: ["p-joel"], start: toISO(at(-240)), end: toISO(at(-90)) });
  attend(a6, "p-joel", at(-236), at(-150));

  // 7. Bikash still working past end time at the villa
  const a7 = job({ title: "Install camera poles", siteId: "s-villa", assigneeIds: ["p-bikash"], start: toISO(at(-210)), end: toISO(at(-30)) });
  attend(a7, "p-bikash", at(-206));
  ping("p-bikash", ago(3), near("s-villa"));

  // 8. Ahmed on site at Fairmont, on time
  const a8 = job({ title: "Upgrade NVR firmware", siteId: "s-fairmont", assigneeIds: ["p-ahmed"], start: toISO(at(-60)), end: toISO(at(120)) });
  attend(a8, "p-ahmed", at(-63));
  ping("p-ahmed", ago(4), near("s-fairmont"));

  // 9. Rajesh later today at The Pearl
  job({ title: "Inspection walk-through with client", siteId: "s-pearl", assigneeIds: ["p-rajesh"], start: toISO(at(90)), end: toISO(at(210)), visibility: "everyone" });

  return {
    people: PEOPLE,
    teams: TEAMS,
    sites: SITES,
    assignments,
    attendance,
    reports,
    pings,
    attempts,
    settings: DEFAULT_SETTINGS,
  };
}
