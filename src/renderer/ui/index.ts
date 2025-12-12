import { store } from '../store/store';
import * as Service from '../services/supabaseService';
import { getStatusBadge, handleError, getPlazoDuration, showToast, showConfirmDeleteModal, calcularFechaVencimiento } from '../utils';
export { showConfirmDeleteModal, showToast, handleError };
import { supabase } from '../services/supabaseClient'; // Needed for auth session check in one handler
import { Expediente, Cliente, TipoJuicio, EtapaProceso, Actuacion, Evento, PlazoProcesal, Tarea, Area, Fuero } from '../types';

// --- RENDER FUNCTIONS ---

export function renderExpedientes(dataToRender: Expediente[], page = 0) {
    const tableBody = document.getElementById('expedientes-table-body');
    if (!tableBody) return;

    const from = page * store.state.PAGE_SIZE;
    const to = from + store.state.PAGE_SIZE;
    const paginatedData = dataToRender.slice(from, to);

    tableBody.innerHTML = '';

    if (!paginatedData || paginatedData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-5 text-muted">No se encontraron expedientes.</td></tr>`;
        return;
    }

    paginatedData.forEach(exp => {
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

    updatePagination(page, dataToRender.length);
}

export function updatePagination(currentPage: number, totalCount: number) {
    const prevPageItem = document.getElementById('prev-page-item');
    const nextPageItem = document.getElementById('next-page-item');
    const totalPages = Math.ceil(totalCount / store.state.PAGE_SIZE);

    if (prevPageItem) prevPageItem.classList.toggle('disabled', currentPage === 0);
    if (nextPageItem) nextPageItem.classList.toggle('disabled', currentPage >= totalPages - 1);
}

export function renderClientes(filteredData = store.state.allClientes) {
    const container = document.getElementById('clientes-folder-container');
    if (!container) return;
    container.innerHTML = '';

    if (!filteredData || filteredData.length === 0) {
        container.innerHTML = `<div class="col-12 text-center p-5 text-muted">No hay clientes registrados.</div>`;
        return;
    }

    filteredData.forEach(cliente => {
        const col = document.createElement('div');
        col.className = 'col-md-4 col-lg-3 mb-3';
        col.innerHTML = `
            <div class="card h-100 client-folder" data-cliente-id="${cliente.id}" data-cliente-nombre="${cliente.nombre}">
                <div class="card-body text-center">
                    <i class="ph-fill ph-folder-simple" style="font-size: 3rem; color: #fd7e14;"></i>
                    <h6 class="card-title mt-2">${cliente.nombre}</h6>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}

export function renderDocumentos(files: any[]) {
    const listContainer = document.getElementById('documentos-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!files || files.length === 0 || files.every(f => f.name === '.emptyFolderPlaceholder')) {
        listContainer.innerHTML = `<p class="text-muted text-center small p-3">No hay documentos para este cliente.</p>`;
        return;
    }

    files.forEach(file => {
        if (file.name === '.emptyFolderPlaceholder') return;

        const item = document.createElement('div');
        item.className = 'document-item';
        item.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="ph ph-file me-2 fs-4"></i>
                <span>${file.name}</span>
            </div>
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary btn-download" data-filename="${file.name}"><i class="ph ph-download-simple"></i></button>
                <button class="btn btn-sm btn-outline-danger btn-delete-doc" data-filename="${file.name}"><i class="ph ph-trash"></i></button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

export function renderExpedienteDocumentos(files: any[], expedienteId: string) {
    const listContainer = document.getElementById('expediente-documentos-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (!files || files.length === 0 || files.every(f => f.name === '.emptyFolderPlaceholder')) {
        listContainer.innerHTML = `<p class="text-muted text-center small p-3">No hay documentos para este expediente.</p>`;
        return;
    }

    files.forEach(file => {
        if (file.name === '.emptyFolderPlaceholder') return;

        const item = document.createElement('div');
        item.className = 'document-item';
        item.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="ph ph-file me-2 fs-4"></i>
                <span>${file.name}</span>
            </div>
            <div class="btn-group">
                <button class="btn btn-sm btn-outline-primary btn-download-expediente" data-filename="${file.name}" data-expediente-id="${expedienteId}"><i class="ph ph-download-simple"></i></button>
                <button class="btn btn-sm btn-outline-danger btn-delete-doc-expediente" data-filename="${file.name}" data-expediente-id="${expedienteId}"><i class="ph ph-trash"></i></button>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

export function renderMembers(members: any[]) {
    const tableBody = document.getElementById('members-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (!members || members.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-muted">No hay miembros registrados.</td></tr>`;
        return;
    }
    members.forEach(member => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${member.nombre_completo}</td>
            <td>${member.email}</td>
            <td>
                <select class="form-select form-select-sm" data-member-id="${member.id}" ${member.id === store.state.currentUserProfile?.id ? 'disabled' : ''}>
                    <option value="abogado" ${member.rol === 'abogado' ? 'selected' : ''}>Abogado</option>
                    <option value="admin" ${member.rol === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary btn-save-role" data-member-id="${member.id}" ${member.id === store.state.currentUserProfile?.id ? 'disabled' : ''}>Guardar</button>
                    ${member.id !== store.state.currentUserProfile?.id ? `<button class="btn btn-sm btn-outline-danger btn-delete-member" data-member-id="${member.id}"><i class="ph ph-trash"></i></button>` : ''}
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

export function renderAdminJuicios(dataToRender: TipoJuicio[], page = 0) {
    const gridContainer = document.getElementById('juicios-grid');
    if (!gridContainer) return;

    const from = page * store.state.JUICIOS_PAGE_SIZE;
    const to = from + store.state.JUICIOS_PAGE_SIZE;
    const paginatedData = dataToRender.slice(from, to);

    gridContainer.innerHTML = '';

    if (!paginatedData || paginatedData.length === 0) {
        gridContainer.innerHTML = `<div class="col-12 text-center p-5 text-muted">No se encontraron tipos de juicio.</div>`;
        return;
    }

    paginatedData.forEach(juicio => {
        const areaLabel = juicio.areas?.nombre || juicio.area || 'Sin área';
        const fueroLabel = juicio.fueros?.nombre || 'Sin fuero';
        const procesoLabel = juicio.tipo_proceso || 'Sin Proceso';

        let iconClass = 'ph-gavel';
        const areaLower = areaLabel.toLowerCase();
        if (areaLower.includes('civil')) iconClass = 'ph-scales';
        else if (areaLower.includes('penal')) iconClass = 'ph-gavel';
        else if (areaLower.includes('laboral')) iconClass = 'ph-briefcase';
        else if (areaLower.includes('niñez')) iconClass = 'ph-baby';

        const card = document.createElement('div');
        card.className = 'col-md-6 col-lg-4';
        card.innerHTML = `
            <div class="card h-100 border-0 shadow-sm hover-shadow transition-all">
                <div class="card-body">
                    <div class="d-flex align-items-center mb-3">
                        <div class="rounded-circle bg-primary bg-opacity-10 p-2 me-3 text-primary">
                            <i class="ph ${iconClass} fs-4"></i>
                        </div>
                        <div>
                            <h6 class="fw-bold mb-0 text-dark text-truncate" style="max-width: 180px;" title="${juicio.nombre}">${juicio.nombre}</h6>
                            <small class="text-muted">${areaLabel}</small>
                        </div>
                    </div>
                    <div class="d-flex gap-2 mb-3 flex-wrap">
                        <span class="badge bg-light text-dark border">${fueroLabel}</span>
                        <span class="badge bg-light text-dark border">${procesoLabel}</span>
                    </div>
                    <button class="btn btn-sm btn-outline-primary w-100 btn-edit-etapas" data-juicio-id="${juicio.id}" data-juicio-nombre="${juicio.nombre}">
                        <i class="ph ph-list-checks me-1"></i> Configurar Etapas
                    </button>
                </div>
            </div>
        `;
        gridContainer.appendChild(card);
    });

    updateJuiciosPagination(page, dataToRender.length);
}


export function updateJuiciosPagination(currentPage: number, totalCount: number) {
    const prevPageItem = document.getElementById('juicios-prev-page-item');
    const nextPageItem = document.getElementById('juicios-next-page-item');
    const totalPages = Math.ceil(totalCount / store.state.JUICIOS_PAGE_SIZE);

    if (prevPageItem) prevPageItem.classList.toggle('disabled', currentPage === 0);
    if (nextPageItem) nextPageItem.classList.toggle('disabled', currentPage >= totalPages - 1);
}

export function applyJuiciosFilters(page = 0) {
    const searchTerm = (document.getElementById('search-juicio') as HTMLInputElement).value.toLowerCase();

    const filteredData = store.state.allJuicios.filter(j =>
        j.nombre.toLowerCase().includes(searchTerm) ||
        ((j.areas?.nombre || j.area || '').toLowerCase().includes(searchTerm)) ||
        ((j.fueros?.nombre || '').toLowerCase().includes(searchTerm)) ||
        ((j.tipo_proceso || '').toLowerCase().includes(searchTerm))
    );

    renderAdminJuicios(filteredData, page);
}

export function renderActuaciones(actuaciones: Actuacion[]) {
    const listContainer = document.getElementById('actuaciones-list');
    if (!listContainer) return;

    if (actuaciones.length === 0) {
        listContainer.innerHTML = `<div class="text-center text-muted p-3">No hay actuaciones registradas.</div>`;
        return;
    }

    listContainer.innerHTML = actuaciones.map(act => `
        <div class="card mb-2">
            <div class="card-body p-2">
                <div class="d-flex justify-content-between">
                    <span class="badge bg-secondary">${act.tipo}</span>
                    <span class="small text-muted">${new Date(act.fecha + 'T00:00:00').toLocaleDateString()}</span>
                </div>
                <p class="card-text small mt-1 mb-0">${act.descripcion}</p>
            </div>
        </div>
    `).join('');
}

export function renderTimeline(etapas: EtapaProceso[], expediente: Expediente) {
    const timelineContainer = document.getElementById('expediente-timeline');
    if (!timelineContainer) return;

    if (etapas.length === 0) {
        timelineContainer.innerHTML = `<p class="text-muted">No hay etapas definidas.</p>`;
        return;
    }

    const etapaActualIndex = etapas.findIndex(e => e.id === expediente.etapa_actual_id);

    timelineContainer.innerHTML = etapas.map((etapa, index) => {
        const isCompleted = (expediente.etapas_completadas || []).includes(etapa.id) || index < etapaActualIndex;
        const isCurrent = etapa.id === expediente.etapa_actual_id;
        const statusClass = isCurrent ? 'current' : (isCompleted ? 'completed' : 'upcoming');

        // Todas las etapas son clickeables ahora (para permitir retroceso)
        const clickableClass = 'clickable';
        const cursorStyle = 'cursor: pointer;';

        return `
            <div class="timeline-stage ${statusClass} ${clickableClass}" data-etapa-id="${etapa.id}" style="${cursorStyle}" title="Click para cambiar a esta etapa">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <p class="stage-title">${etapa.nombre}</p>
                    <p class="stage-date">${etapa.plazo_id ? 'Plazo vinculado' : 'Sin plazo'}</p>
                </div>
            </div>
        `;
    }).join('');
}

export function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearEl = document.getElementById('calendar-month-year');
    if (!calendarGrid || !monthYearEl) return;

    monthYearEl.textContent = store.state.currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

    const today = new Date();
    const month = store.state.currentDate.getMonth();
    const year = store.state.currentDate.getFullYear();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarCells = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarCells.push('<div class="calendar-day other-month"></div>');
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const fullDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const todayClass = isToday ? 'today' : '';

        const dayEvents = store.state.eventos.filter(event => {
            const eventDate = new Date(event.fecha_evento + 'T00:00:00');
            return eventDate.getDate() === i && eventDate.getMonth() === month && eventDate.getFullYear() === year;
        });

        const eventsHTML = dayEvents.map(event => {
            const isLinked = event.expediente_id ? 'linked-event' : '';
            const expedienteAttr = event.expediente_id ? `data-expediente-id="${event.expediente_id}"` : '';
            return `<div class="calendar-event ${isLinked}" ${expedienteAttr}>${event.titulo}</div>`;
        }).join('');

        calendarCells.push(`
            <div class="calendar-day ${todayClass}" data-date="${fullDateString}">
                <div class="day-number">${i}</div>
                ${eventsHTML}
            </div>
        `);
    }

    calendarGrid.innerHTML = calendarCells.join('');
}

export function renderPlazos(plazos: PlazoProcesal[]) {
    const listContainer = document.getElementById('plazos-list-container');
    if (!listContainer) return;

    if (plazos.length === 0) {
        listContainer.innerHTML = `<div class="col-12 text-center p-5 text-muted">No se encontraron plazos.</div>`;
        return;
    }

    listContainer.innerHTML = '';

    plazos.forEach(p => {
        const durationLabel = getPlazoDuration(p);
        const fueroLabel = p.fuero || 'Sin fuero';
        const articuloLabel = p.articulo ? `Art. ${p.articulo}` : '';

        let iconColorClass = 'text-primary';
        let bgColorClass = 'bg-primary';
        const fueroLower = (p.fuero || '').toLowerCase();

        if (fueroLower.includes('civil')) { iconColorClass = 'text-info'; bgColorClass = 'bg-info'; }
        else if (fueroLower.includes('penal')) { iconColorClass = 'text-danger'; bgColorClass = 'bg-danger'; }
        else if (fueroLower.includes('laboral')) { iconColorClass = 'text-warning'; bgColorClass = 'bg-warning'; }

        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';
        col.innerHTML = `
            <div class="card h-100 border-0 shadow-sm hover-shadow transition-all">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="badge ${bgColorClass} bg-opacity-10 ${iconColorClass} border border-0">${fueroLabel}</span>
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-light text-secondary btn-edit-plazo p-1" data-plazo-id="${p.id}" title="Editar"><i class="ph ph-pencil"></i></button>
                            <button class="btn btn-sm btn-light text-danger btn-delete-plazo p-1" data-plazo-id="${p.id}" title="Eliminar"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                    
                    <h6 class="fw-bold text-dark mb-1 text-truncate" title="${p.accion_procedimiento}">${p.accion_procedimiento}</h6>
                    <div class="d-flex align-items-center gap-2 mb-3">
                        <small class="text-muted">${p.tipo_proceso || 'General'}</small>
                        ${articuloLabel ? `<span class="text-muted small">• ${articuloLabel}</span>` : ''}
                    </div>
                    
                    <div class="d-flex align-items-center gap-2 mt-auto p-2 bg-light rounded-2">
                        <i class="ph ph-timer fs-5 text-primary"></i>
                        <span class="fw-bold text-dark">${durationLabel}</span>
                    </div>
                </div>
            </div>
        `;
        listContainer.appendChild(col);
    });
}


export function updatePlazosPagination(currentPage: number, totalCount: number) {
    const prevPageItem = document.getElementById('plazos-prev-page-item');
    const nextPageItem = document.getElementById('plazos-next-page-item');
    const totalPages = Math.ceil(totalCount / store.state.PLAZOS_PAGE_SIZE);

    if (prevPageItem) prevPageItem.classList.toggle('disabled', currentPage === 0);
    if (nextPageItem) nextPageItem.classList.toggle('disabled', currentPage >= totalPages - 1);
}

export function populatePlazosFilters() {
    const fueroSelect = document.getElementById('plazos-filter-fuero');
    if (!fueroSelect) return;
    const fueros = [...new Set(store.state.allPlazos.map(p => p.fuero).filter(Boolean))];
    fueroSelect.innerHTML = '<option value="">Todos los fueros</option>';
    fueros.forEach(fuero => {
        fueroSelect.innerHTML += `<option value="${fuero}">${fuero}</option>`;
    });
}

export function applyPlazosFilters(page = 0) {
    const searchTerm = (document.getElementById('plazos-search-input') as HTMLInputElement).value.toLowerCase();
    const selectedFuero = (document.getElementById('plazos-filter-fuero') as HTMLSelectElement).value;

    const filteredData = store.state.allPlazos.filter(p => {
        const matchesSearch = p.accion_procedimiento.toLowerCase().includes(searchTerm) || (p.articulo && p.articulo.toLowerCase().includes(searchTerm));
        const matchesFuero = !selectedFuero || p.fuero === selectedFuero;
        return matchesSearch && matchesFuero;
    });

    const start = page * store.state.PLAZOS_PAGE_SIZE;
    const end = start + store.state.PLAZOS_PAGE_SIZE;
    const paginatedResult = filteredData.slice(start, end);

    renderPlazos(paginatedResult);
    updatePlazosPagination(page, filteredData.length);
}

export function renderNotifications(notifications: any[]) {
    const notificationItems = document.getElementById('notification-items');
    const notificationCount = document.getElementById('notification-count');

    if (!notificationItems || !notificationCount) return;

    if (notifications.length === 0) {
        notificationItems.innerHTML = '<p class="text-muted small text-center p-2">No hay notificaciones</p>';
        notificationCount.textContent = '0';
        notificationCount.classList.add('d-none');
        return;
    }

    notificationCount.textContent = notifications.length.toString();
    notificationCount.classList.remove('d-none');

    notificationItems.innerHTML = notifications.map(notif => `
        <div class="border-bottom pb-2 mb-2 notification-item" data-notification-id="${notif.id}" style="cursor: pointer;">
            <div class="d-flex justify-content-between">
                <strong class="small">${notif.titulo}</strong>
                <small class="text-muted">${new Date(notif.creado_en).toLocaleDateString()}</small>
            </div>
            <p class="mb-0 small">${notif.mensaje}</p>
        </div>
    `).join('');

    // Note: Event listeners for notifications should be attached by the caller or here if we want to handle it.
    // For now we just render HTML.
}

export async function renderExpedienteResumen(expedienteId: string) {
    try {
        const expediente = store.state.allExpedientes.find(e => e.id === expedienteId);
        if (!expediente) return;

        const data = await Service.getExpedienteResumenData(expedienteId);

        const nroEl = document.getElementById('resumen-nro');
        if (nroEl) nroEl.textContent = expediente.nro_expediente || 'N/A';

        const caratulaEl = document.getElementById('resumen-caratula');
        if (caratulaEl) caratulaEl.textContent = expediente.caratula || 'N/A';

        const contraparteEl = document.getElementById('resumen-contraparte');
        if (contraparteEl) contraparteEl.textContent = expediente.contraparte || 'N/A';

        const estadoEl = document.getElementById('resumen-estado');
        if (estadoEl) estadoEl.textContent = getStatusBadge(expediente.estado).text;

        const tareasCompEl = document.getElementById('resumen-tareas-completadas');
        if (tareasCompEl) tareasCompEl.textContent = data.tareas.filter((t: any) => t.completada).length.toString();

        const tareasTotalEl = document.getElementById('resumen-tareas-totales');
        if (tareasTotalEl) tareasTotalEl.textContent = data.tareas.length.toString();

        const ultimaActEl = document.getElementById('resumen-ultima-actuacion');
        if (ultimaActEl) ultimaActEl.textContent = data.ultimaActuacion ? new Date(data.ultimaActuacion.fecha + 'T00:00:00').toLocaleDateString() : 'Ninguna';

        const proxEventoEl = document.getElementById('resumen-proximo-vencimiento');
        if (proxEventoEl) proxEventoEl.textContent = data.proximoEvento ? new Date(data.proximoEvento.fecha_evento + 'T00:00:00').toLocaleDateString() : 'Ninguno';

    } catch (error) {
        handleError(error, 'renderExpedienteResumen');
    }
}

export async function renderEtapasEnModal(juicioId: string) {
    const listContainer = document.getElementById('etapas-list');
    if (!listContainer) return;

    try {
        listContainer.innerHTML = `<div class="loader mx-auto"></div>`;

        const etapas = await Service.fetchEtapas(juicioId);
        const plazos = await Service.fetchPlazos();

        const plazosOptions = `<option value="">Ningún plazo vinculado</option>` + plazos.map((p: any) =>
            `<option value="${p.id}">${p.accion_procedimiento} (${getPlazoDuration(p)})</option>`
        ).join('');

        if (etapas.length === 0) {
            listContainer.innerHTML = `<p class="text-muted">No hay etapas definidas para este tipo de juicio.</p>`;
            return;
        }

        listContainer.innerHTML = etapas.map((etapa: any) => `
            <div class="d-flex align-items-center gap-2 mb-2 p-2 border rounded etapa-item" data-id="${etapa.id}">
                <i class="ph ph-dots-six-vertical" style="cursor: move;"></i>
                <input type="text" class="form-control form-control-sm etapa-nombre-input" value="${etapa.nombre}" placeholder="Nombre de la etapa">
                <select class="form-select form-select-sm etapa-plazo-select" data-plazo-id="${etapa.plazo_id || ''}">
                    ${plazosOptions}
                </select>
                <button class="btn btn-sm btn-danger btn-delete-etapa" data-id="${etapa.id}">&times;</button>
            </div>
        `).join('');

        listContainer.querySelectorAll('.etapa-plazo-select').forEach((select: any) => {
            select.value = select.dataset.plazoId;
        });

    } catch (error) {
        handleError(error, 'renderEtapasEnModal');
        if (listContainer) listContainer.innerHTML = `<p class="text-danger">Error al cargar datos.</p>`;
    }
}

export function populateEtapaFilter() {
    const etapaFilter = document.getElementById('filter-etapa');
    if (!etapaFilter) return;

    const etapasUnicas = [...new Set(store.state.allExpedientes.map(exp => exp.etapas_proceso?.nombre).filter(Boolean))];

    etapaFilter.innerHTML = '<option value="">Todas las etapas</option>';
    etapasUnicas.forEach(etapa => {
        etapaFilter.innerHTML += `<option value="${etapa}">${etapa}</option>`;
    });
}

export function populatePlazoFormSelects(fueroSelector: string, tipoProcesoSelector: string) {
    const fueroSelect = document.querySelector(fueroSelector);
    const tipoProcesoSelect = document.querySelector(tipoProcesoSelector);
    if (!fueroSelect || !tipoProcesoSelect) return;

    const fueros = [...new Set(store.state.allPlazos.map(p => p.fuero))].filter(Boolean);
    const tiposProceso = [...new Set(store.state.allPlazos.map(p => p.tipo_proceso))].filter(Boolean);

    fueroSelect.innerHTML = '<option value="">Seleccione un fuero...</option>' + fueros.map(f => `<option value="${f}">${f}</option>`).join('');
    tipoProcesoSelect.innerHTML = '<option value="">Seleccione un tipo...</option>' + tiposProceso.map(tp => `<option value="${tp}">${tp}</option>`).join('');
}

export function renderAreasList() {
    const list = document.getElementById('areas-list');
    if (!list) return;

    if (!store.state.allAreas.length) {
        list.innerHTML = '<li class="list-group-item text-muted small">No hay áreas registradas.</li>';
        return;
    }

    list.innerHTML = store.state.allAreas
        .map(area => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span>${area.nombre}</span>
                <button class="btn btn-sm btn-outline-danger btn-delete-area" data-area-id="${area.id}" data-area-nombre="${area.nombre}">
                    <i class="ph ph-trash"></i>
                </button>
            </li>
        `)
        .join('');
}

export function renderFuerosList() {
    const list = document.getElementById('fueros-list');
    if (!list) return;

    if (!store.state.allFueros.length) {
        list.innerHTML = '<li class="list-group-item text-muted small">No hay fueros registrados.</li>';
        return;
    }

    list.innerHTML = store.state.allFueros
        .map(fuero => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span>${fuero.nombre}</span>
                <button class="btn btn-sm btn-outline-danger btn-delete-fuero" data-fuero-id="${fuero.id}" data-fuero-nombre="${fuero.nombre}">
                    <i class="ph ph-trash"></i>
                </button>
            </li>
        `)
        .join('');
}

export function populateJuicioCatalogSelects() {
    const areaSelect = document.getElementById('juicio-area');
    if (areaSelect) {
        const options = (store.state.allAreas || []).map(area => `<option value="${area.id}">${area.nombre}</option>`).join('');
        areaSelect.innerHTML = '<option value="">Seleccione un área...</option>' + options;
    }

    const fueroSelect = document.getElementById('juicio-fuero');
    if (fueroSelect) {
        const options = (store.state.allFueros || []).map(fuero => `<option value="${fuero.id}">${fuero.nombre}</option>`).join('');
        fueroSelect.innerHTML = '<option value="">Seleccione un fuero...</option>' + options;
    }
}

// --- EVENT HANDLERS (Migrated from data.js/supabaseService.ts) ---

export async function handleNewExpedienteSubmit(e: Event, andAddAnother = false) {
    e.preventDefault();
    const form = document.getElementById('new-expediente-form') as HTMLFormElement;
    if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated');
        showToast('Por favor, completa todos los campos obligatorios.', 'warning');
        return;
    }

    try {
        const formData = {
            nro_expediente: (document.getElementById('exp-nro') as HTMLInputElement).value,
            cliente_id: (document.getElementById('exp-cliente') as HTMLSelectElement).value,
            caratula: (document.getElementById('exp-caratula') as HTMLInputElement).value,
            contraparte: (document.getElementById('exp-contraparte') as HTMLInputElement).value,
            tipo_juicio_id: (document.getElementById('exp-tipo-juicio') as HTMLSelectElement).value,
            despacho_id: store.state.currentUserProfile?.despacho_id,
            responsable_id: store.state.currentUserProfile?.id,
            monto_demanda: parseFloat((document.getElementById('exp-monto') as HTMLInputElement).value.replace(/\./g, '')) || null,
            cuenta_corriente_judicial: (document.getElementById('exp-cuenta') as HTMLInputElement).value || null,
        };

        const etapas = await Service.fetchEtapas(formData.tipo_juicio_id);
        const etapaInicial = etapas?.[0]?.id || null;

        await Service.createExpediente({
            ...formData,
            estado: 'en_curso',
            etapa_actual_id: etapaInicial,
            etapas_completadas: [],
            fecha_creacion: new Date().toISOString()
        } as any);

        showToast('Expediente creado con éxito.', 'success');
        await Service.fetchExpedientes();
        renderExpedientes(store.state.allExpedientes, store.state.currentPage);
        populateEtapaFilter();

        if (andAddAnother) {
            form.classList.remove('was-validated');
            ['exp-nro', 'exp-contraparte', 'exp-caratula', 'exp-monto', 'exp-cuenta'].forEach(id => (document.getElementById(id) as HTMLInputElement).value = '');
            document.getElementById('exp-nro')?.focus();
        } else {
            store.state.nuevoExpedienteModal.hide();
        }
    } catch (error) {
        handleError(error, 'handleNewExpedienteSubmit');
    }
}

export async function handleEditExpedienteSubmit(e: Event) {
    e.preventDefault();
    try {
        const id = (document.getElementById('edit-exp-id') as HTMLInputElement).value;
        const formData = {
            nro_expediente: (document.getElementById('edit-exp-nro') as HTMLInputElement).value,
            cliente_id: (document.getElementById('edit-exp-cliente') as HTMLSelectElement).value,
            caratula: (document.getElementById('edit-exp-caratula') as HTMLInputElement).value,
            contraparte: (document.getElementById('edit-exp-contraparte') as HTMLInputElement).value,
            tipo_juicio_id: (document.getElementById('edit-exp-tipo-juicio') as HTMLSelectElement).value,
            estado: (document.getElementById('edit-exp-estado') as HTMLSelectElement).value as any,
            monto_demanda: parseFloat((document.getElementById('edit-exp-monto') as HTMLInputElement).value.replace(/\./g, '')) || null,
            cuenta_corriente_judicial: (document.getElementById('edit-exp-cuenta') as HTMLInputElement).value || null,
        };

        await Service.updateExpediente(id, formData);

        showToast('Expediente actualizado.', 'success');
        store.state.editarExpedienteModal.hide();
        await Service.fetchExpedientes();
        renderExpedientes(store.state.allExpedientes, store.state.currentPage);
        populateEtapaFilter();
    } catch (error) {
        handleError(error, 'handleEditExpedienteSubmit');
    }
}

export async function handleDeleteExpediente(id: string) {
    showConfirmDeleteModal(
        'Confirmar Eliminación de Expediente',
        '¿Estás seguro de que quieres borrar el expediente? Esta acción no se puede deshacer.',
        async () => {
            try {
                await Service.deleteExpediente(id);

                showToast('Expediente borrado correctamente.', 'success');
                const currentView = sessionStorage.getItem('lastView');
                if (currentView === 'cliente-expedientes' && store.state.currentClienteId) {
                    // Refresh logic for client specific view if needed
                    await Service.fetchExpedientes();
                    renderExpedientes(store.state.allExpedientes, store.state.currentPage);
                } else {
                    await Service.fetchExpedientes();
                    renderExpedientes(store.state.allExpedientes, store.state.currentPage);
                }
            } catch (error) {
                handleError(error, 'handleDelete');
            }
        }
    );
}

export async function handleNewClientSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated');
        return;
    }

    try {
        const formData = {
            nombre: (document.getElementById('client-nombre') as HTMLInputElement).value.trim(),
            cedula: (document.getElementById('client-cedula') as HTMLInputElement).value,
            telefono: (document.getElementById('client-telefono') as HTMLInputElement).value,
            email: (document.getElementById('client-email') as HTMLInputElement).value,
            despacho_id: store.state.currentUserProfile?.despacho_id,
        };

        await Service.createCliente(formData as any);

        showToast('Cliente creado con éxito.', 'success');
        store.state.nuevoClienteModal.hide();

        await Service.fetchClientes();
        const clientesView = document.getElementById('clientes-view');
        if (clientesView && !clientesView.classList.contains('d-none')) {
            renderClientes(store.state.allClientes);
        }
    } catch (error) {
        handleError(error, 'handleNewClientSubmit');
    }
}

export async function handleFileUpload(e: Event) {
    e.preventDefault();
    const uploadButton = document.getElementById('upload-button') as HTMLButtonElement;
    const fileInput = document.getElementById('document-input') as HTMLInputElement;
    try {
        const file = fileInput.files?.[0];

        if (!file) {
            showToast('Por favor, selecciona un archivo.', 'warning');
            return;
        }
        if (!store.state.currentClienteId) {
            showToast('Error: No se ha seleccionado un cliente.', 'danger');
            return;
        }

        uploadButton.disabled = true;
        uploadButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Subiendo...`;

        await Service.uploadDocument(`${store.state.currentClienteId}/${file.name}`, file);

        showToast('Archivo subido con éxito.', 'success');
        const docs = await Service.fetchDocumentos(store.state.currentClienteId);
        renderDocumentos(docs || []);
    } catch (error) {
        handleError(error, 'handleFileUpload');
    } finally {
        uploadButton.disabled = false;
        uploadButton.innerHTML = `<i class="ph ph-upload-simple me-1"></i> Subir`;
        fileInput.value = '';
    }
}

export async function handleExpedienteFileUpload(e: Event) {
    e.preventDefault();
    const uploadButton = document.getElementById('upload-expediente-button') as HTMLButtonElement;
    const fileInput = document.getElementById('expediente-document-input') as HTMLInputElement;
    try {
        const file = fileInput.files?.[0];

        if (!file) {
            showToast('Por favor, selecciona un archivo.', 'warning');
            return;
        }
        if (!store.state.currentExpedienteId) {
            showToast('Error: No se ha seleccionado un expediente.', 'danger');
            return;
        }

        uploadButton.disabled = true;
        uploadButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Subiendo...`;

        await Service.uploadDocument(`expediente_${store.state.currentExpedienteId}/${file.name}`, file);

        showToast('Archivo subido con éxito.', 'success');
        const docs = await Service.fetchExpedienteDocumentos(store.state.currentExpedienteId);
        renderExpedienteDocumentos(docs || [], store.state.currentExpedienteId);
    } catch (error) {
        handleError(error, 'handleExpedienteFileUpload');
    } finally {
        uploadButton.disabled = false;
        uploadButton.innerHTML = `<i class="ph ph-upload-simple me-1"></i> Subir`;
        fileInput.value = '';
    }
}

export async function handleFileDownload(fileName: string) {
    try {
        const data = await Service.downloadDocument(`${store.state.currentClienteId}/${fileName}`);

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

export async function handleExpedienteFileDownload(fileName: string, expedienteId: string) {
    try {
        const data = await Service.downloadDocument(`expediente_${expedienteId}/${fileName}`);

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

export function handleFileDelete(fileName: string) {
    showConfirmDeleteModal(
        'Confirmar Eliminación de Documento',
        `¿Estás seguro de que quieres borrar el archivo "${fileName}"?`,
        async () => {
            try {
                await Service.deleteDocument(`${store.state.currentClienteId}/${fileName}`);

                showToast('Archivo borrado con éxito.', 'success');
                if (store.state.currentClienteId) {
                    const docs = await Service.fetchDocumentos(store.state.currentClienteId);
                    renderDocumentos(docs || []);
                }
            } catch (error) {
                handleError(error, 'handleFileDelete');
            }
        }
    );
}

export function handleExpedienteFileDelete(fileName: string, expedienteId: string) {
    showConfirmDeleteModal(
        'Confirmar Eliminación de Documento',
        `¿Estás seguro de que quieres borrar el archivo "${fileName}"?`,
        async () => {
            try {
                await Service.deleteDocument(`expediente_${expedienteId}/${fileName}`);

                showToast('Archivo borrado con éxito.', 'success');
                const docs = await Service.fetchExpedienteDocumentos(expedienteId);
                renderExpedienteDocumentos(docs || [], expedienteId);
            } catch (error) {
                handleError(error, 'handleExpedienteFileDelete');
            }
        }
    );
}

export async function handleStageUpdate(etapaId: string) {
    try {
        const newIndex = store.state.allEtapas.findIndex(e => e.id == etapaId);
        if (newIndex === -1) return;

        // Detectar si es un retroceso
        const currentIndex = store.state.allEtapas.findIndex(e => e.id === store.state.allExpedientes.find(exp => exp.id === store.state.currentExpedienteId)?.etapa_actual_id);

        if (newIndex < currentIndex) {
            // Es un retroceso - pedir confirmación
            const confirmBack = confirm(
                `⚠️ Estás a punto de retroceder de etapa.\n\n` +
                `Etapa actual: ${store.state.allEtapas[currentIndex]?.nombre}\n` +
                `Nueva etapa: ${store.state.allEtapas[newIndex]?.nombre}\n\n` +
                `Las etapas posteriores ya no estarán marcadas como completadas.\n` +
                `¿Deseas continuar?`
            );

            if (!confirmBack) {
                return; // Cancelar el retroceso
            }
        }

        const etapasCompletadas = store.state.allEtapas.slice(0, newIndex).map(e => e.id);
        const esUltima = newIndex === store.state.allEtapas.length - 1;
        const nuevoEstado: any = esUltima ? 'completado' : 'en_curso';

        const updatedExp = await Service.updateEtapaExpediente(store.state.currentExpedienteId!, etapaId, etapasCompletadas, nuevoEstado);

        showToast('Etapa actualizada.', 'success');
        store.state.allExpedientes = store.state.allExpedientes.map(exp => exp.id === updatedExp.id ? { ...exp, ...updatedExp } : exp);
        renderTimeline(store.state.allEtapas, updatedExp);
        await renderExpedienteResumen(store.state.currentExpedienteId!);

        try {
            const proximaEtapa = store.state.allEtapas[newIndex + 1];
            if (proximaEtapa && proximaEtapa.plazo_id) {
                const plazoEncontrado = await Service.getPlazoById(proximaEtapa.plazo_id);

                if (plazoEncontrado) {
                    const feriados = store.state.feriados?.length ? store.state.feriados : await Service.fetchFeriados(new Date().getFullYear());
                    const duracionTexto = getPlazoDuration(plazoEncontrado);
                    if (!duracionTexto || !/\d/.test(duracionTexto)) {
                        showToast('Etapa vinculada sin duracion de plazo, no se agenda evento.', 'warning');
                        return;
                    }
                    const fechaVencimiento = calcularFechaVencimiento(
                        new Date(),
                        duracionTexto,
                        plazoEncontrado.tipo_duracion,
                        feriados
                    );

                    const eventoData = {
                        titulo: `Vencimiento: ${proximaEtapa.nombre}`,
                        fecha_evento: fechaVencimiento.toISOString().split('T')[0],
                        descripcion: `Plazo automático para "${updatedExp.caratula}". Basado en: ${plazoEncontrado.articulo}.`,
                        despacho_id: store.state.currentUserProfile?.despacho_id,
                        expediente_id: store.state.currentExpedienteId
                    };

                    const nuevoEvento = await Service.upsertEventoPorTitulo(eventoData);

                    showToast(`Plazo para "${proximaEtapa.nombre}" agendado para el ${fechaVencimiento.toLocaleDateString()}.`, 'info');
                    const existingIndex = store.state.eventos.findIndex(ev => ev.id === nuevoEvento.id);
                    if (existingIndex >= 0) store.state.eventos[existingIndex] = nuevoEvento;
                    else store.state.eventos.push(nuevoEvento);
                    const currentView = sessionStorage.getItem('lastView');
                    if (currentView === 'calendario') renderCalendar();
                }
            }
        } catch (e) {
            console.error('Error durante la automatización de plazos:', e);
            showToast('Etapa actualizada, pero hubo un error al crear el plazo automático.', 'warning');
        }
    } catch (error) {
        handleError(error, 'handleStageUpdate');
    }
}

export async function handleNewJuicioSubmit(e: Event) {
    e.preventDefault();
    try {
        const form = e.target as HTMLFormElement;
        const areaId = (document.getElementById('juicio-area') as HTMLSelectElement).value;
        const fueroId = (document.getElementById('juicio-fuero') as HTMLSelectElement).value;
        const formData = {
            nombre: (document.getElementById('juicio-nombre') as HTMLInputElement).value,
            tipo_proceso: (document.getElementById('juicio-proceso') as HTMLInputElement).value || null,
            area_id: areaId || null,
            fuero_id: fueroId || null,
        };

        await Service.createTipoJuicio(formData);

        showToast('Tipo de juicio guardado.', 'success');
        form.reset();
        store.state.nuevoJuicioModal.hide();

        await Service.fetchAllInitialData();
        const data = await Service.fetchAdminJuicios();
        renderAdminJuicios(data || [], 0);
    } catch (error) {
        handleError(error, 'handleNewJuicioSubmit');
    }
}

export async function handleNewAreaSubmit(e: Event) {
    e.preventDefault();
    const input = document.getElementById('new-area-name') as HTMLInputElement;
    const nombre = input.value.trim();
    if (!nombre) return;
    try {
        await Service.createArea(nombre);
        input.value = '';
        showToast('Área creada correctamente.', 'success');
        await Service.fetchCatalogs();
        renderAreasList();
        populateJuicioCatalogSelects();
    } catch (error) {
        handleError(error, 'handleNewAreaSubmit');
    }
}

export function handleDeleteArea(areaId: string, areaNombre: string) {
    showConfirmDeleteModal(
        'Eliminar Área',
        `¿Seguro que deseas eliminar el área "${areaNombre}"?`,
        async () => {
            try {
                await Service.deleteArea(areaId);
                showToast('Área eliminada.', 'success');
                await Service.fetchCatalogs();
                renderAreasList();
                populateJuicioCatalogSelects();
            } catch (error) {
                handleError(error, 'handleDeleteArea');
            }
        }
    );
}

export async function handleNewFueroSubmit(e: Event) {
    e.preventDefault();
    const input = document.getElementById('new-fuero-name') as HTMLInputElement;
    const nombre = input.value.trim();
    if (!nombre) return;
    try {
        await Service.createFuero(nombre);
        input.value = '';
        showToast('Fuero creado correctamente.', 'success');
        await Service.fetchCatalogs();
        renderFuerosList();
        populateJuicioCatalogSelects();
    } catch (error) {
        handleError(error, 'handleNewFueroSubmit');
    }
}

export function handleDeleteFuero(fueroId: string, fueroNombre: string) {
    showConfirmDeleteModal(
        'Eliminar Fuero',
        `¿Seguro que deseas eliminar el fuero "${fueroNombre}"?`,
        async () => {
            try {
                await Service.deleteFuero(fueroId);
                showToast('Fuero eliminado.', 'success');
                await Service.fetchCatalogs();
                renderFuerosList();
                populateJuicioCatalogSelects();
            } catch (error) {
                handleError(error, 'handleDeleteFuero');
            }
        }
    );
}

export async function handleNewEtapaSubmit(e: Event) {
    e.preventDefault();
    try {
        const juicioId = (document.getElementById('etapas-juicio-id') as HTMLInputElement).value;
        const formData = {
            tipo_juicio_id: juicioId,
            nombre: (document.getElementById('etapa-nombre') as HTMLInputElement).value,
            descripcion: (document.getElementById('etapa-desc') as HTMLInputElement).value,
        };

        await Service.createEtapa(formData as any);

        showToast('Etapa añadida.', 'success');
        (e.target as HTMLFormElement).reset();
        await renderEtapasEnModal(juicioId);
    } catch (error) {
        handleError(error, 'handleNewEtapaSubmit');
    }
}

export async function handleNewActuacionSubmit(e: Event) {
    e.preventDefault();
    try {
        const expediente = store.state.allExpedientes.find(exp => exp.id === store.state.currentExpedienteId);
        if (!expediente || !expediente.etapa_actual_id) {
            showToast('Seleccione una etapa actual antes de añadir una actuación.', 'warning');
            return;
        }

        const formData = {
            expediente_id: store.state.currentExpedienteId,
            etapa_id: expediente.etapa_actual_id,
            despacho_id: store.state.currentUserProfile?.despacho_id,
            responsable_id: store.state.currentUserProfile?.id,
            tipo: (document.getElementById('actuacion-tipo') as HTMLSelectElement).value,
            fecha: (document.getElementById('actuacion-fecha') as HTMLInputElement).value,
            descripcion: (document.getElementById('actuacion-descripcion') as HTMLTextAreaElement).value,
        };

        await Service.createActuacion(formData as any);

        showToast('Actuación guardada.', 'success');
        (e.target as HTMLFormElement).reset();
        if (store.state.currentExpedienteId) {
            const acts = await Service.fetchActuaciones(store.state.currentExpedienteId);
            renderActuaciones(acts || []);
            await renderExpedienteResumen(store.state.currentExpedienteId);
        }
    } catch (error) {
        handleError(error, 'handleNewActuacionSubmit');
    }
}

export async function handleNewEventSubmit(e: Event) {
    e.preventDefault();
    try {
        const form = e.target as HTMLFormElement;
        const expedienteId = store.state.eventExpedienteChoices.getValue(true);
        const formData = {
            titulo: (document.getElementById('event-title') as HTMLInputElement).value,
            fecha_evento: (document.getElementById('event-date') as HTMLInputElement).value,
            descripcion: (document.getElementById('event-description') as HTMLTextAreaElement).value,
            despacho_id: store.state.currentUserProfile?.despacho_id,
            ...(expedienteId && { expediente_id: expedienteId })
        };

        const nuevoEvento = await Service.createEvento(formData);

        showToast('Evento creado con éxito.', 'success');
        store.state.eventos.push(nuevoEvento);

        const currentView = sessionStorage.getItem('lastView');
        if (currentView === 'calendario') renderCalendar();

        store.state.nuevoEventoModal.hide();
    } catch (error) {
        handleError(error, 'handleNewEventSubmit');
    }
}

export async function handleRoleSave(memberId: string) {
    try {
        const select = document.querySelector(`select[data-member-id="${memberId}"]`) as HTMLSelectElement;
        const newRole = select.value;
        await Service.updatePerfilRol(memberId, newRole);
        showToast('Rol actualizado correctamente.', 'success');
    } catch (error) {
        handleError(error, 'handleRoleSave');
    }
}

export async function handleSaveEtapas() {
    try {
        const etapaItems = document.querySelectorAll('#etapas-list .etapa-item');
        const updates = Array.from(etapaItems).map((item: any, index) => ({
            id: item.dataset.id,
            nombre: item.querySelector('.etapa-nombre-input').value,
            plazo_id: item.querySelector('.etapa-plazo-select').value || null,
            orden: index
        }));

        await Service.upsertEtapas(updates as any);

        showToast('Etapas y plazos vinculados guardados.', 'success');
        store.state.editarEtapasModal.hide();
    } catch (error) {
        handleError(error, 'handleSaveEtapas');
    }
}

export async function handleCreateUserSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;

    if (!form.checkValidity()) {
        e.stopPropagation();
        form.classList.add('was-validated');
        showToast('Por favor, completa todos los campos obligatorios.', 'warning');
        return;
    }

    try {
        const name = (document.getElementById('new-user-name') as HTMLInputElement).value;
        const email = (document.getElementById('new-user-email') as HTMLInputElement).value;
        const password = (document.getElementById('new-user-password') as HTMLInputElement).value;

        submitButton.disabled = true;
        submitButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Creando...`;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No hay sesión activa para autorizar esta acción.");

        await Service.createDespachoAndUser({ name, email, password, despacho_id: store.state.currentUserProfile?.despacho_id });

        showToast('Usuario creado correctamente.', 'success');
        form.reset();
        form.classList.remove('was-validated');
        const members = await Service.fetchMembers();
        renderMembers(members || []);
    } catch (error) {
        handleError(error, 'handleCreateUserSubmit');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Crear Usuario';
    }
}

export async function handleNewPlazoSubmit(e: Event) {
    e.preventDefault();
    try {
        const form = e.target as HTMLFormElement;
        const duracionNumeroValue = (document.getElementById('plazo-duracion-numero') as HTMLInputElement).value;
        const formData = {
            accion_procedimiento: (document.getElementById('plazo-accion') as HTMLInputElement).value,
            fuero: (document.getElementById('plazo-fuero') as HTMLInputElement).value,
            tipo_proceso: (document.getElementById('plazo-tipo-proceso') as HTMLInputElement).value,
            articulo: (document.getElementById('plazo-articulo') as HTMLInputElement).value,
            descripcion: (document.getElementById('plazo-descripcion') as HTMLInputElement).value,
            duracion_numero: duracionNumeroValue ? parseInt(duracionNumeroValue, 10) : null,
            unidad: (document.getElementById('plazo-unidad') as HTMLSelectElement).value || null,
            tipo_duracion: (document.getElementById('plazo-tipo-duracion') as HTMLSelectElement).value || 'habiles',
            instancia: (document.getElementById('plazo-instancia') as HTMLInputElement).value,
            notas: (document.getElementById('plazo-notas') as HTMLTextAreaElement).value,
        };

        await Service.createPlazo(formData as any);

        showToast('Plazo guardado correctamente.', 'success');
        store.state.nuevoPlazoModal.hide();
        const plazos = await Service.fetchPlazos();
        renderPlazos(plazos || []);
    } catch (error) {
        handleError(error, 'handleNewPlazoSubmit');
    }
}

export async function handleEditPlazoSubmit(e: Event) {
    e.preventDefault();
    try {
        const id = (document.getElementById('edit-plazo-id') as HTMLInputElement).value;
        const duracionNumeroValue = (document.getElementById('edit-plazo-duracion-numero') as HTMLInputElement).value;
        const formData = {
            accion_procedimiento: (document.getElementById('edit-plazo-accion') as HTMLInputElement).value,
            fuero: (document.getElementById('edit-plazo-fuero') as HTMLInputElement).value,
            tipo_proceso: (document.getElementById('edit-plazo-tipo-proceso') as HTMLInputElement).value,
            articulo: (document.getElementById('edit-plazo-articulo') as HTMLInputElement).value,
            descripcion: (document.getElementById('edit-plazo-descripcion') as HTMLInputElement).value,
            duracion_numero: duracionNumeroValue ? parseInt(duracionNumeroValue, 10) : null,
            unidad: (document.getElementById('edit-plazo-unidad') as HTMLSelectElement).value || null,
            tipo_duracion: (document.getElementById('edit-plazo-tipo-duracion') as HTMLSelectElement).value || 'habiles',
        };

        await Service.updatePlazo(id, formData);

        showToast('Plazo actualizado.', 'success');
        store.state.editarPlazoModal.hide();
        const plazos = await Service.fetchPlazos();
        renderPlazos(plazos || []);
    } catch (error) {
        handleError(error, 'handleEditPlazoSubmit');
    }
}

// --- ADMIN DASHBOARD RENDERER ---

export async function renderLicenseDashboard() {
    const dashboardContainer = document.getElementById('license-dashboard');
    if (!dashboardContainer) return;

    dashboardContainer.innerHTML = '<div class="col-12 text-center py-3 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Cargando...</div>';

    try {
        const despachoId = store.state.currentUserProfile?.despacho_id;
        if (!despachoId) {
            dashboardContainer.innerHTML = '<div class="col-12 text-center text-warning">No hay despacho asociado.</div>';
            return;
        }

        // 1. Obtener estado licencia
        const licenseCheck = await Service.checkLicense(despachoId);

        // 2. Obtener datos del despacho
        const { data: despachoData, error: despachoError } = await Service.fetchDespachoDetails(despachoId);

        if (despachoError) console.error("Error fetching despacho", despachoError);

        // Actualizar inputs del form despacho
        const nameInput = document.getElementById('despacho-name') as HTMLInputElement;
        const idDisplay = document.getElementById('despacho-id-display') as HTMLInputElement;
        if (nameInput && despachoData) nameInput.value = despachoData.nombre;
        if (idDisplay) idDisplay.value = despachoId;

        // Render Dashboard Cards
        const statusColor = licenseCheck.status === 'ACTIVO' ? 'success' : (licenseCheck.status === 'PRUEBA' ? 'info' : 'danger');
        const daysLeft = licenseCheck.daysLeft ?? 0;

        dashboardContainer.innerHTML = `
            <div class="col-md-3">
                <div class="card bg-${statusColor} bg-opacity-10 border-${statusColor} h-100">
                    <div class="card-body text-center">
                        <h6 class="text-${statusColor} mb-2 fw-bold text-uppercase">Estado</h6>
                        <span class="badge bg-${statusColor} fs-6">${licenseCheck.status}</span>
                        <div class="small text-muted mt-2">Plan: ${licenseCheck.plan || 'N/A'}</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-light border-0 h-100">
                    <div class="card-body text-center">
                        <h6 class="text-muted mb-2">Días Restantes</h6>
                        <span class="fs-4 fw-bold text-dark">${daysLeft >= 0 ? daysLeft : 0}</span>
                        <small class="d-block text-muted">días</small>
                    </div>
                </div>
            </div>
             <div class="col-md-6">
                <div class="card bg-light border-0 h-100">
                    <div class="card-body">
                         <h6 class="text-muted mb-2">Tu Despacho</h6>
                         <p class="mb-1 text-truncate fw-bold">${despachoData?.nombre || 'Sin nombre'}</p>
                         <p class="mb-0 small text-muted text-break">ID: ${despachoId}</p>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error("Error render license dashboard", error);
        dashboardContainer.innerHTML = `<div class="col-12 text-center text-danger">Error cargando información: ${(error as any).message}</div>`;
    }
}
