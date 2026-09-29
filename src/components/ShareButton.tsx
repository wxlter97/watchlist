import { useState } from "react";
import { useLang } from "../lib/i18n";
import { cardUrl, shareCard, type CardParams } from "../lib/share";
import { showToast } from "../lib/toasts";
import { Button } from "./ui";

/** Comparte una tarjeta de /api/og (o la descarga si el dispositivo no puede compartir archivos). */
export function ShareButton({
  card,
  title,
  text,
  fileName,
  variant = "secondary",
  className,
  label,
}: {
  /** Texto del botón; por defecto "Compartir". */
  label?: string;
  card: CardParams;
  title: string;
  text: string;
  fileName: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const { t, lang } = useLang();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      const result = await shareCard(cardUrl(card, lang), { title, text, fileName });
      if (result === "downloaded") showToast({ message: t("share.downloaded") });
    } catch {
      showToast({ message: t("share.error") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant={variant} className={className} disabled={busy} onClick={() => void share()}>
      {busy ? t("share.preparing") : (label ?? t("share.share"))}
    </Button>
  );
}
