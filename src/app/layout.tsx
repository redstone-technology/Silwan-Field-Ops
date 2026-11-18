import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Silwan Field Ops",
  description: "Deploy and track Silwan Security technicians. Prototype by Redstone.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F1F3FA",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // dir="rtl" + lang="ar" later for Arabic; the CSS uses logical properties so the layout flips
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Poppins:wght@500;600&display=swap" />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
