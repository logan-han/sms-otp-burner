import React from 'react';

export default function LoadingState() {
  return (
    <div className="loading-initial">
      <div className="loading-spinner-large">...</div>
      <h2>Setting up your virtual numbers</h2>
      <p>Checking recent SMS.</p>
    </div>
  );
}
