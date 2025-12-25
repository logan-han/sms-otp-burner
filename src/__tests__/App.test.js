import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

global.fetch = jest.fn();

describe('App Component', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('renders SMS OTP Burner heading', () => {
    render(<App />);
    const heading = screen.getByText('📱 SMS OTP Burner');
    expect(heading).toBeInTheDocument();
  });

  test('shows loading state initially', () => {
    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('fetches virtual numbers on mount', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ virtualNumbers: [] })
    });

    render(<App />);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/virtual-numbers');
    });
  });

  test('displays leased number information', async () => {
    const mockNumber = {
      msisdn: '+61412345678',
      virtualNumber: '+61412345678',
      subscriptionId: 'sub123',
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ virtualNumbers: [mockNumber] })
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('📱 Virtual Number')).toBeInTheDocument();
    });
    
    expect(screen.getByText('+61412345678')).toBeInTheDocument();
  });

  test('displays messages when available', async () => {
    const mockNumber = {
      virtualNumber: '+61412345678',
      msisdn: '+61412345678',
      subscriptionId: 'sub123',
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };

    const mockMessages = [
      {
        from: '+61987654321',
        body: 'Your OTP is 123456',
        to: '+61412345678',
        receivedAt: new Date().toISOString()
      }
    ];

    const fetchSpy = jest.fn().mockImplementation((url) => {
      if (url.includes('/api/virtual-numbers')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ virtualNumbers: [mockNumber] })
        });
      } else if (url.includes('/api/messages')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ messages: mockMessages })
        });
      }
      return Promise.reject(new Error(`Unmocked URL: ${url}`));
    });
    
    global.fetch = fetchSpy;

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('+61412345678')).toHaveLength(2);
    }, { timeout: 2000 });

    await waitFor(() => {
      expect(screen.getByText('Your OTP is 123456')).toBeInTheDocument();
    }, { timeout: 2000 });
    
    expect(screen.getByText('+61987654321')).toBeInTheDocument();
  });

  test('handles API errors gracefully', async () => {
    fetch.mockRejectedValueOnce(new Error('API Error'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Error leasing numbers/)).toBeInTheDocument();
    });
  });

  test('refresh messages button works', async () => {
    const mockNumber = {
      msisdn: '+61412345678',
      virtualNumber: '+61412345678',
      subscriptionId: 'sub123',
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ virtualNumbers: [mockNumber] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] })
      });

    render(<App />);

    await waitFor(() => {
      const refreshButton = screen.getByRole('button', { name: /Refresh/i });
      expect(refreshButton).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [] })
    });

    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/messages');
    });
  });

  test('handles 404 response from virtual-numbers gracefully', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not found' })
    });

    render(<App />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/virtual-numbers');
    });

    expect(screen.queryByText(/Failed to fetch current numbers/)).not.toBeInTheDocument();
  });

  test('handles non-404 error response from virtual-numbers', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Server error' })
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch current numbers/)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  test('handles expired virtual number', async () => {
    const expiredNumber = {
      msisdn: '+61412345678',
      virtualNumber: '+61412345678',
      subscriptionId: 'sub123',
      expiryDate: new Date(Date.now() - 86400000).toISOString(),
      expiresAt: new Date(Date.now() - 86400000).toISOString()
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ virtualNumbers: [expiredNumber] })
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ virtualNumbers: [{ 
        msisdn: '+61412345679', 
        virtualNumber: '+61412345679',
        subscriptionId: 'sub124',
        expiryDate: new Date(Date.now() + 86400000).toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      }] })
    });

    render(<App />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/virtual-numbers');
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/leaseNumber', { method: 'POST' });
    });
  });

  test('handles 410 response when fetching messages (expired number)', async () => {
    const mockNumber = {
      msisdn: '+61412345678',
      virtualNumber: '+61412345678',
      subscriptionId: 'sub123',
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ virtualNumbers: [mockNumber] })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 410,
        json: async () => ({ message: 'Number expired' })
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Your leased numbers have expired/)).toBeInTheDocument();
    });
  });

  test('clipboard button shows checkmark when clicked', async () => {
    const mockNumber = {
      msisdn: '+61412345678',
      virtualNumber: '+61412345678',
      subscriptionId: 'sub123',
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ virtualNumbers: [mockNumber] })
    });

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockImplementation(() => Promise.resolve())
      }
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('+61412345678')).toBeInTheDocument();
    });
    
    // Find the clipboard button and click it
    const clipboardButton = screen.getByTitle('Copy number');
    fireEvent.click(clipboardButton);
    
    // Check that the clipboard API was called with the correct number
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('+61412345678');
    
    // Check that the checkmark emoji is displayed
    expect(screen.getByTitle('Copied!')).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
    
    // Wait for the checkmark to change back to clipboard
    await waitFor(() => {
      expect(screen.getByText('📋')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('handles multiple virtual numbers display', async () => {
    const mockNumbers = [
      {
        msisdn: '+61412345678',
        virtualNumber: '+61412345678',
        subscriptionId: 'sub123',
        expiryDate: new Date(Date.now() + 86400000).toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      },
      {
        msisdn: '+61412345679',
        virtualNumber: '+61412345679', 
        subscriptionId: 'sub124',
        expiryDate: new Date(Date.now() + 86400000).toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      }
    ];

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ virtualNumbers: mockNumbers })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] })
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('📱 Virtual Numbers (2)')).toBeInTheDocument();
    });
    
    expect(screen.getByText('+61412345678')).toBeInTheDocument();
    expect(screen.getByText('+61412345679')).toBeInTheDocument();
  });

  test('displays messages with recipient number in table', async () => {
    const mockNumbers = [
      {
        msisdn: '+61412345678',
        virtualNumber: '+61412345678',
        subscriptionId: 'sub123',
        expiryDate: new Date(Date.now() + 86400000).toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      }
    ];

    const mockMessages = [
      {
        from: '+61987654321',
        body: 'Your OTP is 123456',
        to: '+61412345678',
        receivedAt: new Date().toISOString()
      }
    ];

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ virtualNumbers: mockNumbers })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: mockMessages })
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('+61412345678')).toHaveLength(2);
    });
      
    expect(screen.getByText('Your OTP is 123456')).toBeInTheDocument();
    expect(screen.getByText('+61987654321')).toBeInTheDocument();

    expect(screen.getByText('To Number')).toBeInTheDocument();
  });

  test('handles automatic lease number with account limit error', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ virtualNumbers: [] })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ 
          error: 'ACCOUNT_LIMIT_ERR', 
          message: 'Account limit reached',
          suggestion: 'Please upgrade your account'
        })
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to lease numbers/)).toBeInTheDocument();
    });
  });

  test('handles automatic lease number with network error', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ virtualNumbers: [] })
      })
      .mockRejectedValueOnce(new Error('Network error'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Error leasing numbers/)).toBeInTheDocument();
    });
  });

  test('displays messages sorted by latest first', async () => {
    const mockNumber = {
      virtualNumber: '+61412345678',
      msisdn: '+61412345678',
      subscriptionId: 'sub123',
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };

    const mockMessages = [
      {
        from: '+61987654321',
        body: 'Older message',
        to: '+61412345678',
        receivedAt: new Date(Date.now() - 60000).toISOString()
      },
      {
        from: '+61987654322',
        body: 'Newer message',
        to: '+61412345678',
        receivedAt: new Date().toISOString()
      }
    ];

    const fetchSpy = jest.fn().mockImplementation((url) => {
      if (url.includes('/api/virtual-numbers')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ virtualNumbers: [mockNumber] })
        });
      } else if (url.includes('/api/messages')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ messages: mockMessages })
        });
      }
      return Promise.reject(new Error(`Unmocked URL: ${url}`));
    });
    
    global.fetch = fetchSpy;

    render(<App />);

    await waitFor(() => {
      const firstMessageCell = screen.getAllByRole('cell').find(cell => 
        cell.textContent.includes('Newer message')
      );
      expect(firstMessageCell).toBeInTheDocument();
    }, { timeout: 3000 });
    
    const messageCells = screen.getAllByRole('cell').filter(cell => 
      cell.textContent.includes('message')
    );
    expect(messageCells[0]).toHaveTextContent('Newer message');
    expect(messageCells[1]).toHaveTextContent('Older message');
  });

  test('handles error when fetching messages returns malformed JSON', async () => {
    const mockNumber = {
      virtualNumber: '+61412345678',
      msisdn: '+61412345678',
      subscriptionId: 'sub123',
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ virtualNumbers: [mockNumber] })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch messages/)).toBeInTheDocument();
    });
  });

  test('handles fetchCurrentNumber error when JSON parsing fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch current numbers/)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  test('handles lease number error when JSON parsing fails', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ virtualNumbers: [] })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to lease numbers/)).toBeInTheDocument();
    });
  });

  test('displays separate date and time columns for messages', async () => {
    const mockNumber = {
      virtualNumber: '+61412345678',
      msisdn: '+61412345678',
      subscriptionId: 'sub123',
      expiryDate: new Date(Date.now() + 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };

    const mockMessages = [
      {
        from: '+61987654321',
        body: 'Test message',
        to: '+61412345678',
        receivedAt: new Date('2025-06-17T10:30:45Z').toISOString()
      }
    ];

    const fetchSpy = jest.fn().mockImplementation((url) => {
      if (url.includes('/api/virtual-numbers')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ virtualNumbers: [mockNumber] })
        });
      } else if (url.includes('/api/messages')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ messages: mockMessages })
        });
      }
      return Promise.reject(new Error(`Unmocked URL: ${url}`));
    });
    
    global.fetch = fetchSpy;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
  });

  test('refresh button is disabled when no subscription ID', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ virtualNumbers: [] })
    });

    render(<App />);

    await waitFor(() => {
      const refreshButton = screen.getByRole('button', { name: /Refresh/i });
      expect(refreshButton).toBeDisabled();
    }, { timeout: 2000 });
  });
});
