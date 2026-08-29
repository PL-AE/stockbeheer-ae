# Stockbeheer All Events — webapp (Fase 1)

Componentendatabase, voorraadmotor en reservaties met live beschikbaarheidscheck.
Bouwt verder op de database in `../schema.sql` (Supabase/Postgres).

## Wat zit erin

- **Inloggen** (Supabase Auth, e-mail + wachtwoord) met rollen: verkoop, planning, magazijn, directie.
- **Dashboard**: aantal componenten, actieve reservaties, eerstvolgende reservaties.
- **Componenten**: actuele voorraad per component (live, uit `v_stock_current`).
- **Reservaties**: overzicht, detail, en (enkel voor rol "verkoop") een nieuwe reservatie
  aanmaken met per component een **live beschikbaarheidscheck** — een tekort wordt meteen
  getoond tijdens het invullen, niet pas achteraf.

Rolgebaseerde toegang wordt afgedwongen op databaseniveau via Row Level Security
(`supabase/rls_and_grants.sql`), niet enkel in de interface.

## Lokaal opzetten

1. `npm install`
2. Kopieer `.env.local.example` naar `.env.local` en vul je Supabase-projectgegevens in
   (Project Settings → API in het Supabase-dashboard).
3. `npm run dev`, open http://localhost:3000

## Gebruikers aanmaken

Er is geen zelfregistratie. Nieuwe gebruikers worden manueel aangemaakt:

1. In Supabase: **Authentication → Users → Add user** (e-mail + wachtwoord).
2. Daarna in **Table Editor → profiles** een rij toevoegen met hetzelfde `id` (kopieer de
   User UID) en de gewenste `rol` (`verkoop`, `planning`, `magazijn` of `directie`).

Zonder die tweede stap kan iemand wel inloggen, maar toont de app een melding dat er nog
geen rol is toegewezen.

## Deployen

Dit project is bedoeld om via GitHub aan Vercel gekoppeld te worden: elke push naar de
hoofdbranch verschijnt dan automatisch live. Zet `NEXT_PUBLIC_SUPABASE_URL` en
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in de Vercel-projectinstellingen (Environment Variables) —
dezelfde waarden als in `.env.local`.
