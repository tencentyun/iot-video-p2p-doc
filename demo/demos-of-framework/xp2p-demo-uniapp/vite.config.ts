import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      "@components": "/src/components",
      "@styles": "/src/styles",
    }
  },
  publicDir: "./public",
});
