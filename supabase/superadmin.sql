-- Contenido editable de la web y biblioteca pública de imágenes.
-- Ejecutar en Supabase SQL Editor. Las escrituras solo pasan por
-- funciones del servidor autenticadas con SUPERADMIN_PASSWORD.

create table if not exists public.site_content (
  id text primary key check (id = 'main'),
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nonno-site-assets',
  'nonno-site-assets',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
