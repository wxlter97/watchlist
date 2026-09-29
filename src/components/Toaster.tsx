import { useLang } from "../lib/i18n";
import { useToasts } from "../lib/toasts";

export function Toaster() {
  const { t } = useLang();
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-3xl flex-col gap-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))]"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 border-2 border-line border-l-[10px] border-l-faro bg-tinta py-2 pr-2 pl-3 text-sm text-[#EDEDE7]"
        >
          <p className="min-w-0 flex-1 leading-snug">{toast.message}</p>
          {toast.action &&
            (toast.action.href ? (
              <a
                href={toast.action.href}
                target="_blank"
                rel="noopener"
                onClick={() => dismiss(toast.id)}
                className="on-faro min-h-10 shrink-0 border-2 border-faro bg-faro px-3 py-2 font-mono text-xs font-bold text-tinta uppercase"
              >
                {toast.action.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick?.();
                  dismiss(toast.id);
                }}
                className="on-faro min-h-10 shrink-0 border-2 border-faro bg-faro px-3 py-2 font-mono text-xs font-bold text-tinta uppercase"
              >
                {toast.action.label}
              </button>
            ))}
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={() => dismiss(toast.id)}
            className="grid size-10 shrink-0 place-items-center font-mono text-lg text-[#8A8A80] hover:text-[#EDEDE7]"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
