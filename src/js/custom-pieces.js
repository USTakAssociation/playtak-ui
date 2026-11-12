// Custom 3D pieces from glTF binary (.glb) files: one file per colour holding objects named
// "flat", "wall" and "cap". Any of them may be missing; that piece keeps the built-in look.

const customPieceNames = ['flat', 'wall', 'cap'];
const customPieceMaxBytes = 10 * 1024 * 1024;

// Scale a model uniformly to fit a w×h×d box, centred on its footprint with its base at y = 0.
// The model is wrapped in a group so its own transform is kept.
function fitModel(model, w, h, d){
	model.updateMatrixWorld(true);
	const box = new THREE.Box3().setFromObject(model);
	const size = box.getSize(new THREE.Vector3());
	const scale = Math.min(w / size.x, h / size.y, d / size.z);
	if(!isFinite(scale)){throw new Error('the model has no size');}
	const center = box.getCenter(new THREE.Vector3());
	model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
	const fitted = new THREE.Group();
	fitted.scale.setScalar(scale);
	fitted.add(model);
	return fitted;
}

// The box each model is fitted into, matching the built-in piece it replaces.
// Walls are modelled standing; capstones are always on top of a stack, so they may stand twice as tall.
function customPieceSlot(name){
	if(name === 'flat'){return [piece_size, piece_height, piece_size];}
	if(name === 'wall'){return [piece_size, piece_size, piece_height];}
	return [capstone_radius * 2, capstone_height * 2, capstone_radius * 2];
}

// Parse a .glb file into {flat, wall, cap, animations}, each piece a standalone copy of its object
// (null when the file has none). Throws with a message fit to show the user.
async function parseCustomPieces(buffer){
	if(buffer.byteLength > customPieceMaxBytes){
		throw new Error(`the file is ${(buffer.byteLength / 1048576).toFixed(1)} MB; the limit is ${customPieceMaxBytes / 1048576} MB`);
	}
	const gltf = await new THREE.GLTFLoader().parseAsync(buffer, '');
	gltf.scene.updateMatrixWorld(true);
	const pieces = {animations: gltf.animations};
	// Objects by their name in the file, not counting the scene: Blender may name the scene "cap" too,
	// and the loader then renames the cap object "cap_1" to keep names unique.
	const objects = [];
	gltf.scene.traverse((o) => {if(o !== gltf.scene && (o.userData.name ?? o.name)){objects.push(o);}});
	for(const name of customPieceNames){
		const node = objects.find((o) => (o.userData.name ?? o.name) === name);
		pieces[name] = null;
		if(node){
			// keep the transforms of any parents it had in the file
			const copy = THREE.SkeletonUtils.clone(node);
			node.matrixWorld.decompose(copy.position, copy.quaternion, copy.scale);
			pieces[name] = copy;
		}
	}
	if(!customPieceNames.some((name) => pieces[name])){
		const found = objects.map((o) => o.userData.name ?? o.name);
		throw new Error(`no object named flat, wall or cap; the file has: ${found.join(', ') || 'no named objects'}`);
	}
	return pieces;
}

// ---- On the board ----

// Parsed files per colour, and the same models fitted to the current piece size.
const customPieces = {white: null, black: null};
const customTemplates = {white: null, black: null};

// A model fitted to its slot and placed in the frame of the built-in piece mesh, which is centred on the origin.
function makeCustomTemplate(source, name){
	const fitted = fitModel(THREE.SkeletonUtils.clone(source), ...customPieceSlot(name));
	const holder = new THREE.Group();
	holder.add(fitted);
	if(name === 'flat'){fitted.position.y = -piece_height / 2;}
	else if(name === 'cap'){fitted.position.y = -capstone_height / 2;}
	else{
		// walls are modelled standing, but a wall piece is a flat turned -90° about x to stand it up; undo that turn
		fitted.position.y = -piece_size / 2;
		holder.rotation.x = Math.PI / 2;
	}
	holder.traverse((o) => {
		if(o.isMesh){
			o.receiveShadow = true;
			[].concat(o.material).forEach(lightCustomMaterial);
		}
	});
	return holder;
}

// Show this piece's custom model, if its colour has one for its shape, in place of the built-in mesh.
// The built-in mesh stays the piece that game logic, stacking and clicks use; it just moves to layer 1, which is not drawn.
function applyCustomModel(piece){
	if(piece.customModel){
		piece.remove(piece.customModel);
		piece.customModel = null;
	}
	const templates = customTemplates[piece.iswhitepiece ? 'white' : 'black'];
	// without a wall model, the flat model is stood up like the built-in stone
	const name = piece.iscapstone ? 'cap' : (piece.isstanding && templates?.wall ? 'wall' : 'flat');
	const template = templates?.[name];
	piece.layers.set(template ? 1 : 0);
	if(!template){return;}
	piece.customModel = THREE.SkeletonUtils.clone(template);
	piece.customModel.traverse((o) => {
		// the board turns castShadow on and off on the piece while it moves
		if(o.isMesh){Object.defineProperty(o, 'castShadow', {get: () => piece.castShadow, set(){}});}
	});
	piece.add(piece.customModel);
}

// Refit every colour's models to the current piece size and update every piece.
function refreshCustomPieces(){
	for(const colour in customPieces){
		const pieces = customPieces[colour];
		customTemplates[colour] = null;
		if(pieces){
			customTemplates[colour] = {};
			for(const name of customPieceNames){
				if(pieces[name]){customTemplates[colour][name] = makeCustomTemplate(pieces[name], name);}
			}
		}
	}
	board.piece_objects.forEach(applyCustomModel);
}

// glTF materials are physically based: metal shows its surroundings and renders black without any.
// The environment goes on these materials only: scene.environment would also light the board's Lambert materials
// from every side, washing out their shading and shadows.
// The environment's all-round light is not blocked by anything, so at full strength it lifts the models' shadows on themselves
// until they barely show. They get a quarter of it, chosen by eye on a model with overhangs, and its full reflections.
const customPieceEnvLight = 0.25;
const customPieceEnvLightLine = 'iblIrradiance += getIBLIrradiance( geometryNormal );';
let customPieceEnvMap = null;
function lightCustomMaterial(material){
	if(!material.isMeshStandardMaterial || material.envMap){return;}
	customPieceEnvMap ??= new THREE.PMREMGenerator(renderer).fromScene(new THREE.RoomEnvironment(), 0.04).texture;
	material.envMap = customPieceEnvMap;
	// the board's own lights already light these models; the environment only needs to give metal something to reflect
	material.envMapIntensity = 0.5;
	material.onBeforeCompile = (shader) => {
		const envLight = `iblIrradiance += ${customPieceEnvLight.toFixed(2)} * getIBLIrradiance( geometryNormal );`;
		const lights = THREE.ShaderChunk.lights_fragment_maps.replace(customPieceEnvLightLine, envLight);
		shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>', lights);
	};
	material.needsUpdate = true;
}

// ---- Storage ----

// Files are kept in IndexedDB as they are: localStorage only holds strings, about 5 MB in all.
function customPiecesStore(mode, action){
	return new Promise((resolve, reject) => {
		const open = indexedDB.open('playtak', 1);
		open.onupgradeneeded = () => open.result.createObjectStore('customPieces');
		open.onerror = () => reject(open.error);
		open.onsuccess = () => {
			const db = open.result;
			const tx = db.transaction('customPieces', mode);
			const request = action(tx.objectStore('customPieces'));
			tx.oncomplete = () => {db.close(); resolve(request.result);};
			tx.onerror = () => {db.close(); reject(tx.error);};
		};
	});
}

// Load the saved files when the 3D board starts.
async function loadCustomPieces(){
	for(const colour in customPieces){
		try{
			const saved = await customPiecesStore('readonly', (store) => store.get(colour));
			showCustomPiecesFile(colour, saved?.name);
			customPieces[colour] = saved ? await parseCustomPieces(saved.buffer) : null;
		}
		catch(e){
			alert('danger', `Could not load your custom ${colour} pieces: ${e.message}`);
		}
	}
	refreshCustomPieces();
}

// ---- Settings ----

async function uploadCustomPieces(colour, input){
	const file = input.files[0];
	input.value = '';
	if(!file){return;}
	try{
		const buffer = await file.arrayBuffer();
		// parse first, so a broken file is never saved
		const pieces = await parseCustomPieces(buffer);
		await customPiecesStore('readwrite', (store) => store.put({name: file.name, buffer}, colour));
		customPieces[colour] = pieces;
		refreshCustomPieces();
		showCustomPiecesFile(colour, file.name);
	}
	catch(e){
		alert('danger', `Could not use ${file.name}: ${e.message}`);
	}
}

async function removeCustomPieces(colour){
	try{
		await customPiecesStore('readwrite', (store) => store.delete(colour));
	}
	catch(e){
		alert('danger', `Could not remove your custom ${colour} pieces: ${e.message}`);
		return;
	}
	customPieces[colour] = null;
	refreshCustomPieces();
	showCustomPiecesFile(colour, null);
}

// Show the saved file's name with a remove button, or the upload input when there is none.
function showCustomPiecesFile(colour, name){
	document.getElementById(`custom-pieces-${colour}-name`).textContent = name || '';
	document.getElementById(`custom-pieces-${colour}-saved`).style.display = name ? 'flex' : 'none';
	document.getElementById(`custom-pieces-${colour}-upload`).style.display = name ? 'none' : 'block';
}
