"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import ConfirmDeleteDialog from "./ConfirmDeletedialog";


export default function DeleteArsipButton({
  id,
  judul,
}: {
  id: string;
  judul: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onConfirm() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/arsip/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!res.ok) {
        toast.error("Arsip gagal dihapus", {
          description: data?.message ?? "Terjadi kesalahan saat menghapus arsip.",
        });
        setLoading(false);
        setOpen(false);
        return;
      }

      toast.success("Arsip berhasil dihapus", {
        description: data?.message ?? `"${judul}" telah dihapus.`,
      });
      setOpen(false);
      router.refresh(); // ambil ulang data tabel dan total arsip
    } catch {
      toast.error("Arsip gagal dihapus", {
        description: "Tidak dapat terhubung ke server. Coba lagi.",
      });
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Hapus ${judul}`}
        onClick={() => setOpen(true)}
        className="size-6.75 text-[#ba1a1a] hover:bg-red-50"
      >
        <Trash2 className="size-4" />
      </Button>


      <ConfirmDeleteDialog
        message={`Apakah Anda yakin untuk menghapus arsip "${judul}"?`}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        open={open}
        loading={loading}
        onCancel={() => setOpen(false)}
        onConfirm={onConfirm}
      />
    </>
  );
}