-- ============================================================================
-- Rolgebaseerde toegang (Fase 1): enkel verkoop mag reservaties aanmaken/
-- wijzigen; planning, magazijn en directie kunnen alles bekijken.
-- Uitvoeren in de Supabase SQL Editor, NA schema.sql en de data-import.
-- ============================================================================

alter table components enable row level security;
alter table reservations enable row level security;
alter table reservation_lines enable row level security;
alter table stock_movements enable row level security;
alter table breakages enable row level security;
alter table loads enable row level security;
alter table load_checklist_items enable row level security;
alter table structure_units enable row level security;
alter table structure_unit_assignments enable row level security;
alter table profiles enable row level security;

-- profiles: iedereen mag zijn eigen rij lezen (nodig om de eigen rol te kennen in de app).
create policy "eigen profiel lezen" on profiles
  for select using (id = auth.uid());

-- Alle overige tabellen: elke ingelogde gebruiker mag alles LEZEN.
create policy "ingelogd = lezen" on components for select using (auth.role() = 'authenticated');
create policy "ingelogd = lezen" on reservations for select using (auth.role() = 'authenticated');
create policy "ingelogd = lezen" on reservation_lines for select using (auth.role() = 'authenticated');
create policy "ingelogd = lezen" on stock_movements for select using (auth.role() = 'authenticated');
create policy "ingelogd = lezen" on breakages for select using (auth.role() = 'authenticated');
create policy "ingelogd = lezen" on loads for select using (auth.role() = 'authenticated');
create policy "ingelogd = lezen" on load_checklist_items for select using (auth.role() = 'authenticated');
create policy "ingelogd = lezen" on structure_units for select using (auth.role() = 'authenticated');
create policy "ingelogd = lezen" on structure_unit_assignments for select using (auth.role() = 'authenticated');

-- Enkel rol 'verkoop' mag reservaties en reservatieregels aanmaken/wijzigen/verwijderen.
create policy "verkoop = schrijven" on reservations for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.rol = 'verkoop'));
create policy "verkoop = bewerken" on reservations for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.rol = 'verkoop'));
create policy "verkoop = verwijderen" on reservations for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.rol = 'verkoop'));

create policy "verkoop = schrijven" on reservation_lines for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.rol = 'verkoop'));
create policy "verkoop = bewerken" on reservation_lines for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.rol = 'verkoop'));
create policy "verkoop = verwijderen" on reservation_lines for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.rol = 'verkoop'));

-- Uitvoerrechten op de beschikbaarheidsfuncties voor ingelogde gebruikers.
grant execute on function fn_beschikbaarheid(bigint, date, date) to authenticated;
grant execute on function fn_check_reservatie(bigint, date, date, integer, bigint) to authenticated;
grant execute on function fn_vrije_eenheden(text, date) to authenticated;
