import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_INCIDENTS } from './fixtures/demoData.js';
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
