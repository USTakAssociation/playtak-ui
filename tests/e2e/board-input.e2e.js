/**
 * Mouse input on the 3D board. OrbitControls listens on the same canvas as the
 * board's own click handling, so a click must still place a stone and a drag
 * must still rotate the view without making a move. Moves are animated, so the
 * checks look at where pieces end up on screen, not only at the game state.
 */

import {test, expect}from '@playwright/test';

let errors;

test.beforeEach(async({page}) => {
	errors = [];
	// animation frames throw outside any awaited call, so collect them here
	page.on('pageerror', (e) => errors.push(e.stack || e.message));
	await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
	await page.routeWebSocket(/.*/, () => {});
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	// the default page is a scratch board behind the landing panel
	await page.evaluate(() => hideElement('landing'));
});

test.afterEach(() => {
	expect(errors).toEqual([]);
});

// Screen position of a 3D point, from the live camera.
function toScreen(page, getPosition){
	return page.evaluate((src) => {
		const p = new Function('return ' + src)().clone().project(camera);
		const r = canvas.getBoundingClientRect();
		return {x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height};
	}, getPosition);
}

const square = (file, rank) => `board.board_objects.find((s) => s.file === ${file} && s.rank === ${rank})`;

test('clicking a square places a stone on it', async({page}) => {
	await page.mouse.click(...Object.values(await toScreen(page, `${square(2, 2)}.position`)));
	await expect.poll(() => page.evaluate(() => gameData.move_count)).toBe(1);
	// the stone must finish its animation on the square, not stay in the reserve
	await expect.poll(() => page.evaluate((sq) => {
		const s = new Function('return ' + sq)();
		const p = board.top_of_stack(s)?.position;
		return p ? [Math.round(p.x - s.position.x), Math.round(p.z - s.position.z)] : null;
	}, square(2, 2))).toEqual([0, 0]);
});

test('clicking a reserve stone lifts the selected stone', async({page}) => {
	const yBefore = await page.evaluate(() => board.piece_objects.map((p) => p.position.y));
	// any reserve flat will do: on the first turn the click selects the opponent's swapped stone
	await page.mouse.click(...Object.values(await toScreen(
		page,
		'board.piece_objects.find((p) => !p.onsquare && !p.iscapstone && p.iswhitepiece).position'
	)));
	await expect.poll(() => page.evaluate((before) => {
		const i = board.piece_objects.indexOf(board.selected);
		return i < 0 ? null : board.selected.position.y - before[i];
	}, yBefore)).toBeGreaterThan(0);
});

test('dragging rotates the view without making a move', async({page}) => {
	const before = await page.evaluate(() => camera.position.toArray());
	// start at the bottom middle of the canvas, below the board
	const box = await page.locator('#gamecanvas').boundingBox();
	const start = {x: box.x + box.width * 0.5, y: box.y + box.height * 0.9};
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(start.x + 200, start.y, {steps: 10});
	await page.mouse.up();
	const after = await page.evaluate(() => camera.position.toArray());
	expect(after).not.toEqual(before);
	expect(await page.evaluate(() => gameData.move_count)).toBe(0);
});

test('a horizontal drag turns the view at the r110 speed', async({page}) => {
	const box = await page.locator('#gamecanvas').boundingBox();
	const before = await page.evaluate(() => controls.getAzimuthalAngle());
	const start = {x: box.x + box.width * 0.5, y: box.y + box.height * 0.9};
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(start.x + 100, start.y, {steps: 10});
	await page.mouse.up();
	const turned = Math.abs(await page.evaluate(() => controls.getAzimuthalAngle()) - before);
	// r110 turned 2π per canvas width dragged
	expect(turned).toBeCloseTo(2 * Math.PI * 100 / box.width, 2);
});

const wheelInputs = {'a mouse notch': [100], 'a fast mouse notch': [400], 'a 30px trackpad swipe': [10, 10, 10]};
for(const name in wheelInputs){
	const deltas = wheelInputs[name];
	test(`${name} zooms one r110 step`, async({page}) => {
		const box = await page.locator('#gamecanvas').boundingBox();
		await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.9);
		const distance = () => page.evaluate(() => camera.position.distanceTo(controls.target));
		const before = await distance();
		for(const d of deltas){await page.mouse.wheel(0, d);}
		await expect.poll(async() => await distance() / before).toBeCloseTo(1 / 0.95, 4);
	});
}

test('without WebGL2 the page falls back to the 2D board', async({browser}) => {
	const page = await browser.newPage();
	await page.addInitScript(() => {
		const getContext = HTMLCanvasElement.prototype.getContext;
		HTMLCanvasElement.prototype.getContext = function(type, ...args){
			return type === 'webgl2' ? null : getContext.call(this, type, ...args);
		};
	});
	await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
	await page.routeWebSocket(/.*/, () => {});
	const pageErrors = [];
	page.on('pageerror', (e) => pageErrors.push(e.message));
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	expect(await page.evaluate(() => is2DBoard)).toBe(true);
	expect(pageErrors).toEqual([]);
	await page.close();
});

test('every piece keeps casting a shadow after a move', async({page}) => {
	await page.mouse.click(...Object.values(await toScreen(page, `${square(2, 2)}.position`)));
	await expect.poll(() => page.evaluate(() => gameData.move_count)).toBe(1);
	await page.waitForTimeout(500);
	expect(await page.evaluate(() => board.piece_objects.filter((p) => !p.castShadow).length)).toBe(0);
});

test('a stone resting on the board has a contact shadow, hidden while it is lifted', async({page}) => {
	await page.mouse.click(...Object.values(await toScreen(page, `${square(2, 2)}.position`)));
	await expect.poll(() => page.evaluate(() => gameData.move_count)).toBe(1);
	const visible = (lift) => page.evaluate(({sq, lift}) => {
		const stone = board.top_of_stack(new Function('return ' + sq)());
		stone.position.y += lift;
		updateContactShadows();
		stone.position.y -= lift;
		return stone.contactShadow?.visible ?? false;
	}, {sq: square(2, 2), lift});
	await expect.poll(() => visible(0)).toBe(true);
	expect(await visible(60)).toBe(false);
});

test('a stone\'s contact shadow is drawn on top of the board overlay, not under it', async({page}) => {
	await page.mouse.click(...Object.values(await toScreen(page, `${square(2, 2)}.position`)));
	await expect.poll(() => page.evaluate(() => gameData.move_count)).toBe(1);
	// the overlay and the stone's landing both finish after the click returns
	await expect.poll(() => page.evaluate((sq) => {
		updateContactShadows();
		const patch = board.top_of_stack(new Function('return ' + sq)())?.contactShadow;
		if(!board.overlay?.parent || !patch?.visible){return null;}
		return patch.position.y >= board.overlay.position.y + board.overlay.geometry.parameters.height / 2;
	}, square(2, 2))).toBe(true);
});

test('loading a position keeps the table and fill lights', async({page}) => {
	const scenery = () => page.evaluate(() => {
		const types = [];
		scene.traverse((o) => {if(o.isLight){types.push(o.type);}});
		return [types.sort(), scene.children.includes(board.table)];
	});
	const before = await scenery();
	await page.evaluate(() => board.loadtps('x5/x5/x,1,12121,2,x/x5/x5 1 6'));
	expect(await scenery()).toEqual(before);
});

test('the brightness and shadow strength sliders set the lights and are kept across reloads', async({page}) => {
	const lights = () => page.evaluate(() => [shadowLight.intensity, board.hemisphereLight.intensity].map((n) => +n.toFixed(4)));
	const [main, fill] = await page.evaluate(() => [shadowLight.intensity, board.hemisphereLight.intensity]);
	// the settings panel is closed; drag the sliders by setting them and firing their input event
	const drag = (id, value) => page.locator(id).evaluate((el, v) => {
		el.value = v;
		el.dispatchEvent(new Event('input'));
	}, value);
	await drag('#light-brightness-slider', '150');
	await drag('#light-shadow-slider', '300');
	// brightness scales every light; shadow strength divides only the fill
	const expected = [+(main * 1.5).toFixed(4), +(fill * 1.5 / 3).toFixed(4)];
	expect(await lights()).toEqual(expected);
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expect.poll(lights).toEqual(expected);
	await expect(page.locator('#light-shadow-value')).toHaveText('300%');
});

test('the board has a contact shadow on the table, sized to the board', async({page}) => {
	await page.waitForTimeout(500);
	expect(await page.evaluate(() => {
		updateContactShadows();
		const s = boardContactShadow;
		return [s.visible, s.parent === scene, Math.round(s.scale.x - boardContactShadowMargin * 2)];
	})).toEqual([true, true, await page.evaluate(() => gameData.size * sq_size + border_size * 2)]);
});
