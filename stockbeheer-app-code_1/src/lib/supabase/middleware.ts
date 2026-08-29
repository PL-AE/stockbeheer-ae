import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Ververst de Supabase-sessie op elke request en stuurt niet-ingelogde
 * gebruikers naar /login (behalve op de loginpagina zelf).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Uitzondering: een ingelogde gebruiker zonder profielrij wordt door
  // vereisProfiel() net naar /login?fout=geen-profiel gestuurd om die
  // melding te tonen. Zonder deze uitzondering zou de regel hierboven die
  // gebruiker meteen terugsturen naar "/", die vereisProfiel() opnieuw naar
  // /login stuurt, enzovoort — een oneindige redirect-lus.
  const heeftFoutmelding = request.nextUrl.searchParams.has("fout");

  if (user && isLoginPage && !heeftFoutmelding) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
