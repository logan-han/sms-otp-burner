// Mock axios for backend tests
const mockAxios = {
  post: jest.fn(() => {
    // Default: simulate auth failure
    return Promise.reject({
      response: {
        status: 401,
        data: { error: 'invalid_client' }
      }
    });
  }),
  get: jest.fn(() => {
    return Promise.reject({
      response: {
        status: 404,
        data: { error: 'not_found' }
      }
    });
  }),
  delete: jest.fn(() => {
    return Promise.reject({
      response: {
        status: 404,
        data: { error: 'not_found' }
      }
    });
  }),
  create: jest.fn(() => mockAxios)
};

// Also provide a default export
mockAxios.default = mockAxios;

module.exports = mockAxios;
