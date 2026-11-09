/**
 * Geometry snapshots for the hand-built meshes in board.js.
 *
 * piecegeometry and capgeometry remap texture coordinates so each face shows
 * the right part of a piece texture sheet, and constructBurredBox builds the
 * table by hand. All three use THREE.Geometry/Face3/faceVertexUvs, which newer
 * three.js removed. The snapshots were recorded on three.js r110; a rewrite
 * must produce the same triangles, texture coordinates and normals.
 */

import {describe, it, expect}from 'vitest';
import {loadGeometry, triangles}from './helpers/board-geometry.js';

describe.each([
	['single texture sheet', false],
	['multi-file textures', true]
])('pieces with %s', (_, multiFile) => {
	const geo = loadGeometry({multiFile});

	it('flat stone', () => {
		expect(triangles(geo.piecegeometry('white'))).toMatchSnapshot();
	});

	it('capstone', () => {
		expect(triangles(geo.capgeometry('white'))).toMatchSnapshot();
	});

	it('black uses the same geometry as white', () => {
		expect(triangles(geo.piecegeometry('black'))).toEqual(triangles(geo.piecegeometry('white')));
		expect(triangles(geo.capgeometry('black'))).toEqual(triangles(geo.capgeometry('white')));
	});
});

describe('constructBurredBox', () => {
	const {constructBurredBox} = loadGeometry({multiFile: false});

	it('table', () => {
		expect(triangles(constructBurredBox(800, 40, 600, 5, 5, 5))).toMatchSnapshot();
	});

	it('is centred on the origin', () => {
		const g = constructBurredBox(800, 40, 600, 5, 5, 5);
		g.computeBoundingBox();
		expect(g.boundingBox.min.toArray()).toEqual([-400, -20, -300]);
		expect(g.boundingBox.max.toArray()).toEqual([400, 20, 300]);
	});
});
