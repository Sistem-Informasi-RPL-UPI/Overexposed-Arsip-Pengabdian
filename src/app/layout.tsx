import type { Metadata } from "next";
import { Lexend, Plus_Jakarta_Sans, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import AppSidebar from "@/components/Navbar";
import TopBar from "@/components/Topbar";

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
      <body className="min-h-screen flex flex-row bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
        <AppSidebar />

        <main className="flex-1 min-w-0 ">
          {" "}
          <TopBar />
          {children}
        </main>
      </body>
    </html>
  );
}
