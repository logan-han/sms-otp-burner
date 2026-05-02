/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { extractOtp } from './otp';

const API_BASE_URL = '/api';

const Icon = ({ children, size = 16, stroke = 1.7, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);
const IconCopy = (p) => <Icon {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></Icon>;
const IconCheck = (p) => <Icon {...p}><path d="M4 12.5l5 5L20 6.5" /></Icon>;
const IconRefresh = (p) => <Icon {...p}><path d="M21 12a9 9 0 1 1-3.5-7.1" /><path d="M21 4v5h-5" /></Icon>;
const IconSearch = (p) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>;
const IconX = (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
const IconInbox = (p) => <Icon {...p}><path d="M3 13h5l2 3h4l2-3h5" /><path d="M5 5h14l2 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6L5 5Z" /></Icon>;
const IconPlus = (p) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;

const normalizeNumber = (number) => {
  const virtualNumber = number.virtualNumber || number.msisdn || number.number;
  const expiryDate = number.expiryDate || number.expiresAt || number.expiry || null;
  return {
    ...number,
    virtualNumber,
    display: formatPhone(virtualNumber),
    expiryDate,
  };
};

const normalizeMessage = (message, index) => ({
  id: message.id || message.messageId || `${message.to || 'msg'}-${message.receivedAt || index}-${index}`,
  from: message.from || message.sender || 'Unknown',
  to: message.to || message.virtualNumber || '',
  body: message.body || message.message || '',
  receivedAt: message.receivedAt || message.timestamp || new Date().toISOString(),
  unread: Boolean(message.unread),
});

const formatPhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('61')) {
    return `+61 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return value;
};

const formatRelative = (value) => {
  const diff = Date.now() - new Date(value).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(value).toLocaleDateString();
};

const formatClock = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

const formatDuration = (value) => {
  if (!value) return 'active';
  const ms = new Date(value).getTime() - Date.now();
  if (Number.isNaN(ms)) return 'active';
  if (ms <= 0) return 'expired';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  if (days > 0) return `${days}d ${h}h`;
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m left`;
};

function App() {
  const [copiedKey, setCopiedKey] = useState(null);
  const [leasedNumbers, setLeasedNumbers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeNumber, setActiveNumber] = useState('all');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLeasing, setIsLeasing] = useState(false);
  const [maxLeaseCount, setMaxLeaseCount] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const handleError = (message, err) => {
    const detail = err?.response?.data?.message || err?.message || '';
    setError(`${message}${detail ? `. ${detail}` : ''}`);
  };

  const fetchCurrentNumbers = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/virtual-numbers`);
    if (response.ok) {
      const data = await response.json();
      if (Number.isFinite(data.maxCount)) {
        setMaxLeaseCount(data.maxCount);
      }
      const activeNumbers = (data.virtualNumbers || [])
        .map(normalizeNumber)
        .filter((num) => !num.expiryDate || new Date(num.expiryDate) > new Date());
      setLeasedNumbers(activeNumbers);
      return activeNumbers;
    }
    if (response.status === 404) {
      setLeasedNumbers([]);
      return [];
    }
    const errData = await response.json().catch(() => ({ message: response.statusText }));
    throw { response: { data: errData } };
  }, []);

  const fetchMessages = useCallback(async () => {
    const response = await fetch(`${API_BASE_URL}/messages`);
    if (response.ok) {
      const data = await response.json();
      const sortedMessages = (data.messages || [])
        .map(normalizeMessage)
        .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
      setMessages(sortedMessages);
      return sortedMessages;
    }
    if (response.status === 410) {
      setLeasedNumbers([]);
      setMessages([]);
      setError('Your leased numbers have expired. Lease a new number to continue.');
      return [];
    }
    const errData = await response.json().catch(() => ({ message: response.statusText }));
    throw { response: { data: errData } };
  }, []);

  const leaseNumber = useCallback(async () => {
    setIsLeasing(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/leaseNumber`, { method: 'POST' });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: response.statusText }));
        throw { response: { data: errData } };
      }
      const data = await response.json();
      if (Number.isFinite(data.maxCount)) {
        setMaxLeaseCount(data.maxCount);
      }
      const numbers = (data.virtualNumbers || []).map(normalizeNumber);
      setLeasedNumbers(numbers);
      await fetchMessages();
    } catch (err) {
      handleError('Failed to lease numbers', err);
    } finally {
      setIsLeasing(false);
      setIsLoading(false);
    }
  }, [fetchMessages]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      await fetchMessages();
    } catch (err) {
      handleError('Failed to fetch messages', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchMessages]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchCurrentNumbers()
      .then(async (numbers) => {
        if (cancelled) return;
        if (numbers.length === 0) {
          await leaseNumber();
        } else {
          await fetchMessages();
        }
      })
      .catch((err) => handleError('Failed to fetch current numbers', err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchCurrentNumbers, fetchMessages, leaseNumber]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!expandedId) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setExpandedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedId]);

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setToast({ text: `Copied ${text}`, ts: Date.now() });
    setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600);
    setTimeout(() => setToast((current) => (current && Date.now() - current.ts >= 1500 ? null : current)), 1700);
  };

  const numberByMsisdn = useMemo(() => {
    const map = {};
    leasedNumbers.forEach((number) => {
      map[number.virtualNumber] = number;
    });
    return map;
  }, [leasedNumbers]);

  const scopedMessages = useMemo(
    () => (activeNumber === 'all' ? messages : messages.filter((message) => message.to === activeNumber)),
    [activeNumber, messages]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return scopedMessages;
    return scopedMessages.filter((message) => `${message.from} ${message.to} ${message.body}`.toLowerCase().includes(needle));
  }, [query, scopedMessages]);

  const expanded = messages.find((message) => message.id === expandedId);
  const canLeaseMore = maxLeaseCount == null || leasedNumbers.length < maxLeaseCount;

  return (
    <div className="shell">
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
          <span className="meta-pill"><span className="live-dot" /> live</span>
          <span className="meta-pill mono">{formatClock(now)}</span>
          <span className="meta-pill subtle">{leasedNumbers.length} active leases</span>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span className="error-icon">!</span>
          <span>{error}</span>
        </div>
      )}

      <section className="numbers-strip" role="tablist" aria-label="Filter by virtual number">
        <button role="tab" aria-selected={activeNumber === 'all'} className={`num-tab all${activeNumber === 'all' ? ' on' : ''}`} onClick={() => setActiveNumber('all')}>
          <div className="num-tab-label"><span className="num-tab-dot" /> all</div>
          <div className="num-tab-row">
            <span className="num-tab-num">All numbers</span>
          </div>
          <div className="num-tab-meta"><span className="num-tab-count">{messages.length}</span><span>messages</span></div>
        </button>

        {leasedNumbers.map((number) => {
          const totalForNumber = messages.filter((message) => message.to === number.virtualNumber).length;
          const isActive = activeNumber === number.virtualNumber;
          return (
            <button key={number.virtualNumber} role="tab" aria-selected={isActive} className={`num-tab${isActive ? ' on' : ''}`} onClick={() => setActiveNumber(number.virtualNumber)}>
              <div className="num-tab-row">
                <div className="num-tab-label"><span className="num-tab-dot" /> idle</div>
                <span className="num-tab-copy" role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); copy(number.virtualNumber, `num-${number.virtualNumber}`); }} onKeyDown={(event) => { if (event.key === 'Enter') copy(number.virtualNumber, `num-${number.virtualNumber}`); }} title="Copy number">
                  {copiedKey === `num-${number.virtualNumber}` ? <IconCheck size={13} /> : <IconCopy size={13} />}
                </span>
              </div>
              <div className="num-tab-row"><span className="num-tab-num">{number.display}</span></div>
              <div className="num-tab-meta"><span className="num-tab-count">{totalForNumber}</span><span>msg{totalForNumber === 1 ? '' : 's'}</span><span className="sep">.</span><span>{formatDuration(number.expiryDate)}</span></div>
            </button>
          );
        })}

        {canLeaseMore && (
          <button className="num-tab lease-tab" onClick={leaseNumber} disabled={isLeasing || isLoading}>
            <div className="num-tab-label"><IconPlus size={12} /> lease</div>
            <div className="num-tab-row"><span className="num-tab-num">{isLeasing ? 'Leasing...' : 'New number'}</span></div>
            <div className="num-tab-meta">request a Telstra virtual number</div>
          </button>
        )}
      </section>

      <section className="toolbar">
        <div className="toolbar-left">
          <div className="toolbar-title"><IconInbox size={15} /><span>Inbox</span><span className="toolbar-count mono">{filtered.length}</span></div>
          <div className="search">
            <IconSearch size={14} />
            <input type="text" placeholder="Filter by sender, code, or text..." value={query} onChange={(event) => setQuery(event.target.value)} />
            {query && <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search"><IconX size={12} /></button>}
          </div>
        </div>
        <button className={`btn refresh-btn ${isRefreshing ? 'spinning refreshing' : ''}`} onClick={refresh} disabled={isLoading || isRefreshing || leasedNumbers.length === 0}>
          <IconRefresh size={14} /> {isRefreshing ? 'checking...' : 'check for new'}
        </button>
      </section>

      {isLoading ? (
        <div className="loading-initial"><div className="loading-spinner-large">...</div><h2>Setting up your virtual numbers</h2><p>Checking active leases and recent SMS.</p></div>
      ) : (
        <main className="grid main-content">
          {filtered.length === 0 && (
            <div className="empty-grid no-messages">
              <div className="empty-icon"><IconInbox size={32} /></div>
              <div className="empty-title">{query ? 'No matches' : activeNumber === 'all' ? 'Inbox empty' : 'Nothing on this number yet'}</div>
              <div className="empty-sub">{query ? 'Try a different search.' : 'Use a leased number to receive SMS codes and OTPs.'}</div>
            </div>
          )}

          {filtered.map((message) => {
            const otp = extractOtp(message.body);
            return (
              <article key={message.id} className={`card message-row${otp ? ' has-otp' : ' no-otp'}`} onClick={() => setExpandedId(message.id)}>
                <header className="card-head">
                  <div className="card-from"><span className="card-from-name">{message.from}</span></div>
                  <span className="card-time mono">{formatRelative(message.receivedAt)}</span>
                </header>

                <div className="card-main">
                  {otp ? (
                    <button type="button" className="card-otp" onClick={(event) => { event.stopPropagation(); copy(otp.digits, `card-${message.id}`); }} title="Click to copy">
                      <span className="card-otp-digits mono">{otp.digits.split('').map((digit, index) => <span key={index} className="card-otp-digit">{digit}</span>)}</span>
                      <span className="card-otp-action">{copiedKey === `card-${message.id}` ? <><IconCheck size={13} /> copied</> : <><IconCopy size={13} /> copy</>}</span>
                    </button>
                  ) : null}

                  <p className="card-body message-cell">{message.body}</p>
                </div>
                <footer className="card-foot">
                  <span className="card-to mono">to {numberByMsisdn[message.to]?.display || message.to}</span>
                </footer>
              </article>
            );
          })}
        </main>
      )}

      {expanded && (
        <div className="modal-scrim" onClick={() => setExpandedId(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <header className="modal-head">
              <div>
                <div className="modal-from-name">{expanded.from}</div>
                <div className="modal-from-meta mono">to {numberByMsisdn[expanded.to]?.display || expanded.to} . {new Date(expanded.receivedAt).toLocaleString()}</div>
              </div>
              <div className="modal-actions">
                <button className="icon-btn" onClick={() => setExpandedId(null)} title="Close"><IconX size={14} /></button>
              </div>
            </header>
            <div className="modal-body">
              <div className="paper">{expanded.body}</div>
              {extractOtp(expanded.body) && (
                <div className="otp-hero">
                  <div className="otp-hero-label">detected one-time code</div>
                  <div className="otp-hero-row">
                    <div className="otp-hero-digits mono">{extractOtp(expanded.body).digits.split('').map((digit, index) => <span key={index} className="otp-hero-digit">{digit}</span>)}</div>
                    <button className="btn btn-primary" onClick={() => copy(extractOtp(expanded.body).digits, `modal-${expanded.id}`)}>
                      {copiedKey === `modal-${expanded.id}` ? <><IconCheck size={14} /> copied</> : <><IconCopy size={14} /> copy code</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" key={toast.ts}><IconCheck size={14} /><span className="mono">{toast.text}</span></div>}
    </div>
  );
}

export default App;
