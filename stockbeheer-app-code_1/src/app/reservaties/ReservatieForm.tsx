"use client";

import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import { checkBeschikbaarheid, maakReservatie, wijzigReservatie, type TekortDag } from "./actions";
import { detecteerDelimiter, parseCsv, parseGeheelGetal } from "@/lib/csv";

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

export type BestaandeReservatie = {
  evenement_naam: string;
  klant: string | null;
  locatie: string | null;
  laad_datum: string;
  retour_datum: string;
  status: string;
  regels: { component_id: number; code: string; naam: string; aantal: number }[];
};

export function ReservatieForm({
  componenten,
  bestaandeReservationId,
  bestaandeReservatie,
}: {
  componenten: Component[];
  bestaandeReservationId?: number;
  bestaandeReservatie?: BestaandeReservatie;
}) {
  const [evenementNaam, setEvenementNaam] = useState(bestaandeReservatie?.evenement_naam ?? "");
  const [klant, setKlant] = useState(bestaandeReservatie?.klant ?? "");
  const [locatie, setLocatie] = useState(bestaandeReservatie?.locatie ?? "");
  const [laadDatum, setLaadDatum] = useState(bestaandeReservatie?.laad_datum ?? "");
  const [retourDatum, setRetourDatum] = useState(bestaandeReservatie?.retour_datum ?? "");
  const [status, setStatus] = useState(bestaandeReservatie?.status ?? "bevestigd");
  const [regels, setRegels] = useState<Regel[]>(
    (bestaandeReservatie?.regels ?? []).map((r, i) => ({
      tempId: `bestaand-${i}-${r.component_id}`,
      component_id: r.component_id,
      code: r.code,
      naam: r.naam,
      aantal: r.aantal,
      checking: false,
      tekortDagen: null,
    }))
  );
  const [zoek, setZoek] = useState("");
  const [algemeneFout, setAlgemeneFout] = useState<string | null>(null);
  const [bevestigOndanksTekort, setBevestigOndanksTekort] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [csvBezig, setCsvBezig] = useState(false);
  const [csvResultaat, setCsvResultaat] = useState<{
    toegevoegd: number;
    bijgewerkt: number;
    nietGevonden: string[];
  } | null>(null);
  const checkTeller = useRef(0);
  const csvInputRef = useRef<HTMLInputElement>(null);

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

  // CSV-import van componentregels: verwacht minstens een kolom "code" en
  // optioneel een kolom "aantal" (default 1). Een code die al in de
  // regellijst staat wordt bijgewerkt met het aantal uit het bestand; een
  // nieuwe, gekende code wordt toegevoegd. Onbekende codes worden gemeld,
  // niet stilzwijgend genegeerd.
  function verwerkCsvBestand(bestand: File) {
    setCsvBezig(true);
    setCsvResultaat(null);
    setAlgemeneFout(null);
    const lezer = new FileReader();
    lezer.onload = () => {
      setCsvBezig(false);
      const tekst = String(lezer.result ?? "").trim();
      if (!tekst) {
        setCsvResultaat({ toegevoegd: 0, bijgewerkt: 0, nietGevonden: [] });
        return;
      }

      const eersteLijn = tekst.split(/\r?\n/, 1)[0] ?? "";
      const delimiter = detecteerDelimiter(eersteLijn);
      const rijen = parseCsv(tekst, delimiter);

      if (rijen.length < 2) {
        setAlgemeneFout("Geen datarijen gevonden onder de kopregel van het CSV-bestand.");
        return;
      }

      const kop = rijen[0].map((h) => h.trim().toLowerCase());
      const codeIdx = kop.findIndex((h) =>
        ["code", "componentcode", "artikel", "artikelcode"].includes(h)
      );
      const aantalIdx = kop.findIndex((h) =>
        ["aantal", "stuks", "qty", "quantity", "voorraad"].includes(h)
      );

      if (codeIdx === -1) {
        setAlgemeneFout("Het CSV-bestand mist een kolom 'code'.");
        return;
      }

      let toegevoegd = 0;
      let bijgewerkt = 0;
      const nietGevonden: string[] = [];
      const kopie = [...regels];

      for (let r = 1; r < rijen.length; r++) {
        const cellen = rijen[r];
        if (cellen.every((c) => c.trim() === "")) continue;
        const code = (cellen[codeIdx] ?? "").trim();
        if (!code) continue;
        const aantalRuw = aantalIdx !== -1 ? (cellen[aantalIdx] ?? "") : "";
        const aantal = aantalRuw ? (parseGeheelGetal(aantalRuw) ?? 1) : 1;

        const component = componenten.find((c) => c.code.toLowerCase() === code.toLowerCase());
        if (!component) {
          nietGevonden.push(code);
          continue;
        }

        const bestaandeIndex = kopie.findIndex((rgl) => rgl.component_id === component.id);
        if (bestaandeIndex >= 0) {
          kopie[bestaandeIndex] = { ...kopie[bestaandeIndex], aantal: Math.max(1, aantal) };
          bijgewerkt++;
        } else {
          kopie.push({
            tempId: `csv-${component.id}-${r}-${Date.now()}`,
            component_id: component.id,
            code: component.code,
            naam: component.naam,
            aantal: Math.max(1, aantal),
            checking: false,
            tekortDagen: null,
          });
          toegevoegd++;
        }
      }

      setRegels(kopie);
      setCsvResultaat({ toegevoegd, bijgewerkt, nietGevonden });
    };
    lezer.readAsText(bestand, "utf-8");
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
      const invoer = {
        evenement_naam: evenementNaam,
        klant,
        locatie,
        laad_datum: laadDatum,
        retour_datum: retourDatum,
        status,
        regels: regels.map((r) => ({ component_id: r.component_id, aantal: r.aantal })),
      };
      const result = bestaandeReservationId
        ? await wijzigReservatie(bestaandeReservationId, invoer)
        : await maakReservatie(invoer);
      // Beide acties redirect'en bij succes; komt hier enkel terug bij een fout.
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

        <div className="mb-1 flex flex-wrap items-start gap-3">
          <div className="relative min-w-[240px] flex-1">
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
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            disabled={csvBezig}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {csvBezig ? "Bezig met verwerken…" : "CSV importeren"}
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const bestand = e.target.files?.[0];
              if (bestand) verwerkCsvBestand(bestand);
              e.target.value = "";
            }}
          />
        </div>
        <p className="mb-4 text-xs text-slate-400">
          CSV met kolommen <span className="font-mono">code</span> (verplicht) en{" "}
          <span className="font-mono">aantal</span> (optioneel, standaard 1) — een code die al in
          de lijst staat wordt bijgewerkt met het aantal uit het bestand.
        </p>

        {csvResultaat && (
          <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            CSV verwerkt: {csvResultaat.toegevoegd} toegevoegd, {csvResultaat.bijgewerkt}{" "}
            bijgewerkt.
            {csvResultaat.nietGevonden.length > 0 && (
              <>
                {" "}
                <span className="text-red-600">
                  Niet gevonden: {csvResultaat.nietGevonden.join(", ")}.
                </span>
              </>
            )}
          </p>
        )}

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
        {isPending
          ? "Bezig met opslaan…"
          : bestaandeReservationId
            ? "Wijzigingen bewaren"
            : "Reservatie bewaren"}
      </button>
    </div>
  );
}
