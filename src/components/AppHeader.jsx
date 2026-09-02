/* eslint-disable react/prop-types */
import React from 'react';
import { formatClock } from '../format';

export default function AppHeader({ now, leasedCount }) {
  return (
    <header className="topbar app-header">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <span className="dot dot-a" />
          <span className="dot dot-b" />
          <span className="dot dot-c" />
        </div>
        <div className="brand-text">
          <h1 className="brand-title">burner<span className="brand-slash">/</span>sms</h1>
          <div className="brand-sub subtitle">Disposable SMS for OTP verification</div>
        </div>
      </div>
      <div className="topbar-meta">
        <span className="meta-pill mono">{formatClock(now)}</span>
        <span className="meta-pill subtle">{leasedCount} leased number{leasedCount === 1 ? '' : 's'}</span>
      </div>
    </header>
  );
}
