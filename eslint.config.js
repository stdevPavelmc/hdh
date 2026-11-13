import js from "@eslint/js";
import globals from "globals";

const extensionGlobals = { messenger: "readonly", browser: "readonly" };

export default [
  { ignores: ["dist/", ".tbprofile/", ".cache/", "src/vendor/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...extensionGlobals },
    },
  },
  {
    // Compose scripts are injected as classic scripts, not modules.
    files: ["src/compose/**/*.js"],
    languageOptions: { sourceType: "script" },
  },
  {
    files: ["tests/**/*.js", "*.config.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node, ...globals.browser } },
  },
];
