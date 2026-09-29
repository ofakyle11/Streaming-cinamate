import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';
import { PWA_LOGO_SOURCE, PWA_THEME_COLOR } from './src/pwa/config';

/**
 * Generates the favicon, PWA (64/192/512), maskable and apple-touch icons
 * from the SVG logo mark at build time (vite-plugin-pwa `pwaAssets`).
 * Opaque icons use the app background instead of the preset's white.
 */
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: PWA_THEME_COLOR },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: PWA_THEME_COLOR },
    },
  },
  images: [PWA_LOGO_SOURCE],
});
