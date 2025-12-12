import { store } from './store/store';
import { supabase } from './services/supabaseClient';
import * as Service from './services/supabaseService';
import * as UI from './ui/index';
import { handleError, showToast, generateCaratula, formatMonto, formatCuentaCorriente, getStatusBadge } from './utils';
import { calcularLiquidacion, CausaTerminacion, calcularAntiguedad } from './utils/laborCalculator';
import Choices from 'choices.js';
import * as bootstrap from 'bootstrap';

// Make bootstrap available globally if needed by legacy scripts or HTML
(window as any).bootstrap = bootstrap;

let authListenersRegistered = false;

// --- EVENT LISTENERS & NAVIGATION ---

function setupActionListeners() {
    const handleTableButtonClick = (e: Event) => {
        const target = (e.target as HTMLElement).closest('button');
        if (!target) return;

        const expedienteId = target.dataset.expedienteId;
        if (!expedienteId) return;

        if (target.classList.contains('btn-edit')) handleEdit(expedienteId);
        else if (target.classList.contains('btn-delete')) UI.handleDeleteExpediente(expedienteId);
        else if (target.classList.contains('btn-advance')) handleAdvance(expedienteId);
    };

    document.getElementById('expedientes-table-body')?.addEventListener('click', handleTableButtonClick);
    document.getElementById('cliente-expedientes-table-body')?.addEventListener('click', handleTableButtonClick);

    document.getElementById('juicios-grid')?.addEventListener('click', (e) => {

        const target = (e.target as HTMLElement).closest('button.btn-edit-etapas');
        if (target && target instanceof HTMLElement) {
            handleEditEtapas(target.dataset.juicioId!, target.dataset.juicioNombre!);
        }
    });

    document.getElementById('back-to-list-btn')?.addEventListener('click', () => switchView('expedientes'));
    document.getElementById('back-to-clients-btn')?.addEventListener('click', () => switchView('clientes'));

    document.getElementById('clientes-folder-container')?.addEventListener('click', (e) => {
        const folder = (e.target as HTMLElement).closest('.client-folder');
        if (folder && folder instanceof HTMLElement) {
            handleFolderClick(folder.dataset.clienteId!, folder.dataset.clienteNombre!);
        }
    });

    document.getElementById('upload-document-form')?.addEventListener('submit', UI.handleFileUpload);
    document.getElementById('upload-expediente-document-form')?.addEventListener('submit', UI.handleExpedienteFileUpload);

    document.getElementById('documentos-list')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const downloadBtn = target.closest('.btn-download');
        const deleteBtn = target.closest('.btn-delete-doc');
        if (downloadBtn instanceof HTMLElement) UI.handleFileDownload(downloadBtn.dataset.filename!);
        if (deleteBtn instanceof HTMLElement) UI.handleFileDelete(deleteBtn.dataset.filename!);
    });

    document.getElementById('expediente-timeline')?.addEventListener('click', (e) => {
        const stage = (e.target as HTMLElement).closest('.timeline-stage') as HTMLElement | null;
        if (stage?.dataset.etapaId) {
            UI.handleStageUpdate(stage.dataset.etapaId);
        }
    });

    const dashboardShortcutHandler = (e: Event) => {
        const btn = (e.target as HTMLElement).closest('button[data-expediente-id]');
        if (!btn || !(btn instanceof HTMLElement)) return;
        handleAdvance(btn.dataset.expedienteId!);
    };

    document.getElementById('dashboard-eventos-list')?.addEventListener('click', dashboardShortcutHandler);
    document.getElementById('dashboard-actuaciones-list')?.addEventListener('click', dashboardShortcutHandler);

    document.getElementById('expediente-documentos-list')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const downloadBtn = target.closest('.btn-download-expediente');
        const deleteBtn = target.closest('.btn-delete-doc-expediente');

        if (downloadBtn instanceof HTMLElement) UI.handleExpedienteFileDownload(downloadBtn.dataset.filename!, downloadBtn.dataset.expedienteId!);
        if (deleteBtn instanceof HTMLElement) UI.handleExpedienteFileDelete(deleteBtn.dataset.filename!, deleteBtn.dataset.expedienteId!);
    });

    document.getElementById('members-table-body')?.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const saveBtn = target.closest('.btn-save-role');
        const deleteBtn = target.closest('.btn-delete-member');

        if (saveBtn instanceof HTMLElement) {
            const memberId = saveBtn.dataset.memberId!;
            UI.handleRoleSave(memberId);
        }

        if (deleteBtn instanceof HTMLElement) {
            const memberId = deleteBtn.dataset.memberId!;
            const confirmDelete = await UI.showConfirmDeleteModal('Eliminar Miembro', '¿Estás seguro de eliminar este miembro del despacho?');
            if (confirmDelete) {
                try {
                    const { error } = await Service.deleteMember(memberId);
                    if (error) throw error;
                    UI.showToast('Miembro eliminado correctamente.', 'success');
                    const members = await Service.fetchMembers();
                    UI.renderMembers(members || []);
                } catch (error) {
                    UI.handleError(error, 'handleDeleteMember');
                }
            }
        }
    });

    // Admin Panel Listeners
    document.getElementById('update-despacho-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('despacho-name') as HTMLInputElement;
        const idInput = document.getElementById('despacho-id-display') as HTMLInputElement;

        try {
            const { error } = await Service.updateDespacho(idInput.value, { nombre: nameInput.value });
            if (error) throw error;
            UI.showToast('Datos del despacho actualizados.', 'success');
            UI.renderLicenseDashboard(); // Refresh dashboard cards
        } catch (error) {
            UI.handleError(error, 'updateDespacho');
        }
    });

    document.getElementById('refresh-license-btn')?.addEventListener('click', () => {
        UI.renderLicenseDashboard();
    });

    document.getElementById('save-etapas-btn')?.addEventListener('click', UI.handleSaveEtapas);

    document.getElementById('prev-month-btn')?.addEventListener('click', () => {
        const newDate = new Date(store.state.currentDate);
        newDate.setDate(1); // normalize to avoid skipping months on 30/31
        newDate.setMonth(newDate.getMonth() - 1);
        store.state.currentDate = newDate;
        UI.renderCalendar();
    });

    document.getElementById('next-month-btn')?.addEventListener('click', () => {
        const newDate = new Date(store.state.currentDate);
        newDate.setDate(1); // normalize to avoid skipping months on 30/31
        newDate.setMonth(newDate.getMonth() + 1);
        store.state.currentDate = newDate;
        UI.renderCalendar();
    });

    document.getElementById('prev-page-item')?.addEventListener('click', (e) => {
        e.preventDefault();
        const searchInput = document.getElementById('search-expediente') as HTMLInputElement;
        const filteredData = filterExpedientes(searchInput.value);
        if (store.state.currentPage > 0) {
            store.state.currentPage--;
            UI.renderExpedientes(filteredData, store.state.currentPage);
        }
    });

    document.getElementById('next-page-item')?.addEventListener('click', (e) => {
        e.preventDefault();
        const searchInput = document.getElementById('search-expediente') as HTMLInputElement;
        const filteredData = filterExpedientes(searchInput.value);
        if ((store.state.currentPage + 1) * store.state.PAGE_SIZE < filteredData.length) {
            store.state.currentPage++;
            UI.renderExpedientes(filteredData, store.state.currentPage);
        }
    });

    document.getElementById('juicios-prev-page-item')?.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        if (store.state.juiciosCurrentPage > 0 && !target.classList.contains('disabled')) {
            store.state.juiciosCurrentPage--;
            UI.applyJuiciosFilters(store.state.juiciosCurrentPage);
        }
    });

    document.getElementById('juicios-next-page-item')?.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        const searchTerm = (document.getElementById('search-juicio') as HTMLInputElement).value.toLowerCase();
        const filteredData = store.state.allJuicios.filter(j =>
            j.nombre.toLowerCase().includes(searchTerm) ||
            ((j.areas?.nombre || j.area || '').toLowerCase().includes(searchTerm)) ||
            ((j.fueros?.nombre || '').toLowerCase().includes(searchTerm)) ||
            ((j.tipo_proceso || '').toLowerCase().includes(searchTerm))
        );
        const totalPages = Math.ceil(filteredData.length / store.state.JUICIOS_PAGE_SIZE);

        if (store.state.juiciosCurrentPage < totalPages - 1 && !target.classList.contains('disabled')) {
            store.state.juiciosCurrentPage++;
            UI.applyJuiciosFilters(store.state.juiciosCurrentPage);
        }
    });


    document.getElementById('plazos-prev-page-item')?.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        if (store.state.plazosCurrentPage > 0 && !target.classList.contains('disabled')) {
            store.state.plazosCurrentPage--;
            UI.applyPlazosFilters(store.state.plazosCurrentPage);
        }
    });

    document.getElementById('plazos-next-page-item')?.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        if (!target.classList.contains('disabled')) {
            store.state.plazosCurrentPage++;
            UI.applyPlazosFilters(store.state.plazosCurrentPage);
        }
    });

    document.getElementById('calendar-grid')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const eventEl = target.closest('.calendar-event') as HTMLElement;
        const dayEl = target.closest('.calendar-day:not(.other-month)') as HTMLElement;

        if (eventEl && eventEl.dataset.expedienteId) {
            handleAdvance(eventEl.dataset.expedienteId);
        } else if (dayEl && dayEl.dataset.date) {
            handleDayClick(dayEl.dataset.date);
        }
    });

    document.getElementById('search-expediente')?.addEventListener('input', (e) => {
        store.state.currentPage = 0;
        const filteredData = filterExpedientes((e.target as HTMLInputElement).value || '');
        UI.renderExpedientes(filteredData, store.state.currentPage);
    });

    function filterExpedientes(searchTerm: string) {
        searchTerm = searchTerm.toLowerCase();
        return store.state.allExpedientes.filter(exp =>
            exp.nro_expediente.toLowerCase().includes(searchTerm) ||
            exp.caratula.toLowerCase().includes(searchTerm) ||
            (exp.clientes?.nombre && exp.clientes.nombre.toLowerCase().includes(searchTerm))
        );
    }

    document.getElementById('search-cliente')?.addEventListener('input', (e) => {
        const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
        const filtered = store.state.allClientes.filter(cli =>
            cli.nombre.toLowerCase().includes(searchTerm) ||
            (cli.cedula && cli.cedula.toLowerCase().includes(searchTerm)) ||
            (cli.email && cli.email.toLowerCase().includes(searchTerm))
        );
        UI.renderClientes(filtered);
    });

    document.getElementById('search-juicio')?.addEventListener('input', () => {
        store.state.juiciosCurrentPage = 0;
        UI.applyJuiciosFilters(store.state.juiciosCurrentPage);
    });

    document.getElementById('plazos-search-input')?.addEventListener('input', () => {
        store.state.plazosCurrentPage = 0;
        UI.applyPlazosFilters(store.state.plazosCurrentPage);
    });

    document.getElementById('plazos-filter-fuero')?.addEventListener('change', () => {
        store.state.plazosCurrentPage = 0;
        UI.applyPlazosFilters(store.state.plazosCurrentPage);
    });

    document.getElementById('plazos-reset-filters')?.addEventListener('click', () => {
        (document.getElementById('plazos-search-input') as HTMLInputElement).value = '';
        (document.getElementById('plazos-filter-fuero') as HTMLSelectElement).value = '';
        store.state.plazosCurrentPage = 0;
        UI.applyPlazosFilters(store.state.plazosCurrentPage);
    });

    document.getElementById('plazos-list-container')?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const editBtn = target.closest('.btn-edit-plazo');
        const deleteBtn = target.closest('.btn-delete-plazo');
        if (editBtn instanceof HTMLElement) handleEditPlazo(editBtn.dataset.plazoId!);
        if (deleteBtn instanceof HTMLElement) handleDeletePlazo(deleteBtn.dataset.plazoId!);
    });


    const tareasList = document.getElementById('tareas-list');
    if (tareasList) {
        tareasList.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const check = target.closest('.tarea-check') as HTMLInputElement;
            const deleteBtn = target.closest('.btn-delete-tarea') as HTMLElement;
            if (check) {
                const tareaId = check.dataset.tareaId!;
                const isCompletada = check.checked;
                check.nextElementSibling?.classList.toggle('text-decoration-line-through', isCompletada);
                check.nextElementSibling?.classList.toggle('text-muted', isCompletada);
                handleTareaStatusChange(tareaId, isCompletada);
            }
            if (deleteBtn) {
                handleDeleteTarea(deleteBtn.dataset.tareaId!);
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
            const viewName = (e.currentTarget as HTMLElement).dataset.view;
            if (viewName) {
                switchView(viewName);
            }
        });
    });

    document.getElementById('logout-button')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        sessionStorage.removeItem('lastView');
        store.resetState({ preserveUi: true });
        window.location.reload();
    });
}

export function switchView(viewName: string) {
    document.querySelectorAll('.view-container').forEach(view => view.classList.add('d-none'));
    document.querySelectorAll('.sidebar .nav-link').forEach(link => link.classList.remove('active'));

    const viewId = `${viewName}-view`;
    const navId = `nav-${viewName}`;

    const viewEl = document.getElementById(viewId);
    const navEl = document.getElementById(navId);

    if (viewEl) viewEl.classList.remove('d-none');
    if (navEl) navEl.classList.add('active');

    sessionStorage.setItem('lastView', viewName);

    const fetchActions: Record<string, () => void> = {
        'dashboard': () => renderDashboardData(),
        'clientes': () => Service.fetchClientes().then(() => UI.renderClientes()),
        'admin': () => {
            Service.fetchMembers().then(members => UI.renderMembers(members || []));
            UI.renderLicenseDashboard();
        },
        'admin_juicios': () => {
            store.state.juiciosCurrentPage = 0;
            UI.applyJuiciosFilters(store.state.juiciosCurrentPage);
        },
        'expedientes': () => {
            store.state.currentPage = 0;
            refreshExpedientesAndRender();
        },
        'calendario': () => UI.renderCalendar(),
        'calculadora': () => { }, // sin fetch, vista estática
        'plazos': () => fetchAndRenderPlazos(),
    };

    if (fetchActions[viewName]) {
        fetchActions[viewName]();
    }
}

function handleDayClick(dateString: string) {
    const eventDateInput = document.getElementById('event-date') as HTMLInputElement;
    eventDateInput.value = dateString;
    store.state.nuevoEventoModal.show();
}

function handleEdit(id: string) {
    const expediente = store.state.allExpedientes.find(exp => exp.id == id);
    if (!expediente) return;

    (document.getElementById('edit-exp-id') as HTMLInputElement).value = expediente.id;
    (document.getElementById('edit-exp-nro') as HTMLInputElement).value = expediente.nro_expediente;
    (document.getElementById('edit-exp-caratula') as HTMLInputElement).value = expediente.caratula;
    (document.getElementById('edit-exp-contraparte') as HTMLInputElement).value = expediente.contraparte || '';
    (document.getElementById('edit-exp-estado') as HTMLSelectElement).value = expediente.estado;
    (document.getElementById('edit-exp-monto') as HTMLInputElement).value = expediente.monto_demanda ? new Intl.NumberFormat('es-PY').format(expediente.monto_demanda) : '';
    (document.getElementById('edit-exp-cuenta') as HTMLInputElement).value = expediente.cuenta_corriente_judicial || '';

    const clienteSelect = document.getElementById('edit-exp-cliente') as HTMLSelectElement;
    clienteSelect.innerHTML = store.state.allClientes.map(c => `<option value="${c.id}" ${c.id === expediente.cliente_id ? 'selected' : ''}>${c.nombre}</option>`).join('');

    const juicioSelect = document.getElementById('edit-exp-tipo-juicio') as HTMLSelectElement;
    juicioSelect.innerHTML = store.state.allJuicios.map(t => `<option value="${t.id}" ${t.id === expediente.tipo_juicio_id ? 'selected' : ''}>${t.nombre}</option>`).join('');

    store.state.editarExpedienteModal.show();
}

function handleFolderClick(clienteId: string, clienteNombre: string) {
    store.state.currentClienteId = clienteId;
    const titleEl = document.getElementById('cliente-expediente-title');
    if (titleEl) titleEl.textContent = `Expedientes de: ${clienteNombre}`;

    const expedientesCliente = store.state.allExpedientes.filter(exp => exp.cliente_id === clienteId);

    const tableBody = document.getElementById('cliente-expedientes-table-body');
    if (tableBody) {
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
    }

    Service.fetchDocumentos(clienteId).then(docs => UI.renderDocumentos(docs || []));
    switchView('cliente-expedientes');
}

function setupAuthEventListeners() {
    if (authListenersRegistered) return;
    authListenersRegistered = true;

    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        if (!form.checkValidity()) {
            e.stopPropagation();
            form.classList.add('was-validated');
            return;
        }

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: (document.getElementById('login-email') as HTMLInputElement).value,
                password: (document.getElementById('login-password') as HTMLInputElement).value
            });

            if (error) handleError(error, 'login');
        } catch (error) {
            handleError(error, 'login');
        }
    });

    document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const submitButton = form.querySelector('button') as HTMLButtonElement;

        if (!form.checkValidity()) {
            e.stopPropagation();
            form.classList.add('was-validated');
            return;
        }

        const signupData = {
            nombreCompleto: (document.getElementById('signup-name') as HTMLInputElement).value,
            nombreDespacho: (document.getElementById('signup-despacho') as HTMLInputElement).value,
            email: (document.getElementById('signup-email') as HTMLInputElement).value,
            password: (document.getElementById('signup-password') as HTMLInputElement).value,
        };

        submitButton.disabled = true;
        submitButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Creando...`;

        try {
            const { data, error } = await supabase.functions.invoke('create-despacho-and-user', { body: signupData });
            if (error) throw error;
            if (data.error) throw new Error(data.error);

            showToast('¡Cuenta creada! Por favor, inicia sesión.', 'success');
            document.getElementById('signup-view')?.classList.add('d-none');
            document.getElementById('login-view')?.classList.remove('d-none');
            form.reset();
            form.classList.remove('was-validated');
        } catch (error) {
            handleError(error, 'signup');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Crear Cuenta';
        }
    });

    document.getElementById('show-signup')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-view')?.classList.add('d-none');
        document.getElementById('signup-view')?.classList.remove('d-none');
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signup-view')?.classList.add('d-none');
        document.getElementById('login-view')?.classList.remove('d-none');
    });
}

async function setupApp(user: any) {
    try {
        const { data: profile, error } = await supabase.from('perfiles').select('*, despachos(*)').eq('id', user.id).single();
        if (error || !profile) {
            throw new Error("Perfil no encontrado");
        }

        store.state.currentUserProfile = profile;

        // === VERIFICACION DE LICENCIA ===
        const licenseCheck = await checkLicense(profile.despacho_id);
        const daysLeft = licenseCheck.daysLeft ?? 0;
        const isExpired = daysLeft <= 0 && (licenseCheck.status === 'EXPIRADO' || licenseCheck.status === 'SUSPENDIDO');

        if (isExpired) {
            showLicenseBlockedScreen(licenseCheck.message || 'Licencia expirada', licenseCheck.status);
            return; // No continuar con setupApp
        }

        // Mostrar aviso si quedan pocos días de prueba
        if (licenseCheck.status === 'PRUEBA' && daysLeft > 0 && daysLeft <= 7) {
            showToast(`⚠ Tu período de prueba vence en ${daysLeft} días`, 'warning');
        }
        // === FIN VERIFICACION DE LICENCIA ===

        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = profile.nombre_completo || user.email;

        const userRoleEl = document.getElementById('user-role');
        if (userRoleEl) userRoleEl.textContent = profile.rol || 'Abogado';

        const despachoNameEl = document.getElementById('despacho-name');
        if (despachoNameEl) despachoNameEl.textContent = profile.despachos?.nombre || 'Mi Despacho';

        if (profile.rol === 'admin') {
            document.getElementById('nav-admin')?.classList.remove('d-none');
            document.getElementById('nav-admin_juicios')?.classList.remove('d-none');
        }

        document.getElementById('app-container')?.classList.remove('d-none');
        document.getElementById('loading-container')?.classList.add('d-none');
        document.getElementById('auth-container')?.classList.add('d-none');
        document.getElementById('license-blocked-container')?.classList.add('d-none');

        await Service.fetchAllInitialData();
        await Service.fetchFeriados(new Date().getFullYear());
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

// Función para verificar licencia con 60 días de gracia local
async function checkLicense(despachoId: string): Promise<{ allowed: boolean; status: string; daysLeft?: number; message: string; plan?: string; expiresAt?: any }> {
    try {
        const env = (import.meta as any)?.env || {};
        const host = window.location?.hostname || '';
        const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
        const isDev = env?.DEV || env?.VITE_LICENSE_BYPASS_DEV === 'true' || env?.VITE_LICENSE_BYPASS_DEV === true || isLocalHost;
        if (isDev) {
            return { allowed: true, status: 'DEV', message: 'Licencia omitida en entorno de desarrollo' };
        }

        // Primero intentamos validar en Supabase (RPC)
        const { data, error } = await supabase.rpc('verify_license_sql', { despacho_id: despachoId });
        const normalized = normalizeLicenseResponse(data);
        if (!error && normalized) {
            return normalized;
        }

        // Si el backend no responde, caemos a gracia local de 60 días
        console.warn('RPC verify_license_sql falló, usando gracia local 60 días:', error);
        const localKey = 'lexys_trial_start';
        const stored = localStorage.getItem(localKey);
        const startDate = stored ? new Date(stored) : new Date();
        if (!stored) localStorage.setItem(localKey, startDate.toISOString());

        const msDiff = Date.now() - startDate.getTime();
        const daysUsed = Math.floor(msDiff / (1000 * 60 * 60 * 24));
        const daysLeft = Math.max(60 - daysUsed, 0);

        return {
            allowed: true,
            status: 'PRUEBA',
            daysLeft,
            message: 'Período de prueba local activo (sin conexión al verificador)',
            plan: 'TRIAL',
            expiresAt: startDate
        };
    } catch (err) {
        console.warn('Error en checkLicense, continúa modo prueba:', err);
        return { allowed: true, status: 'PRUEBA', daysLeft: 60, message: 'Error de conexión al verificar licencia. Modo prueba activado.', plan: 'TRIAL', expiresAt: null };
    }
}

// Función para mostrar pantalla de bloqueo de licencia
function showLicenseBlockedScreen(message: string, status: string) {
    document.getElementById('app-container')?.classList.add('d-none');
    document.getElementById('loading-container')?.classList.add('d-none');
    document.getElementById('auth-container')?.classList.add('d-none');

    const blockedContainer = document.getElementById('license-blocked-container');
    if (blockedContainer) {
        blockedContainer.classList.remove('d-none');

        const messageEl = document.getElementById('license-blocked-message');
        if (messageEl) messageEl.textContent = message;

        const statusEl = document.getElementById('license-blocked-status');
        if (statusEl) {
            statusEl.textContent = status === 'EXPIRADO' ? 'Período de Prueba Finalizado' :
                status === 'SUSPENDIDO' ? 'Licencia Suspendida' : 'Acceso Restringido';
        }
    }
}

function showLoginScreen() {
    document.getElementById('auth-container')?.classList.remove('d-none');
    document.getElementById('loading-container')?.classList.add('d-none');
    document.getElementById('app-container')?.classList.add('d-none');
    sessionStorage.removeItem('lastView');
}

function setupMobileNavigation() {
    const sidebar = document.querySelector('.sidebar');
    const toggleButton = document.querySelector('.mobile-sidebar-toggle');
    const overlay = document.querySelector('.sidebar-overlay');

    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            sidebar?.classList.toggle('show');
            overlay?.classList.toggle('d-none');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar?.classList.remove('show');
            overlay.classList.add('d-none');
        });
    }
}

function setupLaborCalculator() {
    // Wizard State
    let currentStep = 1;
    const totalSteps = 4;

    // Elements
    const form = document.getElementById('calc-wizard-form') as HTMLFormElement | null;
    const prevBtn = document.getElementById('wizard-prev-btn') as HTMLButtonElement;
    const nextBtn = document.getElementById('wizard-next-btn') as HTMLButtonElement;
    const saveBtn = document.getElementById('wizard-save-btn') as HTMLButtonElement;
    const progressBar = document.getElementById('wizard-progress-bar') as HTMLDivElement;
    const stepLabels = document.querySelectorAll('#wizard-steps-labels span');
    const historyPanel = document.getElementById('calc-history-panel');
    const historyToggleBtn = document.getElementById('calc-history-toggle-btn');
    const resetBtn = document.getElementById('calc-reset-btn');
    const resultDashboard = document.getElementById('calc-result-dashboard');

    // NEW ELEMENTS FOR LOGIC
    const tipoContratoSelect = document.getElementById('calc-tipo-contrato') as HTMLSelectElement | null;
    const fechaFinContainer = document.getElementById('calc-fecha-fin-container') as HTMLDivElement | null;
    const fechaFinInput = document.getElementById('calc-fecha-fin-contrato') as HTMLInputElement | null;

    if (tipoContratoSelect && fechaFinContainer && fechaFinInput) {
        tipoContratoSelect.addEventListener('change', () => {
            if (tipoContratoSelect.value === 'plazo_fijo') {
                fechaFinContainer.style.display = 'block';
                fechaFinInput.setAttribute('required', 'true');
            } else {
                fechaFinContainer.style.display = 'none';
                fechaFinInput.removeAttribute('required');
                fechaFinInput.value = '';
            }
        });
    }
    const clienteSelect = document.getElementById('calc-cliente-select') as HTMLSelectElement; // Note: This might need to be re-added to the new HTML if I missed it, or I should add it to Step 1 or 4. 
    // Wait, I didn't add clienteSelect to the new HTML! I should add it to Step 1 or 4. 
    // I'll add it to Step 1 for now via code or just assume it's there (it's not).
    // I will inject it dynamically in Step 1 for now or just handle it if I missed it.
    // Actually, I missed adding the client selector in the HTML replacement. I should add it to the "Datos del Contrato" or "Resultados".
    // Let's add it to Step 1 in the HTML first? No, I can't go back easily. I'll just append it to Step 1 programmatically or ignore it for a moment?
    // No, saving is a requirement. I'll add it to Step 4 (Resultados) so they can choose client before saving.

    if (!form) return;

    // Helper: Format Money
    const formatMoney = (amount: number) => new Intl.NumberFormat('es-PY').format(amount);
    const parseMoney = (value: string) => {
        const digits = (value || '').toString().replace(/\D/g, '');
        const num = parseInt(digits || '0', 10);
        return isNaN(num) ? 0 : num;
    };
    const formatMoneyInput = (input: HTMLInputElement) => {
        const digits = input.value.replace(/\D/g, '');
        if (!digits) {
            input.value = '';
            return;
        }
        input.value = new Intl.NumberFormat('es-PY').format(parseInt(digits, 10));
    };

    // --- WIZARD NAVIGATION ---
    const updateWizardUI = () => {
        // Update Progress Bar
        const progress = (currentStep / totalSteps) * 100;
        if (progressBar) progressBar.style.width = `${progress}%`;

        // Update Steps Visibility
        document.querySelectorAll('.wizard-step').forEach((el, index) => {
            if (index + 1 === currentStep) el.classList.remove('d-none');
            else el.classList.add('d-none');
        });

        // Update Labels
        stepLabels.forEach((el, index) => {
            const stepNum = index + 1;
            if (stepNum === currentStep) el.classList.add('fw-bold', 'text-primary');
            else el.classList.remove('fw-bold', 'text-primary');
        });

        // Update Buttons
        if (prevBtn) prevBtn.disabled = currentStep === 1;

        if (currentStep === totalSteps) {
            if (nextBtn) nextBtn.classList.add('d-none');
            if (saveBtn) saveBtn.classList.remove('d-none');
            performCalculation(); // Auto-calc on last step
        } else {
            if (nextBtn) nextBtn.classList.remove('d-none');
            if (nextBtn) nextBtn.textContent = 'Siguiente';
            if (saveBtn) saveBtn.classList.add('d-none');
        }
    };

    const validateStep = (step: number): boolean => {
        const stepEl = document.getElementById(`step-${step}`);
        if (!stepEl) return true;
        const inputs = stepEl.querySelectorAll('input[required], select[required]');
        let valid = true;
        inputs.forEach(input => {
            if (!(input as HTMLInputElement).checkValidity()) {
                valid = false;
                (input as HTMLInputElement).reportValidity();
            }
        });
        return valid;
    };

    nextBtn?.addEventListener('click', () => {
        if (validateStep(currentStep)) {
            if (currentStep < totalSteps) {
                currentStep++;
                updateWizardUI();
            }
        }
    });

    prevBtn?.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            updateWizardUI();
        }
    });

    // Step 4 Back Button
    const prevBtnStep4 = document.getElementById('wizard-prev-btn-step4');
    prevBtnStep4?.addEventListener('click', () => {
        if (currentStep === 4) {
            currentStep = 3;
            updateWizardUI();
        }
    });

    resetBtn?.addEventListener('click', () => {
        if (confirm('¿Reiniciar calculadora?')) {
            form.reset();
            currentStep = 1;
            updateWizardUI();
            // Reset specific UI states
            document.getElementById('salarios-variables-container')?.classList.add('d-none');
        }
    });

    // --- STEP 1 LOGIC: DATES & SENIORITY ---
    // We don't need to display seniority explicitly anymore, but we calculate it for the result.
    // Maybe show a small badge? For now, just logic.

    // --- STEP 2 LOGIC: SALARIES ---
    const variableSalaryCheck = document.getElementById('calc-salario-variable') as HTMLInputElement;
    const variableSalaryContainer = document.getElementById('salarios-variables-container');
    const baseSalaryInput = document.getElementById('calc-salario-base') as HTMLInputElement;
    const salaryMonthInputs = Array.from(document.querySelectorAll('.calc-salario-mes')) as HTMLInputElement[];

    const moneyInputs = [
        baseSalaryInput,
        document.getElementById('calc-pendientes') as HTMLInputElement,
        document.getElementById('calc-anticipos') as HTMLInputElement,
        document.getElementById('calc-aguinaldo-pendiente') as HTMLInputElement,
        ...salaryMonthInputs
    ].filter(Boolean) as HTMLInputElement[];

    moneyInputs.forEach(inp => inp?.addEventListener('input', () => formatMoneyInput(inp)));

    variableSalaryCheck?.addEventListener('change', (e) => {
        const isVariable = (e.target as HTMLInputElement).checked;
        if (isVariable) {
            variableSalaryContainer?.classList.remove('d-none');
            baseSalaryInput.disabled = true;
            baseSalaryInput.value = '';
            baseSalaryInput.placeholder = 'Calculado autom.';
        } else {
            variableSalaryContainer?.classList.add('d-none');
            baseSalaryInput.disabled = false;
            baseSalaryInput.placeholder = '0';
        }
    });

    // --- CALCULATION LOGIC ---
    const getFormData = () => {
        const fechaIngreso = (document.getElementById('calc-fecha-ingreso') as HTMLInputElement).value;
        const fechaSalida = (document.getElementById('calc-fecha-salida') as HTMLInputElement).value;

        // Cause
        const causaInputs = document.getElementsByName('calc-causa');
        let causa: CausaTerminacion = 'despido_injustificado';
        causaInputs.forEach((inp) => {
            if ((inp as HTMLInputElement).checked) causa = (inp as HTMLInputElement).value as CausaTerminacion;
        });

        // Salaries
        const isVariable = variableSalaryCheck?.checked;
        let salarios6Meses: number[] = [];
        let salarioBase = 0;

        if (isVariable) {
            salaryMonthInputs.forEach(inp => salarios6Meses.push(parseMoney((inp as HTMLInputElement).value)));
            const validInputs = salarios6Meses.filter(n => n > 0);
            const sum = validInputs.reduce((a, b) => a + b, 0);
            salarioBase = validInputs.length ? sum / validInputs.length : 0;
        } else {
            salarioBase = parseMoney(baseSalaryInput.value);
            salarios6Meses = Array(6).fill(salarioBase);
        }

        // Remunerations (Annual) - For now, assume base * 12 or similar if not provided?
        // The new UI didn't include the 12 inputs for Aguinaldo to simplify. 
        // We can assume the "Salario Base" applies for the year or use the 6 months.
        // Let's use the 6 months repeated or just the base.
        const remuneracionesAnuales = Array(12).fill(salarioBase);

        return {
            fechaIngreso,
            fechaSalida,
            causa,
            estabilidadMaternal: (document.getElementById('calc-estabilidad-maternal') as HTMLInputElement).checked,
            salarioBaseMensual: salarioBase,
            salarios6Meses,
            remuneracionesAnuales,
            hijos: Number((document.getElementById('calc-hijos') as HTMLInputElement).value) || 0,
            vacacionesPrevias: Number((document.getElementById('calc-vacaciones-previas') as HTMLInputElement).value) || 0,
            pendientes: parseMoney((document.getElementById('calc-pendientes') as HTMLInputElement).value),
            horasExtraDiurnas: Number((document.getElementById('calc-extra-diurna') as HTMLInputElement).value) || 0,
            horasExtraNocturnas: Number((document.getElementById('calc-extra-nocturna') as HTMLInputElement).value) || 0,
            horasFeriado: Number((document.getElementById('calc-extra-feriado') as HTMLInputElement).value) || 0,
            vacacionesCausadasNoGozadas: (document.getElementById('calc-vacaciones-causadas') as HTMLInputElement)?.checked || false,

            // NUEVOS CAMPOS
            tieneIPS: (document.getElementById('calc-tiene-ips') as HTMLInputElement)?.checked ?? true,
            aguinaldoAnioAnteriorPendiente: parseMoney((document.getElementById('calc-aguinaldo-pendiente') as HTMLInputElement)?.value),
            diasSinCobrarMes: Number((document.getElementById('calc-dias-sin-cobrar') as HTMLInputElement)?.value) || 0,
            tipoTrabajador: ((document.getElementById('calc-tipo-trabajador') as HTMLSelectElement)?.value || 'mensualero') as 'mensualero' | 'jornalero',
            trabajadorDioPreaviso: (document.getElementById('calc-dio-preaviso') as HTMLInputElement)?.checked ?? true,
            anticipos: parseMoney((document.getElementById('calc-anticipos') as HTMLInputElement)?.value),

            // PLAZO FIJO Y VACACIONES
            tipoContrato: ((document.getElementById('calc-tipo-contrato') as HTMLSelectElement)?.value || 'indefinido') as 'indefinido' | 'plazo_fijo',
            fechaFinContrato: (document.getElementById('calc-fecha-fin-contrato') as HTMLInputElement)?.value || undefined,
            aplicarPenalidadVacaciones: (document.getElementById('calc-penalidad-vacaciones') as HTMLInputElement)?.checked || false,

            // Defaults
            salarioMinimo: 2798309, // Could be dynamic
            horasNocturnasRegulares: 0,
            cierreEmpresa: false,
            cercaEstabilidad: false,
            regimenDomestico: (document.getElementById('calc-regimen-domestico') as HTMLInputElement)?.checked || false,
            datosTrabajador: {
                nombre: (document.getElementById('calc-nombre-trabajador') as HTMLInputElement).value,
                cargo: (document.getElementById('calc-cargo') as HTMLInputElement).value,
                empresa: (document.getElementById('calc-empresa') as HTMLInputElement).value,
            },
            clienteId: null // We'll handle this if we add the selector
        };
    };

    const performCalculation = () => {
        try {
            const data = getFormData();
            if (!data.fechaIngreso || !data.fechaSalida) {
                if (resultDashboard) resultDashboard.innerHTML = '<div class="alert alert-warning">Por favor ingrese las fechas de ingreso y salida.</div>';
                return null;
            }

            const res = calcularLiquidacion(data);
            renderDashboard(res, data);
            return { res, data };
        } catch (error) {
            console.error(error);
            if (resultDashboard) resultDashboard.innerHTML = '<div class="alert alert-danger">Error al calcular. Verifique los datos.</div>';
            return null;
        }
    };

    const renderDashboard = (res: any, data: any) => {
        if (!resultDashboard) return;

        const fmt = (n: number) => new Intl.NumberFormat('es-PY').format(Math.round(n));

        resultDashboard.innerHTML = `
            <div class="row g-4">
                <!-- Total Card -->
                <div class="col-12 text-center">
                    <h6 class="text-muted text-uppercase ls-1">Total Neto a Cobrar</h6>
                    <h1 class="display-4 fw-bold text-primary mb-0">${fmt(res.totalNeto)} <small class="fs-6 text-muted">Gs.</small></h1>
                    <p class="text-muted small">Liquidación estimada según Ley 213/93</p>
                </div>

                <!-- Breakdown Cards -->
                <div class="col-md-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <h6 class="fw-bold text-primary"><i class="ph ph-money"></i> Indemnización</h6>
                            <h4 class="mb-0">${fmt(res.indemnizacion || 0)}</h4>
                            ${res.indemnizacionDoble ? '<span class="badge bg-danger">Doble</span>' : ''}
                            ${res.periodoPrueba ? '<span class="badge bg-warning text-dark">Periodo Prueba</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <h6 class="fw-bold text-success"><i class="ph ph-calendar-check"></i> Preaviso</h6>
                            <h4 class="mb-0">${fmt(res.preaviso || 0)}</h4>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <h6 class="fw-bold text-info"><i class="ph ph-sun"></i> Vacaciones</h6>
                            <h4 class="mb-0">${fmt(res.vacaciones || 0)}</h4>
                        </div>
                    </div>
                </div>
                 <div class="col-md-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <h6 class="fw-bold text-warning"><i class="ph ph-gift"></i> Aguinaldo</h6>
                            <h4 class="mb-0">${fmt(res.aguinaldo || 0)}</h4>
                        </div>
                    </div>
                </div>
                 <div class="col-md-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <h6 class="fw-bold text-secondary"><i class="ph ph-coins"></i> Otros Ingresos</h6>
                            <h4 class="mb-0">${fmt((res.pendientes || 0) + (res.extras?.total || 0) + (res.bonificacionFamiliar?.monto || 0))}</h4>
                        </div>
                    </div>
                </div>
                 <div class="col-md-4">
                    <div class="card h-100 border-0 shadow-sm">
                        <div class="card-body">
                            <h6 class="fw-bold text-danger"><i class="ph ph-heartbeat"></i> IPS (9%)</h6>
                            <h4 class="mb-0">-${fmt(res.ips?.trabajador || 0)}</h4>
                        </div>
                    </div>
                </div>

                <!-- Details List -->
                <div class="col-12">
                    <div class="card border-0 bg-light">
                        <div class="card-body">
                            <h6 class="mb-3">Detalles del Cálculo</h6>
                            <div class="row small text-muted">
                                <div class="col-md-6">
                                    <p class="mb-1"><strong>Antigüedad:</strong> ${res.antiguedadReal?.anios} años, ${res.antiguedadReal?.meses} meses, ${res.antiguedadReal?.dias} días</p>
                                    <p class="mb-1"><strong>Salario Base:</strong> ${fmt(res.salarioMensualPromedio)} Gs.</p>
                                    <p class="mb-1"><strong>Causa:</strong> ${data.causa.replace('_', ' ')}</p>
                                </div>
                                <div class="col-md-6">
                                    <p class="mb-1"><strong>Artículos Aplicables:</strong> ${res.articulos}</p>
                                    <p class="mb-1"><strong>IPS Empleador (16.5%):</strong> ${fmt(res.ips?.empleador || 0)} Gs.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    // --- HISTORY & SAVING ---
    const historyCloseBtn = document.getElementById('calc-history-close-btn');
    const printBtn = document.getElementById('calc-print-btn');


    historyToggleBtn?.addEventListener('click', () => {
        historyPanel?.classList.remove('d-none');
        fetchAndRenderHistory();
    });

    historyCloseBtn?.addEventListener('click', () => {
        historyPanel?.classList.add('d-none');
    });

    const renderPrintableReport = (res: any, data: any) => {
        const fmt = (n: number) => new Intl.NumberFormat('es-PY').format(Math.round(n || 0));
        const today = new Date();
        const ingresosRows: string[] = [];
        const addIngreso = (label: string, value: number | undefined, badges: string[] = []) => {
            if (value === undefined || value === null) return;
            ingresosRows.push(`
                <tr>
                    <td>${label}${badges.length ? ` <span class="badge-list">${badges.map(b => `<span class="badge">${b}</span>`).join(' ')}</span>` : ''}</td>
                    <td class="text-end">${fmt(value)} Gs.</td>
                </tr>
            `);
        };

        addIngreso('Indemnización', res.indemnizacion, [
            res.indemnizacionDoble ? 'Doble' : '',
            res.cierreEmpresa ? 'Cierre' : '',
            res.periodoPrueba ? 'Periodo prueba' : ''
        ].filter(Boolean));
        addIngreso('Preaviso', res.preaviso);
        addIngreso('Vacaciones', res.vacaciones, res.vacacionesDobles ? ['Doble'] : []);
        addIngreso('Aguinaldo', res.aguinaldo);
        addIngreso('Aguinaldo pendiente año anterior', res.aguinaldoPendienteAnterior);
        addIngreso('Salario días trabajados', res.salarioDiasTrabajados);
        addIngreso('Conceptos pendientes', res.pendientes);
        if (res.extras?.total) {
            addIngreso('Horas extras y recargos', res.extras.total, [
                res.extras.diurnas ? `Diurnas ${fmt(res.extras.diurnas)}` : '',
                res.extras.nocturnas ? `Nocturnas ${fmt(res.extras.nocturnas)}` : '',
                res.extras.feriados ? `Feriados ${fmt(res.extras.feriados)}` : ''
            ].filter(Boolean));
        }
        if (res.bonificacionFamiliar?.monto) {
            addIngreso('Bonificación familiar', res.bonificacionFamiliar.monto, [`Hijos: ${res.bonificacionFamiliar.hijosAplicados}`]);
        }
        if (res.ipsReclamoRetroactivo) {
            addIngreso('Reclamo IPS retroactivo (empleador)', res.ipsReclamoRetroactivo);
        }

        const deduccionesRows: string[] = [];
        const addDed = (label: string, value: number | undefined) => {
            if (!value) return;
            deduccionesRows.push(`
                <tr>
                    <td>${label}</td>
                    <td class="text-end">${fmt(value)} Gs.</td>
                </tr>
            `);
        };
        addDed('Descuento por falta de preaviso (Art. 90)', res.descuentoFaltaPreaviso);
        addDed('Anticipos/Préstamos', res.anticipos);
        addDed('Aporte IPS trabajador', res.ips?.trabajador);

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Liquidación Laboral - LEXYS</title>
    <style>
        body { font-family: Arial, sans-serif; color: #1f2d3d; margin: 32px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0d6efd; padding-bottom: 12px; margin-bottom: 16px; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand img { height: 48px; }
        .title { font-size: 20px; font-weight: 700; margin: 0; }
        .meta { font-size: 12px; color: #6c757d; }
        h3 { margin: 12px 0 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
        th { text-align: left; background: #f8fafc; }
        .text-end { text-align: right; }
        .badge { display: inline-block; background: #e7f1ff; color: #0d6efd; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 4px; }
        .badge-list { white-space: nowrap; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap: 12px; margin: 12px 0; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
        .card h4 { margin: 0; }
        .muted { color: #6c757d; font-size: 12px; }
        .alert { border-left: 4px solid #f59e0b; background: #fff7ed; padding: 10px; border-radius: 6px; margin-top: 12px; }
        @media print { body { margin: 12mm; } .no-print { display:none; } }
    </style>
</head>
<body>
    <div class="header">
        <div class="brand">
            <img src="assets/logo.jpg" alt="LEXYS">
            <div>
                <p class="title">Liquidación Laboral</p>
                <p class="meta">Generado el ${today.toLocaleDateString()}</p>
            </div>
        </div>
        <div class="meta">
            <div><strong>Operador:</strong> ${store.state.currentUserProfile?.nombre_completo || '—'}</div>
            <div><strong>Despacho:</strong> ${store.state.currentUserProfile?.despachos?.nombre || '—'}</div>
        </div>
    </div>

    <h3>Datos del trabajador</h3>
    <table>
        <tr><td>Nombre</td><td class="text-end">${data.datosTrabajador?.nombre || '—'}</td></tr>
        <tr><td>Cargo</td><td class="text-end">${data.datosTrabajador?.cargo || '—'}</td></tr>
        <tr><td>Empresa</td><td class="text-end">${data.datosTrabajador?.empresa || '—'}</td></tr>
        <tr><td>Fecha de ingreso</td><td class="text-end">${data.fechaIngreso || '—'}</td></tr>
        <tr><td>Fecha de salida</td><td class="text-end">${data.fechaSalida || '—'}</td></tr>
        <tr><td>Tipo de contrato</td><td class="text-end">${data.tipoContrato || '—'}</td></tr>
        <tr><td>Causa</td><td class="text-end">${data.causa || '—'}</td></tr>
    </table>

    <div class="summary">
        <div class="card">
            <p class="muted">Total Neto a cobrar</p>
            <h2 style="margin:0; color:#0d6efd;">${fmt(res.totalNeto)} Gs.</h2>
        </div>
        <div class="card">
            <p class="muted">Total Bruto</p>
            <h4>${fmt(res.totalBruto)} Gs.</h4>
        </div>
        <div class="card">
            <p class="muted">Deducciones</p>
            <h4>${fmt((res.totalBruto || 0) - (res.totalNeto || 0))} Gs.</h4>
        </div>
    </div>

    ${res.alertaIlegalidad ? `<div class="alert"><strong>Alerta legal:</strong> ${res.alertaIlegalidad.mensaje}</div>` : ''}

    <h3>Detalle de ingresos</h3>
    <table>
        <thead><tr><th>Concepto</th><th class="text-end">Monto</th></tr></thead>
        <tbody>
            ${ingresosRows.join('') || '<tr><td colspan="2">Sin conceptos</td></tr>'}
        </tbody>
    </table>

    <h3>Deducciones</h3>
    <table>
        <thead><tr><th>Concepto</th><th class="text-end">Monto</th></tr></thead>
        <tbody>
            ${deduccionesRows.join('') || '<tr><td colspan="2">Sin deducciones</td></tr>'}
        </tbody>
    </table>

    <p class="muted">Artículos aplicados: ${res.articulos || 'N/D'}</p>
</body>
</html>
        `;

        // Usa iframe oculto para evitar bloqueos de pop-up y asegurar impresión
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
        iframe.onload = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => iframe.remove(), 500);
        };
        iframe.srcdoc = html;
    };

    printBtn?.addEventListener('click', () => {
        const calcResult = performCalculation();
        if (!calcResult) return;
        renderPrintableReport(calcResult.res, calcResult.data);
    });

    saveBtn?.addEventListener('click', async () => {
        const clienteSelect = document.getElementById('calc-cliente-select') as HTMLSelectElement;
        const clienteId = clienteSelect.value || null;

        const calcResult = performCalculation();
        if (!calcResult) return;
        const { res, data } = calcResult;

        try {
            await Service.saveCalculo({
                cliente_id: clienteId,
                datos_entrada: data,
                resultado: res,
                creado_por: store.state.currentUserProfile?.id
            });
            showToast('Cálculo guardado correctamente.', 'success');
            fetchAndRenderHistory();
        } catch (error) {
            handleError(error, 'saveCalculo');
        }
    });

    const fetchAndRenderHistory = async () => {
        const tbody = document.getElementById('history-table-body');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Cargando...</td></tr>';

        try {
            const calculos = await Service.fetchCalculos();
            if (!calculos || calculos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay cálculos guardados.</td></tr>';
                return;
            }

            tbody.innerHTML = calculos.map((c: any) => `
                <tr>
                    <td>${new Date(c.fecha_calculo).toLocaleDateString()}</td>
                    <td>${c.datos_entrada.datosTrabajador?.nombre || '-'}</td>
                    <td>${new Intl.NumberFormat('es-PY').format(c.resultado.totalNeto)} Gs.</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary btn-load-calc" data-id="${c.id}" title="Cargar"><i class="ph ph-eye"></i></button>
                        <button class="btn btn-sm btn-outline-success btn-print-calc" data-id="${c.id}" title="Imprimir"><i class="ph ph-printer"></i></button>
                        <button class="btn btn-sm btn-outline-danger btn-delete-calc" data-id="${c.id}" title="Eliminar"><i class="ph ph-trash"></i></button>
                    </td>
                </tr>
            `).join('');

            // Listeners
            tbody.querySelectorAll('.btn-delete-calc').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = (e.currentTarget as HTMLElement).dataset.id!;
                    if (confirm('¿Eliminar este cálculo del historial?')) {
                        await Service.deleteCalculo(id);
                        fetchAndRenderHistory();
                    }
                });
            });
            tbody.querySelectorAll('.btn-load-calc').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = (e.currentTarget as HTMLElement).dataset.id!;
                    const calc = calculos.find((x: any) => x.id === id);
                    if (calc) {
                        loadCalculation(calc.datos_entrada, calc.cliente_id);
                        historyPanel?.classList.add('d-none'); // Close history on load
                    }
                });
            });
            tbody.querySelectorAll('.btn-print-calc').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = (e.currentTarget as HTMLElement).dataset.id!;
                    const calc = calculos.find((x: any) => x.id === id);
                    if (!calc) return;

                    // Algunos registros pueden venir como JSON string, normalizamos
                    const resultado = typeof calc.resultado === 'string' ? JSON.parse(calc.resultado) : calc.resultado;
                    const datosEntrada = typeof calc.datos_entrada === 'string' ? JSON.parse(calc.datos_entrada) : calc.datos_entrada;

                    if (!resultado || !datosEntrada) {
                        showToast('No se pudo cargar el cálculo para imprimir.', 'warning');
                        return;
                    }

                    renderPrintableReport(resultado, datosEntrada);
                });
            });

        } catch (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error al cargar historial.</td></tr>';
        }
    };

    const loadCalculation = (data: any, clienteId: string | null) => {
        // Load data into form
        if (data.fechaIngreso) (document.getElementById('calc-fecha-ingreso') as HTMLInputElement).value = data.fechaIngreso;
        if (data.fechaSalida) (document.getElementById('calc-fecha-salida') as HTMLInputElement).value = data.fechaSalida;

        // Load Cause
        if (data.causa) {
            const radio = document.querySelector(`input[name="calc-causa"][value="${data.causa}"]`) as HTMLInputElement;
            if (radio) radio.checked = true;
        }

        // Load Maternity
        (document.getElementById('calc-estabilidad-maternal') as HTMLInputElement).checked = !!data.estabilidadMaternal;

        // Load Worker Data
        if (data.datosTrabajador) {
            (document.getElementById('calc-nombre-trabajador') as HTMLInputElement).value = data.datosTrabajador.nombre || '';
            (document.getElementById('calc-cargo') as HTMLInputElement).value = data.datosTrabajador.cargo || '';
            (document.getElementById('calc-empresa') as HTMLInputElement).value = data.datosTrabajador.empresa || '';
        }

        // Load Economic Data
        if (data.salarioBaseMensual !== undefined) {
            const baseInput = document.getElementById('calc-salario-base') as HTMLInputElement;
            baseInput.value = data.salarioBaseMensual || '';
            formatMoneyInput(baseInput);
        }
        (document.getElementById('calc-hijos') as HTMLInputElement).value = data.hijos || 0;

        // Load Variable Salaries
        // Note: Logic for variable salaries loading would go here if we stored the array in 'data'
        // For now assuming simple load.

        // Load Details
        (document.getElementById('calc-vacaciones-previas') as HTMLInputElement).value = data.vacacionesPrevias || 0;
        const pendientesInput = document.getElementById('calc-pendientes') as HTMLInputElement;
        pendientesInput.value = data.pendientes || '';
        formatMoneyInput(pendientesInput);
        (document.getElementById('calc-extra-diurna') as HTMLInputElement).value = data.horasExtraDiurnas || '';
        (document.getElementById('calc-extra-nocturna') as HTMLInputElement).value = data.horasExtraNocturnas || '';
        (document.getElementById('calc-extra-feriado') as HTMLInputElement).value = data.horasFeriado || '';
        (document.getElementById('calc-vacaciones-causadas') as HTMLInputElement).checked = !!data.vacacionesCausadasNoGozadas;

        const anticiposInput = document.getElementById('calc-anticipos') as HTMLInputElement;
        anticiposInput.value = data.anticipos || '';
        formatMoneyInput(anticiposInput);

        const aguinaldoPendienteInput = document.getElementById('calc-aguinaldo-pendiente') as HTMLInputElement;
        aguinaldoPendienteInput.value = data.aguinaldoAnioAnteriorPendiente || '';
        formatMoneyInput(aguinaldoPendienteInput);

        // Load Client
        if (clienteId) {
            (document.getElementById('calc-cliente-select') as HTMLSelectElement).value = clienteId;
        }

        // Go to final step and calculate
        currentStep = 4;
        updateWizardUI();
        performCalculation();
        showToast('Cálculo cargado exitosamente.', 'info');
    };
}


function setupExpedientesFilters() {
    const filterEstado = document.getElementById('filter-estado') as HTMLSelectElement;
    const filterEtapa = document.getElementById('filter-etapa') as HTMLSelectElement;
    const filterFechaDesde = document.getElementById('filter-fecha-desde') as HTMLInputElement;
    const filterFechaHasta = document.getElementById('filter-fecha-hasta') as HTMLInputElement;

    const applyFilters = () => {
        store.state.currentPage = 0;
        const searchTerm = (document.getElementById('search-expediente') as HTMLInputElement).value.toLowerCase();

        const filteredData = store.state.allExpedientes.filter(exp => {
            const matchesSearch = exp.nro_expediente.toLowerCase().includes(searchTerm) || exp.caratula.toLowerCase().includes(searchTerm) || (exp.clientes?.nombre && exp.clientes.nombre.toLowerCase().includes(searchTerm));
            const matchesEstado = !filterEstado.value || exp.estado === filterEstado.value;
            const matchesEtapa = !filterEtapa.value || exp.etapas_proceso?.nombre === filterEtapa.value;
            const matchesFecha = (!filterFechaDesde.value || new Date(exp.fecha_creacion) >= new Date(filterFechaDesde.value)) && (!filterFechaHasta.value || new Date(exp.fecha_creacion) <= new Date(filterFechaHasta.value));

            return matchesSearch && matchesEstado && matchesEtapa && matchesFecha;
        });

        UI.renderExpedientes(filteredData, store.state.currentPage);
    };

    if (filterEstado) filterEstado.addEventListener('change', applyFilters);
    if (filterEtapa) filterEtapa.addEventListener('change', applyFilters);
    if (filterFechaDesde) filterFechaDesde.addEventListener('change', applyFilters);
    if (filterFechaHasta) filterFechaHasta.addEventListener('change', applyFilters);
}

// --- MISSING FUNCTIONS FROM DATA.JS THAT ARE USED IN MAIN.JS ---
// These were not in ui/index.ts but are needed here or in data.js.
// I'll implement them here or import them if I put them in service/ui.

async function handleAdvance(expedienteId: string) {
    store.state.currentExpedienteId = expedienteId;
    const expediente = store.state.allExpedientes.find(e => e.id === expedienteId);
    if (!expediente) return;

    const titleEl = document.getElementById('expediente-detail-title');
    if (titleEl) titleEl.textContent = `${expediente.nro_expediente} - ${expediente.caratula}`;

    // Render Timeline
    const etapas = await Service.fetchEtapas(expediente.tipo_juicio_id);
    UI.renderTimeline(etapas || [], expediente);

    // Render Actuaciones
    const actuaciones = await Service.fetchActuaciones(expedienteId);
    UI.renderActuaciones(actuaciones || []);

    // Render Documentos
    const docs = await Service.fetchExpedienteDocumentos(expedienteId);
    UI.renderExpedienteDocumentos(docs || [], expedienteId);

    // Render Resumen
    await UI.renderExpedienteResumen(expedienteId);

    // Render Tareas
    const { tareas, miembros } = await Service.fetchTareas(expedienteId);
    renderTareas(tareas || [], miembros || []);

    switchView('expediente-detail');
}

function renderTareas(tareas: any[], miembros: any[]) {
    const list = document.getElementById('tareas-list');
    if (!list) return;

    if (tareas.length === 0) {
        list.innerHTML = '<p class="text-muted small text-center p-3">No hay tareas pendientes.</p>';
        return;
    }

    list.innerHTML = tareas.map(tarea => {
        const responsable = miembros.find(m => m.id === tarea.responsable_id)?.nombre_completo || 'Sin asignar';
        const isCompleted = tarea.completada;
        const textClass = isCompleted ? 'text-decoration-line-through text-muted' : '';

        return `
            <div class="d-flex align-items-center justify-content-between border-bottom py-2">
                <div class="form-check">
                    <input class="form-check-input tarea-check" type="checkbox" ${isCompleted ? 'checked' : ''} data-tarea-id="${tarea.id}">
                    <label class="form-check-label ${textClass}">
                        ${tarea.descripcion} <br>
                        <small class="text-muted" style="font-size: 0.75em;">Asignado a: ${responsable} | Vence: ${tarea.fecha_vencimiento ? new Date(tarea.fecha_vencimiento).toLocaleDateString() : 'Sin fecha'}</small>
                    </label>
                </div>
                <button class="btn btn-sm text-danger btn-delete-tarea" data-tarea-id="${tarea.id}"><i class="ph ph-trash"></i></button>
            </div>
        `;
    }).join('');
}

async function handleNewTareaSubmit(e: Event) {
    e.preventDefault();
    try {
        const formData = {
            expediente_id: store.state.currentExpedienteId,
            descripcion: (document.getElementById('tarea-descripcion') as HTMLInputElement).value,
            responsable_id: (document.getElementById('tarea-responsable') as HTMLSelectElement).value || null,
            fecha_vencimiento: (document.getElementById('tarea-vencimiento') as HTMLInputElement).value || null,
            despacho_id: store.state.currentUserProfile?.despacho_id
        };

        const { error } = await supabase.from('tareas').insert(formData);
        if (error) throw error;

        showToast('Tarea añadida.', 'success');
        (e.target as HTMLFormElement).reset();

        const { tareas, miembros } = await Service.fetchTareas(store.state.currentExpedienteId!);
        renderTareas(tareas || [], miembros || []);
        await UI.renderExpedienteResumen(store.state.currentExpedienteId!);
    } catch (error) {
        handleError(error, 'handleNewTareaSubmit');
    }
}

async function handleDeleteTarea(id: string) {
    try {
        const { error } = await supabase.from('tareas').delete().eq('id', id);
        if (error) throw error;

        showToast('Tarea eliminada.', 'success');
        const { tareas, miembros } = await Service.fetchTareas(store.state.currentExpedienteId!);
        renderTareas(tareas || [], miembros || []);
        await UI.renderExpedienteResumen(store.state.currentExpedienteId!);
    } catch (error) {
        handleError(error, 'handleDeleteTarea');
    }
}

async function handleTareaStatusChange(id: string, completada: boolean) {
    try {
        const { error } = await supabase.from('tareas').update({ completada }).eq('id', id);
        if (error) throw error;
        await UI.renderExpedienteResumen(store.state.currentExpedienteId!);
    } catch (error) {
        handleError(error, 'handleTareaStatusChange');
        // Revert UI change if error? For now just toast
    }
}

async function renderDashboardData() {
    try {
        const despachoId = store.state.currentUserProfile?.despacho_id;
        if (!despachoId) return;

        // Fetch counts
        const { count: expCount } = await supabase.from('expedientes').select('*', { count: 'exact', head: true }).eq('despacho_id', despachoId);
        const { count: cliCount } = await supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('despacho_id', despachoId);

        // Fetch upcoming events
        const today = new Date().toISOString().split('T')[0];
        const { data: eventos } = await supabase.from('eventos').select('*').eq('despacho_id', despachoId).gte('fecha_evento', today).order('fecha_evento').limit(5);

        // Fetch recent updates (actuaciones)
        const { data: actuaciones } = await supabase.from('actuaciones').select('*, expedientes(caratula)').eq('despacho_id', despachoId).order('fecha', { ascending: false }).limit(5);

        // Update UI
        const totalExpEl = document.getElementById('total-expedientes');
        if (totalExpEl) totalExpEl.textContent = expCount?.toString() || '0';

        const totalCliEl = document.getElementById('total-clientes');
        if (totalCliEl) totalCliEl.textContent = cliCount?.toString() || '0';

        const eventosList = document.getElementById('dashboard-eventos-list');
        if (eventosList) {
            eventosList.innerHTML = (eventos || []).map(ev => `
                <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${ev.titulo}</h6>
                        <small class="text-muted">${new Date(ev.fecha_evento).toLocaleDateString()}</small>
                    </div>
                    ${ev.expediente_id ? `<button class="btn btn-sm btn-outline-primary" data-expediente-id="${ev.expediente_id}"><i class="ph ph-arrow-right"></i></button>` : ''}
                </div>
            `).join('') || '<div class="p-3 text-muted text-center">No hay eventos próximos.</div>';
        }

        const actuacionesList = document.getElementById('dashboard-actuaciones-list');
        if (actuacionesList) {
            actuacionesList.innerHTML = (actuaciones || []).map(act => `
                <div class="list-group-item list-group-item-action">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${act.expedientes?.caratula || 'Expediente desconocido'}</h6>
                        <small>${new Date(act.created_at).toLocaleDateString()}</small>
                    </div>
                    <p class="mb-1 small">${act.descripcion}</p>
                    <small class="text-muted">${act.tipo}</small>
                    ${act.expediente_id ? `<div class="mt-1"><button class="btn btn-sm btn-outline-secondary py-0" data-expediente-id="${act.expediente_id}">Ver Expediente</button></div>` : ''}
                </div>
            `).join('') || '<div class="p-3 text-muted text-center">No hay movimientos recientes.</div>';
        }

    } catch (error) {
        handleError(error, 'renderDashboardData');
    }
}

async function refreshExpedientesAndRender() {
    await Service.fetchExpedientes();
    UI.renderExpedientes(store.state.allExpedientes, store.state.currentPage);
    UI.populateEtapaFilter();
}

async function fetchAndRenderPlazos() {
    await Service.fetchPlazos();
    UI.renderPlazos(store.state.allPlazos);
    UI.populatePlazosFilters();
}

function handleEditEtapas(juicioId: string, juicioNombre: string) {
    const titleEl = document.getElementById('modal-juicio-titulo');
    if (titleEl) titleEl.textContent = `Editar Etapas: ${juicioNombre}`;
    (document.getElementById('etapas-juicio-id') as HTMLInputElement).value = juicioId;

    UI.renderEtapasEnModal(juicioId);
    store.state.editarEtapasModal.show();
}

function handleEditPlazo(id: string) {
    const plazo = store.state.allPlazos.find(p => p.id === id);
    if (!plazo) return;

    (document.getElementById('edit-plazo-id') as HTMLInputElement).value = plazo.id;
    (document.getElementById('edit-plazo-accion') as HTMLInputElement).value = plazo.accion_procedimiento;
    (document.getElementById('edit-plazo-fuero') as HTMLInputElement).value = plazo.fuero || '';
    (document.getElementById('edit-plazo-tipo-proceso') as HTMLInputElement).value = plazo.tipo_proceso || '';
    (document.getElementById('edit-plazo-articulo') as HTMLInputElement).value = plazo.articulo || '';
    (document.getElementById('edit-plazo-descripcion') as HTMLInputElement).value = plazo.descripcion || '';
    (document.getElementById('edit-plazo-duracion-numero') as HTMLInputElement).value = plazo.duracion_numero?.toString() || '';
    (document.getElementById('edit-plazo-unidad') as HTMLSelectElement).value = plazo.unidad || '';
    (document.getElementById('edit-plazo-tipo-duracion') as HTMLSelectElement).value = plazo.tipo_duracion || 'habiles';

    store.state.editarPlazoModal.show();
}

function handleDeletePlazo(id: string) {
    UI.showConfirmDeleteModal(
        'Eliminar Plazo',
        '¿Estás seguro de que deseas eliminar este plazo procesal?',
        async () => {
            try {
                const { error } = await supabase.from('plazos_procesales').delete().eq('id', id);
                if (error) throw error;
                showToast('Plazo eliminado.', 'success');
                fetchAndRenderPlazos();
            } catch (error) {
                handleError(error, 'handleDeletePlazo');
            }
        }
    );
}

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    setupAuthEventListeners();

    const modals = ['nuevoExpedienteModal', 'editarExpedienteModal', 'nuevoClienteModal', 'nuevoJuicioModal', 'editarEtapasModal', 'nuevoEventoModal', 'confirmDeleteModal', 'nuevoPlazoModal', 'editarPlazoModal'];

    // Initialize modals and store in state
    // Note: We need to cast to any because state types might not be fully updated or strict
    const stateAny = store.state as any;

    modals.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const modalInstance = new bootstrap.Modal(el);
            if (id === 'nuevoExpedienteModal') stateAny.nuevoExpedienteModal = modalInstance;
            if (id === 'editarExpedienteModal') stateAny.editarExpedienteModal = modalInstance;
            if (id === 'nuevoClienteModal') stateAny.nuevoClienteModal = modalInstance;
            if (id === 'nuevoJuicioModal') stateAny.nuevoJuicioModal = modalInstance;
            if (id === 'editarEtapasModal') stateAny.editarEtapasModal = modalInstance;
            if (id === 'nuevoEventoModal') stateAny.nuevoEventoModal = modalInstance;
            if (id === 'confirmDeleteModal') stateAny.confirmDeleteModalInstance = modalInstance;
            if (id === 'nuevoPlazoModal') stateAny.nuevoPlazoModal = modalInstance;
            if (id === 'editarPlazoModal') stateAny.editarPlazoModal = modalInstance;
        }
    });

    const eventExpedienteSelect = document.getElementById('event-expediente');
    if (eventExpedienteSelect) {
        stateAny.eventExpedienteChoices = new Choices(eventExpedienteSelect, {
            searchEnabled: true,
            removeItemButton: true,
            placeholder: true,
            placeholderValue: 'Busca o selecciona...',
            itemSelectText: '',
            allowHTML: true, // suppress Choices deprecation warning
        });
    }

    document.getElementById('confirm-delete-btn')?.addEventListener('click', async () => {
        const stateAny = store.state as any; // Cast for callback
        if (typeof stateAny.confirmDeleteCallback === 'function') {
            await stateAny.confirmDeleteCallback();
        }
        if (typeof stateAny.confirmDeleteResolve === 'function') {
            stateAny.confirmDeleteResolve(true);
            stateAny.confirmDeleteResolve = null;
        }
        stateAny.confirmDeleteModalInstance.hide();
    });

    document.getElementById('nuevoExpedienteModal')?.addEventListener('show.bs.modal', () => {
        const clienteSelect = document.getElementById('exp-cliente');
        if (clienteSelect) clienteSelect.innerHTML = '<option selected disabled value="">Seleccione...</option>' + store.state.allClientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

        const fueroSelect = document.getElementById('exp-fuero');
        if (fueroSelect) fueroSelect.innerHTML = '<option selected disabled value="">Seleccione...</option>' + Object.keys(store.state.juiciosOrganizados).map(f => `<option value="${f}">${f}</option>`).join('');
    });

    document.getElementById('nuevoEventoModal')?.addEventListener('show.bs.modal', async () => {
        try {
            const { data, error } = await supabase.from('expedientes').select('id, caratula').eq('despacho_id', store.state.currentUserProfile?.despacho_id);
            if (error) throw error;

            const choicesData = data.map(exp => ({ value: exp.id, label: exp.caratula }));
            choicesData.unshift({ value: '', label: 'Ninguno', selected: true } as any);

            if (stateAny.eventExpedienteChoices) {
                stateAny.eventExpedienteChoices.setChoices(choicesData, 'value', 'label', true);
            }
        } catch (error) {
            handleError(error, 'nuevoEventoModal show');
        }
    });

    document.getElementById('nuevoPlazoModal')?.addEventListener('show.bs.modal', () => {
        UI.populatePlazoFormSelects('#plazo-fuero', '#plazo-tipo-proceso');
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

    document.getElementById('exp-fuero')?.addEventListener('change', (e) => {
        const fuero = (e.target as HTMLSelectElement).value;
        const procesoSelect = document.getElementById('exp-tipo-proceso') as HTMLSelectElement;
        procesoSelect.innerHTML = '<option selected disabled value="">Seleccione...</option>' + Object.keys(store.state.juiciosOrganizados[fuero] || {}).map(p => `<option value="${p}">${p}</option>`).join('');
        procesoSelect.disabled = false;
        (document.getElementById('exp-tipo-juicio') as HTMLSelectElement).disabled = true;
    });

    document.getElementById('exp-tipo-proceso')?.addEventListener('change', (e) => {
        const fuero = (document.getElementById('exp-fuero') as HTMLSelectElement).value;
        const proceso = (e.target as HTMLSelectElement).value;
        const juicioSelect = document.getElementById('exp-tipo-juicio') as HTMLSelectElement;
        juicioSelect.innerHTML = '<option selected disabled value="">Seleccione...</option>' + (store.state.juiciosOrganizados[fuero]?.[proceso] || []).map((j: any) => `<option value="${j.id}">${j.nombre}</option>`).join('');
        juicioSelect.disabled = false;
    });

    ['exp-cliente', 'exp-contraparte', 'exp-tipo-juicio'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', generateCaratula);
    });

    ['exp-monto', 'edit-exp-monto'].forEach(id => document.getElementById(id)?.addEventListener('input', (e) => formatMonto(e.target as HTMLInputElement)));
    ['exp-cuenta', 'edit-exp-cuenta'].forEach(id => document.getElementById(id)?.addEventListener('input', (e) => formatCuentaCorriente(e.target as HTMLInputElement)));

    document.getElementById('new-expediente-form')?.addEventListener('submit', (e) => UI.handleNewExpedienteSubmit(e, false));
    document.getElementById('save-and-add-another-btn')?.addEventListener('click', (e) => UI.handleNewExpedienteSubmit(e, true));
    document.getElementById('edit-expediente-form')?.addEventListener('submit', UI.handleEditExpedienteSubmit);
    document.getElementById('new-client-form')?.addEventListener('submit', UI.handleNewClientSubmit);
    document.getElementById('new-juicio-form')?.addEventListener('submit', UI.handleNewJuicioSubmit);
    document.getElementById('new-etapa-form')?.addEventListener('submit', UI.handleNewEtapaSubmit);
    document.getElementById('new-actuacion-form')?.addEventListener('submit', UI.handleNewActuacionSubmit);
    document.getElementById('new-event-form')?.addEventListener('submit', UI.handleNewEventSubmit);
    document.getElementById('create-user-form')?.addEventListener('submit', UI.handleCreateUserSubmit);
    document.getElementById('new-plazo-form')?.addEventListener('submit', UI.handleNewPlazoSubmit);
    document.getElementById('edit-plazo-form')?.addEventListener('submit', UI.handleEditPlazoSubmit);
    document.getElementById('new-tarea-form')?.addEventListener('submit', handleNewTareaSubmit);
    document.getElementById('new-area-form')?.addEventListener('submit', UI.handleNewAreaSubmit);
    document.getElementById('new-fuero-form')?.addEventListener('submit', UI.handleNewFueroSubmit);
    setupLaborCalculator();

    supabase.auth.onAuthStateChange((_, session) => {
        if (session?.user) {
            setupApp(session.user);
            return;
        }
        store.resetState({ preserveUi: true });
        showLoginScreen();
    });
});
