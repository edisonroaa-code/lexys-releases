-- 1. Crear tabla de Planes
create table if not exists public.planes (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  precio_mensual bigint not null default 0,
  precio_anual bigint not null default 0,
  moneda text default 'PYG',
  features jsonb default '[]',
  activo boolean default true,
  created_at timestamptz default now()
);

-- 2. Insertar planes por defecto
insert into public.planes (nombre, precio_mensual, precio_anual) values
('Básico', 150000, 1500000),
('Profesional', 300000, 3000000),
('Enterprise', 600000, 6000000);

-- 3. Actualizar tabla licencias para soportar precios personalizados
alter table public.licencias 
add column if not exists precio_pactado bigint,
add column if not exists ciclo_facturacion text default 'MENSUAL';

-- 4. Habilitar acceso público (o configurar políticas RLS según necesites)
alter table public.planes enable row level security;

create policy "Permitir lectura publica de planes" 
on public.planes for select 
to anon, authenticated, service_role 
using (true);

create policy "Permitir gestion total a service_role" 
on public.planes for all 
to service_role 
using (true) 
with check (true);
