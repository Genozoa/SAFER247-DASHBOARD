import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { authRequest } from '../../auth/authApi.js';
import LogoutControl from '../../components/common/LogoutControl';
import { useOperationalData } from '../../data/OperationalDataContext';
import { createRadioClient } from '../../../../backend/app/radio_lab/frontend/client.js';

const radioClient = createRadioClient(import.meta.env.VITE_API_BASE_URL || '/api');

function receiverStateLabel(dataSource, worker, requestError) {
  if (dataSource === 'demo') return 'Unavailable in demo mode';
  if (requestError) return 'Status unavailable';
  if (!worker) return 'Checking…';
  if (worker.state === 'running') {
    if (worker.input_state === 'disabled') return 'Input disabled';
    if (worker.input_state === 'error') return 'Input error';
    if (worker.input_state === 'degraded') return 'Input degraded';
    if (worker.output_error || worker.codec_errors?.length) return 'Degraded';
    return worker.input_state === 'listening' ? 'Listening' : 'Running';
  }
  if (worker.state === 'disabled') return 'Disabled';
  if (worker.state === 'stale') return 'Status stale';
  if (worker.state === 'error') return 'Error';
  if (worker.state === 'not-managed') return 'Not managed';
  return 'Starting…';
}

function receiverBadgeState(worker, requestError) {
  if (requestError || worker?.state === 'error' || worker?.state === 'stale'
    || worker?.input_state === 'error') {
    return 'error';
  }
  if (worker?.codec_errors?.length || worker?.output_error || worker?.input_state === 'degraded') {
    return 'degraded';
  }
  if (worker?.state === 'running' && worker.input_state === 'disabled') {
    return 'disabled';
  }
  return worker?.state || 'unknown';
}

export default function SettingsPage() {
  const { operator, updateCallSign, logout } = useAuth();
  const { dataSource } = useOperationalData();
  const isDemo = operator.call_sign === 'Demo';
  const [accounts, setAccounts] = useState([]);
  const [adminError, setAdminError] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [rolesDraft, setRolesDraft] = useState({});
  const [callSign, setCallSign] = useState(operator.call_sign);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isSavingCallSign, setIsSavingCallSign] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [radioStatus, setRadioStatus] = useState(null);
  const [radioStatusError, setRadioStatusError] = useState('');
  const saveButtonRef = useRef(null);
  const workerStatus = radioStatus?.worker;
  const receiverErrors = [
    radioStatusError,
    workerStatus?.error,
    workerStatus?.input_error,
    workerStatus?.output_error,
    ...(workerStatus?.codec_errors || []),
  ].filter(Boolean);
  const fallbackReasons = [
    workerStatus?.input_fallback_reason,
    workerStatus?.output_fallback_reason,
  ].filter(Boolean);

  useEffect(() => {
    if (dataSource !== 'api' || isDemo) {
      setRadioStatus(null);
      setRadioStatusError('');
      return undefined;
    }

    const controller = new AbortController();
    let timer;
    let disposed = false;
    const refreshStatus = async () => {
      try {
        const status = await radioClient.status(controller.signal);
        if (!disposed) {
          setRadioStatus(status);
          setRadioStatusError('');
        }
      } catch (error) {
        if (!disposed && error.name !== 'AbortError') {
          setRadioStatusError(error.message);
        }
      } finally {
        if (!disposed) timer = setTimeout(refreshStatus, 3000);
      }
    };

    refreshStatus();
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [dataSource, isDemo]);

  useEffect(() => {
    if (operator.role !== 'admin') return;
    let active = true;
    authRequest(import.meta.env.VITE_API_BASE_URL || '/api', '/auth/operators')
      .then((result) => { if (active) setAccounts(result); })
      .catch((error) => { if (active) setAdminError(error.message); });
    return () => { active = false; };
  }, [operator.role]);

  async function updateOperatorAccount(account, changes) {
    setAdminBusy(true);
    setAdminError('');
    try {
      const updated = await authRequest(import.meta.env.VITE_API_BASE_URL || '/api',
        `/auth/operators/${encodeURIComponent(account.id)}`, {
          method: 'PATCH', body: changes,
        });
      setAccounts((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setAdminBusy(false);
    }
  }

  function handleCallSignSubmit(event) {
    event.preventDefault();
    setProfileMessage('');
    setProfileError('');
    if (callSign.trim() === operator.call_sign) {
      setCallSign(operator.call_sign);
      setProfileMessage('Your call sign is unchanged.');
      return;
    }
    setIsConfirmOpen(true);
  }

  function handleCallSignBlur(event) {
    if (event.relatedTarget !== saveButtonRef.current) {
      setCallSign(operator.call_sign);
    }
  }

  function cancelCallSignChange() {
    setCallSign(operator.call_sign);
    setProfileError('');
    setIsConfirmOpen(false);
  }

  async function handleCallSignConfirm() {
    setProfileMessage('');
    setProfileError('');
    setIsSavingCallSign(true);
    try {
      const updatedOperator = await updateCallSign(callSign.trim());
      setCallSign(updatedOperator.call_sign);
      setProfileMessage('Your call sign has been updated.');
      setIsConfirmOpen(false);
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setIsSavingCallSign(false);
    }
  }

  return (
    <div className="page settings">
      {/* Card 1: Radio & APRS */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Radio &amp; APRS</h3>
          <p>Receiver and audio device status</p>
        </div>
        <div className="settings-card-body">
          <div className="settings-row">
            <span className="settings-row-label">APRS frequency</span>
            <span className="settings-freq-value">Not configured</span>
          </div>

          <div className="settings-row">
            <span className="settings-row-label">Receiver</span>
            <div className="settings-row-value">
              <span
                className="settings-status-badge"
                data-state={receiverBadgeState(workerStatus, radioStatusError)}
              >
                {receiverStateLabel(dataSource, workerStatus, radioStatusError)}
              </span>
            </div>
          </div>

          {receiverErrors.map((error) => (
            <p key={error} className="settings-radio-error" role="status">{error}</p>
          ))}

          <div className="settings-row">
            <span className="settings-row-label">Active input</span>
            <span className="settings-row-value">
              {dataSource === 'demo'
                ? 'Unavailable in demo mode'
                : workerStatus?.input_state === 'disabled'
                  ? 'Disabled'
                : radioStatus?.worker?.input_device || 'Not selected'}
            </span>
          </div>

          <div className="settings-row">
            <span className="settings-row-label">Active output</span>
            <span className="settings-row-value">
              {dataSource === 'demo'
                ? 'Unavailable in demo mode'
                : workerStatus?.output_state === 'disabled'
                  ? 'Disabled'
                : radioStatus?.worker?.output_device || 'Not selected'}
            </span>
          </div>

          {fallbackReasons.map((reason) => (
            <p key={reason} className="settings-radio-note">{reason}</p>
          ))}

          <div className="settings-row">
            <span className="settings-row-label">Beacon</span>
            <span className="settings-row-value">Not configured</span>
          </div>
        </div>
      </div>

      {/* Card 2: Command Center */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Command Center</h3>
          <p>Coverage and operator on duty</p>
        </div>
        <div className="settings-card-body">
          <div className="settings-row">
            <span className="settings-row-label">Municipality</span>
            <span className="settings-row-value">San Fernando, Bukidnon · 24 barangays</span>
          </div>

          <div className="settings-row">
            <span className="settings-row-label">Office</span>
            <span className="settings-row-value">LDRRMO SAFER 24/7</span>
          </div>

          <div className="settings-row">
            <span className="settings-row-label">Operator on duty</span>
            <div className="settings-row-value">
              <div className="settings-operator-info">
                <span className="settings-avatar" aria-hidden="true">
                  {operator.call_sign.slice(0, 2).toUpperCase()}
                </span>
                <span className="settings-operator-name">{operator.call_sign}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operator Profile */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Operator Profile</h3>
          <p>Your call sign is used throughout the command center.</p>
        </div>
        <form className="settings-card-body settings-profile-form" onSubmit={handleCallSignSubmit}>
          <label htmlFor="settings-call-sign">Call sign</label>
          <input
            id="settings-call-sign"
            name="callSign"
            value={callSign}
            maxLength={64}
            required
            onBlur={handleCallSignBlur}
            onChange={(event) => setCallSign(event.target.value)}
          />
          {profileMessage && <p className="account-success" role="status">{profileMessage}</p>}
          {profileError && <p className="auth-alert" role="alert">{profileError}</p>}
          <button ref={saveButtonRef} type="submit" className="settings-save-btn" disabled={isSavingCallSign}>
            {isSavingCallSign ? 'Saving…' : 'Save call sign'}
          </button>
        </form>
      </div>

      {operator.role === 'admin' && (
        <div className="settings-card">
          <div className="settings-card-header">
            <h3>Personnel access approvals</h3>
            <p>Approve verified LDRRMO staff and manage account privileges.</p>
          </div>
          <div className="settings-card-body">
            {adminError && <p className="auth-alert" role="alert">{adminError}</p>}
            {accounts.map((account) => (
              <div key={account.id} className="settings-row">
                <div className="settings-row-label">
                  <strong>{account.call_sign}</strong>
                  <span> {account.approved ? 'Approved' : 'Awaiting approval'}</span>
                </div>
                <div className="settings-row-value">
                  <select aria-label={`Role for ${account.call_sign}`}
                    value={rolesDraft[account.id] || account.role}
                    onChange={(event) => setRolesDraft((previous) => ({ ...previous, [account.id]: event.target.value }))}>
                    <option value="viewer">Viewer</option>
                    <option value="operator">Operator</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <button type="button" className="settings-save-btn" disabled={adminBusy}
                    onClick={() => updateOperatorAccount(account, { role: rolesDraft[account.id] || account.role })}>
                    Save role
                  </button>
                  <button type="button" className="settings-save-btn" disabled={adminBusy || account.id === operator.id}
                    onClick={() => updateOperatorAccount(account, { approved: !account.approved })}>
                    {account.approved ? 'Revoke access' : 'Approve account'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session */}
      <div className="settings-card">
        <div className="settings-session-card">
          <div className="settings-session-info">
            <h3>Session</h3>
            <p>Signed in as {operator.call_sign}</p>
          </div>
          <LogoutControl
            onLogout={logout}
            buttonClassName="settings-logout-btn"
          />
        </div>
      </div>

      {isConfirmOpen && createPortal(
        <div
          className="overlay"
          onClick={() => {
            if (!isSavingCallSign) cancelCallSignChange();
          }}
        >
          <div
            className="modal confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="call-sign-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-dialog-header">
              <div className="confirm-dialog-icon-danger">
                <AlertCircle size={20} />
              </div>
              <h2 className="confirm-dialog-title" id="call-sign-dialog-title">
                Confirm call sign change
              </h2>
            </div>
            <p className="confirm-dialog-description">
              Change your call sign from <strong>{operator.call_sign}</strong> to{' '}
              <strong>{callSign.trim()}</strong>?
            </p>
            {profileError && <p className="auth-alert" role="alert">{profileError}</p>}
            <div className="confirm-dialog-actions">
              <button
                type="button"
                onClick={cancelCallSignChange}
                className="confirm-btn-cancel"
                disabled={isSavingCallSign}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCallSignConfirm}
                className="confirm-btn-danger"
                disabled={isSavingCallSign}
              >
                {isSavingCallSign ? 'Saving…' : 'Confirm change'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
