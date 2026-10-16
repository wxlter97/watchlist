import { Link } from "react-router";
import { useLang } from "../../lib/i18n";
import { usePageMeta } from "../../lib/meta";

// Páginas de contenido público (preguntas frecuentes, guía, acerca de, contacto y la API). El texto
// vive en locales/ (content.*) y api/page.ts lo sirve también como HTML y Markdown para buscadores
// y modelos de IA (con JSON-LD en la FAQ).

export type ContentKind = "faq" | "guide" | "about" | "contact" | "developers";
type Kind = ContentKind;

/** A qué página enlaza el pie de cada una (mismo orden que api/_lib/seo.ts). */
export const NEXT_PAGE: Record<Kind, Kind> = { faq: "guide", guide: "faq", about: "contact", contact: "developers", developers: "about" };

interface Section {
  id?: string;
  h: string;
  p: string[];
  code?: string;
}

const EMAIL = /([\w.+-]+@[\w-]+\.[\w.]+\w)/;

/** El correo de contacto, como link. */
function Text({ text }: { text: string }) {
  return text.split(EMAIL).map((part, i) =>
    i % 2 ? (
      <a key={i} href={`mailto:${part}`} className="underline">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export function ContentPage({ kind }: { kind: Kind }) {
  const { t } = useLang();
  const base = `content.${kind}`;
  usePageMeta({ title: t("meta.pageTitle", { page: t(`${base}.title`) }), description: t(`${base}.description`), canonical: `/${kind}` }, t("meta.siteDescription"));

  const entries: Section[] =
    kind === "faq"
      ? (t(`${base}.items`, { returnObjects: true }) as unknown as { q: string; a: string }[]).map((i) => ({ h: i.q, p: [i.a] }))
      : (t(`${base}.sections`, { returnObjects: true }) as unknown as Section[]);
  const next = NEXT_PAGE[kind];

  return (
    <article className="max-w-3xl space-y-8 pt-6">
      <header>
        <h1 className="display text-[39px]">{t(`${base}.title`)}</h1>
        <p className="mt-3 max-w-[62ch] leading-[1.55] text-fg-soft">{t(`${base}.intro`)}</p>
      </header>
      {entries.map((e) => (
        <section key={e.h} id={e.id} className="space-y-2">
          <h2 className="display text-[22px]">{e.h}</h2>
          {e.p.map((text) => (
            <p key={text} className="max-w-[70ch] leading-[1.6] text-fg-soft">
              <Text text={text} />
            </p>
          ))}
          {e.code && (
            <pre className="max-w-[70ch] overflow-x-auto border-2 border-line-soft p-3 font-mono text-xs leading-[1.5]">
              <code>{e.code}</code>
            </pre>
          )}
        </section>
      ))}
      <p className="border-t-2 border-line-soft pt-6">
        <Link to={`/${next}`} className="text-link uppercase">
          {t(`content.links.${next}`)} →
        </Link>
      </p>
    </article>
  );
}

export const FaqPage = () => <ContentPage kind="faq" />;
export const GuidePage = () => <ContentPage kind="guide" />;
export const AboutPage = () => <ContentPage kind="about" />;
export const ContactPage = () => <ContentPage kind="contact" />;
export const DevelopersPage = () => <ContentPage kind="developers" />;
