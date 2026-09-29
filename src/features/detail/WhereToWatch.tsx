import { SectionLabel } from "../../components/ui";
import { providersUrl, useRemote, type Provider, type ProvidersResponse } from "../../lib/api";
import { useLang } from "../../lib/i18n";
import { useSettings } from "../../lib/settings";
import type { Title } from "../../lib/types";

const OFFERS = ["flatrate", "free", "ads", "rent", "buy"] as const;

export function WhereToWatch({ title }: { title: Title }) {
  const { t } = useLang();
  const region = useSettings((s) => s.streamingRegion);
  const remote = useRemote<ProvidersResponse>(providersUrl(title, region));
  const regionName = new Intl.DisplayNames([t("meta.locale")], { type: "region" }).of(region) ?? region;

  return (
    <section className="mt-8">
      <SectionLabel>{t("providers.title", { region: regionName })}</SectionLabel>
      {remote.state === "loading" && <p className="font-mono text-xs text-muted">{t("providers.loading")}</p>}
      {remote.state === "error" && <p className="text-sm text-fg-soft">{t(navigator.onLine ? "providers.error" : "providers.offline")}</p>}
      {remote.state === "ok" &&
        (OFFERS.every((o) => remote.data[o].length === 0) ? (
          <p className="text-sm text-fg-soft">{t("providers.none")}</p>
        ) : (
          <div className="space-y-3 border-2 border-line bg-surface p-3.5">
            {OFFERS.map((offer) =>
              remote.data[offer].length ? (
                <div key={offer}>
                  <p className="label mb-1.5 text-muted">{t(`providers.offers.${offer}`)}</p>
                  <ul className="flex flex-wrap gap-2">
                    {remote.data[offer].map((p) => (
                      <ProviderChip key={p.id} provider={p} href={remote.data.link} />
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
            {/* Atribución requerida por TMDB para los datos de proveedores. */}
            <p className="border-t-2 border-line-soft pt-2 font-mono text-[10px] text-muted">{t("providers.attribution")}</p>
          </div>
        ))}
    </section>
  );
}

function ProviderChip({ provider, href }: { provider: Provider; href: string | null }) {
  const body = (
    <>
      <img src={`https://image.tmdb.org/t/p/w92${provider.logoPath}`} alt="" className="size-7 border border-line-soft" loading="lazy" />
      <span className="text-sm font-semibold">{provider.name}</span>
    </>
  );
  return (
    <li>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener"
          className="flex min-h-11 items-center gap-2 border-2 border-line-soft px-2 py-1 transition-colors duration-[120ms] ease-out hover:border-line"
        >
          {body}
        </a>
      ) : (
        <span className="flex min-h-11 items-center gap-2 border-2 border-line-soft px-2 py-1">{body}</span>
      )}
    </li>
  );
}
