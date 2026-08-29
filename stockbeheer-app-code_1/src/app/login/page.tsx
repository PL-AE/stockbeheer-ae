import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ fout?: string }>;
}) {
  const { fout } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">
          Stockbeheer All Events
        </h1>
        <p className="mb-6 text-sm text-slate-500">Log in om verder te gaan.</p>

        {fout === "geen-profiel" && (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Je account bestaat, maar heeft nog geen rol toegewezen gekregen.
            Vraag de beheerder om je toe te voegen aan de profiles-tabel.
          </p>
        )}
        {fout && fout !== "geen-profiel" && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {fout}
          </p>
        )}

        <form action={login} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              E-mailadres
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Wachtwoord
            </label>
            <input
              type="password"
              name="wachtwoord"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Inloggen
          </button>
        </form>
      </div>
    </div>
  );
}
