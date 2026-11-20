import { buildCsv, buildReportExportRows, REPORT_EXPORT_HEADERS } from './reportExportData.js';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function safeXml(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function spreadsheetText(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function columnName(index) {
  let column = '';
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }
  return column;
}

export async function buildXlsxBytes(incidents) {
  const { strToU8, zipSync } = await import('fflate');
  const rows = [REPORT_EXPORT_HEADERS, ...buildReportExportRows(incidents)];
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const address = `${columnName(columnIndex)}${rowIndex + 1}`;
      const text = safeXml(spreadsheetText(value));
      return `<c r="${address}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  const files = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '</Types>'
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>'
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheets><sheet name="Incident Reports" sheetId="1" r:id="rId1"/></sheets>'
      + '</workbook>'
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      + '</Relationships>'
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + `<dimension ref="A1:${columnName(REPORT_EXPORT_HEADERS.length - 1)}${rows.length}"/>`
      + `<sheetData>${sheetRows}</sheetData></worksheet>`
    ),
  };

  return zipSync(files);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function buildReportPdf(incidents, generatedDate = new Date().toISOString().slice(0, 10)) {
  if (!incidents.length) {
    throw new Error('There are no matching incident reports to export.');
  }
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const document = new jsPDF({ orientation: 'landscape' });
  document.setFontSize(14);
  document.text('SAFER 247 Incident Reports', 14, 15);
  document.setFontSize(9);
  document.text(`Records: ${incidents.length} · Generated: ${generatedDate}`, 14, 21);
  autoTable(document, {
    startY: 26,
    head: [REPORT_EXPORT_HEADERS],
    body: buildReportExportRows(incidents),
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    columnStyles: { 9: { cellWidth: 55 } },
    margin: { left: 10, right: 10 },
  });
  return document;
}

export async function downloadIncidentReports(incidents, format) {
  if (!incidents.length) {
    throw new Error('There are no matching incident reports to export.');
  }

  const date = new Date().toISOString().slice(0, 10);
  const baseFilename = `safer247-incident-reports-${date}`;
  const normalizedFormat = format.toUpperCase();

  if (normalizedFormat === 'CSV') {
    downloadBlob(
      new Blob([`\uFEFF${buildCsv(incidents)}`], { type: 'text/csv;charset=utf-8' }),
      `${baseFilename}.csv`
    );
    return;
  }

  if (normalizedFormat === 'XLSX') {
    downloadBlob(
      new Blob([await buildXlsxBytes(incidents)], { type: XLSX_MIME_TYPE }),
      `${baseFilename}.xlsx`
    );
    return;
  }

  if (normalizedFormat === 'PDF') {
    const document = await buildReportPdf(incidents, date);
    document.save(`${baseFilename}.pdf`);
    return;
  }

  throw new Error(`Unsupported export format: ${format}`);
}
