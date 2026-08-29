import { vereisProfiel } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";

type DagBeschikbaarheid = {
  dag: string;
  totaal_stock: number;
  gereserveerd: number;
  beschikbaar: number;
};

type Component = {
  id: number;
  code: string;
  naam: string;
  categorie: string;
  totaal_stock: number;
};

const MAX_COMPONENTEN = 30;
const MAX_DAGEN = 120;

function isoDatum(offsetDagen = 0): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offsetDagen);
  return d.toISOString().slice(0, 10);
}

function dagenTussen(van: string, tot: string): string[] {
  const dagen: string[] = [];
  const d = new Date(van + "T00:00:00Z");
  const eind = new Date(tot + "T00:00:00Z");
  while (d <= eind && dagen.length < MAX_DAGEN) {
    dagen.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dagen;
}

function kleurVoorBeschikbaar(beschikbaar: number, totaal: number): string {
  if (beschikbaar <= 0) return "bg-red-500";
  if (totaal > 0 && beschikbaar / totaal < 0.2) return "bg-amber-400";
  return "bg-emerald-500";
}

const MAAND_NAMEN = [
  "jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec",
];

export default async function VoorraadKalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string; van?: string; tot?: string }>;
}) {
  const profiel = await vereisProfiel();
  const sp = await searchParams;
  const supabase = await createClient();

  const van = sp.van || isoDatum(0);
  const tot = sp.tot || isoDatum(60);
  const categorie = sp.categorie || "";

  const { data: alleComponenten } = await supabase
    .from("v_stock_current")
    .select("component_id, code, naam, categorie, totaal_stock")
    .order("categorie", { ascending: true })
    .order("code", { ascending: true });

  const componentenLijst: Component[] = (alleComponenten ?? []).map((c) => ({
    id: c.component_id,
    code: c.code,
    naam: c.naam,
    categorie: c.categorie,
    totaal_stock: c.totaal_stock,
  }));

  const categorieen = [...new Set(componentenLijst.map((c) => c.categorie))].sort();

  const teTonen: Component[] = categorie
    ? [...componentenLijst.filter((c) => c.categorie === categorie)]
        .sort((a, b) => a.totaal_stock - b.totaal_stock)
        .slice(0, MAX_COMPONENTEN * 2)
    : [...componentenLijst].sort((a, b) => a.totaal_stock - b.totaal_stock).slice(0, MAX_COMPONENTEN);

  const dagen = tot >= van ? dagenTussen(van, tot) : [];
  const totaalDagenRuw =
    tot >= van
      ? Math.floor(
          (new Date(tot + "T00:00:00Z").getTime() - new Date(van + "T00:00:00Z").getTime()) /
            86400000
        ) + 1
      : 0;
  const periodeBeperkt = totaalDagenRuw > MAX_DAGEN;

  const resultaten = await Promise.all(
    teTonen.map(async (c) => {
      if (dagen.length === 0) return { component: c, dagen: [] as DagBeschikbaarheid[], fout: undefined as string | undefined };
      const { data, error } = await supabase.rpc("fn_beschikbaarheid", {
        p_component_id: c.id,
        p_van: van,
        p_tot: tot,
      });
      return { component: c, dagen: (data as DagBeschikbaarheid[]) ?? [], fout: error?.message };
    })
  );

  // Maandkoppen voor de tabelheader: opeenvolgende dagen in dezelfde maand
  // worden gegroepeerd onder één kolomkop (colSpan).
  const maandGroepen: { label: string; aantal: number }[] = [];
  for (const dag of dagen) {
    const [jaar, maandNr] = dag.split("-");
    const label = `${MAAND_NAMEN[Number(maandNr) - 1]} ${jaar}`;
    const
