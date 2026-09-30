import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next, useTranslation } from "react-i18next";
import es from "../locales/es.json";
import en from "../locales/en.json";
import type { Lang, LocalizedText, Title } from "./types";
import { updateSettings } from "./settings";

export const LANGS: readonly Lang[] = ["es", "en"];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es }, en: { translation: en } },
    supportedLngs: LANGS,
    nonExplicitSupportedLngs: true,
    fallbackLng: "es",
    interpolation: { escapeValue: false },
    detection: { order: ["localStorage", "navigator"], lookupLocalStorage: "watch-order:lang", caches: ["localStorage"] },
  });

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;

export function currentLang(lng: string | undefined): Lang {
  return lng?.startsWith("en") ? "en" : "es";
}

export function localize(text: LocalizedText | undefined, lang: Lang): string {
  if (text === undefined) return "";
  if (typeof text === "string") return text;
  return text[lang] ?? text.es ?? text.en ?? "";
}

export function titleName(title: Title, lang: Lang): string {
  return title.localized?.[lang]?.title ?? title.title;
}

export function titleOverview(title: Title, lang: Lang): string | undefined {
  return title.localized?.[lang]?.overview || title.overview || undefined;
}

/** Idioma activo y helpers ligados a él. */
export function useLang() {
  const { t, i18n: instance } = useTranslation();
  const lang = currentLang(instance.resolvedLanguage);
  return {
    t,
    lang,
    setLang: (l: Lang) => {
      void instance.changeLanguage(l);
      updateSettings({ language: l });
    },
    loc: (text: LocalizedText | undefined) => localize(text, lang),
    name: (title: Title) => titleName(title, lang),
    /** Nombre de una unidad de un orden: "Loki" o "Loki · Temporada 2". */
    unitName: (title: Title, season?: number) =>
      season === undefined ? titleName(title, lang) : `${titleName(title, lang)} · ${t("episodes.season", { number: season })}`,
    date: (iso: string) =>
      new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(iso)),
  };
}
