/**
 * Tests for parsePTN's tag handling.
 *
 * getNotation writes every tag unconditionally, so an in-progress game is
 * stored with an empty Result: [Result ""]. The tag pattern required at least
 * one character between the quotes, so such a tag was neither captured as a tag
 * nor stripped from the body — it reached parsePTNMoves, which splits on
 * whitespace, and surfaced as the bogus plies `[Result` and `""]`.
 */

import {describe, it, expect}from 'vitest';
import {readFileSync}from 'fs';
import {fileURLToPath}from 'url';
import path from 'path';

// ptn.js is a plain script of globals rather than a module, so evaluate it and
// pull the functions out instead of importing them.
const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, '..', 'ptn.js'), 'utf8');
// Start at the tag pattern the three functions share, not at parsePTN itself,
// or the slice loses the const they close over.
const start = source.indexOf('const PTN_TAG_RE');
const end = source.indexOf('// A ply is either');
const {parsePTN, parsePTNHeader, parsePTNMoves} = new Function(
	source.slice(start, end) + '\nreturn {parsePTN, parsePTNHeader, parsePTNMoves};'
)();

// A double black stack game one ply in, as getNotation stores it mid-game:
// every tag present, Result still empty.
const IN_PROGRESS = [
	'[Site "PlayTak.com"]',
	'[Date "2026.8.10"]',
	'[Player1 "alice"]',
	'[Player2 "bob"]',
	'[Size "6"]',
	'[Komi "0"]',
	'[Flats "30"]',
	'[Caps "1"]',
	'[Opening "double black stack"]',
	'[Result ""]',
	'',
	'1. 2a1 f6',
	'2. d4'
].join('\r\n');

describe('parsePTNHeader', () => {
	it('captures a tag with an empty value', () => {
		expect(parsePTNHeader('[Result ""]')).toEqual({Result: ''});
	});

	it('still captures tags with values, alongside empty ones', () => {
		const tags = parsePTNHeader(IN_PROGRESS);
		expect(tags.Size).toEqual('6');
		expect(tags.Player1).toEqual('alice');
		expect(tags.Opening).toEqual('double black stack');
		expect(tags.Result).toEqual('');
	});

	it('reads a finished game\'s result', () => {
		expect(parsePTNHeader('[Result "R-0"]').Result).toEqual('R-0');
	});
});

describe('parsePTN', () => {
	it('keeps an empty-valued tag out of the move list', () => {
		const parsed = parsePTN(IN_PROGRESS);
		expect(parsed.moves).toEqual(['2a1', 'f6', 'd4']);
	});

	it('puts the opening ply first, so callers can key off the index', () => {
		expect(parsePTN(IN_PROGRESS).moves[0]).toEqual('2a1');
	});

	it('strips move numbers but keeps a real result token in the body', () => {
		const finished = '[Size "5"]\r\n[Result "R-0"]\r\n\r\n1. a1 e5\r\n2. c3 R-0\r\n';
		expect(parsePTN(finished).moves).toEqual(['a1', 'e5', 'c3', 'R-0']);
	});

	it('drops comments without disturbing the plies around them', () => {
		const commented = '[Size "5"]\r\n[Result ""]\r\n\r\n1. a1 {a note} e5\r\n';
		expect(parsePTN(commented).moves).toEqual(['a1', 'e5']);
	});
});

describe('parsePTNMoves', () => {
	it('ignores the blank tokens that trailing whitespace produces', () => {
		expect(parsePTNMoves('1. a1 e5  ')).toEqual(['a1', 'e5']);
	});
});
