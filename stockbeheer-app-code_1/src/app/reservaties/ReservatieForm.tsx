"use client";

import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import { checkBeschikbaarheid, maakReservatie, type TekortDag } from "./actions";

type Component = { id: number; code: string; naam: string; categorie: string };

type Regel = {
  tempId: string;
  component_id: number;
  code: string;
  naam: string;
  aantal: number;
  checking: boolean;
  tekortDagen: TekortDag[] | null;
  fout?: string;
};

export function ReservatieForm({
  componenten,
  bestaandeReservationId,
}: {
  componenten: Component[];
  bestaandeReservationId?: number;
}) {
  const [evenementNaam, setEvenementNaam] = useState("");
  const [klant, setKlant] = useState("");
  const [locatie, setLocatie] = useState("");
  const [laadDatum, setLaadDatum] = useState("");
  const [retourDatum, setRetourDatum] = useState("");
  const [status, setStatus] = useState("bevestigd");
  const [regels, setRegels] = useState<Regel[]>([]);
  const [zoek, setZoek] = useState("");
  const [algemeneFout, setAlgemeneFout] = useState<string | null>(null);
  const [bevestigOndanksTekort, setBevestigOndanksTekort] = useState(false);
  const [isPending, startTransition] = useTransition();
  const checkTeller = useRef(0);

  const zoekResultaten = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    if (!q) return [];
    return componenten
      .filter((c) => c.code.toLowerCase().includes(q) || c.naam.toLowerCase().includes(q))
      .slice(0, 15);
  }, [componenten, zoek]);

  function voegRegelToe(c: Component) {
    setRegels((prev) => [
      ...prev,
      {
        tempId: `${c.id}-${Date.now()}`,
        component_id: c.id,
        code: c.code,
        naam: c.naam,
        aantal: 1,
        checking: false,
        tekortDagen: null,
      },
    ]);
    setZoek("");
  }

  function verwijderRegel(tempId: string) {
    setRegels((prev) => prev.filter((r) => r.tempId !== tempId));
  }

  function wijzigAantal(tempId: string, aantal: number) {
    setRegels((prev) => prev.map((r) => (r.tempId === tempId ? { ...r, aantal } : r)));
  }

  // Live beschikbaarheidscheck: telkens header-periode of een regel wijzigt.
  useEffect(() => {
    if (!laadDatum || !retourDatum || regels.length === 0) return;
    const huidigeCheck = ++checkTeller.current;

    (async () => {
      setRegels((prev) => prev.map((r) => ({ ...r, checking: true })));
      const resultaten = await Promise.all(
        regels.map(async (r) => {
          const res = await checkBeschikbaarheid(
            r.component_id,
            laadDatum,
            retourDatum,
            r.aantal,
            bestaandeReservationId
          );
          return { tempId: r.tempId, res };
        })
      );
      if (huidigeCheck !== checkTeller.current) return; // een nieuwere check is intussen gestart
      setRegels((prev) =>
        prev.map((r) => {
          const gevonden = resultaten.find((x) => x.tempId === r.tempId);
          if (!gevonden) return r;
          return {
            ...r,
            checking: false,
            tekortDagen: gevonden.res.data,
            fout: gevonden.res.fout,
          };
        })
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laadDatum, retourDatum, JSON.stringify(regels.map((r) => [r.component_id, r.aantal]))]);

  const heeftTekorten = regels.some((r) => (r.tekortDagen?.length ?? 0) > 0);
  const klaarOmTeBewaren =
    evenementNaam.trim() !== "" &&
    laadDatum !== "" &&
    retourDatum !== "" &&
    regels.length > 0 &&
    (!heeftTekorten || bevestigOndanksTekort);

  async function bewaar() {
    setAlgemeneFout(null);
    startTransition(async () => {
      const result = await maakReservatie({
        evenement_naam: evenementNaam,
        klant,
        locatie,
        laad_datum: laadDatum,
        retour_datum: retourDatum,
        status,
        regels: regels.map((r) => ({ component_id: r.component_id, aantal: r.aantal })),
      });
      // maakReservatie redirect't bij succes; komt hier enkel terug bij een fout.
      if (result?.fout) {
        setAlgemeneFout(result.fout);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Evenement</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-600">Evenementnaam *</label>
            <input
              value={evenementNaam}
              onChange={(e) => setEvenementNaam(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Klant</label>
            <input
              value={klant}
              onChange={(e) => setKlant(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Locatie</label>
            <input
              value={locatie}
              onChange={(e) => setLocatie(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="offerte">Offerte</option>
              <option value="bevestigd">Bevestigd</option>
              <option value="geladen">Geladen</option>
              <option value="onderweg">Onderweg</option>
              <option value="teruggekomen">Teruggekomen</option>
              <option value="afgesloten">Afgesloten</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Laaddatum *</label>
            <input
              type="date"
              value={laadDatum}
              onChange={(e) => setLaadDatum(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Retourdatum *</label>
            <input
              type="date"
              value={retourDatum}
              onChange={(e) => setRetourDatum(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Componenten</h2>

        <div className="relative mb-4">
          <input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek component op code of naam om toe te voegen…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          {zoekResultaten.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
              {zoekResultaten.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => voegRegelToe(c)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span>
                    <span className="font-mono text-xs text-slate-400">{c.code}</span>{" "}
                    <span className="text-slate-900">{c.naam}</span>
                  </span>
                  <span className="text-xs text-slate-400">{c.categorie}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {!laadDatum || !retourDatum ? (
          <p className="mb-3 text-xs text-amber-600">
            Vul eerst laad- en retourdatum in zodat de beschikbaarheid live gecontroleerd kan
            worden.
          </p>
        ) : null}

        <div className="divide-y divide-slate-100">
          {regels.map((r) => (
            <div key={r.tempId} className="flex items-center gap-3 py-2">
              <div className="flex-1">
                <span className="font-mono text-xs text-slate-400">{r.code}</span>{" "}
                <span className="text-sm text-slate-900">{r.naam}</span>
              </div>
              <input
                type="number"
                min={1}
                value={r.aantal}
                onChange={(e) => wijzigAantal(r.tempId, Math.max(1, Number(e.target.value)))}
                className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
              <div className="w-64 text-xs">
                {r.checking && <span className="text-slate-400">controleren…</span>}
                {!r.checking && r.fout && <span className="text-red-600">Fout: {r.fout}</span>}
                {!r.checking && !r.fout && r.tekortDagen && r.tekortDagen.length === 0 && (
                  <span className="text-emerald-600">✓ voldoende beschikbaar</span>
                )}
                {!r.checking && !r.fout && r.tekortDagen && r.tekortDagen.length > 0 && (
                  <span className="text-red-600">
                    Tekort: {Math.max(...r.tekortDagen.map((d) => d.tekort))} stuks te weinig
                    (bv. {r.tekortDagen[0].dag})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => verwijderRegel(r.tempId)}
                className="text-xs text-slate-400 hover:text-red-600"
              >
                verwijderen
              </button>
            </div>
          ))}
          {regels.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">
              Nog geen componenten toegevoegd.
            </p>
          )}
        </div>
      </div>

      {heeftTekorten && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-medium text-red-800">
            Er is een tekort voor één of meerdere componenten in deze periode.
          </p>
          <label className="flex items-center gap-2 text-sm text-red-700">
            <input
              type="checkbox"
              checked={bevestigOndanksTekort}
              onChange={(e) => setBevestigOndanksTekort(e.target.checked)}
            />
            Ik weet het en wil toch reserveren met dit tekort.
          </label>
        </div>
      )}

      {algemeneFout && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {algemeneFout}
        </div>
      )}

      <button
        type="button"
        disabled={!klaarOmTeBewaren || isPending}
        onClick={bewaar}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? "Bezig met opslaan…" : "Reservatie bewaren"}
      </button>
    </div>
  );
}
