/**
 * Screenshot tests for the 3D board.
 *
 * Reference images were captured on three.js r110. They pin down how the board
 * looks so the three.js upgrade can be checked against them. Each case covers a
 * rendering path the upgrade touches: lighting with and without shadows, both
 * piece texture layouts, the hand-built table, and the edge letters.
 *
 * Update references:  pnpm test:e2e --update-snapshots
 * Compare with slack:  SCREENSHOT_TOLERANCE=0.02 pnpm test:e2e
 */

import {test, expect}from '@playwright/test';

const MIDGAME = '[Size "5"]\n1. a1 e5 2. c3 c2 3. Sd3 Cb3 4. Cd2 b2 5. c3- Sc4 6. d2< e4 7. a2 b4';
const OPENING_6 = '[Size "6"]';

async function openBoard(page, ptn, settings = {}){
	await page.addInitScript((s) => {
		for(const [k, v] of Object.entries(s)){localStorage.setItem(k, v);}
	}, settings);
	// keep the run offline: no playtak server, analytics or event feeds
	await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
	await page.routeWebSocket(/.*/, () => {});
	await page.goto('/?load=' + encodeURIComponent(ptn));
	await page.waitForLoadState('networkidle');
	// shortcut: fixed wait for textures/fonts plus the render loop's 1s idle redraw; replace with a scene-ready flag if it flakes
	await page.waitForTimeout(1500);
}

const cases = [
	['default', MIDGAME, {}],
	['shadows off', MIDGAME, {shadows_enabled: 'false'}],
	['multi-file pieces', MIDGAME, {piece_style_white3: 'white_coral', piece_style_black3: 'black_pietersite'}],
	['table', MIDGAME, {show_table: 'true'}],
	['6x6 opening', OPENING_6, {}]
];

for(const [name, ptn, settings] of cases){
	test(name, async({page}) => {
		await openBoard(page, ptn, settings);
		await expect(page).toHaveScreenshot(name.replace(/\W+/g, '-') + '.png');
	});
}
