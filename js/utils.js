import { state } from './state.js';

// --- UTILITY FUNCTIONS ---
export function getStatusBadge(estado) {
    const statusMap = {
        'en_curso': { text: 'En Curso', class: 'bg-primary' },
        'completado': { text: 'Completado', class: 'bg-success' },

        'vencido': { text: 'Vencido', class: 'bg-danger' },

        'pendiente': { text: 'Pendiente', class: 'bg-secondary' }

    };

    return statusMap[estado] || { text: 'Desconocido', class: 'bg-dark' };

}



export function generateCaratula() {
    const clienteSelect = document.getElementById('exp-cliente');

    const contraparteInput = document.getElementById('exp-contraparte');

    const tipoJuicioSelect = document.getElementById('exp-tipo-juicio');

    const caratulaTextarea = document.getElementById('exp-caratula');



    const clienteNombre = clienteSelect.options[clienteSelect.selectedIndex]?.text || '';

    const contraparteNombre = contraparteInput.value.trim();

    const tipoJuicioNombre = tipoJuicioSelect.options[tipoJuicioSelect.selectedIndex]?.text || '';



    if (clienteNombre && contraparteNombre && tipoJuicioNombre && tipoJuicioNombre !== 'Seleccione...') {

        caratulaTextarea.value = `${clienteNombre} C/ ${contraparteNombre} S/ ${tipoJuicioNombre}`;

    }

}



export function showToast(message, type = 'success') {

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

    const toast = new bootstrap.Toast(toastElement, { delay: 5000 });

    

    toastElement.addEventListener('hidden.bs.toast', () => {

        toastElement.remove();

    });



    toast.show();

}



export function showConfirmDeleteModal(title, body, onConfirm) {
    document.getElementById('confirm-delete-title').textContent = title;
    document.getElementById('confirm-delete-body').textContent = body;
    state.confirmDeleteCallback = onConfirm;
    state.confirmDeleteModalInstance.show();
}

export function getPlazoDuration(plazo) {
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

    return 'Sin duración';
}


export function formatMonto(input) {

    let value = input.value.replace(/\D/g, '');

    if (value === '') {

        input.value = '';

        return;

    }

    const numberValue = parseInt(value, 10);

    input.value = new Intl.NumberFormat('es-PY').format(numberValue);

}



export function formatCuentaCorriente(input) {

    let value = input.value.replace(/\D/g, '').substring(0, 11);

    let formattedValue = '';

    

    if (value.length > 0) formattedValue = value.substring(0, 2);

    if (value.length > 2) formattedValue += '.' + value.substring(2, 4);

    if (value.length > 4) formattedValue += '.' + value.substring(4, 7);

    if (value.length > 7) formattedValue += '.' + value.substring(7, 10);

    if (value.length > 10) formattedValue += '/' + value.substring(10, 11);

    

    input.value = formattedValue;

}



export function calcularFechaVencimiento(fechaInicio, duracionTexto, tipo = 'habiles') {

    const numero = parseInt(duracionTexto.match(/\d+/)[0] || "0");

    let fechaFin = new Date(fechaInicio);



    if (duracionTexto.includes('meses')) {

        fechaFin.setMonth(fechaFin.getMonth() + numero);

    } else if (duracionTexto.includes('horas')) {

        fechaFin.setHours(fechaFin.getHours() + numero);

    } else if (duracionTexto.includes('días')) {

        if (tipo === 'habiles') {

            let diasAgregados = 0;

            while (diasAgregados < numero) {

                fechaFin.setDate(fechaFin.getDate() + 1);

                const diaDeLaSemana = fechaFin.getDay();

                if (diaDeLaSemana !== 0 && diaDeLaSemana !== 6) {

                    diasAgregados++;

                }

            }

        } else {

            fechaFin.setDate(fechaFin.getDate() + numero);

        }

    }

    return fechaFin;

}



export function handleError(error, context) {

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

        switch(error.code) {

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




