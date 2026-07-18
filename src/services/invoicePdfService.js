import PDFDocument from 'pdfkit';
import * as invoicesRepository from '../repositories/invoicesRepository.js';
import * as settingsService from './settingsService.js';
import { httpError } from '../utils/httpError.js';

const formateadorEuros = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
});

const formateadorFecha = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC'
});

function euros(centimos) {
    return formateadorEuros.format(centimos / 100);
}

export async function getInvoiceForPdf(id) {
    const idNumerico = Number(id);
    if (!Number.isInteger(idNumerico) || idNumerico <= 0) {
        throw httpError(400, 'El identificador de la factura no es válido');
    }

    const invoice = await invoicesRepository.findByIdForPdf(idNumerico);
    if (!invoice) {
        throw httpError(404, 'Factura no encontrada');
    }

    const settings = await settingsService.getSettings();

    return { invoice, settings };
}

/**
 * Dibuja el contenido completo de UNA factura a partir de la posición
 * actual del documento (no crea el documento ni lo finaliza).
 * Se usa tanto para el PDF individual como para cada factura del PDF trimestral.
 */
export function renderInvoiceContent(doc, invoice, settings) {
    doc.x = doc.page.margins.left;
    const anchoPagina = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ---------- Encabezado ----------
    doc.fontSize(22).font('Helvetica-Bold').text('FACTURA', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica')
        .text(`Número: ${invoice.numero_factura}`)
        .text(`Fecha: ${formateadorFecha.format(new Date(invoice.fecha))}`);
    doc.moveDown(1.2);

    // ---------- Bloque Profesional ----------
    doc.fontSize(13).font('Helvetica-Bold').text('Profesional');
    doc.fontSize(11).font('Helvetica');
    doc.text(`${settings.nombre} ${settings.apellidos}`);
    if (settings.nif) doc.text(`NIF: ${settings.nif}`);
    if (settings.numero_colegiada) doc.text(`Nº colegiada: ${settings.numero_colegiada}`);
    if (settings.direccion) doc.text(settings.direccion);
    if (settings.telefono) doc.text(`Tel: ${settings.telefono}`);
    if (settings.email) doc.text(settings.email);
    doc.moveDown(1);

    // ---------- Bloque Paciente ----------
    doc.fontSize(13).font('Helvetica-Bold').text('Paciente');
    doc.fontSize(11).font('Helvetica');
    doc.text(`${invoice.paciente_nombre} ${invoice.paciente_apellidos}`);
    if (invoice.paciente_dni) doc.text(`DNI: ${invoice.paciente_dni}`);
    if (invoice.paciente_direccion) doc.text(invoice.paciente_direccion);
    if (invoice.paciente_email) doc.text(invoice.paciente_email);
    doc.moveDown(1.2);

    // ---------- Detalle del servicio ----------
    doc.fontSize(13).font('Helvetica-Bold').text('Detalle del servicio');
    doc.moveDown(0.3);

    const yTabla = doc.y;

    doc.fontSize(11).font('Helvetica-Bold');
    doc.text('Concepto', doc.page.margins.left, yTabla, { width: anchoPagina - 100 });
    doc.text('Importe', doc.page.margins.left + anchoPagina - 100, yTabla, { width: 100, align: 'right' });

    doc.moveDown(0.5);
    doc.font('Helvetica');
    const yFila = doc.y;
    doc.text(invoice.concepto, doc.page.margins.left, yFila, { width: anchoPagina - 100 });
    doc.text(euros(invoice.importe_centimos), doc.page.margins.left + anchoPagina - 100, yFila, { width: 100, align: 'right' });

    doc.moveDown(1);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + anchoPagina, doc.y).stroke();
    doc.moveDown(0.8);

    // ---------- Totales ----------
    const escribirLineaTotal = (etiqueta, valor, opciones = {}) => {
        const y = doc.y;
        doc.font(opciones.negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(opciones.tamano || 11);
        doc.text(etiqueta, doc.page.margins.left, y, { width: anchoPagina - 100 });
        doc.text(valor, doc.page.margins.left + anchoPagina - 100, y, { width: 100, align: 'right' });
        doc.moveDown(0.4);
    };

    escribirLineaTotal('Base imponible', euros(invoice.importe_centimos));

    if (invoice.tipo_iva === '21') {
        escribirLineaTotal('IVA (21%)', euros(invoice.iva_centimos));
    } else {
        escribirLineaTotal('IVA', 'Exento de IVA');
    }

    doc.moveDown(0.2);
    escribirLineaTotal('TOTAL', euros(invoice.total_centimos), { negrita: true, tamano: 13 });
    doc.moveDown(1);
    doc.x = doc.page.margins.left;

    // ---------- Estado y método de pago ----------
    doc.fontSize(11).font('Helvetica-Bold').text('Estado: ', { continued: true })
        .font('Helvetica').text(invoice.estado === 'pagada' ? 'Pagada' : 'Pendiente de pago');

    if (invoice.metodo_pago) {
        doc.font('Helvetica-Bold').text('Método de pago: ', { continued: true })
            .font('Helvetica').text(invoice.metodo_pago);
    }
    doc.moveDown(1);

    // ---------- Observaciones ----------
    if (invoice.observaciones) {
        doc.fontSize(13).font('Helvetica-Bold').text('Observaciones');
        doc.fontSize(11).font('Helvetica').text(invoice.observaciones);
        doc.moveDown(1);
    }

    // ---------- Nota fiscal ----------
    doc.moveDown(1);
    doc.fontSize(9).font('Helvetica-Oblique');

    if (invoice.tipo_iva === 'exento') {
        doc.text(
            'Operación exenta de IVA conforme al artículo 20.Uno.3.º de la Ley 37/1992 del Impuesto sobre el Valor Añadido.'
        );
        doc.moveDown(0.3);
    }

    doc.text('Factura emitida conforme a la normativa fiscal española vigente para profesionales autónomos.');
}

/**
 * Construye el documento PDF de una única factura, ya finalizado
 * (doc.end() ejecutado), listo para enviarse como stream.
 */
export function buildInvoicePdfDocument(invoice, settings) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    renderInvoiceContent(doc, invoice, settings);
    doc.end();
    return doc;
}

const ANIO_MINIMO = 2000;
const ANIO_MAXIMO = 2100;
const TRIMESTRES_VALIDOS = [1, 2, 3, 4];

// Mes de inicio (0-indexado) y mes de fin de cada trimestre natural
const MESES_TRIMESTRE = {
    1: { inicio: 0, fin: 2 },
    2: { inicio: 3, fin: 5 },
    3: { inicio: 6, fin: 8 },
    4: { inicio: 9, fin: 11 }
};

function calcularPeriodoTrimestre(year, quarter) {
    const { inicio, fin } = MESES_TRIMESTRE[quarter];
    const fechaInicio = new Date(Date.UTC(year, inicio, 1));
    const fechaFin = new Date(Date.UTC(year, fin + 1, 0));
    return { fechaInicio, fechaFin };
}

export async function getQuarterlyInvoicesForPdf(yearParam, quarterParam) {
    const year = Number(yearParam);
    const quarter = Number(quarterParam);

    if (!yearParam || !Number.isInteger(year) || year < ANIO_MINIMO || year > ANIO_MAXIMO) {
        throw httpError(400, `El año debe ser un número entero entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}`);
    }

    if (!quarterParam || !TRIMESTRES_VALIDOS.includes(quarter)) {
        throw httpError(400, 'El trimestre debe ser 1, 2, 3 o 4');
    }

    const invoices = await invoicesRepository.findByQuarterForPdf(year, quarter);
    if (invoices.length === 0) {
        throw httpError(404, 'No existen facturas para el trimestre seleccionado');
    }

    const settings = await settingsService.getSettings();

    return { invoices, settings, year, quarter };
}

const ESPACIO_ENTRE_COLUMNAS = 8;

function dibujarCabeceraTabla(doc, columnas, y) {
    doc.fontSize(9).font('Helvetica-Bold');
    let x = doc.page.margins.left;
    columnas.forEach((columna) => {
        doc.text(columna.titulo, x, y, { width: columna.ancho, align: columna.align || 'left' });
        x += columna.ancho + ESPACIO_ENTRE_COLUMNAS;
    });
}

function dibujarFilaTabla(doc, columnas, valores, y) {
    doc.fontSize(9).font('Helvetica');
    let x = doc.page.margins.left;
    columnas.forEach((columna, indice) => {
        doc.text(valores[indice], x, y, { width: columna.ancho, align: columna.align || 'left' });
        x += columna.ancho + ESPACIO_ENTRE_COLUMNAS;
    });
}

function dibujarTablaResumen(doc, invoices) {
    const columnas = [
        { titulo: 'Número', ancho: 75 },
        { titulo: 'Fecha', ancho: 55 },
        { titulo: 'Paciente', ancho: 95 },
        { titulo: 'Base', ancho: 50, align: 'right' },
        { titulo: 'IVA', ancho: 45, align: 'right' },
        { titulo: 'Total', ancho: 55, align: 'right' },
        { titulo: 'Estado', ancho: 50 }
    ];

    const anchoTotalTabla = columnas.reduce((suma, c) => suma + c.ancho, 0) +
        ESPACIO_ENTRE_COLUMNAS * (columnas.length - 1);
    const alturaFila = 18;
    const yLimite = doc.page.height - doc.page.margins.bottom;

    doc.fontSize(13).font('Helvetica-Bold').text('Detalle de facturas del periodo');
    doc.moveDown(0.5);

    let y = doc.y;
    dibujarCabeceraTabla(doc, columnas, y);
    y += alturaFila;
    doc.moveTo(doc.page.margins.left, y - 4)
        .lineTo(doc.page.margins.left + anchoTotalTabla, y - 4)
        .stroke();

    invoices.forEach((invoice) => {
        if (y + alturaFila > yLimite) {
            doc.addPage();
            y = doc.page.margins.top;
            dibujarCabeceraTabla(doc, columnas, y);
            y += alturaFila;
            doc.moveTo(doc.page.margins.left, y - 4)
                .lineTo(doc.page.margins.left + anchoTotalTabla, y - 4)
                .stroke();
        }

        dibujarFilaTabla(doc, columnas, [
            invoice.numero_factura,
            formateadorFecha.format(new Date(invoice.fecha)),
            `${invoice.paciente_nombre} ${invoice.paciente_apellidos}`,
            euros(invoice.importe_centimos),
            invoice.tipo_iva === '21' ? euros(invoice.iva_centimos) : 'Exento',
            euros(invoice.total_centimos),
            invoice.estado === 'pagada' ? 'Pagada' : 'Pendiente'
        ], y);

        y += alturaFila;
    });

    doc.y = y;
}

/**
 * Construye el documento PDF del resumen trimestral: una primera página
 * con el resumen económico y la tabla de facturas, seguida de una página
 * por cada factura completa (mismo diseño que el PDF individual).
 */
export function buildQuarterlyPdfDocument(invoices, settings, year, quarter) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    const { fechaInicio, fechaFin } = calcularPeriodoTrimestre(year, quarter);
    const facturasPagadas = invoices.filter((f) => f.estado === 'pagada');
    const facturasPendientes = invoices.filter((f) => f.estado === 'pendiente');

    const baseImponibleTotal = invoices.reduce((suma, f) => suma + f.importe_centimos, 0);
    const ivaTotal = invoices.reduce((suma, f) => suma + f.iva_centimos, 0);
    const totalFacturado = invoices.reduce((suma, f) => suma + f.total_centimos, 0);
    const totalCobrado = facturasPagadas.reduce((suma, f) => suma + f.total_centimos, 0);
    const totalPendiente = facturasPendientes.reduce((suma, f) => suma + f.total_centimos, 0);

    // ---------- Primera página: resumen trimestral ----------
    doc.fontSize(20).font('Helvetica-Bold').text('RESUMEN TRIMESTRAL DE FACTURACIÓN');
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    doc.text(`${settings.nombre} ${settings.apellidos}`);
    if (settings.nif) doc.text(`NIF: ${settings.nif}`);
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').text(`Año: `, { continued: true }).font('Helvetica').text(String(year));
    doc.font('Helvetica-Bold').text(`Trimestre: `, { continued: true }).font('Helvetica').text(`T${quarter}`);
    doc.font('Helvetica-Bold').text(`Periodo: `, { continued: true })
        .font('Helvetica')
        .text(`${formateadorFecha.format(fechaInicio)} – ${formateadorFecha.format(fechaFin)}`);
    doc.font('Helvetica-Bold').text(`Fecha de generación: `, { continued: true })
        .font('Helvetica').text(formateadorFecha.format(new Date()));

    doc.moveDown(1.2);
    doc.fontSize(13).font('Helvetica-Bold').text('Resumen económico');
    doc.moveDown(0.4);

    doc.fontSize(11).font('Helvetica');
    doc.text(`Número total de facturas: ${invoices.length}`);
    doc.text(`Facturas pagadas: ${facturasPagadas.length}`);
    doc.text(`Facturas pendientes: ${facturasPendientes.length}`);
    doc.moveDown(0.4);
    doc.text(`Base imponible total: ${euros(baseImponibleTotal)}`);
    doc.text(`IVA total: ${euros(ivaTotal)}`);
    doc.font('Helvetica-Bold').text(`Total facturado: ${euros(totalFacturado)}`);
    doc.font('Helvetica').text(`Total cobrado: ${euros(totalCobrado)}`);
    doc.text(`Total pendiente: ${euros(totalPendiente)}`);
    doc.moveDown(1.2);

    // ---------- Tabla resumen ----------
    dibujarTablaResumen(doc, invoices);

    // ---------- Facturas completas ----------
    invoices.forEach((invoice) => {
        doc.addPage();
        renderInvoiceContent(doc, invoice, settings);
    });

    doc.end();

    return doc;
}
