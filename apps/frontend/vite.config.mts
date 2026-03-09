import { resolve } from 'path'
// viteStaticCopy contains some `require`, so we need to have our config as .mts instead of .ts.
// https://vitejs.dev/guide/troubleshooting.html#this-package-is-esm-only
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { defineConfig, normalizePath } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import pkg from '../../package.json' assert { type: 'json' }

function manualChunks(id: string) {
  const path = normalizePath(id)

  if (path.includes('/node_modules/')) {
    if (
      path.includes('/react/') ||
      path.includes('/react-dom/') ||
      path.includes('/scheduler/') ||
      path.includes('/react-router/')
    ) {
      return 'vendor-react'
    }
    if (path.includes('/@mui/') || path.includes('/@emotion/')) {
      return 'vendor-mui'
    }
    if (path.includes('/i18next/') || path.includes('/react-i18next/')) {
      return 'vendor-i18n'
    }
    return 'vendor'
  }

  if (path.includes('/libs/gi/page-home/')) return 'page-home'
  if (path.includes('/libs/gi/page-artifacts/')) return 'page-artifacts'
  if (path.includes('/libs/gi/page-weapons/')) return 'page-weapons'
  if (path.includes('/libs/gi/page-characters/')) return 'page-characters'
  if (path.includes('/libs/gi/page-teams/')) return 'page-teams'
  if (path.includes('/libs/gi/page-team/')) return 'page-team'
  if (path.includes('/libs/gi/page-archive/')) return 'page-archive'
  if (path.includes('/libs/gi/page-settings/')) return 'page-settings'
  if (path.includes('/libs/gi/page-doc/')) return 'page-doc'

  if (
    path.includes('/libs/gi/ui/') ||
    path.includes('/libs/common/ui/') ||
    path.includes('/libs/common/svgicons/') ||
    path.includes('/libs/gi/svgicons/')
  ) {
    return 'ui-core'
  }

  if (
    path.includes('/libs/gi/db/') ||
    path.includes('/libs/gi/db-ui/') ||
    path.includes('/libs/common/database/')
  ) {
    return 'data-core'
  }

  if (
    path.includes('/libs/gi/formula/') ||
    path.includes('/libs/gi/solver/') ||
    path.includes('/libs/game-opt/') ||
    path.includes('/libs/pando/')
  ) {
    return 'calc-core'
  }
}

export default defineConfig(() => ({
  base: '',
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/frontend',

  server: {
    port: 4200,
    host: 'localhost',
    // Locale assets are sourced from shared libs outside this app root.
    fs: {
      allow: ['../..'],
    },
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  plugins: [
    react(),
    nxViteTsPaths(),
    // Nx executor for vite does not support `assets` prop for copying files.
    // So we need to do it with this plugin. This works for both `build` and `serve`.
    viteStaticCopy({
      targets: [
        {
          src: normalizePath(
            resolve('../../libs/common/localization/assets/locales/**/*')
          ),
          dest: 'assets/locales',
        },
        {
          src: normalizePath(
            resolve('../../libs/gi/localization/assets/locales/**/*')
          ),
          dest: 'assets/locales',
        },
        {
          src: normalizePath(
            resolve('../../libs/gi/dm-localization/assets/locales/**/*')
          ),
          dest: 'assets/locales',
        },
        {
          src: normalizePath(
            resolve('../../libs/gi/silly-wisher-names/assets/locales/**/*')
          ),
          dest: 'assets/locales',
        },
        {
          src: normalizePath(resolve('../../apps/frontend/assets/*')),
          dest: 'assets',
        },
      ],
      // Force page to reload if we change any of the above files
      watch: {
        reloadPageOnChange: true,
      },
    }),
  ],

  define: {
    'process.env': process.env,
    __VERSION__: `"${pkg.version}"`,
  },

  // Uncomment this if you are using workers.
  worker: {
    // https://vitejs.dev/guide/migration#worker-plugins-is-now-a-function
    plugins: () => [nxViteTsPaths()],
  },

  build: {
    outDir: '../../dist/apps/frontend',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },

  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/frontend',
      provider: 'v8',
    },
  },
}))
