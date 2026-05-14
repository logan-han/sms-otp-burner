export const formatPhone = (value = '') => {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('61')) {
    return `+61 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return value;
};

export const formatRelative = (value) => {
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

export const formatClock = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export const formatDuration = (value) => {
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

export const normalizeNumber = (number) => {
  const virtualNumber = number.virtualNumber || number.msisdn || number.number;
  const expiryDate = number.expiryDate || number.expiresAt || number.expiry || null;
  return {
    ...number,
    virtualNumber,
    display: formatPhone(virtualNumber),
    expiryDate,
  };
};

export const normalizeMessage = (message, index) => ({
  id: message.id || message.messageId || `${message.to || 'msg'}-${message.receivedAt || index}-${index}`,
  from: message.from || message.sender || 'Unknown',
  to: message.to || message.virtualNumber || '',
  body: message.body || message.message || '',
  receivedAt: message.receivedAt || message.timestamp || new Date().toISOString(),
  unread: Boolean(message.unread),
});
