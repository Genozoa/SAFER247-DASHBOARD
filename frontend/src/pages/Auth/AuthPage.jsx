import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import './auth.css';

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isRegister = location.pathname === '/register';
  const { operator, login, register, serviceError } = useAuth();
  const [callSign, setCallSign] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (operator) return <Navigate to="/" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await register(callSign.trim(), password);
      } else {
        await login(callSign.trim(), password);
      }
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <img
          src="/images/LDRRMO_SAFER247_Logo.svg"
          alt="SAFER 247"
          className="auth-logo"
        />
        <p className="auth-eyebrow">SAN FERNANDO DRRMO</p>
        <h1 id="auth-title">{isRegister ? 'Create operator account' : 'Operator sign in'}</h1>
        <p className="auth-description">
          {isRegister
            ? 'Register with your call sign.'
            : 'Sign in to access the SAFER 247 command center.'}
        </p>

        {(serviceError || error) && (
          <div className="auth-alert" role="alert">{error || serviceError}</div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="auth-call-sign">Call sign</label>
          <input
            id="auth-call-sign"
            name="callSign"
            autoComplete="username"
            maxLength={64}
            required
            value={callSign}
            onChange={(event) => setCallSign(event.target.value)}
          />

          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={isRegister ? 8 : undefined}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {isRegister && (
            <>
              <label htmlFor="auth-confirm-password">Confirm password</label>
              <input
                id="auth-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <p className="auth-hint">
                Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.
              </p>
            </>
          )}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting
              ? 'Please wait…'
              : isRegister
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? 'Already registered?' : 'New operator?'}{' '}
          <Link to={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Sign in' : 'Register'}
          </Link>
        </p>
      </section>
    </main>
  );
}
