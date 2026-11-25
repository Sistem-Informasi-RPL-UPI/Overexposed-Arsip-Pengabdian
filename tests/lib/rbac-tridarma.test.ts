import { describe, expect, it } from "vitest";
import {
  evaluateRouteRbac,
  getPengajaranPermissions,
  getTridharmaPermissions,
} from "@/lib/rbac";
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

  describe("RBAC khusus bagian pengajaran (PRD 5.4)", () => {
    const semuaPathPengajaran = [
      "/api/tridarma/pengajaran/matkul",
      "/api/tridarma/pengajaran/matkul/1",
      "/api/tridarma/pengajaran/kelas",
      "/api/tridarma/pengajaran/kelas/1",
      "/api/tridarma/pengajaran/berkas_pengajaran",
      "/api/tridarma/pengajaran/berkas_pengajaran/1",
    ];

    it.each(semuaPathPengajaran)(
      "GET & POST %s: tanpa sesi belum_login, Mahasiswa dan Umum dilarang",
      (path) => {
        for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
          expect(keputusan(path, method, null)).toBe("belum_login");
          expect(keputusan(path, method, "Mahasiswa")).toBe("dilarang");
          expect(keputusan(path, method, "Umum")).toBe("dilarang");
        }
      },
    );

    it.each(semuaPathPengajaran)(
      "GET %s: Dosen, Kaprodi, Staff_Kaprodi, dan Admin diizinkan",
      (path) => {
        for (const peran of ["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"]) {
          expect(keputusan(path, "GET", peran)).toBe("izin");
        }
      },
    );

    it("tulis matkul: hanya Kaprodi, Staff_Kaprodi, dan Admin; Dosen dilarang", () => {
      for (const method of ["POST", "PATCH", "DELETE"]) {
        expect(keputusan("/api/tridarma/pengajaran/matkul", method, "Kaprodi")).toBe("izin");
        expect(keputusan("/api/tridarma/pengajaran/matkul/1", method, "Staff_Kaprodi")).toBe("izin");
        expect(keputusan("/api/tridarma/pengajaran/matkul/1", method, "Admin")).toBe("izin");
        expect(keputusan("/api/tridarma/pengajaran/matkul", method, "Dosen")).toBe("dilarang");
      }
    });

    it.each([
      "/api/tridarma/pengajaran/kelas",
      "/api/tridarma/pengajaran/kelas/1",
      "/api/tridarma/pengajaran/berkas_pengajaran",
      "/api/tridarma/pengajaran/berkas_pengajaran/1",
    ])("tulis %s: hanya Dosen; Kaprodi dan Staff_Kaprodi dilarang", (path) => {
      for (const method of ["POST", "PATCH", "DELETE"]) {
        expect(keputusan(path, method, "Dosen")).toBe("izin");
        expect(keputusan(path, method, "Kaprodi")).toBe("dilarang");
        expect(keputusan(path, method, "Staff_Kaprodi")).toBe("dilarang");
        expect(keputusan(path, method, "Admin")).toBe("dilarang");
      }
    });
  });
});

describe("getPengajaranPermissions", () => {
  it("Kaprodi dan Staff_Kaprodi boleh kelola matkul tetapi tidak boleh kelola kelas/berkas", () => {
    for (const peran of ["Kaprodi", "Staff_Kaprodi", "Admin"]) {
      expect(getPengajaranPermissions(sesiDosen(peran, 7), 7)).toMatchObject({
        canViewPengajaran: true,
        canManageMatkul: true,
        canManageOwnKelasBerkas: false,
        canUpdateKelasBerkas: false,
        canDeleteKelasBerkas: false,
      });
    }
  });

  it("Dosen boleh lihat pengajaran dan kelola kelas/berkas milik sendiri, tidak boleh kelola matkul", () => {
    expect(getPengajaranPermissions(sesiDosen("Dosen", 7), 7)).toMatchObject({
      canViewPengajaran: true,
      canManageMatkul: false,
      canManageOwnKelasBerkas: true,
      isOwner: true,
      canUpdateKelasBerkas: true,
      canDeleteKelasBerkas: true,
    });
    expect(getPengajaranPermissions(sesiDosen("Dosen", 7), 99)).toMatchObject({
      isOwner: false,
      canUpdateKelasBerkas: false,
      canDeleteKelasBerkas: false,
    });
  });

  it("Mahasiswa, Umum, dan tanpa sesi ditolak semua akses pengajaran", () => {
    for (const s of [null, sesiDosen("Mahasiswa", null), sesiDosen("Umum", null)]) {
      expect(getPengajaranPermissions(s)).toMatchObject({
        canViewPengajaran: false,
        canManageMatkul: false,
        canManageOwnKelasBerkas: false,
      });
    }
  });
});
