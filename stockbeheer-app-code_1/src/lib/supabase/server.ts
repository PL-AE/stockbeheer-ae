import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase-client voor gebruik in Server Components, Server Actions en
 * Route Handlers. Leest/schrijft de sessie via cookies, zodat de ingelogde
 * gebruiker en zijn rol (via de profiles-tabel + RLS) overal correct gekend zijn.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Wordt genegeerd wanneer aangeroepen vanuit een Server Component
            // zonder schrijftoegang tot cookies — de middleware ververst de
            // sessie in dat geval.
          }
        },
      },
    }
  );
}
