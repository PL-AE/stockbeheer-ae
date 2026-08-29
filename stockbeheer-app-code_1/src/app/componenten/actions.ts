"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const TOEGESTANE_IMPORT_ROLLEN = ["verkoop", "planning", "directie"];

const GELDIGE_CATEGORIEEN = [
  "Walls",
  "Legs & Pieces",
  "Roof",
  "Structures",
  "Finish",
  "Extra",
  "Onbekend",
];

// Kolomkoppen in het CSV-bestand mogen in deze varianten voorkomen; alles
// wordt herleid naar de kolomnaam in de database (rechterkant).
const HEADER_ALIASSEN: Record<string, string> = {
  code: "code",
  naam: "naam",
  name: "naam",
  categorie: "categorie",
  category: "categorie",
  eenheid: "eenheid",
  unit: "eenheid",
  inkoopprijs: "inkoopprijs",
  kostprijs: "kostprijs_afgewerkt_product",
  kostprijs_afgewerkt_product: "kostprijs_afgewerkt_product",
  "kostprijs afgewerkt product": "kostprijs_afgewerkt_product",
  notities: "notities",
  notitie: "notities",
  notes: "notities",
  status: "status",
  aantal: "aantal",
  voorraad: "aantal",
  startvoorraad: "aantal",
  stock: "aantal",
};

export type ImportResultaat = {
  fout?: string;
  toegevoegd: number;
  bijgewerkt: number;
  startsaldoAangemaakt: number;
  overgeslagen: { regel: number; reden: string }[];
};

function leegResultaat(): ImportResultaat {
  return { toegevoegd: 0, bijgewerkt: 0, startsaldoAangemaakt: 0, overgeslagen: [] };
}

function detecteerDelimiter(eersteLijn: string): string {
  const puntkomma = (eersteLijn.match(/;/g) || []).length;
  const komma = (eersteLijn.match(/,/g) || []).length;
  return puntkomma > komma ? ";" : ",";
}

// Kleine, zelfgeschreven CSV-parser (geen extra dependency nodig) die
// aanhalingstekens en meerdere delimiters ondersteunt — voldoende robuust
// voor een export vanuit Excel/Google Sheets.
function parseCsv(tekst: string, delimiter: string): string[][] {
  const rijen: string[][] = [];
  let rij: string[] = [];
  let veld = "";
  let inQuotes = false;
  const len = tekst.length;
  let i = 0;
  while (i < len) {
    const ch = tekst[i];
    if (inQuotes) {
      if (ch === '"') {
        if (tekst[i + 1] === '"') {
          veld += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        veld += ch;
        i += 1;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      rij.push(veld);
      veld = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      rij.push(veld);
      rijen.push(rij);
      rij = [];
      veld = "";
      i += 1;
      continue;
    }
    veld += ch;
    i += 1;
  }
  if (veld.length > 0 || rij.length > 0) {
    rij.push(veld);
    rijen.push(rij);
  }
  return rijen.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

// Ondersteunt zowel "1234.56" als het Belgische "1.234,56" / "1234,56".
function parseNummer(ruw: string): number | null {
  let s = ruw.trim().replace(/[€\s]/g, "");
  if (!s) return null;
  const heeftKomma = s.includes(",");
  const heeftPunt = s.includes(".");
  if (heeftKomma && heeftPunt) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (heeftKomma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseGeheelGetal(ruw: string): number | null {
  const n = parseNummer(ruw);
  if (n === null) return null;
  return Math.round(n);
}

function normaliseerCategorie(ruw: string): { categorie: string; teBevestigen: boolean } {
  const s = ruw.trim();
  if (!s) return { categorie: "Onbekend", teBevestigen: true };
  const match = GELDIGE_CATEGORIEEN.find((c) => c.toLowerCase() === s.toLowerCase());
  if (match) return { categorie: match, teBevestigen: false };
  return { categorie: "Onbekend", teBevestigen: true };
}

/**
 * Importeert componenten (stamgegevens) uit een CSV-bestand. Een rij met een
 * code die al bestaat werkt het bestaande component bij; een nieuwe code
 * voegt een nieuw component toe. De optionele kolom "aantal" wordt enkel
 * gebruikt om een startsaldo-voorraadbeweging aan te maken bij een NIEUW
 * component — bij een bestaand component wijzigt de voorraad hierdoor
 * bewust niet, zodat een herimport van hetzelfde bestand de voorraad niet
 * dubbel telt.
 */
export async function importeerComponenten(csvTekst: string): Promise<ImportResultaat> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ...leegResultaat(), fout: "Niet ingelogd." };
  }

  const { data: profiel } = await supabase
    .from("profiles")
    .select("rol, naam")
    .eq("id", user.id)
    .single();

  if (!profiel || !TOEGESTANE_IMPORT_ROLLEN.includes(profiel.rol)) {
    return { ...leegResultaat(), fout: "Je hebt geen rechten om componenten te importeren." };
  }

  const tekst = csvTekst.trim();
  if (!tekst) {
    return { ...leegResultaat(), fout: "Het bestand is leeg." };
  }

  const eersteLijn = tekst.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detecteerDelimiter(eersteLijn);
  const rijen = parseCsv(tekst, delimiter);

  if (rijen.length < 2) {
    return { ...leegResultaat(), fout: "Geen datarijen gevonden onder de kopregel." };
  }

  const kop = rijen[0].map((h) => h.trim().toLowerCase());
  const kolomVeld: (string | null)[] = kop.map((h) => HEADER_ALIASSEN[h] ?? null);

  if (!kolomVeld.includes("code") || !kolomVeld.includes("naam")) {
    return {
      ...leegResultaat(),
      fout:
        "Het CSV-bestand mist een verplichte kolom 'code' en/of 'naam'. Controleer de kolomkoppen.",
    };
  }

  const { data: bestaandeComponenten } = await supabase.from("components").select("id, code");

  const bestaandeMap = new Map<string, number>(
    (bestaandeComponenten ?? []).map((c) => [c.code.toLowerCase(), c.id])
  );

  type NieuweRij = {
    code: string;
    naam: string;
    categorie: string;
    categorie_te_bevestigen: boolean;
    eenheid: string;
    inkoopprijs: number | null;
    kostprijs_afgewerkt_product: number | null;
    notities: string | null;
    status: string | null;
    voorraad_nog_niet_geteld: boolean;
  };

  const teVerwerken = new Map<string, { rij: NieuweRij; aantal: number | null; regel: number }>();
  const overgeslagen: { regel: number; reden: string }[] = [];

  for (let r = 1; r < rijen.length; r++) {
    const cellen = rijen[r];
    if (cellen.every((c) => c.trim() === "")) continue;

    const waarden: Record<string, string> = {};
    kolomVeld.forEach((veld, idx) => {
      if (veld) waarden[veld] = (cellen[idx] ?? "").trim();
    });

    const code = waarden.code ?? "";
    const naam = waarden.naam ?? "";
    const regelnummer = r + 1;

    if (!code || !naam) {
      overgeslagen.push({ regel: regelnummer, reden: "code of naam ontbreekt" });
      continue;
    }

    const { categorie, teBevestigen } = normaliseerCategorie(waarden.categorie ?? "");
    const aantal = waarden.aantal ? parseGeheelGetal(waarden.aantal) : null;

    // Bij dubbele codes binnen hetzelfde bestand wint de laatste rij.
    teVerwerken.set(code.toLowerCase(), {
      regel: regelnummer,
      aantal,
      rij: {
        code,
        naam,
        categorie,
        categorie_te_bevestigen: teBevestigen,
        eenheid: waarden.eenheid || "stuk",
        inkoopprijs: waarden.inkoopprijs ? parseNummer(waarden.inkoopprijs) : null,
        kostprijs_afgewerkt_product: waarden.kostprijs_afgewerkt_product
          ? parseNummer(waarden.kostprijs_afgewerkt_product)
          : null,
        notities: waarden.notities || null,
        status: waarden.status || null,
        voorraad_nog_niet_geteld: aantal === null,
      },
    });
  }

  if (teVerwerken.size === 0) {
    return {
      ...leegResultaat(),
      overgeslagen,
      fout: "Geen enkele bruikbare rij gevonden in het bestand.",
    };
  }

  const payload = Array.from(teVerwerken.values()).map((v) => v.rij);

  const { data: verwerkt, error } = await supabase
    .from("components")
    .upsert(payload, { onConflict: "code" })
    .select("id, code");

  if (error) {
    return {
      ...leegResultaat(),
      overgeslagen,
      fout: `Import mislukt: ${error.message}`,
    };
  }

  let toegevoegd = 0;
  let bijgewerkt = 0;
  const vandaag = new Date().toISOString().slice(0, 10);
  const nieuweStartsaldos: {
    component_id: number;
    aantal: number;
    type: string;
    referentie: string;
    aangemaakt_door: string | null;
  }[] = [];

  for (const c of verwerkt ?? []) {
    const wasBestaand = bestaandeMap.has(c.code.toLowerCase());
    if (wasBestaand) {
      bijgewerkt++;
    } else {
      toegevoegd++;
      const info = teVerwerken.get(c.code.toLowerCase());
      if (info && info.aantal !== null) {
        nieuweStartsaldos.push({
          component_id: c.id,
          aantal: info.aantal,
          type: "startsaldo",
          referentie: `CSV-import ${vandaag}`,
          aangemaakt_door: profiel.naam ?? user.email ?? null,
        });
      }
    }
  }

  let startsaldoAangemaakt = 0;
  if (nieuweStartsaldos.length > 0) {
    const { data: ingevoegd } = await supabase
      .from("stock_movements")
      .insert(nieuweStartsaldos)
      .select("id");
    startsaldoAangemaakt = ingevoegd?.length ?? 0;
  }

  revalidatePath("/componenten");
  revalidatePath("/");

  return { toegevoegd, bijgewerkt, startsaldoAangemaakt, overgeslagen };
}
