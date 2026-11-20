import { DEMO_INCIDENTS, DEMO_MESSAGES } from './demoData.js';

// Replace this module with the trusted DRRMO data provider when it is available.
// The UI imports operational records from here and never silently falls back to demo data.
export const DATA_SOURCE = 'demo';
export const INCIDENTS = DEMO_INCIDENTS;
export const MESSAGES = DEMO_MESSAGES;
export const LIVE_OFFICERS = [];

export function getOperationalDataSource(callSign, configuredSource = '') {
  if (String(callSign || '').trim().toUpperCase() === 'ALPHA-1') {
    return 'demo';
  }
  return String(configuredSource || '').trim().toLowerCase() || 'api';
}

export function createDemoOutgoingMessage(content, callSign, sequence, sentAt = new Date().toISOString()) {
  return {
    id: `demo-composed-${Date.now()}-${sequence}`,
    sender: `${callSign || 'Demo Operator'} (Demo)`,
    recipient: 'Field Responders',
    isOutgoing: true,
    content,
    sentAt,
    status: 'sample',
    dataSource: 'demo',
  };
}
