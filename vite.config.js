import { defineConfig } from "vite";
import pkg from "./package.json" assert { type: "json" };

export default defineConfig({
  build: {
    lib: {
      entry: "src/widget.ts",
      name: "PBChatWidget",
      formats: ["iife"],
      fileName: () => `pb-chat-widget@${pkg.version}.min.js`
    },
    minify: "terser",
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
});
