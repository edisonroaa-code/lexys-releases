// CAMBIO: Se importa la instancia de supabase desde main.js
import { supabase } from './main.js';
import { handleError, showToast, showConfirmDeleteModal, getStatusBadge, calcularFechaVencimiento, getPlazoDuration } from './utils.js';
import { renderExpedientes, renderClientes, renderDocumentos, renderExpedienteDocumentos, renderMembers, renderAdminJuicios, applyJuiciosFilters, renderActuaciones, renderTimeline, renderCalendar, renderPlazos, populatePlazosFilters, renderNotifications, renderExpedienteResumen, renderEtapasEnModal, populateEtapaFilter, applyPlazosFilters, populatePlazoFormSelects, populateJuicioCatalogSelects, renderAreasList, renderFuerosList } from './ui.js';
import { switchView } from './main.js';
import { state } from './state.js';

async function refreshCatalogs() {
    try {
        const [areasRes, fuerosRes] = await Promise.all([
            supabase.from('areas').select('*').order('nombre'),
            supabase.from('fueros').select('*').order('nombre'),
        ]);

        if (areasRes.error) throw areasRes.error;
        if (fuerosRes.error) throw fuerosRes.error;

        state.allAreas = areasRes.data || [];
        state.allFueros = fuerosRes.data || [];
        renderAreasList();
        renderFuerosList();
        populateJuicioCatalogSelects();
    } catch (error) {
        handleError(error, 'refreshCatalogs');
    }
}

export async function fetchAllInitialData() {
    try {
        const [clientesRes, tiposJuicioRes, eventosRes, plazosRes, expedientesRes, areasRes, fuerosRes] = await Promise.all([
            supabase.from('clientes').select('*').eq('despacho_id', state.currentUserProfile.despacho_id),
            supabase.from('tipos_juicio').select('*, areas(nombre), fueros(nombre)'),
            supabase.from('eventos').select('*').eq('despacho_id', state.currentUserProfile.despacho_id),
            supabase.from('plazos_procesales').select('*').order('fuero').order('tipo_proceso'),
            supabase.from('expedientes').select('*, tipos_juicio(id, nombre), clientes(nombre), etapas_proceso(nombre)').eq('despacho_id', state.currentUserProfile.despacho_id).order('fecha_creacion', { ascending: false }),
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
        
        state.allClientes = clientesRes.data || [];
        state.clientes = [...state.allClientes];
        state.allJuicios = tiposJuicioRes.data || [];
        state.tiposJuicio = [...state.allJuicios];
        state.eventos = eventosRes.data || [];
        state.allPlazos = plazosRes.data || [];
        state.allExpedientes = expedientesRes.data || [];
        state.allAreas = areasRes.data || [];
        state.allFueros = fuerosRes.data || [];
        renderAreasList();
        renderFuerosList();
        populateJuicioCatalogSelects();
        organizeJuicios();
    } catch (error) {
        handleError(error, 'fetchAllInitialData');
    }
}

export function organizeJuicios() {
    state.juiciosOrganizados = state.tiposJuicio.reduce((acc, juicio) => {
        const fuero = juicio.fueros?.nombre || juicio.fuero || 'Sin Fuero';
        const proceso = juicio.tipo_proceso || 'Sin Proceso';
        if (!acc[fuero]) acc[fuero] = {};
        if (!acc[fuero][proceso]) acc[fuero][proceso] = [];
        acc[fuero][proceso].push(juicio);
        return acc;
    }, {});
}

export async function refreshExpedientesAndRender() {
    try {
        const { data, error } = await supabase.from('expedientes').select('*, tipos_juicio(id, nombre), clientes(nombre), etapas_proceso(nombre)').eq('despacho_id', state.currentUserProfile.despacho_id).order('fecha_creacion', { ascending: false });
        if (error) throw error;
        state.allExpedientes = data || [];
        renderExpedientes(state.allExpedientes, state.currentPage);
        populateEtapaFilter();
    } catch (error) {
        handleError(error, 'refreshExpedientesAndRender');
    }
}


export async function fetchClientes() {
    const container = document.getElementById('clientes-folder-container');
    try {
        container.innerHTML = `<div class="col-12 text-center p-5"><div class="loader mx-auto"></div></div>`;
        
        const { data, error } = await supabase.from('clientes').select('*').eq('despacho_id', state.currentUserProfile.despacho_id);
        
        if (error) throw error;
        
        state.allClientes = data;
        renderClientes(state.allClientes);
    } catch (error) {
        handleError(error, 'fetchClientes');
        if(container) container.innerHTML = `<div class="col-12 text-center p-5 text-danger">Error al cargar clientes.</div>`;
    }
}

export async function fetchAndRenderDocumentos(clienteId) {
    const listContainer = document.getElementById('documentos-list');
    try {
        listContainer.innerHTML = `<div class="loader mx-auto my-3"></div>`;

        const { data, error } = await supabase.storage.from('documentos').list(clienteId, {
            limit: 100,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' },
        });

        if (error) throw error;
        
        renderDocumentos(data);
    } catch (error) {
        handleError(error, 'fetchAndRenderDocumentos');
        if (listContainer) listContainer.innerHTML = `<p class="text-danger">Error al cargar documentos.</p>`;
    }
}

export async function fetchExpedienteDocumentos(expedienteId) {
    const listContainer = document.getElementById('expediente-documentos-list');
    try {
        listContainer.innerHTML = `<div class="loader mx-auto my-3"></div>`;

        const { data, error } = await supabase.storage.from('documentos').list(`expediente_${expedienteId}`, {
            limit: 100,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' },
        });

        if (error) throw error;
        
        renderExpedienteDocumentos(data, expedienteId);
    } catch (error) {
        handleError(error, 'fetchExpedienteDocumentos');
        if (listContainer) listContainer.innerHTML = `<p class="text-danger">Error al cargar documentos.</p>`;
    }
}

export async function fetchMembers() {
    const tableBody = document.getElementById('members-table-body');
    try {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-5"><div class="loader mx-auto"></div></td></tr>`;
        
        const { data, error } = await supabase.from('perfiles').select('*').eq('despacho_id', state.currentUserProfile.despacho_id);
        
        if (error) throw error;
        
        renderMembers(data);
    } catch (error) {
        handleError(error, 'fetchMembers');
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-5 text-danger">Error al cargar miembros.</div>`;
    }
}

export async function fetchAdminJuicios(page = 0) {
    const tableBody = document.getElementById('juicios-table-body');
    try {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-5"><div class="loader mx-auto"></div></td></tr>`;
        
        const { data, error } = await supabase.from('tipos_juicio').select('*, areas(nombre), fueros(nombre)');
        if (error) throw error;
        state.allJuicios = data;
        
        applyJuiciosFilters(page);
    } catch (error) {
        handleError(error, 'fetchAdminJuicios');
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-5 text-danger">Error al cargar tipos de juicio.</td></tr>`;
    }
}

export async function fetchAndRenderActuaciones(expedienteId) {
    const listContainer = document.getElementById('actuaciones-list');
    try {
        listContainer.innerHTML = `<div class="loader mx-auto"></div>`;
        
        const { data, error } = await supabase.from('actuaciones').select('*').eq('expediente_id', expedienteId).order('fecha', { ascending: false });
        
        if (error) throw error;
        
        renderActuaciones(data);
    } catch (error) {
        handleError(error, 'fetchAndRenderActuaciones');
        if (listContainer) listContainer.innerHTML = `<p class="text-danger">Error al cargar actuaciones.</p>`;
    }
}

export async function fetchAndRenderTimeline(expediente) {
    const timelineContainer = document.getElementById('expediente-timeline');
    try {
        timelineContainer.innerHTML = `<div class="loader mx-auto"></div>`;
        
        const { data: etapas, error } = await supabase.from('etapas_proceso').select('*').eq('tipo_juicio_id', expediente.tipo_juicio_id).order('orden');
        
        if (error) throw error;
        
        state.allEtapas = etapas;
        renderTimeline(etapas, expediente);
    } catch (error) {
        handleError(error, 'fetchAndRenderTimeline');
        if (timelineContainer) timelineContainer.innerHTML = `<p class="text-danger">Error al cargar la línea de tiempo.</p>`;
    }
}

export async function fetchAndRenderPlazos() {
    const tableBody = document.getElementById('plazos-table-body');
    try {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-5"><div class="loader mx-auto"></div></td></tr>`;

        const { data, error } = await supabase
            .from('plazos_procesales')
            .select('*')
            .order('fuero')
            .order('tipo_proceso');

        if (error) throw error;
        
        state.allPlazos = data;
        populatePlazosFilters();
        applyPlazosFilters(state.plazosCurrentPage);
    } catch (error) {
        handleError(error, 'fetchAndRenderPlazos');
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error al cargar los plazos.</td></tr>`;
    }
}

export async function fetchAndRenderTareas(expedienteId) {
    const listContainer = document.getElementById('tareas-list');
    const responsableSelect = document.getElementById('tarea-responsable');
    try {
        listContainer.innerHTML = `<div class="loader mx-auto my-3"></div>`;

        const [tareasRes, perfilesRes] = await Promise.all([
            supabase.from('tareas').select('*, perfiles(nombre_completo)').eq('expediente_id', expedienteId).order('created_at'),
            supabase.from('perfiles').select('id, nombre_completo').eq('despacho_id', state.currentUserProfile.despacho_id)
        ]);

        if (tareasRes.error) throw tareasRes.error;
        if (perfilesRes.error) throw perfilesRes.error;

        const tareas = tareasRes.data;
        const miembros = perfilesRes.data;

        responsableSelect.innerHTML = miembros.map(m => `<option value="${m.id}">${m.nombre_completo}</option>`).join('');
        responsableSelect.value = state.currentUserProfile.id;

        if (tareas.length === 0) {
            listContainer.innerHTML = '<p class="text-muted small text-center">No hay tareas para este expediente.</p>';
            return;
        }

        listContainer.innerHTML = tareas.map(tarea => {
            const isChecked = tarea.completada ? 'checked' : '';
            const textClass = tarea.completada ? 'text-decoration-line-through text-muted' : '';
            const fechaLimite = tarea.fecha_limite ? new Date(tarea.fecha_limite + 'T00:00:00').toLocaleDateString() : 'Sin fecha';
            
            return `
                <div class="d-flex justify-content-between align-items-center p-2 border-bottom">
                    <div class="form-check">
                        <input class="form-check-input tarea-check" type="checkbox" ${isChecked} data-tarea-id="${tarea.id}">
                        <label class="form-check-label ${textClass}">
                            ${tarea.descripcion}
                            <span class="d-block small text-muted">
                                Asignado a: ${tarea.perfiles?.nombre_completo || 'N/A'} | Límite: ${fechaLimite}
                            </span>
                        </label>
                    </div>
                    <button class="btn btn-sm btn-outline-danger btn-delete-tarea" data-tarea-id="${tarea.id}"><i class="ph ph-trash"></i></button>
                </div>
            `;
        }).join('');
    } catch (error) {
        handleError(error, 'fetchAndRenderTareas');
        if (listContainer) listContainer.innerHTML = '<p class="text-danger small">Error al cargar las tareas.</p>';
    }
}

export async function handleNewExpedienteSubmit(e, andAddAnother = false) {
    e.preventDefault();
    const form = document.getElementById('new-expediente-form');
    if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated');
        showToast('Por favor, completa todos los campos obligatorios.', 'warning');
        return;
    }

    try {
        const formData = {
            nro_expediente: document.getElementById('exp-nro').value,
            cliente_id: document.getElementById('exp-cliente').value,
            caratula: document.getElementById('exp-caratula').value,
            contraparte: document.getElementById('exp-contraparte').value,
            tipo_juicio_id: document.getElementById('exp-tipo-juicio').value,
            despacho_id: state.currentUserProfile.despacho_id,
            responsable_id: state.currentUserProfile.id,
            monto_demanda: (document.getElementById('exp-monto').value.replace(/\./g, '')) || null,
            cuenta_corriente_judicial: document.getElementById('exp-cuenta').value || null,
        };
        
        const { error } = await supabase.from('expedientes').insert(formData);
        if (error) throw error;
        
        showToast('Expediente creado con éxito.', 'success');
        refreshExpedientesAndRender();
        
        if(andAddAnother) {
            form.classList.remove('was-validated');
            ['exp-nro', 'exp-contraparte', 'exp-caratula', 'exp-monto', 'exp-cuenta'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('exp-nro').focus();
        } else {
            state.nuevoExpedienteModal.hide();
        }
    } catch (error) {
        handleError(error, 'handleNewExpedienteSubmit');
    }
}

export async function handleEditExpedienteSubmit(e) {
    e.preventDefault();
    try {
        const id = document.getElementById('edit-exp-id').value;
        const formData = {
            nro_expediente: document.getElementById('edit-exp-nro').value,
            cliente_id: document.getElementById('edit-exp-cliente').value,
            caratula: document.getElementById('edit-exp-caratula').value,
            contraparte: document.getElementById('edit-exp-contraparte').value,
            tipo_juicio_id: document.getElementById('edit-exp-tipo-juicio').value,
            estado: document.getElementById('edit-exp-estado').value,
            monto_demanda: (document.getElementById('edit-exp-monto').value.replace(/\./g, '')) || null,
            cuenta_corriente_judicial: document.getElementById('edit-exp-cuenta').value || null,
        };
        
        const { error } = await supabase.from('expedientes').update(formData).eq('id', id);
        if (error) throw error;
        
        showToast('Expediente actualizado.', 'success');
        state.editarExpedienteModal.hide();
        refreshExpedientesAndRender();
    } catch (error) {
        handleError(error, 'handleEditExpedienteSubmit');
    }
}

export async function handleDelete(id) {
    showConfirmDeleteModal(
        'Confirmar Eliminación de Expediente',
        '¿Estás seguro de que quieres borrar el expediente? Esta acción no se puede deshacer.',
        async () => {
            try {
                await supabase.from('actuaciones').delete().eq('expediente_id', id);
                await supabase.from('tareas').delete().eq('expediente_id', id);
                await supabase.from('eventos').delete().eq('expediente_id', id);

                const { error } = await supabase.from('expedientes').delete().eq('id', id);
                if (error) throw error;
                
                showToast('Expediente borrado correctamente.', 'success');
                const currentView = sessionStorage.getItem('lastView');
                if (currentView === 'cliente-expedientes' && state.currentClienteId) {
                    const clienteNombre = document.getElementById('cliente-expediente-title').textContent.replace('Expedientes de: ', '');
                    handleFolderClick(state.currentClienteId, clienteNombre);
                } else {
                    refreshExpedientesAndRender();
                }
            } catch (error) {
                handleError(error, 'handleDelete');
            }
        }
    );
}

export async function handleNewClientSubmit(e) {
    e.preventDefault();
    const form = e.target;
    if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated');
        return;
    }
    
    try {
        const formData = {
            nombre: document.getElementById('client-nombre').value.trim(),
            cedula: document.getElementById('client-cedula').value,
            telefono: document.getElementById('client-telefono').value,
            email: document.getElementById('client-email').value,
            despacho_id: state.currentUserProfile.despacho_id,
        };
        
        const { data, error } = await supabase.from('clientes').insert(formData).select().single();
        if (error) throw error;
        
        await supabase.storage.from('documentos').upload(`${data.id}/.emptyFolderPlaceholder`, new Blob(['']));
        
        showToast('Cliente creado con éxito.', 'success');
        state.nuevoClienteModal.hide();
        
        await fetchAllInitialData();
        if(!document.getElementById('clientes-view').classList.contains('d-none')) {
            renderClientes(state.allClientes);
        }
    } catch (error) {
        handleError(error, 'handleNewClientSubmit');
    }
}

export async function handleFileUpload(e) {
    e.preventDefault();
    const uploadButton = document.getElementById('upload-button');
    const fileInput = document.getElementById('document-input');
    try {
        const file = fileInput.files[0];

        if (!file) {
            showToast('Por favor, selecciona un archivo.', 'warning');
            return;
        }
        if (!state.currentClienteId) {
            showToast('Error: No se ha seleccionado un cliente.', 'danger');
            return;
        }

        uploadButton.disabled = true;
        uploadButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Subiendo...`;

        const { error } = await supabase.storage.from('documentos').upload(`${state.currentClienteId}/${file.name}`, file, { upsert: false });
        if (error) throw error;
        
        showToast('Archivo subido con éxito.', 'success');
        fetchAndRenderDocumentos(state.currentClienteId);
    } catch (error) {
        handleError(error, 'handleFileUpload');
    } finally {
        uploadButton.disabled = false;
        uploadButton.innerHTML = `<i class="ph ph-upload-simple me-1"></i> Subir`;
        fileInput.value = '';
    }
}

export async function handleExpedienteFileUpload(e) {
    e.preventDefault();
    const uploadButton = document.getElementById('upload-expediente-button');
    const fileInput = document.getElementById('expediente-document-input');
    try {
        const file = fileInput.files[0];

        if (!file) {
            showToast('Por favor, selecciona un archivo.', 'warning');
            return;
        }
        if (!state.currentExpedienteId) {
            showToast('Error: No se ha seleccionado un expediente.', 'danger');
            return;
        }

        uploadButton.disabled = true;
        uploadButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Subiendo...`;

        const { error } = await supabase.storage.from('documentos').upload(`expediente_${state.currentExpedienteId}/${file.name}`, file, { upsert: false });
        if (error) throw error;
        
        showToast('Archivo subido con éxito.', 'success');
        fetchExpedienteDocumentos(state.currentExpedienteId);
    } catch (error) {
        handleError(error, 'handleExpedienteFileUpload');
    } finally {
        uploadButton.disabled = false;
        uploadButton.innerHTML = `<i class="ph ph-upload-simple me-1"></i> Subir`;
        fileInput.value = '';
    }
}

export async function handleFileDownload(fileName) {
    try {
        const { data, error } = await supabase.storage.from('documentos').download(`${state.currentClienteId}/${fileName}`);
        if (error) throw error;
        
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        handleError(error, 'handleFileDownload');
    }
}

export async function handleExpedienteFileDownload(fileName, expedienteId) {
    try {
        const { data, error } = await supabase.storage.from('documentos').download(`expediente_${expedienteId}/${fileName}`);
        if (error) throw error;
        
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        handleError(error, 'handleExpedienteFileDownload');
    }
}

export function handleFileDelete(fileName) {
    showConfirmDeleteModal(
        'Confirmar Eliminación de Documento',
        `¿Estás seguro de que quieres borrar el archivo "${fileName}"?`,
        async () => {
            try {
                const { error } = await supabase.storage.from('documentos').remove([`${state.currentClienteId}/${fileName}`]);
                if (error) throw error;
                
                showToast('Archivo borrado con éxito.', 'success');
                fetchAndRenderDocumentos(state.currentClienteId);
            } catch (error) {
                handleError(error, 'handleFileDelete');
            }
        }
    );
}

export function handleExpedienteFileDelete(fileName, expedienteId) {
    showConfirmDeleteModal(
        'Confirmar Eliminación de Documento',
        `¿Estás seguro de que quieres borrar el archivo "${fileName}"?`,
        async () => {
            try {
                const { error } = await supabase.storage.from('documentos').remove([`expediente_${expedienteId}/${fileName}`]);
                if (error) throw error;
                
                showToast('Archivo borrado con éxito.', 'success');
                fetchExpedienteDocumentos(expedienteId);
            } catch (error) {
                handleError(error, 'handleExpedienteFileDelete');
            }
        }
    );
}

export async function handleStageUpdate(etapaId) {
    try {
        const newIndex = state.allEtapas.findIndex(e => e.id == etapaId);
        if (newIndex === -1) return;

        const etapasCompletadas = state.allEtapas.slice(0, newIndex).map(e => e.id);

        const { data: updatedExp, error } = await supabase.from('expedientes').update({
            etapa_actual_id: etapaId,
            etapas_completadas: etapasCompletadas,
            estado: 'en_curso'
        }).eq('id', state.currentExpedienteId).select().single();

        if (error) throw error;
        
        showToast('Etapa actualizada.', 'success');
        
        try {
            const proximaEtapa = state.allEtapas[newIndex + 1];
            if (proximaEtapa && proximaEtapa.plazo_id) {
                const { data: plazoEncontrado } = await supabase
                    .from('plazos_procesales').select('*').eq('id', proximaEtapa.plazo_id).single();

                if (plazoEncontrado) {
                    const fechaVencimiento = calcularFechaVencimiento(
                        new Date(), 
                        getPlazoDuration(plazoEncontrado), 
                        plazoEncontrado.tipo_duracion
                    );
                    
                    const eventoData = {
                        titulo: `Vencimiento: ${proximaEtapa.nombre}`,
                        fecha_evento: fechaVencimiento.toISOString().split('T')[0],
                        descripcion: `Plazo automático para "${updatedExp.caratula}". Basado en: ${plazoEncontrado.articulo}.`,
                        despacho_id: state.currentUserProfile.despacho_id,
                        expediente_id: state.currentExpedienteId
                    };
                    
                    const { data: nuevoEvento, error: eventoError } = await supabase.from('eventos').insert(eventoData).select().single();
                    if (eventoError) throw eventoError;

                    showToast(`Plazo para "${proximaEtapa.nombre}" agendado para el ${fechaVencimiento.toLocaleDateString()}.`, 'info');
                    state.eventos.push(nuevoEvento);
                    const currentView = sessionStorage.getItem('lastView');
                    if (currentView === 'calendario') renderCalendar();
                    if (currentView === 'dashboard') renderDashboardData();
                }
            }
        } catch (e) {
            console.error('Error durante la automatización de plazos:', e);
            showToast('Etapa actualizada, pero hubo un error al crear el plazo automático.', 'warning');
        }

        await handleAdvance(state.currentExpedienteId);
    } catch (error) {
        handleError(error, 'handleStageUpdate');
    }
}

export async function handleNewJuicioSubmit(e) {
    e.preventDefault();
    try {
        const form = e.target;
        const areaId = document.getElementById('juicio-area').value;
        const fueroId = document.getElementById('juicio-fuero').value;
        const formData = {
            nombre: document.getElementById('juicio-nombre').value,
            tipo_proceso: document.getElementById('juicio-proceso').value || null,
            area_id: areaId || null,
            fuero_id: fueroId || null,
        };
        
        const { error } = await supabase.from('tipos_juicio').insert(formData);
        if (error) throw error;
        
        showToast('Tipo de juicio guardado.', 'success');
        form.reset();
        state.nuevoJuicioModal.hide();
        
        await fetchAllInitialData();
        fetchAdminJuicios();
    } catch (error) {
        handleError(error, 'handleNewJuicioSubmit');
    }
}

export async function handleNewAreaSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('new-area-name');
    const nombre = input.value.trim();
    if (!nombre) return;
    try {
        const { error } = await supabase.from('areas').insert({ nombre });
        if (error) throw error;
        input.value = '';
        showToast('Área creada correctamente.', 'success');
        await refreshCatalogs();
    } catch (error) {
        handleError(error, 'handleNewAreaSubmit');
    }
}

export function handleDeleteArea(areaId, areaNombre) {
    showConfirmDeleteModal(
        'Eliminar Área',
        `¿Seguro que deseas eliminar el área "${areaNombre}"?`,
        async () => {
            try {
                const { error } = await supabase.from('areas').delete().eq('id', areaId);
                if (error) throw error;
                showToast('Área eliminada.', 'success');
                await refreshCatalogs();
            } catch (error) {
                handleError(error, 'handleDeleteArea');
            }
        }
    );
}

export async function handleNewFueroSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('new-fuero-name');
    const nombre = input.value.trim();
    if (!nombre) return;
    try {
        const { error } = await supabase.from('fueros').insert({ nombre });
        if (error) throw error;
        input.value = '';
        showToast('Fuero creado correctamente.', 'success');
        await refreshCatalogs();
    } catch (error) {
        handleError(error, 'handleNewFueroSubmit');
    }
}

export function handleDeleteFuero(fueroId, fueroNombre) {
    showConfirmDeleteModal(
        'Eliminar Fuero',
        `¿Seguro que deseas eliminar el fuero "${fueroNombre}"?`,
        async () => {
            try {
                const { error } = await supabase.from('fueros').delete().eq('id', fueroId);
                if (error) throw error;
                showToast('Fuero eliminado.', 'success');
                await refreshCatalogs();
            } catch (error) {
                handleError(error, 'handleDeleteFuero');
            }
        }
    );
}

export async function handleNewEtapaSubmit(e) {
    e.preventDefault();
    try {
        const juicioId = document.getElementById('etapas-juicio-id').value;
        const formData = {
            tipo_juicio_id: juicioId,
            nombre: document.getElementById('etapa-nombre').value,
            descripcion: document.getElementById('etapa-desc').value,
        };
        
        const { error } = await supabase.from('etapas_proceso').insert(formData);
        if (error) throw error;
        
        showToast('Etapa añadida.', 'success');
        e.target.reset();
        await renderEtapasEnModal(juicioId);
    } catch (error) {
        handleError(error, 'handleNewEtapaSubmit');
    }
}

export async function handleNewActuacionSubmit(e) {
    e.preventDefault();
    try {
        const expediente = state.allExpedientes.find(exp => exp.id === state.currentExpedienteId);
        if (!expediente || !expediente.etapa_actual_id) {
            showToast('Seleccione una etapa actual antes de añadir una actuación.', 'warning');
            return;
        }

        const formData = {
            expediente_id: state.currentExpedienteId,
            etapa_id: expediente.etapa_actual_id,
            despacho_id: state.currentUserProfile.despacho_id,
            responsable_id: state.currentUserProfile.id,
            tipo: document.getElementById('actuacion-tipo').value,
            fecha: document.getElementById('actuacion-fecha').value,
            descripcion: document.getElementById('actuacion-descripcion').value,
        };
        
        const { error } = await supabase.from('actuaciones').insert(formData);
        if (error) throw error;
        
        showToast('Actuación guardada.', 'success');
        e.target.reset();
        await fetchAndRenderActuaciones(state.currentExpedienteId);
        await renderExpedienteResumen(state.currentExpedienteId);
    } catch (error) {
        handleError(error, 'handleNewActuacionSubmit');
    }
}

export async function handleNewEventSubmit(e) {
    e.preventDefault();
    try {
        const form = e.target;
        const expedienteId = state.eventExpedienteChoices.getValue(true);
        const formData = {
            titulo: document.getElementById('event-title').value,
            fecha_evento: document.getElementById('event-date').value,
            descripcion: document.getElementById('event-description').value,
            despacho_id: state.currentUserProfile.despacho_id,
            ...(expedienteId && { expediente_id: expedienteId })
        };

        const { data, error } = await supabase.from('eventos').insert(formData).select().single();
        if (error) throw error;

        showToast('Evento creado con éxito.', 'success');
        state.eventos.push(data);
        
        const currentView = sessionStorage.getItem('lastView');
        if (currentView === 'calendario') renderCalendar();
        if (currentView === 'dashboard') renderDashboardData();

        state.nuevoEventoModal.hide();
    } catch (error) {
        handleError(error, 'handleNewEventSubmit');
    }
}

export async function handleRoleSave(memberId, newRole) {
    try {
        const { error } = await supabase.from('perfiles').update({ rol: newRole }).eq('id', memberId);
        if (error) throw error;
        showToast('Rol actualizado correctamente.', 'success');
    } catch (error) {
        handleError(error, 'handleRoleSave');
    }
}

export async function handleSaveEtapas() {
    try {
        const etapaItems = document.querySelectorAll('#etapas-list .etapa-item');
        const updates = Array.from(etapaItems).map((item, index) => ({
            id: item.dataset.id,
            nombre: item.querySelector('.etapa-nombre-input').value,
            plazo_id: item.querySelector('.etapa-plazo-select').value || null,
            orden: index
        }));

        const { error } = await supabase.from('etapas_proceso').upsert(updates);
        if (error) throw error;
        
        showToast('Etapas y plazos vinculados guardados.', 'success');
        state.editarEtapasModal.hide();
    } catch (error) {
        handleError(error, 'handleSaveEtapas');
    }
}

export async function handleCreateUserSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');

    if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated');
        showToast('Por favor, completa todos los campos obligatorios.', 'warning');
        return;
    }

    try {
        const name = document.getElementById('new-user-name').value;
        const email = document.getElementById('new-user-email').value;
        const password = document.getElementById('new-user-password').value;

        submitButton.disabled = true;
        submitButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Creando...`;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No hay sesión activa para autorizar esta acción.");

        const { data, error } = await supabase.functions.invoke('create-despacho-and-user', {
            body: { name, email, password, despacho_id: state.currentUserProfile.despacho_id },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        showToast('Usuario creado correctamente.', 'success');
        form.reset();
        form.classList.remove('was-validated');
        fetchMembers();
    } catch (error) {
        handleError(error, 'handleCreateUserSubmit');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Crear Usuario';
    }
}

export async function handleNewPlazoSubmit(e) {
    e.preventDefault();
    try {
        const form = e.target;
        const duracionNumeroValue = document.getElementById('plazo-duracion-numero').value;
        const formData = {
            accion_procedimiento: document.getElementById('plazo-accion').value,
            fuero: document.getElementById('plazo-fuero').value,
            tipo_proceso: document.getElementById('plazo-tipo-proceso').value,
            articulo: document.getElementById('plazo-articulo').value,
            descripcion: document.getElementById('plazo-descripcion').value,
            duracion_numero: duracionNumeroValue ? parseInt(duracionNumeroValue, 10) : null,
            unidad: document.getElementById('plazo-unidad').value || null,
            tipo_duracion: document.getElementById('plazo-tipo-duracion').value || 'habiles',
            instancia: document.getElementById('plazo-instancia').value,
            notas: document.getElementById('plazo-notas').value,
        };
        
        const { error } = await supabase.from('plazos_procesales').insert(formData);
        if (error) throw error;
        
        showToast('Plazo guardado correctamente.', 'success');
        state.nuevoPlazoModal.hide();
        fetchAndRenderPlazos();
    } catch (error) {
        handleError(error, 'handleNewPlazoSubmit');
    }
}

export async function handleEditPlazoSubmit(e) {
    e.preventDefault();
    try {
        const id = document.getElementById('edit-plazo-id').value;
        const duracionNumeroValue = document.getElementById('edit-plazo-duracion-numero').value;
        const formData = {
            accion_procedimiento: document.getElementById('edit-plazo-accion').value,
            fuero: document.getElementById('edit-plazo-fuero').value,
            tipo_proceso: document.getElementById('edit-plazo-tipo-proceso').value,
            articulo: document.getElementById('edit-plazo-articulo').value,
            descripcion: document.getElementById('edit-plazo-descripcion').value,
            duracion_numero: duracionNumeroValue ? parseInt(duracionNumeroValue, 10) : null,
            unidad: document.getElementById('edit-plazo-unidad').value || null,
            tipo_duracion: document.getElementById('edit-plazo-tipo-duracion').value || 'habiles',
            instancia: document.getElementById('edit-plazo-instancia').value,
            notas: document.getElementById('edit-plazo-notas').value,
        };
        
        const { error } = await supabase.from('plazos_procesales').update(formData).eq('id', id);
        if (error) throw error;
        
        showToast('Plazo actualizado correctamente.', 'success');
        state.editarPlazoModal.hide();
        fetchAndRenderPlazos();
    } catch (error) {
        handleError(error, 'handleEditPlazoSubmit');
    }
}

export async function handleNewTareaSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('new-tarea-form');
    if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated');
        showToast('Por favor, completa la descripción de la tarea.', 'warning');
        return;
    }
    
    try {
        const formData = {
            expediente_id: state.currentExpedienteId,
            descripcion: document.getElementById('tarea-descripcion').value,
            responsable_id: document.getElementById('tarea-responsable').value,
            fecha_limite: document.getElementById('tarea-fecha-limite').value || null,
            creador_id: state.currentUserProfile.id,
        };
        
        const { error } = await supabase.from('tareas').insert(formData);
        if (error) throw error;
        
        showToast('Tarea añadida.', 'success');
        form.reset();
        await fetchAndRenderTareas(state.currentExpedienteId);
    } catch (error) {
        handleError(error, 'handleNewTareaSubmit');
    }
}

export function handleDeleteTarea(tareaId) {
    showConfirmDeleteModal(
        'Eliminar Tarea',
        '¿Estás seguro de que quieres borrar esta tarea?',
        async () => {
            try {
                const { error } = await supabase.from('tareas').delete().eq('id', tareaId);
                if (error) throw error;
                showToast('Tarea eliminada.', 'success');
                fetchAndRenderTareas(state.currentExpedienteId);
            } catch (error) {
                handleError(error, 'handleDeleteTarea');
            }
        }
    );
}

export async function handleTareaStatusChange(tareaId, isCompletada) {
    try {
        const { error } = await supabase.from('tareas').update({ completada: isCompletada }).eq('id', tareaId);
        if (error) throw error;
        showToast('Tarea actualizada.', 'success');
    } catch (error) {
        handleError(error, 'handleTareaStatusChange');
    }
}

export async function handleAdvance(expedienteId) {
    state.currentExpedienteId = expedienteId;
    const expediente = state.allExpedientes.find(exp => exp.id === expedienteId);
    if (!expediente) {
        showToast('Expediente no encontrado.', 'danger');
        return;
    }

    document.getElementById('main-title').textContent = 'Detalle de Expediente';
    document.getElementById('main-subtitle').textContent = expediente.caratula;
    document.getElementById('detail-caratula').textContent = expediente.caratula;
    document.getElementById('detail-meta').textContent = `Expediente N° ${expediente.nro_expediente} | Cliente: ${expediente.clientes.nombre}`;
    
    await fetchAndRenderTareas(expedienteId);
    await fetchAndRenderActuaciones(expedienteId);
    await fetchExpedienteDocumentos(expedienteId);
    await renderExpedienteResumen(expedienteId);
    await fetchAndRenderTimeline(expediente);
    
    switchView('expediente-detail');
}

export function handleEditEtapas(juicioId, juicioNombre) {
    document.getElementById('etapas-modal-title').textContent = `Etapas: ${juicioNombre}`;
    document.getElementById('etapas-juicio-id').value = juicioId;
    renderEtapasEnModal(juicioId);
    state.editarEtapasModal.show();
}

export async function handleEditPlazo(plazoId) {
    try {
        const { data, error } = await supabase.from('plazos_procesales').select('*').eq('id', plazoId).single();
        if (error) throw error;

        populatePlazoFormSelects('#edit-plazo-fuero', '#edit-plazo-tipo-proceso');
        
        document.getElementById('edit-plazo-id').value = data.id;
        document.getElementById('edit-plazo-accion').value = data.accion_procedimiento;
        document.getElementById('edit-plazo-fuero').value = data.fuero;
        document.getElementById('edit-plazo-tipo-proceso').value = data.tipo_proceso;
        document.getElementById('edit-plazo-articulo').value = data.articulo;
        document.getElementById('edit-plazo-descripcion').value = data.descripcion;
        document.getElementById('edit-plazo-duracion-numero').value = data.duracion_numero ?? '';
        document.getElementById('edit-plazo-unidad').value = data.unidad || 'días';
        document.getElementById('edit-plazo-tipo-duracion').value = data.tipo_duracion || 'habiles';
        document.getElementById('edit-plazo-instancia').value = data.instancia;
        document.getElementById('edit-plazo-notas').value = data.notas;
        
        state.editarPlazoModal.show();
    } catch (error) {
        handleError(error, 'handleEditPlazo');
    }
}

export function handleDeletePlazo(plazoId) {
    showConfirmDeleteModal(
        'Eliminar Plazo',
        '¿Estás seguro de que quieres borrar este plazo? Esta acción es irreversible.',
        async () => {
            try {
                const { error } = await supabase.from('plazos_procesales').delete().eq('id', plazoId);
                if (error) throw error;
                showToast('Plazo borrado con éxito.', 'success');
                fetchAndRenderPlazos();
            } catch (error) {
                handleError(error, 'handleDeletePlazo');
            }
        }
    );
}

export async function renderDashboardData() {
    try {
        const statsContainer = document.getElementById('dashboard-stats');
        statsContainer.innerHTML = `<div class="loader mx-auto my-5"></div>`;
        
        const { data: expedientes, error: expedientesError } = await supabase.from('expedientes').select('*').eq('despacho_id', state.currentUserProfile.despacho_id);
        if (expedientesError) throw expedientesError;

        const { data: eventos, error: eventosError } = await supabase.from('eventos').select('*').eq('despacho_id', state.currentUserProfile.despacho_id).order('fecha_evento', { ascending: true }).limit(5);
        if (eventosError) throw eventosError;

        const { data: actuaciones, error: actuacionesError } = await supabase.from('actuaciones').select('*').eq('despacho_id', state.currentUserProfile.despacho_id).order('fecha', { ascending: false }).limit(5);
        if (actuacionesError) throw actuacionesError;

        const totalExpedientes = expedientes.length;
        const expedientesEnCurso = expedientes.filter(exp => exp.estado === 'en_curso').length;
        const expedientesCompletados = expedientes.filter(exp => exp.estado === 'completado').length;
        const expedientesVencidos = expedientes.filter(exp => exp.estado === 'vencido').length;

        statsContainer.innerHTML = `
            <div class="col-md-3 mb-4">
                <div class="card h-100 border-start border-primary border-5 rounded-3">
                    <div class="card-body">
                        <h6 class="text-primary text-uppercase small">Total Expedientes</h6>
                        <h2 class="fw-bold">${totalExpedientes}</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-4">
                <div class="card h-100 border-start border-warning border-5 rounded-3">
                    <div class="card-body">
                        <h6 class="text-warning text-uppercase small">En Curso</h6>
                        <h2 class="fw-bold">${expedientesEnCurso}</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-4">
                <div class="card h-100 border-start border-success border-5 rounded-3">
                    <div class="card-body">
                        <h6 class="text-success text-uppercase small">Completados</h6>
                        <h2 class="fw-bold">${expedientesCompletados}</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-4">
                <div class="card h-100 border-start border-danger border-5 rounded-3">
                    <div class="card-body">
                        <h6 class="text-danger text-uppercase small">Vencidos</h6>
                        <h2 class="fw-bold">${expedientesVencidos}</h2>
                    </div>
                </div>
            </div>
        `;

        const eventosList = document.getElementById('dashboard-eventos-list');
        const actuacionesList = document.getElementById('dashboard-actuaciones-list');

        eventosList.innerHTML = eventos.length > 0 ? eventos.map(e => `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <p class="mb-0 small fw-semibold">${e.titulo}</p>
                    <p class="mb-0 small text-muted">${new Date(e.fecha_evento).toLocaleDateString()}</p>
                </div>
                ${e.expediente_id ? `<button class="btn btn-sm btn-link" data-expediente-id="${e.expediente_id}">Ver</button>` : ''}
            </div>
        `).join('') : '<p class="text-muted small">No hay eventos próximos.</p>';

        actuacionesList.innerHTML = actuaciones.length > 0 ? actuaciones.map(a => `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <p class="mb-0 small fw-semibold">${a.descripcion}</p>
                    <p class="mb-0 small text-muted">${new Date(a.fecha).toLocaleDateString()}</p>
                </div>
                <button class="btn btn-sm btn-link" data-expediente-id="${a.expediente_id}">Ver</button>
            </div>
        `).join('') : '<p class="text-muted small">No hay actuaciones recientes.</p>';

    } catch (error) {
        handleError(error, 'renderDashboardData');
    }
}



