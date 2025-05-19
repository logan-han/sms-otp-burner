![Test](https://github.com/logan-han/sms-otp-burner/actions/workflows/test.yml/badge.svg?branch=main)
![Deploy](https://github.com/logan-han/sms-otp-burner/actions/workflows/deploy.yml/badge.svg?branch=main)
[![codecov](https://codecov.io/gh/logan-han/sms-otp-burner/graph/badge.svg?token=vvedmYETBR)](https://codecov.io/gh/logan-han/sms-otp-burner)
# Australian SMS OTP Burner

Lease virtual numbers from Telstra & display SMS received from the numbers.

Uses [Telstra Messaging API](https://dev.telstra.com/apis/messaging-api).

## Features

- **Configurable Number Count**: Set how many virtual numbers to lease (default: 1 for trial accounts)
- **Multiple Number Support**: Display and manage multiple virtual numbers simultaneously
- **Multi-Number Messaging**: View messages from all leased numbers in a unified interface
- **Environment Variable Configuration**: Use `MAX_LEASED_NUMBER_COUNT` to increase numbers for paid accounts

## Installation

```bash
yarn install
```

## Development

```bash
# Start both backend and frontend in development mode
yarn start

# Start only frontend  
yarn start:react

# Start only backend
yarn start:backend

# Build for production
yarn build:react

# Run tests
yarn test

# Run only React tests
yarn test:react

# Run only backend tests
yarn test:backend
```

## Config

Requires below GitHub Actions secrets:
`AWS_ACCESS_KEY_ID`
`AWS_SECRET_ACCESS_KEY`
`SERVERLESS_ACCESS_KEY`
`TELSTRA_CLIENT_ID`
`TELSTRA_CLIENT_SECRET`

### GitHub Actions Configuration

To configure the maximum number of virtual numbers via GitHub Actions:

#### Option 1: Repository Variables (Recommended)

1. Go to your repository → Settings → Secrets and variables → Actions
2. Click the "Variables" tab
3. Add a new repository variable:
   - Name: `MAX_LEASED_NUMBER_COUNT`
   - Value: `1` (or higher for paid accounts)

#### Option 2: Manual Deployment

1. Go to Actions → Deploy workflow
2. Click "Run workflow"
3. Enter the desired number in "Maximum number of virtual numbers to lease"
4. Click "Run workflow"

### Optional Environment Variables

- `MAX_LEASED_NUMBER_COUNT`: Number of virtual numbers to lease (default: 1)
  - Trial accounts: Limited to 1 number
  - Paid accounts: Can set higher values (e.g., `MAX_LEASED_NUMBER_COUNT=3`)

## Try

https://sms.han.life