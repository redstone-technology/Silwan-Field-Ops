"use client";
// App state. For the prototype it is saved in the browser (localStorage).
// In the real build these actions become API calls to the database; screens don't change.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useMemo, useState } from "react";
import type { Assignment, GeoPoint, Outcome, Settings, Site } from "./types";
import { buildSeed } from "./seed";
import { computeAlerts, type Data } from "./rules";
import { distanceM } from "./geo";
import { mins, toISO, ms } from "./time";

export type LocMode = "gps" | "at-site" | "away";

interface State extends Data {
  currentUserId: string;
  seededDay: string;
  acknowledged: Record<string, string>;
  locMode: LocMode;
  consented: Record<string, boolean>;

  resetDemo: () => void;
  setUser: (id: string) => void;
  setLocMode: (m: LocMode) => void;
  consent: (personId: string) => void;
  saveSite: (s: Site) => void;
  saveAssignment: (a: Assignment) => void;
  setManualStatus: (id: string, s?: Assignment["manualStatus"]) => void;
  checkIn: (aId: string, pId: string, loc: GeoPoint) => { ok: boolean; dist: number };
  checkOut: (aId: string, pId: string, loc: GeoPoint) => { dist: number };
  sendReport: (aId: string, pId: string, text: string, outcome: Outcome) => void;
  addPing: (pId: string, loc: GeoPoint) => void;
  simulateStillOnSite: (aId: string, pId: string) => void;
  acknowledge: (alertId: string) => void;
  saveSettings: (s: Settings) => void;
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...buildSeed(0),
      assignments: [],
      attendance: [],
      reports: [],
      pings: [],
      attempts: [],
      currentUserId: "p-owner",
      seededDay: "",
      acknowledged: {},
      locMode: "gps",
      consented: {},

      resetDemo: () => {
        const seed = buildSeed(Date.now());
        // keep sites the user added themselves
        const custom = get().sites.filter((s) => s.id.startsWith("site-"));
        set({
          ...seed,
          sites: [...seed.sites, ...custom],
          seededDay: new Date().toDateString(),
          acknowledged: {},
        });
      },
      setUser: (id) => set({ currentUserId: id }),
      setLocMode: (m) => set({ locMode: m }),
      consent: (pId) => set({ consented: { ...get().consented, [pId]: true } }),

      saveSite: (s) => {
        const exists = get().sites.some((x) => x.id === s.id);
        set({ sites: exists ? get().sites.map((x) => (x.id === s.id ? s : x)) : [...get().sites, s] });
      },
      saveAssignment: (a) => {
        const exists = get().assignments.some((x) => x.id === a.id);
        set({
          assignments: exists ? get().assignments.map((x) => (x.id === a.id ? a : x)) : [...get().assignments, a],
        });
      },
      setManualStatus: (id, s) =>
        set({ assignments: get().assignments.map((x) => (x.id === id ? { ...x, manualStatus: s } : x)) }),

      checkIn: (aId, pId, loc) => {
        const a = get().assignments.find((x) => x.id === aId)!;
        const site = get().sites.find((x) => x.id === a.siteId)!;
        const dist = Math.round(distanceM(loc, site));
        const now = toISO(Date.now());
        get().addPing(pId, loc);
        if (dist > site.radius) {
          set({
            attempts: [
              ...get().attempts,
              { id: uid("try"), personId: pId, assignmentId: aId, at: now, lat: loc.lat, lng: loc.lng, dist, kind: "checkin-rejected" },
            ],
          });
          return { ok: false, dist };
        }
        const others = get().attendance.filter((x) => !(x.assignmentId === aId && x.personId === pId));
        set({
          attendance: [
            ...others,
            { id: uid("att"), assignmentId: aId, personId: pId, checkInAt: now, checkInLoc: loc, checkInDist: dist },
          ],
        });
        return { ok: true, dist };
      },
      checkOut: (aId, pId, loc) => {
        const a = get().assignments.find((x) => x.id === aId)!;
        const site = get().sites.find((x) => x.id === a.siteId)!;
        const dist = Math.round(distanceM(loc, site));
        get().addPing(pId, loc);
        set({
          attendance: get().attendance.map((x) =>
            x.assignmentId === aId && x.personId === pId
              ? { ...x, checkOutAt: toISO(Date.now()), checkOutLoc: loc, checkOutDist: dist }
              : x,
          ),
        });
        return { dist };
      },
      sendReport: (aId, pId, text, outcome) =>
        set({
          reports: [
            ...get().reports.filter((r) => !(r.assignmentId === aId && r.personId === pId)),
            { id: uid("r"), assignmentId: aId, personId: pId, at: toISO(Date.now()), text, outcome },
          ],
        }),
      addPing: (pId, loc) =>
        set({ pings: [...get().pings.slice(-300), { personId: pId, at: toISO(Date.now()), ...loc }] }),

      // Demo only: pretend time moved forward past the "still on site" limit
      // and the phone is still inside the site circle.
      simulateStillOnSite: (aId, pId) => {
        const { settings, attendance, reports } = get();
        const att = attendance.find((x) => x.assignmentId === aId && x.personId === pId);
        if (!att?.checkOutAt) return;
        const shift = mins(settings.stillOnSiteMin + 5);
        const back = (iso?: string) => (iso ? toISO(ms(iso) - shift) : iso);
        const a = get().assignments.find((x) => x.id === aId)!;
        const site = get().sites.find((x) => x.id === a.siteId)!;
        set({
          attendance: attendance.map((x) =>
            x.id === att.id ? { ...x, checkInAt: back(x.checkInAt), checkOutAt: back(x.checkOutAt) } : x,
          ),
          reports: reports.map((r) => (r.assignmentId === aId && r.personId === pId ? { ...r, at: back(r.at)! } : r)),
        });
        get().addPing(pId, { lat: site.lat + 0.0002, lng: site.lng - 0.0001, accuracy: 10 });
      },

      acknowledge: (id) => set({ acknowledged: { ...get().acknowledged, [id]: toISO(Date.now()) } }),
      saveSettings: (s) => set({ settings: s }),
    }),
    { name: "silwan-ops-demo-v1" },
  ),
);

/** Re-render every 20 seconds so "late" and "overdue" update by themselves. */
export function useNow(every = 20_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

export function useData(): Data {
  const s = useStore();
  return useMemo(
    () => ({
      people: s.people,
      teams: s.teams,
      sites: s.sites,
      assignments: s.assignments,
      attendance: s.attendance,
      reports: s.reports,
      pings: s.pings,
      attempts: s.attempts,
      settings: s.settings,
    }),
    [s.people, s.teams, s.sites, s.assignments, s.attendance, s.reports, s.pings, s.attempts, s.settings],
  );
}

export function useMe() {
  const id = useStore((s) => s.currentUserId);
  const people = useStore((s) => s.people);
  return people.find((p) => p.id === id) ?? people[0];
}

export function useAlerts(now: number) {
  const d = useData();
  const ack = useStore((s) => s.acknowledged);
  return useMemo(() => {
    const all = computeAlerts(d, now);
    // "open" = needs attention today and nobody pressed "Got it" yet
    const open = all.filter((a) => !ack[a.id] && (a.live || now - ms(a.at) < mins(8 * 60)) && a.severity !== "low");
    return { all, open, ack };
  }, [d, now, ack]);
}
