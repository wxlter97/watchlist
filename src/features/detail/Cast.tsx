import { SectionLabel } from "../../components/ui";
import { creditsUrl, useRemote, type CastMember, type CreditsResponse } from "../../lib/api";
import { useLang } from "../../lib/i18n";
import { profileUrl } from "../../lib/tmdb";
import type { Title } from "../../lib/types";

export function Cast({ title }: { title: Title }) {
  const { t } = useLang();
  const remote = useRemote<CreditsResponse>(creditsUrl(title));

  return (
    <section className="mt-8">
      <SectionLabel>{t("cast.title")}</SectionLabel>
      {remote.state === "loading" && <p className="font-mono text-xs text-muted">{t("cast.loading")}</p>}
      {remote.state === "error" && <p className="text-sm text-fg-soft">{t(navigator.onLine ? "cast.error" : "cast.offline")}</p>}
      {remote.state === "ok" &&
        (remote.data.cast.length === 0 ? (
          <p className="text-sm text-fg-soft">{t("cast.none")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {remote.data.cast.map((person) => (
              <CastCard key={person.id} person={person} />
            ))}
          </ul>
        ))}
    </section>
  );
}

function CastCard({ person }: { person: CastMember }) {
  const { t } = useLang();
  const src = profileUrl(person.profilePath);
  return (
    <li className="flex flex-col border-2 border-line bg-surface">
      <div className="relative aspect-[2/3] border-b-2 border-line bg-surface-muted">
        {src ? (
          <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <div aria-hidden className="display grid size-full place-items-center text-[39px] text-muted">
            {person.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-sm leading-snug font-semibold">{person.name}</p>
        {person.character && <p className="mt-0.5 text-[13px] leading-snug text-fg-soft">{person.character}</p>}
        {person.episodes && <p className="mt-1 font-mono text-[11px] text-muted uppercase">{t("cast.episodes", { count: person.episodes })}</p>}
      </div>
    </li>
  );
}
