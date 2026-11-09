/**
 * Board settings chosen in the settings panel must survive a reload: in
 * localStorage, in the settings inputs, and on the rendered board.
 */

import {test, expect}from '@playwright/test';

async function open(page){
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	// border text is built after its font loads
	await page.waitForTimeout(1000);
}

function readColours(page){
	return page.evaluate(() => ({
		storedBorder: localStorage.borderColor,
		storedLetter: localStorage.letterColor,
		borderInput: document.getElementById('borderColor').value,
		letterInput: document.getElementById('letterColor').value,
		borderOnBoard: '#' + materials.borders[0].material.color.getHexString(),
		letterOnBoard: '#' + materials.letter.color.getHexString()
	}));
}

test.beforeEach(async({page}) => {
	await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
	await page.routeWebSocket(/.*/, () => {});
});

test('first visit uses the default overlay colours', async({page}) => {
	await open(page);
	const defaults = await page.evaluate(() => [boardDefaults.borderColor, boardDefaults.letterColor]);
	const c = await readColours(page);
	expect([c.borderInput, c.letterInput]).toEqual(defaults);
	expect([c.borderOnBoard, c.letterOnBoard]).toEqual(defaults);
});

for(const overlay of [null, 'aaron', 'none']){
	test(`border and letter colours survive a reload (overlay: ${overlay ?? 'never chosen'})`, async({page}) => {
		await open(page);
		if(overlay){await page.evaluate((id) => setOverlayStyle(id, id), overlay);}
		await setColoursAndReload(page);
	});
}

async function setColoursAndReload(page){
	await page.evaluate(() => {
		document.getElementById('borderColor').value = '#ff0000';
		notifyBorderColorChange();
		document.getElementById('letterColor').value = '#00ff00';
		notifyLetterColorChange();
	});
	const expected = {
		storedBorder: '#ff0000', storedLetter: '#00ff00',
		borderInput: '#ff0000', letterInput: '#00ff00',
		borderOnBoard: '#ff0000', letterOnBoard: '#00ff00'
	};
	expect(await readColours(page)).toEqual(expected);

	await page.reload();
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(1000);
	expect(await readColours(page)).toEqual(expected);
}
