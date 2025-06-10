export default [
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
        // Standardregler här, t.ex:
        semi: "error",
        quotes: ["error", "double"]
      }
    }
  ];
  