import { describe, expect, it } from "vitest";
import { evaluateRouteRbac, getTridharmaPermissions } from "@/lib/rbac";
import { sesi } from "../helpers/fixtures";

function sesiDosen(role: string, dosenId: number | null) {
  return { ...sesi(role), dosen_id: dosenId };
}

function keputusan(path: string, method: string, peran: string | null) {
  const hasil = evaluateRouteRbac(path, method, peran === null ? null : sesi(peran));
  if (hasil.allowed) return "izin";
  return hasil.reason === "unauthenticated" ? "belum_login" : "dilarang";
}

describe("getTridharmaPermissions", () => {
  it.each([
    ["Dosen", true],
    ["Kaprodi", true],
    ["Staff_Kaprodi", true],
    ["Admin", true],
    ["Mahasiswa", false],
    ["Umum", false],
  ])("peran %s: boleh ubah dan hapus data milik sendiri = %s", (peran, harapan) => {
    const izin = getTridharmaPermissions(sesiDosen(peran, 7));
    expect(izin.canManageOwn).toBe(harapan);
    expect(izin.canCreate).toBe(harapan);
  });

  it("tanpa sesi: hanya boleh melihat", () => {
    expect(getTridharmaPermissions(null)).toMatchObject({
      canView: true,
      canCreate: false,
      canManageOwn: false,
      canUpdate: false,
      canDelete: false,
    });
  });

  it("izin peran tidak bergantung pada dosen_id (belum isi sinta_id tetap terhitung diizinkan)", () => {
    expect(getTridharmaPermissions(sesiDosen("Dosen", null)).canManageOwn).toBe(true);
  });

  it("tidak ada lagi izin ACC atau validasi di modul 7", () => {
    expect(getTridharmaPermissions(sesiDosen("Kaprodi", 7), 99)).not.toHaveProperty("canAcc");
  });

  describe("izin per baris data", () => {
    it("pemilik boleh ubah dan hapus", () => {
      expect(getTridharmaPermissions(sesiDosen("Dosen", 7), 7)).toMatchObject({ isOwner: true, canUpdate: true, canDelete: true });
    });

    it("pemilik di antara beberapa dosen yang tertaut", () => {
      expect(getTridharmaPermissions(sesiDosen("Staff_Kaprodi", 7), [3, 7, 9]).canDelete).toBe(true);
    });

    it.each(["Dosen", "Kaprodi", "Staff_Kaprodi"])("%s tidak boleh mengubah data dosen lain", (peran) => {
      expect(getTridharmaPermissions(sesiDosen(peran, 7), 8)).toMatchObject({ isOwner: false, canUpdate: false, canDelete: false });
    });

    it("dosen tanpa baris dosen tidak memiliki baris mana pun", () => {
      expect(getTridharmaPermissions(sesiDosen("Dosen", null), 7)).toMatchObject({ isOwner: false, canUpdate: false });
    });

    it("Mahasiswa tetap tidak boleh walau id kebetulan sama", () => {
      expect(getTridharmaPermissions(sesiDosen("Mahasiswa", 7), 7).canUpdate).toBe(false);
    });
  });
});

describe("RBAC rute modul 7 (lapisan proxy)", () => {
  it.each(["/tridharma", "/api/tridarma/publikasi", "/api/tridarma/kegiatan/3", "/api/tridharma/apa-saja"])(
    "GET %s terbuka untuk semua, termasuk tanpa login",
    (path) => {
      for (const peran of [null, "Umum", "Mahasiswa", "Dosen", "Kaprodi", "Staff_Kaprodi"]) {
        expect(keputusan(path, "GET", peran)).toBe("izin");
      }
    },
  );

  const tulis: [string, string][] = [
    ["POST", "/api/tridarma/publikasi"],
    ["PATCH", "/api/tridarma/publikasi/5"],
    ["DELETE", "/api/tridarma/buku/5"],
  ];

  it.each(tulis)("%s %s: Dosen, Kaprodi, Staff Kaprodi, dan Admin diizinkan", (method, path) => {
    for (const peran of ["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"]) {
      expect(keputusan(path, method, peran)).toBe("izin");
    }
  });

  it.each(tulis)("%s %s: Mahasiswa dan Umum dilarang, tanpa sesi diminta login", (method, path) => {
    expect(keputusan(path, method, "Mahasiswa")).toBe("dilarang");
    expect(keputusan(path, method, "Umum")).toBe("dilarang");
    expect(keputusan(path, method, null)).toBe("belum_login");
  });

  it("tidak ada perlakuan khusus ACC: segmen validasi diperlakukan seperti rute biasa", () => {
    expect(keputusan("/api/tridarma/publikasi/5/validasi", "GET", "Dosen")).toBe("izin");
    expect(keputusan("/api/tridarma/publikasi/5/validasi", "POST", "Dosen")).toBe("izin");
    expect(keputusan("/api/tridarma/publikasi/5/validasi", "POST", "Mahasiswa")).toBe("dilarang");
  });
});
