import { Navigate, useParams } from "react-router";
import { useCatalog, withReferences } from "../../lib/catalog";
import { Missing } from "../../components/Missing";
import { useLang } from "../../lib/i18n";
import { curatedPrep } from "../../lib/prep";
import { PrepView } from "./PrepView";

/** /f/:franchiseId/prep/:titleId — "Prepárate para…" de cualquier título de la franquicia. */
export function PrepPage() {
  const { franchiseId, titleId = "" } = useParams();
  const { t } = useLang();
  const { index, ready } = useCatalog(withReferences(franchiseId));
  const franchise = franchiseId ? index.franchisesById.get(franchiseId) : undefined;
  const target = index.titlesById.get(titleId);

  if (!ready) return <p className="py-16 text-center text-muted">…</p>;
  if (!franchise || !target || !franchise.entries.some((e) => e.titleId === titleId)) {
    return <Missing message={t("routes.notFound")} />;
  }
  // Si hay una ruta curada para ese título, su página es la de siempre (con los mismos niveles).
  const route = curatedPrep(franchise, titleId);
  if (route) return <Navigate to={`/f/${franchise.id}/r/${route.id}${location.search}`} replace />;
  return <PrepView franchise={franchise} target={target} index={index} />;
}
