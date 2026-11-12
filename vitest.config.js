import {defineConfig}from 'vitest/config';
import {fileURLToPath}from 'url';

// the vendored three.js addons import 'three' by name, which the browser resolves through the import map in index.html
const three = (file) => fileURLToPath(new URL('./src/js/thirdparty/three/' + file, import.meta.url));

export default defineConfig({
	resolve: {
		alias: [
			{find: /^three$/, replacement: three('three.module.js')},
			{find: /^three\/addons\//, replacement: three('addons/')}
		]
	}
});
