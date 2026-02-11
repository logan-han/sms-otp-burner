import js from "@eslint/js";
import { fixupPluginRules } from "@eslint/compat";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import globals from "globals";

const reactBaseConfig = {
  plugins: {
    react: fixupPluginRules(reactPlugin),
    "react-hooks": fixupPluginRules(reactHooksPlugin),
  },
  languageOptions: {
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
  rules: {
    ...reactPlugin.configs.recommended.rules,
    ...reactHooksPlugin.configs.recommended.rules,
    "react/react-in-jsx-scope": "off",
  },
  settings: {
    react: { version: "detect" },
  },
};

export default [
  js.configs.recommended,

  // React frontend files
  {
    ...reactBaseConfig,
    files: ["src/**/*.js"],
    ignores: ["src/handler.js", "src/__tests__/**"],
    languageOptions: {
      ...reactBaseConfig.languageOptions,
      globals: {
        ...globals.browser,
        process: "readonly",
      },
    },
  },

  // Backend handler (Node.js / CommonJS)
  {
    files: ["src/handler.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },

  // Backend tests and mocks (Node.js / CommonJS + Jest)
  {
    files: ["src/__tests__/backend/**/*.js", "src/__tests__/__mocks__/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },

  // Frontend test files (Browser + Jest + React)
  {
    ...reactBaseConfig,
    files: ["src/__tests__/*.test.js"],
    ignores: ["src/__tests__/backend/**"],
    languageOptions: {
      ...reactBaseConfig.languageOptions,
      globals: {
        ...globals.browser,
        ...globals.jest,
        global: "readonly",
        process: "readonly",
      },
    },
  },
];
