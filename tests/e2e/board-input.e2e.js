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
