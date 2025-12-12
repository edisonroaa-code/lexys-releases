const createInitialState = () => ({
    currentUserProfile: null,
    currentExpedienteId: null,
    currentClienteId: null,
    expedientes: [],
    allExpedientes: [],
    clientes: [],
    allClientes: [],
    tiposJuicio: [],
    allJuicios: [],
    allEtapas: [],
    allAreas: [],
    allFueros: [],
    juiciosOrganizados: {},
    eventos: [],
    allPlazos: [],
    currentDate: new Date(),
    nuevoExpedienteModal: null,
    nuevoClienteModal: null,
    nuevoJuicioModal: null,
    editarExpedienteModal: null,
    editarEtapasModal: null,
    nuevoEventoModal: null,
    confirmDeleteModalInstance: null,
    nuevoPlazoModal: null,
    editarPlazoModal: null,
    eventExpedienteChoices: null,
    currentPage: 0,
    PAGE_SIZE: 10,
    confirmDeleteCallback: null,
    plazosCurrentPage: 0,
    PLAZOS_PAGE_SIZE: 10,
    juiciosCurrentPage: 0,
    JUICIOS_PAGE_SIZE: 10,
});

const UI_STATE_KEYS = new Set([
    'nuevoExpedienteModal',
    'nuevoClienteModal',
    'nuevoJuicioModal',
    'editarExpedienteModal',
    'editarEtapasModal',
    'nuevoEventoModal',
    'confirmDeleteModalInstance',
    'nuevoPlazoModal',
    'editarPlazoModal',
    'eventExpedienteChoices',
]);

const ensureGlobalState = () => {
    if (!window.__LEXSYS_STATE__) {
        window.__LEXSYS_STATE__ = createInitialState();
    }
    return window.__LEXSYS_STATE__;
};

export const state = ensureGlobalState();

export function setState(partialState) {
    Object.assign(state, partialState);
}

export function resetState(options = {}) {
    const { preserveUi = false } = options;
    const fresh = createInitialState();
    Object.keys(fresh).forEach((key) => {
        if (preserveUi && UI_STATE_KEYS.has(key)) {
            return;
        }
        state[key] = fresh[key];
    });
}

const bridgeKeys = Object.keys(createInitialState());

bridgeKeys.forEach((key) => {
    if (Object.getOwnPropertyDescriptor(window, key)) return;
    Object.defineProperty(window, key, {
        get() {
            return state[key];
        },
        set(value) {
            state[key] = value;
        },
        configurable: true,
    });
});
