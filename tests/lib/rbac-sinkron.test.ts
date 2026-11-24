import { describe, expect, it } from "vitest";
import { evaluateRouteRbac, getSinkronPermissions } from "@/lib/rbac";
import { sesi } from "../helpers/fixtures";

function keputusan(path: string, method: string, peran: string | null) {
  const hasil = evaluateRouteRbac(path, method, peran === null ? null : sesi(peran));
  if (hasil.allowed) return "izin";
  return hasil.reason === "unauthenticated" ? "belum_login" : "dilarang";
}

describe("getSinkronPermissions (PRD 8.1)", () => {
  it.each([
    ["Staff_Kaprodi", true, true],
    ["Admin", true, true],
    ["Kaprodi", true, false],
    ["Dosen", true, false],
    ["Mahasiswa", false, false],
    ["Umum", false, false],
  ])("peran %s: sendiri=%s, satu atau semua dosen=%s", (peran, sendiri, siapaSaja) => {
    const izin = getSinkronPermissions(sesi(peran));
    expect(izin.canSyncSelf).toBe(sendiri);
    expect(izin.canSyncAny).toBe(siapaSaja);
  });

  it("tanpa sesi: tidak boleh apa pun", () => {
    expect(getSinkronPermissions(null)).toMatchObject({ canSyncSelf: false, canSyncAny: false, role: "Umum" });
  });
});

describe("evaluateRouteRbac untuk rute sinkron", () => {
  it.each([
    ["Staff_Kaprodi", "izin"],
    ["Admin", "izin"],
    ["Kaprodi", "dilarang"],
    ["Dosen", "dilarang"],
    ["Mahasiswa", "dilarang"],
    [null, "belum_login"],
  ])("POST /api/staff-kaprodi/sinkron untuk %s: %s", (peran, harapan) => {
    expect(keputusan("/api/staff-kaprodi/sinkron", "POST", peran)).toBe(harapan);
  });

  it.each([
    ["Staff_Kaprodi", "izin"],
    ["Kaprodi", "izin"],
    ["Dosen", "izin"],
    ["Mahasiswa", "dilarang"],
    ["Umum", "dilarang"],
    [null, "belum_login"],
  ])("POST /api/dosen/sinkron dan status untuk %s: %s", (peran, harapan) => {
    expect(keputusan("/api/dosen/sinkron", "POST", peran)).toBe(harapan);
    expect(keputusan("/api/dosen/sinkron/status", "GET", peran)).toBe(harapan);
  });

  it.each([
    ["Staff_Kaprodi", "izin"],
    ["Admin", "izin"],
    ["Kaprodi", "izin"],
    ["Dosen", "izin"],
    ["Mahasiswa", "dilarang"],
    ["Umum", "dilarang"],
    [null, "belum_login"],
  ])("GET /api/crawler/health untuk %s: %s", (peran, harapan) => {
    expect(keputusan("/api/crawler/health", "GET", peran)).toBe(harapan);
  });
});
