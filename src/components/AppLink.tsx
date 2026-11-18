"use client";
// Navigation that works in both builds:
// - normal (Vercel): real routes like /board
// - Claude preview: hash routes like #board (the preview frame only allows #name)
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export const IS_ARTIFACT = process.env.NEXT_PUBLIC_ARTIFACT === "1";

const TO_HASH: Record<string, string> = {
  "/": "",
  "/board": "board",
  "/sites": "sites",
  "/alerts": "alerts",
  "/timesheets": "timesheets",
  "/tech": "my-day",
  "/tech/week": "my-week",
};
const FROM_HASH = Object.fromEntries(Object.entries(TO_HASH).map(([p, h]) => [h, p]));

function hashPath() {
  if (typeof window === "undefined") return "/";
  return FROM_HASH[window.location.hash.slice(1)] ?? "/";
}

/** Current app path ("/", "/board", "/tech"…) in either build. */
export function useAppPath(): string {
  const real = usePathname();
  const [hp, setHp] = useState(hashPath);
  useEffect(() => {
    if (!IS_ARTIFACT) return;
    const on = () => setHp(hashPath());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return IS_ARTIFACT ? hp : real;
}

/** Go to an app path in either build. */
export function useGo() {
  const router = useRouter();
  return (path: string, replace = false) => {
    if (!IS_ARTIFACT) return replace ? router.replace(path) : router.push(path);
    const h = TO_HASH[path] ?? "";
    if (replace) history.replaceState(null, "", h ? `#${h}` : location.pathname);
    else location.hash = h;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };
}

export function AppLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  if (!IS_ARTIFACT) return <Link href={href} className={className}>{children}</Link>;
  const h = TO_HASH[href] ?? "";
  return (
    <a
      href={h ? `#${h}` : "#"}
      className={className}
      onClick={(e) => {
        if (!h) {
          e.preventDefault();
          history.replaceState(null, "", location.pathname);
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }
      }}
    >
      {children}
    </a>
  );
}
