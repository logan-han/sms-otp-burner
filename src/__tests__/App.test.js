import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

const mockSuccessfulBoot = (messages = []) => {
  fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ virtualNumbers: [activeNumber] }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages }),
    });
};

describe('App Component', () => {
  beforeEach(() => {
    fetch.mockReset();
    navigator.clipboard.writeText.mockClear();
  });

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

  test('surfaces OTP digits as the primary message action', async () => {
    mockSuccessfulBoot([
      {
        id: 'm1',
        from: 'GitHub',
        to: '+61412345678',
        body: 'GitHub verification code: 044-921',
        receivedAt: new Date().toISOString(),
      },
    ]);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /0\s*4\s*4\s*9\s*2\s*1 copy/i })).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Click to copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('044921');
  });

  test('refresh button fetches messages again', async () => {
    mockSuccessfulBoot();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [] }),
    });

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

  test('leases a number when none exist', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ virtualNumbers: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ virtualNumbers: [activeNumber] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] }),
      });

    render(<App />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/leaseNumber', { method: 'POST' });
    });
  });

  test('handles API errors gracefully', async () => {
    fetch.mockRejectedValueOnce(new Error('API Error'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch current numbers/)).toBeInTheDocument();
    });
  });
});
