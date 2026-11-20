import React, { useState } from 'react';

export default function OperatorProfile() {
  const [open, setOpen] = useState(false);
  const name = 'Operator Alice';

  return (
    <div className="cc-operator" aria-haspopup="true">
      <button
        className="cc-operator-btn"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
      >
        <img src="/images/avatar-placeholder.png" alt="Operator avatar" className="cc-avatar" />
        <span className="cc-operator-name">{name}</span>
      </button>

      {open && (
        <ul className="cc-operator-menu" role="menu">
          <li role="menuitem"><button>Profile</button></li>
          <li role="menuitem"><button>Sign out</button></li>
        </ul>
      )}
    </div>
  );
}
