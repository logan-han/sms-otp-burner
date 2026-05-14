import { extractOtp } from '../otp';

describe('extractOtp', () => {
  describe('positive matches', () => {
    test.each([
      ['Your Telstra verification code is 384 029. Do not share this with anyone.', '384029'],
      ['PayID confirmation: 5821. This code expires in 5 minutes.', '5821'],
      ['Stripe verification code: 901-244', '901244'],
      ['GitHub verification code: 044-921', '044921'],
      ['Use 449281 to verify your Atlassian account. Code expires in 10 min.', '449281'],
      ['Your one-time passcode is 12345.', '12345'],
      ['Login code: 9876', '9876'],
      ['Security code 1234567 - do not share', '1234567'],
      ['Your 2FA code: 84-21-99', '842199'],
    ])('extracts OTP from %s', (body, expected) => {
      expect(extractOtp(body)?.digits).toBe(expected);
    });
  });

  describe('rejects non-OTP numbers', () => {
    test.each([
      ['Call 13 2221 immediately if you did not request this.'],
      ['Your order 123456789 has shipped.'],
      ['Account ending 1234 was used for a card payment.'],
      ['Reference 87654321 confirmed.'],
      ['Amount paid: 4500.'],
    ])('does not promote likely non-OTP numbers from %s', (body) => {
      expect(extractOtp(body)).toBeNull();
    });
  });

  describe('length boundaries', () => {
    test('rejects digit groups shorter than 4', () => {
      expect(extractOtp('Your code is 123 only.')).toBeNull();
    });

    test('accepts 4-digit code at lower boundary', () => {
      expect(extractOtp('Your verification code is 4821.')?.digits).toBe('4821');
    });

    test('accepts 8-digit code at upper boundary', () => {
      expect(extractOtp('Your verification code is 12345678.')?.digits).toBe('12345678');
    });

    test('rejects digit groups longer than 8', () => {
      expect(extractOtp('Reference 123456789 confirmed.')).toBeNull();
    });
  });

  describe('input handling', () => {
    test('returns null for empty string', () => {
      expect(extractOtp('')).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(extractOtp()).toBeNull();
    });

    test('returns null for null input', () => {
      expect(extractOtp(null)).toBeNull();
    });

    test('coerces non-string input to string', () => {
      expect(extractOtp(123456)?.digits).toBe('123456');
    });

    test('returns null for string without digit groups', () => {
      expect(extractOtp('Welcome to our service!')).toBeNull();
    });
  });

  describe('scoring and ranking', () => {
    test('prefers a hinted code over nearby support phone digits', () => {
      expect(extractOtp('Call 13 2221 if this was not you. NetBank code: 718 902.')?.digits).toBe('718902');
    });

    test('returns longer digit string when scores tie', () => {
      const result = extractOtp('Codes 1234 and 567890 are valid.');
      expect(result?.digits).toBe('567890');
    });

    test('returns first match when scores and lengths tie', () => {
      const result = extractOtp('Codes 1234 and 5678 are valid.');
      expect(result?.digits).toBe('1234');
    });

    test('rejects when only noise context, no hint', () => {
      expect(extractOtp('Account ending 4821 charged.')).toBeNull();
    });

    test('accepts hinted code even when noise also appears', () => {
      expect(extractOtp('Your code 482190 confirms the order ref.')?.digits).toBe('482190');
    });
  });

  describe('position boundaries', () => {
    test('matches an OTP at the very start of the body', () => {
      expect(extractOtp('384029 is your code')?.digits).toBe('384029');
    });

    test('matches an OTP at the very end of the body', () => {
      expect(extractOtp('Your code: 482190')?.digits).toBe('482190');
    });

    test('handles OTP with whitespace context on both sides', () => {
      expect(extractOtp('   384029   ')?.digits).toBe('384029');
    });
  });

  describe('return shape', () => {
    test('returns raw, digits, index, and length fields', () => {
      const result = extractOtp('Verification code: 384 029.');
      expect(result).toEqual({
        raw: '384 029',
        digits: '384029',
        index: expect.any(Number),
        length: 7,
      });
    });

    test('index points at the start of the match', () => {
      const body = 'Verification code: 384029.';
      const result = extractOtp(body);
      expect(body.slice(result.index, result.index + result.length)).toBe('384029');
    });
  });
});
