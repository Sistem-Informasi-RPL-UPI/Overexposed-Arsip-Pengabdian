import type { SumberData } from "@/generated/prisma/client";

/** Status IPRS yang diisi server untuk data manual (PRD 5.7). IPRS hasil crawl menyimpan status SINTA apa adanya. */
export const STATUS_IPRS_MANUAL = "Diterima";

export const SUMBER_SINTA: SumberData = "sinta";
export const SUMBER_MANUAL: SumberData = "manual";
