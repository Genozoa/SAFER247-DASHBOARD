import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const OperationalDataContext = createContext(null);


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
  const dataSource = 'api';
  const [incidents, setIncidents] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [incidentRecords, messageRecords, officerRecords] = await Promise.all([
        request('/operations/incidents'),
        request('/operations/messages'),
        request('/operations/responders/locations'),
      ]);
      setIncidents(incidentRecords);
      setMessages(messageRecords);
      setOfficers(officerRecords);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [dataSource]);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') refresh(true);
    }, 10000);
    return () => clearInterval(timer);
  }, [dataSource, refresh]);

  const sendMessage = useCallback(async (content) => {
    const trimmed = content.trim();
    if (!trimmed) throw new Error('Message content is required.');

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
    const retriedMessage = await request(`/radio/transmissions/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
    });
    await refresh(true);
    return retriedMessage;
  }, [dataSource, refresh]);

  const value = useMemo(() => ({
    incidents,
    messages,
    officers,
    loading,
    error,
    dataSource,
    refresh,
    sendMessage,
    retryMessage,
  }), [incidents, messages, officers, loading, error, dataSource, refresh, sendMessage, retryMessage]);

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
