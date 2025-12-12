import { createClient } from '@supabase/supabase-js';

const authSection = document.getElementById('auth-section') as HTMLElement;
const dataSection = document.getElementById('data-section') as HTMLElement;
const userInfo = document.getElementById('user-info') as HTMLElement;
const tableContainer = document.getElementById('licencias-table') as HTMLElement;
const planesContainer = document.getElementById('planes-container') as HTMLElement;
const loginError = document.getElementById('login-error') as HTMLElement;

const envUrl = import.meta.env.VITE_SUPABASE_URL as string;
const envKey = import.meta.env.VITE_SUPABASE_KEY as string;

if (!envUrl || !envKey) {
  throw new Error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_KEY');
}

// Cliente admin (service role) para queries/updates sin RLS
const supabaseAdmin = createClient(envUrl, envKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: `Bearer ${envKey}` } }
});

// Cliente de auth solo para validar login (no se usa para datos)
const supabaseAuth = createClient(envUrl, envKey);

const searchInput = document.getElementById('search-input') as HTMLInputElement;
const filterEstado = document.getElementById('filter-estado') as HTMLSelectElement;
const filterPlan = document.getElementById('filter-plan') as HTMLSelectElement;
const filterExpira = document.getElementById('filter-expira') as HTMLInputElement;
const statusMsg = document.getElementById('status-msg') as HTMLElement;

let licenciasCache: any[] = [];
let planesCache: any[] = [];

// Interface for Plans
interface Plan {
  id: string;
  nombre: string;
  precio_mensual: number;
  precio_anual: number;
  activo: boolean;
}

function showToast(msg: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${msg}</span> <button aria-label="Cerrar">×</button>`;
  document.body.appendChild(el);
  el.querySelector('button')?.addEventListener('click', () => el.remove());
  setTimeout(() => el.remove(), 4000);
}

// --- Planes Logic ---

async function fetchPlanes() {
  planesContainer.innerHTML = '<p class="muted">Cargando planes...</p>';
  const { data, error } = await supabaseAdmin
    .from('planes')
    .select('*')
    .eq('activo', true)
    .order('precio_mensual', { ascending: true });

  if (error) {
    // If table doesn't exist, this will fail. We handle it gracefully.
    console.warn("Error fetching planes. User might not have run migration.", error);
    planesContainer.innerHTML = `<p class="error small">Error cargando planes. ¿Ejecutaste el script SQL?<br>${error.message}</p>`;
    return;
  }

  planesCache = data || [];
  renderPlanes();
  // Update filters and metrics with new plan data
  updatePlanFilterOptions();
  renderMetrics(); // Re-render metrics as they depend on planes
  renderTable(licenciasCache); // Re-render table to update dropdowns
}

function renderPlanes() {
  if (!planesCache.length) {
    planesContainer.innerHTML = `<p class="muted small col-span-full">No hay planes configurados. Crea uno.</p>`;
    return;
  }

  planesContainer.innerHTML = planesCache.map(plan => `
    <div class="summary-card" style="position: relative;">
      <h3 style="font-size: 1.4rem; margin-bottom: 4px;">${plan.nombre}</h3>
      <div class="muted small mb-2">Mensual: ${new Intl.NumberFormat('es-PY').format(plan.precio_mensual)} Gs</div>
      <div class="muted small">Anual: ${new Intl.NumberFormat('es-PY').format(plan.precio_anual)} Gs</div>
      <button class="btn-ghost danger btn-sm" style="position: absolute; top: 10px; right: 10px;" onclick="window.deletePlan('${plan.id}')">×</button>
    </div>
  `).join('');
}

async function createPlan() {
  const nombre = prompt("Nombre del Plan (ej. Pro):");
  if (!nombre) return;
  const pmStr = prompt("Precio Mensual (Gs):", "0");
  const paStr = prompt("Precio Anual (Gs):", "0");

  const precio_mensual = parseInt(pmStr || '0');
  const precio_anual = parseInt(paStr || '0');

  const { error } = await supabaseAdmin.from('planes').insert({
    nombre,
    precio_mensual,
    precio_anual
  });

  if (error) {
    showToast(`Error al crear plan: ${error.message}`, 'error');
  } else {
    showToast(`Plan ${nombre} creado`);
    fetchPlanes();
  }
}

// Expose deletePlan globally for the inline onclick (simpler than event delegation for now)
(window as any).deletePlan = async (id: string) => {
  if (!confirm('¿Eliminar este plan?')) return;
  const { error } = await supabaseAdmin.from('planes').update({ activo: false }).eq('id', id);
  if (error) {
    showToast("Error al eliminar plan", 'error');
  } else {
    fetchPlanes();
  }
};

function updatePlanFilterOptions() {
  // Add dynamic plans to filter
  const currentVal = filterPlan.value;
  const defaultOpts = '<option value="">Todos los planes</option><option value="TRIAL">TRIAL</option>';
  const dynamicOpts = planesCache.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('');

  // Keep manually added plans or legacy ones if needed
  filterPlan.innerHTML = defaultOpts + dynamicOpts;
  filterPlan.value = currentVal;
}

// --- Licencias Logic ---

async function fetchLicencias() {
  // Ensure planes are loaded first
  if (planesCache.length === 0) await fetchPlanes();

  const { data, error } = await supabaseAdmin
    .from('licencias')
    .select('id, estado, plan, fecha_inicio, fecha_expiracion, dias_prueba, notas, despacho_id, updated_at, precio_pactado, ciclo_facturacion, despachos ( nombre )')
    .order('updated_at', { ascending: false });

  if (error) {
    tableContainer.innerHTML = `<p class="error">Error cargando licencias: ${error.message}</p>`;
    return;
  }

  // Fetch admin emails separately
  const { data: profiles } = await supabaseAdmin
    .from('perfiles')
    .select('despacho_id, email')
    .eq('rol', 'admin');

  // Map emails to licenses by despacho_id
  const licensesWithEmail = (data || []).map(lic => {
    const adminProfile = profiles?.find(p => p.despacho_id === lic.despacho_id);
    return { ...lic, admin_email: adminProfile?.email || 'Sin contacto' };
  });

  licenciasCache = licensesWithEmail;
  renderTable(licenciasCache);
  applyFilters();
  renderMetrics();
}

async function createLicense() {
  const nombre = prompt("Nombre del nuevo Despacho:");
  if (!nombre) return;

  // 1. Crear Despacho
  const { data: despacho, error: dError } = await supabaseAdmin
    .from('despachos')
    .insert({ nombre })
    .select()
    .single();

  if (dError) {
    showToast(`Error al crear despacho: ${dError.message}`, 'error');
    return;
  }

  // 2. Crear Licencia
  const { error: lError } = await supabaseAdmin
    .from('licencias')
    .insert({
      despacho_id: despacho.id,
      estado: 'ACTIVO',
      plan: 'TRIAL', // Default to TRIAL
      dias_prueba: 60,
      fecha_inicio: new Date().toISOString(),
      fecha_expiracion: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    });

  if (lError) {
    showToast(`Despacho creado pero error en licencia: ${lError.message}`, 'error');
  } else {
    showToast(`Licencia creada para ${nombre}`);
    fetchLicencias();
  }
}

function renderTable(rows: any[]) {
  if (!rows.length) {
    tableContainer.innerHTML = `<p class="muted">Sin licencias</p>`;
    return;
  }

  // Build options for Plan Select (Dynamic + Static)
  const planOptions = (currentPlan: string) => {
    const staticPlans = ['TRIAL'];
    // Merge static and dynamic, unique
    const allPlanNames = Array.from(new Set([...staticPlans, ...planesCache.map(p => p.nombre)]));
    // If current plan is not in list (legacy), add it
    if (currentPlan && !allPlanNames.includes(currentPlan)) allPlanNames.push(currentPlan);

    return allPlanNames.map(opt => `<option value="${opt}" ${opt === currentPlan ? 'selected' : ''}>${opt}</option>`).join('');
  };

  tableContainer.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Despacho / Admin</th>
          <th>Estado</th>
          <th>Plan & Precio</th>
          <th>Inicio</th>
          <th>Expira</th>
          <th>Notas</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${rows
      .map((r) => {
        const expira = r.fecha_expiracion ? new Date(r.fecha_expiracion).toLocaleDateString() : '—';
        const inicio = r.fecha_inicio ? new Date(r.fecha_inicio).toLocaleDateString() : '—';
        const expiraValue = r.fecha_expiracion
          ? new Date(r.fecha_expiracion).toISOString().split('T')[0]
          : '';

        // Find Plan Price or use Pactado
        const planObj = planesCache.find(p => p.nombre === r.plan);
        const precioBase = r.ciclo_facturacion === 'ANUAL' ? (planObj?.precio_anual || 0) : (planObj?.precio_mensual || 0);
        const precioFinal = r.precio_pactado !== null && r.precio_pactado !== undefined ? r.precio_pactado : precioBase;

        const precioDisplay = r.plan === 'TRIAL' ? 'Gratis' : `${new Intl.NumberFormat('es-PY').format(precioFinal)} Gs`;

        return `
              <tr data-id="${r.id}">
                <td>
                  <div class="fw-bold">${r.despachos?.nombre || '—'}</div>
                  <div class="small muted">${r.admin_email || 'Sin contacto'}</div>
                  <div class="pill tiny">${r.despacho_id}</div>
                </td>
                <td>
                  <select class="inline-input estado-select">
                    ${['ACTIVO', 'PRUEBA', 'SUSPENDIDO', 'EXPIRADO']
            .map((opt) => `<option value="${opt}" ${opt === r.estado ? 'selected' : ''}>${opt}</option>`)
            .join('')}
                  </select>
                </td>
                <td>
                  <div class="d-flex flex-column gap-1">
                    <select class="inline-input plan-select">
                      ${planOptions(r.plan)}
                    </select>
                    <div class="d-flex gap-1 align-items-center">
                        <input type="number" class="inline-input precio-pactado-input" 
                               value="${r.precio_pactado || ''}" 
                               placeholder="${precioBase > 0 ? precioBase : 'Precio'}" 
                               style="width: 80px; font-size: 0.8rem;" 
                               title="Precio Pactado (Sobrescribe plan)" />
                        <select class="inline-input ciclo-select" style="width: 70px; font-size: 0.8rem;">
                            <option value="MENSUAL" ${r.ciclo_facturacion === 'MENSUAL' ? 'selected' : ''}>Mes</option>
                            <option value="ANUAL" ${r.ciclo_facturacion === 'ANUAL' ? 'selected' : ''}>Año</option>
                        </select>
                    </div>
                  </div>
                </td>
                <td>${inicio}</td>
                <td>
                  <input type="date" class="inline-input expira-input" value="${expiraValue}" />
                  <div class="muted small">${expira}</div>
                </td>
                <td>
                  <textarea class="inline-input notas-input" rows="2" placeholder="Notas...">${r.notas || ''}</textarea>
                </td>
                <td>
                  <div class="actions">
                    <button type="button" class="btn-secondary save-btn">Guardar</button>
                    <button type="button" class="btn-ghost extend-btn" title="+30 días">+30d</button>
                    ${r.estado !== 'SUSPENDIDO' ? '<button type="button" class="btn-ghost suspend-btn" title="Suspender">Susp</button>' : ''}
                    <button type="button" class="btn-ghost danger delete-btn" title="Eliminar">X</button>
                  </div>
                </td>
              </tr>
            `;
      })
      .join('')}
      </tbody>
    </table>
  `;
}

// ... Filtros logic (same as before but calls renderMetrics)
document.getElementById('create-license-btn')?.addEventListener('click', createLicense);
document.getElementById('create-plan-btn')?.addEventListener('click', createPlan);

function applyFilters() {
  const term = (searchInput?.value || '').toLowerCase();
  const est = filterEstado?.value || '';
  const plan = filterPlan?.value || '';
  const onlyExpira = filterExpira?.checked;

  const filtered = licenciasCache.filter((l) => {
    const matchesSearch =
      !term ||
      (l.despachos?.nombre || '').toLowerCase().includes(term) ||
      (l.despacho_id || '').toLowerCase().includes(term);
    const matchesEstado = !est || l.estado === est;
    const matchesPlan = !plan || l.plan === plan;

    let matchesExpira = true;
    if (onlyExpira) {
      const dias = daysToExpire(l.fecha_expiracion);
      matchesExpira = dias !== null && dias <= 7 && dias >= -30;
    }

    return matchesSearch && matchesEstado && matchesPlan && matchesExpira;
  });

  if (statusMsg) statusMsg.textContent = `Mostrando ${filtered.length} de ${licenciasCache.length} licencias`;
  renderTable(filtered);
}

function daysToExpire(fecha: string | null): number | null {
  if (!fecha) return null;
  const exp = new Date(fecha);
  const now = new Date();
  const diff = exp.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

async function handleLogin(e: Event) {
  e.preventDefault();
  loginError.textContent = '';
  const email = (document.getElementById('email') as HTMLInputElement).value;
  const password = (document.getElementById('password') as HTMLInputElement).value;

  try {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error) throw error;
    userInfo.textContent = data.user?.email || '';
    authSection.classList.add('d-none');
    dataSection.classList.remove('d-none');
    fetchLicencias();
  } catch (err: any) {
    loginError.textContent = err.message || 'Error al iniciar sesion';
  }
}

document.getElementById('login-form')?.addEventListener('submit', handleLogin);
document.getElementById('refresh-btn')?.addEventListener('click', fetchLicencias);
searchInput?.addEventListener('input', applyFilters);
filterEstado?.addEventListener('change', applyFilters);
filterPlan?.addEventListener('change', applyFilters);
filterExpira?.addEventListener('change', applyFilters);

async function updateLicencia(rowEl: HTMLElement, extendDays = 0) {
  const id = rowEl.dataset.id;
  if (!id) return;
  const estado = (rowEl.querySelector('.estado-select') as HTMLSelectElement).value;
  const plan = (rowEl.querySelector('.plan-select') as HTMLSelectElement).value;
  const expiraInput = rowEl.querySelector('.expira-input') as HTMLInputElement;
  const notas = (rowEl.querySelector('.notas-input') as HTMLTextAreaElement).value;

  // New economy fields
  const precioPactadoVal = (rowEl.querySelector('.precio-pactado-input') as HTMLInputElement).value;
  const precio_pactado = precioPactadoVal ? parseInt(precioPactadoVal) : null;
  const ciclo_facturacion = (rowEl.querySelector('.ciclo-select') as HTMLSelectElement).value;

  let fecha_expiracion = expiraInput.value ? new Date(expiraInput.value) : null;
  if (extendDays > 0) {
    const baseDate = fecha_expiracion ? new Date(fecha_expiracion) : new Date();
    baseDate.setDate(baseDate.getDate() + extendDays);
    fecha_expiracion = baseDate;
  }

  const { error } = await supabaseAdmin
    .from('licencias')
    .update({
      estado,
      plan,
      fecha_expiracion: fecha_expiracion ? fecha_expiracion.toISOString() : null,
      notas,
      precio_pactado,
      ciclo_facturacion
    })
    .eq('id', id);

  if (error) {
    showToast(`Error al guardar: ${error.message} `, 'error');
    return;
  }
  showToast('Licencia actualizada');
  fetchLicencias();
}

tableContainer.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const row = target.closest('tr') as HTMLElement | null;
  if (!row) return; // Actions below need a row

  if (target.classList.contains('save-btn')) {
    updateLicencia(row);
  }
  if (target.classList.contains('extend-btn')) {
    updateLicencia(row, 30);
  }
  if (target.classList.contains('suspend-btn')) {
    updateLicencia(row); // Update called via logic usually sets state, but here simpler: just update
    // Wait, suspend needs to change state to SUSPENDIDO.
    // Let's reimplement quickUpdate just for suspend inside this handler or separate
    // For now, let's just make suspend button set dropdown to SUSPENDIDO and save?
    // User wants quick actions.
    quickSuspend(row);
  }
  if (target.classList.contains('delete-btn')) {
    if (confirm('¿Eliminar esta licencia? Esto no borra el despacho ni datos asociados.')) {
      deleteLicencia(row);
    }
  }
});

async function quickSuspend(rowEl: HTMLElement) {
  const id = rowEl.dataset.id;
  await supabaseAdmin.from('licencias').update({ estado: 'SUSPENDIDO' }).eq('id', id);
  fetchLicencias();
}

async function deleteLicencia(rowEl: HTMLElement) {
  const id = rowEl.dataset.id;
  if (!id) return;
  const { error } = await supabaseAdmin.from('licencias').delete().eq('id', id);
  if (error) {
    showToast(`Error al eliminar: ${error.message} `, 'error');
    return;
  }
  showToast('Licencia eliminada');
  fetchLicencias();
}

function renderMetrics() {
  const activos = licenciasCache.filter((l) => l.estado === 'ACTIVO');

  let mrr = 0;
  let arr = 0;

  activos.forEach(lic => {
    // Find plan price
    const planObj = planesCache.find(p => p.nombre === lic.plan);
    const isAnual = lic.ciclo_facturacion === 'ANUAL';

    let precio = 0;

    if (lic.precio_pactado !== null && lic.precio_pactado !== undefined) {
      precio = lic.precio_pactado;
    } else {
      precio = isAnual ? (planObj?.precio_anual || 0) : (planObj?.precio_mensual || 0);
    }

    if (lic.plan === 'TRIAL') precio = 0;

    if (isAnual) {
      // Add to proper metrics
      mrr += Math.round(precio / 12);
      arr += precio;
    } else {
      mrr += precio;
      arr += precio * 12;
    }
  });

  (document.getElementById('stat-activos') as HTMLElement).textContent = `${activos.length} `;
  (document.getElementById('stat-detalle-activos') as HTMLElement).textContent = `${planesCache.length} Planes configurados`;
  (document.getElementById('stat-mensual') as HTMLElement).textContent = `${new Intl.NumberFormat('es-PY').format(mrr)} Gs.`;
  (document.getElementById('stat-anual') as HTMLElement).textContent = `${new Intl.NumberFormat('es-PY').format(arr)} Gs.`;
}
