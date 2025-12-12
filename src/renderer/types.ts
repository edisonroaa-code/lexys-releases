export interface Profile {
    id: string;
    despacho_id: string;
    nombre_completo: string;
    email: string;
    rol: 'admin' | 'abogado';
    despachos?: { nombre: string };
}

export interface Cliente {
    id: string;
    despacho_id: string;
    nombre: string;
    cedula?: string;
    telefono?: string;
    email?: string;
    created_at?: string;
}

export interface TipoJuicio {
    id: string;
    nombre: string;
    tipo_proceso?: string | null;
    area_id?: string | null;
    fuero_id?: string | null;
    areas?: { nombre: string };
    fueros?: { nombre: string };
    // Legacy fields for compatibility if needed, though we should prefer relations
    area?: string;
    fuero?: string;
}

export interface EtapaProceso {
    id: string;
    tipo_juicio_id: string;
    nombre: string;
    descripcion?: string;
    orden: number;
    plazo_id?: string;
}

export interface Expediente {
    id: string;
    nro_expediente: string;
    caratula: string;
    contraparte?: string | null;
    cliente_id: string;
    tipo_juicio_id: string;
    despacho_id: string;
    responsable_id: string;
    estado: 'en_curso' | 'completado' | 'vencido' | 'pendiente' | 'archivado';
    etapa_actual_id?: string | null;
    etapas_completadas?: string[] | null;
    fecha_creacion: string;
    monto_demanda?: number | null;
    cuenta_corriente_judicial?: string | null;

    // Relations
    clientes?: Cliente;
    tipos_juicio?: TipoJuicio;
    etapas_proceso?: EtapaProceso;
}

export interface Tarea {
    id: string;
    expediente_id: string;
    descripcion: string;
    completada: boolean;
    fecha_limite?: string;
    responsable_id?: string;
    created_at: string;
    perfiles?: { nombre_completo: string };
}

export interface Actuacion {
    id: string;
    expediente_id: string;
    tipo: string;
    fecha: string;
    descripcion: string;
    created_at: string;
}

export interface Evento {
    id: string;
    titulo: string;
    fecha_evento: string;
    descripcion?: string | null;
    expediente_id?: string | null;
    despacho_id: string;
}

export interface PlazoProcesal {
    id: string;
    accion_procedimiento: string;
    tipo_proceso?: string;
    fuero?: string;
    duracion_numero?: number | null;
    unidad?: string | null;
    tipo_duracion?: string | null;
    articulo?: string;
    descripcion?: string;
    duracion_plazo?: string; // Legacy text field
}

export interface Area {
    id: string;
    nombre: string;
}

export interface Fuero {
    id: string;
    nombre: string;
}
