-- Create table for labor calculations
create table if not exists public.calculos_laborales (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    cliente_id uuid references public.clientes(id) on delete set null,
    fecha_calculo timestamp with time zone default timezone('utc'::text, now()) not null,
    datos_entrada jsonb not null,
    resultado jsonb not null,
    creado_por uuid references auth.users(id) on delete set null
);

-- Add RLS policies
alter table public.calculos_laborales enable row level security;

create policy "Users can view their own calculations"
    on public.calculos_laborales for select
    using (auth.uid() = creado_por);

create policy "Users can insert their own calculations"
    on public.calculos_laborales for insert
    with check (auth.uid() = creado_por);

create policy "Users can update their own calculations"
    on public.calculos_laborales for update
    using (auth.uid() = creado_por);

create policy "Users can delete their own calculations"
    on public.calculos_laborales for delete
    using (auth.uid() = creado_por);
