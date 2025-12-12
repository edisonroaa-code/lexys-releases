import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    root: path.join(__dirname, 'src', 'renderer'),
    base: './',
    build: {
        outDir: '../../dist',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                assetFileNames: 'assets/[name]-[hash][extname]',
                chunkFileNames: 'assets/[name]-[hash].js',
                entryFileNames: 'assets/[name]-[hash].js'
            }
        }
    },
    plugins: [
        electron([
            {
                // Main-Process entry file of the Electron App.
                entry: path.join(__dirname, 'src/main/main.ts'),
                vite: {
                    build: {
                        outDir: path.join(__dirname, 'dist-electron'),
                        minify: process.env.NODE_ENV === 'production',
                    },
                },
            },
            {
                entry: path.join(__dirname, 'src/main/preload.ts'),
                onstart(options) {
                    options.reload()
                },
                vite: {
                    build: {
                        outDir: path.join(__dirname, 'dist-electron'),
                        minify: process.env.NODE_ENV === 'production',
                    },
                },
            },
        ]),
        renderer(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src/renderer'),
        },
    },
})
