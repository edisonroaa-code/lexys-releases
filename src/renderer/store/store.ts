import { Profile, Expediente, Cliente, TipoJuicio, EtapaProceso, Area, Fuero, Evento, PlazoProcesal } from '../types';

export interface AppState {
    currentUserProfile: Profile | null;
    currentExpedienteId: string | null;
    currentClienteId: string | null;

    expedientes: Expediente[];
    allExpedientes: Expediente[];

    clientes: Cliente[];
    allClientes: Cliente[];

    tiposJuicio: TipoJuicio[];
    allJuicios: TipoJuicio[];
    juiciosOrganizados: Record<string, Record<string, TipoJuicio[]>>;

    allEtapas: EtapaProceso[];
    allAreas: Area[];
    allFueros: Fuero[];

    eventos: Evento[];
    allPlazos: PlazoProcesal[];
    feriados: Date[];

    currentDate: Date;

    // UI State (Modals & Pagination)
    nuevoExpedienteModal: any;
    nuevoClienteModal: any;
    nuevoJuicioModal: any;
    editarExpedienteModal: any;
    editarEtapasModal: any;
    nuevoEventoModal: any;
    confirmDeleteModalInstance: any;
    nuevoPlazoModal: any;
    editarPlazoModal: any;

    eventExpedienteChoices: any;

    currentPage: number;
    PAGE_SIZE: number;

    confirmDeleteCallback: (() => void) | null;
    confirmDeleteResolve: ((value: boolean) => void) | null;

    plazosCurrentPage: number;
    PLAZOS_PAGE_SIZE: number;

    juiciosCurrentPage: number;
    JUICIOS_PAGE_SIZE: number;
}

const createInitialState = (): AppState => ({
    currentUserProfile: null,
    currentExpedienteId: null,
    currentClienteId: null,
    expedientes: [],
    allExpedientes: [],
    clientes: [],
    allClientes: [],
    tiposJuicio: [],
    allJuicios: [],
    juiciosOrganizados: {},
    allEtapas: [],
    allAreas: [],
    allFueros: [],
    eventos: [],
    allPlazos: [],
    feriados: [],
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
    confirmDeleteResolve: null,

    plazosCurrentPage: 0,
    PLAZOS_PAGE_SIZE: 10,

    juiciosCurrentPage: 0,
    JUICIOS_PAGE_SIZE: 10,
});

class Store {
    public state: AppState;

    constructor() {
        this.state = createInitialState();
    }

    setState(partialState: Partial<AppState>) {
        Object.assign(this.state, partialState);
    }

    resetState(options: { preserveUi?: boolean } = {}) {
        const { preserveUi = false } = options;
        const fresh = createInitialState();

        if (preserveUi) {
            // Keep UI state keys
            const uiKeys = [
                'nuevoExpedienteModal', 'nuevoClienteModal', 'nuevoJuicioModal',
                'editarExpedienteModal', 'editarEtapasModal', 'nuevoEventoModal',
                'confirmDeleteModalInstance', 'nuevoPlazoModal', 'editarPlazoModal',
                'eventExpedienteChoices'
            ];

            Object.keys(fresh).forEach((key) => {
                if (!uiKeys.includes(key)) {
                    // @ts-ignore
                    this.state[key] = fresh[key as keyof AppState];
                }
            });
        } else {
            this.state = fresh;
        }
    }
}

export const store = new Store();
export const state = store.state; // For backward compatibility if needed, but prefer accessing store.state
