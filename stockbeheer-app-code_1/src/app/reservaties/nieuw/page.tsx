import { vereisProfiel } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { ReservatieForm } from "../ReservatieForm";
import { redirect } from "next/navigation";

export default async function NieuweReservatiePage() {
  const profiel = await vereisProfiel();

  if (profiel.rol !== "verkoop") {
    redirect("/reservaties");
  }

  const supabase = await createClient();
  const { data: componenten } = await supabase
    .from("components")
    .select("id, code, naam, categorie")
    .order("categorie", { ascending: true })
    .order("naam", { ascending: true });

  return (
    <div className="min-h-screen">
      <Nav profiel={profiel} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-6 text-lg font-semibold text-slate-900">Nieuwe reservatie</h1>
        <ReservatieForm componenten={componenten ?? []} />
      </main>
    </div>
  );
}
