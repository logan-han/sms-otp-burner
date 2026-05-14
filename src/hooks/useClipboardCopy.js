import { useCallback, useState } from 'react';

const COPIED_INDICATOR_MS = 1600;
const TOAST_VISIBLE_MS = 1500;
const TOAST_CLEANUP_MS = 1700;

export default function useClipboardCopy() {
  const [copiedKey, setCopiedKey] = useState(null);
  const [toast, setToast] = useState(null);

  const copy = useCallback((text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setToast({ text: `Copied ${text}`, ts: Date.now() });
    setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), COPIED_INDICATOR_MS);
    setTimeout(
      () => setToast((current) => (current && Date.now() - current.ts >= TOAST_VISIBLE_MS ? null : current)),
      TOAST_CLEANUP_MS,
    );
  }, []);

  return { copy, copiedKey, toast };
}
