import js from "@eslint/js";
import ts from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";

export default ts.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "editor/dist/**", "out/**"],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsdoc": jsdoc,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-explicit-any": "warn", // 改为 warn
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      // JSDoc 强制规范
      "jsdoc/require-jsdoc": [
        "warn",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: true,
            FunctionExpression: true,
          },
          contexts: [
            "VariableDeclarator > ArrowFunctionExpression",
            "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression",
          ],
        },
      ],
      "jsdoc/require-description": "warn",
      "jsdoc/require-param": "warn",
      "jsdoc/require-param-description": "warn",
      "jsdoc/require-returns": "off", // React 组件通常不需要显式声明 returns
      "jsdoc/check-tag-names": "warn",
      "jsdoc/no-undefined-types": "off",
    },
    settings: {
      jsdoc: {
        mode: "typescript",
      },
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  }
);
