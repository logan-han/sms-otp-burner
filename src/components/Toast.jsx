/* eslint-disable react/prop-types */
import React from 'react';
import { IconCheck } from '../icons';

export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="toast" key={toast.ts}>
      <IconCheck size={14} />
      <span className="mono">{toast.text}</span>
    </div>
  );
}
