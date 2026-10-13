import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves project sites from /<repository>/, not the domain root.
// Keep / for local Vite and standalone Node deployments.
const base = process.env.GITHUB_ACTIONS === 'true' ? '/dotdotdot/' : '/';
export default defineConfig({ plugins: [react()], base });
