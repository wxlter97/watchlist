import { useLang } from "../lib/i18n";
import { toggleFollow, useSettings } from "../lib/settings";

/** Seguir / dejar de seguir una franquicia. `compact` va dentro de una cabecera de acento. */
export function FollowButton({ franchiseId, compact = false }: { franchiseId: string; compact?: boolean }) {
  const { t } = useLang();
  const following = useSettings((s) => s.followedFranchises.includes(franchiseId));

  return (
    <button
      type="button"
      aria-pressed={following}
      onClick={(e) => {
        e.preventDefault();
        toggleFollow(franchiseId);
      }}
      className={
        compact
          ? `min-h-8 border-2 border-current px-2 py-0.5 font-mono text-[10px] font-bold tracking-[0.1em] uppercase transition-colors duration-[120ms] ease-out ${
              following ? "bg-on-accent text-accent" : "hover:bg-on-accent hover:text-accent"
            }`
          : `min-h-11 border-2 px-4 py-2 font-mono text-xs font-bold tracking-[0.1em] uppercase transition-colors duration-[120ms] ease-out ${
              following
                ? "border-on-accent bg-on-accent text-accent"
                : "border-on-accent text-on-accent hover:bg-on-accent hover:text-accent"
            }`
      }
    >
      {following ? `✓ ${t("follow.following")}` : `+ ${t("follow.follow")}`}
    </button>
  );
}
