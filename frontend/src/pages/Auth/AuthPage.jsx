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
  const [registrationCode, setRegistrationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
        await register(callSign.trim(), password, registrationCode);
        navigate('/login', { replace: true, state: { registrationSubmitted: true } });
        return;
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
            ? 'Access requests require an in-person developer code and administrator approval.'
            : 'Sign in to access the SAFER 247 command center.'}
        </p>

        {isRegister && <div className="auth-warning" role="note">Authorized San Fernando LDRRMO personnel only. Keep your code and password private. Registration requires administrator approval.</div>}
        {!isRegister && location.state?.registrationSubmitted && <div className="auth-notice" role="status">Registration submitted. An administrator must approve your account before sign-in.</div>}
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
            placeholder="Enter your call sign"
            required
            value={callSign}
            onChange={(event) => setCallSign(event.target.value)}
          />

          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={isRegister ? 8 : undefined}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button className="auth-toggle" type="button" aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}>{showPassword ? 'Hide password' : 'Show password'}</button>

          {isRegister && (
            <>
              <label htmlFor="auth-confirm-password">Confirm password</label>
              <input
                id="auth-confirm-password"
                name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm your password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              <button className="auth-toggle" type="button" aria-pressed={showConfirm} onClick={() => setShowConfirm((v) => !v)}>{showConfirm ? 'Hide confirmation' : 'Show confirmation'}</button>
              <label htmlFor="auth-registration-code">Personnel registration code</label>
              <input id="auth-registration-code" type="password" autoComplete="off"
                placeholder="Code supplied in person" maxLength={256} required
                value={registrationCode} onChange={(event) => setRegistrationCode(event.target.value)} />
              <p className="auth-hint">
                Use at least 8 characters with uppercase and lowercase letters, a number, and a symbol.
              </p>
            </>
          )}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting
              ? 'Please wait…'
              : isRegister
                ? 'Request account'
                : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : 'Authorized personnel without an account?'}{' '}
          <Link to={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Sign in' : 'Register'}
          </Link>
        </p>
      </section>
    </main>
  );
}
