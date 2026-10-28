import { fileURLToPath } from "node:url";
import { builtinModules } from "node:module";
import { defineConfig } from "vite-plus";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";

const parentImports = { group: ["../**"], message: "Use ~/ for imports across directories." };
const browserLayers = {
  group: ["~/**", "!~/client/**", "!~/shared/**", "!~/pages/*.server"],
  message: "Browser code depends only on client and shared modules.",
};
const loaderTypes = {
  group: ["~/pages/*.server"],
  allowTypeImports: true,
  message: "Only inferred loader types may cross into browser code.",
};
const browserTestImports = {
  paths: ["void", "cloudflare:workers", "@schema"],
  patterns: [parentImports, browserLayers, loaderTypes, { group: ["void/*", "!void/client"] }],
};
const browserImports = {
  paths: [...browserTestImports.paths, ...builtinModules],
  patterns: [...browserTestImports.patterns, { group: ["node:*"] }],
};
const sharedTestImports = {
  paths: ["void", "cloudflare:workers", "@schema"],
  patterns: [
    parentImports,
    {
      group: ["void/*", "~/**", "!~/shared/**"],
      message: "Shared code stays browser-safe and independent.",
    },
  ],
};
const sharedImports = {
  paths: [...sharedTestImports.paths, ...builtinModules],
  patterns: [...sharedTestImports.patterns, { group: ["node:*"] }],
};
const serverImports = {
  group: ["~/**", "!~/server/**", "!~/shared/**", "!~/db/**"],
  message: "Server entries depend on server, shared and database modules.",
};

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/integration/**/*.test.ts"],
  },
  lint: {
    ignorePatterns: [".void/**", ".wrangler/**", "dist/**", "src/db/migrations/**"],
    options: { typeAware: true, typeCheck: true },
    rules: { "unicorn/filename-case": ["error", { case: "kebabCase" }] },
    overrides: [
      {
        files: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
        rules: { "no-restricted-imports": ["error", { patterns: [parentImports] }] },
      },
      {
        files: ["src/client/**/*.{ts,tsx}", "src/pages/**/*.tsx"],
        rules: { "no-restricted-imports": ["error", browserImports] },
      },
      {
        files: ["src/shared/**/*.ts"],
        rules: { "no-restricted-imports": ["error", sharedImports] },
      },
      {
        files: [
          "src/server/**/*.ts",
          "src/routes/**/*.ts",
          "src/queues/**/*.ts",
          "src/pages/**/*.server.ts",
        ],
        rules: { "no-restricted-imports": ["error", { patterns: [parentImports, serverImports] }] },
      },
      {
        // Better Auth loads this graph in native Node, which does not resolve Vite aliases.
        files: [
          "src/auth.ts",
          "src/server/project-from-bio.ts",
          "src/server/browser-run-budget.ts",
          "src/server/project-profile.ts",
          "src/db/schema.ts",
        ],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              patterns: [
                {
                  group: ["../**", "!../db/schema.ts", "!../shared/project-profile.ts"],
                  message: "Only the native auth graph may use these relative imports.",
                },
                serverImports,
              ],
            },
          ],
        },
      },
      {
        files: ["src/db/**/*.ts"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              patterns: [
                { group: ["../**", "!../shared/project-profile.ts"] },
                {
                  group: ["~/**", "!~/shared/**"],
                  message: "Database schemas depend only on shared contracts.",
                },
              ],
            },
          ],
        },
      },
      {
        files: ["src/client/**/*.test.ts"],
        rules: { "no-restricted-imports": ["error", browserTestImports] },
      },
      {
        files: ["src/shared/**/*.test.ts"],
        rules: { "no-restricted-imports": ["error", sharedTestImports] },
      },
      {
        files: ["src/**/*.test.ts", "tests/**/*.test.ts"],
        // Request mocks inspect known string inputs.
        rules: { "typescript/no-base-to-string": "off" },
      },
    ],
  },
  fmt: {
    ignorePatterns: [
      ".void/**",
      ".wrangler/**",
      "dist/**",
      "src/db/migrations/**",
      "pnpm-lock.yaml",
    ],
  },
  // X requires the exact registered callback origin, including hostname and port.
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  // These tests use Node and their own D1 instances, not the app development server.
  plugins:
    mode === "test"
      ? []
      : [
          {
            name: "local-oauth-origin",
            apply: "serve",
            configureServer(server) {
              server.middlewares.use((req, res, next) => {
                if (req.headers.host !== "localhost:5173") return next();
                res.writeHead(307, { Location: `http://127.0.0.1:5173${req.url ?? "/"}` });
                res.end();
              });
            },
          },
          voidPlugin(),
          voidReact({ react: { compiler: true }, viewTransitions: true }),
        ],
}));
