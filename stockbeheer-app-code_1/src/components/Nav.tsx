import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import type { Profiel } from "@/lib/profile";

const ROL_LABELS: Record<Profiel["rol"], string> = {
  verkoop: "Verkoop",
  planning: "Planning",
  magazijn: "Magazijn",
  directie: "Directie",
};

export function Nav({ profiel }: { profiel: Profiel }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-slate-900">
            Stockbeheer All Events
          </span>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <Link href="/" className="hover:text-slate-900">
              Dashboard
            </Link>
            <Link href="/componenten" className="hover:text-slate-900">
              Componenten
            </Link>
            <Link href="/reservaties" className="hover:text-slate-900">
              Reservaties
            </Link>
            {profiel.rol === "verkoop" && (
              <Link
                href="/reservaties/nieuw"
                className="rounded-md bg-slate-900 px-2.5 py-1 text-white hover:bg-slate-800"
              >
                + Nieuwe reservatie
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>
            {profiel.naam || "—"}{" "}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {ROL_LABELS[profiel.rol]}
            </span>
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
