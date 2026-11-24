// app/layout.tsx
import * as React from "react";
import type { Metadata } from "next";
import { Lexend, Plus_Jakarta_Sans, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/session";
import { getArsipPermissions } from "@/lib/rbac";
import AppSidebar from "@/components/Navbar";
import TopBar from "@/components/Topbar";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sistem Informasi RPL",
  description: "Portal Sistem Informasi Program Studi RPL UPI Kampus Cibiru.",
};

// Sesi hanya dibaca sekali per request walau dipakai Sidebar dan TopBar.
const getSessionOnce = React.cache(getSession);

async function SidebarSlot() {
  const session = await getSessionOnce();
  if (!session) return null; // belum login (mis. /login): tanpa sidebar

  const permissions = getArsipPermissions(session);

  // Hapus setelah beres. Lihat di terminal server, bukan console browser.
  console.log("[SidebarSlot] permissions:", permissions);

  return (
    <AppSidebar permissions={permissions} className="sticky top-0 h-screen" />
  );
}

async function TopBarSlot() {
  const session = await getSessionOnce();
  if (!session) return null;

  return <TopBar />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={cn(
        "h-full",
        "antialiased",
        lexend.variable,
        plusJakartaSans.variable,
        "font-sans",
        geist.variable,
      )}
    >
      <body className="min-h-screen flex flex-row bg-[#faf8ff] text-(--color-text-primary)">
        <React.Suspense fallback={<div className="w-64 shrink-0" />}>
          <SidebarSlot />
        </React.Suspense>

        <main className="min-w-0 flex-1">
          <React.Suspense fallback={null}>
            <TopBarSlot />
          </React.Suspense>
          {children}
           <Toaster position="bottom-right" richColors closeButton />
        </main>
      </body>
    </html>
  );
}