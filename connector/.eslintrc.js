module.exports = {
  parserOptions: { project: true },
  ignorePatterns: [".eslintrc.js"],
  extends: ["airbnb-base", "airbnb-typescript/base", "prettier"],
  plugins: ["import"],
  rules: {
    "import/prefer-default-export": "off",
    "import/order": [
      "warn",
      { alphabetize: { order: "asc" }, "newlines-between": "always" },
    ],
    "max-classes-per-file": "off",
    "no-continue": "off",
    "no-labels": "off",
    "no-multiple-empty-lines": "warn",
    "no-plusplus": "off",
    "no-restricted-syntax": "off",
  },
};
