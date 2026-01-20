import { defineConfig } from 'vite'

const defaultBase = '/libc-scanner-timekeeping-webapp/'

export default defineConfig(() => ({
  base: process.env.VITE_BASE_PATH ?? defaultBase,
  build: {
    target: 'esnext',
  },
}))
