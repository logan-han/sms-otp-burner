/* eslint-disable react/prop-types */
import React from 'react';
import { IconCheck, IconCopy } from '../icons';
import { extractOtp } from '../otp';
import { formatRelative } from '../format';

export default function MessageCard({ message, recipientDisplay, copiedKey, onOpen, onCopyOtp }) {
  const otp = extractOtp(message.body);
  return (
    <article
      className={`card message-row${otp ? ' has-otp' : ' no-otp'}`}
      onClick={() => onOpen(message.id)}
    >
      <header className="card-head">
        <div className="card-from"><span className="card-from-name">{message.from}</span></div>
        <span className="card-time mono">{formatRelative(message.receivedAt)}</span>
      </header>

      <div className="card-main">
        {otp && (
          <button
            type="button"
            className="card-otp"
            onClick={(event) => { event.stopPropagation(); onCopyOtp(otp.digits, `card-${message.id}`); }}
            title="Click to copy"
          >
            <span className="card-otp-digits mono">
              {otp.digits.split('').map((digit, index) => (
                <span key={index} className="card-otp-digit">{digit}</span>
              ))}
            </span>
            <span className="card-otp-action">
              {copiedKey === `card-${message.id}`
                ? <><IconCheck size={13} /> copied</>
                : <><IconCopy size={13} /> copy</>}
            </span>
          </button>
        )}

        <p className="card-body message-cell">{message.body}</p>
      </div>
      <footer className="card-foot">
        <span className="card-to mono">to {recipientDisplay}</span>
      </footer>
    </article>
  );
}
