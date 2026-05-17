create table if not exists biblioteca (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  categoria text default 'Manual',
  file_path text not null,
  file_name text,
  visible boolean default true,
  publicado_por text,
  created_at timestamptz default now()
);

alter table biblioteca enable row level security;

drop policy if exists "biblioteca sin acceso directo anon" on biblioteca;
create policy "biblioteca sin acceso directo anon"
on biblioteca
for select
to anon
using (false);
