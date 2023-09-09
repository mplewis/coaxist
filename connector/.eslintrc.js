module.exports = {
  parserOptions: { project: true },
  ignorePatterns: [".eslintrc.js"],
  extends: ["airbnb-base", "airbnb-typescript/base", "prettier"],
  rules: {
    "no-console": "error",
    "import/prefer-default-export": "off",
    "no-restricted-syntax": "off",
  },
};
