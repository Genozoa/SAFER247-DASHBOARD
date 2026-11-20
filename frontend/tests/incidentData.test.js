import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DEMO_INCIDENTS, DEMO_MESSAGES } from '../src/data/demoData.js';
import {
  DATA_SOURCE,
  INCIDENTS,
  LIVE_OFFICERS,
  createDemoOutgoingMessage,
  getOperationalDataSource,
} from '../src/data/operationalData.js';
import { SAN_FERNANDO_BARANGAYS } from '../src/data/referenceData.js';
import {
  filterIncidentRecords,
  getIncidentCountsByBarangay,
  getIncidentHeatmapPoints,
} from '../src/utils/incidentData.js';
import {
  buildCsv,
  buildReportExportRows,
} from '../src/utils/reportExportData.js';
import {
  buildReportPdf,
  buildXlsxBytes,
  downloadIncidentReports,
} from '../src/utils/reportExport.js';
import { unzipSync, strFromU8 } from 'fflate';

test('operational records are explicitly sourced from the demo fixture', () => {
  assert.equal(DATA_SOURCE, 'demo');
  assert.equal(INCIDENTS, DEMO_INCIDENTS);
  assert.equal(INCIDENTS.length, SAN_FERNANDO_BARANGAYS.length);
  assert.deepEqual(
    new Set(INCIDENTS.map((incident) => incident.barangay)),
    new Set(SAN_FERNANDO_BARANGAYS),
  );
  assert.ok(INCIDENTS.every((incident) => incident.dataSource === 'demo'));
  assert.deepEqual(new Set(INCIDENTS.map((incident) => incident.type)), new Set([
    'Fire',
    'Flood',
    'Vehicular Accident',
    'Medical',
    'Landslide',
  ]));
  assert.deepEqual(new Set(INCIDENTS.map((incident) => incident.status)), new Set(['Monitoring', 'Closed']));
  assert.ok(INCIDENTS.some((incident) => incident.hasImage));
});

test('demo incidents with image attachments have local, clearly branded illustrations', () => {
  const imageReports = INCIDENTS.filter((incident) => incident.hasImage);
  assert.ok(imageReports.length > 0);
  for (const incident of imageReports) {
    assert.ok(incident.imageName?.startsWith('DEMO'));
    assert.ok(incident.imageUrl?.startsWith('/images/demo-'));
    const asset = new URL(`../public${incident.imageUrl}`, import.meta.url);
    assert.ok(existsSync(asset));
    assert.match(readFileSync(asset, 'utf8'), /DEMO - FICTIONAL SCENE/);
  }
});

test('Alpha-1 receives demo data while other operators remain API-backed', () => {
  assert.equal(getOperationalDataSource('Alpha-1', 'api'), 'demo');
  assert.equal(getOperationalDataSource(' alpha-1 '), 'demo');
  assert.equal(getOperationalDataSource('Bravo-2'), 'api');
  assert.equal(getOperationalDataSource('Bravo-2', 'demo'), 'demo');
});

test('demo messages cover incoming and outgoing samples without claiming transmission', () => {
  assert.ok(DEMO_MESSAGES.some((message) => !message.isOutgoing && message.incidentReport));
  assert.ok(DEMO_MESSAGES.some((message) => message.isOutgoing));
  assert.ok(DEMO_MESSAGES.every((message) => (
    message.dataSource === 'demo'
    && message.status === 'sample'
    && (!message.isOutgoing || message.content.startsWith('DEMO:'))
  )));
  assert.ok(DEMO_MESSAGES
    .filter((message) => message.isOutgoing)
    .every((message) => (
      !message.incidentReport && message.recipient === 'Field Responders'
    )));
  assert.ok(DEMO_MESSAGES
    .filter((message) => message.incidentReport)
    .every((message) => (
      !message.isOutgoing
      && message.sender.startsWith('Sample Responder')
      && message.recipient === 'Alpha-1 (Demo)'
    )));
  assert.ok(DEMO_MESSAGES
    .filter((message) => !message.isOutgoing)
    .every((message) => message.sender.startsWith('Sample Responder')));
});

test('messages composed by the demo operator remain local sample records', () => {
  const message = createDemoOutgoingMessage(
    'Practice check-in',
    'Alpha-1',
    1,
    '2026-11-17T12:00:00.000Z',
  );
  assert.equal(message.sender, 'Alpha-1 (Demo)');
  assert.equal(message.isOutgoing, true);
  assert.equal(message.recipient, 'Field Responders');
  assert.equal(message.status, 'sample');
  assert.equal(message.dataSource, 'demo');
  assert.equal(message.incidentReport, undefined);
});

test('demo operational data does not fabricate unavailable officer GPS', () => {
  assert.deepEqual(LIVE_OFFICERS, []);
});

test('heatmap points include valid coordinates and omit missing coordinates', () => {
  const points = getIncidentHeatmapPoints([
    { lat: 7.9, lng: 125.3 },
    { lat: null, lng: 125.3 },
    { lat: 91, lng: 125.3 },
    { lat: 'invalid', lng: 125.3 },
    { lat: ' ', lng: 125.3 },
    { lat: false, lng: 125.3 },
  ]);
  assert.deepEqual(points, [[7.9, 125.3, 1]]);
  assert.deepEqual(getIncidentHeatmapPoints([]), []);
});

test('barangay hotspot counts reflect only mappable incidents', () => {
  const counts = getIncidentCountsByBarangay([
    { barangay: 'Halapitan', lat: 7.9, lng: 125.3 },
    { barangay: 'Brgy. Halapitan (Poblacion)', lat: 7.91, lng: 125.34 },
    { barangay: 'Halapitan', lat: null, lng: null },
  ]);
  assert.deepEqual(counts, [{ barangay: 'Halapitan', count: 2 }]);
  assert.deepEqual(getIncidentCountsByBarangay([]), []);
});

test('incident filters apply search, type, and barangay criteria', () => {
  const results = filterIncidentRecords(DEMO_INCIDENTS, {
    dateRange: 'All Time',
    type: 'Flood',
    barangay: 'Halapitan',
    searchQuery: 'DEMO-1',
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'DEMO-1');
});

test('report export fields include demo provenance and CSV quoting', () => {
  const sample = [{
    id: 'DEMO-99',
    type: 'Fire',
    date: '2026-01-01T10:00:00Z',
    sender: 'Demo, Unit',
    barangay: 'Halapitan',
    location: 'Purok 1',
    lat: 7.9,
    lng: 125.3,
    text: '=HYPERLINK("example")',
    dataSource: 'demo',
  }];
  const rows = buildReportExportRows(sample);
  assert.equal(rows[0][10], 'DEMO - NOT LIVE DRRMO DATA');
  const csv = buildCsv(sample);
  assert.match(csv, /"Demo, Unit"/);
  assert.match(csv, /"'=HYPERLINK\(""example""\)"/);
});

test('XLSX export creates an OpenXML ZIP with report records', async () => {
  const bytes = await buildXlsxBytes(DEMO_INCIDENTS.slice(0, 1));
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const files = unzipSync(bytes);
  const worksheet = strFromU8(files['xl/worksheets/sheet1.xml']);
  assert.match(worksheet, /DEMO-1/);
  assert.match(worksheet, /DEMO - NOT LIVE DRRMO DATA/);
});

test('PDF export generates a readable report document', async () => {
  const document = await buildReportPdf(DEMO_INCIDENTS.slice(0, 1), '2026-11-02');
  const output = document.output();
  assert.match(output, /^%PDF-/);
  assert.match(output, /DEMO-1/);
});

test('empty report exports fail clearly instead of producing an empty file', async () => {
  await assert.rejects(downloadIncidentReports([], 'CSV'), /no matching incident reports/i);
});
