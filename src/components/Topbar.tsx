
"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown } from "lucide-react";

interface User {
  sub: string;
  name: string;
  email: string;
  nip: string;
  role: string;
  dosen_id: string | null;
}

export default function TopBar() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/me", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Gagal mengambil data user");
        }

        const data = await response.json();

        if (data.authenticated) {
          setUser(data.user);
        }
      } catch (error) {
        console.error("Error mengambil session:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const initials = user?.name
    ?.split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  return (
    <header className="flex h-16 w-full items-center justify-between bg-white px-6">
      <span className="rounded-full bg-[#e2e7ff] px-2 py-1 font-[family-name:var(--font-lexend)] text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[#00288e]">
        Semester Genap 2024/2025
      </span>

      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className="font-[family-name:var(--font-lexend)] text-xs font-semibold leading-4 tracking-[0.24px] text-[#131b2e]">
            {loading ? "Memuat..." : user?.name || "User"}
          </p>

          <p className="whitespace-pre text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[#444653]">
            {user
              ? `${user.role} / NIP: ${user.nip || "-"}`
              : "Tidak ada data user"}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Avatar className="size-8 shadow-[0_0_0_2px_#39b8fd]">
            <AvatarImage src="/profile.png" alt={user?.name || "User"} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>

          <ChevronDown className="size-3 text-[#444653]" aria-hidden />
        </div>
      </div>
    </header>
  );
}
