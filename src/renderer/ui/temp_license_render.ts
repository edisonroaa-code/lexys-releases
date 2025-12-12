import { store } from '../store/store';
import * as Service from '../services/supabaseService';

export async function renderLicenseDashboard() {
    const dashboardContainer = document.getElementById('license-dashboard');
    if (!dashboardContainer) return;

    dashboardContainer.innerHTML = '<div class="col-12 text-center py-3 text-muted"><span class="spinner-border spinner-border-sm me-2"></span>Cargando...</div>';

    try {
        const despachoId = store.state.currentUserProfile?.despacho_id;
        if (!despachoId) throw new Error("No hay despacho asociado");

        // 1. Obtener estado licencia
        const licenseCheck = await Service.checkLicense(despachoId); // Usando la función existente

        // 2. Obtener datos del despacho (nombre, etc) - Necesitamos endpoint o select
        // Asumo que ya tenemos algo o hacemos query directo si somos admin
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
        
        let planLabel = 'TRIAL';
        // Si checkLicense no devuelve el plan, tal vez necesitemos extenderla o hacer query manual.
        // Haremos query manual rapida para detalles extra si checkLicense es light.
        
        dashboardContainer.innerHTML = `
            <div class="col-md-3">
                <div class="card bg-${statusColor} bg-opacity-10 border-${statusColor} h-100">
                    <div class="card-body text-center">
                        <h6 class="text-${statusColor} mb-2 fw-bold text-uppercase">Estado</h6>
                        <span class="badge bg-${statusColor} fs-6">${licenseCheck.status}</span>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-light border-0 h-100">
                    <div class="card-body text-center">
                        <h6 class="text-muted mb-2">Días restantes</h6>
                        <span class="fs-4 fw-bold text-dark">${daysLeft}</span>
                        <small class="d-block text-muted">días</small>
                    </div>
                </div>
            </div>
             <div class="col-md-6">
                <div class="card bg-light border-0 h-100">
                    <div class="card-body">
                         <h6 class="text-muted mb-2">Detalles</h6>
                         <p class="mb-1 small"><strong>Despacho:</strong> ${despachoData?.nombre || 'Sin nombre'}</p>
                         <p class="mb-0 small text-muted">Referencia ID: ${despachoId}</p>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error("Error render license dashboard", error);
        dashboardContainer.innerHTML = `<div class="col-12 text-center text-danger">Error cargando información: ${(error as any).message}</div>`;
    }
}
