import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

global.fetch = jest.fn();

Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

const activeNumber = {
  msisdn: '+61412345678',
  virtualNumber: '+61412345678',
  subscriptionId: 'sub123',
  expiryDate: new Date(Date.now() + 86400000).toISOString(),
};

const secondNumber = {
  msisdn: '+61498765432',
  virtualNumber: '+61498765432',
  subscriptionId: 'sub456',
  expiryDate: new Date(Date.now() + 86400000).toISOString(),
};

const okJson = (data) => ({ ok: true, json: async () => data });
const errJson = (status, data = {}) => ({ ok: false, status, json: async () => data });

const mockSuccessfulBoot = (messages = [], { numbers = [activeNumber], maxCount = 1 } = {}) => {
  fetch
    .mockResolvedValueOnce(okJson({ virtualNumbers: numbers, maxCount }))
    .mockResolvedValueOnce(okJson({ messages }));
};

const sampleMessage = (overrides = {}) => ({
  id: 'm1',
  from: 'GitHub',
  to: '+61412345678',
  body: 'GitHub verification code: 044-921',
  receivedAt: new Date().toISOString(),
  ...overrides,
});

describe('App Component', () => {
  beforeEach(() => {
    fetch.mockReset();
    navigator.clipboard.writeText.mockClear();
  });

  describe('initial boot', () => {
    test('renders the OTP-first shell', async () => {
      mockSuccessfulBoot();
      render(<App />);

      expect(screen.getByRole('heading', { name: 'burner / sms' })).toBeInTheDocument();
      expect(screen.getByText('Disposable SMS for OTP verification')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('+61 412 345 678')).toBeInTheDocument();
      });
    });

    test('fetches virtual numbers and messages on mount', async () => {
      mockSuccessfulBoot();
      render(<App />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/virtual-numbers');
        expect(fetch).toHaveBeenCalledWith('/api/messages');
      });
    });

    test('leases a number when none exist', async () => {
      fetch
        .mockResolvedValueOnce(okJson({ virtualNumbers: [] }))
        .mockResolvedValueOnce(okJson({ virtualNumbers: [activeNumber] }))
        .mockResolvedValueOnce(okJson({ messages: [] }));

      render(<App />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/leaseNumber', { method: 'POST' });
      });
    });

    test('handles 404 from virtual-numbers as no leased numbers', async () => {
      fetch
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
        .mockResolvedValueOnce(okJson({ virtualNumbers: [activeNumber] }))
        .mockResolvedValueOnce(okJson({ messages: [] }));

      render(<App />);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/leaseNumber', { method: 'POST' });
      });
    });

    test('filters out expired leased numbers on boot', async () => {
      const expired = {
        ...activeNumber,
        virtualNumber: '+61400000000',
        expiryDate: new Date(Date.now() - 86400000).toISOString(),
      };
      mockSuccessfulBoot([], { numbers: [activeNumber, expired], maxCount: 2 });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('+61 412 345 678')).toBeInTheDocument();
      });
      expect(screen.queryByText('+61 400 000 000')).not.toBeInTheDocument();
    });
  });

  describe('OTP rendering', () => {
    test('surfaces OTP digits as the primary message action', async () => {
      mockSuccessfulBoot([sampleMessage()]);

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('GitHub')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /0\s*4\s*4\s*9\s*2\s*1 copy/i })).toBeInTheDocument();

      fireEvent.click(screen.getByTitle('Click to copy'));
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('044921');
    });

    test('shows toast confirmation after copying an OTP', async () => {
      mockSuccessfulBoot([sampleMessage()]);

      render(<App />);

      await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument());

      fireEvent.click(screen.getByTitle('Click to copy'));

      expect(screen.getByText(/Copied 044921/)).toBeInTheDocument();
    });

    test('renders message without OTP affordance when none detected', async () => {
      mockSuccessfulBoot([
        sampleMessage({ id: 'm2', body: 'Welcome to our service!' }),
      ]);

      render(<App />);

      await waitFor(() => expect(screen.getByText('Welcome to our service!')).toBeInTheDocument());

      expect(screen.queryByTitle('Click to copy')).not.toBeInTheDocument();
    });
  });

  describe('refresh', () => {
    test('refresh button fetches messages again', async () => {
      mockSuccessfulBoot();
      fetch.mockResolvedValueOnce(okJson({ messages: [] }));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /check for new/i })).toBeEnabled();
      });

      fireEvent.click(screen.getByRole('button', { name: /check for new/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/messages');
        expect(fetch).toHaveBeenCalledTimes(3);
      });
    });

    test('refresh button is disabled when no numbers are leased', async () => {
      fetch
        .mockResolvedValueOnce(okJson({ virtualNumbers: [] }))
        .mockResolvedValueOnce(errJson(500, { message: 'lease failed' }));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /check for new/i })).toBeDisabled();
      });
    });

    test('surfaces refresh failures via error banner', async () => {
      mockSuccessfulBoot();
      fetch.mockResolvedValueOnce(errJson(500, { message: 'boom' }));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /check for new/i })).toBeEnabled();
      });

      fireEvent.click(screen.getByRole('button', { name: /check for new/i }));

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch messages\. boom/)).toBeInTheDocument();
      });
    });

    test('handles 410 expired response by clearing state and surfacing error', async () => {
      fetch
        .mockResolvedValueOnce(okJson({ virtualNumbers: [activeNumber], maxCount: 1 }))
        .mockResolvedValueOnce({ ok: false, status: 410, json: async () => ({}) });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Your leased numbers have expired/)).toBeInTheDocument();
      });
    });
  });

  describe('leasing', () => {
    test('hides the lease action when the max lease count is reached', async () => {
      mockSuccessfulBoot();

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('+61 412 345 678')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /lease new number/i })).not.toBeInTheDocument();
    });

    test('shows lease button when below max count', async () => {
      mockSuccessfulBoot([], { numbers: [activeNumber], maxCount: 2 });

      render(<App />);

      await waitFor(() => expect(screen.getByText('+61 412 345 678')).toBeInTheDocument());

      expect(screen.getByText('New number')).toBeInTheDocument();
    });

    test('surfaces lease failures via error banner', async () => {
      fetch
        .mockResolvedValueOnce(okJson({ virtualNumbers: [] }))
        .mockResolvedValueOnce(errJson(500, { message: 'no capacity' }));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to lease numbers\. no capacity/)).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    test('handles API errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('API Error'));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch current numbers/)).toBeInTheDocument();
      });
    });
  });

  describe('filtering and search', () => {
    test('filters messages by selected number tab', async () => {
      const msgToFirst = sampleMessage({ id: 'a', body: 'First number message', to: '+61412345678' });
      const msgToSecond = sampleMessage({ id: 'b', body: 'Second number message', to: '+61498765432' });
      mockSuccessfulBoot([msgToFirst, msgToSecond], { numbers: [activeNumber, secondNumber], maxCount: 2 });

      render(<App />);

      await waitFor(() => expect(screen.getByText('First number message')).toBeInTheDocument());
      expect(screen.getByText('Second number message')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /\+61 412 345 678/ }));

      expect(screen.getByText('First number message')).toBeInTheDocument();
      expect(screen.queryByText('Second number message')).not.toBeInTheDocument();
    });

    test('filters messages by search query', async () => {
      mockSuccessfulBoot([
        sampleMessage({ id: 'a', from: 'GitHub', body: 'GitHub code 111222' }),
        sampleMessage({ id: 'b', from: 'Stripe', body: 'Stripe code 333444' }),
      ]);

      render(<App />);

      await waitFor(() => expect(screen.getByText(/GitHub code 111222/)).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/filter by sender/i), { target: { value: 'stripe' } });

      expect(screen.queryByText(/GitHub code 111222/)).not.toBeInTheDocument();
      expect(screen.getByText(/Stripe code 333444/)).toBeInTheDocument();
    });

    test('clears search via the clear button', async () => {
      mockSuccessfulBoot([sampleMessage({ body: 'My message body' })]);

      render(<App />);

      await waitFor(() => expect(screen.getByText('My message body')).toBeInTheDocument());

      const search = screen.getByPlaceholderText(/filter by sender/i);
      fireEvent.change(search, { target: { value: 'no-match' } });
      expect(screen.queryByText('My message body')).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText(/clear search/i));
      expect(screen.getByText('My message body')).toBeInTheDocument();
    });

    test('shows no-match empty state when search has no results', async () => {
      mockSuccessfulBoot([sampleMessage({ body: 'Only message' })]);

      render(<App />);

      await waitFor(() => expect(screen.getByText('Only message')).toBeInTheDocument());

      fireEvent.change(screen.getByPlaceholderText(/filter by sender/i), { target: { value: 'zzz' } });

      expect(screen.getByText('No matches')).toBeInTheDocument();
    });

    test('shows inbox empty state when no messages', async () => {
      mockSuccessfulBoot([]);

      render(<App />);

      await waitFor(() => expect(screen.getByText('Inbox empty')).toBeInTheDocument());
    });
  });

  describe('modal view', () => {
    test('opens modal when a message card is clicked', async () => {
      mockSuccessfulBoot([sampleMessage()]);

      render(<App />);

      await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument());

      fireEvent.click(screen.getByText('GitHub').closest('article'));

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(/detected one-time code/i)).toBeInTheDocument();
    });

    test('closes modal when Escape is pressed', async () => {
      mockSuccessfulBoot([sampleMessage()]);

      render(<App />);

      await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument());

      fireEvent.click(screen.getByText('GitHub').closest('article'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('copies OTP from modal hero action', async () => {
      mockSuccessfulBoot([sampleMessage()]);

      render(<App />);

      await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument());

      fireEvent.click(screen.getByText('GitHub').closest('article'));

      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: /copy code/i }));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('044921');
    });
  });

  describe('number tab interactions', () => {
    test('copies the virtual number when copy icon is clicked on tab', async () => {
      mockSuccessfulBoot();

      render(<App />);

      await waitFor(() => expect(screen.getByText('+61 412 345 678')).toBeInTheDocument());

      fireEvent.click(screen.getByTitle('Copy number'));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('+61412345678');
    });

    test('reverts to all tab after filtering by specific number', async () => {
      mockSuccessfulBoot([
        sampleMessage({ id: 'a', body: 'msg one', to: '+61412345678' }),
        sampleMessage({ id: 'b', body: 'msg two', to: '+61498765432' }),
      ], { numbers: [activeNumber, secondNumber], maxCount: 2 });

      render(<App />);

      await waitFor(() => expect(screen.getByText('msg one')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('tab', { name: /\+61 412 345 678/ }));
      expect(screen.queryByText('msg two')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /All numbers/i }));

      expect(screen.getByText('msg one')).toBeInTheDocument();
      expect(screen.getByText('msg two')).toBeInTheDocument();
    });
  });

  describe('modal close affordances', () => {
    test('closes modal when scrim is clicked', async () => {
      mockSuccessfulBoot([sampleMessage()]);

      render(<App />);

      await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument());

      fireEvent.click(screen.getByText('GitHub').closest('article'));
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      fireEvent.click(dialog.parentElement);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    test('closes modal when the close (X) button is clicked', async () => {
      mockSuccessfulBoot([sampleMessage()]);

      render(<App />);

      await waitFor(() => expect(screen.getByText('GitHub')).toBeInTheDocument());

      fireEvent.click(screen.getByText('GitHub').closest('article'));
      const dialog = screen.getByRole('dialog');

      fireEvent.click(within(dialog).getByTitle('Close'));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('formatting paths', () => {
    test('renders relative time labels for older messages', async () => {
      mockSuccessfulBoot([
        sampleMessage({ id: 'a', body: 'sec', receivedAt: new Date(Date.now() - 30_000).toISOString() }),
        sampleMessage({ id: 'b', body: 'min', receivedAt: new Date(Date.now() - 5 * 60_000).toISOString() }),
        sampleMessage({ id: 'c', body: 'hour', receivedAt: new Date(Date.now() - 3 * 3600_000).toISOString() }),
        sampleMessage({ id: 'd', body: 'day', receivedAt: new Date(Date.now() - 2 * 86400_000).toISOString() }),
      ]);

      render(<App />);

      await waitFor(() => expect(screen.getByText('sec')).toBeInTheDocument());

      expect(screen.getByText(/^30s ago$/)).toBeInTheDocument();
      expect(screen.getByText(/^5m ago$/)).toBeInTheDocument();
      expect(screen.getByText(/^3h ago$/)).toBeInTheDocument();
      // 2-day-old falls through to locale date string — just ensure it isn't "Xh ago".
      expect(screen.queryByText(/^48h ago$/)).not.toBeInTheDocument();
    });

    test('leaves non-AU numbers unformatted', async () => {
      const foreign = { ...activeNumber, msisdn: '+15551234567', virtualNumber: '+15551234567' };
      mockSuccessfulBoot([], { numbers: [foreign], maxCount: 1 });

      render(<App />);

      await waitFor(() => expect(screen.getByText('+15551234567')).toBeInTheDocument());
    });
  });

  describe('lease success with maxCount', () => {
    test('updates max lease count from leaseNumber response', async () => {
      fetch
        .mockResolvedValueOnce(okJson({ virtualNumbers: [] }))
        .mockResolvedValueOnce(okJson({ virtualNumbers: [activeNumber], maxCount: 3 }))
        .mockResolvedValueOnce(okJson({ messages: [] }));

      render(<App />);

      // With maxCount=3 and 1 leased, lease button should still be visible.
      await waitFor(() => expect(screen.getByText('New number')).toBeInTheDocument());
    });
  });

  describe('error response fallbacks', () => {
    test('falls back to statusText when response.json() rejects', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Boom',
        json: async () => { throw new Error('not JSON'); },
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch current numbers\. Server Boom/)).toBeInTheDocument();
      });
    });
  });
});
