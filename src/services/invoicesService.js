import * as invoicesRepository from '../repositories/invoicesRepository.js';
import * as patientsRepository from '../repositories/patientsRepository.js';
import { httpError } from '../utils/httpError.js';

const ESTADOS_VALIDOS = ['pendiente', 'pagada'];
const TIPOS_IVA_VALIDOS = ['exento', '21'];

function calcularImporteIva(importeCentimos, tipoIva) {
    if (tipoIva === '21') {
        const ivaCentimos = Math.round(importeCentimos * 0.21);
        return { ivaCentimos, totalCentimos: importeCentimos + ivaCentimos };
    }
    return { ivaCentimos: 0, totalCentimos: importeCentimos };
}

async function validateInvoiceInput(data) {
    if (!data.patient_id) {
        throw httpError(400, 'Debes seleccionar un paciente');
    }

    const patient = await patientsRepository.findById(data.patient_id);
    if (!patient) {
        throw httpError(400, 'El paciente seleccionado no existe');
    }

    if (!data.fecha || Number.isNaN(new Date(data.fecha).getTime())) {
        throw httpError(400, 'La fecha no es válida');
    }

    if (!data.concepto || !data.concepto.trim()) {
        throw httpError(400, 'El concepto es obligatorio');
    }

    const importeCentimos = Number(data.importe_centimos);
    if (!Number.isInteger(importeCentimos) || importeCentimos <= 0) {
        throw httpError(400, 'El importe debe ser un número entero de céntimos mayor que 0');
    }

    const tipoIva = data.tipo_iva || 'exento';
    if (!TIPOS_IVA_VALIDOS.includes(tipoIva)) {
        throw httpError(400, 'El tipo de IVA no es válido');
    }

    const estado = data.estado || 'pagada';
    if (!ESTADOS_VALIDOS.includes(estado)) {
        throw httpError(400, 'El estado debe ser "pendiente" o "pagada"');
    }

    return { patient, importeCentimos, tipoIva, estado };
}

export async function listInvoices(filters) {
    return invoicesRepository.findAll(filters);
}

export async function createInvoice(data) {
    const { importeCentimos, tipoIva, estado } = await validateInvoiceInput(data);
    const { ivaCentimos, totalCentimos } = calcularImporteIva(importeCentimos, tipoIva);

    return invoicesRepository.create({
        fecha: data.fecha,
        patient_id: data.patient_id,
        concepto: data.concepto.trim(),
        importe_centimos: importeCentimos,
        tipo_iva: tipoIva,
        iva_centimos: ivaCentimos,
        total_centimos: totalCentimos,
        estado,
        metodo_pago: data.metodo_pago ? data.metodo_pago.trim() : null,
        observaciones: data.observaciones ? data.observaciones.trim() : null
    });
}

export async function updateInvoiceStatus(id, estado) {
    if (!ESTADOS_VALIDOS.includes(estado)) {
        throw httpError(400, 'El estado debe ser "pendiente" o "pagada"');
    }

    const invoice = await invoicesRepository.updateStatus(id, estado);
    if (!invoice) {
        throw httpError(404, 'Factura no encontrada');
    }
    return invoice;
}

<<<<<<< HEAD
=======
const ANIO_MINIMO = 2000;
const ANIO_MAXIMO = 2100;

const NOMBRES_MES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Crea la factura mensual de un paciente agrupando sus sesiones 'completed'
 * no facturadas de ese año/mes. Valida entrada, delega el cálculo de
 * importes y la comprobación de duplicados a la base de datos (dentro de
 * una transacción en el repository), y traduce el resultado a errores
 * HTTP claros.
 */
export async function createMonthlyInvoice(data) {
    if (!data.patientId) {
        throw httpError(400, 'Debes indicar un paciente');
    }

    const patient = await patientsRepository.findById(data.patientId);
    if (!patient) {
        throw httpError(400, 'El paciente indicado no existe');
    }

    const year = Number(data.year);
    const month = Number(data.month);

    if (!data.year || !Number.isInteger(year) || year < ANIO_MINIMO || year > ANIO_MAXIMO) {
        throw httpError(400, `El año debe ser un número entero entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}`);
    }
    if (!data.month || !Number.isInteger(month) || month < 1 || month > 12) {
        throw httpError(400, 'El mes debe ser un número entero entre 1 y 12');
    }

    const yaExiste = await invoicesRepository.findByPatientAndBillingPeriod(patient.id, year, month);
    if (yaExiste) {
        throw httpError(409, `Ya existe una factura mensual para ${patient.nombre} ${patient.apellidos} en ${NOMBRES_MES[month - 1]} de ${year} (${yaExiste.numero_factura})`);
    }

    const concepto = `Sesiones de psicología sanitaria — ${NOMBRES_MES[month - 1]} de ${year}`;

    const invoice = await invoicesRepository.createMonthlyInvoice({
        patientId: patient.id,
        year,
        month,
        concepto
    });

    if (!invoice) {
        throw httpError(400, `No hay sesiones realizadas y sin facturar de ${patient.nombre} ${patient.apellidos} en ${NOMBRES_MES[month - 1]} de ${year}`);
    }

    return invoice;
}

>>>>>>> 3d2b9cc (v. calendario bdd)

