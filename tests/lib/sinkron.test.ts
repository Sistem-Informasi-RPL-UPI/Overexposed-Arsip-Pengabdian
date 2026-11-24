import { describe, expect, it } from "vitest";
import {
  bisaSinkronLagiPada,
  kondisiBolehSinkron,
  klasifikasiSinkron,
  SINKRON_ULANG_HARI,
} from "@/lib/sinkron";

const SEKARANG = new Date("2026-11-24T12:00:00.000Z");
const HARI = 24 * 60 * 60 * 1000;
const lalu = (ms: number) => new Date(SEKARANG.getTime() - ms);

describe("klasifikasiSinkron (aturan 7 hari, PRD 5.3)", () => {
  it("batas 7 hari", () => {
    expect(SINKRON_ULANG_HARI).toBe(7);
  });

  it("IN_PROGRESS: sedang berjalan", () => {
    expect(klasifikasiSinkron("IN_PROGRESS", lalu(30 * HARI), SEKARANG)).toBe("berjalan");
    expect(klasifikasiSinkron("IN_PROGRESS", null, SEKARANG)).toBe("berjalan");
  });

  it("belum pernah sinkron: boleh", () => {
    expect(klasifikasiSinkron(null, null, SEKARANG)).toBe("boleh");
  });

  it("SUCCESS dalam 7 hari: tunggu, termasuk tepat 7 hari", () => {
    expect(klasifikasiSinkron("SUCCESS", lalu(HARI), SEKARANG)).toBe("tunggu");
    expect(klasifikasiSinkron("SUCCESS", lalu(7 * HARI), SEKARANG)).toBe("tunggu");
  });

  it("SUCCESS lebih dari 7 hari: boleh", () => {
    expect(klasifikasiSinkron("SUCCESS", lalu(7 * HARI + 1), SEKARANG)).toBe("boleh");
  });

  it.each(["FAILED", "PARTIAL"] as const)("%s boleh diulang sebelum 7 hari", (status) => {
    expect(klasifikasiSinkron(status, lalu(HARI), SEKARANG)).toBe("boleh");
    expect(klasifikasiSinkron(status, null, SEKARANG)).toBe("boleh");
  });

  it("status kosong dengan tanggal baru tetap boleh, sama dengan perlu_sinkron di crawler", () => {
    expect(klasifikasiSinkron(null, lalu(HARI), SEKARANG)).toBe("boleh");
  });

  it("SUCCESS tanpa tanggal: boleh", () => {
    expect(klasifikasiSinkron("SUCCESS", null, SEKARANG)).toBe("boleh");
  });
});

describe("bisaSinkronLagiPada", () => {
  it("SUCCESS yang menunggu: tanggal sinkron terakhir + 7 hari", () => {
    const terakhir = lalu(2 * HARI);
    expect(bisaSinkronLagiPada("SUCCESS", terakhir, SEKARANG)?.toISOString()).toBe(
      new Date(terakhir.getTime() + 7 * HARI).toISOString(),
    );
  });

  it.each([
    ["boleh karena FAILED", "FAILED" as const, lalu(HARI)],
    ["boleh karena lewat 7 hari", "SUCCESS" as const, lalu(8 * HARI)],
    ["sedang berjalan", "IN_PROGRESS" as const, lalu(HARI)],
    ["belum pernah sinkron", null, null],
  ])("null bila %s", (_nama, status, terakhir) => {
    expect(bisaSinkronLagiPada(status, terakhir, SEKARANG)).toBeNull();
  });
});

describe("kondisiBolehSinkron (kondisi updateMany atomik)", () => {
  const kondisi = kondisiBolehSinkron(SEKARANG);
  const [bukanBerjalan, aturan7Hari] = kondisi.AND as Array<{ OR: unknown[] }>;

  it("baris NULL lolos: `<> IN_PROGRESS` di SQL membuang NULL jadi harus eksplisit", () => {
    expect(bukanBerjalan.OR).toContainEqual({ sync_status: null });
    expect(bukanBerjalan.OR).toContainEqual({ sync_status: { not: "IN_PROGRESS" } });
  });

  it("tidak pernah memuat IN_PROGRESS sebagai nilai yang diizinkan", () => {
    expect(JSON.stringify(aturan7Hari)).not.toContain("IN_PROGRESS");
  });

  it("pengecualian FAILED dan PARTIAL ada di aturan 7 hari", () => {
    expect(aturan7Hari.OR).toContainEqual({ sync_status: { in: ["FAILED", "PARTIAL"] } });
  });

  it("batas waktu tepat 7 hari sebelum sekarang", () => {
    expect(aturan7Hari.OR).toContainEqual({ last_synced_at: { lt: new Date("2026-11-17T12:00:00.000Z") } });
  });
});
