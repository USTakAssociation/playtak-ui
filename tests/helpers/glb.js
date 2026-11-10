// Writes small .glb files for tests: every object is a box, so sizes and positions are easy to check.

// A unit cube from -0.5 to 0.5 on each axis.
const cubePositions = new Float32Array([
	-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
	-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5
]);
const cubeIndices = new Uint16Array([
	0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4,
	3, 6, 2, 3, 7, 6, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5
]);

const pad4 = (n) => (n + 3) & ~3;

/**
 * objects: [{name, size: [x, y, z], position?: [x, y, z], children?: [...objects]}]
 * Returns the .glb as an ArrayBuffer.
 */
export function makeGLB(objects){
	const nodes = [];
	const addNode = (o) => {
		const index = nodes.length;
		// a group node holds the box as a child so a scaled parent's children are not scaled by the box size
		const node = {name: o.name, translation: o.position ?? [0, 0, 0], children: []};
		nodes.push(node);
		if(o.size){
			node.children.push(nodes.length);
			nodes.push({name: o.name + '-box', mesh: 0, scale: o.size});
		}
		for(const child of o.children ?? []){node.children.push(addNode(child));}
		if(!node.children.length){delete node.children;}
		return index;
	};
	const roots = objects.map(addNode);

	const indexOffset = cubePositions.byteLength;
	const binLength = pad4(indexOffset + cubeIndices.byteLength);
	const json = {
		asset: {version: '2.0'},
		scene: 0,
		scenes: [{nodes: roots}],
		nodes,
		meshes: [{primitives: [{attributes: {POSITION: 0}, indices: 1}]}],
		accessors: [
			{bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5]},
			{bufferView: 1, componentType: 5123, count: cubeIndices.length, type: 'SCALAR'}
		],
		bufferViews: [
			{buffer: 0, byteOffset: 0, byteLength: cubePositions.byteLength},
			{buffer: 0, byteOffset: indexOffset, byteLength: cubeIndices.byteLength}
		],
		buffers: [{byteLength: binLength}]
	};

	const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
	const jsonLength = pad4(jsonBytes.length);
	const glb = new ArrayBuffer(12 + 8 + jsonLength + 8 + binLength);
	const view = new DataView(glb);
	const bytes = new Uint8Array(glb);
	view.setUint32(0, 0x46546C67, true); // "glTF"
	view.setUint32(4, 2, true);
	view.setUint32(8, glb.byteLength, true);
	view.setUint32(12, jsonLength, true);
	view.setUint32(16, 0x4E4F534A, true); // "JSON"
	bytes.fill(0x20, 20, 20 + jsonLength); // JSON is padded with spaces
	bytes.set(jsonBytes, 20);
	const bin = 20 + jsonLength;
	view.setUint32(bin, binLength, true);
	view.setUint32(bin + 4, 0x004E4942, true); // "BIN"
	bytes.set(new Uint8Array(cubePositions.buffer), bin + 8);
	bytes.set(new Uint8Array(cubeIndices.buffer), bin + 8 + indexOffset);
	return glb;
}
