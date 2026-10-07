import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const proxyPort = env.PORT || "8080";
  const devPort = env.VITE_DEV_PORT ? Number(env.VITE_DEV_PORT) : undefined;
  const proxy = {
    "/api": {
      target: `http://localhost:${proxyPort}`,
      changeOrigin: true,
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: devPort,
      strictPort: Boolean(devPort),
      fs: { allow: [".."] },
      proxy,
    },
    preview: {
      proxy,
    },
  };
});
