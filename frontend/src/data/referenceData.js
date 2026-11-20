export const SAN_FERNANDO_BARANGAYS = [
  'Bonacao',
  'Bulalang',
  'Cabuling',
  'Candelaria',
  'Cayaga',
  'Dao',
  'Durian',
  'Halapitan',
  'Iglugsad',
  'Kalagangan',
  'Kawayan',
  'Kibongcog',
  'Little Baguio',
  'Mabuhay',
  'Magkalungay',
  'Malayanan',
  'Matupe',
  'Nacabuklad',
  'Namnam',
  'Palacpacan',
  'Sacramento Valley',
  'San Jose',
  'Santo Domingo',
  'Tugop',
];

export const BARANGAY_OPTIONS = ['All Barangays', ...SAN_FERNANDO_BARANGAYS];
export const REPORT_BARANGAY_OPTIONS = ['All 24 barangays', ...SAN_FERNANDO_BARANGAYS];

export const DATE_RANGE_OPTIONS = [
  'Today',
  'Yesterday',
  'Last 7 Days',
  'Last 30 Days',
  'This Month',
  'All Time',
];

export const REPORT_DATE_RANGE_OPTIONS = ['Today', 'Last 7 days', 'Last 30 days'];

export const INCIDENT_TYPES = [
  'All Types',
  'Fire',
  'Flood',
  'Vehicular Accident',
  'Medical',
  'Landslide',
];

export const REPORT_TYPE_OPTIONS = ['All types', ...INCIDENT_TYPES.slice(1)];

export function normalizeBarangay(raw) {
  if (!raw) return '';
  const clean = String(raw)
    .replace(/^Brgy\.\s*/i, '')
    .replace(/\s*\(.*\)/i, '')
    .trim();
  const match = SAN_FERNANDO_BARANGAYS.find(
    (barangay) => barangay.toLowerCase() === clean.toLowerCase()
  );
  return match || clean;
}

export function isWithinDateRange(incidentDateStr, range) {
  if (!range || range === 'All Time') return true;
  const incidentDate = new Date(incidentDateStr);
  if (Number.isNaN(incidentDate.getTime())) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const incidentStart = new Date(
    incidentDate.getFullYear(),
    incidentDate.getMonth(),
    incidentDate.getDate()
  ).getTime();
  const diffDays = Math.floor((todayStart - incidentStart) / (1000 * 60 * 60 * 24));

  const normalized = range.toLowerCase().trim();
  if (normalized === 'today') return diffDays === 0;
  if (normalized === 'yesterday') return diffDays === 1;
  if (normalized === 'last 7 days') return diffDays >= 0 && diffDays <= 7;
  if (normalized === 'last 30 days') return diffDays >= 0 && diffDays <= 30;
  if (normalized === 'this month') {
    return incidentDate.getFullYear() === now.getFullYear()
      && incidentDate.getMonth() === now.getMonth();
  }
  return true;
}
