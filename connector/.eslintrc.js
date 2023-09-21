module.exports = {
  parserOptions: { project: true },
  ignorePatterns: [".eslintrc.js"],
  extends: ["airbnb-base", "airbnb-typescript/base", "prettier"],
  rules: {
    "import/prefer-default-export": "off",
    "max-classes-per-file": "off",
    "no-continue": "off",
    "no-labels": "off",
    "no-plusplus": "off",
    "no-restricted-syntax": "off",
  },
};
