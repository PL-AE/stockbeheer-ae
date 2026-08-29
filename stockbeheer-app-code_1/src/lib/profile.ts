import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Rol = "verkoop" | "planning" | "magazijn" | "directie";

export type Profiel = {
  id: string;
  naam: string | null;
  rol: Rol;
};

/**
 * Haalt de ingelogde gebruiker + zijn profiel (rol) op. Stuurt door naar
 * /login als niemand ingelogd is. Gebruik dit bovenaan elke beveiligde
 * Server Component / Server Action.
 */
export async function vereisProfiel(): Promise<Profiel> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Tijdelijke diagnose: vergelijk wat de client denkt dat de user.id is met
  // wat de database via auth.uid() ziet tijdens deze zelfde aanvraag. Bij een
  // mismatch (of null) ligt het probleem bij de sessie/JWT, niet bij de data
  // of de policy zelf.
  const { data: dbUid, error: dbUidError } = await supabase.rpc("fn_debug_auth_uid");
  console.error("vereisProfiel diagnose: client user.id =", user.id, "| db auth.uid() =", dbUid, "| rpc error =", dbUidError);

  const { data: profiel, error } = await supabase
    .from("profiles")
    .select("id, naam, rol")
    .eq("id", user.id)
    .single();

  if (error || !profiel) {
    // Ingelogd bij Supabase Auth, maar nog geen rij in profiles: kan gebeuren
    // net na het aanmaken van een gebruiker (zie setup-instructies).
    // Tijdelijk: log de echte reden in de servers logs (Vercel → Logs), zodat
    // een permissie- of RLS-fout niet verborgen blijft achter deze algemene
    // melding.
    console.error("vereisProfiel: profiel niet gevonden voor user", user.id, error);
    redirect("/login?fout=geen-profiel");
  }

  return profiel as Profiel;
}
