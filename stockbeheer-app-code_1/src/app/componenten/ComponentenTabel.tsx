"use client";

import { useMemo, useState } from "react";

type Component = {
  component_id: number;
  code: string;
  naam: string;
  categorie: string;
  totaal_stock: number;
};

export function ComponentenTabel({ componenten }: { componenten: Component[] }) {
  const [zoek, setZoek] = useState("");

  const gefilterd = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    if (!q) return componenten;
    return componenten.filter(
      (c) => c.code.toLowerCase().includes(q) || c.naam.toLowerCase().includes(q)
    );
  }, [componenten, zoek]);

  return (
    <div>
      <input
        type="text"
        placeholder="Zoek op code of naam…"
        value={zoek}
        onChange={(e) => setZoek(e.target.value)}
        className="mb-4 w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Naam</th>
              <th className="px-4 py-2">Categorie</th>
              <th className="px-4 py-2 text-right">Voorraad</th>
            </tr>
          </thead>
          <tbody>
            {gefilterd.map((c) => (
              <tr key={c.component_id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 font-mono text-xs text-slate-700">{c.code}</td>
                <td className="px-4 py-2 text-slate-900">{c.naam}</td>
                <td className="px-4 py-2 text-slate-600">{c.categorie}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-900">
                  {c.totaal_stock}
                </td>
              </tr>
            ))}
            {gefilterd.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Geen componenten gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">{gefilterd.length} van {componenten.length} componenten</p>
    </div>
  );
}
