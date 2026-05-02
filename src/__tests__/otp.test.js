import { extractOtp } from '../otp';

describe('extractOtp', () => {
  test.each([
    ['Your Telstra verification code is 384 029. Do not share this with anyone.', '384029'],
    ['PayID confirmation: 5821. This code expires in 5 minutes.', '5821'],
    ['Stripe verification code: 901-244', '901244'],
    ['GitHub verification code: 044-921', '044921'],
    ['Use 449281 to verify your Atlassian account. Code expires in 10 min.', '449281'],
  ])('extracts OTP from %s', (body, expected) => {
    expect(extractOtp(body)?.digits).toBe(expected);
  });

  test.each([
    ['Call 13 2221 immediately if you did not request this.'],
    ['Your order 123456789 has shipped.'],
    ['Account ending 1234 was used for a card payment.'],
  ])('does not promote likely non-OTP numbers from %s', (body) => {
    expect(extractOtp(body)).toBeNull();
  });

  test('prefers a hinted code over nearby support phone digits', () => {
    expect(extractOtp('Call 13 2221 if this was not you. NetBank code: 718 902.')?.digits).toBe('718902');
  });
});
