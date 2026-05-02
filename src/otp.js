const OTP_RE = /(?<![A-Za-z0-9])((?:\d[\s-]?){3,7}\d)(?![A-Za-z0-9])/g;

const OTP_HINT_RE = /\b(code|otp|verification|verify|passcode|security|login|one[-\s]?time|2fa|mfa)\b/i;
const NOISE_RE = /\b(call|phone|ref|reference|acct|account|card|ending|order|ticket|case|amount|pay|paid|due)\b/i;

export function extractOtp(body = '') {
  const text = String(body);
  const candidates = [];
  let match;

  while ((match = OTP_RE.exec(text)) !== null) {
    const raw = match[1];
    const digits = raw.replace(/[\s-]/g, '');

    if (digits.length < 4 || digits.length > 8) continue;

    const start = match.index;
    const end = start + raw.length;
    const context = text.slice(Math.max(0, start - 24), Math.min(text.length, end + 24));
    const before = text.slice(Math.max(0, start - 18), start);
    const after = text.slice(end, Math.min(text.length, end + 18));
    const hasHint = OTP_HINT_RE.test(context);
    const hasNoise = NOISE_RE.test(before) || (NOISE_RE.test(after) && !hasHint);

    candidates.push({
      raw,
      digits,
      index: start,
      length: raw.length,
      score: (hasHint ? 2 : 0) - (hasNoise ? 1 : 0),
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score || b.digits.length - a.digits.length || a.index - b.index);
  const best = candidates[0];
  if (best.score < 0) return null;
  return {
    raw: best.raw,
    digits: best.digits,
    index: best.index,
    length: best.length,
  };
}
