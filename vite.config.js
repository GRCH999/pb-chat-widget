import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/widget.ts",
      name: "PBChatWidget",
      formats: ["iife"],
      fileName: () => "pb-chat-widget.min.js",
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
