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

export const DATE_RANGE_OPTIONS = [
  'Today',
  'Yesterday',
  'Last 7 Days',
  'Last 30 Days',
  'This Month',
  'All Time',
];

export const INCIDENT_TYPES = [
  'All Types',
  'Fire',
  'Flood',
  'Vehicular Accident',
  'Medical',
  'Landslide',
];

// Helper to generate dynamic dates relative to current time
const getRelativeDate = (daysAgo, hour = 10, minute = 30) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

export const INCIDENTS = [
  {
    id: 'RPT-2026-001234',
    type: 'Fire',
    sender: 'Responder Alpha-01',
    barangay: 'Kawayan',
    location: 'Brgy. Kawayan, Purok 2',
    coordinates: '7.8421, 125.2104',
    date: getRelativeDate(0, 10, 42),
    time: '10:42 AM',
    text: 'Large residential fire near cluster houses. Multiple structures affected. LDRRMO Alpha team deployed with fire suppression units.',
    hasImage: true,
    status: 'Active',
    mapPos: { top: '22%', left: '52%' },
  },
  {
    id: 'RPT-2026-001235',
    type: 'Flood',
    sender: 'Team Bravo-02',
    barangay: 'Halapitan',
    location: 'Brgy. Halapitan (Tigwa Riverbank)',
    coordinates: '7.8340, 125.2051',
    date: getRelativeDate(0, 8, 15),
    time: '08:15 AM',
    text: 'Water level at Tigwa River surpassed critical alert threshold. 45 households evacuated to Halapitan Central Elementary School.',
    hasImage: true,
    status: 'Active',
    mapPos: { top: '58%', left: '38%' },
  },
  {
    id: 'RPT-2026-001236',
    type: 'Vehicular Accident',
    sender: 'Unit Charlie-03',
    barangay: 'Kalagangan',
    location: 'Brgy. Kalagangan, Sayre Highway Junction',
    coordinates: '7.8562, 125.2310',
    date: getRelativeDate(1, 14, 20),
    time: '02:20 PM',
    text: 'Two-vehicle head-on collision involving delivery truck and motorcycle. Emergency medical triage established on-site.',
    hasImage: false,
    status: 'Investigating',
    mapPos: { top: '35%', left: '68%' },
  },
  {
    id: 'RPT-2026-001237',
    type: 'Landslide',
    sender: 'Delta Rescue-04',
    barangay: 'Little Baguio',
    location: 'Brgy. Little Baguio, Sitio Dayag',
    coordinates: '7.8124, 125.1845',
    date: getRelativeDate(1, 9, 10),
    time: '09:10 AM',
    text: 'Heavy rainfall triggered rockslide blocking secondary provincial corridor. Clearing operations ongoing with Municipal Engineering Office.',
    hasImage: true,
    status: 'Active',
    mapPos: { top: '72%', left: '24%' },
  },
  {
    id: 'RPT-2026-001238',
    type: 'Medical',
    sender: 'Echo Medic-05',
    barangay: 'Namnam',
    location: 'Brgy. Namnam, Purok 4',
    coordinates: '7.8710, 125.2450',
    date: getRelativeDate(3, 11, 45),
    time: '11:45 AM',
    text: 'Senior resident requiring emergency oxygen and medical evacuation due to respiratory distress. Transported to Bukidnon Provincial Hospital.',
    hasImage: false,
    status: 'Resolved',
    mapPos: { top: '16%', left: '34%' },
  },
  {
    id: 'RPT-2026-001239',
    type: 'Flood',
    sender: 'Team Bravo-02',
    barangay: 'Little Baguio',
    location: 'Brgy. Little Baguio, Sitio Kauswagan',
    coordinates: '7.8180, 125.1912',
    date: getRelativeDate(5, 16, 30),
    time: '04:30 PM',
    text: 'Flash flood overflow inundated agricultural farmlands and bridge approach. Monitoring water recession rate.',
    hasImage: true,
    status: 'Monitoring',
    mapPos: { top: '65%', left: '19%' },
  },
  {
    id: 'RPT-2026-001240',
    type: 'Fire',
    sender: 'Responder Alpha-01',
    barangay: 'Bonacao',
    location: 'Brgy. Bonacao, Commercial Zone',
    coordinates: '7.8285, 125.2215',
    date: getRelativeDate(12, 19, 0),
    time: '07:00 PM',
    text: 'Electrical fire started at warehouse facility. Controlled within 40 minutes by municipal fire marshals.',
    hasImage: true,
    status: 'Resolved',
    mapPos: { top: '48%', left: '50%' },
  },
  {
    id: 'RPT-2026-001241',
    type: 'Vehicular Accident',
    sender: 'Unit Charlie-03',
    barangay: 'Kibongcog',
    location: 'Brgy. Kibongcog, Highway Curve',
    coordinates: '7.8633, 125.2188',
    date: getRelativeDate(18, 13, 15),
    time: '01:15 PM',
    text: 'Single-vehicle rollover due to slippery road conditions during localized downpour. Driver sustained minor contusions.',
    hasImage: false,
    status: 'Resolved',
    mapPos: { top: '28%', left: '76%' },
  },
  {
    id: 'RPT-2026-001242',
    type: 'Landslide',
    sender: 'Delta Rescue-04',
    barangay: 'San Jose',
    location: 'Brgy. San Jose, Slope Section',
    coordinates: '7.8490, 125.1720',
    date: getRelativeDate(25, 6, 50),
    time: '06:50 AM',
    text: 'Minor slope slippage near access road. Geohazard assessment team dispatched for stability verification.',
    hasImage: true,
    status: 'Resolved',
    mapPos: { top: '42%', left: '15%' },
  },
  {
    id: 'RPT-2026-001243',
    type: 'Medical',
    sender: 'Echo Medic-05',
    barangay: 'Tugop',
    location: 'Brgy. Tugop, Health Center Area',
    coordinates: '7.8812, 125.2601',
    date: getRelativeDate(42, 15, 10),
    time: '03:10 PM',
    text: 'Emergency maternal transfer and pediatric support dispatched during severe localized weather.',
    hasImage: false,
    status: 'Resolved',
    mapPos: { top: '80%', left: '60%' },
  },
];

export function isWithinDateRange(incidentDateStr, range) {
  if (!range || range === 'All Time') return true;
  const now = new Date();
  const incDate = new Date(incidentDateStr);
  if (Number.isNaN(incDate.getTime())) return true;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const incStart = new Date(incDate.getFullYear(), incDate.getMonth(), incDate.getDate()).getTime();
  const diffDays = Math.round((todayStart - incStart) / (1000 * 60 * 60 * 24));

  if (range === 'Today') return diffDays === 0;
  if (range === 'Yesterday') return diffDays === 1;
  if (range === 'Last 7 Days') return diffDays >= 0 && diffDays <= 7;
  if (range === 'Last 30 Days') return diffDays >= 0 && diffDays <= 30;
  if (range === 'This Month') {
    return incDate.getFullYear() === now.getFullYear() && incDate.getMonth() === now.getMonth();
  }
  return true;
}

export const TIMELINE_DATA = [
  { d: 'Apr 27', v: 18 },
  { d: 'Apr 28', v: 24 },
  { d: 'Apr 29', v: 31 },
  { d: 'Apr 30', v: 27 },
  { d: 'May 1', v: 22 },
  { d: 'May 2', v: 38 },
  { d: 'May 3', v: 46 },
];

export const HOURLY_DATA = Array.from({ length: 24 }, (_, hour) => {
  const values = [2, 1, 1, 0, 1, 3, 5, 8, 11, 9, 14, 12, 10, 9, 13, 15, 18, 16, 14, 11, 8, 6, 4, 3];
  return {
    h: String(hour).padStart(2, '0'),
    v: values[hour],
  };
});

export const DAILY_DATA = [
  { n: 'Mon', v: 11 },
  { n: 'Tue', v: 19 },
  { n: 'Wed', v: 14 },
  { n: 'Thu', v: 22 },
  { n: 'Fri', v: 18 },
  { n: 'Sat', v: 25 },
  { n: 'Sun', v: 13 },
];

export const MONTHLY_DATA = [
  { n: 'Jan', v: 240 },
  { n: 'Feb', v: 200 },
  { n: 'Mar', v: 310 },
  { n: 'Apr', v: 275 },
  { n: 'May', v: 85 },
];

export const INCIDENT_TYPE_DATA = [
  { name: 'Flood', value: 28 },
  { name: 'Fire', value: 22 },
  { name: 'Medical', value: 17 },
  { name: 'Landslide', value: 11 },
  { name: 'Road Accident', value: 22 },
];

export const CHART_COLORS = ['#334155', '#64748b', '#94a3b8', '#cbd5e1', '#1e293b'];

export const MONTH_OPTIONS = ['All Months', 'January', 'February', 'March', 'April', 'May'];

export const TYPE_FACTORS = {
  'All Types': 1,
  Flood: 0.78,
  Fire: 0.65,
  Medical: 0.5,
  Landslide: 0.35,
  'Vehicular Accident': 0.58,
};

export const MONTH_FACTORS = [1, 0.73, 0.82, 0.94, 0.68, 0.51];

export const BARANGAYS = [
  'Brgy. Halapitan',
  'Brgy. Little Baguio',
  'Brgy. Kawayan',
  'Brgy. Namnam',
  'Brgy. Kalagangan',
  'Brgy. Kibongcog',
];
