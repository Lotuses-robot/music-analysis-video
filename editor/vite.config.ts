import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const editorRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: editorRoot,
  plugins: [react()],
  publicDir: path.join(editorRoot, "..", "public"),
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: path.join(editorRoot, "dist"),
    emptyOutDir: true,
  },
});
