export const SAN_FERNANDO_CENTER = [7.8100, 125.3500]; // Geographic center of San Fernando, Bukidnon (enclosing all 24 barangays)
export const SAN_FERNANDO_POBLACION = [7.9137, 125.3362]; // Halapitan (Municipal Hall / Poblacion)
export const SAN_FERNANDO_BOUNDS = [
  [7.5600, 125.1800], // Southwest boundary buffer
  [8.0400, 125.5000], // Northeast boundary buffer
];

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

// Exact centroid coordinates for all 24 barangays of San Fernando, Bukidnon
export const BARANGAY_COORDINATES = {
  Bonacao: [7.8037, 125.4007],
  Bulalang: [7.7568, 125.3564],
  Cabuling: [7.6686, 125.3761], // Southern sector below Kalagangan
  Candelaria: [7.9259, 125.3802],
  Cayaga: [7.7315, 125.4057],
  Dao: [7.7902, 125.3416],
  Durian: [7.6422, 125.3463], // Southwestern sector
  Halapitan: [7.9137, 125.3362], // Poblacion / Municipal Center
  Iglugsad: [7.8255, 125.3634],
  Kalagangan: [7.7132, 125.3602], // Southern corridor
  Kawayan: [7.8998, 125.3920],
  Kibongcog: [7.8548, 125.3138],
  'Little Baguio': [7.9199, 125.2880], // Northwestern sector
  Mabuhay: [7.8865, 125.3582],
  Magkalungay: [7.8631, 125.3779],
  Malayanan: [7.9605, 125.2909],
  Matupe: [7.6447, 125.4088], // Southeastern sector near Davao border
  Nacabuklad: [7.9639, 125.3491], // Northern mountainous sector
  Namnam: [7.8382, 125.3906],
  Palacpacan: [7.7934, 125.3731],
  'Sacramento Valley': [7.9278, 125.2678],
  'San Jose': [7.7521, 125.4117],
  'Santo Domingo': [7.7733, 125.4050],
  Tugop: [7.9721, 125.3172], // North ridge sector
};

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

export const REPORT_DATE_RANGE_OPTIONS = [
  'Today',
  'Last 7 days',
  'Last 30 days',
];

export const INCIDENT_TYPES = [
  'All Types',
  'Fire',
  'Flood',
  'Vehicular Accident',
  'Medical',
  'Landslide',
];

export const REPORT_TYPE_OPTIONS = [
  'All types',
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
    lat: 7.9350,
    lng: 125.3120,
    coordinates: '7.9350, 125.3120',
    date: getRelativeDate(0, 10, 42),
    time: '10:42 AM',
    text: 'Large residential fire near cluster houses. Multiple structures affected. LDRRMO Alpha team deployed with fire suppression units.',
    hasImage: true,
    status: 'Active',
  },
  {
    id: 'RPT-2026-001235',
    type: 'Flood',
    sender: 'Team Bravo-02',
    barangay: 'Halapitan',
    location: 'Brgy. Halapitan (Tigwa Riverbank)',
    lat: 7.9186,
    lng: 125.3286,
    coordinates: '7.9186, 125.3286',
    date: getRelativeDate(0, 8, 15),
    time: '08:15 AM',
    text: 'Water level at Tigwa River surpassed critical alert threshold. 45 households evacuated to Halapitan Central Elementary School.',
    hasImage: true,
    status: 'Active',
  },
  {
    id: 'RPT-2026-001236',
    type: 'Vehicular Accident',
    sender: 'Unit Charlie-03',
    barangay: 'Kalagangan',
    location: 'Brgy. Kalagangan, Provincial Road',
    lat: 7.6922,
    lng: 125.3900,
    coordinates: '7.6922, 125.3900',
    date: getRelativeDate(1, 14, 20),
    time: '02:20 PM',
    text: 'Two-vehicle head-on collision involving delivery truck and motorcycle. Emergency medical triage established on-site.',
    hasImage: false,
    status: 'Investigating',
  },
  {
    id: 'RPT-2026-001237',
    type: 'Landslide',
    sender: 'Delta Rescue-04',
    barangay: 'Little Baguio',
    location: 'Brgy. Little Baguio, Sitio Dayag',
    lat: 7.9245,
    lng: 125.3001,
    coordinates: '7.9245, 125.3001',
    date: getRelativeDate(1, 9, 10),
    time: '09:10 AM',
    text: 'Heavy rainfall triggered rockslide blocking secondary provincial corridor. Clearing operations ongoing with Municipal Engineering Office.',
    hasImage: true,
    status: 'Active',
  },
  {
    id: 'RPT-2026-001238',
    type: 'Medical',
    sender: 'Echo Medic-05',
    barangay: 'Namnam',
    location: 'Brgy. Namnam, Purok 4',
    lat: 7.8342,
    lng: 125.3807,
    coordinates: '7.8342, 125.3807',
    date: getRelativeDate(3, 11, 45),
    time: '11:45 AM',
    text: 'Senior resident requiring emergency oxygen and medical evacuation due to respiratory distress. Transported to Bukidnon Provincial Hospital.',
    hasImage: false,
    status: 'Resolved',
  },
  {
    id: 'RPT-2026-001239',
    type: 'Flood',
    sender: 'Team Bravo-02',
    barangay: 'Little Baguio',
    location: 'Brgy. Little Baguio, Sitio Kauswagan',
    lat: 7.9270,
    lng: 125.3025,
    coordinates: '7.9270, 125.3025',
    date: getRelativeDate(5, 16, 30),
    time: '04:30 PM',
    text: 'Flash flood overflow inundated agricultural farmlands and bridge approach. Monitoring water recession rate.',
    hasImage: true,
    status: 'Monitoring',
  },
  {
    id: 'RPT-2026-001240',
    type: 'Fire',
    sender: 'Responder Alpha-01',
    barangay: 'Bonacao',
    location: 'Brgy. Bonacao, Commercial Zone',
    lat: 7.7985,
    lng: 125.3931,
    coordinates: '7.7985, 125.3931',
    date: getRelativeDate(12, 19, 0),
    time: '07:00 PM',
    text: 'Electrical fire started at warehouse facility. Controlled within 40 minutes by municipal fire marshals.',
    hasImage: true,
    status: 'Resolved',
  },
  {
    id: 'RPT-2026-001241',
    type: 'Vehicular Accident',
    sender: 'Unit Charlie-03',
    barangay: 'Kibongcog',
    location: 'Brgy. Kibongcog, Highway Curve',
    lat: 7.9480,
    lng: 125.3620,
    coordinates: '7.9480, 125.3620',
    date: getRelativeDate(18, 13, 15),
    time: '01:15 PM',
    text: 'Single-vehicle rollover due to slippery road conditions during localized downpour. Driver sustained minor contusions.',
    hasImage: false,
    status: 'Resolved',
  },
  {
    id: 'RPT-2026-001242',
    type: 'Landslide',
    sender: 'Delta Rescue-04',
    barangay: 'San Jose',
    location: 'Brgy. San Jose, Slope Section',
    lat: 7.7750,
    lng: 125.3300,
    coordinates: '7.7750, 125.3300',
    date: getRelativeDate(25, 6, 50),
    time: '06:50 AM',
    text: 'Minor slope slippage near access road. Geohazard assessment team dispatched for stability verification.',
    hasImage: true,
    status: 'Resolved',
  },
  {
    id: 'RPT-2026-001243',
    type: 'Medical',
    sender: 'Echo Medic-05',
    barangay: 'Tugop',
    location: 'Brgy. Tugop, Health Center Area',
    lat: 7.9850,
    lng: 125.2950,
    coordinates: '7.9721, 125.3172',
    date: getRelativeDate(42, 15, 10),
    time: '03:10 PM',
    text: 'Emergency maternal transfer and pediatric support dispatched during severe localized weather.',
    hasImage: false,
    status: 'Resolved',
  },
  {
    id: 'RPT-2026-001244',
    type: 'Landslide',
    sender: 'Unit Charlie-03',
    barangay: 'Nacabuklad',
    location: 'Brgy. Nacabuklad (Northern Mountain Ridge)',
    lat: 7.9639,
    lng: 125.3491,
    coordinates: '7.9639, 125.3491',
    date: getRelativeDate(0, 7, 20),
    time: '07:20 AM',
    text: 'Northern mountain boundary corridor monitoring. Slope erosion detected along upper watershed trail.',
    hasImage: true,
    status: 'Active',
  },
  {
    id: 'RPT-2026-001245',
    type: 'Flood',
    sender: 'Team Bravo-02',
    barangay: 'Cabuling',
    location: 'Brgy. Cabuling, Southern River Approach',
    lat: 7.6686,
    lng: 125.3761,
    coordinates: '7.6686, 125.3761',
    date: getRelativeDate(1, 11, 15),
    time: '11:15 AM',
    text: 'Southern border waterway swollen after heavy upland rainfall. Submerged culvert cleared by community brigade.',
    hasImage: false,
    status: 'Active',
  },
  {
    id: 'RPT-2026-001246',
    type: 'Medical',
    sender: 'Echo Medic-05',
    barangay: 'Matupe',
    location: 'Brgy. Matupe (Davao Region Border Sector)',
    lat: 7.6447,
    lng: 125.4088,
    coordinates: '7.6447, 125.4088',
    date: getRelativeDate(2, 16, 40),
    time: '04:40 PM',
    text: 'Emergency response at southeastern boundary checkpoint for medical evacuation coordination.',
    hasImage: true,
    status: 'Resolved',
  },
  {
    id: 'RPT-2026-001247',
    type: 'Vehicular Accident',
    sender: 'Responder Alpha-01',
    barangay: 'Bulalang',
    location: 'Brgy. Bulalang, Agricultural Access Road',
    lat: 7.7568,
    lng: 125.3564,
    coordinates: '7.7568, 125.3564',
    date: getRelativeDate(3, 8, 30),
    time: '08:30 AM',
    text: 'Farm transport vehicle minor stall and roadside assistance along western barangay connector.',
    hasImage: false,
    status: 'Resolved',
  },
];

// Live Officer Location Tracking in San Fernando, Bukidnon
// Reserved for live GPS coordinates from the authorized DRRMO Responder companion mobile app (currently under active development).
// No simulated APRS packets, fictional radio stations, or weather telemetry are emitted.
export const LIVE_OFFICERS = [];


export function isWithinDateRange(incidentDateStr, range) {
  if (!range || range === 'All Time') return true;
  const now = new Date();
  const incDate = new Date(incidentDateStr);
  if (Number.isNaN(incDate.getTime())) return true;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const incStart = new Date(incDate.getFullYear(), incDate.getMonth(), incDate.getDate()).getTime();
  const diffDays = Math.round((todayStart - incStart) / (1000 * 60 * 60 * 24));

  const normalized = range.toLowerCase().trim();
  if (normalized === 'today') return diffDays === 0;
  if (normalized === 'yesterday') return diffDays === 1;
  if (normalized === 'last 7 days') return diffDays >= 0 && diffDays <= 7;
  if (normalized === 'last 30 days') return diffDays >= 0 && diffDays <= 30;
  if (normalized === 'this month') {
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

// Helper to normalize barangay names against official 24 barangays of San Fernando, Bukidnon
export const normalizeBarangay = (raw) => {
  if (!raw) return 'Halapitan';
  const clean = String(raw)
    .replace(/^Brgy\.\s*/i, '')
    .replace(/\s*\(Poblacion\)/i, '')
    .replace(/\s*\(Tigwa Riverbank\)/i, '')
    .replace(/\s*\(.*\)/i, '')
    .trim();
  const match = SAN_FERNANDO_BARANGAYS.find(
    (b) => b.toLowerCase() === clean.toLowerCase()
  );
  return match || clean;
};

// Dashboard 7-Day Timeline Dataset
export const TIMELINE_DATASETS = {
  'All incident types': [
    { label: 'SEP 15', value: 14 },
    { label: 'SEP 16', value: 20 },
    { label: 'SEP 17', value: 26 },
    { label: 'SEP 18', value: 21 },
    { label: 'SEP 19', value: 18 },
    { label: 'SEP 20', value: 38 },
    { label: 'TODAY', value: 47 },
  ],
  Fire: [
    { label: 'SEP 15', value: 5 },
    { label: 'SEP 16', value: 8 },
    { label: 'SEP 17', value: 11 },
    { label: 'SEP 18', value: 7 },
    { label: 'SEP 19', value: 6 },
    { label: 'SEP 20', value: 15 },
    { label: 'TODAY', value: 18 },
  ],
  Flood: [
    { label: 'SEP 15', value: 4 },
    { label: 'SEP 16', value: 6 },
    { label: 'SEP 17', value: 8 },
    { label: 'SEP 18', value: 7 },
    { label: 'SEP 19', value: 5 },
    { label: 'SEP 20', value: 12 },
    { label: 'TODAY', value: 16 },
  ],
  'Vehicular Accident': [
    { label: 'SEP 15', value: 3 },
    { label: 'SEP 16', value: 4 },
    { label: 'SEP 17', value: 5 },
    { label: 'SEP 18', value: 5 },
    { label: 'SEP 19', value: 4 },
    { label: 'SEP 20', value: 8 },
    { label: 'TODAY', value: 9 },
  ],
  Medical: [
    { label: 'SEP 15', value: 2 },
    { label: 'SEP 16', value: 3 },
    { label: 'SEP 17', value: 4 },
    { label: 'SEP 18', value: 3 },
    { label: 'SEP 19', value: 2 },
    { label: 'SEP 20', value: 5 },
    { label: 'TODAY', value: 7 },
  ],
  Landslide: [
    { label: 'SEP 15', value: 1 },
    { label: 'SEP 16', value: 2 },
    { label: 'SEP 17', value: 3 },
    { label: 'SEP 18', value: 2 },
    { label: 'SEP 19', value: 1 },
    { label: 'SEP 20', value: 4 },
    { label: 'TODAY', value: 5 },
  ],
};

// Hourly counts for today (hours 0 to 23, total 178)
export const HOURLY_COUNTS_ALL = [
  3, 2, 2, 2, 2, 3, 5, 7, 10, 8, 12, 10, 8, 8, 11, 12, 15, 13, 12, 10, 8, 7, 5, 3,
];

// Scaled factors for hourly types
export const TYPE_SCALING = {
  All: 1,
  Fire: 0.38,
  Flood: 0.30,
  'Vehicular Accident': 0.20,
  Medical: 0.15,
  Landslide: 0.10,
};

// Daily counts for last 30 days (sum ~ 1,420)
export const DAILY_COUNTS_ALL = [
  38, 42, 39, 45, 52, 48, 41, 39, 44, 46, 50, 55, 49, 43, 40,
  45, 48, 51, 47, 44, 42, 46, 53, 58, 50, 46, 44, 48, 52, 47,
];

// Monthly counts for last 12 months (sum ~ 16,840)
export const MONTHLY_COUNTS_ALL = [
  1280, 1340, 1410, 1390, 1460, 1520, 1490, 1380, 1420, 1450, 1480, 1210,
];

export const MONTH_LABELS = [
  'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP',
];

// Type Distribution breakdown for San Fernando Command Center
export const INCIDENT_TYPE_DISTRIBUTION = [
  { type: 'Fire', count: 38, percentage: 32, color: '#D92D20', description: 'Structural, brush & kitchen fires' },
  { type: 'Flood', count: 28, percentage: 24, color: '#1B57D6', description: 'River surge & flash floods' },
  { type: 'Vehicular Accident', count: 24, percentage: 20, color: '#D97706', description: 'Highway & farm connector incidents' },
  { type: 'Medical', count: 17, percentage: 14, color: '#10B981', description: 'Emergency trauma & medical transfer' },
  { type: 'Landslide', count: 11, percentage: 10, color: '#8B5CF6', description: 'Slope displacement & road blockages' },
];

// Report by Barangay for ALL 24 official barangays of San Fernando, Bukidnon
// Cleaned names matching SAN_FERNANDO_BARANGAYS, ranked highest to lowest
export const BARANGAY_REPORTS_DATA = [
  { barangay: 'Halapitan', count: 62, byType: { Fire: 22, Flood: 18, 'Vehicular Accident': 12, Medical: 7, Landslide: 3 }, lat: 7.9137, lng: 125.3362 },
  { barangay: 'Little Baguio', count: 57, byType: { Fire: 19, Flood: 16, 'Vehicular Accident': 10, Medical: 8, Landslide: 4 }, lat: 7.9199, lng: 125.2880 },
  { barangay: 'Kawayan', count: 48, byType: { Fire: 16, Flood: 14, 'Vehicular Accident': 9, Medical: 6, Landslide: 3 }, lat: 7.8998, lng: 125.3920 },
  { barangay: 'Namnam', count: 41, byType: { Fire: 14, Flood: 12, 'Vehicular Accident': 7, Medical: 5, Landslide: 3 }, lat: 7.8382, lng: 125.3906 },
  { barangay: 'Kalagangan', count: 34, byType: { Fire: 11, Flood: 10, 'Vehicular Accident': 6, Medical: 4, Landslide: 3 }, lat: 7.7132, lng: 125.3602 },
  { barangay: 'Kibongcog', count: 29, byType: { Fire: 9, Flood: 9, 'Vehicular Accident': 5, Medical: 4, Landslide: 2 }, lat: 7.8548, lng: 125.3138 },
  { barangay: 'Bonacao', count: 26, byType: { Fire: 8, Flood: 8, 'Vehicular Accident': 4, Medical: 4, Landslide: 2 }, lat: 7.8037, lng: 125.4007 },
  { barangay: 'Tugop', count: 24, byType: { Fire: 7, Flood: 8, 'Vehicular Accident': 4, Medical: 3, Landslide: 2 }, lat: 7.9721, lng: 125.3172 },
  { barangay: 'San Jose', count: 21, byType: { Fire: 7, Flood: 6, 'Vehicular Accident': 4, Medical: 2, Landslide: 2 }, lat: 7.7521, lng: 125.4117 },
  { barangay: 'Nacabuklad', count: 19, byType: { Fire: 5, Flood: 6, 'Vehicular Accident': 3, Medical: 3, Landslide: 2 }, lat: 7.9639, lng: 125.3491 },
  { barangay: 'Cabuling', count: 17, byType: { Fire: 5, Flood: 5, 'Vehicular Accident': 3, Medical: 2, Landslide: 2 }, lat: 7.6686, lng: 125.3761 },
  { barangay: 'Bulalang', count: 16, byType: { Fire: 5, Flood: 5, 'Vehicular Accident': 3, Medical: 2, Landslide: 1 }, lat: 7.7568, lng: 125.3564 },
  { barangay: 'Matupe', count: 15, byType: { Fire: 4, Flood: 5, 'Vehicular Accident': 3, Medical: 2, Landslide: 1 }, lat: 7.6447, lng: 125.4088 },
  { barangay: 'Candelaria', count: 14, byType: { Fire: 4, Flood: 4, 'Vehicular Accident': 3, Medical: 2, Landslide: 1 }, lat: 7.9259, lng: 125.3802 },
  { barangay: 'Cayaga', count: 13, byType: { Fire: 4, Flood: 4, 'Vehicular Accident': 2, Medical: 2, Landslide: 1 }, lat: 7.7315, lng: 125.4057 },
  { barangay: 'Dao', count: 12, byType: { Fire: 3, Flood: 4, 'Vehicular Accident': 2, Medical: 2, Landslide: 1 }, lat: 7.7902, lng: 125.3416 },
  { barangay: 'Durian', count: 11, byType: { Fire: 3, Flood: 3, 'Vehicular Accident': 2, Medical: 2, Landslide: 1 }, lat: 7.6422, lng: 125.3463 },
  { barangay: 'Iglugsad', count: 11, byType: { Fire: 3, Flood: 3, 'Vehicular Accident': 2, Medical: 2, Landslide: 1 }, lat: 7.8255, lng: 125.3634 },
  { barangay: 'Mabuhay', count: 10, byType: { Fire: 3, Flood: 3, 'Vehicular Accident': 2, Medical: 1, Landslide: 1 }, lat: 7.8865, lng: 125.3582 },
  { barangay: 'Magkalungay', count: 9, byType: { Fire: 3, Flood: 2, 'Vehicular Accident': 2, Medical: 1, Landslide: 1 }, lat: 7.8631, lng: 125.3779 },
  { barangay: 'Malayanan', count: 8, byType: { Fire: 2, Flood: 2, 'Vehicular Accident': 2, Medical: 1, Landslide: 1 }, lat: 7.9605, lng: 125.2909 },
  { barangay: 'Palacpacan', count: 8, byType: { Fire: 2, Flood: 2, 'Vehicular Accident': 2, Medical: 1, Landslide: 1 }, lat: 7.7934, lng: 125.3731 },
  { barangay: 'Sacramento Valley', count: 7, byType: { Fire: 2, Flood: 2, 'Vehicular Accident': 1, Medical: 1, Landslide: 1 }, lat: 7.9278, lng: 125.2678 },
  { barangay: 'Santo Domingo', count: 6, byType: { Fire: 2, Flood: 1, 'Vehicular Accident': 1, Medical: 1, Landslide: 1 }, lat: 7.7733, lng: 125.4050 },
];

export const BARANGAY_DENSITY_DATA = BARANGAY_REPORTS_DATA;

