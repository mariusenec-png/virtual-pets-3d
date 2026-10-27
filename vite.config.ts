/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from /<repository>/; the deploy workflow sets BASE_PATH.
// (Read through globalThis so this file needs no Node type definitions.)
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const base = env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // Also listen on the local network so the game can be tested from a phone on the same Wi-Fi.
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
