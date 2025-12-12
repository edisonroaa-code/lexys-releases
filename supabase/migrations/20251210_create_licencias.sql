-- Tabla de licencias para control de suscripciones SaaS
-- Permite controlar acceso con período de prueba de 60 días

create table if not exists public.licencias (
    id uuid default gen_random_uuid() primary key,
    despacho_id uuid references public.despachos(id) on delete cascade not null unique,
    hardware_id text, -- Huella del dispositivo (opcional, para single-device licensing)
    estado text default 'PRUEBA' check (estado in ('ACTIVO', 'SUSPENDIDO', 'PRUEBA', 'EXPIRADO')),
    plan text default 'TRIAL' check (plan in ('TRIAL', 'MENSUAL', 'ANUAL')),
    fecha_inicio timestamp with time zone default now() not null,
    fecha_expiracion timestamp with time zone, -- NULL para ACTIVO permanente, fecha límite para planes
    dias_prueba integer default 60,
    notas text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Crear índice para búsquedas rápidas por despacho
create index if not exists idx_licencias_despacho on public.licencias(despacho_id);

-- Habilitar RLS
alter table public.licencias enable row level security;

-- Los usuarios solo pueden ver su propia licencia (basado en su despacho)
create policy "Users can view own license"
    on public.licencias for select
    using (
        despacho_id = (
            select despacho_id 
            from public.perfiles 
            where id = auth.uid()
        )
    );

-- Solo service_role (backend) puede insertar/actualizar licencias
-- Esto asegura que solo tú (admin) puedes controlar las licencias

-- Función para actualizar timestamp de updated_at
create or replace function update_licencias_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Trigger para auto-update de updated_at
drop trigger if exists trigger_update_licencias_updated_at on public.licencias;
create trigger trigger_update_licencias_updated_at
    before update on public.licencias
    for each row
    execute function update_licencias_updated_at();
