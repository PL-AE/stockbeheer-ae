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
    const laatste = maandGroepen[maandGroepen.length - 1];
    if (laatste && laatste.label === label) laatste.aantal++;
    else maandGroepen.push({ label, aantal: 1 });
  }

  return (
    <div className="min-h-screen">
      <Nav profiel={profiel} />
      <main className="mx-auto max-w-[1400px] px-4 py-8">
        <h1 className="mb-1 text-lg font-semibold text-slate-900">Voorraadkalender</h1>
        <p className="mb-6 text-sm text-slate-500">
          Beschikbare voorraad per dag, rekening houdend met bevestigde/geladen/onderweg
          reserveringen. Rood = geen beschikbaarheid meer, oranje = krap (minder dan 20% van de
          totale voorraad), groen = voldoende.
        </p>

        <form className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Componenten</label>
            <select
              name="categorie"
              defaultValue={categorie}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Aandachtspunten (laagste voorraad, max {MAX_COMPONENTEN})</option>
              {categorieen.map((c) => (
                <option key={c} value={c}>
                  Categorie: {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Van</label>
            <input
              type="date"
              name="van"
              defaultValue={van}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Tot</label>
            <input
              type="date"
              name="tot"
              defaultValue={tot}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Tonen
          </button>
        </form>

        {periodeBeperkt && (
          <p className="mb-3 text-xs text-amber-600">
            De gekozen periode is beperkt tot {MAX_DAGEN} dagen om de kalender leesbaar te houden.
          </p>
        )}

        {dagen.length === 0 ? (
          <p className="text-sm text-slate-500">Kies een geldige periode (van vóór of gelijk aan tot).</p>
        ) : teTonen.length === 0 ? (
          <p className="text-sm text-slate-500">Geen componenten gevonden voor deze selectie.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-1 text-left" />
                  {maandGroepen.map((m, i) => (
                    <th
                      key={i}
                      colSpan={m.aantal}
                      className="border-b border-l border-slate-200 bg-slate-50 px-1 py-1 text-center font-medium text-slate-500"
                    >
                      {m.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50 px-3 py-1 text-left font-medium text-slate-500">
                    Component
                  </th>
                  {dagen.map((d) => (
                    <th
                      key={d}
                      className="w-5 border-l border-slate-100 px-0 py-1 text-center font-normal text-slate-400"
                    >
                      {Number(d.slice(8, 10))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultaten.map(({ component, dagen: dagData, fout }) => (
                  <tr key={component.id} className="border-t border-slate-100">
                    <td className="sticky left-0 z-10 whitespace-nowrap border-r border-slate-200 bg-white px-3 py-1 text-slate-700">
                      <span className="font-mono text-[10px] text-slate-400">{component.code}</span>{" "}
                      {component.naam}
                    </td>
                    {fout
                      ? dagen.map((d) => (
                          <td
                            key={d}
                            className="border-l border-slate-100 bg-slate-100"
                            title="Kon niet opgehaald worden"
                          />
                        ))
                      : dagen.map((d) => {
                          const info = dagData.find((x) => x.dag === d);
                          const beschikbaar = info?.beschikbaar ?? 0;
                          const totaal = info?.totaal_stock ?? component.totaal_stock;
                          return (
                            <td
                              key={d}
                              className="border-l border-slate-100 p-0"
                              title={`${d}: ${beschikbaar} van ${totaal} beschikbaar`}
                            >
                              <div className={`h-5 w-5 ${kleurVoorBeschikbaar(beschikbaar, totaal)}`} />
                            </td>
                          );
                        })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-emerald-500" /> voldoende
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-amber-400" /> krap
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded bg-red-500" /> geen beschikbaarheid meer
          </span>
        </div>
      </main>
    </div>
  );
}
