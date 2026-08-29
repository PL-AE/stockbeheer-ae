"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importeerComponenten, type ImportResultaat } from "./actions";

export function ComponentenImport() {
  const [resultaat, setResultaat] = useState<ImportResultaat | null>(null);
  const [bestandsnaam, setBestandsnaam] = useState<string | null>(null);
  const [bezig, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function verwerkBestand(bestand: File) {
    setBestandsnaam(bestand.name);
    setResultaat(null);
    const lezer = new FileReader();
    lezer.onload = () => {
      const tekst = String(lezer.result ?? "");
      startTransition(async () => {
        const res = await importeerComponenten(tekst);
        setResultaat(res);
        if (!res.fout) {
          router.refresh();
        }
      });
    };
    lezer.readAsText(bestand, "utf-8");
  }

  return (
    <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">CSV importeren</h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Kolommen: <span className="font-mono">code, naam, categorie, eenheid,
            inkoopprijs, kostprijs_afgewerkt_product, notities, status, aantal</span>. Enkel
            code en naam zijn verplicht. Bestaat de code al, dan wordt dat component
            bijgewerkt. De kolom &ldquo;aantal&rdquo; is optioneel en zet enkel een
            startvoorraad bij een <strong>nieuw</strong> component — bij een bestaand
            component wijzigt de voorraad hierdoor niet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={bezig}
          className="shrink-0 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {bezig ? "Bezig met verwerken…" : "CSV-bestand kiezen"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const bestand = e.target.files?.[0];
            if (bestand) verwerkBestand(bestand);
            e.target.value = "";
          }}
        />
      </div>

      {bezig && bestandsnaam && (
        <p className="mt-2 text-xs text-slate-500">{bestandsnaam} wordt verwerkt…</p>
      )}

      {resultaat && (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          {resultaat.fout ? (
            <p className="text-red-700">{resultaat.fout}</p>
          ) : (
            <>
              <p className="text-emerald-700">
                {resultaat.toegevoegd} nieuw toegevoegd, {resultaat.bijgewerkt} bijgewerkt
                {resultaat.startsaldoAangemaakt > 0
                  ? `, startvoorraad gezet voor ${resultaat.startsaldoAangemaakt} nieuwe componenten`
                  : ""}
                .
              </p>
              {resultaat.overgeslagen.length > 0 && (
                <div className="mt-2">
                  <p className="text-amber-700">
                    {resultaat.overgeslagen.length} rij(en) overgeslagen:
                  </p>
                  <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
                    {resultaat.overgeslagen.slice(0, 20).map((o, i) => (
                      <li key={i}>
                        Regel {o.regel}: {o.reden}
                      </li>
                    ))}
                  </ul>
                  {resultaat.overgeslagen.length > 20 && (
                    <p className="mt-1 text-xs text-slate-400">
                      … en {resultaat.overgeslagen.length - 20} meer.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
