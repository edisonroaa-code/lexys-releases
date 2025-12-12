import { differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';

export type CausaTerminacion =
    | 'despido_injustificado'
    | 'despido_justificado'
    | 'retiro_justificado'
    | 'renuncia_voluntaria'
    | 'mutuo_acuerdo'
    | 'abandono_trabajo'
    | 'fallecimiento' // Art. 79 - 50% indemnización para herederos
    | 'cumplimiento_plazo'; // Fin natural del contrato a plazo fijo

export type TipoContrato = 'indefinido' | 'plazo_fijo';

export interface ConceptosLiquidacion {
    preaviso: boolean;
    indemnizacion: boolean;
    vacaciones: boolean;
    aguinaldo: boolean;
    articulos: string;
}

export interface ResultadoLiquidacion {
    salarioDiarioBase: number;
    salarioMensualPromedio: number;
    preaviso?: number;
    indemnizacion?: number;
    indemnizacionDoble?: boolean;
    cierreEmpresa?: boolean;
    estabilidadCercana?: boolean;
    estabilidadMaternal?: boolean;
    vacaciones?: number;
    vacacionesDobles?: boolean;
    aguinaldo?: number;
    pendientes: number;
    extras?: {
        diurnas: number;
        nocturnas: number;
        feriados: number;
        nocturnasRegulares: number;
        total: number;
    };
    bonificacionFamiliar?: {
        monto: number;
        hijosAplicados: number;
    };
    ips?: {
        base: number;
        trabajador: number;
        empleador: number;
    };
    total: number;
    totalBruto: number;
    totalNeto: number;
    articulos: string;
    periodoPrueba?: boolean;
    antiguedadReal?: { anios: number, meses: number, dias: number };

    // NUEVOS CAMPOS de resultado
    salarioDiasTrabajados?: number; // Salario proporcional de días trabajados en el mes
    aguinaldoPendienteAnterior?: number; // Aguinaldo del año anterior no pagado
    descuentoFaltaPreaviso?: number; // Descuento por no dar preaviso (50% Art. 90)
    anticipos?: number; // Préstamos/anticipos descontados
    tipoTrabajador?: 'mensualero' | 'jornalero';
    ipsReclamoRetroactivo?: number; // Reclamo retroactivo si nunca tuvo IPS (16.5% × meses)

    // CAMPOS PARA PLAZO FIJO Y FALLECIMIENTO
    tipoContrato?: TipoContrato;
    indemnizacionPlazoFijo?: number; // Art. 229 - Salarios restantes hasta fin de contrato
    diasRestantesContrato?: number; // Días hasta fecha fin del contrato
    tacitaReconduccion?: boolean; // Si el plazo fijo se convirtió en indefinido
    esFallecimiento?: boolean; // Flag para herederos

    // ALERTAS DE ILEGALIDAD
    alertaIlegalidad?: {
        tipo: 'embarazo' | 'estabilidad_10_anios' | 'sindical';
        mensaje: string;
    };
}

export function calcularSalarioDiarioBase(salarios6Meses: number[]): number {
    const validos = salarios6Meses.filter(s => s > 0);
    if (validos.length === 0) return 0;
    const promedio = validos.reduce((a, b) => a + b, 0) / validos.length;
    return promedio / 30;
}

export function calcularSalarioMensualPromedio(sdb: number): number {
    return sdb * 30;
}

export function obtenerConceptos(causa: CausaTerminacion): ConceptosLiquidacion {
    switch (causa) {
        case 'despido_injustificado':
            return { preaviso: true, indemnizacion: true, vacaciones: true, aguinaldo: true, articulos: 'Arts. 87, 91, 224, 244' };
        case 'despido_justificado':
            return { preaviso: false, indemnizacion: false, vacaciones: true, aguinaldo: true, articulos: 'Arts. 81, 224, 244 (Sin indemnización)' };
        case 'retiro_justificado':
            return { preaviso: true, indemnizacion: true, vacaciones: true, aguinaldo: true, articulos: 'Arts. 84, 224, 244 (Equivale a despido injustificado)' };
        case 'renuncia_voluntaria':
            return { preaviso: false, indemnizacion: false, vacaciones: true, aguinaldo: true, articulos: 'Arts. 224, 244' };
        case 'mutuo_acuerdo':
            return { preaviso: false, indemnizacion: false, vacaciones: true, aguinaldo: true, articulos: 'Art. 78, 224, 244' };
        case 'abandono_trabajo':
            return { preaviso: false, indemnizacion: false, vacaciones: true, aguinaldo: true, articulos: 'Arts. 81, 224, 244' };
        case 'fallecimiento':
            // Art. 79: Herederos reciben 50% de indemnización, sin preaviso
            return { preaviso: false, indemnizacion: true, vacaciones: true, aguinaldo: true, articulos: 'Art. 79, 224, 244 (50% Indemnización para herederos)' };
        case 'cumplimiento_plazo':
            // Fin natural del contrato a plazo fijo
            return { preaviso: false, indemnizacion: false, vacaciones: true, aguinaldo: true, articulos: 'Arts. 224, 244 (Fin de contrato a plazo)' };
        default:
            return { preaviso: false, indemnizacion: false, vacaciones: true, aguinaldo: true, articulos: '' };
    }
}

export function calcularPreaviso(sdb: number, antiguedadAnios: number): number {
    let dias = 0;
    if (antiguedadAnios < 1) dias = 30;
    else if (antiguedadAnios <= 5) dias = 45;
    else if (antiguedadAnios <= 10) dias = 60;
    else dias = 90;
    return sdb * dias;
}

export function calcularIndemnizacionAntiguedad(sdb: number, anios: number, meses: number): number {
    // 15 salarios diarios por cada año de servicio o fracción superior a 6 meses
    let periodos = anios;
    if (meses >= 6) periodos += 1;
    return sdb * 15 * periodos;
}

export function calcularVacacionesProporcionales(input: {
    sdb: number;
    antiguedadAnios: number;
    diasTrabajadosDesdeAniversario: number; // o dias del año si es < 1 año
    esDespidoInjustificado: boolean;
    vacacionesCausadasNoGozadas: boolean;
}): { monto: number, aplicaDoble: boolean } {
    let diasCorrespondientes = 0;
    if (input.antiguedadAnios < 5) diasCorrespondientes = 12;
    else if (input.antiguedadAnios <= 10) diasCorrespondientes = 18;
    else diasCorrespondientes = 30;

    // Proporcional: (diasTrabajados / 360) * diasCorrespondientes * sdb
    const montoProporcional = (input.diasTrabajadosDesdeAniversario / 360) * diasCorrespondientes * input.sdb;

    // Si hay vacaciones causadas (del periodo anterior completo) que no se gozaron y hubo despido injustificado, se pagan doble?
    const aplicaDoble = input.esDespidoInjustificado && input.vacacionesCausadasNoGozadas;

    return { monto: montoProporcional, aplicaDoble };
}

export function calcularAguinaldo(remuneraciones: number[]): number {
    const total = remuneraciones.reduce((a, b) => a + b, 0);
    return total / 12;
}

export function calcularAntiguedad(fechaIngreso: string, fechaSalida: string) {
    const ingreso = new Date(fechaIngreso);
    const salida = new Date(fechaSalida);

    const anios = differenceInYears(salida, ingreso);
    const meses = differenceInMonths(salida, ingreso) % 12;
    const dias = differenceInDays(salida, ingreso); // Total días para periodo prueba

    // Días desde último aniversario para vacaciones prop.
    const ultimoAniversario = new Date(ingreso);
    ultimoAniversario.setFullYear(salida.getFullYear());
    if (ultimoAniversario > salida) {
        ultimoAniversario.setFullYear(salida.getFullYear() - 1);
    }
    const diasDesdeAniversario = differenceInDays(salida, ultimoAniversario);

    return { anios, meses, diasTotal: dias, diasDesdeAniversario };
}

export function calcularLiquidacion(input: {
    salarios6Meses: number[];
    remuneracionesAnuales: number[];
    fechaIngreso?: string;
    fechaSalida?: string;
    // Fallback manual inputs if dates not provided
    antiguedadAnios?: number;
    antiguedadMeses?: number;
    diasTrabajadosDesdeAniversario?: number;

    causa: CausaTerminacion;
    vacacionesCausadasNoGozadas: boolean;
    salarioBaseMensual: number;
    salarioMinimo: number;
    horasExtraDiurnas: number;
    horasExtraNocturnas: number;
    horasFeriado: number;
    horasNocturnasRegulares: number;
    hijos: number;
    cierreEmpresa: boolean;
    cercaEstabilidad: boolean;
    estabilidadMaternal: boolean;
    pendientes: number;
    vacacionesPrevias: number;
    regimenDomestico: boolean;

    // NUEVOS CAMPOS para calculadora completa
    tieneIPS: boolean; // Si no tiene, no se descuenta 9%
    aguinaldoAnioAnteriorPendiente: number; // Monto de aguinaldo del año pasado no pagado
    diasSinCobrarMes: number; // Días trabajados en el último mes sin cobrar
    tipoTrabajador: 'mensualero' | 'jornalero'; // Afecta cálculo de salario diario
    trabajadorDioPreaviso: boolean; // Si es renuncia y no dio preaviso, se descuenta 50%
    anticipos: number; // Préstamos/anticipos a descontar

    // PLAZO FIJO (Art. 229)
    tipoContrato: TipoContrato; // 'indefinido' | 'plazo_fijo'
    fechaFinContrato?: string; // Obligatorio si tipoContrato == 'plazo_fijo'

    // VACACIONES
    aplicarPenalidadVacaciones: boolean; // Si true, pago doble (200%). Default: false (pago simple)

    datosTrabajador?: {
        nombre?: string;
        cargo?: string;
        empresa?: string;
    };
}): ResultadoLiquidacion {
    // 1. Calculate Seniority
    let antiguedadAnios = input.antiguedadAnios || 0;
    let antiguedadMeses = input.antiguedadMeses || 0;
    let diasDesdeAniversario = input.diasTrabajadosDesdeAniversario || 0;
    let diasTotal = 0;

    if (input.fechaIngreso && input.fechaSalida) {
        const anti = calcularAntiguedad(input.fechaIngreso, input.fechaSalida);
        antiguedadAnios = anti.anios;
        antiguedadMeses = anti.meses;
        diasDesdeAniversario = anti.diasDesdeAniversario;
        diasTotal = anti.diasTotal;
    }

    // NUEVO: Calcular salario más favorable para indemnización (Art. 92)
    // Usar el mayor entre: último salario fijo vs promedio 6 meses
    const sdbPromedio = calcularSalarioDiarioBase(input.salarios6Meses);
    const sdbUltimo = input.salarioBaseMensual / 30;
    const sdb = Math.max(sdbPromedio, sdbUltimo); // El más favorable al trabajador

    const smp = calcularSalarioMensualPromedio(sdb);

    // NUEVO: Detectar tácita reconducción (Plazo Fijo que se convirtió en Indefinido)
    let tipoContratoEfectivo = input.tipoContrato || 'indefinido';
    let tacitaReconduccion = false;

    if (tipoContratoEfectivo === 'plazo_fijo' && input.fechaFinContrato && input.fechaSalida) {
        const fechaFin = new Date(input.fechaFinContrato);
        const fechaSalida = new Date(input.fechaSalida);
        if (fechaSalida > fechaFin) {
            // Siguió trabajando después del fin → se convirtió en indefinido
            tipoContratoEfectivo = 'indefinido';
            tacitaReconduccion = true;
        }
    }

    const conceptos = obtenerConceptos(input.causa);

    // 2. Probation Period Check (Art 58: Periodo prueba max 60 dias)
    const enPeriodoPrueba = diasTotal <= 60 && diasTotal > 0;

    let total = 0;
    const res: ResultadoLiquidacion = {
        salarioDiarioBase: sdb,
        salarioMensualPromedio: smp,
        articulos: conceptos.articulos,
        total,
        totalBruto: 0,
        totalNeto: 0,
        periodoPrueba: enPeriodoPrueba,
        antiguedadReal: { anios: antiguedadAnios, meses: antiguedadMeses, dias: diasTotal },
        pendientes: 0,
        tipoContrato: tipoContratoEfectivo,
        tacitaReconduccion
    };

    // NUEVO: Alertas de ilegalidad
    if (input.estabilidadMaternal && input.causa === 'despido_injustificado') {
        res.alertaIlegalidad = {
            tipo: 'embarazo',
            mensaje: '⚠️ DESPIDO NULO: La trabajadora embarazada tiene derecho a REINTEGRO. Este cálculo es solo si acepta la indemnización.'
        };
    }
    if (antiguedadAnios >= 10 && input.causa === 'despido_injustificado') {
        res.alertaIlegalidad = {
            tipo: 'estabilidad_10_anios',
            mensaje: '⚠️ ESTABILIDAD ESPECIAL: Trabajador con 10+ años tiene derecho a REINTEGRO. Este cálculo es solo si acepta la indemnización.'
        };
    }

    // 3. Preaviso (NO aplica en plazo fijo ni fallecimiento)
    if (conceptos.preaviso && !enPeriodoPrueba && tipoContratoEfectivo === 'indefinido') {
        res.preaviso = calcularPreaviso(sdb, antiguedadAnios);
        total += res.preaviso;
    }

    // 4. Indemnización - LÓGICA DIFERENCIADA
    if (conceptos.indemnizacion && !enPeriodoPrueba) {

        // CASO ESPECIAL: Fallecimiento (Art. 79) → 50% de indemnización
        if (input.causa === 'fallecimiento') {
            const indemnizacionCompleta = calcularIndemnizacionAntiguedad(sdb, antiguedadAnios, antiguedadMeses);
            res.indemnizacion = indemnizacionCompleta * 0.5;
            res.esFallecimiento = true;
            total += res.indemnizacion;
        }
        // CASO ESPECIAL: Plazo Fijo + Despido Injustificado → Art. 229 (salarios restantes)
        else if (tipoContratoEfectivo === 'plazo_fijo' && input.causa === 'despido_injustificado' && input.fechaFinContrato && input.fechaSalida) {
            const fechaFin = new Date(input.fechaFinContrato);
            const fechaSalida = new Date(input.fechaSalida);
            const diasRestantes = differenceInDays(fechaFin, fechaSalida);

            if (diasRestantes > 0) {
                res.diasRestantesContrato = diasRestantes;
                res.indemnizacionPlazoFijo = diasRestantes * sdb;
                res.articulos = 'Art. 229, 224, 244 (Indemnización por ruptura anticipada de plazo fijo)';
                total += res.indemnizacionPlazoFijo;
            }
        }
        // CASO NORMAL: Contrato Indefinido
        else if (tipoContratoEfectivo === 'indefinido') {
            let baseInd = calcularIndemnizacionAntiguedad(sdb, antiguedadAnios, antiguedadMeses);

            // Estabilidad 10 años
            let esEstable = antiguedadAnios >= 10;

            // Doble indemnización cases
            let aplicaDoble = false;
            if (esEstable && input.causa === 'despido_injustificado') aplicaDoble = true;
            if (input.estabilidadMaternal && input.causa === 'despido_injustificado') {
                aplicaDoble = true;
                res.estabilidadMaternal = true;
            }

            if (aplicaDoble) {
                baseInd = baseInd * 2;
                res.indemnizacionDoble = true;
            }

            if (input.cierreEmpresa) {
                baseInd = baseInd * 2;
                res.cierreEmpresa = true;
            }

            res.estabilidadCercana = input.cercaEstabilidad;
            res.indemnizacion = baseInd;
            total += res.indemnizacion;
        }
    }

    // 5. Vacaciones (Siempre se pagan las causadas no gozadas y las proporcionales)
    if (conceptos.vacaciones) {
        const { monto } = calcularVacacionesProporcionales({
            sdb,
            antiguedadAnios: antiguedadAnios,
            diasTrabajadosDesdeAniversario: diasDesdeAniversario,
            esDespidoInjustificado: input.causa === 'despido_injustificado',
            vacacionesCausadasNoGozadas: input.vacacionesCausadasNoGozadas
        });
        const previas = Math.max(input.vacacionesPrevias, 0);
        const previasMonto = previas * sdb;

        // NUEVO: Penalidad de vacaciones es OPCIONAL (default: pago simple)
        // Solo aplica doble si el usuario lo marca explícitamente
        const aplicarDoble = input.aplicarPenalidadVacaciones === true;
        res.vacaciones = (aplicarDoble ? monto * 2 : monto) + previasMonto;
        res.vacacionesDobles = aplicarDoble;
        total += res.vacaciones;
    }

    // 6. Aguinaldo (Siempre se paga proporcional)
    if (conceptos.aguinaldo) {
        res.aguinaldo = calcularAguinaldo(input.remuneracionesAnuales);
        total += res.aguinaldo;
    }

    // 7. NUEVO: Aguinaldo del año anterior pendiente (si no le pagaron)
    const aguinaldoPendienteAnterior = Math.max(input.aguinaldoAnioAnteriorPendiente || 0, 0);
    if (aguinaldoPendienteAnterior > 0) {
        res.aguinaldoPendienteAnterior = aguinaldoPendienteAnterior;
        total += aguinaldoPendienteAnterior;
    }

    // 8. NUEVO: Salario de días trabajados en el último mes sin cobrar
    const diasSinCobrar = Math.max(input.diasSinCobrarMes || 0, 0);
    if (diasSinCobrar > 0) {
        // Para jornalero: salario / 26, para mensualero: salario / 30
        const divisor = input.tipoTrabajador === 'jornalero' ? 26 : 30;
        const salarioDiarioReal = input.salarioBaseMensual / divisor;
        res.salarioDiasTrabajados = salarioDiarioReal * diasSinCobrar;
        res.tipoTrabajador = input.tipoTrabajador;
        total += res.salarioDiasTrabajados;
    }

    // Salarios/comisiones pendientes (adicionales)
    const pendientes = Math.max(input.pendientes, 0);
    res.pendientes = pendientes;
    total += pendientes;

    // Horas extras y recargos
    const horaBase = input.salarioBaseMensual > 0 ? (input.salarioBaseMensual / 30) / 8 : 0;
    const extraDiurna = horaBase * 1.5 * input.horasExtraDiurnas;
    const extraNocturna = horaBase * 2 * input.horasExtraNocturnas; // 100% sobre hora
    const feriado = horaBase * 3 * input.horasFeriado; // +200% => 3x
    const nocturnasReg = horaBase * 1.3 * input.horasNocturnasRegulares; // recargo 30%
    const totalExtras = extraDiurna + extraNocturna + feriado + nocturnasReg;
    res.extras = { diurnas: extraDiurna, nocturnas: extraNocturna, feriados: feriado, nocturnasRegulares: nocturnasReg, total: totalExtras };
    total += totalExtras;

    // Bonificación familiar (5% SM por hijo, máx. 5, tope 2 SM)
    const hijosAplicados = Math.min(Math.max(input.hijos, 0), 5);
    const bonifTope = input.salarioBaseMensual <= input.salarioMinimo * 2;
    const bonificacion = bonifTope ? hijosAplicados * (input.salarioMinimo * 0.05) : 0;
    res.bonificacionFamiliar = { monto: bonificacion, hijosAplicados };
    total += bonificacion;

    // ===== DEDUCCIONES =====
    let totalDeducciones = 0;

    // 9. NUEVO: Descuento por falta de preaviso del trabajador (Art. 90)
    // Si es renuncia voluntaria y NO dio preaviso, se descuenta 50%
    if (input.causa === 'renuncia_voluntaria' && !input.trabajadorDioPreaviso) {
        const preavisoQueDebia = calcularPreaviso(sdb, antiguedadAnios);
        const descuentoPreaviso = preavisoQueDebia * 0.5;
        res.descuentoFaltaPreaviso = descuentoPreaviso;
        totalDeducciones += descuentoPreaviso;
    }

    // 10. NUEVO: Anticipos/Préstamos
    const anticipos = Math.max(input.anticipos || 0, 0);
    if (anticipos > 0) {
        res.anticipos = anticipos;
        totalDeducciones += anticipos;
    }

    // 11. Aportes IPS
    // Régimen doméstico: 2.5% trabajador, 5.5% empleador
    // IMPORTANTE: Si nunca tuvo IPS (no fue inscrito), puede reclamar retroactivamente
    // el 16.5% del empleador por toda la antigüedad (Art. 74 Ley 98/92)
    const baseIps = Math.max(input.salarioBaseMensual + totalExtras, 0);

    if (input.tieneIPS === true) {
        // Tiene IPS activo - descuento normal del 9%
        const tasaTrab = input.regimenDomestico ? 0.025 : 0.09;
        const tasaEmpl = input.regimenDomestico ? 0.055 : 0.165;
        const ipsTrab = baseIps * tasaTrab;
        const ipsEmpl = baseIps * tasaEmpl;
        res.ips = { base: baseIps, trabajador: ipsTrab, empleador: ipsEmpl };
        totalDeducciones += ipsTrab;
    } else {
        // NUNCA tuvo IPS (empleador no lo inscribió)
        // El trabajador puede reclamar retroactivamente el 16.5% del empleador
        // por todos los meses trabajados (calculado sobre salario promedio × meses)
        const tasaEmplRetro = input.regimenDomestico ? 0.055 : 0.165;
        const mesesTrabajados = (antiguedadAnios * 12) + antiguedadMeses;
        const ipsReclamoRetroactivo = input.salarioBaseMensual * tasaEmplRetro * mesesTrabajados;

        res.ips = {
            base: baseIps,
            trabajador: 0, // No se le descuenta porque nunca se le descontó
            empleador: ipsReclamoRetroactivo // Reclamo retroactivo
        };
        res.ipsReclamoRetroactivo = ipsReclamoRetroactivo;
        total += ipsReclamoRetroactivo; // SUMA al total, no resta
    }

    res.total = total;
    res.totalBruto = total;
    res.totalNeto = total - totalDeducciones;
    return res;
}
