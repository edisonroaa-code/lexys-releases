-- Tabla de configuración del sistema (salario mínimo, etc)
create table if not exists public.configuracion (
    id uuid default gen_random_uuid() primary key,
    clave text unique not null,
    valor text not null,
    descripcion text,
    tipo text default 'texto' check (tipo in ('numero', 'texto', 'fecha', 'boolean')),
    updated_at timestamp with time zone default now()
);

-- Insertar salario mínimo actual de Paraguay (2024)
insert into public.configuracion (clave, valor, descripcion, tipo)
values ('salario_minimo', '2798309', 'Salario Mínimo Legal Vigente en Guaraníes', 'numero')
on conflict (clave) do nothing;

-- Trigger para actualizar updated_at
create or replace function update_configuracion_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_configuracion_updated_at on public.configuracion;
create trigger trigger_update_configuracion_updated_at
    before update on public.configuracion
    for each row
    execute function update_configuracion_updated_at();

-- RLS: Todos pueden leer, solo admins pueden modificar
alter table public.configuracion enable row level security;

create policy "Anyone can read config"
    on public.configuracion for select
    using (true);

-- Tabla de feriados nacionales de Paraguay
create table if not exists public.feriados (
    id uuid default gen_random_uuid() primary key,
    fecha date not null,
    nombre text not null,
    tipo text default 'nacional' check (tipo in ('nacional', 'departamental', 'judicial')),
    anio integer, -- NULL = aplica todos los años (ej: 1 de enero)
    recurrente boolean default false, -- true = se repite cada año (ej: 1 de enero)
    created_at timestamp with time zone default now()
);

-- Índice para búsquedas rápidas por fecha
create index if not exists idx_feriados_fecha on public.feriados(fecha);

-- Insertar feriados nacionales de Paraguay 2024-2025
-- Feriados fijos (recurrentes)
insert into public.feriados (fecha, nombre, tipo, recurrente) values
('2024-01-01', 'Año Nuevo', 'nacional', true),
('2024-03-01', 'Día de los Héroes', 'nacional', true),
('2024-05-01', 'Día del Trabajador', 'nacional', true),
('2024-05-14', 'Día de la Independencia (víspera)', 'nacional', true),
('2024-05-15', 'Día de la Independencia', 'nacional', true),
('2024-06-12', 'Paz del Chaco', 'nacional', true),
('2024-08-15', 'Fundación de Asunción', 'nacional', true),
('2024-09-29', 'Victoria de Boquerón', 'nacional', true),
('2024-12-08', 'Virgen de Caacupé', 'nacional', true),
('2024-12-25', 'Navidad', 'nacional', true)
on conflict do nothing;

-- Feriados móviles 2024
insert into public.feriados (fecha, nombre, tipo, anio, recurrente) values
('2024-03-28', 'Jueves Santo', 'nacional', 2024, false),
('2024-03-29', 'Viernes Santo', 'nacional', 2024, false)
on conflict do nothing;

-- Feriados móviles 2025
insert into public.feriados (fecha, nombre, tipo, anio, recurrente) values
('2025-04-17', 'Jueves Santo', 'nacional', 2025, false),
('2025-04-18', 'Viernes Santo', 'nacional', 2025, false),
('2025-01-01', 'Año Nuevo', 'nacional', 2025, false),
('2025-03-01', 'Día de los Héroes', 'nacional', 2025, false),
('2025-05-01', 'Día del Trabajador', 'nacional', 2025, false),
('2025-05-14', 'Día de la Independencia (víspera)', 'nacional', 2025, false),
('2025-05-15', 'Día de la Independencia', 'nacional', 2025, false),
('2025-06-12', 'Paz del Chaco', 'nacional', 2025, false),
('2025-08-15', 'Fundación de Asunción', 'nacional', 2025, false),
('2025-09-29', 'Victoria de Boquerón', 'nacional', 2025, false),
('2025-12-08', 'Virgen de Caacupé', 'nacional', 2025, false),
('2025-12-25', 'Navidad', 'nacional', 2025, false)
on conflict do nothing;

-- RLS para feriados
alter table public.feriados enable row level security;

create policy "Anyone can read feriados"
    on public.feriados for select
    using (true);
