import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./ui";

/** Modal con <dialog> nativo: foco atrapado y Escape para cerrar. */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
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
        onClose();
      }}
      aria-labelledby={titleId}
      className="m-auto w-[min(420px,calc(100vw-32px))] border-2 border-line bg-surface p-0 text-fg backdrop:bg-tinta/70"
    >
      <div className="border-b-2 border-line bg-faro px-4 py-2.5 text-tinta">
        <h2 id={titleId} className="label font-bold">
          {title}
        </h2>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </dialog>
  );
}

/** Confirmación modal: cancelar o confirmar. */
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
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <div className="text-[15px] leading-[1.55]">{children}</div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button variant="primary" onClick={onConfirm} autoFocus>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
