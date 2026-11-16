"use client";
import { useMemo } from "react";
import { useData, useMe } from "./store";
import { canSee, statusOf, attFor, type StatusKey } from "./rules";
import { ms, isSameDay } from "./time";
import type { Assignment, Person, Site } from "./types";

/** Assignments this user is allowed to see (permissions applied). */
export function useVisible() {
  const d = useData();
  const me = useMe();
  return useMemo(() => d.assignments.filter((a) => canSee(d, me, a)), [d, me]);
}

export const isToday = (a: Assignment, now: number) => isSameDay(new Date(a.start), new Date(now));

export interface TeamNow {
  person: Person;
  state: "onsite" | "late" | "next" | "free";
  site?: Site;
  a?: Assignment;
  since?: string;
}

/** Where is each field worker right now, based on check-ins (not live tracking). */
export function useTeamNow(now: number): TeamNow[] {
  const d = useData();
  return useMemo(() => {
    const field = d.people.filter((p) => p.role === "technician" || p.role === "lead");
    return field.map((p) => {
      const mine = d.assignments
        .filter((a) => a.assigneeIds.includes(p.id) && a.manualStatus !== "cancelled")
        .sort((x, y) => ms(x.start) - ms(y.start));
      const open = mine.find((a) => {
        const att = attFor(d, a.id, p.id);
        return att?.checkInAt && !att.checkOutAt;
      });
      if (open) {
        return { person: p, state: "onsite", a: open, site: d.sites.find((s) => s.id === open.siteId), since: attFor(d, open.id, p.id)?.checkInAt } as TeamNow;
      }
      const late = mine.find((a) => ms(a.start) + d.settings.lateGraceMin * 60000 < now && ms(a.end) > now && !attFor(d, a.id, p.id)?.checkInAt);
      if (late) return { person: p, state: "late", a: late, site: d.sites.find((s) => s.id === late.siteId) } as TeamNow;
      const next = mine.find((a) => ms(a.start) > now && isSameDay(new Date(a.start), new Date(now)));
      if (next) return { person: p, state: "next", a: next, site: d.sites.find((s) => s.id === next.siteId) } as TeamNow;
      return { person: p, state: "free" } as TeamNow;
    });
  }, [d, now]);
}

export function useStatusOf(now: number) {
  const d = useData();
  return (a: Assignment): StatusKey => statusOf(d, a, now);
}
