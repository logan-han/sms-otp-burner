// Mock axios for backend tests
const mockAxios = {
  post: jest.fn(() => {
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

mockAxios.default = mockAxios;

module.exports = mockAxios;
