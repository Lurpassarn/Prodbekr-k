module.exports = [
    {
      files: ["**/*.js"],
      languageOptions: {
        ecmaVersion: 2021,
        sourceType: "module"
      },
      linterOptions: {
        reportUnusedDisableDirectives: true
      },
      rules: {
        semi: "error",
        quotes: ["error", "double"]
      }
    }
  ];
  