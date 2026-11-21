import { describe, expect, it } from "vitest";
import { evaluateRouteRbac } from "@/lib/rbac";
import { sesi } from "../helpers/fixtures";

type Keputusan = "izin" | "belum_login" | "dilarang";

function keputusan(path: string, method: string, peran: string | null): Keputusan {
  const hasil = evaluateRouteRbac(path, method, peran === null ? null : sesi(peran));
  if (hasil.allowed) return "izin";
  return hasil.reason === "unauthenticated" ? "belum_login" : "dilarang";
}

const STAFF = ["Staff Kaprodi", "Admin"];

describe("RBAC rute /api/arsip (lapisan proxy)", () => {
  describe("daftar dan detail arsip (GET)", () => {
    it.each([
      ["/api/arsip", "Staff Kaprodi", "izin"],
      ["/api/arsip", "Kaprodi", "izin"],
      ["/api/arsip", "Dosen", "izin"],
      ["/api/arsip", "Mahasiswa", "dilarang"],
      ["/api/arsip", "Umum", "dilarang"],
      ["/api/arsip", null, "belum_login"],
      ["/api/arsip/7", "Dosen", "izin"],
      ["/api/arsip/7", "Mahasiswa", "dilarang"],
    ])("GET %s oleh %s: %s", (path, peran, harapan) => {
      expect(keputusan(path, "GET", peran)).toBe(harapan);
    });
  });

  describe("tulis arsip (POST, PATCH, DELETE) hanya Staff Kaprodi", () => {
    const tulis: [string, string][] = [
      ["POST", "/api/arsip"],
      ["PATCH", "/api/arsip/7"],
      ["DELETE", "/api/arsip/7"],
    ];

    it.each(tulis.flatMap(([method, path]) => STAFF.map((peran) => [method, path, peran] as const)))(
      "%s %s oleh %s: izin",
      (method, path, peran) => {
        expect(keputusan(path, method, peran)).toBe("izin");
      },
    );

    it.each(
      tulis.flatMap(([method, path]) => ["Kaprodi", "Dosen", "Mahasiswa", "Umum"].map((peran) => [method, path, peran] as const)),
    )("%s %s oleh %s: dilarang", (method, path, peran) => {
      expect(keputusan(path, method, peran)).toBe("dilarang");
    });

    it.each(tulis)("%s %s tanpa sesi: belum login", (method, path) => {
      expect(keputusan(path, method, null)).toBe("belum_login");
    });
  });
});

describe("RBAC rute /api/arsip/kategori (lapisan proxy)", () => {
  it.each([
    ["Staff Kaprodi", "izin"],
    ["Admin", "izin"],
    ["Kaprodi", "izin"],
    ["Dosen", "dilarang"],
    ["Mahasiswa", "dilarang"],
    ["Umum", "dilarang"],
  ])("GET daftar kategori oleh %s: %s", (peran, harapan) => {
    expect(keputusan("/api/arsip/kategori", "GET", peran)).toBe(harapan);
  });

  const tulis: [string, string][] = [
    ["POST", "/api/arsip/kategori"],
    ["PATCH", "/api/arsip/kategori/3"],
    ["DELETE", "/api/arsip/kategori/3"],
  ];

  it.each(tulis.flatMap(([method, path]) => STAFF.map((peran) => [method, path, peran] as const)))(
    "%s %s oleh %s: izin",
    (method, path, peran) => {
      expect(keputusan(path, method, peran)).toBe("izin");
    },
  );

  it.each(
    tulis.flatMap(([method, path]) => ["Kaprodi", "Dosen", "Mahasiswa"].map((peran) => [method, path, peran] as const)),
  )("%s %s oleh %s: dilarang", (method, path, peran) => {
    expect(keputusan(path, method, peran)).toBe("dilarang");
  });
});
