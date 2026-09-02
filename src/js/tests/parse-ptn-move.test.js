/**
 * Tests for matchPTNPlacement and matchPTNMovement.
 *
 * The two ply patterns were written inline at each PTN load site, and drifted:
 * ranks were matched as [0-8] and drop counts as \d*, so "a0" and "a1>0" were
 * accepted. Neither is real notation — rank 0 becomes y === -1 (an index off
 * the front of the grid) and a drop of 0 moves no pieces — and both corrupted
 * the board silently rather than being rejected at the parse.
 */

import {describe, it, expect}from 'vitest';
import {readFileSync}from 'fs';
import {fileURLToPath}from 'url';
import path from 'path';

// ptn.js is a plain script of globals rather than a module, so evaluate it and
// pull the functions out instead of importing it.
const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, '..', 'ptn.js'), 'utf8');
const start = source.indexOf('const PTN_PLACEMENT_RE');
const end = source.indexOf('function ptnDurationToSeconds');
const {matchPTNPlacement, matchPTNMovement} = new Function(
	source.slice(start, end) + '\nreturn {matchPTNPlacement, matchPTNMovement};'
)();

describe('matchPTNPlacement', () => {
	it('accepts a flat, wall and capstone on every rank', () => {
		expect(matchPTNPlacement('a1')).not.toEqual(null);
		expect(matchPTNPlacement('Sc3')).not.toEqual(null);
		expect(matchPTNPlacement('Cd4')).not.toEqual(null);
		expect(matchPTNPlacement('Fh8')).not.toEqual(null);
	});

	it('reads the piece, file and rank into capture groups', () => {
		const match = matchPTNPlacement('Sc3');
		expect(match[1]).toEqual('S');
		expect(match[2]).toEqual('c');
		expect(match[3]).toEqual('3');
	});

	it('rejects rank 0, which would index off the front of the grid', () => {
		expect(matchPTNPlacement('a0')).toEqual(null);
		expect(matchPTNPlacement('Sc0')).toEqual(null);
	});

	it('rejects squares off the far edge of the largest board', () => {
		expect(matchPTNPlacement('a9')).toEqual(null);
		expect(matchPTNPlacement('i1')).toEqual(null);
	});

	it('rejects a movement, so callers fall through to the movement pattern', () => {
		expect(matchPTNPlacement('3c3>111')).toEqual(null);
	});
});

describe('matchPTNMovement', () => {
	it('accepts a movement in each of its shapes', () => {
		expect(matchPTNMovement('a1+')).not.toEqual(null);
		expect(matchPTNMovement('3c3>111')).not.toEqual(null);
		expect(matchPTNMovement('2d4-11')).not.toEqual(null);
		expect(matchPTNMovement('5e5<32')).not.toEqual(null);
	});

	it('reads the count, square, direction and drops into capture groups', () => {
		const match = matchPTNMovement('3c3>111');
		expect(match[1]).toEqual('3');
		expect(match[2]).toEqual('c');
		expect(match[3]).toEqual('3');
		expect(match[4]).toEqual('>');
		expect(match[5]).toEqual('111');
	});

	// Both numbers are implied when absent: an omitted count is 1, and an
	// omitted drop list means the whole count lands on a single square. The
	// caller fills those in, so the pattern only has to allow them through.
	it('leaves the count and the drop list optional', () => {
		const oneDropped = matchPTNMovement('a1+');
		expect(oneDropped).not.toEqual(null);
		expect(oneDropped[1]).toEqual('');
		expect(oneDropped[5]).toEqual('');

		const threeDropped = matchPTNMovement('3a1+');
		expect(threeDropped).not.toEqual(null);
		expect(threeDropped[1]).toEqual('3');
		expect(threeDropped[5]).toEqual('');
	});

	it('rejects a drop of zero, which would move no pieces', () => {
		expect(matchPTNMovement('a1>0')).toEqual(null);
		expect(matchPTNMovement('3c3>101')).toEqual(null);
		expect(matchPTNMovement('2d4-20')).toEqual(null);
	});

	it('rejects rank 0, which would index off the front of the grid', () => {
		expect(matchPTNMovement('a0+')).toEqual(null);
		expect(matchPTNMovement('3c0>111')).toEqual(null);
	});

	it('rejects a placement, so callers fall through to the placement pattern', () => {
		expect(matchPTNMovement('a1')).toEqual(null);
		expect(matchPTNMovement('Sc3')).toEqual(null);
	});
});
