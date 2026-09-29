import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./ui";

/** Confirmación modal con <dialog> nativo: foco atrapado y Escape para cancelar. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(420px,calc(100vw-32px))] border-2 border-line bg-surface p-0 text-fg backdrop:bg-tinta/70"
    >
      <div className="border-b-2 border-line bg-faro px-4 py-2.5 text-tinta">
        <h2 id="confirm-title" className="label font-bold">
          {title}
        </h2>
      </div>
      <div className="space-y-4 p-4">
        <div className="text-[15px] leading-[1.55]">{children}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="primary" onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
