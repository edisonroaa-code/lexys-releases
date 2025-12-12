// Se importan las funciones de otros módulos.

import { getStatusBadge, handleError, getPlazoDuration } from './utils.js';
import { supabase } from './main.js';
import { fetchExpedienteDocumentos, fetchAndRenderTareas, fetchAndRenderActuaciones, fetchAndRenderTimeline, fetchClientes, fetchMembers, fetchAdminJuicios, fetchAndRenderPlazos } from './data.js';
import { state } from './state.js';


export function renderExpedientes(dataToRender, page = 0) {

    const tableBody = document.getElementById('expedientes-table-body');

    if (!tableBody) return;

    

    const from = page * state.PAGE_SIZE;

    const to = from + state.PAGE_SIZE;

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



export function updatePagination(currentPage, totalCount) {

    const prevPageItem = document.getElementById('prev-page-item');

    const nextPageItem = document.getElementById('next-page-item');

    const totalPages = Math.ceil(totalCount / state.PAGE_SIZE);



    if (prevPageItem) prevPageItem.classList.toggle('disabled', currentPage === 0);

    if (nextPageItem) nextPageItem.classList.toggle('disabled', currentPage >= totalPages - 1);

}



export function renderClientes(filteredData = state.allClientes) {

    const container = document.getElementById('clientes-folder-container');

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



export function renderDocumentos(files) {

    const listContainer = document.getElementById('documentos-list');

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



export function renderExpedienteDocumentos(files, expedienteId) {

    const listContainer = document.getElementById('expediente-documentos-list');

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



export function renderMembers(members) {

    const tableBody = document.getElementById('members-table-body');

    tableBody.innerHTML = '';

    members.forEach(member => {

        const tr = document.createElement('tr');

        tr.innerHTML = `

            <td>${member.nombre_completo}</td>

            <td>${member.email}</td>

            <td>

                <select class="form-select form-select-sm" data-member-id="${member.id}" ${member.id === state.currentUserProfile.id ? 'disabled' : ''}>

                    <option value="abogado" ${member.rol === 'abogado' ? 'selected' : ''}>Abogado</option>

                    <option value="admin" ${member.rol === 'admin' ? 'selected' : ''}>Admin</option>

                </select>

            </td>

            <td><button class="btn btn-sm btn-primary btn-save-role" data-member-id="${member.id}" ${member.id === state.currentUserProfile.id ? 'disabled' : ''}>Guardar</button></td>

        `;

        tableBody.appendChild(tr);

    });

}



export function renderAdminJuicios(dataToRender, page = 0) {

    const tableBody = document.getElementById('juicios-table-body');

    const from = page * state.JUICIOS_PAGE_SIZE;

    const to = from + state.JUICIOS_PAGE_SIZE;

    const paginatedData = dataToRender.slice(from, to);



    tableBody.innerHTML = '';



    if (!paginatedData || paginatedData.length === 0) {

        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-5 text-muted">No se encontraron tipos de juicio.</td></tr>`;

        return;

    }



    paginatedData.forEach(juicio => {
        const tr = document.createElement('tr');
        const areaLabel = juicio.areas?.nombre || juicio.area || 'Sin área';
        const fueroLabel = juicio.fueros?.nombre || 'Sin fuero';
        const procesoLabel = juicio.tipo_proceso || 'Sin Proceso';
        tr.innerHTML = `
            <td>${juicio.nombre}</td>
            <td>${areaLabel}</td>
            <td>${fueroLabel}</td>
            <td>${procesoLabel}</td>
            <td><button class="btn btn-sm btn-warning btn-edit-etapas" data-juicio-id="${juicio.id}" data-juicio-nombre="${juicio.nombre}">Editar Etapas</button></td>
        `;
        tableBody.appendChild(tr);
    });


    updateJuiciosPagination(page, dataToRender.length);

}



export function updateJuiciosPagination(currentPage, totalCount) {

    const prevPageItem = document.getElementById('juicios-prev-page-item');

    const nextPageItem = document.getElementById('juicios-next-page-item');

    const totalPages = Math.ceil(totalCount / state.JUICIOS_PAGE_SIZE);



    if (prevPageItem) prevPageItem.classList.toggle('disabled', currentPage === 0);

    if (nextPageItem) nextPageItem.classList.toggle('disabled', currentPage >= totalPages - 1);

}



export function applyJuiciosFilters(page = 0) {
    const searchTerm = document.getElementById('search-juicio').value.toLowerCase();
    
    const filteredData = state.allJuicios.filter(j => 
        j.nombre.toLowerCase().includes(searchTerm) ||
        ((j.areas?.nombre || j.area || '').toLowerCase().includes(searchTerm)) ||
        ((j.fueros?.nombre || '').toLowerCase().includes(searchTerm)) ||
        ((j.tipo_proceso || '').toLowerCase().includes(searchTerm))
    );
    
    renderAdminJuicios(filteredData, page);
}


export function renderActuaciones(actuaciones) {

    const listContainer = document.getElementById('actuaciones-list');

     if(actuaciones.length === 0) {

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



export function renderTimeline(etapas, expediente) {

    const timelineContainer = document.getElementById('expediente-timeline');

     if(etapas.length === 0) {

         timelineContainer.innerHTML = `<p class="text-muted">No hay etapas definidas.</p>`;

         return;

    }

    const etapaActualIndex = etapas.findIndex(e => e.id === expediente.etapa_actual_id);



    timelineContainer.innerHTML = etapas.map((etapa, index) => {

        const isCompleted = (expediente.etapas_completadas || []).includes(etapa.id) || index < etapaActualIndex;

        const isCurrent = etapa.id === expediente.etapa_actual_id;

        const statusClass = isCurrent ? 'current' : (isCompleted ? 'completed' : 'upcoming');

        const icon = isCurrent ? 'ph-arrow-circle-right' : (isCompleted ? 'ph-check-circle' : 'ph-circle');

        

        return `

            <div class="timeline-stage ${statusClass}" data-etapa-id="${etapa.id}">

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



    monthYearEl.textContent = state.currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });



    const today = new Date();

    const month = state.currentDate.getMonth();

    const year = state.currentDate.getFullYear();

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



        const dayEvents = state.eventos.filter(event => {

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



export function renderPlazos(plazos) {
    const tableBody = document.getElementById('plazos-table-body');
    if (plazos.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-3">No se encontraron resultados.</td></tr>`;
        return;
    }
    tableBody.innerHTML = plazos.map(p => {
        const durationLabel = getPlazoDuration(p);
        const fueroLabel = p.fuero || 'Sin fuero';
        const articuloLabel = p.articulo || 'N/A';
        return `
            <tr>
                <td>
                    <div class="fw-semibold">${p.accion_procedimiento}</div>
                    <small class="text-muted">${p.tipo_proceso || 'Sin proceso'}</small>
                </td>
                <td><span class="badge bg-secondary">${fueroLabel}</span></td>
                <td>${durationLabel}</td>
                <td>${articuloLabel}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-secondary btn-edit-plazo" data-plazo-id="${p.id}"><i class="ph ph-pencil-simple"></i></button>
                        <button class="btn btn-sm btn-outline-danger btn-delete-plazo" data-plazo-id="${p.id}"><i class="ph ph-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}


export function updatePlazosPagination(currentPage, totalCount) {

    const prevPageItem = document.getElementById('plazos-prev-page-item');

    const nextPageItem = document.getElementById('plazos-next-page-item');

    const totalPages = Math.ceil(totalCount / state.PLAZOS_PAGE_SIZE);



    if (prevPageItem) prevPageItem.classList.toggle('disabled', currentPage === 0);

    if (nextPageItem) nextPageItem.classList.toggle('disabled', currentPage >= totalPages - 1);

}



export function populatePlazosFilters() {
    const fueroSelect = document.getElementById('plazos-filter-fuero');
    const fueros = [...new Set(state.allPlazos.map(p => p.fuero).filter(Boolean))];
    fueroSelect.innerHTML = '<option value="">Todos los fueros</option>';
    fueros.forEach(fuero => {
        fueroSelect.innerHTML += `<option value="${fuero}">${fuero}</option>`;
    });
}


export function applyPlazosFilters(page = 0) {

    const searchTerm = document.getElementById('plazos-search-input').value.toLowerCase();

    const selectedFuero = document.getElementById('plazos-filter-fuero').value;



    const filteredData = state.allPlazos.filter(p => {

        const matchesSearch = p.accion_procedimiento.toLowerCase().includes(searchTerm) || (p.articulo && p.articulo.toLowerCase().includes(searchTerm));

        const matchesFuero = !selectedFuero || p.fuero === selectedFuero;

        return matchesSearch && matchesFuero;

    });



    const start = page * state.PLAZOS_PAGE_SIZE;

    const end = start + state.PLAZOS_PAGE_SIZE;

    const paginatedResult = filteredData.slice(start, end);



    renderPlazos(paginatedResult);

    updatePlazosPagination(page, filteredData.length);

}



export function renderNotifications(notifications) {

    const notificationItems = document.getElementById('notification-items');

    const notificationCount = document.getElementById('notification-count');

    

    if (!notificationItems || !notificationCount) return;



    if (notifications.length === 0) {

        notificationItems.innerHTML = '<p class="text-muted small text-center p-2">No hay notificaciones</p>';

        notificationCount.textContent = '0';

        notificationCount.classList.add('d-none');

        return;

    }

    

    notificationCount.textContent = notifications.length;

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

    

    document.querySelectorAll('.notification-item').forEach(item => {

        item.addEventListener('click', () => {

            const notificationId = item.dataset.notificationId;

            markNotificationAsRead(notificationId);

        });

    });

}



export async function renderExpedienteResumen(expedienteId) {

    try {

        const expediente = state.allExpedientes.find(e => e.id === expedienteId);

        if (!expediente) return;



        const [tareasRes, actuacionesRes, eventosRes] = await Promise.all([

            supabase.from('tareas').select('*', { count: 'exact' }).eq('expediente_id', expedienteId),

            supabase.from('actuaciones').select('fecha').eq('expediente_id', expedienteId).order('fecha', { ascending: false }).limit(1),

            supabase.from('eventos').select('fecha_evento').eq('expediente_id', expedienteId).order('fecha_evento', { ascending: true }).limit(1)

        ]);

        

        if (tareasRes.error) throw tareasRes.error;

        if (actuacionesRes.error) throw actuacionesRes.error;

        if (eventosRes.error) throw eventosRes.error;

        

        const tareas = tareasRes.data || [];

        const ultimaActuacion = actuacionesRes.data[0];

        const proximoEvento = eventosRes.data[0];

        

        document.getElementById('resumen-nro').textContent = expediente.nro_expediente || 'N/A';

        document.getElementById('resumen-caratula').textContent = expediente.caratula || 'N/A';

        document.getElementById('resumen-contraparte').textContent = expediente.contraparte || 'N/A';

        document.getElementById('resumen-estado').textContent = getStatusBadge(expediente.estado).text;

        document.getElementById('resumen-tareas-completadas').textContent = tareas.filter(t => t.completada).length;

        document.getElementById('resumen-tareas-totales').textContent = tareas.length;

        document.getElementById('resumen-ultima-actuacion').textContent = ultimaActuacion ? new Date(ultimaActuacion.fecha + 'T00:00:00').toLocaleDateString() : 'Ninguna';

        document.getElementById('resumen-proximo-vencimiento').textContent = proximoEvento ? new Date(proximoEvento.fecha_evento + 'T00:00:00').toLocaleDateString() : 'Ninguno';

    } catch (error) {

        handleError(error, 'renderExpedienteResumen');

    }

}



export async function renderEtapasEnModal(juicioId) {

    const listContainer = document.getElementById('etapas-list');

    try {

        listContainer.innerHTML = `<div class="loader mx-auto"></div>`;



        const [etapasRes, plazosRes] = await Promise.all([
            supabase.from('etapas_proceso').select('*').eq('tipo_juicio_id', juicioId).order('orden'),
            supabase.from('plazos_procesales').select('id, accion_procedimiento, duracion_numero, unidad, tipo_duracion')
        ]);


        if (etapasRes.error) throw etapasRes.error;

        if (plazosRes.error) throw plazosRes.error;



        const etapas = etapasRes.data;

        const plazos = plazosRes.data;



        const plazosOptions = `<option value="">Ningún plazo vinculado</option>` + plazos.map(p => 
            `<option value="${p.id}">${p.accion_procedimiento} (${getPlazoDuration(p)})</option>`
        ).join('');


        if (etapas.length === 0) {

            listContainer.innerHTML = `<p class="text-muted">No hay etapas definidas para este tipo de juicio.</p>`;

            return;

        }



        listContainer.innerHTML = etapas.map(etapa => `

            <div class="d-flex align-items-center gap-2 mb-2 p-2 border rounded etapa-item" data-id="${etapa.id}">

                <i class="ph ph-dots-six-vertical" style="cursor: move;"></i>

                <input type="text" class="form-control form-control-sm etapa-nombre-input" value="${etapa.nombre}" placeholder="Nombre de la etapa">

                <select class="form-select form-select-sm etapa-plazo-select" data-plazo-id="${etapa.plazo_id || ''}">

                    ${plazosOptions}

                </select>

                <button class="btn btn-sm btn-danger btn-delete-etapa" data-id="${etapa.id}">&times;</button>

            </div>

        `).join('');



        listContainer.querySelectorAll('.etapa-plazo-select').forEach(select => {

            select.value = select.dataset.plazoId;

        });

    } catch (error) {

        handleError(error, 'renderEtapasEnModal');

        if(listContainer) listContainer.innerHTML = `<p class="text-danger">Error al cargar datos.</p>`;

    }

}



export function populateEtapaFilter() {

    const etapaFilter = document.getElementById('filter-etapa');

    if (!etapaFilter) return;

    

    const etapasUnicas = [...new Set(state.allExpedientes.map(exp => exp.etapas_proceso?.nombre).filter(Boolean))];

    

    etapaFilter.innerHTML = '<option value="">Todas las etapas</option>';

    etapasUnicas.forEach(etapa => {

        etapaFilter.innerHTML += `<option value="${etapa}">${etapa}</option>`;

    });

}



export function populatePlazoFormSelects(fueroSelector, tipoProcesoSelector) {
    const fueroSelect = document.querySelector(fueroSelector);
    const tipoProcesoSelect = document.querySelector(tipoProcesoSelector);

    const fueros = [...new Set(state.allPlazos.map(p => p.fuero))].filter(Boolean);
    const tiposProceso = [...new Set(state.allPlazos.map(p => p.tipo_proceso))].filter(Boolean);

    fueroSelect.innerHTML = '<option value="">Seleccione un fuero...</option>' + fueros.map(f => `<option value="${f}">${f}</option>`).join('');
    tipoProcesoSelect.innerHTML = '<option value="">Seleccione un tipo...</option>' + tiposProceso.map(tp => `<option value="${tp}">${tp}</option>`).join('');
}

export function renderAreasList() {
    const list = document.getElementById('areas-list');
    if (!list) return;

    if (!state.allAreas.length) {
        list.innerHTML = '<li class="list-group-item text-muted small">No hay áreas registradas.</li>';
        return;
    }

    list.innerHTML = state.allAreas
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

    if (!state.allFueros.length) {
        list.innerHTML = '<li class="list-group-item text-muted small">No hay fueros registrados.</li>';
        return;
    }

    list.innerHTML = state.allFueros
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
        const options = (state.allAreas || []).map(area => `<option value="${area.id}">${area.nombre}</option>`).join('');
        areaSelect.innerHTML = '<option value="">Seleccione un área...</option>' + options;
    }

    const fueroSelect = document.getElementById('juicio-fuero');
    if (fueroSelect) {
        const options = (state.allFueros || []).map(fuero => `<option value="${fuero.id}">${fuero.nombre}</option>`).join('');
        fueroSelect.innerHTML = '<option value="">Seleccione un fuero...</option>' + options;
    }
}




