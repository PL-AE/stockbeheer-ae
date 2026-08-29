import { vereisProfiel } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { notFound } from "next/navigation";
import Link from "next/link";
import { checkBeschikbaarheid } from "../actions";

export default async function ReservatieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profiel = await vereisProfiel();
  const { id } = await params;
  const supabase = await createClient();

  const { data: reservatie } = await supabase
    .from("reservations")
    .select(
      "id, evenement_naam, klant, locatie, laad_datum, retour_datum, status, periode_onbekend, notities"
    )
    .eq("id", id)
    .single();

  if (!reservatie) notFound();

  const { data: regels } = await supabase
    .from("reservation_lines")
    .select(
      "id, component_id, aantal, laad_datum, retour_datum, periode_onbekend, components(code, naam)"
    )
    .eq("reservation_id", id)
    .order("id", { ascending: true });

  // Voorraadmelding: voor elke regel met een gekende periode (regel-periode,
  // of anders de periode van de reservatie zelf) wordt live gecontroleerd of
  // het gevraagde aantal nog steeds past bij de rest van de reserveringen —
  // deze reservatie zelf wordt daarbij uitgesloten van de telling. Regels
  // zonder gekende periode kunnen niet gecontroleerd worden. Componenten
  // waarvan de code met "X_" begint zijn nota's voor de magazijnier (bv.
  // "X_25x THIN PIPES") en zijn niet aan echte voorraad gekoppeld — die
  // worden nooit meegeteld in de beschikbaarheidscheck.
  const controles = await Promise.all(
    (regels ?? []).map(async (r) => {
      const comp = Array.isArray(r.components) ? r.components[0] : r.components;
      const naam = comp ? `${comp.code} — ${comp.naam}` : `component #${r.component_id}`;
      const isNota = (comp?.code ?? "").toUpperCase().startsWith("X_");

      if (isNota) {
        return { regelId: r.id, naam, soort: "nota" as const };
      }

      const van = r.periode_onbekend
        ? null
        : (r.laad_datum ?? (!reservatie.periode_onbekend ? reservatie.laad_datum : null));
      const tot = r.periode_onbekend
        ? null
        : (r.retour_datum ?? (!reservatie.periode_onbekend ? reservatie.retour_datum : null));

      if (!van || !tot) {
        return { regelId: r.id, naam, soort: "onbekende_periode" as const };
      }

      const resultaat = await checkBeschikbaarheid(r.component_id, van, tot, r.aantal, reservatie.id);
      return { regelId: r.id, naam, soort: "gecontroleerd" as const, ...resultaat };
    })
  );

  const gecontroleerd = controles.filter((c) => c.soort === "gecontroleerd");
  const nietControleerbaar = controles.filter((c) => c.soort === "onbekende_periode").length;
  const metFout = gecontroleerd.filter((c) => "fout" in c && c.fout);
  const metTekort = gecontroleerd.filter(
    (c) => "data" in c && !("fout" in c && c.fout) && c.data.length > 0
  );

  // Eén van vijf toestanden voor de voorraadmelding-banner; null = geen
  // banner tonen (bv. als de reservatie enkel nota-componenten bevat).
  const bannerSoort: "fout" | "tekort" | "onbekend" | "ok" | null =
    metFout.length > 0
      ? "fout"
      : metTekort.length > 0
        ? "tekort"
        : gecontroleerd.length === 0 && nietControleerbaar === 0
          ? null
          : gecontroleerd.length === 0
            ? "onbekend"
            : "ok";

  return (
    <div className="min-h-screen">
      <Nav profiel={profiel} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">{reservatie.evenement_naam}</h1>
          {profiel.rol === "verkoop" && (
            <Link
              href={`/reservaties/${id}/bewerken`}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Bewerken
            </Link>
          )}
        </div>
        <p className="mb-6 text-sm text-slate-500">
          {reservatie.klant ? `${reservatie.klant} — ` : ""}
          {reservatie.periode_onbekend
            ? "periode onbekend"
            : `${reservatie.laad_datum} t/m ${reservatie.retour_datum}`}
          {" — "}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {reservatie.status}
          </span>
        </p>

        {bannerSoort && (
          <div className="mb-6">
            {bannerSoort === "fout" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                De voorraad kon niet voor alle componenten gecontroleerd worden (technische fout).
                Ververs de pagina om het opnieuw te proberen.
              </div>
            )}
            {bannerSoort === "tekort" && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="mb-2 text-sm font-medium text-red-800">
                  ⚠ Tekort voor {metTekort.length}{" "}
                  {metTekort.length === 1 ? "component" : "componenten"} in deze periode:
                </p>
                <ul className="space-y-1 text-sm text-red-700">
                  {metTekort.map((c) => {
                    if (!("data" in c)) return null;
                    const ergste = c.data.reduce((max, d) => (d.tekort > max.tekort ? d : max));
                    return (
                      <li key={c.regelId}>
                        {c.naam} — {ergste.tekort} stuks te weinig (bv. op {ergste.dag})
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {bannerSoort === "onbekend" && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Periode onbekend — de voorraadbeschikbaarheid kan niet gecontroleerd worden.
              </div>
            )}
            {bannerSoort === "ok" && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                ✓ Alle componenten zijn voorradig voor deze periode.
                {nietControleerbaar > 0 && (
                  <span className="text-emerald-700">
                    {" "}
                    ({nietControleerbaar} regel{nietControleerbaar === 1 ? "" : "s"} niet
                    gecontroleerd wegens onbekende periode.)
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Component</th>
                <th className="px-4 py-2 text-right">Aantal</th>
                <th className="px-4 py-2">Periode</th>
              </tr>
            </thead>
            <tbody>
              {(regels ?? []).map((r) => {
                const comp = Array.isArray(r.components) ? r.components[0] : r.components;
                const isNota = (comp?.code ?? "").toUpperCase().startsWith("X_");
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{comp?.code}</td>
                    <td className="px-4 py-2 text-slate-900">
                      {comp?.naam}
                      {isNota && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase text-slate-500">
                          nota
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.aantal}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {r.periode_onbekend
                        ? "onbekend"
                        : r.laad_datum
                          ? `${r.laad_datum} t/m ${r.retour_datum}`
                          : "zoals evenement"}
                    </td>
                  </tr>
                );
              })}
              {(!regels || regels.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    Geen componentregels.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">{regels?.length ?? 0} componentregels.</p>
      </main>
    </div>
  );
}
