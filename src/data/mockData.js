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

// APRS Live Tracking Stations in San Fernando, Bukidnon
export const APRS_RESPONDERS = [
  {
    callsign: 'DX1SFB-9',
    name: 'Responder Alpha-01',
    role: 'LDRRMO Ambulance & Quick Response (Halapitan-Kawayan)',
    iconType: 'ambulance',
    lat: 7.9280,
    lng: 125.3200,
    speed: 38, // km/h
    heading: 42, // degrees
    altitude: 462, // meters ASL
    battery: '13.8V',
    frequency: '144.390 MHz',
    path: 'WIDE1-1, WIDE2-1',
    status: 'En Route',
    rawPacket: 'DX1SFB-9>APRS,WIDE1-1,WIDE2-1:=0755.68N/12519.20E>042/038/A=001515 LDRRMO ALPHA DISPATCH',
    barangay: 'Halapitan',
    trail: [
      [7.9186, 125.3286],
      [7.9215, 125.3260],
      [7.9240, 125.3235],
      [7.9265, 125.3215],
      [7.9280, 125.3200],
    ],
    lastHeardSeconds: 12,
  },
  {
    callsign: 'DX1SFB-7',
    name: 'Team Bravo-02',
    role: 'Tigwa River Search & Rescue (4x4)',
    iconType: 'truck',
    lat: 7.9150,
    lng: 125.3260,
    speed: 14,
    heading: 185,
    altitude: 441,
    battery: '12.9V',
    frequency: '144.390 MHz',
    path: 'DIRECT',
    status: 'Patrolling Riverbank',
    rawPacket: 'DX1SFB-7>APRS,DIRECT:=0754.90N/12519.56E>185/014/A=001446 TIGWA RIVER MONITORING CRITICAL',
    barangay: 'Halapitan',
    trail: [
      [7.9220, 125.3280],
      [7.9195, 125.3275],
      [7.9170, 125.3268],
      [7.9150, 125.3260],
    ],
    lastHeardSeconds: 28,
  },
  {
    callsign: 'DX1SFB-1',
    name: 'Unit Charlie-03',
    role: 'Mobile Incident Command & Comms Truck',
    iconType: 'command',
    lat: 7.6930,
    lng: 125.3890,
    speed: 0,
    heading: 310,
    altitude: 512,
    battery: '14.2V (Charging)',
    frequency: '144.390 MHz',
    path: 'WIDE1-1, DIGI-SFB',
    status: 'Stationary / On-Scene Comms',
    rawPacket: 'DX1SFB-1>APRS,WIDE1-1,DIGI-SFB:=0741.58N/12523.34E>310/000/A=001679 ON SCENE KALAGANGAN JCT',
    barangay: 'Kalagangan',
    trail: [
      [7.7100, 125.3850],
      [7.7050, 125.3870],
      [7.6980, 125.3880],
      [7.6930, 125.3890],
    ],
    lastHeardSeconds: 6,
  },
  {
    callsign: 'DX1SFB-10',
    name: 'Delta Rescue-04',
    role: 'Mountain Landslide Search & Recon',
    iconType: 'search',
    lat: 7.9250,
    lng: 125.2980,
    speed: 18,
    heading: 260,
    altitude: 685,
    battery: '12.5V',
    frequency: '144.390 MHz',
    path: 'WIDE2-2',
    status: 'Active Recon',
    rawPacket: 'DX1SFB-10>APRS,WIDE2-2:=0755.50N/12517.88E>260/018/A=002247 DAYAG CLEARING IN PROGRESS',
    barangay: 'Little Baguio',
    trail: [
      [7.9230, 125.3050],
      [7.9240, 125.3020],
      [7.9245, 125.3001],
      [7.9250, 125.2980],
    ],
    lastHeardSeconds: 45,
  },
  {
    callsign: 'SFB-EOC',
    name: 'San Fernando EOC Digipeater',
    role: 'Base Station & VHF APRS Gateway (Halapitan)',
    iconType: 'base',
    lat: 7.9186,
    lng: 125.3286,
    speed: 0,
    heading: 0,
    altitude: 475,
    battery: 'AC Mains + Solar 14.4V',
    frequency: '144.390 MHz / 50W',
    path: 'WIDE1-1',
    status: 'Digipeater Online 24/7',
    rawPacket: 'SFB-EOC>APRS,WIDE1-1:!0755.12N/12519.72E#PHG5430 SAN FERNANDO BUKIDNON LDRRMO EOC',
    barangay: 'Halapitan',
    trail: [],
    lastHeardSeconds: 3,
  },
  {
    callsign: 'WX-SFB01',
    name: 'Halapitan Agro-Met Weather Telemetry',
    role: 'APRS Automated Weather Station',
    iconType: 'weather',
    lat: 7.9210,
    lng: 125.3315,
    speed: 0,
    heading: 315, // Wind dir
    altitude: 480,
    battery: 'Solar 13.9V',
    frequency: '144.390 MHz',
    path: 'WIDE1-1',
    status: 'WX Reporting: Rain 4.2mm/h, Wind 12km/h, Temp 27.5°C',
    rawPacket: 'WX-SFB01>APRS,WIDE1-1:_09061230c315s007g011t081r016p042P042h84b10123 WX BUKIDNON',
    barangay: 'Halapitan',
    trail: [],
    lastHeardSeconds: 20,
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
