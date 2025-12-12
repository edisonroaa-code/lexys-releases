import { supabase } from './supabaseClient';
import { store } from '../store/store';
import { Expediente, Cliente, TipoJuicio, EtapaProceso, Actuacion, Evento, PlazoProcesal, Tarea, Area, Fuero } from '../types';

export async function fetchCatalogs() {
    const [areasRes, fuerosRes] = await Promise.all([
        supabase.from('areas').select('*').order('nombre'),
        supabase.from('fueros').select('*').order('nombre'),
    ]);

    if (areasRes.error) throw areasRes.error;
    if (fuerosRes.error) throw fuerosRes.error;

    store.setState({
        allAreas: areasRes.data || [],
        allFueros: fuerosRes.data || []
    });
    return { areas: areasRes.data, fueros: fuerosRes.data };
}

export async function fetchAllInitialData() {
    const despachoId = store.state.currentUserProfile?.despacho_id;
    if (!despachoId) throw new Error("No despacho ID found");

    const [clientesRes, tiposJuicioRes, eventosRes, plazosRes, expedientesRes, areasRes, fuerosRes] = await Promise.all([
        supabase.from('clientes').select('*').eq('despacho_id', despachoId),
        supabase.from('tipos_juicio').select('*, areas(nombre), fueros(nombre)'),
        supabase.from('eventos').select('*').eq('despacho_id', despachoId),
        supabase.from('plazos_procesales').select('*').order('fuero').order('tipo_proceso'),
        supabase.from('expedientes').select('*, tipos_juicio(id, nombre), clientes(nombre), etapas_proceso(nombre)').eq('despacho_id', despachoId).order('fecha_creacion', { ascending: false }),
        supabase.from('areas').select('*').order('nombre'),
        supabase.from('fueros').select('*').order('nombre'),
    ]);

    if (clientesRes.error) throw clientesRes.error;
    if (tiposJuicioRes.error) throw tiposJuicioRes.error;
    if (eventosRes.error) throw eventosRes.error;
    if (plazosRes.error) throw plazosRes.error;
    if (expedientesRes.error) throw expedientesRes.error;
    if (areasRes.error) throw areasRes.error;
    if (fuerosRes.error) throw fuerosRes.error;

    store.setState({
        allClientes: clientesRes.data || [],
        clientes: [...(clientesRes.data || [])],
        allJuicios: tiposJuicioRes.data || [],
        tiposJuicio: [...(tiposJuicioRes.data || [])],
        eventos: eventosRes.data || [],
        allPlazos: plazosRes.data || [],
        allExpedientes: expedientesRes.data || [],
        allAreas: areasRes.data || [],
        allFueros: fuerosRes.data || []
    });

    organizeJuicios();
}

export function organizeJuicios() {
    const juiciosOrganizados = store.state.tiposJuicio.reduce((acc: any, juicio: any) => {
        const fuero = juicio.fueros?.nombre || juicio.fuero || 'Sin Fuero';
        const proceso = juicio.tipo_proceso || 'Sin Proceso';
        if (!acc[fuero]) acc[fuero] = {};
        if (!acc[fuero][proceso]) acc[fuero][proceso] = [];
        acc[fuero][proceso].push(juicio);
        return acc;
    }, {});
    store.setState({ juiciosOrganizados });
}

export async function fetchExpedientes() {
    const despachoId = store.state.currentUserProfile?.despacho_id;
    if (!despachoId) return;

    const { data, error } = await supabase.from('expedientes').select('*, tipos_juicio(id, nombre), clientes(nombre), etapas_proceso(nombre)').eq('despacho_id', despachoId).order('fecha_creacion', { ascending: false });
    if (error) throw error;

    store.setState({ allExpedientes: data || [] });
    return data;
}

export async function fetchClientes() {
    const despachoId = store.state.currentUserProfile?.despacho_id;
    if (!despachoId) return;

    const { data, error } = await supabase.from('clientes').select('*').eq('despacho_id', despachoId);
    if (error) throw error;

    store.setState({ allClientes: data });
    return data;
}

export async function fetchDocumentos(clienteId: string) {
    const { data, error } = await supabase.storage.from('documentos').list(clienteId, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    return data;
}

export async function fetchExpedienteDocumentos(expedienteId: string) {
    const { data, error } = await supabase.storage.from('documentos').list(`expediente_${expedienteId}`, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    return data;
}

export async function fetchMembers() {
    const despachoId = store.state.currentUserProfile?.despacho_id;
    if (!despachoId) return;

    const { data, error } = await supabase.from('perfiles').select('*').eq('despacho_id', despachoId);
    if (error) throw error;
    return data;
}

export async function fetchAdminJuicios() {
    const { data, error } = await supabase.from('tipos_juicio').select('*, areas(nombre), fueros(nombre)');
    if (error) throw error;
    store.setState({ allJuicios: data });
    return data;
}

export async function fetchActuaciones(expedienteId: string) {
    const { data, error } = await supabase.from('actuaciones').select('*').eq('expediente_id', expedienteId).order('fecha', { ascending: false });
    if (error) throw error;
    return data;
}

export async function fetchEtapas(tipoJuicioId: string) {
    const { data, error } = await supabase.from('etapas_proceso').select('*').eq('tipo_juicio_id', tipoJuicioId).order('orden');
    if (error) throw error;
    store.setState({ allEtapas: data });
    return data;
}

export async function fetchPlazos() {
    const { data, error } = await supabase
        .from('plazos_procesales')
        .select('*')
        .order('fuero')
        .order('tipo_proceso');

    if (error) throw error;
    store.setState({ allPlazos: data });
    return data;
}

export async function fetchTareas(expedienteId: string) {
    const [tareasRes, perfilesRes] = await Promise.all([
        supabase.from('tareas').select('*, perfiles(nombre_completo)').eq('expediente_id', expedienteId).order('created_at'),
        supabase.from('perfiles').select('id, nombre_completo').eq('despacho_id', store.state.currentUserProfile?.despacho_id)
    ]);

    if (tareasRes.error) throw tareasRes.error;
    if (perfilesRes.error) throw perfilesRes.error;

    return { tareas: tareasRes.data, miembros: perfilesRes.data };
}

export async function createExpediente(formData: Partial<Expediente>) {
    const { error } = await supabase.from('expedientes').insert(formData);
    if (error) throw error;
}

export async function updateExpediente(id: string, formData: Partial<Expediente>) {
    const { error } = await supabase.from('expedientes').update(formData).eq('id', id);
    if (error) throw error;
}

export async function deleteExpediente(id: string) {
    await supabase.from('actuaciones').delete().eq('expediente_id', id);
    await supabase.from('tareas').delete().eq('expediente_id', id);
    await supabase.from('eventos').delete().eq('expediente_id', id);
    const { error } = await supabase.from('expedientes').delete().eq('id', id);
    if (error) throw error;
}

export async function createCliente(formData: Partial<Cliente>) {
    const { data, error } = await supabase.from('clientes').insert(formData).select().single();
    if (error) throw error;
    await supabase.storage.from('documentos').upload(`${data.id}/.emptyFolderPlaceholder`, new Blob(['']));
    return data;
}

export async function uploadDocument(path: string, file: File) {
    const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: false });
    if (error) throw error;
}

export async function downloadDocument(path: string) {
    const { data, error } = await supabase.storage.from('documentos').download(path);
    if (error) throw error;
    return data;
}

export async function deleteDocument(path: string) {
    const { error } = await supabase.storage.from('documentos').remove([path]);
    if (error) throw error;
}

export async function updateEtapaExpediente(expedienteId: string, etapaId: string, etapasCompletadas: string[], estado: Expediente['estado'] = 'en_curso') {
    const { data, error } = await supabase.from('expedientes').update({
        etapa_actual_id: etapaId,
        etapas_completadas: etapasCompletadas,
        estado
    }).eq('id', expedienteId).select().single();
    if (error) throw error;
    return data;
}

export async function getPlazoById(plazoId: string) {
    const { data, error } = await supabase.from('plazos_procesales').select('*').eq('id', plazoId).single();
    if (error) throw error;
    return data;
}

export async function createEvento(eventoData: Partial<Evento>) {
    const { data, error } = await supabase.from('eventos').insert(eventoData).select().single();
    if (error) throw error;
    return data;
}

export async function upsertEventoPorTitulo(eventoData: Partial<Evento> & { titulo: string }) {
    const matchQuery = supabase
        .from('eventos')
        .select('id')
        .eq('titulo', eventoData.titulo)
        .eq('despacho_id', eventoData.despacho_id || store.state.currentUserProfile?.despacho_id || '')
        .eq('expediente_id', eventoData.expediente_id || null)
        .limit(1)
        .single();

    const existing = await matchQuery;

    if (existing.data?.id) {
        const { data, error } = await supabase.from('eventos')
            .update({
                fecha_evento: eventoData.fecha_evento,
                descripcion: eventoData.descripcion
            })
            .eq('id', existing.data.id)
            .select()
            .single();
        if (error) throw error;
        return data;
    }

    const { data, error } = await supabase.from('eventos').insert(eventoData).select().single();
    if (error) throw error;
    return data;
}

export async function createTipoJuicio(formData: Partial<TipoJuicio>) {
    const { error } = await supabase.from('tipos_juicio').insert(formData);
    if (error) throw error;
}

export async function createArea(nombre: string) {
    const { error } = await supabase.from('areas').insert({ nombre });
    if (error) throw error;
}

export async function deleteArea(id: string) {
    const { error } = await supabase.from('areas').delete().eq('id', id);
    if (error) throw error;
}

export async function createFuero(nombre: string) {
    const { error } = await supabase.from('fueros').insert({ nombre });
    if (error) throw error;
}

export async function deleteFuero(id: string) {
    const { error } = await supabase.from('fueros').delete().eq('id', id);
    if (error) throw error;
}

export async function createEtapa(formData: Partial<EtapaProceso>) {
    const { error } = await supabase.from('etapas_proceso').insert(formData);
    if (error) throw error;
}

export async function createActuacion(formData: Partial<Actuacion>) {
    const { error } = await supabase.from('actuaciones').insert(formData);
    if (error) throw error;
}

export async function updatePerfilRol(id: string, rol: string) {
    const { error } = await supabase.from('perfiles').update({ rol }).eq('id', id);
    if (error) throw error;
}

export async function upsertEtapas(updates: Partial<EtapaProceso>[]) {
    const { error } = await supabase.from('etapas_proceso').upsert(updates);
    if (error) throw error;
}

export async function createDespachoAndUser(body: any) {
    const { data, error } = await supabase.functions.invoke('create-despacho-and-user', { body });
    if (error) throw error;
    return data;
}

export async function createPlazo(formData: Partial<PlazoProcesal>) {
    const { error } = await supabase.from('plazos_procesales').insert(formData);
    if (error) throw error;
}

export async function updatePlazo(id: string, formData: Partial<PlazoProcesal>) {
    const { error } = await supabase.from('plazos_procesales').update(formData).eq('id', id);
    if (error) throw error;
}

export async function getExpedienteResumenData(expedienteId: string) {
    const [tareasRes, actuacionesRes, eventosRes] = await Promise.all([
        supabase.from('tareas').select('*', { count: 'exact' }).eq('expediente_id', expedienteId),
        supabase.from('actuaciones').select('fecha').eq('expediente_id', expedienteId).order('fecha', { ascending: false }).limit(1),
        supabase.from('eventos').select('fecha_evento').eq('expediente_id', expedienteId).order('fecha_evento', { ascending: true }).limit(1)
    ]);

    if (tareasRes.error) throw tareasRes.error;
    if (actuacionesRes.error) throw actuacionesRes.error;
    if (eventosRes.error) throw eventosRes.error;

    return {
        tareas: tareasRes.data || [],
        ultimaActuacion: actuacionesRes.data?.[0],
        proximoEvento: eventosRes.data?.[0]
    };
}

export async function saveCalculo(data: any) {
    const { error } = await supabase.from('calculos_laborales').insert(data);
    if (error) throw error;
}

export async function fetchCalculos() {
    const { data, error } = await supabase.from('calculos_laborales').select('*, clientes(nombre)').order('fecha_calculo', { ascending: false });
    if (error) throw error;
    return data;
}

export async function deleteCalculo(id: string) {
    const { error } = await supabase.from('calculos_laborales').delete().eq('id', id);
    if (error) throw error;
}

// Configuración del sistema (salario mínimo, etc)
export async function fetchConfiguracion(clave: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('configuracion')
        .select('valor')
        .eq('clave', clave)
        .single();

    if (error) {
        console.error('Error fetching configuracion:', error);
        return null;
    }
    return data?.valor || null;
}

export async function fetchSalarioMinimo(): Promise<number> {
    const valor = await fetchConfiguracion('salario_minimo');
    return valor ? parseInt(valor, 10) : 2798309; // Fallback al valor actual
}

// Feriados nacionales
export async function fetchFeriados(anio?: number): Promise<Date[]> {
    let query = supabase.from('feriados').select('fecha');

    if (anio) {
        // Obtener feriados del año específico o recurrentes
        query = query.or(`anio.eq.${anio},recurrente.eq.true`);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching feriados:', error);
        return [];
    }

    const feriados = (data || []).map(f => new Date(f.fecha + 'T00:00:00'));
    store.state.feriados = feriados;
    return feriados;
}

// --- ADMIN & LICENSE FUNCTIONS ---

function normalizeLicenseResponse(data: any) {
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
        allowed: row.allowed ?? true,
        status: row.status ?? 'PRUEBA',
        daysLeft: row.days_left ?? row.daysLeft ?? 0,
        message: row.message ?? '',
        plan: row.plan ?? 'N/A',
        expiresAt: row.expires_at ?? row.expiresAt ?? null,
    };
}

export async function checkLicense(despachoId: string) {
    try {
        const { data: rpcData, error } = await supabase.rpc('verify_license_sql', { despacho_id: despachoId });
        const normalized = normalizeLicenseResponse(rpcData);
        if (error || !normalized) {
            console.warn('verify_license_sql fallo, fallback trial:', error);
            return { allowed: true, status: 'PRUEBA', daysLeft: 60, message: 'Licencia en prueba (fallback)', plan: 'TRIAL', expiresAt: null };
        }

        return normalized;
    } catch (err) {
        console.warn('Error verifying license, fallback trial:', err);
        return { allowed: true, status: 'PRUEBA', daysLeft: 60, message: 'Licencia en prueba (fallback)', plan: 'TRIAL', expiresAt: null };
    }
}

export async function fetchDespachoDetails(despachoId: string) {
    return await supabase.from('despachos').select('*').eq('id', despachoId).single();
}

export async function updateDespacho(despachoId: string, updates: { nombre: string }) {
    return await supabase.from('despachos').update(updates).eq('id', despachoId);
}

export async function deleteMember(memberId: string) {
    return await supabase.from('perfiles').delete().eq('id', memberId);
}
