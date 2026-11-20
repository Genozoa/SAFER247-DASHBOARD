import { isWithinDateRange, normalizeBarangay } from '../data/referenceData.js';

export function getIncidentCoordinates(incident) {
  const rawLatitude = incident?.lat;
  const rawLongitude = incident?.lng;
  if (
    (typeof rawLatitude !== 'number' && typeof rawLatitude !== 'string')
    || (typeof rawLongitude !== 'number' && typeof rawLongitude !== 'string')
    || !String(rawLatitude).trim()
    || !String(rawLongitude).trim()
  ) {
    return null;
  }
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return [latitude, longitude];
}

export function getIncidentHeatmapPoints(incidents = []) {
  return incidents.flatMap((incident) => {
    const coordinates = getIncidentCoordinates(incident);
    return coordinates ? [[...coordinates, 1]] : [];
  });
}

export function getIncidentCountsByBarangay(incidents = []) {
  const counts = new Map();
  incidents.forEach((incident) => {
    if (!getIncidentCoordinates(incident)) return;
    const barangay = normalizeBarangay(incident.barangay);
    if (!barangay) return;
    counts.set(barangay, (counts.get(barangay) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([barangay, count]) => ({ barangay, count }))
    .sort((a, b) => b.count - a.count || a.barangay.localeCompare(b.barangay));
}

export function filterIncidentRecords(incidents, {
  dateRange = 'All Time',
  type = 'All Types',
  barangay = 'All Barangays',
  searchQuery = '',
} = {}) {
  const query = searchQuery.trim().toLocaleLowerCase();
  return incidents.filter((incident) => {
    if (type !== 'All Types' && type !== 'All types' && incident.type?.toLocaleLowerCase() !== type.toLocaleLowerCase()) {
      return false;
    }
    if (barangay !== 'All Barangays' && barangay !== 'All 24 barangays'
      && normalizeBarangay(incident.barangay).toLocaleLowerCase() !== normalizeBarangay(barangay).toLocaleLowerCase()) {
      return false;
    }
    if (!isWithinDateRange(incident.date, dateRange)) return false;
    if (!query) return true;
    return [
      incident.id,
      incident.sender,
      incident.type,
      incident.barangay,
      incident.location,
      incident.text,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(query));
  });
}
