/* eslint-disable react/prop-types */
import React from 'react';

export default function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="error-banner" role="alert">
      <span className="error-icon">!</span>
      <span>{message}</span>
    </div>
  );
}
