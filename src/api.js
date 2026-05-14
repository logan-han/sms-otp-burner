import { normalizeMessage, normalizeNumber } from './format';

const API_BASE_URL = '/api';

const readErrorData = async (response) =>
  response.json().catch(() => ({ message: response.statusText }));

const throwApiError = async (response) => {
  const data = await readErrorData(response);
  throw { response: { data } };
};

export async function fetchVirtualNumbers() {
  const response = await fetch(`${API_BASE_URL}/virtual-numbers`);
  if (response.ok) {
    const data = await response.json();
    const numbers = (data.virtualNumbers || [])
      .map(normalizeNumber)
      .filter((num) => !num.expiryDate || new Date(num.expiryDate) > new Date());
    return { numbers, maxCount: Number.isFinite(data.maxCount) ? data.maxCount : null };
  }
  if (response.status === 404) {
    return { numbers: [], maxCount: null };
  }
  await throwApiError(response);
  return { numbers: [], maxCount: null };
}

export async function fetchMessages() {
  const response = await fetch(`${API_BASE_URL}/messages`);
  if (response.ok) {
    const data = await response.json();
    const messages = (data.messages || [])
      .map(normalizeMessage)
      .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
    return { messages, expired: false };
  }
  if (response.status === 410) {
    return { messages: [], expired: true };
  }
  await throwApiError(response);
  return { messages: [], expired: false };
}

export async function leaseNewNumber() {
  const response = await fetch(`${API_BASE_URL}/leaseNumber`, { method: 'POST' });
  if (!response.ok) {
    await throwApiError(response);
  }
  const data = await response.json();
  const numbers = (data.virtualNumbers || []).map(normalizeNumber);
  return { numbers, maxCount: Number.isFinite(data.maxCount) ? data.maxCount : null };
}
