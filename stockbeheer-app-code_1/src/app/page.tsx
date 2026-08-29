import { vereisProfiel } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import Link from "next/link";

export default async function DashboardPage() {
  const profiel = await vereisProfiel();
  const supabase = await createClient();

  const vandaag = new Date().toISOString().slice(0, 10);

  const [{ count: aantalComponenten }, { count: aantalActieveReservaties }, { data: komendeReservaties }] =
    await Promise.all([
      supabase.from("components").select("id", { count: "exact", head: true }),
      supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .in("status", ["bevestigd", "geladen", "onderweg"])
        .gte("retour_datum", vandaag),
      supabase
        .from("reservations")
        .select("id, evenement_naam, klant, laad_datum, retour_datum, status")
        .in("status", ["bevestigd", "geladen", "onderweg"])
        .gte("retour_datum", vandaag)
        .order("laad_datum", { ascending: true })
        .limit(8),
    ]);

  return (
    <div className="min-h-screen">
      <Nav profiel={profiel} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-lg font-semibold text-slate-900">Dashboard</h1>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Componenten in databank</p>
            <p className="text-2xl font-semibold text-slate-900">{aantalComponenten ?? "—"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Actieve/komende reservaties</p>
            <p className="text-2xl font-semibold text-slate-900">{aantalActieveReservaties ?? "—"}</p>
          </div>
        </div>

        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Eerstvolgende reservaties
        </h2>
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
              {(komendeReservaties ?? []).map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/reservaties/${r.id}`} className="text-slate-900 hover:underline">
                      {r.evenement_naam}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.klant || "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{r.laad_datum}</td>
                  <td className="px-4 py-2 text-slate-600">{r.retour_datum}</td>
                  <td className="px-4 py-2 text-slate-600">{r.status}</td>
                </tr>
              ))}
              {(!komendeReservaties || komendeReservaties.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Geen komende reservaties.
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
