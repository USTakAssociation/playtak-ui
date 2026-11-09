// Loads three.js and the geometry builders from board.js (a plain script of
// globals, not a module) so tests can inspect the meshes they produce.
import {readFileSync}from 'fs';
import {fileURLToPath}from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const jsDir = path.join(here, '..', '..', '..', 'src', 'js');

// three.min.js is a UMD bundle; handing it an exports object fills that in.
export const THREE = {};
new Function('exports', 'module', readFileSync(path.join(jsDir, 'thirdparty', 'three.min.js'), 'utf8'))(THREE, {});

function slice(source, from, to){
	const start = source.indexOf(from);
	const end = source.indexOf(to, start);
	if(start < 0 || end < 0){throw new Error(`could not find ${from} .. ${to}`);}
	return source.slice(start, end);
}

const boardSource = readFileSync(path.join(jsDir, 'board.js'), 'utf8');
const geometrySource =
	slice(boardSource, 'function piecegeometry(', '/*\n * Construct a burred box') +
	slice(boardSource, 'function constructBurredBox(', 'let animationsEnabled');

// Build the geometry functions against fixed sizes and a chosen piece style.
// multiFile picks between the two texture-sheet layouts piecesMap entries use.
export function loadGeometry({multiFile, pieceSize = 60, pieceHeight = 15}){
	return new Function('THREE', 'multiFile', 'pieceSize', 'pieceHeight', `
		let piece_size = pieceSize, piece_height = pieceHeight;
		let capstone_radius, capstone_height;
		const piecesMap = {style: {multi_file: multiFile}};
		const materials = {
			white_piece_style_name: 'style', black_piece_style_name: 'style',
			white_cap_style_name: 'style', black_cap_style_name: 'style'
		};
		${geometrySource}
		return {piecegeometry, capgeometry, constructBurredBox};
	`)(THREE, multiFile, pieceSize, pieceHeight);
}

const round = (n) => {
	const r = Math.round(n * 1e4) / 1e4;
	return Object.is(r, -0) ? 0 : r;
};

// Flatten any geometry into a sorted list of triangles (position, uv, normal per
// corner) so two implementations can be compared regardless of vertex order or
// indexing. Winding is preserved: each triangle is only rotated, never mirrored.
export function triangles(geometry){
	let g = geometry;
	if(!g.isBufferGeometry){g = new THREE.BufferGeometry().fromGeometry(g);}
	else if(g.index){g = g.toNonIndexed();}
	const pos = g.attributes.position, uv = g.attributes.uv, nrm = g.attributes.normal;
	const out = [];
	for(let t = 0; t < pos.count; t += 3){
		const corners = [0, 1, 2].map((k) => {
			const i = t + k;
			return [
				[pos.getX(i), pos.getY(i), pos.getZ(i)].map(round).join(','),
				uv ? [uv.getX(i), uv.getY(i)].map(round).join(',') : '-',
				nrm ? [nrm.getX(i), nrm.getY(i), nrm.getZ(i)].map(round).join(',') : '-'
			].join(' | ');
		});
		let first = 0;
		for(let k = 1; k < 3; k++){if(corners[k] < corners[first]){first = k;}}
		out.push([0, 1, 2].map((k) => corners[(first + k) % 3]).join('  ->  '));
	}
	return out.sort();
}
