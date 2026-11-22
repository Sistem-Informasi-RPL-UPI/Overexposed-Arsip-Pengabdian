// components/Sidebar.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  Inbox,
  FolderUp,
  ScrollText,
  FileText,
  Microscope,
  HeartHandshake,
  ClipboardCheck,
  BookOpen,
  LogOut,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { getArsipPermissions } from "@/lib/rbac";

type Permissions = ReturnType<typeof getArsipPermissions>;

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  izin?: keyof Permissions; // kosong = semua user boleh lihat
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const mainItem: NavItem = {
  label: "Menu Utama",
  href: "/",
  icon: Home,
};

const groups: NavGroup[] = [
  {
    title: "Menu Arsip",
    items: [
      { label: "Dashboard", href: "/arsip/dashboard", icon: LayoutDashboard },
      { label: "Daftar Arsip", href: "/arsip/daftar", icon: Inbox },
      // Tambahkan izin untuk menu yang ingin disembunyikan dari Kaprodi, mis.:
      // { label: "Kategori", href: "/arsip/kategori", icon: FolderUp, izin: "canViewKategori" },
      { label: "Kategori", href: "/arsip/kategori", icon: FolderUp },
      {
        label: "Log",
        href: "/arsip/log",
        icon: ScrollText,
        izin: "canViewLogAktivitas",
      },
    ],
  },
  {
    title: "Menu Tridharma",
    items: [
      {
        label: "Dashboard",
        href: "/tridharma/dashboard",
        icon: LayoutDashboard,
      },
      { label: "Publikasi", href: "/tridharma/publikasi", icon: FileText },
      { label: "Penelitian", href: "/tridharma/penelitian", icon: Microscope },
      {
        label: "Pengabdian",
        href: "/tridharma/pengabdian",
        icon: HeartHandshake,
      },
      { label: "HKI", href: "/tridharma/hki", icon: ClipboardCheck },
      { label: "Buku", href: "/tridharma/buku", icon: BookOpen },
    ],
  },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-[60px] w-full items-center gap-3 rounded-xl px-4 text-lg transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-[#0000B8] font-semibold text-white"
          : "font-normal text-slate-500 hover:bg-slate-100",
      )}
    >
      <Icon className="size-7 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 56 56" className="size-14 shrink-0" aria-hidden="true">
      <path d="M22 4 L50 28 L22 52 L22 40 L36 28 L22 16 Z" fill="#14234F" />
      <path
        d="M4 10 L24 28 L4 46 L4 36 L14 28 L4 20 Z"
        fill="#F5A300"
        stroke="#14234F"
        strokeWidth="2"
      />
    </svg>
  );
}

interface AppSidebarProps extends React.HTMLAttributes<HTMLElement> {
  permissions?: Permissions;
  onLogout?: () => void;
}

export function AppSidebar({
  className,
  permissions,
  onLogout,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = React.useCallback(async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout:", err);
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }, [onLogout, router]);

  // Sembunyikan menu yang izinnya tidak dimiliki user.
  const visibleGroups = React.useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) => !item.izin || permissions?.[item.izin],
          ),
        }))
        .filter((group) => group.items.length > 0),
    [permissions],
  );

  return (
    <aside
      className={cn(
        "inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto bg-white",
        className,
      )}
      {...props}
    >
      {/* Header + navigasi */}
      <div className="flex w-full flex-1 flex-col overflow-y-auto">
        <div className="flex items-center gap-2 px-4 py-6">
          <Logo />
          <div className="leading-tight">
            <p className="text-base font-extrabold tracking-wider text-[#0A2A8F]">
              SI RPL UPI
            </p>
            <p className="text-sm font-semibold text-slate-700">
              Arsip Program Studi - Data Tridharma Dosen
            </p>
          </div>
        </div>

        <nav
          className="flex w-full flex-col gap-2 px-2"
          aria-label="Navigasi utama"
        >
          <NavLink item={mainItem} active={pathname === mainItem.href} />

          {visibleGroups.map((group) => (
            <div key={group.title} className="mt-4 flex flex-col gap-1">
              <p className="px-4 pb-1 text-sm font-bold uppercase tracking-widest text-slate-500">
                {group.title}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(`${item.href}/`))
                  }
                />
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="w-full bg-[#F1F2FE] px-4 py-6">
        <Button
          variant="ghost"
          onClick={handleLogout}
          disabled={loggingOut}
          className="h-auto gap-2 p-0 text-lg font-semibold text-red-700 hover:bg-transparent hover:text-red-800"
        >
          <LogOut className="size-6" strokeWidth={2} />
          {loggingOut ? "Keluar..." : "Keluar Sistem"}
        </Button>
      </div>
    </aside>
  );
}

export default AppSidebar;
