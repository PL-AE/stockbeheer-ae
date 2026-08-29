import { vereisProfiel } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import Link from "next/link";

const STATUS_KLEUR: Record<string, string> = {
  offerte: "bg-slate-100 text-slate-600",
  bevestigd: "bg-blue-100 text-blue-700",
  geladen: "bg-amber-100 text-amber-700",
  onderweg: "bg-amber-100 text-amber-700",
  teruggekomen: "bg-emerald-100 text-emerald-700",
  afgesloten: "bg-slate-100 text-slate-500",
};

export default async function ReservatiesPage() {
  const profiel = await vereisProfiel();
  const supabase = await createClient();

  const { data: reservaties } = await supabase
    .from("reservations")
    .select("id, evenement_naam, klant, laad_datum, retour_datum, status, periode_onbekend")
    .order("laad_datum", { ascending: false, nullsFirst: false })
    .limit(200);

  return (
    <div className="min-h-screen">
      <Nav profiel={profiel} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Reservaties</h1>
            <p className="text-sm text-slate-500">Meest recente 200 (op laaddatum).</p>
          </div>
          {profiel.rol === "verkoop" && (
            <Link
              href="/reservaties/nieuw"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              + Nieuwe reservatie
            </Link>
          )}
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Evenement</th>
                <th className="px-4 py-2">Klant</th>
                <th className="px-4 py-2">Laaddatum</th>
                <th className="px-4 py-2">Retourdatum</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(reservaties ?? []).map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/reservaties/${r.id}`} className="text-slate-900 hover:underline">
                      {r.evenement_naam}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.klant || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.periode_onbekend ? (
                      <span className="text-slate-400">periode onbekend</span>
                    ) : (
                      r.laad_datum
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.periode_onbekend ? "—" : r.retour_datum}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${STATUS_KLEUR[r.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(!reservaties || reservaties.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Geen reservaties gevonden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
