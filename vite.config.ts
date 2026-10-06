import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from './src/pwa/config';
import { securityHeadersPlugin } from './scripts/security-headers.mjs';

export default defineConfig({ plugins: [react(), VitePWA(pwaOptions), securityHeadersPlugin()] });
