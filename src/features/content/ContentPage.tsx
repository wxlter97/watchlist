import { Link } from "react-router";
import { useLang } from "../../lib/i18n";
import { usePageMeta } from "../../lib/meta";

// Páginas de contenido público (preguntas frecuentes y guía). El texto vive en locales/ (content.*)
// y api/page.ts lo sirve también como HTML para buscadores y modelos de IA (con JSON-LD en la FAQ).

type Kind = "faq" | "guide";

export function ContentPage({ kind }: { kind: Kind }) {
  const { t } = useLang();
  const base = `content.${kind}`;
  usePageMeta({ title: t("meta.pageTitle", { page: t(`${base}.title`) }), description: t(`${base}.description`), canonical: `/${kind}` }, t("meta.siteDescription"));

  const entries =
    kind === "faq"
      ? (t(`${base}.items`, { returnObjects: true }) as unknown as { q: string; a: string }[]).map((i) => ({ h: i.q, p: [i.a] }))
      : (t(`${base}.sections`, { returnObjects: true }) as unknown as { h: string; p: string[] }[]);

  return (
    <article className="max-w-3xl space-y-8 pt-6">
      <header>
        <h1 className="display text-[39px]">{t(`${base}.title`)}</h1>
        <p className="mt-3 max-w-[62ch] leading-[1.55] text-fg-soft">{t(`${base}.intro`)}</p>
      </header>
      {entries.map((e) => (
        <section key={e.h} className="space-y-2">
          <h2 className="display text-[22px]">{e.h}</h2>
          {e.p.map((text) => (
            <p key={text} className="max-w-[70ch] leading-[1.6] text-fg-soft">
              {text}
            </p>
          ))}
        </section>
      ))}
      <p className="border-t-2 border-line-soft pt-6">
        <Link to={kind === "faq" ? "/guide" : "/faq"} className="text-link uppercase">
          {t(kind === "faq" ? "content.links.guide" : "content.links.faq")} →
        </Link>
      </p>
    </article>
  );
}

export const FaqPage = () => <ContentPage kind="faq" />;
export const GuidePage = () => <ContentPage kind="guide" />;
