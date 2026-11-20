import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, LogOut } from 'lucide-react';

export default function LogoutControl({ onLogout, buttonClassName, label = 'Log out' }) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setError('');
    setIsSubmitting(true);
    try {
      await onLogout();
      setIsConfirmOpen(false);
    } catch (logoutError) {
      setError(logoutError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setIsConfirmOpen(true)}
        title="Sign out of the operator account"
      >
        <LogOut size={20} />
        <span>{label}</span>
      </button>

      {isConfirmOpen && createPortal(
        <div className="overlay" onClick={() => setIsConfirmOpen(false)}>
          <div
            className="modal confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-dialog-header">
              <div className="confirm-dialog-icon-danger">
                <AlertCircle size={20} />
              </div>
              <h2 className="confirm-dialog-title" id="logout-dialog-title">
                Sign out?
              </h2>
            </div>
            <p className="confirm-dialog-description">
              You will need to sign in again to access the command center.
            </p>
            {error && <p className="auth-alert" role="alert">{error}</p>}
            <div className="confirm-dialog-actions">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="confirm-btn-cancel"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="confirm-btn-danger"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
