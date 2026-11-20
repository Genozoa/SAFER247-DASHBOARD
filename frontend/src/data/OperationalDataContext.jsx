import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  INCIDENTS as DEMO_INCIDENTS,
  MESSAGES as DEMO_MESSAGES,
  createDemoOutgoingMessage,
  getOperationalDataSource,
} from './operationalData.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const CONFIGURED_DATA_SOURCE = import.meta.env.VITE_OPERATIONAL_DATA_SOURCE || '';
const OperationalDataContext = createContext(null);

let demoMessageSequence = 0;

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: options?.body
      ? { 'Content-Type': 'application/json', ...options.headers }
      : options?.headers,
  });
  const result = response.status === 204
    ? null
    : await response.json().catch(() => null);

  if (!response.ok) {
    const detail = typeof result?.detail === 'string' ? result.detail : null;
    throw new Error(detail || `Operational API request failed (${response.status}).`);
  }
  return result;
}

export function OperationalDataProvider({ children, operator }) {
  const dataSource = getOperationalDataSource(
    operator?.call_sign,
    CONFIGURED_DATA_SOURCE,
  );
  const [incidents, setIncidents] = useState(
    dataSource === 'demo' ? DEMO_INCIDENTS : [],
  );
  const [messages, setMessages] = useState(
    dataSource === 'demo' ? DEMO_MESSAGES : [],
  );
  const [loading, setLoading] = useState(dataSource === 'api');
  const [error, setError] = useState('');

  const refresh = useCallback(async (silent = false) => {
    if (dataSource === 'demo') return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const [incidentRecords, messageRecords] = await Promise.all([
        request('/operations/incidents'),
        request('/operations/messages'),
      ]);
      setIncidents(incidentRecords);
      setMessages(messageRecords);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [dataSource]);

  useEffect(() => {
    if (dataSource === 'demo') return undefined;
    refresh();
    const timer = setInterval(() => refresh(true), 2500);
    return () => clearInterval(timer);
  }, [dataSource, refresh]);

  const sendMessage = useCallback(async (content) => {
    const trimmed = content.trim();
    if (!trimmed) throw new Error('Message content is required.');

    if (dataSource === 'demo') {
      const demoMessage = createDemoOutgoingMessage(
        trimmed,
        operator?.call_sign,
        ++demoMessageSequence,
      );
      setMessages((current) => [...current, demoMessage]);
      return demoMessage;
    }

    const queuedMessage = await request('/operations/messages', {
      method: 'POST',
      body: JSON.stringify({ content: trimmed }),
    });
    setMessages((current) => [
      ...current.filter((message) => message.id !== queuedMessage.id),
      queuedMessage,
    ]);
    return queuedMessage;
  }, [dataSource, operator?.call_sign]);

  const retryMessage = useCallback(async (id) => {
    if (dataSource === 'demo') {
      throw new Error('Demo messages are local-only and cannot be retried or transmitted.');
    }
    const retriedMessage = await request(`/radio/transmissions/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
    });
    await refresh(true);
    return retriedMessage;
  }, [dataSource, refresh]);

  const value = useMemo(() => ({
    incidents,
    messages,
    loading,
    error,
    dataSource,
    refresh,
    sendMessage,
    retryMessage,
  }), [incidents, messages, loading, error, dataSource, refresh, sendMessage, retryMessage]);

  if (dataSource !== 'demo' && dataSource !== 'api') {
    throw new Error('VITE_OPERATIONAL_DATA_SOURCE must be "demo" or "api".');
  }

  return (
    <OperationalDataContext.Provider value={value}>
      {children}
    </OperationalDataContext.Provider>
  );
}

export function useOperationalData() {
  const context = useContext(OperationalDataContext);
  if (!context) {
    throw new Error('useOperationalData must be used within OperationalDataProvider.');
  }
  return context;
}
