import { vereisProfiel } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { ComponentenTabel } from "./ComponentenTabel";
import { VoorraadGrafiek } from "./VoorraadGrafiek";

export default async function ComponentenPage() {
  const profiel = await vereisProfiel();
  const supabase = await createClient();

  const { data: componenten } = await supabase
    .from("v_stock_current")
    .select("component_id, code, naam, categorie, totaal_stock")
    .order("categorie", { ascending: true })
    .order("code", { ascending: true });

  return (
    <div className="min-h-screen">
      <Nav profiel={profiel} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Componenten</h1>
        <p className="mb-6 text-sm text-slate-500">
          Actuele totale voorraad per component (som van alle voorraadbewegingen — nooit een
          handmatig cijfer).
        </p>
        <VoorraadGrafiek componenten={componenten ?? []} />
        <ComponentenTabel componenten={componenten ?? []} />
      </main>
    </div>
  );
}
