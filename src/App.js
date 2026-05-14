import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { fetchMessages, fetchVirtualNumbers, leaseNewNumber } from './api';
import useClipboardCopy from './hooks/useClipboardCopy';
import AppHeader from './components/AppHeader';
import ErrorBanner from './components/ErrorBanner';
import LoadingState from './components/LoadingState';
import MessageGrid from './components/MessageGrid';
import MessageModal from './components/MessageModal';
import NumbersStrip from './components/NumbersStrip';
import Toast from './components/Toast';
import Toolbar from './components/Toolbar';

const errorDetail = (err) => err?.response?.data?.message || err?.message || '';
const composeError = (message, err) => {
  const detail = errorDetail(err);
  return `${message}${detail ? `. ${detail}` : ''}`;
};

function App() {
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
  const [expandedId, setExpandedId] = useState(null);

  const { copy, copiedKey, toast } = useClipboardCopy();

  const loadMessages = useCallback(async () => {
    const { messages: list, expired } = await fetchMessages();
    if (expired) {
      setLeasedNumbers([]);
      setMessages([]);
      setError('Your leased numbers have expired. Lease a new number to continue.');
      return [];
    }
    setMessages(list);
    return list;
  }, []);

  const loadVirtualNumbers = useCallback(async () => {
    const { numbers, maxCount } = await fetchVirtualNumbers();
    if (maxCount != null) setMaxLeaseCount(maxCount);
    setLeasedNumbers(numbers);
    return numbers;
  }, []);

  const lease = useCallback(async () => {
    setIsLeasing(true);
    setError(null);
    try {
      const { numbers, maxCount } = await leaseNewNumber();
      if (maxCount != null) setMaxLeaseCount(maxCount);
      setLeasedNumbers(numbers);
      await loadMessages();
    } catch (err) {
      setError(composeError('Failed to lease numbers', err));
    } finally {
      setIsLeasing(false);
      setIsLoading(false);
    }
  }, [loadMessages]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      await loadMessages();
    } catch (err) {
      setError(composeError('Failed to fetch messages', err));
    } finally {
      setIsRefreshing(false);
    }
  }, [loadMessages]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    loadVirtualNumbers()
      .then(async (numbers) => {
        if (cancelled) return;
        if (numbers.length === 0) {
          await lease();
        } else {
          await loadMessages();
        }
      })
      .catch((err) => setError(composeError('Failed to fetch current numbers', err)))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadVirtualNumbers, loadMessages, lease]);

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

  const numberByMsisdn = useMemo(() => {
    const map = {};
    leasedNumbers.forEach((number) => {
      map[number.virtualNumber] = number;
    });
    return map;
  }, [leasedNumbers]);

  const filtered = useMemo(() => {
    const scoped = activeNumber === 'all'
      ? messages
      : messages.filter((message) => message.to === activeNumber);
    const needle = query.trim().toLowerCase();
    if (!needle) return scoped;
    return scoped.filter((message) =>
      `${message.from} ${message.to} ${message.body}`.toLowerCase().includes(needle),
    );
  }, [activeNumber, messages, query]);

  const expanded = messages.find((message) => message.id === expandedId);
  const canLeaseMore = maxLeaseCount == null || leasedNumbers.length < maxLeaseCount;

  return (
    <div className="shell">
      <AppHeader now={now} leasedCount={leasedNumbers.length} />
      <ErrorBanner message={error} />

      <NumbersStrip
        leasedNumbers={leasedNumbers}
        messages={messages}
        activeNumber={activeNumber}
        onSelectNumber={setActiveNumber}
        onCopyNumber={(number) => copy(number, `num-${number}`)}
        copiedKey={copiedKey}
        canLeaseMore={canLeaseMore}
        isLeasing={isLeasing}
        isLoading={isLoading}
        onLease={lease}
      />

      <Toolbar
        filteredCount={filtered.length}
        query={query}
        onQueryChange={setQuery}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        canRefresh={leasedNumbers.length > 0}
        onRefresh={refresh}
      />

      {isLoading ? (
        <LoadingState />
      ) : (
        <MessageGrid
          messages={filtered}
          numberByMsisdn={numberByMsisdn}
          copiedKey={copiedKey}
          query={query}
          activeNumber={activeNumber}
          onOpen={setExpandedId}
          onCopyOtp={copy}
        />
      )}

      <MessageModal
        message={expanded}
        recipientDisplay={expanded && (numberByMsisdn[expanded.to]?.display || expanded.to)}
        copiedKey={copiedKey}
        onClose={() => setExpandedId(null)}
        onCopyOtp={copy}
      />

      <Toast toast={toast} />
    </div>
  );
}

export default App;
