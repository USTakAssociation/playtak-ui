/**
 * Custom .glb pieces must land in the same box as the built-in piece they replace,
 * whatever size, position or nesting they were modelled at, so stacking and walls keep working.
 */

import {describe, it, expect}from 'vitest';
import {readFileSync}from 'fs';
import {fileURLToPath}from 'url';
import path from 'path';
import *as THREE_CORE from 'three';
import {GLTFLoader}from 'three/addons/loaders/GLTFLoader.js';
import *as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {makeGLB}from '../helpers/glb.js';

const THREE = {...THREE_CORE, GLTFLoader, SkeletonUtils};
const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, '..', '..', 'src', 'js', 'custom-pieces.js'), 'utf8');
// custom-pieces.js is a plain script reading board.js's piece sizes as globals
const {fitModel, customPieceSlot, parseCustomPieces, customPieceEnvLightLine} = new Function('THREE', `
	const piece_size = 60, piece_height = 15, capstone_radius = 24, capstone_height = 66;
	${source}
	return {fitModel, customPieceSlot, parseCustomPieces, customPieceEnvLightLine};
`)(THREE);

it('three.js still has the shader line that custom models turn their environment light down in', () => {
	expect(THREE.ShaderChunk.lights_fragment_maps).toContain(customPieceEnvLightLine);
});

function boxOf(object){
	object.updateMatrixWorld(true);
	const box = new THREE.Box3().setFromObject(object);
	const r = (v) => v.toArray().map((n) => Math.round(n * 1000) / 1000 + 0);
	return {min: r(box.min), max: r(box.max)};
}

function cube(size, position = [0, 0, 0]){
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size));
	mesh.position.set(...position);
	return mesh;
}

describe('fitModel', () => {
	it('scales up to fill the box, centred on the footprint with its base at y = 0', () => {
		expect(boxOf(fitModel(cube([2, 0.5, 2], [10, 7, -3]), 60, 15, 60)))
			.toEqual({min: [-30, 0, -30], max: [30, 15, 30]});
	});

	it('keeps proportions, so a tall model is limited by the height', () => {
		expect(boxOf(fitModel(cube([1, 3, 1]), 48, 132, 48)))
			.toEqual({min: [-22, 0, -22], max: [22, 132, 22]});
	});

	it('fits the rotated outline of a rotated model', () => {
		const model = cube([10, 1, 20]);
		model.rotation.y = Math.PI / 2;
		expect(boxOf(fitModel(model, 60, 15, 30)))
			.toEqual({min: [-30, 0, -15], max: [30, 3, 15]});
	});

	it('accepts a model that is flat on one axis', () => {
		expect(boxOf(fitModel(cube([4, 0, 4]), 60, 15, 60)))
			.toEqual({min: [-30, 0, -30], max: [30, 0, 30]});
	});

	it('rejects a model with no size', () => {
		expect(() => fitModel(new THREE.Group(), 60, 15, 60)).toThrow('no size');
	});
});

describe('customPieceSlot', () => {
	it('matches the built-in pieces, with walls standing and caps up to twice as tall', () => {
		expect(customPieceSlot('flat')).toEqual([60, 15, 60]);
		expect(customPieceSlot('wall')).toEqual([60, 60, 15]);
		expect(customPieceSlot('cap')).toEqual([48, 132, 48]);
	});
});

describe('parseCustomPieces', () => {
	it('finds flat, wall and cap by name', async() => {
		const pieces = await parseCustomPieces(makeGLB([
			{name: 'flat', size: [4, 1, 4]},
			{name: 'wall', size: [4, 4, 1], position: [10, 0, 0]},
			{name: 'cap', size: [2, 5, 2], position: [20, 0, 0]}
		]));
		expect(boxOf(pieces.flat)).toEqual({min: [-2, -0.5, -2], max: [2, 0.5, 2]});
		expect(boxOf(pieces.wall)).toEqual({min: [8, -2, -0.5], max: [12, 2, 0.5]});
		expect(boxOf(pieces.cap)).toEqual({min: [19, -2.5, -1], max: [21, 2.5, 1]});
	});

	it('leaves missing pieces null, so a capstone-only file only replaces the cap', async() => {
		const pieces = await parseCustomPieces(makeGLB([{name: 'cap', size: [2, 5, 2]}]));
		expect([pieces.flat, pieces.wall]).toEqual([null, null]);
		expect(pieces.cap).not.toBe(null);
	});

	it('keeps the transforms of parent objects in the file', async() => {
		const pieces = await parseCustomPieces(makeGLB([
			{name: 'set', position: [0, 100, 0], children: [{name: 'cap', size: [2, 5, 2], position: [3, 0, 0]}]}
		]));
		expect(boxOf(pieces.cap)).toEqual({min: [2, 97.5, -1], max: [4, 102.5, 1]});
		expect(pieces.cap.parent).toBe(null);
	});

	it('finds the cap object, not a scene that is also named cap', async() => {
		const pieces = await parseCustomPieces(makeGLB([
			{name: 'cap', size: [2, 5, 2]},
			{name: 'flat', size: [4, 1, 4], position: [10, 0, 0]}
		], 'cap'));
		expect(boxOf(pieces.cap)).toEqual({min: [-1, -2.5, -1], max: [1, 2.5, 1]});
	});

	it('names what it found when there is no flat, wall or cap', async() => {
		await expect(parseCustomPieces(makeGLB([{name: 'Cube', size: [1, 1, 1]}])))
			.rejects.toThrow('no object named flat, wall or cap; the file has: Cube, Cube-box');
	});

	it('rejects files over the size limit before parsing them', async() => {
		await expect(parseCustomPieces(new ArrayBuffer(11 * 1024 * 1024))).rejects.toThrow('the limit is 10 MB');
	});
});
