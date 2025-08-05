import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_BASE_URL = process.env.NODE_ENV === 'development' ? '/api' : '/api';

function App() {
  const [copiedNumber, setCopiedNumber] = useState(null);
  const [leasedNumbers, setLeasedNumbers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasCheckedNumbers, setHasCheckedNumbers] = useState(false);

  const handleCopyNumber = (number) => {
    navigator.clipboard.writeText(number);
    setCopiedNumber(number);
    setTimeout(() => {
      setCopiedNumber(null);
    }, 2000);
  };

  const handleError = (message, err) => {
    console.error(message, err);
    setError(`${message}. ${err?.response?.data?.message || err?.message || ''}`);
    setIsLoading(false);
  };

  const fetchCurrentNumber = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/virtual-numbers`);
      if (response && response.ok) {
        const data = await response.json();
        setHasCheckedNumbers(true);
        if (data.virtualNumbers && data.virtualNumbers.length > 0) {
          const activeNumbers = data.virtualNumbers.filter(num => 
            new Date(num.expiryDate) > new Date()
          );
          setLeasedNumbers(activeNumbers);
          return { success: true, hasNumbers: activeNumbers.length > 0, numbers: activeNumbers };
        }
        setLeasedNumbers([]);
        return { success: true, hasNumbers: false };
      } else if (response && response.status !== 404) {
        const errData = await response.json().catch(() => ({ message: response.statusText }));
        setHasCheckedNumbers(true);
        handleError('Failed to fetch current numbers', { response: { data: errData }});
        return { success: false, error: true, serverError: true };
      } else {
        setHasCheckedNumbers(true);
        return { success: true, hasNumbers: false };
      }
    } catch (err) {
      setHasCheckedNumbers(true);
      handleError('Failed to fetch current numbers', err);
      return { success: false, error: true, networkError: true };
    }
  }, []);

  const fetchMessages = useCallback(async (subscriptionData = null) => {
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/messages`);
      if (response && response.ok) {
        const data = await response.json();
        const sortedMessages = (data.messages || []).sort((a, b) => 
          new Date(b.receivedAt) - new Date(a.receivedAt)
        );
        setMessages(sortedMessages);
      } else if (response && response.status === 410) {
        setLeasedNumbers([]);
        setError("Your leased numbers have expired. Please lease new ones.");
      } else if (response) {
         const errData = await response.json().catch(() => ({ message: response.statusText }));
        handleError('Failed to fetch messages', { response: { data: errData }});
      }
    } catch (err) {
      handleError('Error fetching messages', err);
    }
  }, []);

  const handleLeaseNumber = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/leaseNumber`, { method: 'POST' });
      if (response && response.ok) {
        const data = await response.json();
        setLeasedNumbers(data.virtualNumbers || []);
        setMessages([]);
        fetchMessages();
      } else if (response) {
        const errData = await response.json().catch(() => ({ message: response.statusText }));
        handleError('Failed to lease numbers', { response: { data: errData }});
      } else {
        handleError('Error leasing numbers', new Error('Network error'));
      }
    } catch (err) {
      handleError('Error leasing numbers', err);
    }
    setIsLoading(false);
  }, [fetchMessages]);

  useEffect(() => {
    setIsLoading(true);
    fetchCurrentNumber().then((result) => {
      if (result && result.hasNumbers && result.numbers.length > 0) {
        fetchMessages().then(() => {
          setTimeout(() => {
            fetchMessages();
          }, 1000);
        });
        setIsLoading(false);
      } else if (result && result.success && !result.hasNumbers) {
        handleLeaseNumber();
      } else if (result && result.error && result.serverError) {
        setIsLoading(false);
      } else {
        handleLeaseNumber();
      }
    });
  }, [fetchCurrentNumber, fetchMessages, handleLeaseNumber]);

  return (
    <div className="App">
      <header className="app-header">
        <h1>📱 SMS OTP Burner</h1>
        <p className="subtitle">Temporary SMS numbers for OTP verification</p>
      </header>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="loading-banner">
          <span className="loading-spinner">⏳</span>
          <span>Loading...</span>
        </div>
      )}

      {(leasedNumbers.length > 0 || hasCheckedNumbers) ? (
        <div className="main-content">
          {leasedNumbers.length > 0 ? (
            <div className="numbers-card">
              <div className="numbers-header">
                <h2>📱 {leasedNumbers.length === 1 ? 'Virtual Number' : `Virtual Numbers (${leasedNumbers.length})`}</h2>
              </div>
              <div className="numbers-list">
                {leasedNumbers.map((number) => (
                  <div key={number.virtualNumber || number.msisdn} className="number-item">
                    <span className="number-value">{number.virtualNumber || number.msisdn}</span>
                    <button 
                      className="copy-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyNumber(number.virtualNumber || number.msisdn);
                      }} 
                      title={copiedNumber === (number.virtualNumber || number.msisdn) ? "Copied!" : "Copy number"}
                    >
                      {copiedNumber === (number.virtualNumber || number.msisdn) ? '✅' : '📋'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="number-card">
              <div className="number-header">
                <h2>📱 Virtual Numbers</h2>
              </div>
              <div className="number-details">
                <div className="number-display">
                  <span className="number-label">Status:</span>
                  <span className="number-value">Getting numbers automatically...</span>
                </div>
              </div>
            </div>
          )}

          <div className="messages-card">
            <div className="messages-header">
              <h2>📨 Received Messages</h2>
              <button 
                className="refresh-btn" 
                onClick={() => fetchMessages()} 
                disabled={isLoading || leasedNumbers.length === 0}
                title="Refresh messages"
              >
                🔄 Refresh
              </button>
            </div>
            
            {messages.length > 0 ? (
              <div className="messages-table-container">
                <table className="messages-table">
                  <thead>
                    <tr>
                      <th>To Number</th>
                      <th>From</th>
                      <th>Message</th>
                      <th>Date</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {messages.map((msg, index) => (
                      <tr key={index} className="message-row">
                        <td className="to-cell">{msg.to}</td>
                        <td className="sender-cell">{msg.from}</td>
                        <td className="message-cell">{msg.body}</td>
                        <td className="date-cell">
                          {new Date(msg.receivedAt).toLocaleDateString()}
                        </td>
                        <td className="time-cell">
                          {new Date(msg.receivedAt).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="no-messages">
                <div className="no-messages-icon">📭</div>
                <p>{isLoading ? 'Checking for messages...' : leasedNumbers.length > 0 ? 'No messages received yet.' : 'Getting virtual numbers automatically...'}</p>
                <p className="no-messages-hint">
                  {leasedNumbers.length > 0 ? 'Use your virtual numbers above to receive SMS codes and OTPs' : 'Your virtual numbers will appear automatically once ready'}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="loading-initial">
          <div className="loading-spinner-large">⏳</div>
          <h2>Setting up your virtual numbers...</h2>
          <p>Please wait while we get you temporary SMS numbers</p>
        </div>
      )}
    </div>
  );
}

export default App;
