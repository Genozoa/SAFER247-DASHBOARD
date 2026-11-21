import { BARANGAY_CENTROIDS } from '../../src/data/sanFernandoBoundary.js';

const daysAgo = (days, hour = 10, minute = 30) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

const incident = (
  id,
  type,
  barangay,
  location,
  lat,
  lng,
  days,
  severity,
  text,
  hasImage = false,
  options = {},
) => {
  const date = daysAgo(days, options.hour, options.minute);
  return {
    id: `DEMO-${id}`,
    type,
    sender: `Sample Responder ${String((id % 4) + 1).padStart(2, '0')}`,
    barangay,
    location,
    lat,
    lng,
    coordinates: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    date,
    time: new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    text,
    hasImage,
    status: options.status || (days < 2 ? 'Monitoring' : 'Closed'),
    severity,
    dataSource: 'demo',
  };
};

const incidentAtCentroid = (id, type, barangay, days, severity, text, options = {}) => {
  const [latitude, longitude] = BARANGAY_CENTROIDS[barangay];
  return incident(
    id,
    type,
    barangay,
    options.location || `Sample ${type.toLowerCase()} location`,
    latitude,
    longitude,
    days,
    severity,
    text,
    options.hasImage || false,
    options,
  );
};

export const DEMO_INCIDENTS = [
  incident(1, 'Flood', 'Halapitan', 'Sample river monitoring point', 7.9186, 125.3286, 0, 'High', 'Fictional rising-water observation for interface testing.'),
  {
    ...incident(2, 'Fire', 'Kawayan', 'Sample residential area', 7.8998, 125.3920, 0, 'Critical', 'Fictional structure-fire report for interface testing.', true),
    imageName: 'DEMO fire-scene illustration',
    imageUrl: '/images/demo-fire-evidence.svg',
  },
  incident(3, 'Medical', 'Namnam', 'Sample community access road', 7.8382, 125.3906, 1, 'Moderate', 'Fictional medical-assistance request for interface testing.'),
  incident(4, 'Vehicular Accident', 'Kalagangan', 'Sample provincial road', 7.7132, 125.3602, 1, 'High', 'Fictional road-incident report for interface testing.'),
  {
    ...incident(5, 'Landslide', 'Little Baguio', 'Sample hillside road', 7.9199, 125.2880, 2, 'High', 'Fictional slope-observation report for interface testing.', true),
    imageName: 'DEMO landslide-scene illustration',
    imageUrl: '/images/demo-landslide-evidence.svg',
  },
  incident(6, 'Flood', 'Cabuling', 'Sample creek crossing', 7.6686, 125.3761, 3, 'Moderate', 'Fictional water-level observation for interface testing.'),
  incident(7, 'Fire', 'Bonacao', 'Sample commercial area', 7.8037, 125.4007, 4, 'Moderate', 'Fictional small-fire report for interface testing.'),
  incident(8, 'Medical', 'Mabuhay', 'Sample barangay center', 7.8865, 125.3582, 5, 'Low', 'Fictional request for medical assistance for interface testing.'),
  incident(9, 'Vehicular Accident', 'Kibongcog', 'Sample highway curve', 7.8548, 125.3138, 6, 'Moderate', 'Fictional road-safety report for interface testing.'),
  incident(10, 'Landslide', 'Nacabuklad', 'Sample upland access route', 7.9639, 125.3491, 8, 'High', 'Fictional roadside slope observation for interface testing.'),
  incident(11, 'Flood', 'Tugop', 'Sample drainage area', 7.9721, 125.3172, 10, 'Low', 'Fictional drainage observation for interface testing.'),
  incident(12, 'Fire', 'Dao', 'Sample residential block', 7.7902, 125.3416, 12, 'Moderate', 'Fictional smoke report for interface testing.'),
  incident(13, 'Medical', 'San Jose', 'Sample barangay road', 7.7521, 125.4117, 15, 'Moderate', 'Fictional first-aid request for interface testing.'),
  incident(14, 'Vehicular Accident', 'Candelaria', 'Sample local road', 7.9259, 125.3802, 18, 'Low', 'Fictional minor road-incident report for interface testing.'),
  incident(15, 'Flood', 'Santo Domingo', 'Sample low-lying area', 7.7733, 125.4050, 22, 'Moderate', 'Fictional localized-flood observation for interface testing.'),
  incident(16, 'Landslide', 'Malayanan', 'Sample hillside trail', 7.9605, 125.2909, 25, 'Low', 'Fictional terrain-observation report for interface testing.'),
  incident(17, 'Fire', 'Palacpacan', 'Sample roadside area', 7.7934, 125.3731, 28, 'Low', 'Fictional fire-response record for interface testing.'),
  {
    ...incident(18, 'Medical', 'Durian', 'Sample remote location', 7.6422, 125.3463, 30, 'Low', 'Fictional medical request with unavailable coordinates for interface testing.'),
    lat: null,
    lng: null,
    coordinates: '',
    hasImage: true,
    imageName: 'DEMO first-aid-kit illustration',
    imageUrl: '/images/demo-medical-evidence.svg',
  },
  incidentAtCentroid(19, 'Fire', 'Bulalang', 0, 'Critical', 'DEMO: Smoke report near the sample community hall. No real response is required.', { hour: 20, minute: 10 }),
  incidentAtCentroid(20, 'Flood', 'Cayaga', 1, 'High', 'DEMO: Sample creek level is rising after rainfall; monitor the fictional crossing.', { hour: 14, minute: 40 }),
  incidentAtCentroid(21, 'Medical', 'Iglugsad', 3, 'Moderate', 'DEMO: Sample first-aid request for practicing report triage.', { hour: 9, minute: 5 }),
  incidentAtCentroid(22, 'Vehicular Accident', 'Magkalungay', 5, 'High', 'DEMO: Two-vehicle road incident for practicing map selection and report filters.', { hour: 16, minute: 25 }),
  incidentAtCentroid(23, 'Landslide', 'Matupe', 12, 'Moderate', 'DEMO: Sample roadside debris report for practicing historical searches.', { hour: 7, minute: 50 }),
  incidentAtCentroid(24, 'Flood', 'Sacramento Valley', 24, 'Low', 'DEMO: Closed historical drainage observation for practicing monthly reports.', { hour: 11, minute: 15 }),
];

const messageTime = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const incidentsById = new Map(DEMO_INCIDENTS.map((item) => [item.id, item]));

const demoMessage = (id, minutesAgo, sender, isOutgoing, content, incidentReportId) => {
  const incidentRecord = !isOutgoing && incidentReportId
    ? incidentsById.get(`DEMO-${incidentReportId}`)
    : null;
  return {
    id: `demo-message-${String(id).padStart(3, '0')}`,
    sender,
    recipient: isOutgoing ? 'Field Responders' : 'Alpha-1 (Demo)',
    isOutgoing,
    ...(incidentRecord && {
      type: incidentRecord.type,
      incidentReport: {
        code: incidentRecord.id,
        type: incidentRecord.type,
        location: `${incidentRecord.location}, ${incidentRecord.barangay}`,
        coordinates: incidentRecord.coordinates,
        details: incidentRecord.text,
      },
    }),
    content,
    sentAt: messageTime(minutesAgo),
    status: 'sample',
    dataSource: 'demo',
  };
};

export const DEMO_MESSAGES = [
  demoMessage(1, 360, 'Sample Responder 01', false, 'DEMO: Water-level observation received at the sample river point.', 1),
  demoMessage(2, 342, 'Alpha-1 (Demo)', true, 'DEMO: Acknowledge the sample flood report; this message was not transmitted.'),
  demoMessage(3, 318, 'Sample Responder 02', false, 'DEMO: Smoke visible near the sample residential area.', 2),
  demoMessage(4, 276, 'Sample Responder 03', false, 'DEMO: Requesting assistance for the sample road incident.', 4),
  demoMessage(5, 252, 'Alpha-1 (Demo)', true, 'DEMO: Units in this training scenario should check in using the message composer.'),
  demoMessage(6, 216, 'Sample Responder 04', false, 'DEMO: Debris reported on the sample hillside route.', 5),
  demoMessage(7, 180, 'Sample Responder 01', false, 'DEMO: Creek level remains under observation.'),
  demoMessage(8, 144, 'Sample Responder 02', false, 'DEMO: First-aid request received for the sample community center.', 8),
  demoMessage(9, 108, 'Alpha-1 (Demo)', true, 'DEMO: This sample dispatch stays local and is not sent to the radio queue.'),
  demoMessage(10, 78, 'Sample Responder 03', false, 'DEMO: Small smoke report; sample incident is under monitoring.', 7),
  demoMessage(11, 42, 'Alpha-1 (Demo)', true, 'DEMO: Practice searching messages by sender, type, and date.'),
  demoMessage(12, 12, 'Sample Responder 04', false, 'DEMO: Sample responder check-in for the messaging feed.'),
];
