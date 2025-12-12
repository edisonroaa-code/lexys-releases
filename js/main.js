// --- IMPORTACIÓN DE MÓDULOS ---

import { getStatusBadge, generateCaratula, showToast, formatMonto, formatCuentaCorriente, handleError } from './utils.js';
import { fetchAllInitialData, organizeJuicios, refreshExpedientesAndRender, fetchClientes, fetchAndRenderDocumentos, fetchExpedienteDocumentos, fetchMembers, fetchAdminJuicios, fetchAndRenderActuaciones, fetchAndRenderTimeline, fetchAndRenderPlazos, fetchAndRenderTareas, handleNewExpedienteSubmit, handleEditExpedienteSubmit, handleDelete, handleNewClientSubmit, handleFileUpload, handleExpedienteFileUpload, handleFileDownload, handleExpedienteFileDownload, handleFileDelete, handleExpedienteFileDelete, handleStageUpdate, handleNewJuicioSubmit, handleNewEtapaSubmit, handleNewActuacionSubmit, handleNewEventSubmit, handleRoleSave, handleSaveEtapas, handleCreateUserSubmit, handleNewPlazoSubmit, handleEditPlazoSubmit, handleNewTareaSubmit, handleDeleteTarea, handleTareaStatusChange, handleAdvance, handleEditPlazo, handleDeletePlazo, handleEditEtapas, handleNewAreaSubmit, handleDeleteArea, handleNewFueroSubmit, handleDeleteFuero, renderDashboardData } from './data.js';
import { renderExpedientes, updatePagination, renderClientes, renderDocumentos, renderExpedienteDocumentos, renderMembers, renderAdminJuicios, updateJuiciosPagination, applyJuiciosFilters, applyPlazosFilters, renderActuaciones, renderTimeline, renderCalendar, renderPlazos, updatePlazosPagination, populatePlazosFilters, renderNotifications, renderExpedienteResumen, renderEtapasEnModal, populateEtapaFilter, populatePlazoFormSelects } from './ui.js';
import { state, resetState } from './state.js';

resetState();

let authListenersRegistered = false;


// --- CONFIGURATION ---

const SUPABASE_URL = 'https://qtigmnjctvpyafxqxlow.supabase.co';



// IMPORTANTE: Reemplaza esta clave con tu propia clave pública 'anon' de Supabase

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0aWdtbmpjdHZweWFmeHF4bG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyODcxOTEsImV4cCI6MjA2Njg2MzE5MX0.v7mVihA_TQCdkzbIdMrWplLod4wc5hHfscxfDq2c3Ys';


// CAMBIO: Se exporta la instancia de supabase para que sea accesible en otros módulos

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);







// --- EVENT LISTENERS & NAVIGATION ---

function setupActionListeners() {

    const handleTableButtonClick = (e) => {

        const target = e.target.closest('button');

        if (!target) return;

        const expedienteId = target.dataset.expedienteId;

        if (!expedienteId) return;



        if (target.classList.contains('btn-edit')) handleEdit(expedienteId);

        else if (target.classList.contains('btn-delete')) handleDelete(expedienteId);

        else if (target.classList.contains('btn-advance')) handleAdvance(expedienteId);

    };



    document.getElementById('expedientes-table-body')?.addEventListener('click', handleTableButtonClick);

    document.getElementById('cliente-expedientes-table-body')?.addEventListener('click', handleTableButtonClick);

    

    document.getElementById('juicios-table-body')?.addEventListener('click', (e) => {

        const target = e.target.closest('button.btn-edit-etapas');

        if(target) {

            handleEditEtapas(target.dataset.juicioId, target.dataset.juicioNombre);

        }

    });



    document.getElementById('back-to-list-btn')?.addEventListener('click', () => switchView('expedientes'));

    document.getElementById('back-to-clients-btn')?.addEventListener('click', () => switchView('clientes'));



    document.getElementById('clientes-folder-container')?.addEventListener('click', (e) => {

        const folder = e.target.closest('.client-folder');

        if (folder) {

            handleFolderClick(folder.dataset.clienteId, folder.dataset.clienteNombre);

        }

    });



    document.getElementById('upload-document-form')?.addEventListener('submit', handleFileUpload);

    document.getElementById('upload-expediente-document-form')?.addEventListener('submit', handleExpedienteFileUpload);



    document.getElementById('documentos-list')?.addEventListener('click', (e) => {
        const downloadBtn = e.target.closest('.btn-download');
        const deleteBtn = e.target.closest('.btn-delete-doc');
        if (downloadBtn) handleFileDownload(downloadBtn.dataset.filename);
        if (deleteBtn) handleFileDelete(deleteBtn.dataset.filename);
    });

    const dashboardShortcutHandler = (e) => {
        const btn = e.target.closest('button[data-expediente-id]');
        if (!btn) return;
        handleAdvance(btn.dataset.expedienteId);
    };

    document.getElementById('dashboard-eventos-list')?.addEventListener('click', dashboardShortcutHandler);
    document.getElementById('dashboard-actuaciones-list')?.addEventListener('click', dashboardShortcutHandler);


    document.getElementById('expediente-documentos-list')?.addEventListener('click', (e) => {

        const downloadBtn = e.target.closest('.btn-download-expediente');

        const deleteBtn = e.target.closest('.btn-delete-doc-expediente');

        if (downloadBtn) handleExpedienteFileDownload(downloadBtn.dataset.filename, downloadBtn.dataset.expedienteId);

        if (deleteBtn) handleExpedienteFileDelete(deleteBtn.dataset.filename, deleteBtn.dataset.expedienteId);

    });



    document.getElementById('members-table-body')?.addEventListener('click', (e) => {

        const saveBtn = e.target.closest('.btn-save-role');

        if (saveBtn) {

            const memberId = saveBtn.dataset.memberId;

            const roleSelect = document.querySelector(`select[data-member-id="${memberId}"]`);

            handleRoleSave(memberId, roleSelect.value);

        }

    });



    document.getElementById('save-etapas-btn')?.addEventListener('click', handleSaveEtapas);

    

    document.getElementById('prev-month-btn')?.addEventListener('click', () => {

        state.currentDate.setMonth(state.currentDate.getMonth() - 1);

        renderCalendar();

    });



    document.getElementById('next-month-btn')?.addEventListener('click', () => {

        state.currentDate.setMonth(state.currentDate.getMonth() + 1);

        renderCalendar();

    });



    document.getElementById('prev-page-item')?.addEventListener('click', (e) => {

        e.preventDefault();

        const searchInput = document.getElementById('search-expediente');

        const filteredData = filterExpedientes(searchInput.value);

        if (state.currentPage > 0) {

            state.currentPage--;

            renderExpedientes(filteredData, state.currentPage);

        }

    });



    document.getElementById('next-page-item')?.addEventListener('click', (e) => {

        e.preventDefault();

        const searchInput = document.getElementById('search-expediente');

        const filteredData = filterExpedientes(searchInput.value);

        if ((state.currentPage + 1) * state.PAGE_SIZE < filteredData.length) {

            state.currentPage++;

            renderExpedientes(filteredData, state.currentPage);

        }

    });



    document.getElementById('juicios-prev-page-item')?.addEventListener('click', (e) => {

        e.preventDefault();

        if (state.juiciosCurrentPage > 0 && !e.currentTarget.classList.contains('disabled')) {

            state.juiciosCurrentPage--;

            applyJuiciosFilters(state.juiciosCurrentPage);

        }

    });



    document.getElementById('juicios-next-page-item')?.addEventListener('click', (e) => {
        e.preventDefault();
        const searchTerm = document.getElementById('search-juicio').value.toLowerCase();
        const filteredData = state.allJuicios.filter(j => 
            j.nombre.toLowerCase().includes(searchTerm) ||
            ((j.areas?.nombre || j.area || '').toLowerCase().includes(searchTerm)) ||
            ((j.fueros?.nombre || '').toLowerCase().includes(searchTerm)) ||
            ((j.tipo_proceso || '').toLowerCase().includes(searchTerm))
        );
        const totalPages = Math.ceil(filteredData.length / state.JUICIOS_PAGE_SIZE);

        if (state.juiciosCurrentPage < totalPages -1 && !e.currentTarget.classList.contains('disabled')) {
            state.juiciosCurrentPage++;
            applyJuiciosFilters(state.juiciosCurrentPage);

        }

    });





    document.getElementById('plazos-prev-page-item')?.addEventListener('click', (e) => {

        e.preventDefault();

        if (state.plazosCurrentPage > 0 && !e.currentTarget.classList.contains('disabled')) {

            state.plazosCurrentPage--;

            applyPlazosFilters(state.plazosCurrentPage);

        }

    });



    document.getElementById('plazos-next-page-item')?.addEventListener('click', (e) => {

        e.preventDefault();

        if (!e.currentTarget.classList.contains('disabled')) {

            state.plazosCurrentPage++;

            applyPlazosFilters(state.plazosCurrentPage);

        }

    });



    document.getElementById('calendar-grid')?.addEventListener('click', (e) => {

        const eventEl = e.target.closest('.calendar-event');

        const dayEl = e.target.closest('.calendar-day:not(.other-month)');



        if (eventEl && eventEl.dataset.expedienteId) {

            handleAdvance(eventEl.dataset.expedienteId);

        } else if (dayEl && dayEl.dataset.date) {

            handleDayClick(dayEl.dataset.date);

        }

    });



    document.getElementById('search-expediente')?.addEventListener('input', (e) => {

        state.currentPage = 0;

        const filteredData = filterExpedientes(e.target.value);

        renderExpedientes(filteredData, state.currentPage);

    });



    function filterExpedientes(searchTerm) {

        searchTerm = searchTerm.toLowerCase();

        return state.allExpedientes.filter(exp => 

            exp.nro_expediente.toLowerCase().includes(searchTerm) ||

            exp.caratula.toLowerCase().includes(searchTerm) ||

            (exp.clientes?.nombre && exp.clientes.nombre.toLowerCase().includes(searchTerm))

        );

    }

    

    document.getElementById('search-cliente')?.addEventListener('input', (e) => {

        const searchTerm = e.target.value.toLowerCase();

        const filtered = state.allClientes.filter(cli => 

            cli.nombre.toLowerCase().includes(searchTerm) ||

            (cli.cedula && cli.cedula.toLowerCase().includes(searchTerm)) ||

            (cli.email && cli.email.toLowerCase().includes(searchTerm))

        );

        renderClientes(filtered);

    });



    document.getElementById('search-juicio')?.addEventListener('input', (e) => {

        state.juiciosCurrentPage = 0;

        applyJuiciosFilters(state.juiciosCurrentPage);

    });

    

    document.getElementById('plazos-search-input')?.addEventListener('input', () => {

        state.plazosCurrentPage = 0;

        applyPlazosFilters(state.plazosCurrentPage);

    });



    document.getElementById('plazos-filter-fuero')?.addEventListener('change', () => {

        state.plazosCurrentPage = 0;

        applyPlazosFilters(state.plazosCurrentPage);

    });

    

    document.getElementById('plazos-reset-filters')?.addEventListener('click', () => {

        document.getElementById('plazos-search-input').value = '';

        document.getElementById('plazos-filter-fuero').value = '';

        state.plazosCurrentPage = 0;

        applyPlazosFilters(state.plazosCurrentPage);

    });



    document.getElementById('plazos-table-body')?.addEventListener('click', (e) => {

        const editBtn = e.target.closest('.btn-edit-plazo');

        const deleteBtn = e.target.closest('.btn-delete-plazo');

        if (editBtn) handleEditPlazo(editBtn.dataset.plazoId);

        if (deleteBtn) handleDeletePlazo(deleteBtn.dataset.plazoId);

    });



    const tareasList = document.getElementById('tareas-list');

    if (tareasList) {

        tareasList.addEventListener('click', (e) => {

            const check = e.target.closest('.tarea-check');

            const deleteBtn = e.target.closest('.btn-delete-tarea');

            if (check) {

                const tareaId = check.dataset.tareaId;

                const isCompletada = check.checked;

                check.nextElementSibling.classList.toggle('text-decoration-line-through', isCompletada);

                check.nextElementSibling.classList.toggle('text-muted', isCompletada);

                handleTareaStatusChange(tareaId, isCompletada);

            }

            if (deleteBtn) {

                handleDeleteTarea(deleteBtn.dataset.tareaId);

            }

        });

    }

    

    setupExpedientesFilters();

}



function setupNavigation() {

    const navLinks = document.querySelectorAll('.sidebar .nav-link');

    navLinks.forEach(link => {

        link.addEventListener('click', (e) => {

            e.preventDefault();

            const viewName = e.currentTarget.dataset.view;

            if (viewName) {

                switchView(viewName);

            }

        });

    });

    

    document.getElementById('logout-button').addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        sessionStorage.removeItem('lastView');
        resetState({ preserveUi: true });
        window.location.reload();
    });
}


export function switchView(viewName) {

    document.querySelectorAll('.view-container').forEach(view => view.classList.add('d-none'));

    document.querySelectorAll('.sidebar .nav-link').forEach(link => link.classList.remove('active'));

    

    const viewId = `${viewName}-view`;

    const navId = `nav-${viewName}`;

    

    const viewEl = document.getElementById(viewId);

    const navEl = document.getElementById(navId);



    if (viewEl) viewEl.classList.remove('d-none');

    if (navEl) navEl.classList.add('active');



    sessionStorage.setItem('lastView', viewName);



    const fetchActions = {

        'dashboard': () => renderDashboardData(),

        'clientes': () => fetchClientes(),

        'admin': () => fetchMembers(),

        'admin_juicios': () => {

            state.juiciosCurrentPage = 0;

            applyJuiciosFilters(state.juiciosCurrentPage);

        },

        'expedientes': () => { 

            state.currentPage = 0;

            refreshExpedientesAndRender();

        },

        'calendario': () => renderCalendar(),

        'plazos': () => fetchAndRenderPlazos(),

    };



    if (fetchActions[viewName]) {

        fetchActions[viewName]();

    }

}



function handleDayClick(dateString) {

    const eventDateInput = document.getElementById('event-date');

    eventDateInput.value = dateString;

    state.nuevoEventoModal.show();

}



function handleEdit(id) {

    const expediente = state.allExpedientes.find(exp => exp.id == id);

    if (!expediente) return;



    document.getElementById('edit-exp-id').value = expediente.id;

    document.getElementById('edit-exp-nro').value = expediente.nro_expediente;

    document.getElementById('edit-exp-caratula').value = expediente.caratula;

    document.getElementById('edit-exp-contraparte').value = expediente.contraparte;

    document.getElementById('edit-exp-estado').value = expediente.estado;

    document.getElementById('edit-exp-monto').value = expediente.monto_demanda ? new Intl.NumberFormat('es-PY').format(expediente.monto_demanda) : '';

    document.getElementById('edit-exp-cuenta').value = expediente.cuenta_corriente_judicial || '';

    

    const clienteSelect = document.getElementById('edit-exp-cliente');

    clienteSelect.innerHTML = state.allClientes.map(c => `<option value="${c.id}" ${c.id === expediente.cliente_id ? 'selected' : ''}>${c.nombre}</option>`).join('');

    

    const juicioSelect = document.getElementById('edit-exp-tipo-juicio');

    juicioSelect.innerHTML = state.allJuicios.map(t => `<option value="${t.id}" ${t.id === expediente.tipo_juicio_id ? 'selected' : ''}>${t.nombre}</option>`).join('');



    state.editarExpedienteModal.show();

}



function handleFolderClick(clienteId, clienteNombre) {

    state.currentClienteId = clienteId;

    document.getElementById('cliente-expediente-title').textContent = `Expedientes de: ${clienteNombre}`;

    

    const expedientesCliente = state.allExpedientes.filter(exp => exp.cliente_id === clienteId);

    

    const tableBody = document.getElementById('cliente-expedientes-table-body');

    if (!expedientesCliente || expedientesCliente.length === 0) {

        tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-5 text-muted">No se encontraron expedientes para este cliente.</td></tr>`;

    } else {

        tableBody.innerHTML = '';

        expedientesCliente.forEach(exp => {

            const status = getStatusBadge(exp.estado);

            const tr = document.createElement('tr');

            tr.innerHTML = `

                <td>${exp.nro_expediente}</td>

                <td>${exp.caratula}</td>

                <td><span class="badge ${status.class}">${status.text}</span></td>

                <td>${exp.etapas_proceso?.nombre || 'N/A'}</td>

                <td>${new Date(exp.fecha_creacion).toLocaleDateString()}</td>

                <td>

                    <div class="btn-group" role="group">

                        <button class="btn btn-sm btn-outline-secondary btn-edit" data-expediente-id="${exp.id}"><i class="ph ph-pencil-simple"></i></button>

                        <button class="btn btn-sm btn-outline-danger btn-delete" data-expediente-id="${exp.id}"><i class="ph ph-trash"></i></button>

                        <button class="btn btn-sm btn-outline-primary btn-advance" data-expediente-id="${exp.id}"><i class="ph ph-arrow-right"></i></button>

                    </div>

                </td>

            `;

            tableBody.appendChild(tr);

        });

    }



    fetchAndRenderDocumentos(clienteId);

    switchView('cliente-expedientes');

}



function setupAuthEventListeners() {
    if (authListenersRegistered) return;
    authListenersRegistered = true;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        if (!form.checkValidity()) {

            e.stopPropagation();

            form.classList.add('was-validated');

            return;

        }



        try {

            const { error } = await supabase.auth.signInWithPassword({ 

                email: document.getElementById('login-email').value, 

                password: document.getElementById('login-password').value 

            });

            

            if (error) handleError(error, 'login');

        } catch (error) {

            handleError(error, 'login');

        }

    });



    document.getElementById('signup-form').addEventListener('submit', async (e) => {

        e.preventDefault();

        const form = e.target;

        const submitButton = form.querySelector('button');



        if (!form.checkValidity()) {

            e.stopPropagation();

            form.classList.add('was-validated');

            return;

        }

        

        const signupData = {

            nombreCompleto: document.getElementById('signup-name').value,

            nombreDespacho: document.getElementById('signup-despacho').value,

            email: document.getElementById('signup-email').value,

            password: document.getElementById('signup-password').value,

        };



        submitButton.disabled = true;

        submitButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Creando...`;



        try {

            const { data, error } = await supabase.functions.invoke('create-despacho-and-user', { body: signupData });

            if (error) throw error;

            if (data.error) throw new Error(data.error);



            showToast('¡Cuenta creada! Por favor, inicia sesión.', 'success');

            document.getElementById('signup-view').classList.add('d-none');

            document.getElementById('login-view').classList.remove('d-none');

            form.reset();

            form.classList.remove('was-validated');

        } catch (error) {

            handleError(error, 'signup');

        } finally {

            submitButton.disabled = false;

            submitButton.textContent = 'Crear Cuenta';

        }

    });



    document.getElementById('show-signup').addEventListener('click', (e) => {

        e.preventDefault();

        document.getElementById('login-view').classList.add('d-none');

        document.getElementById('signup-view').classList.remove('d-none');

    });



    document.getElementById('show-login').addEventListener('click', (e) => {

        e.preventDefault();

        document.getElementById('signup-view').classList.add('d-none');

        document.getElementById('login-view').classList.remove('d-none');

    });

}



async function setupApp(user) {

    try {

        const { data: profile, error } = await supabase.from('perfiles').select('*, despachos(*)').eq('id', user.id).single();

        if (error || !profile) {

            throw new Error("Perfil no encontrado");

        }

        

        state.currentUserProfile = profile;



        document.getElementById('user-name').textContent = profile.nombre_completo || user.email;

        document.getElementById('user-role').textContent = profile.rol || 'Abogado';

        document.getElementById('despacho-name').textContent = profile.despachos?.nombre || 'Mi Despacho';

        

        if (profile.rol === 'admin') {

            document.getElementById('nav-admin').classList.remove('d-none');

            document.getElementById('nav-admin_juicios').classList.remove('d-none');

        }

        

        document.getElementById('app-container').classList.remove('d-none');

        document.getElementById('loading-container').classList.add('d-none');

        document.getElementById('auth-container').classList.add('d-none');

        await fetchAllInitialData();

        setupNavigation();
        setupMobileNavigation();

        // setupNotificationSystem();

        

        const lastView = sessionStorage.getItem('lastView') || 'dashboard';

        switchView(lastView); 

        

        setupActionListeners();

    } catch (error) {

        handleError(error, 'setupApp');

        await supabase.auth.signOut();

    }

}



function showLoginScreen() {
    document.getElementById('auth-container').classList.remove('d-none');
    document.getElementById('loading-container').classList.add('d-none');
    document.getElementById('app-container').classList.add('d-none');
    sessionStorage.removeItem('lastView');
}


function setupMobileNavigation() {

    const sidebar = document.querySelector('.sidebar');

    const toggleButton = document.querySelector('.mobile-sidebar-toggle');

    const overlay = document.querySelector('.sidebar-overlay');

    

    if (toggleButton) {

        toggleButton.addEventListener('click', () => {

            sidebar.classList.toggle('show');

            overlay.classList.toggle('d-none');

        });

    }



    if (overlay) {

        overlay.addEventListener('click', () => {

            sidebar.classList.remove('show');

            overlay.classList.add('d-none');

        });

    }

}



function setupExpedientesFilters() {

    const filterEstado = document.getElementById('filter-estado');

    const filterEtapa = document.getElementById('filter-etapa');

    const filterFechaDesde = document.getElementById('filter-fecha-desde');

    const filterFechaHasta = document.getElementById('filter-fecha-hasta');

    

    const applyFilters = () => {

        state.currentPage = 0;

        const searchTerm = document.getElementById('search-expediente').value.toLowerCase();

        

        const filteredData = state.allExpedientes.filter(exp => {

            const matchesSearch = exp.nro_expediente.toLowerCase().includes(searchTerm) || exp.caratula.toLowerCase().includes(searchTerm) || (exp.clientes?.nombre && exp.clientes.nombre.toLowerCase().includes(searchTerm));

            const matchesEstado = !filterEstado.value || exp.estado === filterEstado.value;

            const matchesEtapa = !filterEtapa.value || exp.etapas_proceso?.nombre === filterEtapa.value;

            const matchesFecha = (!filterFechaDesde.value || new Date(exp.fecha_creacion) >= new Date(filterFechaDesde.value)) && (!filterFechaHasta.value || new Date(exp.fecha_creacion) <= new Date(filterFechaHasta.value));

            

            return matchesSearch && matchesEstado && matchesEtapa && matchesFecha;

        });

        

        renderExpedientes(filteredData, state.currentPage);

    };



    if (filterEstado) filterEstado.addEventListener('change', applyFilters);

    if (filterEtapa) filterEtapa.addEventListener('change', applyFilters);

    if (filterFechaDesde) filterFechaDesde.addEventListener('change', applyFilters);

    if (filterFechaHasta) filterFechaHasta.addEventListener('change', applyFilters);

}



document.addEventListener('DOMContentLoaded', () => {
    setupAuthEventListeners();

    const modals = ['nuevoExpedienteModal', 'editarExpedienteModal', 'nuevoClienteModal', 'nuevoJuicioModal', 'editarEtapasModal', 'nuevoEventoModal', 'confirmDeleteModal', 'nuevoPlazoModal', 'editarPlazoModal'];

    [state.nuevoExpedienteModal, state.editarExpedienteModal, state.nuevoClienteModal, state.nuevoJuicioModal, state.editarEtapasModal, state.nuevoEventoModal, state.confirmDeleteModalInstance, state.nuevoPlazoModal, state.editarPlazoModal] = modals.map(id => 

        document.getElementById(id) ? new bootstrap.Modal(document.getElementById(id)) : null

    );



    const eventExpedienteSelect = document.getElementById('event-expediente');

    if (eventExpedienteSelect) {

        state.eventExpedienteChoices = new Choices(eventExpedienteSelect, {

            searchEnabled: true,

            removeItemButton: true,

            placeholder: true,

            placeholderValue: 'Busca o selecciona...',

            itemSelectText: '',

        });

    }



    document.getElementById('confirm-delete-btn').addEventListener('click', async () => {

        if (typeof state.confirmDeleteCallback === 'function') {

            await state.confirmDeleteCallback();

        }

        state.confirmDeleteModalInstance.hide();

    });



    document.getElementById('nuevoExpedienteModal').addEventListener('show.bs.modal', () => {

        document.getElementById('exp-cliente').innerHTML = '<option selected disabled value="">Seleccione...</option>' + state.allClientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

        document.getElementById('exp-fuero').innerHTML = '<option selected disabled value="">Seleccione...</option>' + Object.keys(state.juiciosOrganizados).map(f => `<option value="${f}">${f}</option>`).join('');

    });



    document.getElementById('nuevoEventoModal').addEventListener('show.bs.modal', async () => {

        try {

            const { data, error } = await supabase.from('expedientes').select('id, caratula').eq('despacho_id', state.currentUserProfile.despacho_id);

            if (error) throw error;

            

            const choicesData = data.map(exp => ({ value: exp.id, label: exp.caratula }));

            choicesData.unshift({ value: '', label: 'Ninguno', selected: true });

            state.eventExpedienteChoices.setChoices(choicesData, 'value', 'label', true);

        } catch (error) {

            handleError(error, 'nuevoEventoModal show');

        }

    });



    document.getElementById('nuevoPlazoModal')?.addEventListener('show.bs.modal', () => {

        populatePlazoFormSelects('#plazo-fuero', '#plazo-tipo-proceso');

    });



    ['nuevoClienteModal', 'nuevoExpedienteModal'].forEach(id => {

        const modalEl = document.getElementById(id);

        if (modalEl) {

            modalEl.addEventListener('hidden.bs.modal', () => {

                const form = modalEl.querySelector('form');

                if (form) {

                    form.classList.remove('was-validated');

                    form.reset();

                }

            });

        }

    });



    document.getElementById('exp-fuero').addEventListener('change', (e) => {

        const fuero = e.target.value;

        const procesoSelect = document.getElementById('exp-tipo-proceso');

        procesoSelect.innerHTML = '<option selected disabled value="">Seleccione...</option>' + Object.keys(state.juiciosOrganizados[fuero] || {}).map(p => `<option value="${p}">${p}</option>`).join('');

        procesoSelect.disabled = false;

        document.getElementById('exp-tipo-juicio').disabled = true;

    });

    document.getElementById('exp-tipo-proceso').addEventListener('change', (e) => {

        const fuero = document.getElementById('exp-fuero').value;

        const proceso = e.target.value;

        const juicioSelect = document.getElementById('exp-tipo-juicio');

        juicioSelect.innerHTML = '<option selected disabled value="">Seleccione...</option>' + (state.juiciosOrganizados[fuero]?.[proceso] || []).map(j => `<option value="${j.id}">${j.nombre}</option>`).join('');

        juicioSelect.disabled = false;

    });



    ['exp-cliente', 'exp-contraparte', 'exp-tipo-juicio'].forEach(id => {

        const el = document.getElementById(id);

        el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', generateCaratula);

    });

    

    ['exp-monto', 'edit-exp-monto'].forEach(id => document.getElementById(id)?.addEventListener('input', (e) => formatMonto(e.target)));

    ['exp-cuenta', 'edit-exp-cuenta'].forEach(id => document.getElementById(id)?.addEventListener('input', (e) => formatCuentaCorriente(e.target)));



    document.getElementById('new-expediente-form')?.addEventListener('submit', (e) => handleNewExpedienteSubmit(e, false));

    document.getElementById('save-and-add-another-btn')?.addEventListener('click', (e) => handleNewExpedienteSubmit(e, true));

    document.getElementById('edit-expediente-form')?.addEventListener('submit', handleEditExpedienteSubmit);

    document.getElementById('new-client-form')?.addEventListener('submit', handleNewClientSubmit);

    document.getElementById('new-juicio-form')?.addEventListener('submit', handleNewJuicioSubmit);

    document.getElementById('new-etapa-form')?.addEventListener('submit', handleNewEtapaSubmit);

    document.getElementById('new-actuacion-form')?.addEventListener('submit', handleNewActuacionSubmit);

    document.getElementById('new-event-form')?.addEventListener('submit', handleNewEventSubmit);

    document.getElementById('create-user-form')?.addEventListener('submit', handleCreateUserSubmit);

    document.getElementById('new-plazo-form')?.addEventListener('submit', handleNewPlazoSubmit);
    document.getElementById('edit-plazo-form')?.addEventListener('submit', handleEditPlazoSubmit);
    document.getElementById('new-tarea-form')?.addEventListener('submit', handleNewTareaSubmit);
    document.getElementById('upload-expediente-document-form')?.addEventListener('submit', handleExpedienteFileUpload);
    document.getElementById('new-area-form')?.addEventListener('submit', handleNewAreaSubmit);
    document.getElementById('new-fuero-form')?.addEventListener('submit', handleNewFueroSubmit);
    document.getElementById('areas-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete-area');
        if (btn) handleDeleteArea(btn.dataset.areaId, btn.dataset.areaNombre);
    });
    document.getElementById('fueros-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete-fuero');
        if (btn) handleDeleteFuero(btn.dataset.fueroId, btn.dataset.fueroNombre);
    });


    supabase.auth.onAuthStateChange((_, session) => {
        if (session?.user) {
            setupApp(session.user);
            return;
        }
        resetState({ preserveUi: true });
        showLoginScreen();
    });
});




