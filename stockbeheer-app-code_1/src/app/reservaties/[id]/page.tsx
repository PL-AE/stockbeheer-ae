import { vereisProfiel } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { notFound } from "next/navigation";

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
    .select("id, aantal, laad_datum, retour_datum, periode_onbekend, components(code, naam)")
    .eq("reservation_id", id)
    .order("id", { ascending: true });

  return (
    <div className="min-h-screen">
      <Nav profiel={profiel} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">{reservatie.evenement_naam}</h1>
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
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{comp?.code}</td>
                    <td className="px-4 py-2 text-slate-900">{comp?.naam}</td>
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
