"use client";
import { create } from "zustand";
import { useEffect, type ReactNode } from "react";
import type { Person } from "@/lib/types";
import { STATUS, type StatusKey } from "@/lib/rules";
import { initials } from "@/lib/time";

/* ---------- UI state: which drawer is open, toast ---------- */
export type DrawerState =
  | { type: "assignment"; id: string }
  | { type: "assign"; id?: string; siteId?: string; start?: string }
  | { type: "site"; id?: string; back?: boolean }
  | { type: "person-week"; id: string; week: string }
  | { type: "settings" }
  | null;

interface UIState {
  drawer: DrawerState;
  toast: string | null;
  open: (d: DrawerState) => void;
  close: () => void;
  say: (t: string) => void;
}
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export const useUI = create<UIState>((set) => ({
  drawer: null,
  toast: null,
  open: (d) => set({ drawer: d }),
  close: () => set({ drawer: null }),
  say: (t) => {
    clearTimeout(toastTimer);
    set({ toast: t });
    toastTimer = setTimeout(() => set({ toast: null }), 3200);
  },
}));

/* ---------- icons ---------- */
const P: Record<string, ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  board: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 10h18M9 10v10" /></>,
  kanban: <><rect x="3" y="4" width="5" height="14" rx="1.5" /><rect x="10" y="4" width="5" height="9" rx="1.5" /><rect x="17" y="4" width="4" height="11" rx="1.5" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  login: <><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16l4-4-4-4M14 12H3" /></>,
  logout: <><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M16 16l4-4-4-4M20 12H9" /></>,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  cam: <><rect x="3" y="7" width="13" height="10" rx="2.5" /><path d="M16 11l5-3v8l-5-3z" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>,
  doc: <><path d="M6 3h8l5 5v13H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>,
  gps: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M15 6l-6 6 6 6" />,
  fwd: <path d="M9 6l6 6-6 6" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></>,
  sheet: <><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M4 9h16M4 15h16M10 3v18" /></>,
  down: <path d="M12 4v12M6 11l6 6 6-6M5 20h14" />,
  alert: <><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.5" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  grid: <><rect x="4" y="4" width="4" height="4" rx="1" /><rect x="10" y="4" width="4" height="4" rx="1" /><rect x="16" y="4" width="4" height="4" rx="1" /><rect x="4" y="10" width="4" height="4" rx="1" /><rect x="10" y="10" width="4" height="4" rx="1" /><rect x="16" y="10" width="4" height="4" rx="1" /><rect x="4" y="16" width="4" height="4" rx="1" /><rect x="10" y="16" width="4" height="4" rx="1" /><rect x="16" y="16" width="4" height="4" rx="1" /></>,
  chev: <path d="M6 9l6 6 6-6" />,
  chat: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  filter: <path d="M4 5h16l-6 8v6l-4-2v-4z" />,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
};
export function Icon({ n, s = 18 }: { n: keyof typeof P | string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {P[n]}
    </svg>
  );
}

/* ---------- people ---------- */
export function Avatar({ p, lg }: { p?: Person; lg?: boolean }) {
  if (!p) return null;
  return (
    <span className={`av${lg ? " lg" : ""}`} style={{ background: p.color }} title={p.name}>
      {initials(p.name)}
    </span>
  );
}
export function Avatars({ people, max = 3 }: { people: (Person | undefined)[]; max?: number }) {
  const list = people.filter(Boolean) as Person[];
  return (
    <span className="avs">
      {list.slice(0, max).map((p) => (
        <Avatar key={p.id} p={p} />
      ))}
      {list.length > max && <span className="av" style={{ background: "#7F8379" }}>+{list.length - max}</span>}
    </span>
  );
}

/* ---------- status ---------- */
const DARK_TEXT = new Set(["#FFCB00", "#C4C4C4"]);
export function StatusLabel({ k, cell }: { k: StatusKey; cell?: boolean }) {
  const s = STATUS[k];
  return (
    <span className={`status${cell ? " cell" : ""}${DARK_TEXT.has(s.color) ? " dark" : ""}`} style={{ background: s.color }}>
      {s.label}
    </span>
  );
}

/* ---------- drawer ---------- */
export function Drawer({
  title,
  sub,
  onClose,
  children,
  footer,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-h">
          <div style={{ minWidth: 0 }}>
            <h2>{title}</h2>
            {sub && <div className="muted small" style={{ marginTop: 4 }}>{sub}</div>}
          </div>
          <button className="xbtn" onClick={onClose} aria-label="Close">
            <Icon n="x" />
          </button>
        </div>
        <div className="drawer-b">{children}</div>
        {footer && <div className="drawer-f">{footer}</div>}
      </aside>
    </div>
  );
}

export function Toast() {
  const t = useUI((s) => s.toast);
  return t ? <div className="toast" role="status">{t}</div> : null;
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {text && <span className="muted small">{text}</span>}
      {action}
    </div>
  );
}
