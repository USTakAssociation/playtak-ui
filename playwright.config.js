import {defineConfig}from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	// .e2e.js so vitest's default *.test.js / *.spec.js pattern never picks these up
	testMatch: '**/*.e2e.js',
	snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
	fullyParallel: true,
	reporter: [['list'], ['html', {open: 'never'}]],
	use: {
		baseURL: 'http://localhost:3100',
		viewport: {width: 1280, height: 800},
		deviceScaleFactor: 1,
		browserName: 'chromium',
		// headless Chromium has no GPU; SwiftShader gives software WebGL that renders the same on every run
		launchOptions: {args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']}
	},
	expect: {
		toHaveScreenshot: {
			// shortcut: one global tolerance; loosen per test if the three.js upgrade needs it
			maxDiffPixelRatio: Number(process.env.SCREENSHOT_TOLERANCE ?? 0)
		}
	},
	webServer: {
		command: 'npx http-server ./src -p 3100 -c-1 -s',
		url: 'http://localhost:3100',
		reuseExistingServer: !process.env.CI
	}
});
