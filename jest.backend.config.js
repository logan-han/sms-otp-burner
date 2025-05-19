module.exports = {
  testEnvironment: "node",
  testMatch: [
    "**/src/__tests__/backend/**/*.test.js"
  ],
  testPathIgnorePatterns: [
    "<rootDir>/src/__tests__/__mocks__/",
    "<rootDir>/src/__tests__/App.test.js"
  ],
  collectCoverageFrom: [
    "src/handler.js"
  ],
  moduleNameMapper: {
    "^axios$": "<rootDir>/src/__tests__/__mocks__/axios.js",
    "^@telstra/messaging$": "<rootDir>/src/__tests__/__mocks__/@telstra/messaging.js"
  }
};
