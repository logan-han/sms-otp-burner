/* eslint-disable react/prop-types */
import React from 'react';
import { IconCheck, IconCopy, IconX } from '../icons';
import { extractOtp } from '../otp';

export default function MessageModal({ message, recipientDisplay, copiedKey, onClose, onCopyOtp }) {
  if (!message) return null;
  const otp = extractOtp(message.body);
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-head">
          <div>
            <div className="modal-from-name">{message.from}</div>
            <div className="modal-from-meta mono">
              to {recipientDisplay} . {new Date(message.receivedAt).toLocaleString()}
            </div>
          </div>
          <div className="modal-actions">
            <button className="icon-btn" onClick={onClose} title="Close"><IconX size={14} /></button>
          </div>
        </header>
        <div className="modal-body">
          <div className="paper">{message.body}</div>
          {otp && (
            <div className="otp-hero">
              <div className="otp-hero-label">detected one-time code</div>
              <div className="otp-hero-row">
                <div className="otp-hero-digits mono">
                  {otp.digits.split('').map((digit, index) => (
                    <span key={index} className="otp-hero-digit">{digit}</span>
                  ))}
                </div>
                <button className="btn btn-primary" onClick={() => onCopyOtp(otp.digits, `modal-${message.id}`)}>
                  {copiedKey === `modal-${message.id}`
                    ? <><IconCheck size={14} /> copied</>
                    : <><IconCopy size={14} /> copy code</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
