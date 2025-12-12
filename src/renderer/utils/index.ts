import { store } from '../store/store';
// We need to import bootstrap types or declare them if we want strict typing, 
// but for now we'll assume bootstrap is available globally or imported in main.
declare const bootstrap: any;

export function getStatusBadge(estado: string) {
    const statusMap: Record<string, { text: string; class: string }> = {
        'en_curso': { text: 'En Curso', class: 'bg-primary' },
        'completado': { text: 'Completado', class: 'bg-success' },
        'vencido': { text: 'Vencido', class: 'bg-danger' },
        'pendiente': { text: 'Pendiente', class: 'bg-secondary' },
        'archivado': { text: 'Archivado', class: 'bg-dark' }
    };

    return statusMap[estado] || { text: 'Desconocido', class: 'bg-dark' };
}

export function generateCaratula() {
    const clienteSelect = document.getElementById('exp-cliente') as HTMLSelectElement;
    const contraparteInput = document.getElementById('exp-contraparte') as HTMLInputElement;
    const tipoJuicioSelect = document.getElementById('exp-tipo-juicio') as HTMLSelectElement;
    const caratulaTextarea = document.getElementById('exp-caratula') as HTMLTextAreaElement;

    if (!clienteSelect || !contraparteInput || !tipoJuicioSelect || !caratulaTextarea) return;

    const clienteNombre = clienteSelect.options[clienteSelect.selectedIndex]?.text || '';
    const contraparteNombre = contraparteInput.value.trim();
    const tipoJuicioNombre = tipoJuicioSelect.options[tipoJuicioSelect.selectedIndex]?.text || '';

    if (clienteNombre && contraparteNombre && tipoJuicioNombre && tipoJuicioNombre !== 'Seleccione...') {
        caratulaTextarea.value = `${clienteNombre} C/ ${contraparteNombre} S/ ${tipoJuicioNombre}`;
    }
}

export function showToast(message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'success') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return;

    const toastColors = {
        success: 'bg-success text-white',
        danger: 'bg-danger text-white',
        warning: 'bg-warning text-dark',
        info: 'bg-info text-dark'
    };

    const toastIcons = {
        success: '<i class="ph-check-circle me-2"></i>',
        danger: '<i class="ph-x-circle me-2"></i>',
        warning: '<i class="ph-warning-circle me-2"></i>',
        info: '<i class="ph-info me-2"></i>'
    };

    const toastId = 'toast-' + Date.now();
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center ${toastColors[type] || 'bg-secondary text-white'}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body d-flex align-items-center">
                    ${toastIcons[type] || ''}
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);

    const toastElement = document.getElementById(toastId);
    if (toastElement) {
        const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
        toast.show();
    }
}

export function showConfirmDeleteModal(title: string, body: string, onConfirm?: () => void): Promise<boolean> {
    const titleEl = document.getElementById('confirm-delete-title');
    const bodyEl = document.getElementById('confirm-delete-body');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = body;

    return new Promise((resolve) => {
        store.state.confirmDeleteCallback = onConfirm || null;
        store.state.confirmDeleteResolve = resolve;

        const modalEl = document.getElementById('confirm-delete-modal');
        const onHide = () => {
            if (store.state.confirmDeleteResolve) {
                store.state.confirmDeleteResolve(false);
                store.state.confirmDeleteResolve = null;
            }
            modalEl?.removeEventListener('hidden.bs.modal', onHide);
        };
        modalEl?.addEventListener('hidden.bs.modal', onHide);

        store.state.confirmDeleteModalInstance.show();
    });
}

export function getPlazoDuration(plazo: any) {
    const explicitValue = (plazo?.duracion_plazo || '').trim();
    if (explicitValue) return explicitValue;

    const hasNumber = plazo?.duracion_numero !== undefined && plazo?.duracion_numero !== null;
    const unidad = (plazo?.unidad || '').trim();
    const tipo = (plazo?.tipo_duracion || '').trim();

    if (hasNumber && unidad) {
        return `${plazo.duracion_numero} ${unidad}${tipo ? ` (${tipo})` : ''}`;
    }

    if (hasNumber) {
        return `${plazo.duracion_numero} ${tipo ? `(${tipo})` : ''}`.trim();
    }

    return 'Sin duracion';
}

export function formatMonto(input: HTMLInputElement) {
    let value = input.value.replace(/\D/g, '');
    if (value === '') {
        input.value = '';
        return;
    }
    const numberValue = parseInt(value, 10);
    input.value = new Intl.NumberFormat('es-PY').format(numberValue);
}

export function formatCuentaCorriente(input: HTMLInputElement) {
    let value = input.value.replace(/\D/g, '').substring(0, 11);
    let formattedValue = '';

    if (value.length > 0) formattedValue = value.substring(0, 2);
    if (value.length > 2) formattedValue += '.' + value.substring(2, 4);
    if (value.length > 4) formattedValue += '.' + value.substring(4, 7);
    if (value.length > 7) formattedValue += '.' + value.substring(7, 10);
    if (value.length > 10) formattedValue += '/' + value.substring(10, 11);

    input.value = formattedValue;
}

export function calcularFechaVencimiento(
    fechaInicio: Date,
    duracionTexto: string,
    tipo: string = 'habiles',
    feriados: Date[] = []
) {
    const cleanText = (duracionTexto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const numero = parseInt(cleanText.match(/\d+/)?.[0] || "0");
    let fechaFin = new Date(fechaInicio);

    // Helper para verificar si una fecha es feriado
    const esFeriado = (fecha: Date): boolean => {
        return feriados.some(feriado =>
            feriado.getFullYear() === fecha.getFullYear() &&
            feriado.getMonth() === fecha.getMonth() &&
            feriado.getDate() === fecha.getDate()
        );
    };

    if (cleanText.includes('mes')) {
        fechaFin.setMonth(fechaFin.getMonth() + numero);
    } else if (cleanText.includes('hora')) {
        fechaFin.setHours(fechaFin.getHours() + numero);
    } else if (cleanText.includes('dia')) {
        if (tipo === 'habiles') {
            let diasAgregados = 0;
            while (diasAgregados < numero) {
                fechaFin.setDate(fechaFin.getDate() + 1);
                const diaDeLaSemana = fechaFin.getDay();
                // Es dia habil si NO es sabado (6), NO es domingo (0), y NO es feriado
                if (diaDeLaSemana !== 0 && diaDeLaSemana !== 6 && !esFeriado(fechaFin)) {
                    diasAgregados++;
                }
            }
        } else {
            fechaFin.setDate(fechaFin.getDate() + numero);
        }
    }
    return fechaFin;
}

export function handleError(error: any, context: string) {
    console.error(`Error en ${context}:`, error);

    let message = "Ha ocurrido un error inesperado. Por favor, intente nuevamente.";

    if (error.name === 'AuthApiError' || error.__isAuthError || (error.message && error.message.toLowerCase().includes('invalid login credentials'))) {
        if (error.message.toLowerCase().includes('invalid login credentials')) {
            message = "Email o contraseña incorrectos. Por favor, verifique sus credenciales.";
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
            message = "Debe confirmar su correo electrónico antes de iniciar sesión.";
        } else if (error.status === 429) {
            message = "Demasiados intentos. Por favor, intente de nuevo más tarde.";
        }
    }
    else if (error.code) {
        switch (error.code) {
            case 'PGRST116':
                message = "No se encontró el perfil de usuario o los datos asociados después de iniciar sesión.";
                break;
            case '23505':
                message = "Ya existe un registro con estos datos (ej. email ya registrado).";
                break;
            case '42P01':
            case '42S02':
                message = "Error interno: una tabla necesaria para la operación no existe.";
                break;
            case '42703':
                message = `Error interno: una columna requerida no fue encontrada.`;
                break;
            case '21000':
                message = 'No tiene permisos para acceder a este recurso. Verifique las políticas de seguridad.';
                break;
            default:
                message = `Error de base de datos. Contacte a soporte. (Código: ${error.code})`;
                break;
        }
    }
    else if (context === 'setupApp' && error.message && error.message.includes("Perfil no encontrado")) {
        message = "No se pudo cargar su perfil. Su cuenta puede estar incompleta. Saliendo de la sesión.";
    }
    else if (error.message && (error.message.toLowerCase().includes('failed to fetch') || error.message.toLowerCase().includes('network request failed'))) {
        message = "Error de conexión. Verifique su conexión a internet e intente de nuevo.";
    }

    showToast(message, 'danger');
}
