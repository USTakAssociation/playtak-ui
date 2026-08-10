/**
 * Tests for parsePTNClock.
 *
 * The PTN Clock tag is a time control, not a remaining time: a base duration,
 * an optional increment (with a trailing "n" when it scales with the move
 * number), and an optional "@move +duration" bonus. Loading a PTN used to
 * write the whole tag into both clock displays, so "10:0 +20 @35 +10:0"
 * appeared where a countdown belongs and the increment and bonus never
 * reached the rules row.
 */

import {describe, it, expect}from 'vitest';
import {readFileSync}from 'fs';
import {fileURLToPath}from 'url';
import path from 'path';

// ptn.js is a plain script of globals rather than a module, so evaluate it and
// pull the function out instead of importing it.
const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, '..', 'ptn.js'), 'utf8');
const start = source.indexOf('function ptnDurationToSeconds');
const end = source.indexOf('// Play Tak Server notation');
const {parsePTNClock} = new Function(
	source.slice(start, end) + '\nreturn {parsePTNClock};'
)();

describe('parsePTNClock', () => {
	it('reads a base duration in each of its shapes', () => {
		expect(parsePTNClock('30').time).toEqual(30);
		expect(parsePTNClock('1:30').time).toEqual(90);
		expect(parsePTNClock('10:0').time).toEqual(600);
		expect(parsePTNClock('3:0:0').time).toEqual(10800);
	});

	it('reads a fixed increment', () => {
		const clock = parsePTNClock('10:0 +20');
		expect(clock.increment).toEqual(20);
		expect(clock.incrementScales).toEqual(false);
	});

	it('reads an increment that scales with the move number', () => {
		const clock = parsePTNClock('3:0:0 +1n');
		expect(clock.time).toEqual(10800);
		expect(clock.increment).toEqual(1);
		expect(clock.incrementScales).toEqual(true);
	});

	it('reads bonus time granted at a move', () => {
		const clock = parsePTNClock('10:0 +20 @35 +10:0');
		expect(clock.triggerMove).toEqual(35);
		expect(clock.timeAmount).toEqual(600);
	});

	it('reads a time control using every part at once', () => {
		expect(parsePTNClock('3:0:0 +1n @30 +5:0')).toEqual({
			time: 10800,
			increment: 1,
			incrementScales: true,
			triggerMove: 30,
			timeAmount: 300
		});
	});

	it('defaults the optional parts to zero', () => {
		expect(parsePTNClock('5:0')).toEqual({
			time: 300,
			increment: 0,
			incrementScales: false,
			triggerMove: 0,
			timeAmount: 0
		});
	});

	it('returns null rather than zeroing the clock for a missing or unreadable tag', () => {
		expect(parsePTNClock(undefined)).toEqual(null);
		expect(parsePTNClock('')).toEqual(null);
		expect(parsePTNClock('garbage')).toEqual(null);
	});
});
