// Mock for @telstra/messaging
const VirtualNumbers = jest.fn().mockImplementation(() => ({
  assign: jest.fn().mockResolvedValue({
    virtualNumber: '0429927886',
    subscriptionId: 'sub123',
    expiryDate: '2025-06-17T00:00:00Z'
  }),
  delete: jest.fn().mockResolvedValue({ success: true }),
  getAll: jest.fn().mockResolvedValue({
    virtualNumbers: []
  })
}));

const Messages = jest.fn().mockImplementation(() => ({
  getMessages: jest.fn().mockResolvedValue({ messages: [] }),
  getAll: jest.fn().mockResolvedValue({ messages: [] })
}));

module.exports = {
  VirtualNumbers,
  Messages
};
