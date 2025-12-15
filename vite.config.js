import { defineConfig } from "vite";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

export default defineConfig({
  build: {
    lib: {
      entry: "src/widget.ts",
      name: "PBChatWidget",
      formats: ["iife"],
      fileName: () => `pb-chat-widget@${pkg.version}.min.js`,
    },
    minify: "terser",
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
