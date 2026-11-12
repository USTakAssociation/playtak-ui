/**
 * Custom .glb pieces uploaded in the settings panel: they replace the built-in pieces of
 * their colour, fit the built-in pieces' slots, stay clickable, and survive a reload.
 */

import {test, expect}from '@playwright/test';
import {makeGLB}from '../helpers/glb.js';

let errors;

test.beforeEach(async({page}) => {
	errors = [];
	page.on('pageerror', (e) => errors.push(e.stack || e.message));
	await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
	await page.routeWebSocket(/.*/, () => {});
	await open(page);
});

test.afterEach(() => {
	expect(errors).toEqual([]);
});

async function open(page){
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => hideElement('landing'));
}

function chooseFile(page, colour, name, objects){
	return page.locator(`#custom-pieces-${colour}`).setInputFiles({
		name, mimeType: 'model/gltf-binary', buffer: Buffer.from(makeGLB(objects))
	});
}

// Upload and wait until the file is saved and on the board, which happens after the input's change event returns.
async function upload(page, colour, name, objects){
	await chooseFile(page, colour, name, objects);
	await expect(page.locator(`#custom-pieces-${colour}-name`)).toHaveText(name);
}

const fullSet = [
	{name: 'flat', size: [4, 1, 4]},
	{name: 'wall', size: [4, 4, 1]},
	// tall and thin, so the cap is limited by its 2× height
	{name: 'cap', size: [1, 4, 1]}
];

// Sizes of the drawn model and the built-in mesh of the first unplayed piece matching `which`, in world space.
function measure(page, which){
	return page.evaluate((src) => {
		const piece = board.piece_objects.find(new Function('p', 'return ' + src));
		const round = (box) => ({
			min: box.min.toArray().map(Math.round), max: box.max.toArray().map(Math.round)
		});
		piece.updateMatrixWorld(true);
		return {
			layer: piece.layers.mask,
			hitbox: round(new THREE.Box3().setFromBufferAttribute(piece.geometry.attributes.position).applyMatrix4(piece.matrixWorld)),
			model: piece.customModel ? round(new THREE.Box3().setFromObject(piece.customModel)) : null
		};
	}, which);
}

const whiteFlat = '!p.onsquare && !p.iscapstone && p.iswhitepiece';
const blackFlat = '!p.onsquare && !p.iscapstone && !p.iswhitepiece';
const whiteCap = '!p.onsquare && p.iscapstone && p.iswhitepiece';

test('a flat fills the built-in flat\'s box, and the other colour is unchanged', async({page}) => {
	await upload(page, 'white', 'set.glb', fullSet);
	await expect(page.locator('#custom-pieces-white-name')).toHaveText('set.glb');
	await expect(page.locator('#custom-pieces-white-upload')).toHaveCSS('display', 'none');

	const flat = await measure(page, whiteFlat);
	expect(flat.layer).toBe(2); // layer 1 only: not drawn, still clickable
	expect(flat.model).toEqual(flat.hitbox);

	const other = await measure(page, blackFlat);
	expect([other.layer, other.model]).toEqual([1, null]);
});

test('a cap keeps its proportions, standing on the cap\'s base up to twice as tall', async({page}) => {
	await upload(page, 'white', 'set.glb', fullSet);
	const cap = await measure(page, whiteCap);
	const height = cap.model.max[1] - cap.model.min[1];
	const width = cap.model.max[0] - cap.model.min[0];
	expect(cap.model.min[1]).toBe(cap.hitbox.min[1]);
	expect(height).toBe(132);
	expect(width).toBe(33);
});

test('clicking the part of a tall cap above the built-in cap picks the cap', async({page}) => {
	await upload(page, 'white', 'set.glb', fullSet);
	const point = await page.evaluate((src) => {
		const cap = board.piece_objects.find(new Function('p', 'return ' + src));
		const box = new THREE.Box3().setFromObject(cap.customModel);
		// near the top of the model, well above the built-in cap
		const p = new THREE.Vector3(cap.position.x, box.max.y - 10, cap.position.z).project(camera);
		const r = canvas.getBoundingClientRect();
		return {x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, capTop: cap.position.y + capstone_height / 2, y3d: box.max.y - 10};
	}, whiteCap);
	expect(point.y3d).toBeGreaterThan(point.capTop);
	await page.mouse.move(point.x, point.y);
	expect(await page.evaluate((src) => {
		const pick = board.mousepick();
		return pick[0] === 'piece' && pick[1] === board.piece_objects.find(new Function('p', 'return ' + src));
	}, whiteCap)).toBe(true);
});

test('a standing stone shows the wall model upright, and the flat model again when flattened', async({page}) => {
	await upload(page, 'white', 'set.glb', fullSet);
	// square to the axes, so the wall's thickness shows in its size
	await page.evaluate(() => {diagonal_walls = false;});
	const shape = () => page.evaluate((src) => {
		const piece = board.piece_objects.find(new Function('p', 'return ' + src));
		piece.updateMatrixWorld(true);
		const size = new THREE.Box3().setFromObject(piece.customModel).getSize(new THREE.Vector3());
		return size.toArray().map(Math.round);
	}, whiteFlat);
	await page.evaluate((src) => board.standup(board.piece_objects.find(new Function('p', 'return ' + src))), whiteFlat);
	expect(await shape()).toEqual([60, 60, 15]);
	await page.evaluate((src) => board.flatten(board.piece_objects.find(new Function('p', 'return ' + src))), whiteFlat);
	expect(await shape()).toEqual([60, 15, 60]);
});

test('without a wall model, the flat model is stood up like the built-in stone', async({page}) => {
	await upload(page, 'white', 'flat.glb', [{name: 'flat', size: [4, 1, 4]}]);
	await page.evaluate((src) => board.standup(board.piece_objects.find(new Function('p', 'return ' + src))), whiteFlat);
	const wall = await measure(page, whiteFlat);
	expect(wall.model).toEqual(wall.hitbox);
});

test('a cap-only file replaces only the cap', async({page}) => {
	await upload(page, 'white', 'cap.glb', [{name: 'cap', size: [1, 1, 1]}]);
	expect((await measure(page, whiteCap)).model).not.toBe(null);
	expect((await measure(page, whiteFlat)).model).toBe(null);
});

test('the file is kept across reloads until removed', async({page}) => {
	await upload(page, 'black', 'dark.glb', fullSet);
	await open(page);
	await expect(page.locator('#custom-pieces-black-name')).toHaveText('dark.glb');
	await expect.poll(async() => (await measure(page, blackFlat)).model).not.toBe(null);

	await page.evaluate(() => removeCustomPieces('black'));
	await expect(page.locator('#custom-pieces-black-upload')).toHaveCSS('display', 'block');
	expect((await measure(page, blackFlat)).model).toBe(null);
	await open(page);
	await page.waitForTimeout(500);
	expect((await measure(page, blackFlat)).model).toBe(null);
	await expect(page.locator('#custom-pieces-black-upload')).toHaveCSS('display', 'block');
});

test('a file without flat, wall or cap is refused and not saved', async({page}) => {
	await chooseFile(page, 'white', 'cube.glb', [{name: 'Cube', size: [1, 1, 1]}]);
	await expect(page.locator('#alert-text')).toHaveText('Could not use cube.glb: no object named flat, wall or cap; the file has: Cube, Cube-box');
	await expect(page.locator('#custom-pieces-white-upload')).toHaveCSS('display', 'block');
	expect((await measure(page, whiteFlat)).model).toBe(null);
});

test('a .glb chosen in the texture upload is refused with a pointer to Custom 3D Pieces', async({page}) => {
	await page.locator('#piecetexture').setInputFiles({
		name: 'cap.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from(makeGLB([{name: 'cap', size: [1, 1, 1]}]))
	});
	await expect(page.locator('#alert-text')).toHaveText('cap.glb is not an image; 3D models (.glb) go in Custom 3D Pieces');
	expect(await page.evaluate(() => localStorage.customPieces ?? null)).toBe(null);
});

test('a piece texture that fails to load does not stop the others from applying', async({page}) => {
	// a texture style saved before uploads were checked, holding a file that is not an image
	await page.evaluate(() => {
		localStorage.customPieces = '["broken"]';
		localStorage.broken = 'data:model/gltf-binary;base64,Z2xURgIAAAA=';
		localStorage.piece_style_white3 = 'broken';
		localStorage.set_custom_piece_white = 'broken';
	});
	await open(page);
	await page.evaluate(() => setPieceStyle('Bloom by Gruppler', 'black_bloom', 'black', false));
	await expect.poll(() => page.evaluate(() => {
		const flat = board.piece_objects.find((p) => !p.iscapstone && !p.iswhitepiece);
		return flat.material === materials.black_piece;
	})).toBe(true);
});

test('pieces with a custom model get no contact shadow; their own shadow outlines them', async({page}) => {
	await upload(page, 'white', 'cap.glb', [{name: 'cap', size: [1, 2, 1]}]);
	expect(await page.evaluate(() => {
		updateContactShadows();
		const visible = (p) => p.contactShadow?.visible ?? false;
		const cap = board.piece_objects.find((p) => p.iscapstone && p.iswhitepiece);
		const otherCap = board.piece_objects.find((p) => p.iscapstone && !p.iswhitepiece);
		return [visible(cap), visible(otherCap)];
	})).toEqual([false, true]);
});

test('loading a custom model leaves the lighting of the board and built-in pieces unchanged', async({page}) => {
	const square = () => page.evaluate(() => {
		const gl = renderer.getContext();
		updateContactShadows();
		renderer.render(scene, camera);
		const px = new Uint8Array(4);
		gl.readPixels(gl.drawingBufferWidth / 2, gl.drawingBufferHeight / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return [...px];
	});
	await page.evaluate(() => {dontanimate = true;});
	const before = await square();
	await upload(page, 'white', 'cap.glb', [{name: 'cap', size: [1, 2, 1]}]);
	expect(await square()).toEqual(before);
	expect(await page.evaluate(() => {
		const cap = board.piece_objects.find((p) => p.iscapstone && p.iswhitepiece);
		let envMap = null;
		cap.customModel.traverse((o) => {if(o.isMesh){envMap = o.material.envMap;}});
		// metal in the model still has something to reflect, without lighting the whole scene
		return [scene.environment, envMap !== null];
	})).toEqual([null, true]);
});
