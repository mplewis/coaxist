module.exports = {
  parserOptions: { project: true },
  ignorePatterns: [".eslintrc.js"],
  extends: ["airbnb-base", "airbnb-typescript/base", "prettier"],
  plugins: ["import", "jsdoc"],
  rules: {
    "import/order": [
      "warn",
      { alphabetize: { order: "asc" }, "newlines-between": "always" },
    ],
    "import/prefer-default-export": "off",

    "jsdoc/require-jsdoc": ["warn", { enableFixer: false, publicOnly: true }],

    "max-classes-per-file": "off",
    "no-continue": "off",
    "no-labels": "off",
    "no-multiple-empty-lines": "warn",
    "no-plusplus": "off",
    "no-restricted-globals": ["error", "fetch"],
    "no-restricted-syntax": "off",
  },
};
