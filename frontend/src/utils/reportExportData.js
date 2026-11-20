const HEADERS = [
  'Report ID',
  'Incident Type',
  'Reported At',
  'Sender',
  'Barangay',
  'Location',
  'Latitude',
  'Longitude',
  'Status',
  'Description',
  'Data Source',
];

export function buildReportExportRows(incidents) {
  return incidents.map((incident) => [
    incident.id || '',
    incident.type || '',
    incident.date || '',
    incident.sender || '',
    incident.barangay || '',
    incident.location || '',
    incident.lat ?? '',
    incident.lng ?? '',
    incident.status || '',
    incident.text || '',
    incident.dataSource === 'demo' ? 'DEMO - NOT LIVE DRRMO DATA' : 'Operational',
  ]);
}

export function escapeCsvValue(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(incidents) {
  return [HEADERS, ...buildReportExportRows(incidents)]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\r\n');
}

export { HEADERS as REPORT_EXPORT_HEADERS };
