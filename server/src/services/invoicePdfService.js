import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import * as invoicesRepository from '../repositories/invoicesRepository.js';
import * as settingsService from './settingsService.js';
import { httpError } from '../utils/httpError.js';
import { toObjectId } from '../utils/mongoId.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUTA_LOGO = path.join(__dirname, '..', 'assets', 'logo.png');
const RUTA_FIRMA = path.join(__dirname, '..', 'assets', 'firma.png');

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

// Paleta del modelo de factura (verde azulado / "teal") proporcionado
const COLOR_ACENTO = '#2f6e66';
const COLOR_TEXTO = '#1d2b2a';
const COLOR_TEXTO_SUAVE = '#5b6966';
const COLOR_FONDO_SUAVE = '#f2f5f4';
const COLOR_LINEA_SUAVE = '#dbe3e1';

function euros(centimos) {
    return formateadorEuros.format(centimos / 100);
}

export async function getInvoiceForPdf(id) {
    if (!toObjectId(id)) {
        throw httpError(400, 'El identificador de la factura no es válido');
    }

    const invoice = await invoicesRepository.findByIdForPdf(id);
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
    const left = doc.page.margins.left;
    const anchoPagina = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    doc.x = left;

    // ---------- Encabezado: logo (izq.) + FACTURA/nº/fecha (dcha.) ----------
    const yCabecera = doc.y;
    const anchoDerecha = 180;

    const anchoLogo = 150;
    const altoLogo = anchoLogo * (215 / 316);
    doc.image(RUTA_LOGO, left, yCabecera, { width: anchoLogo });
    const yFinIzquierda = yCabecera + altoLogo;

    const xDerecha = left + anchoPagina - anchoDerecha;
    doc.fontSize(22).font('Helvetica-Bold').fillColor(COLOR_TEXTO)
        .text('FACTURA', xDerecha, yCabecera, { width: anchoDerecha, align: 'right' });
    doc.moveDown(0.4);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_TEXTO_SUAVE)
        .text('Factura nº', xDerecha, doc.y, { width: anchoDerecha, align: 'right' });
    doc.fontSize(11).font('Helvetica').fillColor(COLOR_TEXTO)
        .text(invoice.numero_factura, xDerecha, doc.y, { width: anchoDerecha, align: 'right' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_TEXTO_SUAVE)
        .text('Fecha', xDerecha, doc.y, { width: anchoDerecha, align: 'right' });
    doc.fontSize(11).font('Helvetica').fillColor(COLOR_TEXTO)
        .text(formateadorFecha.format(new Date(invoice.fecha)), xDerecha, doc.y, { width: anchoDerecha, align: 'right' });
    const yFinDerecha = doc.y;

    const yHeaderFin = Math.max(yFinIzquierda, yFinDerecha) + 10;
    doc.moveTo(left, yHeaderFin).lineTo(left + anchoPagina, yHeaderFin)
        .lineWidth(2).strokeColor(COLOR_ACENTO).stroke();
    doc.x = left;
    doc.y = yHeaderFin + 10;

    // ---------- Línea de datos del profesional ----------
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLOR_TEXTO)
        .text(`${settings.nombre} ${settings.apellidos}`, left, doc.y);
    const datosProfesional = [];
    if (settings.direccion) datosProfesional.push(`Dirección: ${settings.direccion}`);
    if (settings.telefono) datosProfesional.push(`Teléfono: ${settings.telefono}`);
    if (settings.nif) datosProfesional.push(`D.N.I.: ${settings.nif}`);
    if (datosProfesional.length) {
        doc.fontSize(9).font('Helvetica').fillColor(COLOR_TEXTO_SUAVE).text(datosProfesional.join('    '));
    }
    doc.moveDown(0.8);
    doc.x = left;

    // ---------- Caja CLIENTE ----------
    const yCliente = doc.y;
    const alturaCliente = 78;
    doc.rect(left, yCliente, anchoPagina, alturaCliente).fill(COLOR_FONDO_SUAVE);

    doc.fillColor(COLOR_ACENTO).fontSize(10).font('Helvetica-Bold').text('CLIENTE', left + 14, yCliente + 10);

    doc.fillColor(COLOR_TEXTO).fontSize(9).font('Helvetica-Bold').text('Nombre', left + 14, yCliente + 30);
    doc.font('Helvetica').text(
        `${invoice.paciente_nombre} ${invoice.paciente_apellidos}`,
        left + 95, yCliente + 30, { width: anchoPagina - 115 }
    );

    doc.font('Helvetica-Bold').text('N.I.F.', left + 14, yCliente + 46);
    doc.font('Helvetica').text(invoice.paciente_dni || '—', left + 95, yCliente + 46, { width: anchoPagina - 115 });

    doc.font('Helvetica-Bold').text('Domicilio', left + 14, yCliente + 62);
    doc.font('Helvetica').text(invoice.paciente_direccion || '—', left + 95, yCliente + 62, { width: anchoPagina - 115 });

    doc.x = left;
    doc.y = yCliente + alturaCliente + 18;

    // ---------- Tabla CONCEPTO / TOTAL ----------
    const yTablaHead = doc.y;
    doc.rect(left, yTablaHead, anchoPagina, 22).fill(COLOR_FONDO_SUAVE);
    doc.fillColor(COLOR_ACENTO).fontSize(10).font('Helvetica-Bold');
    doc.text('CONCEPTO', left + 14, yTablaHead + 7, { width: anchoPagina - 160 });
    doc.text('TOTAL', left + anchoPagina - 100, yTablaHead + 7, { width: 86, align: 'right' });

    const yFilaConcepto = yTablaHead + 32;
    doc.fillColor(COLOR_TEXTO).fontSize(10).font('Helvetica');
    doc.text(invoice.concepto, left + 14, yFilaConcepto, { width: anchoPagina - 160 });
    doc.text(euros(invoice.importe_centimos), left + anchoPagina - 100, yFilaConcepto, { width: 86, align: 'right' });

    doc.x = left;
    doc.y = yFilaConcepto + 26;
    doc.moveTo(left, doc.y).lineTo(left + anchoPagina, doc.y).lineWidth(0.5).strokeColor(COLOR_LINEA_SUAVE).stroke();
    doc.moveDown(0.8);
    doc.x = left;

    // ---------- Totales ----------
    const escribirLineaTotal = (etiqueta, valor, opciones = {}) => {
        const y = doc.y;
        doc.font(opciones.negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(opciones.tamano || 10);
        doc.fillColor(opciones.color || COLOR_TEXTO);
        doc.text(etiqueta, left, y, { width: anchoPagina - 100 });
        doc.text(valor, left + anchoPagina - 100, y, { width: 100, align: 'right' });
        doc.moveDown(0.4);
        doc.x = left;
    };

    escribirLineaTotal('Base imponible', euros(invoice.importe_centimos));

    const porcentajeIva = invoice.tipo_iva === '21' ? '21 %' : '0 %';
    if (invoice.tipo_iva === '21') {
        escribirLineaTotal(`IVA (${porcentajeIva})`, euros(invoice.iva_centimos));
    } else {
        escribirLineaTotal(`IVA (${porcentajeIva})`, 'Exento');
    }

    doc.moveDown(0.3);
    doc.moveTo(left, doc.y).lineTo(left + anchoPagina, doc.y).lineWidth(1.5).strokeColor(COLOR_ACENTO).stroke();
    doc.moveDown(0.5);
    doc.x = left;

    escribirLineaTotal('TOTAL', euros(invoice.total_centimos), { negrita: true, tamano: 14, color: COLOR_ACENTO });
    doc.moveDown(0.6);
    doc.fillColor(COLOR_TEXTO).x = left;

    // ---------- Observaciones ----------
    if (invoice.observaciones) {
        doc.moveDown(0.6);
        doc.fontSize(10).font('Helvetica-Bold').fillColor(COLOR_TEXTO).text('Observaciones');
        doc.fontSize(9).font('Helvetica').fillColor(COLOR_TEXTO_SUAVE).text(invoice.observaciones);
    }

    // ---------- Firma ----------
    if (settings.numero_colegiada) {
        doc.moveDown(1.5);
        const anchoFirma = 130;
        const altoFirma = anchoFirma * (231 / 410);
        const xFirma = left + anchoPagina - anchoFirma;
        const yFirma = doc.y;
        doc.image(RUTA_FIRMA, xFirma, yFirma, { width: anchoFirma });
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_TEXTO_SUAVE)
            .text(`Psicóloga colegiada nº ${settings.numero_colegiada}`, left, yFirma + altoFirma + 4, { width: anchoPagina, align: 'right' });
    }

    // ---------- Nota fiscal ----------
    doc.x = left;
    doc.moveDown(2);
    doc.fontSize(8).font('Helvetica-Oblique').fillColor(COLOR_TEXTO_SUAVE);

    if (invoice.tipo_iva === 'exento') {
        doc.text(
            'Operación exenta de IVA conforme al artículo 20.Uno.3.º de la Ley 37/1992 del Impuesto sobre el Valor Añadido.'
        );
        doc.moveDown(0.3);
    }

    doc.text('Factura emitida conforme a la normativa fiscal española vigente para profesionales autónomos.');
    doc.fillColor(COLOR_TEXTO);
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
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLOR_ACENTO);
    let x = doc.page.margins.left;
    columnas.forEach((columna) => {
        doc.text(columna.titulo, x, y, { width: columna.ancho, align: columna.align || 'left' });
        x += columna.ancho + ESPACIO_ENTRE_COLUMNAS;
    });
    doc.fillColor(COLOR_TEXTO);
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
    doc.fontSize(20).font('Helvetica-Bold').fillColor(COLOR_ACENTO).text('RESUMEN TRIMESTRAL DE FACTURACIÓN');
    doc.fillColor(COLOR_TEXTO);
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
