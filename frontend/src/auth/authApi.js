function errorMessage(detail, status) {
  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => item?.msg)
      .filter((message) => typeof message === 'string');
    if (messages.length) return messages.join(' ');
  }

  if (status >= 500) {
    return `Authentication service is unavailable (HTTP ${status}). Check that the backend API is running.`;
  }
  return `Authentication request failed (HTTP ${status}).`;
}

export async function authRequest(
  apiBase,
  path,
  { method = 'GET', body } = {},
  fetchImplementation = fetch,
) {
  let response;
  try {
    response = await fetchImplementation(`${apiBase}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        'Cannot reach the authentication service. Check that the backend API is running.',
      );
    }
    throw error;
  }

  if (response.status === 204) return null;

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(errorMessage(result?.detail, response.status));
  }
  return result;
}
