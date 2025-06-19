![Test](https://github.com/logan-han/sms-otp-burner/actions/workflows/test.yml/badge.svg?branch=main)
![Deploy](https://github.com/logan-han/sms-otp-burner/actions/workflows/deploy.yml/badge.svg?branch=main)
[![codecov](https://codecov.io/gh/logan-han/sms-otp-burner/graph/badge.svg?token=vvedmYETBR)](https://codecov.io/gh/logan-han/sms-otp-burner)
# Australian SMS OTP Burner

Lease virtual numbers from Telstra & display SMS received from the numbers.

Uses [Telstra Messaging API](https://dev.telstra.com/apis/messaging-api).

## Development

```bash
# Install dependencies
yarn install

# Start dev env
yarn start

# Run tests
yarn test
```

## Config

Default 1 virtual number supported as that's the maximum for free Telstra dev account.
Set `MAX_LEASED_NUMBER_COUNT` environment variable to increase the number.

Requires below GitHub Actions secrets:
`AWS_ACCESS_KEY_ID`
`AWS_SECRET_ACCESS_KEY`
`SERVERLESS_ACCESS_KEY`
`TELSTRA_CLIENT_ID`
`TELSTRA_CLIENT_SECRET`

## Try

https://sms.han.life