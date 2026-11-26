"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CircleAlert } from "lucide-react";

type Props = {
  open: boolean;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDeleteDialog({
  open,
  message = "Apakah Anda yakin untuk menghapus berkas ini?",
  confirmLabel = "Hapus",
  cancelLabel = "Batal",
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const loadingRef = useRef(loading);

  useEffect(() => {
    onCancelRef.current = onCancel;
    loadingRef.current = loading;
  });

  useEffect(() => {
    if (!open) return;

    // Fokus awal ke tombol Batal (aksi yang paling aman)
    cancelRef.current?.focus();

    // Kunci scroll halaman selama modal terbuka
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loadingRef.current) onCancelRef.current();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  // Portal ke body: lepas dari style tabel (whitespace-nowrap, dll.)
  // dan dari induk yang punya transform/overflow
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 font-(family-name:--font-plus-jakarta)"
      role="presentation"
    >
      {/* Latar belakang */}
      <div
        className="fixed inset-0 bg-[#131b2e]/50 backdrop-blur-[2px]"
        onClick={() => {
          if (!loading) onCancel();
        }}
        aria-hidden
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-describedby="confirm-delete-message"
        className="relative my-auto flex w-full max-w-110 flex-col items-center gap-5 whitespace-normal rounded-2xl bg-white px-5 pb-6 pt-8 shadow-[0_16px_48px_rgba(19,27,46,0.24)] sm:gap-6 sm:rounded-3xl sm:px-8 sm:pb-8 sm:pt-10"
      >
        <CircleAlert
          className="size-14 shrink-0 text-[#ba1a1a] sm:size-20"
          strokeWidth={2.25}
          aria-hidden
        />

        <p
          id="confirm-delete-message"
          className="w-full max-w-85 wrap-break-word text-center text-base font-medium leading-6 text-black sm:text-xl sm:leading-8"
        >
          {message}
        </p>

        <div className="flex w-full items-center gap-3 sm:gap-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg bg-white px-3 text-sm font-medium text-black shadow-[0_1px_4px_rgba(0,0,0,0.2)] hover:bg-[#f2f3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 disabled:cursor-not-allowed disabled:opacity-60 sm:h-12 sm:px-4 sm:text-base"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg bg-[#ba1a1a] px-3 text-sm font-medium text-white shadow-[0_1px_4px_rgba(0,0,0,0.2)] hover:bg-[#93000a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ba1a1a]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:h-12 sm:px-4 sm:text-base"
          >
            {loading ? "Menghapus..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}