import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "~": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/integration/**/*.test.ts"],
  },
  lint: {
    ignorePatterns: [".void/**", ".wrangler/**", "dist/**", "db/migrations/**"],
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["src/**/*.test.ts", "tests/**/*.test.ts"],
        // Request mocks inspect known string inputs.
        rules: { "typescript/no-base-to-string": "off" },
      },
    ],
  },
  fmt: {
    ignorePatterns: [".void/**", ".wrangler/**", "dist/**", "db/migrations/**", "pnpm-lock.yaml"],
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
