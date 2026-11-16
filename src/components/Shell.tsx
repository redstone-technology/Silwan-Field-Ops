"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useStore, useMe, useNow, useAlerts } from "@/lib/store";
import { isManager } from "@/lib/rules";
import { Icon, Toast, useUI } from "./ui";
import { Drawers } from "./Drawers";

const MANAGER_NAV = [
  { href: "/", label: "Today", icon: "home" },
  { href: "/board", label: "Board", icon: "board" },
  { href: "/sites", label: "Sites", icon: "pin" },
  { href: "/alerts", label: "Alerts", icon: "bell" },
  { href: "/timesheets", label: "Timesheets", icon: "sheet" },
];
const TECH_NAV = [
  { href: "/tech", label: "My day", icon: "home" },
  { href: "/tech/week", label: "My week", icon: "sheet" },
];

const ROLE_LABEL = { owner: "Owner", manager: "Manager", lead: "Team lead", technician: "Technician" };

export function Shell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const seededDay = useStore((s) => s.seededDay);
  const resetDemo = useStore((s) => s.resetDemo);

  // Wait for saved data to load from the browser, then refresh sample data once a day
  useEffect(() => {
    const go = () => {
      if (useStore.getState().seededDay !== new Date().toDateString()) useStore.getState().resetDemo();
      setReady(true);
    };
    if (useStore.persist.hasHydrated()) go();
    else return useStore.persist.onFinishHydration(go);
  }, [resetDemo]);

  if (!ready || !seededDay) {
    return (
      <div className="page">
        <div className="frame" style={{ placeItems: "center", minHeight: 300 }}>
          <span className="muted">Loading…</span>
        </div>
      </div>
    );
  }
  return <Frame>{children}</Frame>;
}

function Frame({ children }: { children: ReactNode }) {
  const me = useMe();
  const people = useStore((s) => s.people);
  const setUser = useStore((s) => s.setUser);
  const resetDemo = useStore((s) => s.resetDemo);
  const path = usePathname();
  const router = useRouter();
  const open = useUI((s) => s.open);
  const say = useUI((s) => s.say);
  const now = useNow();
  const { open: openAlerts } = useAlerts(now);
  const field = me.role === "technician";
  const nav = field ? TECH_NAV : me.role === "lead" ? [...MANAGER_NAV.filter((n) => n.href !== "/sites"), { href: "/tech", label: "My day", icon: "phone" }] : MANAGER_NAV;

  // technicians only get their phone screens
  useEffect(() => {
    if (field && !path.startsWith("/tech")) router.replace("/tech");
  }, [field, path, router]);

  // Frame only renders in the browser (after Shell is ready), so localStorage is safe here
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("theme") ?? "auto");
  useEffect(() => {
    if (theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const switchUser = (id: string) => {
    setUser(id);
    const p = people.find((x) => x.id === id)!;
    if (p.role === "technician") router.push("/tech");
    else if (path.startsWith("/tech") && p.role !== "lead") router.push("/");
    say(`Now viewing as ${p.name} (${ROLE_LABEL[p.role]})`);
  };

  return (
    <div className="page">
      <div className="frame">
        <header className="top">
          <div className="brand">
            <div className="logo"><i>S</i></div>
            <div className="hello">
              Hello, {me.name.split(" ")[0]}
              <small>SILWAN FIELD OPS</small>
            </div>
          </div>
          <nav className="pills" aria-label="Main">
            {nav.map((n) => {
              const on = n.href === "/" ? path === "/" : path === n.href || (n.href !== "/tech" && path.startsWith(n.href));
              return (
                <Link key={n.href} href={n.href} className={`navpill${on ? " on" : ""}`}>
                  {n.label}
                  {n.href === "/alerts" && openAlerts.length > 0 && <span className="badge">{openAlerts.length}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="tools">
            <label className="viewas">
              <span>Viewing as</span>
              <select value={me.id} onChange={(e) => switchUser(e.target.value)} aria-label="Viewing as">
                <optgroup label="Office">
                  {people.filter((p) => isManager(p)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {ROLE_LABEL[p.role]}</option>
                  ))}
                </optgroup>
                <optgroup label="Field">
                  {people.filter((p) => !isManager(p)).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.role === "lead" ? " · Lead" : ""}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            {!field && (
              <button className="btn lime" onClick={() => open({ type: "assign" })}>
                <Icon n="plus" /> <span>New task</span>
              </button>
            )}
          </div>
        </header>
        <main>
          <div className="fadein" key={path}>{children}</div>
        </main>
        <footer className="bottom">
          <span className="wm"><i></i>by Redstone</span>
          <span className="row">
            <span className="muted small">Sample data</span>
            <button className="linkbtn" onClick={() => { resetDemo(); say("Demo data reset"); }}>Reset demo</button>
            <button className="linkbtn" onClick={() => setTheme(theme === "auto" ? "dark" : theme === "dark" ? "light" : "auto")} title="Theme">
              Theme: {theme}
            </button>
          </span>
        </footer>
      </div>
      <Drawers />
      <Toast />
    </div>
  );
}
