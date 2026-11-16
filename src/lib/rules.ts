// Pure business rules: status, alerts, permissions, hours.
// No UI and no storage here, so the same code can run on the server in the real build.

import type {
  AlertItem,
  Assignment,
  Attempt,
  Attendance,
  Person,
  Ping,
  Report,
  Settings,
  Site,
  Team,
} from "./types";
import { insideSite, fmtDist } from "./geo";
import { mins, ms, minsText, hm } from "./time";

export interface Data {
  people: Person[];
  teams: Team[];
  sites: Site[];
  assignments: Assignment[];
  attendance: Attendance[];
  reports: Report[];
  pings: Ping[];
  attempts: Attempt[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  lateGraceMin: 10,
  earlyLeaveMin: 10,
  stillOnSiteMin: 30,
  reportDueMin: 30,
};

/* ---------------- status ---------------- */

export type StatusKey =
  | "scheduled"
  | "starting"
  | "late"
  | "onsite"
  | "report"
  | "done"
  | "missed"
  | "stuck"
  | "cancelled";

// monday.com-style label colours
export const STATUS: Record<StatusKey, { label: string; color: string }> = {
  scheduled: { label: "Scheduled", color: "#579BFC" },
  starting: { label: "Starting now", color: "#FFCB00" },
  late: { label: "Late", color: "#E2445C" },
  onsite: { label: "On site", color: "#FDAB3D" },
  report: { label: "Report due", color: "#A25DDC" },
  done: { label: "Done", color: "#00C875" },
  missed: { label: "Missed", color: "#BB3354" },
  stuck: { label: "Stuck", color: "#E2445C" },
  cancelled: { label: "Cancelled", color: "#C4C4C4" },
};

export const attFor = (d: Data, aId: string, pId: string) =>
  d.attendance.find((x) => x.assignmentId === aId && x.personId === pId);
export const reportFor = (d: Data, aId: string, pId: string) =>
  d.reports.find((x) => x.assignmentId === aId && x.personId === pId);

export type PersonState = "waiting" | "late" | "onsite" | "report" | "done" | "missed";

export function personState(d: Data, a: Assignment, pId: string, now: number): PersonState {
  const att = attFor(d, a.id, pId);
  const rep = reportFor(d, a.id, pId);
  if (att?.checkOutAt) return rep || !a.reportRequired ? "done" : "report";
  if (att?.checkInAt) return "onsite";
  if (now > ms(a.end)) return "missed";
  if (now > ms(a.start) + mins(d.settings.lateGraceMin)) return "late";
  return "waiting";
}

export function statusOf(d: Data, a: Assignment, now: number): StatusKey {
  if (a.manualStatus) return a.manualStatus;
  const states = a.assigneeIds.map((p) => personState(d, a, p, now));
  if (!states.length) return "scheduled";
  if (states.every((s) => s === "done")) return "done";
  if (states.some((s) => s === "onsite")) return "onsite";
  if (states.some((s) => s === "late")) return "late";
  if (states.some((s) => s === "report")) return "report";
  if (states.every((s) => s === "missed" || s === "done")) return "missed";
  if (now >= ms(a.start) - mins(15)) return "starting";
  return "scheduled";
}

/* ---------------- alerts ---------------- */

export function computeAlerts(d: Data, now: number): AlertItem[] {
  const out: AlertItem[] = [];
  const s = d.settings;
  const site = (id: string) => d.sites.find((x) => x.id === id);
  const person = (id: string) => d.people.find((x) => x.id === id);

  for (const a of d.assignments) {
    if (a.manualStatus === "cancelled") continue;
    const st = site(a.siteId);
    if (!st) continue;
    const start = ms(a.start);
    const end = ms(a.end);

    for (const pId of a.assigneeIds) {
      const p = person(pId);
      if (!p) continue;
      const att = attFor(d, a.id, pId);
      const rep = reportFor(d, a.id, pId);
      // nothing to check before the slot starts, unless they already checked in early
      if (start > now && !att?.checkInAt) continue;
      const base = { assignmentId: a.id, personId: pId };
      const first = p.name.split(" ")[0];

      // 1. Late arrival
      const lateAt = start + mins(s.lateGraceMin);
      if (!att?.checkInAt && now > lateAt && now <= end) {
        out.push({
          ...base,
          id: `late:${a.id}:${pId}`,
          type: "late",
          severity: "high",
          at: new Date(lateAt).toISOString(),
          title: `${first} hasn't arrived at ${st.name}`,
          detail: `${minsText((now - start) / 60000)} late. Slot ${hm(a.start)}–${hm(a.end)}.`,
          live: true,
        });
      } else if (att?.checkInAt && ms(att.checkInAt) > lateAt) {
        out.push({
          ...base,
          id: `late:${a.id}:${pId}`,
          type: "late",
          severity: "low",
          at: att.checkInAt,
          title: `${first} arrived late at ${st.name}`,
          detail: `Checked in at ${hm(att.checkInAt)}, ${minsText((ms(att.checkInAt) - start) / 60000)} after the start.`,
          live: false,
        });
      }

      // 2. Task overdue: slot ended but not finished
      if (now > end && !att?.checkOutAt && a.manualStatus !== "done") {
        const onSite = !!att?.checkInAt;
        out.push({
          ...base,
          id: `overdue:${a.id}:${pId}`,
          type: "overdue",
          severity: "high",
          at: a.end,
          title: onSite
            ? `${first} is still working past the end time`
            : `${first} never checked in at ${st.name}`,
          detail: onSite
            ? `Slot ended at ${hm(a.end)} (${minsText((now - end) / 60000)} ago). Not checked out yet.`
            : `Slot was ${hm(a.start)}–${hm(a.end)}. Task is overdue.`,
          live: now - end < mins(6 * 60),
        });
      }

      // 3. Checked out early
      if (att?.checkOutAt && ms(att.checkOutAt) < end - mins(s.earlyLeaveMin)) {
        out.push({
          ...base,
          id: `early:${a.id}:${pId}`,
          type: "early-checkout",
          severity: "medium",
          at: att.checkOutAt,
          title: `${first} checked out early at ${st.name}`,
          detail: `Left at ${hm(att.checkOutAt)}, ${minsText((end - ms(att.checkOutAt)) / 60000)} before ${hm(a.end)}.`,
          live: false,
        });
      }

      // 4. Report late
      if (a.reportRequired && att?.checkInAt && a.manualStatus !== "done") {
        const dueFrom = att.checkOutAt ? ms(att.checkOutAt) : end;
        const due = dueFrom + mins(s.reportDueMin);
        const repAt = rep ? ms(rep.at) : NaN;
        if ((!rep && now > due) || (rep && repAt > due)) {
          out.push({
            ...base,
            id: `report:${a.id}:${pId}`,
            type: "report-late",
            severity: rep ? "low" : "medium",
            at: new Date(due).toISOString(),
            title: rep ? `${first} sent the report late` : `${first}'s report is late`,
            detail: rep
              ? `Report came at ${hm(rep.at)}, due by ${hm(new Date(due).toISOString())}.`
              : `Was due by ${hm(new Date(due).toISOString())} for ${st.name}.`,
            live: !rep && now - due < mins(8 * 60),
          });
        }
      }

      // 5. Checked out but still on site
      if (att?.checkOutAt) {
        const after = ms(att.checkOutAt) + mins(s.stillOnSiteMin);
        // only look at the few hours right after this check-out
        const later = d.pings
          .filter((x) => x.personId === pId && ms(x.at) >= after && ms(x.at) <= ms(att.checkOutAt!) + mins(4 * 60))
          .sort((x, y) => ms(y.at) - ms(x.at));
        const latest = later[0];
        if (latest && insideSite(latest, st)) {
          // still on site only if they had no other job at that time
          out.push({
            ...base,
            id: `stillon:${a.id}:${pId}`,
            type: "still-on-site",
            severity: "high",
            at: new Date(after).toISOString(),
            title: `${first} checked out but is still on site`,
            detail: `Checked out at ${hm(att.checkOutAt)}, still inside ${st.name} at ${hm(latest.at)} (${minsText((ms(latest.at) - ms(att.checkOutAt)) / 60000)} later).`,
            live: now - ms(latest.at) < mins(10),
          });
        }
      }
    }
  }

  // 6. Check-in rejected because outside the site
  for (const t of d.attempts) {
    const a = d.assignments.find((x) => x.id === t.assignmentId);
    const st = a && site(a.siteId);
    const p = person(t.personId);
    if (!a || !st || !p) continue;
    out.push({
      id: `reject:${t.id}`,
      type: "checkin-rejected",
      severity: "medium",
      assignmentId: a.id,
      personId: p.id,
      at: t.at,
      title: `${p.name.split(" ")[0]} tried to check in outside ${st.name}`,
      detail: `Was ${fmtDist(t.dist)} away (site zone is ${st.radius} m). Check-in blocked.`,
      live: false,
    });
  }

  return out.sort((x, y) => ms(y.at) - ms(x.at));
}

export const ALERT_META: Record<AlertItem["type"], { label: string; color: string }> = {
  late: { label: "Late arrival", color: "#E2445C" },
  "checkin-rejected": { label: "Outside site", color: "#FF642E" },
  "early-checkout": { label: "Left early", color: "#FDAB3D" },
  "report-late": { label: "Report late", color: "#A25DDC" },
  overdue: { label: "Overdue", color: "#BB3354" },
  "still-on-site": { label: "Still on site", color: "#E2445C" },
};

/* ---------------- permissions ---------------- */

export const isManager = (u?: Person) => u?.role === "owner" || u?.role === "manager";

export function leadOf(d: Data, u: Person, teamId?: string) {
  if (u.role !== "lead" || !teamId) return false;
  return d.teams.find((t) => t.id === teamId)?.leadId === u.id;
}

export function canSee(d: Data, u: Person, a: Assignment): boolean {
  if (isManager(u)) return true;
  if (a.assigneeIds.includes(u.id)) return true;
  if (leadOf(d, u, a.teamId)) return true;
  if (a.visibility === "everyone") return true;
  if (a.visibility === "team" && u.teamId && u.teamId === a.teamId) return true;
  return false;
}

export function canEdit(d: Data, u: Person, a?: Assignment): boolean {
  if (isManager(u)) return true;
  if (!a) return u.role === "lead";
  return a.editors === "managers+lead" && leadOf(d, u, a.teamId);
}

export const canCheckIn = (u: Person, a: Assignment) => a.assigneeIds.includes(u.id);

export const VIS_LABEL: Record<Assignment["visibility"], string> = {
  assigned: "Only assigned people",
  team: "Whole team",
  everyone: "Everyone",
};
export const EDIT_LABEL: Record<Assignment["editors"], string> = {
  managers: "Managers only",
  "managers+lead": "Managers + team lead",
};

/* ---------------- hours ---------------- */

export function plannedHours(a: Assignment) {
  return Math.max(0, (ms(a.end) - ms(a.start)) / 3_600_000);
}

export function actualHours(att?: Attendance, now?: number) {
  if (!att?.checkInAt) return 0;
  const end = att.checkOutAt ? ms(att.checkOutAt) : now ?? ms(att.checkInAt);
  return Math.max(0, (end - ms(att.checkInAt)) / 3_600_000);
}
