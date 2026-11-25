"use client";

import { useState } from "react";
import { BukuTestPanel, type BukuTestItem } from "@/components/BukuTestPanel";
import { IprsTestPanel, type IprsTestItem } from "@/components/IprsTestPanel";
import {
  KegiatanTestPanel,
  type KegiatanTestItem,
} from "@/components/KegiatanTestPanel";
import {
  PublikasiTestPanel,
  type PublikasiTestItem,
} from "@/components/PublikasiTestPanel";

type TabKey = "publikasi" | "kegiatan" | "iprs" | "buku";

export function TridharmaTestTabs({
  publikasiItems,
  kegiatanItems,
  iprsItems,
  bukuItems,
  canManage,
  role,
  currentDosenId,
  currentDosenNama,
}: {
  publikasiItems: PublikasiTestItem[];
  kegiatanItems: KegiatanTestItem[];
  iprsItems: IprsTestItem[];
  bukuItems: BukuTestItem[];
  canManage: boolean;
  role: string;
  currentDosenId: number | null;
  currentDosenNama: string | null;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("publikasi");

  const tabs: readonly { key: TabKey; label: string; count: number }[] = [
    { key: "publikasi", label: "Publikasi", count: publikasiItems.length },
    {
      key: "kegiatan",
      label: "Kegiatan (Penelitian & Pengabdian)",
      count: kegiatanItems.length,
    },
    { key: "iprs", label: "HKI / IPRS", count: iprsItems.length },
    { key: "buku", label: "Buku", count: bukuItems.length },
  ];

  return (
    <div className="flex flex-col gap-5 border-t border-[var(--color-border-default)] pt-6">
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--color-text-secondary)]">
          Pilih Bagian Uji CRUD Tridharma
        </p>
        <div
          role="tablist"
          aria-label="Kategori uji API CRUD Tridharma"
          className="flex flex-wrap gap-2"
        >
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                id={`tab-tridharma-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`panel-tridharma-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-colors ${
                  isSelected
                    ? "bg-[var(--color-primary-strong)] text-white"
                    : "border border-[var(--color-border-strong)] bg-white text-[var(--color-text-primary)] hover:bg-[var(--color-tint-neutral)] active:bg-[var(--color-border-default)]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-[6px] px-2 py-0.5 text-[11px] font-bold ${
                    isSelected
                      ? "bg-white text-[var(--color-primary-strong)]"
                      : "bg-[var(--color-tint-neutral)] text-[var(--color-text-primary)]"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`panel-tridharma-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-tridharma-${activeTab}`}
      >
        {activeTab === "publikasi" && (
          <PublikasiTestPanel
            items={publikasiItems}
            canManage={canManage}
            role={role}
            currentDosenId={currentDosenId}
          />
        )}
        {activeTab === "kegiatan" && (
          <KegiatanTestPanel
            items={kegiatanItems}
            canManage={canManage}
            role={role}
            currentDosenId={currentDosenId}
            currentDosenNama={currentDosenNama}
          />
        )}
        {activeTab === "iprs" && (
          <IprsTestPanel
            items={iprsItems}
            canManage={canManage}
            role={role}
            currentDosenId={currentDosenId}
          />
        )}
        {activeTab === "buku" && (
          <BukuTestPanel
            items={bukuItems}
            canManage={canManage}
            role={role}
            currentDosenId={currentDosenId}
          />
        )}
      </div>
    </div>
  );
}
