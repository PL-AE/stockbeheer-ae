"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type TekortDag = { dag: string; beschikbaar: number; tekort: number };

/**
 * Live beschikbaarheidscheck (Module B): roept de databasefunctie
 * fn_check_reservatie aan, die per dag in de periode teruggeeft of er een
 * tekort zou ontstaan voor het gevraagde aantal. Lege array = geen tekort.
 */
export async function checkBeschikbaarheid(
  componentId: number,
  van: string,
  tot: string,
  aantal: number,
  excludeReservationId?: number
): Promise<{ data: TekortDag[]; fout?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_check_reservatie", {
    p_component_id: componentId,
    p_van: van,
    p_tot: tot,
    p_gevraagd_aantal: aantal,
    p_exclude_reservation_id: excludeReservationId ?? null,
  });

  if (error) {
    return { data: [], fout: error.message };
  }
  return { data: (data as TekortDag[]) ?? [] };
}

export type NieuweRegel = {
  component_id: number;
  aantal: number;
  laad_datum?: string | null;
  retour_datum?: string | null;
};

export async function maakReservatie(input: {
  evenement_naam: string;
  klant: string;
  locatie: string;
  laad_datum: string;
  retour_datum: string;
  status: string;
  regels: NieuweRegel[];
}) {
  const supabase = await createClient();

  const { data: reservatie, error: resError } = await supabase
    .from("reservations")
    .insert({
      evenement_naam: input.evenement_naam,
      klant: input.klant || null,
      locatie: input.locatie || null,
      laad_datum: input.laad_datum,
      retour_datum: input.retour_datum,
      status: input.status,
    })
    .select("id")
    .single();

  if (resError || !reservatie) {
    return { fout: resError?.message ?? "Onbekende fout bij aanmaken reservatie." };
  }

  if (input.regels.length > 0) {
    const { error: lijnenError } = await supabase.from("reservation_lines").insert(
      input.regels.map((r) => ({
        reservation_id: reservatie.id,
        component_id: r.component_id,
        aantal: r.aantal,
        laad_datum: r.laad_datum || null,
        retour_datum: r.retour_datum || null,
      }))
    );

    if (lijnenError) {
      return {
        fout:
          `Reservatie '${input.evenement_naam}' is aangemaakt, maar de componentregels konden niet ` +
          `bewaard worden: ${lijnenError.message}. Open de reservatie en vul de regels manueel aan.`,
        reservationId: reservatie.id,
      };
    }
  }

  revalidatePath("/reservaties");
  redirect(`/reservaties/${reservatie.id}`);
}
