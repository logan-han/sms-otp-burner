// Mock axios for backend tests
// Use a closure to store the current implementation
let currentImpl = () => Promise.reject({
  response: {
    status: 401,
    data: { error: 'invalid_client' }
  }
});

// The main mock function that delegates to currentImpl
const mockAxios = jest.fn((...args) => currentImpl(...args));

mockAxios.post = jest.fn(() => Promise.reject({
  response: {
    status: 401,
    data: { error: 'invalid_client' }
  }
}));

mockAxios.get = jest.fn(() => Promise.reject({
  response: {
    status: 404,
    data: { error: 'not_found' }
  }
}));

mockAxios.delete = jest.fn(() => Promise.reject({
  response: {
    status: 404,
    data: { error: 'not_found' }
  }
}));

mockAxios.create = jest.fn(() => mockAxios);
mockAxios.default = mockAxios;

// Override mockImplementation to set currentImpl
mockAxios.mockImplementation = (impl) => {
  currentImpl = impl;
  return mockAxios;
};

mockAxios.mockRejectedValue = (val) => {
  currentImpl = () => Promise.reject(val);
  return mockAxios;
};

mockAxios.mockResolvedValue = (val) => {
  currentImpl = () => Promise.resolve(val);
  return mockAxios;
};

module.exports = mockAxios;
