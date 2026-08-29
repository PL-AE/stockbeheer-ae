// Zuiver server-rendered kolomgrafiek (geen client-JS/chart-library nodig):
// smalle horizontale balken, breedte relatief t.o.v. de hoogste voorraad
// over alle componenten, zodat "veel" en "weinig" meteen visueel duidelijk
// zijn. Bovenaan de aandachtspunten (laagste voorraad), daaronder het
// volledige overzicht per categorie.

type Component = {
  component_id: number;
  code: string;
  naam: string;
  categorie: string;
  totaal_stock: number;
};

const AANTAL_AANDACHTSPUNTEN = 15;

function kleurVoorStock(stock: number): string {
  if (stock <= 0) return "bg-red-500";
  if (stock < 10) return "bg-amber-500";
  return "bg-slate-700";
}

function Balk({ c, max }: { c: Component; max: number }) {
  const breedte =
    max > 0 ? Math.max((c.totaal_stock / max) * 100, c.totaal_stock > 0 ? 1.5 : 0) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-64 shrink-0 truncate text-xs text-slate-600">
        <span className="font-mono text-[11px] text-slate-400">{c.code}</span> {c.naam}
      </div>
      <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
        <div
          className={`h-full rounded ${kleurVoorStock(c.totaal_stock)}`}
          style={{ width: `${breedte}%` }}
        />
      </div>
      <div className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-500">
        {c.totaal_stock}
      </div>
    </div>
  );
}

export function VoorraadGrafiek({ componenten }: { componenten: Component[] }) {
  if (componenten.length === 0) return null;

  const max = componenten.reduce((m, c) => Math.max(m, c.totaal_stock), 0);

  const aandachtspunten = [...componenten]
    .sort((a, b) => a.totaal_stock - b.totaal_stock)
    .slice(0, AANTAL_AANDACHTSPUNTEN);

  const perCategorie = new Map<string, Component[]>();
  for (const c of componenten) {
    const lijst = perCategorie.get(c.categorie) ?? [];
    lijst.push(c);
    perCategorie.set(c.categorie, lijst);
  }
  const categorieen = [...perCategorie.keys()].sort();

  return (
    <div className="mb-8 space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">
          Aandachtspunten — laagste voorraad
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          De {AANTAL_AANDACHTSPUNTEN} componenten met de minste voorraad, over alle categorieën
          heen. Rood = op, oranje = minder dan 10 stuks.
        </p>
        <div>
          {aandachtspunten.map((c) => (
            <Balk key={c.component_id} c={c} max={max} />
          ))}
        </div>
      </div>

      <details className="rounded-lg border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          Volledig overzicht per categorie ({componenten.length} componenten)
        </summary>
        <p className="mb-4 mt-1 text-xs text-slate-500">
          Alle componenten, per categorie gesorteerd van laag naar hoog.
        </p>
        <div className="space-y-6">
          {categorieen.map((cat) => {
            const lijst = [...(perCategorie.get(cat) ?? [])].sort(
              (a, b) => a.totaal_stock - b.totaal_stock
            );
            return (
              <div key={cat}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {cat}{" "}
                  <span className="font-normal normal-case text-slate-300">
                    ({lijst.length})
                  </span>
                </h3>
                {lijst.map((c) => (
                  <Balk key={c.component_id} c={c} max={max} />
                ))}
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
