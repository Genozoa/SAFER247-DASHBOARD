import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authRequest } from './authApi.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const AuthContext = createContext(null);
const request = (path, options) => authRequest(API_BASE, path, options);

export function AuthProvider({ children }) {
  const [operator, setOperator] = useState(null);
  const [ready, setReady] = useState(false);
  const [serviceError, setServiceError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const currentOperator = await request('/auth/me');
      setOperator(currentOperator);
      setServiceError('');
    } catch (error) {
      if (error.message === 'Authentication required.') {
        setOperator(null);
        setServiceError('');
      } else {
        setOperator(null);
        setServiceError(error.message);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (callSign, password) => {
    const authenticatedOperator = await request('/auth/login', {
      method: 'POST',
      body: { call_sign: callSign, password },
    });
    setOperator(authenticatedOperator);
    setServiceError('');
  }, []);

  const register = useCallback(async (callSign, password) => {
    const authenticatedOperator = await request('/auth/register', {
      method: 'POST',
      body: {
        call_sign: callSign,
        password,
      },
    });
    setServiceError('');
    return authenticatedOperator;
  }, []);

  const logout = useCallback(async () => {
    await request('/auth/logout', { method: 'POST' });
    setOperator(null);
  }, []);

  const updateCallSign = useCallback(async (callSign) => {
    const updatedOperator = await request('/auth/me/call-sign', {
      method: 'PATCH',
      body: { call_sign: callSign },
    });
    setOperator(updatedOperator);
    return updatedOperator;
  }, []);

  const value = useMemo(() => ({
    operator,
    ready,
    serviceError,
    login,
    register,
    logout,
    updateCallSign,
  }), [operator, ready, serviceError, login, register, logout, updateCallSign]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
