import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.test.ts'],
		alias: {
			'$lib': '/src/lib',
			'$lib/*': '/src/lib/*',
		},
	},
});
