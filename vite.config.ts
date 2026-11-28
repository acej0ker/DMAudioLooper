import { defineConfig } from "vite";

// Spotify rejects "localhost" redirect URIs, so the dev server must use 127.0.0.1 (TDD §5).
export default defineConfig({
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
