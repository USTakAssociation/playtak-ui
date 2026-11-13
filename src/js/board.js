const WHITE_PLAYER = 1;
const BLACK_PLAYER = 2;
let stack_dist = 15;
let piece_size = 60;
let piece_height = 15;
let sq_size = 90;
let sq_height = 15;
let capstone_height = 70;
let capstone_radius = 30;
let stack_selection_height = 60;
let border_size = 30;
let borderOffset = 27;
let stackOffsetFromBorder = 50;
let letter_size = 12;
let diagonal_walls = false;
let table_width = 1280;
let table_depth = 920;
let table_height = 50;

const light_position = [0, 800, -45];
const light_radius = [1.8, 1600];
// Light intensities. r155+ lighting no longer multiplies by π, so the old r110 values are scaled by π to keep the look;
// the point light's distance falloff also changed shape and 0.55 is the old/new ratio across the board at light_position.
// With shadows on, the shadow light is the main light and point and hemisphere are a low fill, so piece sides and shadows
// have contrast; the main light is set so tops of pieces and squares keep the brightness they had before real shadows.
// Ambient replaces all three when shadows are off.
const lightIntensity = {
	point: light_radius[0] * Math.PI * 0.55 * 0.06,
	// ×3 lightens the sides of pieces, which only the fill lights reach, tuned by eye
	hemisphere: 0.6 * Math.PI * 0.144 * 3,
	shadow: 2.3,
	ambient: 1.0 * Math.PI
};
// Player settings, as multipliers of the values above. Brightness scales every light. Shadow strength divides the fill,
// which is what lights a shadow, so shadows and piece sides get darker while tops stay lit by the main light.
let lightBrightness = 1;
let shadowStrength = 1;
// The shadow light is straight overhead: a lifted piece's shadow falls right below it.
const shadowLightPosition = [0, 600, 0];

// Image textures are sRGB; tag them so lighting is computed in linear space.
function srgb(texture){
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

const raycaster = new THREE.Raycaster();
// pieces showing a custom model hide their built-in mesh on layer 1, which is not drawn but can still be clicked
raycaster.layers.enable(1);
let highlighter;
let lastMoveHighlighter;
let shadowLight;
const mouse = new THREE.Vector2();
const offset = new THREE.Vector3();

let antialiasing_mode = true;
let maxaniso=1;
let anisolevel=16;
let dontanimate = false;

// Initialize animation speed from localStorage or default to 1.0
// Higher value = faster animations (duration is divided by this value)
let animationSpeed = 1.0;
try{
	const savedSpeed = localStorage.getItem('animation_speed');
	if(savedSpeed !== null){
		animationSpeed = parseFloat(savedSpeed);
		if(isNaN(animationSpeed) || animationSpeed <= 0){
			animationSpeed = 1.0;
		}
	}
}
catch(e){
	animationSpeed = 1.0;
}

// ---- Contact shadows ----
// The shadow light is overhead, so a piece resting on the board hides its own shadow. A soft dark patch around its
// base shows where it touches. When the piece is lifted or moving its base leaves the surface, so the patch is hidden
// and the real shadow shows instead. Both are as dark as each other: the share of the light that comes from the shadow light.
const contactShadowMargin = 8;
// the board is far bigger than a piece, so its shadow fades out over a wider margin
const boardContactShadowMargin = 20;
const contactShadowMaterials = new Map();
let boardContactShadow = null;

// A material whose texture is a soft-edged footprint of width × depth (or a circle of that width), with a margin to fade into.
function contactShadowMaterial(width, depth, circle, margin = contactShadowMargin){
	const key = `${width}x${depth}${circle ? 'o' : ''}m${margin}`;
	if(!contactShadowMaterials.has(key)){
		// texture pixels per unit, fewer for the board so its texture stays small
		const scale = Math.min(2, 1024 / (Math.max(width, depth) + margin * 2));
		const c = document.createElement('canvas');
		c.width = Math.round((width + margin * 2) * scale);
		c.height = Math.round((depth + margin * 2) * scale);
		const ctx = c.getContext('2d');
		ctx.filter = `blur(${margin * scale / 2}px)`;
		ctx.fillStyle = '#000';
		const m = margin * scale;
		if(circle){
			ctx.beginPath();
			ctx.arc(c.width / 2, c.height / 2, width * scale / 2, 0, Math.PI * 2);
			ctx.fill();
		}
		else{
			ctx.fillRect(m, m, width * scale, depth * scale);
		}
		contactShadowMaterials.set(key, new THREE.MeshBasicMaterial({
			color: 0x000000, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false,
			polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
		}));
	}
	return contactShadowMaterials.get(key);
}

// Show a contact shadow under the board and under every piece whose base rests on the board or table, and hide it otherwise.
function updateContactShadows(){
	// in shadow only the fill light is left, so the shadow light's share of the light on a top surface is how dark a shadow is
	const fill = board.pointLight.intensity + board.hemisphereLight.intensity;
	const opacity = shadowLight.intensity / (shadowLight.intensity + fill);

	// the board rests on the table: its base is the squares' underside
	const boardWidth = gameData.size * sq_size + border_size * 2;
	if(!boardContactShadow){
		boardContactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
		boardContactShadow.rotation.x = -Math.PI / 2;
		boardContactShadow.ispassive = true;
	}
	if(boardContactShadow.parent !== scene){scene.add(boardContactShadow);}
	boardContactShadow.visible = shadowsEnabled;
	boardContactShadow.material = contactShadowMaterial(boardWidth, boardWidth, false, boardContactShadowMargin);
	boardContactShadow.material.opacity = opacity;
	boardContactShadow.scale.set(boardWidth + boardContactShadowMargin * 2, boardWidth + boardContactShadowMargin * 2, 1);
	boardContactShadow.position.set(0, -sq_height / 2, 0);

	// the overlay, when there is one, covers the squares and stands a little above them
	const overlay = board.overlay;
	const boardTop = overlay?.parent ? Math.max(sq_height / 2, overlay.position.y + overlay.geometry.parameters.height / 2) : sq_height / 2;
	const axis = new THREE.Vector3();
	for(const piece of board.piece_objects){
		let base, width, depth;
		if(piece.iscapstone){
			[base, width, depth] = [piece.position.y - capstone_height / 2, capstone_radius * 2, capstone_radius * 2];
		}
		else if(piece.isstanding){
			[base, width, depth] = [piece.position.y - piece_size / 2, piece_size, piece_height];
		}
		else{
			[base, width, depth] = [piece.position.y - piece_height / 2, piece_size, piece_size];
		}
		// pieces on a square rest on the board only at the bottom of the stack; unplayed pieces rest on the table
		const surface = piece.onsquare ? sq_height / 2 : -sq_height / 2;
		// a custom model's own shadow outlines it; a patch the size of the built-in piece would be a dark blob around it
		const resting = !piece.customModel && Math.abs(base - surface) < 0.5 && (!piece.onsquare || board.get_stack(piece.onsquare)[0] === piece);
		let patch = piece.contactShadow;
		if(!patch){
			if(!resting || !shadowsEnabled){continue;}
			patch = piece.contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
			patch.rotation.order = 'YXZ';
			patch.rotation.x = -Math.PI / 2;
			patch.ispassive = true;
		}
		if(patch.parent !== scene){scene.add(patch);}
		patch.visible = resting && shadowsEnabled;
		if(!patch.visible){continue;}
		patch.material = contactShadowMaterial(width, depth, piece.iscapstone);
		patch.material.opacity = opacity;
		patch.scale.set(width + contactShadowMargin * 2, depth + contactShadowMargin * 2, 1);
		patch.position.set(piece.position.x, piece.onsquare ? boardTop : surface, piece.position.z);
		// turn with the piece: its local x is the long side of a wall, whichever way it was stood up
		axis.set(1, 0, 0).applyQuaternion(piece.quaternion);
		patch.rotation.y = Math.atan2(-axis.z, axis.x);
	}
}

let scenehash = 0;
let lastanimate = 0;
let camera,scene,renderer,light,canvas,controls = null;
let perspective;

function animate(){
	if(is2DBoard){return;}
	if(!dontanimate){
		controls.update();
		const newscenehash=floathashscene();
		const now=Date.now();
		if(scenehash!=newscenehash || lastanimate+1000<=now){
			scenehash=newscenehash;
			lastanimate=now;
			updateContactShadows();
			renderer.render(scene,camera);
		}
	}
	requestAnimationFrame(animate);
}

function combinefrustumvectors(a,b){
	const a2=a.dot(a);
	const b2=b.dot(b);
	const ab=a.dot(b);
	const a2b2=a2*b2;
	const div=a2b2-ab*ab;
	const bmul=(a2b2-a2*ab)/div;
	const amul=(a2b2-b2*ab)/div;
	return a.clone().multiplyScalar(amul).addScaledVector(b,bmul);
}

function frustumprojectionhelper(invcam,fv){
	return fv.dot(fv)/fv.dot(invcam);
}

function generateCamera(){
	if(!rendererdone || is2DBoard){
		return;
	}

	settingscounter = (settingscounter+1) & 15;
	const cuttop = $('header').height() + BOARD_PADDING;
	const cutleft = getLeftPadding();
	const cutright = getRightPadding();
	const cutbottom = 0 + BOARD_PADDING;

	const pointlist = [];
	const xsizea = gameData.size*sq_size/2+border_size+stackOffsetFromBorder+piece_size;
	const xsizeb = (gameData.size-1)*sq_size/2+piece_size/2;
	const yneg = sq_height/2;
	const yposa = 10*piece_height-yneg;
	const yposb = 20*piece_height+yneg;
	const zsizea = gameData.size*sq_size/2+border_size;
	const zsizeb = xsizeb;

	for(let a = -1; a < 2; a += 2){
		for(let b = -1; b < 2; b += 2){
			pointlist.push(new THREE.Vector3(a*xsizea,-yneg,b*zsizea));
			pointlist.push(new THREE.Vector3(a*xsizea,yposa,b*zsizea));
			pointlist.push(new THREE.Vector3(a*xsizeb,yposb,b*zsizeb));
		}
	}
	let invcamdir;
	if(camera && !fixedcamera){
		invcamdir=camera.position.clone().sub(controls.target).normalize();
	}
	else{
		invcamdir=new THREE.Vector3(-4,25,25).normalize();
	}
	// both branches below create new controls; drop the old ones' event listeners first
	controls?.dispose();
	const camdir=invcamdir.clone().negate();
	const up=new THREE.Vector3(0,1,0);
	const camleft=new THREE.Vector3();
	camleft.crossVectors(up,camdir).normalize();
	const camup=new THREE.Vector3();
	camup.crossVectors(camdir,camleft).normalize();
	const camright=camleft.clone().negate();
	const camdown=camup.clone().negate();
	if(perspective>0){
		const fw=pixelratio*(window.innerWidth+Math.abs(cutleft-cutright));
		const fh=pixelratio*(window.innerHeight+Math.abs(cuttop-cutbottom));
		const ox=pixelratio*(Math.max(0,cutright-cutleft));
		const oy=pixelratio*(Math.max(0,cutbottom-cuttop));
		const xv=pixelratio*(window.innerWidth-cutleft-cutright);
		const yv=pixelratio*(window.innerHeight-cuttop-cutbottom);
		const perspectiveheight=fh*perspective/(yv+xv)/90;
		const perspectivewidth=perspectiveheight*fw/fh;
		const perspectiveangle=Math.atan(perspectiveheight)*360/Math.PI;
		const scaletop=perspectiveheight*yv/fh;
		const scalebottom=scaletop;
		const scaleleft=perspectivewidth*xv/fw;
		const scaleright=scaleleft;
		const fvtop=camup.clone().divideScalar(scaletop).add(invcamdir).normalize();
		const fvbottom=camdown.clone().divideScalar(scalebottom).add(invcamdir).normalize();
		const fvleft=camleft.clone().divideScalar(scaleleft).add(invcamdir).normalize();
		const fvright=camright.clone().divideScalar(scaleright).add(invcamdir).normalize();
		let maxleft=0;
		let maxright=0;
		let maxtop=0;
		let maxbottom=0;
		for(let a=0;a<pointlist.length;a++){
			let newdist=fvleft.dot(pointlist[a]);
			maxleft=Math.max(maxleft,newdist);
			newdist=fvright.dot(pointlist[a]);
			maxright=Math.max(maxright,newdist);
			newdist=fvtop.dot(pointlist[a]);
			maxtop=Math.max(maxtop,newdist);
			newdist=fvbottom.dot(pointlist[a]);
			maxbottom=Math.max(maxbottom,newdist);
		}

		let camdist=0;
		let camcenter=new THREE.Vector3(0,0,0);

		if(fixedcamera){
			let lrcampos=combinefrustumvectors(fvleft.clone().multiplyScalar(maxleft),fvright.clone().multiplyScalar(maxright));
			let tbcampos=combinefrustumvectors(fvtop.clone().multiplyScalar(maxtop),fvbottom.clone().multiplyScalar(maxbottom));
			let lrlen=lrcampos.dot(invcamdir);
			let tblen=tbcampos.dot(invcamdir);

			if(lrlen<tblen){
				let addin=(maxleft+maxright)*(tblen/lrlen-1)/2;
				lrcampos=combinefrustumvectors(fvleft.clone().multiplyScalar(maxleft+addin),fvright.clone().multiplyScalar(maxright+addin));

				lrlen=lrcampos.dot(invcamdir);
				addin+=(maxleft+maxright+addin*2)*(tblen/lrlen-1)/2;
				lrcampos=combinefrustumvectors(fvleft.clone().multiplyScalar(maxleft+addin),fvright.clone().multiplyScalar(maxright+addin));

			}
			else{
				let addin=(maxtop+maxbottom)*(lrlen/tblen-1)/2;
				tbcampos=combinefrustumvectors(fvtop.clone().multiplyScalar(maxtop+addin),fvbottom.clone().multiplyScalar(maxbottom+addin));

				tblen=tbcampos.dot(invcamdir);
				addin+=(maxtop+maxbottom+addin*2)*(lrlen/tblen-1)/2;
				tbcampos=combinefrustumvectors(fvtop.clone().multiplyScalar(maxtop+addin),fvbottom.clone().multiplyScalar(maxbottom+addin));

			}

			camdist=lrcampos.dot(invcamdir);
			const camdiff=tbcampos.clone().sub(lrcampos);
			const lradjust=camup.clone().multiplyScalar(camdiff.dot(camup));
			const finalcampos=lrcampos.clone().add(lradjust);

			const centeroffset=camdir.clone().multiplyScalar(finalcampos.dot(invcamdir));
			camcenter=finalcampos.clone().add(centeroffset);

			camera = new THREE.PerspectiveCamera(perspectiveangle,canvas.width / canvas.height,Math.max(camdist-800,10),camdist+800);
			camera.setViewOffset(fw,fh,ox,oy,canvas.width,canvas.height);
			camera.position.set(finalcampos.x,finalcampos.y,finalcampos.z);
		}
		else{
			camdist=Math.max(camdist,frustumprojectionhelper(invcamdir,fvleft.clone().multiplyScalar(maxleft)));
			camdist=Math.max(camdist,frustumprojectionhelper(invcamdir,fvright.clone().multiplyScalar(maxright)));
			camdist=Math.max(camdist,frustumprojectionhelper(invcamdir,fvtop.clone().multiplyScalar(maxtop)));
			camdist=Math.max(camdist,frustumprojectionhelper(invcamdir,fvbottom.clone().multiplyScalar(maxbottom)));

			const finalcampos=invcamdir.clone().multiplyScalar(camdist);

			camera = new THREE.PerspectiveCamera(perspectiveangle,canvas.width / canvas.height,Math.max(camdist/5-800,10),camdist*3+800);
			camera.setViewOffset(fw,fh,ox,oy,canvas.width,canvas.height);
			camera.position.set(finalcampos.x,finalcampos.y,finalcampos.z);
		}

		controls = new THREE.OrbitControls(camera,renderer.domElement);
		controls.minDistance = camdist/5;
		controls.maxDistance = camdist*3;
		controls.target.set(camcenter.x,camcenter.y,camcenter.z);
		controls.enablePan=false;
		// Limit vertical rotation to prevent seeing below the board
		controls.minPolarAngle = 0.1; // Just above horizontal
		controls.maxPolarAngle = Math.PI / 2 - 0.05; // Just above looking straight down

		if(ismobile){
			controls.zoomSpeed = 0.5;
		}
	}
	else{
		let maxleft=0;
		let maxright=0;
		let maxtop=0;
		let maxbottom=0;
		for(let a=0;a<pointlist.length;a++){
			const newleft=camleft.dot(pointlist[a]);
			maxleft=Math.max(maxleft,newleft);
			maxright=Math.min(maxright,newleft);
			const newtop=camup.dot(pointlist[a]);
			maxtop=Math.max(maxtop,newtop);
			maxbottom=Math.min(maxbottom,newtop);
		}
		const scalex=(maxleft-maxright)/(window.innerWidth-cutleft-cutright);
		const scaley=(maxtop-maxbottom)/(window.innerHeight-cuttop-cutbottom);
		const scale=Math.max(scalex,scaley);
		const xpadding=(window.innerWidth-cutleft-cutright)*(1-scalex/scale);
		const ypadding=(window.innerHeight-cuttop-cutbottom)*(1-scaley/scale);
		const paddedCutLeft = cutleft + xpadding / 2;
		const paddedCutRight = cutright + xpadding / 2;
		const paddedCutTop = cuttop + ypadding / 2;
		const paddedCutBottom = cutbottom + ypadding / 2;

		camera = new THREE.OrthographicCamera(
			-maxleft - paddedCutLeft * scale,
			-maxright + paddedCutRight * scale,
			maxtop + paddedCutTop * scale,
			maxbottom - paddedCutBottom * scale,
			2000,
			5000
		);
		const campos=invcamdir.multiplyScalar(3500);
		camera.position.set(campos.x,campos.y,campos.z);

		controls = new THREE.OrbitControls(camera,renderer.domElement);
		controls.minZoom = 0.5;
		controls.maxZoom = 3;
		controls.target.set(0,0,0);
		controls.enablePan=false;
		// Limit vertical rotation to prevent seeing below the board
		controls.minPolarAngle = 0.1;
		controls.maxPolarAngle = Math.PI / 2 - 0.05;

		if(ismobile){
			controls.zoomSpeed = 0.5;
		}
	}
	if(fixedcamera){
		controls.enableRotate=false;
		controls.enableZoom=false;
		board.boardside="white";
	}
	if(!gameData.is_scratch && (gameData.my_color=="black") != (board.boardside=="black")){
		board.reverseboard();
	}
}

function floathashscene(){
	let hash=0;
	let multiplier=1;
	updatepoint(camera.position);
	updatepoint(controls.target);
	update(camera.zoom);
	for(let a=0;a<board.piece_objects.length;a++){
		updatepoint(board.piece_objects[a].position);
	}
	update(window.innerWidth);
	update(window.innerHeight);
	update(anisolevel);
	update(pixelratio);
	update(settingscounter);
	if(board.highlighted){
		updatepoint(highlighter.position);
	}
	if(board.lastMoveHighlighted){
		updatepoint(lastMoveHighlighter.position);
	}
	function updatepoint(p){
		update(p.x);
		update(p.y);
		update(p.z);
	}
	function update(n){
		hash+=n*multiplier;
		multiplier*=1.0010472219;
	}
	return hash;
}

const materials = {
	images_root_path: 'images/',
	board_texture_path: 'images/board/',
	pieces_texture_path: 'images/pieces/',
	white_sqr_style_name: boardDefaults.whiteSquares,
	black_sqr_style_name: boardDefaults.blackSquares,
	white_piece_style_name: boardDefaults.whitePieces,
	black_piece_style_name: boardDefaults.blackPieces,
	white_cap_style_name: boardDefaults.whiteCaps,
	black_cap_style_name: boardDefaults.blackCaps,
	table_texture_path: 'images/wooden_table.png',
	boardOverlayPath: 'images/board/overlay.png',
	borderColor: parseInt(boardDefaults.borderColor.replace('#', '0x')),
	borders: [],
	letters: [],
	white_piece: new THREE.MeshLambertMaterial({color: 0xd4b375}),
	black_piece: new THREE.MeshLambertMaterial({color: 0x573312}),
	white_cap: new THREE.MeshLambertMaterial({color: 0xd4b375}),
	black_cap: new THREE.MeshLambertMaterial({color: 0x573312}),
	white_sqr: new THREE.MeshLambertMaterial({color: 0xe6d4a7}),
	black_sqr: new THREE.MeshLambertMaterial({color: 0xba6639}),
	boardOverlay: new THREE.MeshBasicMaterial({map: {}}),
	overlayMap: {
		3: { "size": 270, "offset": { "x": 0.5333, "y": 0.0556 }, "repeat": { "x": 0.2, "y": 0.1667 } },
		4: { "size": 360, "offset": { "x": 0, "y": 0 }, "repeat": { "x": 0.2667, "y": 0.2222 } },
		5: { "size": 450, "offset": { "x": 0.5333, "y": 0.2778 }, "repeat": { "x": 0.3333, "y": 0.2778 } },
		6: { "size": 540, "offset": { "x": 0, "y": 0.2222 }, "repeat": { "x": 0.4, "y": 0.3333 } },
		7: { "size": 630, "offset": { "x": 0.5333, "y": 0.6111 }, "repeat": { "x": 0.4667, "y": 0.3889 } },
		8: { "size": 720, "offset": { "x": 0.0007, "y": 0.5556 }, "repeat": { "x": 0.5333, "y": 0.4444 } }
	},
	border: new THREE.MeshLambertMaterial({color: 0x6f4734}),
	letter: new THREE.MeshBasicMaterial({color: 0xffffff}),
	highlighter: new THREE.MeshBasicMaterial({color: 0xffffff}),
	lastMoveHighlighter: new THREE.MeshBasicMaterial({color: 0x000000}),
	getWhiteSquareTextureName: function(){
		return this.board_texture_path + squaresMap[this.white_sqr_style_name].file + '.png';
	},
	getBlackSquareTextureName: function(){
		return this.board_texture_path + squaresMap[this.black_sqr_style_name].file + '.png';
	},
	getWhitePieceTextureName: function(){
		if(localStorage['set_custom_piece_white']){
			return localStorage[localStorage['set_custom_piece_white']];
		}
		return `images/pieces/${piecesMap[this.white_piece_style_name].file}.png`;
	},
	getWhiteCapTextureName: function(){
		if(localStorage[`set_custom_piece_white`]){
			return localStorage[localStorage['set_custom_piece_white']];
		}
		if(piecesMap[materials.white_cap_style_name].multi_file){
			// load cap texture
			return `images/pieces/${piecesMap[materials.white_cap_style_name].file.replace('pieces', 'caps')}.png`;
		}
		return `images/pieces/${piecesMap[materials.white_cap_style_name].file}.png`;
	},
	getBlackPieceTextureName: function(){
		if(localStorage[`set_custom_piece_black`]){
			return localStorage[localStorage[`set_custom_piece_black`]];
		}
		return `images/pieces/${piecesMap[materials.black_piece_style_name].file}.png`;
	},
	getBlackCapTextureName: function(){
		if(localStorage[`set_custom_piece_black`]){
			return localStorage[localStorage[`set_custom_piece_black`]];
		}
		if(piecesMap[materials.black_cap_style_name].multi_file){
			// load cap texture
			return `images/pieces/${piecesMap[materials.black_cap_style_name].file.replace('pieces','caps')}.png`;
		}
		return `images/pieces/${piecesMap[materials.black_cap_style_name].file}.png`;
	},
	// updateBoardMaterials after the user changes the board styles
	updateBoardMaterials: function(){
		this.boardLoaded = 0;
		const loader = new THREE.TextureLoader();

		this.white_sqr = new THREE.MeshLambertMaterial({map: srgb(loader.load(this.getWhiteSquareTextureName(),this.boardLoadedFn)), transparent: true});
		this.black_sqr = new THREE.MeshLambertMaterial({map: srgb(loader.load(this.getBlackSquareTextureName(),this.boardLoadedFn)), transparent: true});
		const an=Math.min(maxaniso,anisolevel);
		if(an>1){
			this.white_sqr.map.anisotropy=an;
			this.black_sqr.map.anisotropy=an;
		}
	},
	updateBorderColor: function(val){
		// format val to hex
		if(val.startsWith("#")){
			val = val.substring(1);
			val = '0x' + val;
		}
		for(let i = 0; i < this.borders.length; i++){
			this.borders[i].material.color.setHex(val);
		}
	},
	updateBorderTexture: function(val){
		const loader = new THREE.TextureLoader();
		let mesh = new THREE.MeshLambertMaterial({ map: srgb(loader.load(val)), transparent: true});
		for(let i = 0; i < this.borders.length; i++){
			this.borders[i].material = mesh;
			this.borders[i].receiveShadow = true;
		}
	},
	removeBorderTexture: function(){
		let color = 0x6f4734;
		if(localStorage.getItem('borderColor')){
			let colorVal = localStorage.getItem('borderColor');
			if(colorVal.startsWith("#")){
				colorVal = colorVal.substring(1);
				colorVal = '0x' + colorVal;
			}
			color = colorVal;
		}
		const mesh = new THREE.MeshLambertMaterial({color: color});
		mesh.color.setHex(color);
		for(let i = 0; i < this.borders.length; i++){
			this.borders[i].material = mesh;
			this.borders[i].receiveShadow = true;
		}
	},
	// for some reason this is not working 100% need to look into it more
	updateBorderSize: function(value){
		for(let i = 0; i < this.borders.length; i++){
			scene.remove(this.borders[i]);
		}
		border_size = parseInt(value) * 0.1;
		boardFactory.makeBorders(scene);
	},
	// updatePieceMaterials after the user changes the piece styles
	updatePieceMaterials: function(){
		const loader = new THREE.TextureLoader();
		this.piecesLoaded = 0;

		// a texture that fails to load still counts, so the others are applied
		const done = this.piecesLoadedFn;
		this.black_piece = new THREE.MeshLambertMaterial({map: srgb(loader.load(this.getBlackPieceTextureName(),done,undefined,done))});
		this.white_piece = new THREE.MeshLambertMaterial({map: srgb(loader.load(this.getWhitePieceTextureName(),done,undefined,done))});
		this.white_cap = new THREE.MeshLambertMaterial({map: srgb(loader.load(this.getWhiteCapTextureName(),done,undefined,done))});
		this.black_cap = new THREE.MeshLambertMaterial({map: srgb(loader.load(this.getBlackCapTextureName(),done,undefined,done))});
		const an=Math.min(maxaniso,anisolevel);
		if(an>1){
			this.white_piece.map.anisotropy=an;
			this.black_piece.map.anisotropy=an;
			this.white_cap.map.anisotropy=an;
			this.black_cap.map.anisotropy=an;
		}
	},
	updateLetterVisibility(val){
		for(let i = 0; i < this.letters.length; i++){
			this.letters[i].visible = val;
		}
	},
	updateLetterColor(color){
		const hexColor = parseInt(color.replace('#', '0x'));
		this.letter.color.setHex(hexColor);
		settingscounter = (settingscounter + 1) & 15;
	},
	piecesLoaded: 0,
	//callback on loading piece textures
	piecesLoadedFn: function(){
		settingscounter=(settingscounter+1)&15;
		materials.piecesLoaded++;

		if(materials.piecesLoaded === 4){
			materials.piecesLoaded = 0;
			// reapply texture.
			for(i = 0;i < board.piece_objects.length;i++){
				if(board.piece_objects[i].iscapstone){
					board.piece_objects[i].material = (board.piece_objects[i].iswhitepiece)
						? materials.white_cap : materials.black_cap;
				}
				else{
					board.piece_objects[i].material = (board.piece_objects[i].iswhitepiece)
						? materials.white_piece : materials.black_piece;
				}
			}
		}
	},
	boardLoaded: 0,
	//callback on loading board textures
	boardLoadedFn: function(){
		settingscounter=(settingscounter+1)&15;
		materials.boardLoaded++;

		if(materials.boardLoaded === 2){
			materials.boardLoaded = 0;
			for(i = 0;i < gameData.size * gameData.size;++i){
				if(board.board_objects[i].isboard===true){
					board.board_objects[i].material =
					((i + Math.floor(i / gameData.size) * ((gameData.size - 1) % 2)) % 2)
						? materials.white_sqr : materials.black_sqr;
					board.board_objects[i].receiveShadow = true;
				}
			}
		}
	}
};

const boardFactory = {
	boardfont: null,
	makeSquare: function(file,rankInverse,scene){
		const geometry = new THREE.BoxGeometry(sq_size,sq_height,sq_size);
		geometry.center();
		const square = new THREE.Mesh(geometry,((file+rankInverse) % 2 ? materials.white_sqr : materials.black_sqr));
		square.position.set(
			board.sq_position.startx + file*sq_size,
			0,
			board.sq_position.startz + rankInverse*sq_size
		);
		square.file = file;
		square.rank = gameData.size - 1 - rankInverse;
		square.isboard = true;
		square.receiveShadow = true;
		square.castShadow = true;
		scene.add(square);
		return square;
	},
	makeBorders: function(scene){
		materials.borders = [];
		if(localStorage.getItem('borderTexture')){
			const loader = new THREE.TextureLoader();
			materials.border = new THREE.MeshLambertMaterial({ map: srgb(loader.load(localStorage.getItem('borderTexture'))), transparent: true}, materials.boardLoadedFn());
		}
		// We use the same geometry for all 4 borders. This means the borders
		// overlap each other at the corners. Probably OK at this point, but
		// maybe there are cases where that would not be good.
		let geometry = new THREE.BoxGeometry(board.length,piece_height,border_size);
		geometry.center();
		let border;
		if(!localStorage.getItem('borderTexture')){
			let color = localStorage["borderColor"] || boardDefaults.borderColor;
			if(color.startsWith("#")){
				color = color.substring(1);
				color = '0x' + color;
			}
			materials.border.color.setHex(color);
		}
		// Top border
		border = new THREE.Mesh(geometry,materials.border);
		border.position.set(0,0,board.corner_position.z + border_size/2);
		border.receiveShadow = true;
		border.castShadow = true;
		materials.borders.push(border);
		// Bottom border
		border = new THREE.Mesh(geometry,materials.border);
		border.position.set(0,0,board.corner_position.endz - border_size/2);
		border.rotateY(Math.PI);
		border.receiveShadow = true;
		border.castShadow = true;
		materials.borders.push(border);
		// Left border
		border = new THREE.Mesh(geometry,materials.border);
		border.position.set(board.corner_position.x + border_size/2,0,0);
		border.rotateY(Math.PI/2);
		border.receiveShadow = true;
		border.castShadow = true;
		materials.borders.push(border);
		// Right border
		border = new THREE.Mesh(geometry,materials.border);
		border.position.set(board.corner_position.endx - border_size/2,0,0);
		border.rotateY(-Math.PI / 2);
		border.receiveShadow = true;
		border.castShadow = true;
		materials.borders.push(border);

		for(let i = 0; i < materials.borders.length; i++){
			scene.add(materials.borders[i]);
		}
	},
	makeBorderText: function(scene){
		materials.letters = [];
		let visible = true;
		if(localStorage.getItem('hideBorderText') === 'true'){
			visible = false;
		}
		if(boardFactory.boardfont){
			gotfont(boardFactory.boardfont);
		}
		else{
			const loader = new THREE.FontLoader();
			loader.load('fonts/helvetiker_regular.typeface.json',gotfont);
		}

		function gotfont(font){
			boardFactory.boardfont=font;
			// add the letters and numbers around the border
			for(let i = 0;i < gameData.size;i++){
				let geometry,letter;
				// Top letters
				geometry = new THREE.TextGeometry(
					String.fromCharCode('A'.charCodeAt(0) + i),
					{size: letter_size,depth: 1,font: font}
				);
				letter = new THREE.Mesh(geometry,materials.letter);
				letter.visible = visible;
				letter.rotateX(Math.PI / 2);
				letter.rotateY(Math.PI);
				letter.position.set(
					board.sq_position.startx + letter_size/2 + i*sq_size,
					sq_height/2,
					board.sq_position.startz - borderOffset * 2 - letter_size
				);
				materials.letters.push(letter);
				// Bottom letters
				geometry = new THREE.TextGeometry(
					String.fromCharCode('A'.charCodeAt(0) + i),
					{size: letter_size,depth: 1,font: font}
				);
				letter = new THREE.Mesh(geometry,materials.letter);
				letter.rotateX(-Math.PI / 2);
				letter.visible = visible;
				letter.position.set(
					board.sq_position.startx - letter_size/2 + i*sq_size,
					sq_height/2,
					board.sq_position.endz + borderOffset * 2 + letter_size
				);
				materials.letters.push(letter);
				// Left side numbers
				geometry = new THREE.TextGeometry(
					String.fromCharCode('1'.charCodeAt(0) + i),
					{size: letter_size,depth: 1,font: font}
				);
				letter = new THREE.Mesh(geometry,materials.letter);
				letter.rotateX(-Math.PI / 2);
				letter.visible = visible;
				letter.position.set(
					board.sq_position.startx - borderOffset * 2 - letter_size,
					sq_height / 2,
					board.sq_position.endz + letter_size/2 - i*sq_size
				);
				materials.letters.push(letter);
				// Right side numbers
				geometry = new THREE.TextGeometry(
					String.fromCharCode('1'.charCodeAt(0) + i),
					{size: letter_size,depth: 1,font: font}
				);
				letter = new THREE.Mesh(geometry,materials.letter);
				letter.rotateX(-Math.PI / 2);
				letter.rotateZ(Math.PI);
				letter.visible = visible;
				letter.position.set(
					board.sq_position.endx + borderOffset * 2 + letter_size,
					sq_height / 2,
					board.sq_position.endz - letter_size/2 - i*sq_size
				);
				materials.letters.push(letter);
			}
			for(let i = 0; i < materials.letters.length; i++){
				scene.add(materials.letters[i]);
			}
			settingscounter=(settingscounter+1)&15;
		}
	}
};

// When auto-rotate is disabled, invert z-positions of player 2's (black) pieces
// so they appear the same as player 1's layout (just on the opposite side of the board)
function shouldInvertBlackPiecesZ(){
	return localStorage.getItem('auto_rotate') === 'false';
}

const pieceFactory = {
	makePiece: function(playerNum,pieceNum,scene){
		const materialMine = (playerNum === WHITE_PLAYER ? materials.white_piece : materials.black_piece);
		const geometry=piecegeometry(playerNum === WHITE_PLAYER?"white":"black");

		let stackno = Math.floor(pieceNum / 10);
		let stackheight = pieceNum % 10;
		const piece = new THREE.Mesh(geometry,materialMine);
		piece.iswhitepiece = (playerNum === WHITE_PLAYER);
		// Swap first-to-play flat stone positions for first turn rule
		// getfromstack returns the highest pieceNum first, so tottiles-1 is first to play
		const firstToPlayPieceNum = board.tottiles - 1;
		let isFirstToPlay = (pieceNum === firstToPlayPieceNum);
		// Double Black Stack: white's first move places TWO black flats, so stage a
		// second black flat (the extra drawn from black's reserves) on white's side,
		// resting directly on top of the first swapped black flat so both are visible
		// (rather than at this piece's own reserve slot, which would overlap white's).
		if(gameData.opening === 'double black stack' && playerNum === BLACK_PLAYER && pieceNum === firstToPlayPieceNum - 1){
			isFirstToPlay = true;
			stackno = Math.floor(firstToPlayPieceNum / 10);
			stackheight = (firstToPlayPieceNum % 10) + 1;
		}
		// Double Black Stack: black donates an extra flat to white's opening stack, so
		// black's reserve pile is one shorter. The white first-to-play flat that rests
		// on top of black's reserves must drop a level so it doesn't float over the gap.
		// (Only when that flat shares a column with the donated flat, i.e. not at a column base.)
		if(gameData.opening === 'double black stack' && playerNum === WHITE_PLAYER && pieceNum === firstToPlayPieceNum && (firstToPlayPieceNum % 10) > 0){
			stackheight = (firstToPlayPieceNum % 10) - 1;
		}
		const positionAsWhite = (playerNum === WHITE_PLAYER) !== isFirstToPlay;
		const invertBlackZ = shouldInvertBlackPiecesZ();
		if(positionAsWhite){
			piece.position.set(
				board.corner_position.endx + stackOffsetFromBorder + piece_size/2,
				stackheight*piece_height+piece_height/2-sq_height/2,
				board.corner_position.endz - piece_size/2 - stackno*(stack_dist+piece_size)
			);
		}
		else{
			// When invertBlackZ, mirror white's layout: flats at endz decreasing
			const zPos = invertBlackZ
				? board.corner_position.endz - piece_size/2 - stackno*(stack_dist+piece_size)
				: board.corner_position.z + piece_size/2 + stackno*(stack_dist+piece_size);
			piece.position.set(
				board.corner_position.x - stackOffsetFromBorder - piece_size/2,
				stackheight*piece_height+piece_height/2-sq_height/2,
				zPos
			);
		}

		piece.isstanding = false;
		piece.onsquare = null;
		piece.isboard = false;
		piece.iscapstone = false;
		piece.pieceNum=pieceNum;
		piece.positionAsWhite = positionAsWhite;
		piece.receiveShadow = true;
		piece.castShadow = true;
		applyCustomModel(piece);
		scene.add(piece);
		return piece;
	},
	makeCap: function(playerNum,capNum,scene){
		const geometry = capgeometry(playerNum === WHITE_PLAYER?"white":"black");

		// the capstones go at the other end of the row
		let piece;
		const invertBlackZ = shouldInvertBlackPiecesZ();
		if(playerNum === WHITE_PLAYER){
			piece = new THREE.Mesh(geometry,materials.white_cap);
			piece.position.set(
				board.corner_position.endx + capstone_radius + stackOffsetFromBorder,
				capstone_height/2-sq_height/2,
				board.corner_position.z + capstone_radius + capNum*(stack_dist+capstone_radius*2)
			);
			piece.iswhitepiece = true;
		}
		else{
			piece = new THREE.Mesh(geometry,materials.black_cap);
			// When invertBlackZ, mirror white's layout: caps at z increasing
			const zPos = invertBlackZ
				? board.corner_position.z + capstone_radius + capNum*(stack_dist+capstone_radius*2)
				: board.corner_position.endz - capstone_radius - capNum*(stack_dist+capstone_radius*2);
			piece.position.set(
				board.corner_position.x - capstone_radius - stackOffsetFromBorder,
				capstone_height/2-sq_height/2,
				zPos
			);
			piece.iswhitepiece = false;
		}
		piece.isstanding = true;
		piece.onsquare = null;
		piece.isboard = false;
		piece.iscapstone = true;
		piece.pieceNum=capNum;
		piece.receiveShadow = true;
		piece.castShadow = true;
		applyCustomModel(piece);
		scene.add(piece);
		return piece;
	}
};

function piecegeometry(color){
	const geometry = new THREE.BoxGeometry(piece_size,piece_height,piece_size);
	let geometrytype;
	if(color=="white"){
		geometrytype=piecesMap[materials.white_piece_style_name];
	}
	else{
		geometrytype=piecesMap[materials.black_piece_style_name];
	}
	if(!geometrytype.multi_file){
		// map each face onto the flat stone's area of the texture sheet
		const uv = geometry.attributes.uv;
		for(let i = 0; i < uv.count; i++){
			// BoxGeometry has 4 vertices per face in order +x,-x,+y,-y,+z,-z; 8-15 are top and bottom
			const topOrBottom = i >= 8 && i < 16;
			const x = uv.getX(i) == 0 ? 9/16 : 15/16;
			const y = topOrBottom
				? (uv.getY(i) == 0 ? 1/32 : 13/32)
				: (uv.getY(i) == 0 ? 29/64 : 35/64);
			uv.setXY(i, x, y);
		}
	}
	return geometry;
}

function capgeometry(color){
	capstone_radius=piece_size*0.4;
	capstone_height=Math.min(piece_size*1.1,70);
	const geometry = new THREE.CylinderGeometry(capstone_radius,capstone_radius,capstone_height,30);
	let geometrytype;
	if(color=="white"){
		geometrytype=piecesMap[materials.white_cap_style_name];
	}
	else{
		geometrytype=piecesMap[materials.black_cap_style_name];
	}
	const uv = geometry.attributes.uv;
	// CylinderGeometry lists the side vertices first: (radialSegments + 1) * (heightSegments + 1); the cap vertices follow
	const sideVertices = (30 + 1) * (1 + 1);
	for(let i = 0; i < uv.count; i++){
		const x = uv.getX(i), y = uv.getY(i);
		if(i < sideVertices){
			// single sheet: the side wraps onto the left half, rotated
			if(!geometrytype.multi_file){uv.setXY(i, 0.5 * y, 1 - x);}
		}
		else if(geometrytype.multi_file){
			uv.setXY(i, (x - 0.5) * 0.25 + 0.5, (y - 0.5) * 0.5 + 0.5);
		}
		else{
			uv.setXY(i, (x - 0.5) * 0.375 + 0.75, (y - 0.5) * 0.375 + 0.78125);
		}
	}
	return geometry;
}

/*
 * Construct a burred box with parameter width, height, depth
 * as well as burringWidth and burringHeight.
 */
function constructBurredBox(width, height, depth, burringDepth, burringHeight, burringVertical){
	// collected as vertex indices, triangles and per-triangle texture coordinates, then built into a BufferGeometry at the end
	const vertices = [];
	const faces = [];
	const faceUvs = [];
	const face = (a, b, c) => [a, b, c];

	// calculate relative burrings and side height.
	const relBurWidth = burringDepth / width;
	const relativeSideHeight = (height - burringHeight * 2) / width;

	// construct UVS points.
	const tex_area = [
		new THREE.Vector2(relBurWidth, relBurWidth),
		new THREE.Vector2(1 - relBurWidth, relBurWidth),
		new THREE.Vector2(1 - relBurWidth, 1 - relBurWidth),
		new THREE.Vector2(relBurWidth, 1 - relBurWidth)
	];
	const tex_side_area = [
		new THREE.Vector2(0, 1 - relativeSideHeight),
		new THREE.Vector2(1, 1 - relativeSideHeight),
		new THREE.Vector2(1, 1),
		new THREE.Vector2(0, 1)
	];
	const tex_top = [
		new THREE.Vector2(relBurWidth, 1 - relBurWidth),
		new THREE.Vector2(1 - relBurWidth, 1 - relBurWidth),
		new THREE.Vector2(1, 1),
		new THREE.Vector2(0, 1)
	];
	const tex_bottom = [
		new THREE.Vector2(1 - relBurWidth, relBurWidth),
		new THREE.Vector2(relBurWidth, relBurWidth),
		new THREE.Vector2(0, 0),
		new THREE.Vector2(1, 0)
	];
	const tex_left = [
		new THREE.Vector2(relBurWidth, relBurWidth),
		new THREE.Vector2(relBurWidth, 1 - relBurWidth),
		new THREE.Vector2(0, 1),
		new THREE.Vector2(0, 0)
	];
	const tex_right = [
		new THREE.Vector2(1 - relBurWidth, 1 - relBurWidth),
		new THREE.Vector2(1 - relBurWidth, relBurWidth),
		new THREE.Vector2(1, 0),
		new THREE.Vector2(1, 1)
	];

	// construct vertices.
	vertices.push(
		// top. 0-3
		new THREE.Vector3(burringDepth, height, burringDepth),
		new THREE.Vector3(width - burringDepth, height, burringDepth),
		new THREE.Vector3(width - burringDepth, height, depth - burringDepth),
		new THREE.Vector3(burringDepth, height, depth - burringDepth),
		// bottom. 4-7
		new THREE.Vector3(width - burringDepth, 0, burringDepth),
		new THREE.Vector3(burringDepth, 0, burringDepth),
		new THREE.Vector3(burringDepth, 0, depth - burringDepth),
		new THREE.Vector3(width - burringDepth, 0, depth - burringDepth),
		// front.8-11
		new THREE.Vector3(burringVertical, burringHeight, 0),
		new THREE.Vector3(width - burringVertical, burringHeight, 0),
		new THREE.Vector3(width - burringVertical, height - burringHeight, 0),
		new THREE.Vector3(burringVertical, height - burringHeight, 0),
		// back.12-15
		new THREE.Vector3(width - burringVertical, burringHeight, depth),
		new THREE.Vector3(burringVertical, burringHeight, depth),
		new THREE.Vector3(burringVertical, height - burringHeight, depth),
		new THREE.Vector3(width - burringVertical, height - burringHeight, depth),
		// left.16-19
		new THREE.Vector3(0, burringHeight, depth - burringVertical),
		new THREE.Vector3(0, burringHeight, burringVertical),
		new THREE.Vector3(0, height - burringHeight, burringVertical),
		new THREE.Vector3(0, height - burringHeight, depth - burringVertical),
		// right.20-23
		new THREE.Vector3(width, burringHeight, burringVertical),
		new THREE.Vector3(width, burringHeight, depth - burringVertical),
		new THREE.Vector3(width, height - burringHeight, depth - burringVertical),
		new THREE.Vector3(width, height - burringHeight, burringVertical)
	);

	// construct faces.
	// areas.
	for(let i = 0; i < 6; ++i){
		faces.push(
			face(i*4 + 2, i*4 + 1, i*4 + 3),
			face(i*4 + 1, i*4 + 0, i*4 + 3)
		);
	}
	// texture areas.
	for(let i = 0; i < 6; ++i){
		if(i < 2){
			faceUvs[i*2 + 0] = [tex_area[2], tex_area[1], tex_area[3]];
			faceUvs[i*2 + 1] = [tex_area[1], tex_area[0], tex_area[3]];
		}
		else{
			faceUvs[i*2 + 0] = [tex_side_area[2], tex_side_area[1], tex_side_area[3]];
			faceUvs[i*2 + 1] = [tex_side_area[1], tex_side_area[0], tex_side_area[3]];
		}
	}
	// edges.
	faces.push(
		// top.
		face(11, 0, 10),
		face(0, 1, 10),
		face(15, 2, 14),
		face(2, 3, 14),
		face(19, 3, 18),
		face(3, 0, 18),
		face(23, 1, 22),
		face(1, 2, 22),
		// bottom.
		face(9, 4, 8),
		face(4, 5, 8),
		face(13, 6, 12),
		face(6, 7, 12),
		face(21, 7, 20),
		face(7, 4, 20),
		face(17, 5, 16),
		face(5, 6, 16),
		// around.
		face(18, 11, 17),
		face(11, 8, 17),
		face(10, 23, 9),
		face(23, 20, 9),
		face(22, 15, 21),
		face(15, 12, 21),
		face(14, 19, 13),
		face(19, 16, 13)
	);
	// textures edges top.
	faceUvs[12] = [tex_bottom[2], tex_bottom[1], tex_bottom[3]];
	faceUvs[13] = [tex_bottom[1], tex_bottom[0], tex_bottom[3]];
	faceUvs[14] = [tex_top[2], tex_top[1], tex_top[3]];
	faceUvs[15] = [tex_top[1], tex_top[0], tex_top[3]];
	faceUvs[16] = [tex_left[2], tex_left[1], tex_left[3]];
	faceUvs[17] = [tex_left[1], tex_left[0], tex_left[3]];
	faceUvs[18] = [tex_right[2], tex_right[1], tex_right[3]];
	faceUvs[19] = [tex_right[1], tex_right[0], tex_right[3]];
	// textures edges bottom.
	faceUvs[20] = [tex_bottom[2], tex_bottom[1], tex_bottom[3]];
	faceUvs[21] = [tex_bottom[1], tex_bottom[0], tex_bottom[3]];
	faceUvs[22] = [tex_top[2], tex_top[1], tex_top[3]];
	faceUvs[23] = [tex_top[1], tex_top[0], tex_top[3]];
	faceUvs[24] = [tex_left[2], tex_left[1], tex_left[3]];
	faceUvs[25] = [tex_left[1], tex_left[0], tex_left[3]];
	faceUvs[26] = [tex_right[2], tex_right[1], tex_right[3]];
	faceUvs[27] = [tex_right[1], tex_right[0], tex_right[3]];
	// textures edges around.
	for(let i = 0; i < 4; ++i){
		faceUvs[28 + i * 2] = [tex_side_area[3], tex_side_area[3], tex_side_area[0]];
		faceUvs[28 + i * 2 + 1] = [tex_side_area[3], tex_side_area[0], tex_side_area[0]];
	}

	// corners.
	faces.push(
		// top.
		face(18, 0, 11),
		face(10, 1, 23),
		face(22, 2, 15),
		face(14, 3, 19),
		// bottom.
		face(8, 5, 17),
		face(20, 4, 9),
		face(12, 7, 21),
		face(16, 6, 13)
	);
	// texture corners.
	for(let i = 0; i < 2; ++i){
		faceUvs[36 + i * 4] = [tex_left[3], tex_left[0], tex_left[3]];
		faceUvs[37 + i * 4] = [tex_bottom[3], tex_bottom[0], tex_bottom[3]];
		faceUvs[38 + i * 4] = [tex_right[3], tex_right[0], tex_right[3]];
		faceUvs[39 + i * 4] = [tex_top[3], tex_top[0], tex_top[3]];
	}

	// do posterior work.
	const positions = [];
	const uvs = [];
	faces.forEach((f, i) => {
		f.forEach((v, k) => {
			positions.push(vertices[v].x, vertices[v].y, vertices[v].z);
			uvs.push(faceUvs[i][k].x, faceUvs[i][k].y);
		});
	});
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	// no shared vertices, so this gives flat per-face normals like the old computeFaceNormals
	geometry.computeVertexNormals();
	geometry.center();
	return geometry;
}

let animationsEnabled = true;
let shadowsEnabled = true;

function updateShadowsVisibility(){
	if(!scene){return;}
	// Update shadow light casting
	const fill = lightBrightness / shadowStrength;
	if(shadowLight){
		shadowLight.castShadow = shadowsEnabled;
		shadowLight.intensity = shadowsEnabled ? lightIntensity.shadow * lightBrightness : 0;
	}
	// Update renderer shadow map
	if(renderer){
		renderer.shadowMap.enabled = shadowsEnabled;
	}
	// Update lighting to use flat ambient light when shadows off
	if(board.pointLight){
		board.pointLight.intensity = shadowsEnabled ? board.pointLightIntensity * fill : 0;
	}
	if(board.hemisphereLight){
		board.hemisphereLight.intensity = shadowsEnabled ? board.hemisphereLightIntensity * fill : 0;
	}
	if(board.ambientLight){
		board.ambientLight.intensity = shadowsEnabled ? 0 : lightIntensity.ambient * lightBrightness;
	}
	for(let i = 0; i < board.piece_objects.length; i++){
		board.piece_objects[i].receiveShadow = shadowsEnabled;
	}
	// Update table and board receiveShadow
	if(board.table){
		board.table.receiveShadow = shadowsEnabled;
	}
	for(let i = 0; i < board.board_objects.length; i++){
		board.board_objects[i].receiveShadow = shadowsEnabled;
	}
}

const animation = {
	queue: [], // { objects, from, to, fromRot, toRot, type, duration, onComplete }
	playing: false,
	pendingFrom: null, // stores the 'from' positions/rotations for the next animation
	pendingCallbacks: [], // callbacks waiting for animation to complete

	push: function(objects, type, duration, onComplete){
		const positions = objects.map(function(obj){return obj.position.clone();});
		const rotations = objects.map(function(obj){return obj.quaternion.clone();});
		if(!type){
			// Store positions/rotations as the starting point for the next animation
			this.pendingFrom = {objects: objects.slice(), positions: positions, rotations: rotations};
		}
		else{
			// Apply animation speed multiplier to duration
			// Higher speed = shorter duration, so divide instead of multiply
			// Ensure animationSpeed is valid
			if(animationSpeed <= 0 || animationSpeed === undefined || isNaN(animationSpeed)){
				animationSpeed = 1.0;
			}
			const adjustedDuration = duration / animationSpeed;
			// This is an animation frame - use pendingFrom as 'from' and current as 'to'
			const from = this.pendingFrom ? this.pendingFrom.positions : positions;
			const fromRot = this.pendingFrom ? this.pendingFrom.rotations : rotations;
			this.queue.push({
				objects: objects.slice(),
				from: from,
				to: positions,
				fromRot: fromRot,
				toRot: rotations,
				type: type,
				duration: adjustedDuration,
				onComplete: onComplete
			});
			// Immediately reset objects to start position to prevent flash at end position
			if(this.pendingFrom){
				for(let i = 0; i < objects.length; i++){
					objects[i].position.copy(from[i]);
					objects[i].quaternion.copy(fromRot[i]);
				}
			}
			this.pendingFrom = null;
		}
	},

	play: function(onComplete){
		// Only clear pendingFrom if we're actually going to start playing
		if(!this.playing){
			this.pendingFrom = null;
		}
		if(!animationsEnabled){
			// Skip animations - just set final positions/rotations and call callback
			while(this.queue.length > 0){
				const frame = this.queue.shift();
				for(let i = 0; i < frame.objects.length; ++i){
					frame.objects[i].position.copy(frame.to[i]);
					frame.objects[i].quaternion.copy(frame.toRot[i]);
				}
				if(frame.onComplete){frame.onComplete();}
			}
			if(onComplete){onComplete();}
			return;
		}
		// Reset playing flag if queue was empty (safety check)
		if(this.queue.length === 0){
			this.playing = false;
		}
		if(!this.playing && this.queue.length > 0){
			this.playing = true;
			this.onAllComplete = onComplete;
			this.nextFrame();
		}
		else if(onComplete){
			onComplete();
		}
	},

	nextFrame: function(){
		if(this.queue.length === 0){
			this.playing = false;
			if(this.onAllComplete){
				const callback = this.onAllComplete;
				this.onAllComplete = null;
				callback();
			}
			// Call any pending callbacks waiting for animation to complete
			while(this.pendingCallbacks.length > 0){
				const cb = this.pendingCallbacks.shift();
				cb();
			}
		}
		else{
			const frame = this.queue.shift();
			this.playFrame(frame, performance.now());
		}
	},

	// Call callback when current animation completes (or immediately if not playing)
	whenComplete: function(callback){
		if(!this.playing || !animationsEnabled){
			callback();
		}
		else{
			this.pendingCallbacks.push(callback);
		}
	},

	// Stop all animations and jump to final positions
	stop: function(){
		this.playing = false;
		this.pendingFrom = null;
		while(this.queue.length > 0){
			const frame = this.queue.shift();
			for(let i = 0; i < frame.objects.length; ++i){
				frame.objects[i].position.copy(frame.to[i]);
				frame.objects[i].quaternion.copy(frame.toRot[i]);
			}
		}
		this.onAllComplete = null;
		// Call pending callbacks since animation is now complete
		while(this.pendingCallbacks.length > 0){
			const cb = this.pendingCallbacks.shift();
			cb();
		}
	},

	playFrame: function(frame, startTime){
		const objects = frame.objects;
		const from = frame.from;
		const to = frame.to;
		const fromRot = frame.fromRot;
		const toRot = frame.toRot;
		const type = frame.type;
		let duration = frame.duration;

		// Immediately set objects to their starting positions/rotations to prevent snap
		for(let i = 0; i < objects.length; ++i){
			objects[i].position.copy(from[i]);
			objects[i].quaternion.copy(fromRot[i]);
		}

		if(type === 'jump'){
			const dx = to[0].x - from[0].x;
			const dy = to[0].y - from[0].y;
			const dz = to[0].z - from[0].z;
			const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

			duration = Math.max(frame.duration, frame.duration * distance * 0.003);
		}

		const self = this;
		const isLastFrame = this.queue.length === 0;
		let soundPlayed = false;
		const soundTime = Math.max(0, duration - SOUND_OFFSET_BEFORE_ANIMATION_END); // Play sound before animation ends
		const animate = function(now){
			try{
				const elapsed = now - startTime;
				let t = elapsed / duration;
				if(t >= 1){t = 1;}

				// Play sound 100ms before animation ends on last frame
				if(isLastFrame && !soundPlayed && elapsed >= soundTime && self.onAllComplete){
					soundPlayed = true;
					self.onAllComplete();
					self.onAllComplete = null;
				}

				for(let i = 0; i < objects.length; ++i){
					// Interpolate rotation using slerp
					objects[i].quaternion.slerpQuaternions(fromRot[i], toRot[i], t);

					if(type === 'move'){
						objects[i].position.lerpVectors(from[i], to[i], t);
					}

					if(type === 'jump'){
						const obj = objects[i];

						obj.position.x = from[i].x + (to[i].x - from[i].x) * t;
						obj.position.z = from[i].z + (to[i].z - from[i].z) * t;

						const dx = to[i].x - from[i].x;
						const dz = to[i].z - from[i].z;
						const distance = Math.sqrt(dx * dx + dz * dz);

						const jumpHeight = 40 + distance * 0.33;
						const baseY = from[i].y + (to[i].y - from[i].y) * t;
						obj.position.y = baseY + jumpHeight * 4 * t * (1 - t);
					}
				}

				if(t < 1){
					requestAnimationFrame(animate);
				}
				else{
					// Ensure final position/rotation is exact
					for(let j = 0; j < objects.length; ++j){
						objects[j].position.copy(to[j]);
						objects[j].quaternion.copy(toRot[j]);
					}
					self.nextFrame();
				}
			}
			catch(e){
				console.error('Animation error:', e);
				self.playing = false;
				self.queue = [];
			}
		};

		requestAnimationFrame(animate);
	}
};

const board = {
	totcaps: 0,
	tottiles: 0,
	whitepiecesleft: 0,
	blackpiecesleft: 0,
	// string representation of contents of each square on the board
	sq: [],
	// visual objects representing the board
	board_objects: [],
	// visual objects representing the pieces
	piece_objects: [],
	lastMovedSquareList: [],
	move: {start: null,end: null,dir: 'U',squares: []},
	highlighted: null,
	lastMoveHighlighted: null,
	lastMoveHighlighterVisible: false,
	totalhighlighted: null,
	selected: null,
	selectedStack: null,
	selectedCompanion: null, // Double Black Stack: the second black flat lifted with the first
	boardside: "white",
	overlay: null,
	isBot: false,

	// Keep track of some important positions
	sq_position: {startx: 0,startz: 0,endx: 0,endz: 0},
	corner_position: {x: 0,z: 0,endx: 0,endz: 0},

	// a stack of board layouts,
	board_history: [],

	create: function(sz,pieces,capstones){
		if(sz === 3){
			this.totcaps = 0;
			this.tottiles = 10;
		}
		else if(sz === 4){
			this.totcaps = 0;
			this.tottiles = 15;
		}
		else if(sz === 5){
			this.totcaps = 1;
			this.tottiles = 21;
		}
		else if(sz === 6){
			this.totcaps = 1;
			this.tottiles = 30;
		}
		else if(sz === 7){
			this.totcaps = 2;
			this.tottiles = 40;
		}
		else{
			this.totcaps = 2;
			this.tottiles = 50;
		}
		if(pieces>=10){
			this.tottiles=pieces;
		}
		if(capstones>=0){
			this.totcaps=capstones;
		}
		this.whitepiecesleft = this.tottiles + this.totcaps;
		this.blackpiecesleft = this.tottiles + this.totcaps;
		this.sq = [];
		this.board_objects = [];
		this.piece_objects = [];
		this.highlighted = null;
		this.lastMoveHighlighted = null;
		this.selected = null;
		this.selectedStack = null;
		this.selectedCompanion = null;
		this.move = {start: null, end: null, dir: 'U', squares: []};
		//gameData.observing = typeof obs !== 'undefined' ? obs : false
		this.board_history = [];
		generateCamera();
	},
	initEmpty: function(){
		// we keep track of the complete board position before each move
		// thus, the initial board position is an empty board of the proper size
		this.pushInitialEmptyBoard(gameData.size);

		this.addtable();
		this.addlight();
		this.addboard();
		this.addpieces();
		this.updateShadowCamera();
		updateShadowsVisibility();

		if(!gameData.is_scratch && ((gameData.my_color=="black") != (this.boardside=="black"))){
			this.reverseboard();
		}
	},
	//remove all scene objects, reset player names, stop time, etc
	clear: function(){
		for(let i = scene.children.length - 1;i >= 0;i--){
			scene.remove(scene.children[i]);
		}
		this.lastMovedSquareList = [];
		animation.pendingCallbacks = [];
		// Re-add shadow light after clearing scene
		if(shadowLight){
			scene.add(shadowLight);
			scene.add(shadowLight.target);
		}
		// Reset board orientation so rotation logic works correctly on rematch
		if(this.boardside === "black"){
			this.boardside = "white";
			camera.position.z = -camera.position.z;
			camera.position.x = -camera.position.x;
			controls.target.z = -controls.target.z;
			controls.target.x = -controls.target.x;
		}
	},
	newOnlinegame: function(sz,col,komi,pieces,capstones, triggerMove, timeAmount){
		this.clear();
		this.create(sz,col,false,false,komi,pieces,capstones, triggerMove, timeAmount);
		this.initEmpty();
	},
	calculateBoardPositions: function(){
		this.length = gameData.size*sq_size + border_size*2;
		this.sq_position.endx = ((gameData.size-1)*sq_size) / 2.0;
		this.sq_position.endz = ((gameData.size-1)*sq_size) / 2.0;
		this.sq_position.startx = -this.sq_position.endx;
		this.sq_position.startz = -this.sq_position.endz;
		this.corner_position.endx = this.length/2;
		this.corner_position.endz = this.length/2;
		this.corner_position.x = -this.corner_position.endx;
		this.corner_position.z = -this.corner_position.endz;
	},
	// addboard: draws the empty board in the scene
	// The center of the board is at 0,0,0.
	// All these elements are drawn as centered at their x,y,z position
	addboard: function(){
		this.calculateBoardPositions();
		// draw the squares
		for(let i = 0;i < gameData.size;i++){
			for(let j = 0;j < gameData.size;j++){
				// We draw them from the left to right and top to bottom.
				// But, note, the naming (A1, B1, etc) is left to right and bottom to top.
				const square = boardFactory.makeSquare(i,j,scene);
				this.board_objects.push(square);
				this.sq[i][j].board_object = square;
			}
		}

		// draw the border around the squares
		boardFactory.makeBorders(scene);
		// draw the text around the board
		boardFactory.makeBorderText(scene);
		// Load overlay: custom overlay takes priority, then preset by ID, then default to aaron
		if(localStorage.getItem('boardOverlay')){
			// Custom uploaded overlay
			this.addOverlay(localStorage.getItem('boardOverlay'));
		}
		else{
			const overlayId = localStorage.getItem('boardOverlayId');
			if(overlayId === 'none'){
				// Explicitly set to no overlay
			}
			else if(overlayId && typeof overlaysMap !== 'undefined' && overlaysMap[overlayId]){
				// Preset overlay by ID
				this.addOverlay('images/board/overlays/' + overlaysMap[overlayId].file);
			}
			else if(boardDefaults.overlayFile){
				// Default overlay from boardDefaults
				this.addOverlay('images/board/overlays/' + boardDefaults.overlayFile);
			}
		}
	},
	addOverlay: function(value){
		const overlay_texture = srgb(new THREE.TextureLoader().load(value ?? materials.boardOverlayPath));
		overlay_texture.wrapS = overlay_texture.wrapT = THREE.ClampToEdgeWrapping;
		overlay_texture.offset.set(materials.overlayMap[gameData.size].offset.x, materials.overlayMap[gameData.size].offset.y);
		overlay_texture.repeat.set(materials.overlayMap[gameData.size].repeat.x, materials.overlayMap[gameData.size].repeat.y);
		const overlay_material = new THREE.MeshLambertMaterial({map: overlay_texture});
		overlay_texture.magFilter = THREE.LinearFilter;
		overlay_texture.minFilter = THREE.LinearFilter;
		overlay_texture.generateMipmaps = true;
		overlay_texture.anisotropy = 4;
		const geometry = new THREE.BoxGeometry(materials.overlayMap[gameData.size].size, 2, materials.overlayMap[gameData.size].size);
		this.overlay = new THREE.Mesh(geometry, overlay_material);
		this.overlay.position.set(
			0,
			7,
			0
		);
		this.overlay.ispassive = true;
		this.overlay.receiveShadow = true;
		this.overlay.renderOrder = 0;
		scene.add(this.overlay);
	},
	removeOverlay: function(){
		if(this.overlay){
			scene.remove(this.overlay);
			this.overlay = null;
		}
	},
	// Add the table
	addtable: function(){
		const table_texture = srgb(new THREE.TextureLoader().load(materials.table_texture_path));
		const table_material = new THREE.MeshLambertMaterial({map: table_texture});
		const geometry = constructBurredBox(table_width, table_height, table_depth, 5, 5, 5);
		this.table = new THREE.Mesh(geometry, table_material);
		this.table.position.set(0, -(table_height + sq_height) / 2, 0);
		this.table.ispassive = true;
		this.table.receiveShadow = true;
		scene.add(this.table);
		// Create shadow plane for when table is hidden (matches background color)
		// Use ShadowMaterial which is invisible except for shadows
		const shadowPlaneGeometry = new THREE.PlaneGeometry(table_width * 2, table_depth * 2);
		const shadowPlaneMaterial = new THREE.ShadowMaterial({opacity: 0.3});
		this.shadowPlane = new THREE.Mesh(shadowPlaneGeometry, shadowPlaneMaterial);
		this.shadowPlane.rotation.x = -Math.PI / 2;
		this.shadowPlane.position.set(0, -sq_height / 2 - 0.5, 0);
		this.shadowPlane.ispassive = true;
		this.shadowPlane.receiveShadow = true;
		scene.add(this.shadowPlane);
		// Show table or shadow plane based on setting (default to hidden)
		const showTable = localStorage.getItem('show_table') === 'true';
		this.table.visible = showTable;
		this.shadowPlane.visible = !showTable;
	},
	// Add light for the table
	addlight: function(){
		this.pointLight = new THREE.PointLight(0x999999, lightIntensity.point, light_radius[1], 0);
		this.pointLight.position.x = light_position[0];
		this.pointLight.position.y = light_position[1];
		this.pointLight.position.z = light_position[2];
		this.pointLight.ispassive = true;
		scene.add(this.pointLight);
		this.hemisphereLight = new THREE.HemisphereLight(0xFFFFFF, 0xFFFFFF, lightIntensity.hemisphere);
		this.hemisphereLight.color.setHSL(0.15, 0.1, 0.7);
		this.hemisphereLight.groundColor.setHSL(0.1, 0.8, 1);
		this.hemisphereLight.ispassive = true;
		scene.add(this.hemisphereLight);
		// Ambient light for flat shading when shadows disabled
		this.ambientLight = new THREE.AmbientLight(0xffffff, 0);
		this.ambientLight.ispassive = true;
		scene.add(this.ambientLight);
		// Store original intensities for toggling
		this.pointLightIntensity = lightIntensity.point;
		this.hemisphereLightIntensity = lightIntensity.hemisphere;
	},
	// Update shadow camera frustum to match board size plus table area
	updateShadowCamera: function(){
		if(!shadowLight){return;}
		// Include extra space for pieces on the table (capstones, unplayed pieces)
		const shadowCamSize = gameData.size * sq_size / 2 + border_size + stackOffsetFromBorder + piece_size * 2;
		shadowLight.shadow.camera.left = -shadowCamSize;
		shadowLight.shadow.camera.right = shadowCamSize;
		shadowLight.shadow.camera.top = shadowCamSize;
		shadowLight.shadow.camera.bottom = -shadowCamSize;
		// Cover from the light down past the table, whichever way the light is angled
		shadowLight.shadow.camera.near = 1;
		shadowLight.shadow.camera.far = shadowLight.position.length() + 400;
		shadowLight.shadow.camera.updateProjectionMatrix();
	},
	// addpieces: add the pieces to the scene, not on the board
	addpieces: function(){
		let piece;
		const stacks=Math.ceil(this.tottiles/10+this.totcaps);
		stack_dist=Math.min((border_size*2+sq_size*gameData.size-stacks*piece_size)/Math.max(stacks-1,1),piece_size);
		for(let i=0;i < this.tottiles;i++){
			piece = pieceFactory.makePiece(WHITE_PLAYER,i,scene);
			this.piece_objects.push(piece);

			piece = pieceFactory.makePiece(BLACK_PLAYER,i,scene);
			this.piece_objects.push(piece);
		}

		for(let i=0;i < this.totcaps;i++){
			piece = pieceFactory.makeCap(WHITE_PLAYER,i,scene);
			this.piece_objects.push(piece);

			piece = pieceFactory.makeCap(BLACK_PLAYER,i,scene);
			this.piece_objects.push(piece);
		}
	},
	// called if the user changes the texture of the board
	updateboard: function(){
		materials.updateBoardMaterials();
	},
	updateBorderColor: function(val){
		materials.updateBorderColor(val);
	},
	updateBorderTexture: function(value){
		materials.updateBorderTexture(value);
	},
	removeBorderTexture: function(){
		materials.removeBorderTexture();
	},
	updateBorderSize: function(val){
		materials.updateBorderSize(val);
	},
	updateLetterVisibility: function(val){
		materials.updateLetterVisibility(val);
	},
	updateLetterColor: function(color){
		materials.updateLetterColor(color);
	},
	// called if the user changes the texture or size of the pieces
	updatepieces: function(){
		const stacks=Math.ceil(this.tottiles/10+this.totcaps);
		stack_dist=Math.min((border_size*2+sq_size*gameData.size-stacks*piece_size)/Math.max(stacks-1,1),piece_size);
		const geometryW=piecegeometry("white");
		const geometryB=piecegeometry("black");
		const capGeometryW = capgeometry("white");
		const capGeometryB = capgeometry("black");
		materials.updatePieceMaterials();
		const old_size = this.piece_objects[0].geometry.parameters.width;

		// for all pieces...
		for(let i = 0;i < this.piece_objects.length;i++){
			const piece=this.piece_objects[i];
			// Handle selected unplayed piece - update geometry, rotation, AND position
			if(piece === this.selected && !piece.onsquare){
				if(piece.iscapstone){
					piece.geometry = piece.iswhitepiece ? capGeometryW : capGeometryB;
					piece.updateMatrix();
					// Update position with selection offset
					const posAsWhite = piece.positionAsWhite !== undefined ? piece.positionAsWhite : piece.iswhitepiece;
					if(posAsWhite){
						piece.position.set(
							board.corner_position.endx + capstone_radius + stackOffsetFromBorder,
							capstone_height/2-sq_height/2 + stack_selection_height,
							board.corner_position.z + capstone_radius + piece.pieceNum*(stack_dist+capstone_radius*2)
						);
					}
					else{
						const invertBlackZ = shouldInvertBlackPiecesZ();
						const zPos = invertBlackZ
							? board.corner_position.z + capstone_radius + piece.pieceNum*(stack_dist+capstone_radius*2)
							: board.corner_position.endz - capstone_radius - piece.pieceNum*(stack_dist+capstone_radius*2);
						piece.position.set(
							board.corner_position.x - capstone_radius - stackOffsetFromBorder,
							capstone_height/2-sq_height/2 + stack_selection_height,
							zPos
						);
					}
				}
				else{
					const wasStanding = piece.isstanding;
					piece.rotation.set(0,0,0);
					piece.isstanding = false;
					piece.geometry = piece.iswhitepiece ? geometryW : geometryB;
					piece.updateMatrix();
					if(wasStanding){
						piece.isstanding = true;
						// Rotate black walls 90 degrees (before X rotation)
						if(!piece.iswhitepiece){piece.rotateY(Math.PI / 2);}
						piece.rotateX(-Math.PI / 2);
						if(diagonal_walls){piece.rotateZ(-Math.PI / 4);}
					}
					// Update position with selection offset
					const stackno = Math.floor(piece.pieceNum / 10);
					const stackheight = piece.pieceNum % 10;
					// Standing stones float above the stack (stackheight pieces below), flats sit in the stack
					const baseY = wasStanding
						? (stackheight*piece_height + piece_size/2 - sq_height/2)
						: (stackheight*piece_height + piece_height/2 - sq_height/2);
					const posAsWhite = piece.positionAsWhite !== undefined ? piece.positionAsWhite : piece.iswhitepiece;
					if(posAsWhite){
						piece.position.set(
							board.corner_position.endx + stackOffsetFromBorder + piece_size/2,
							baseY + stack_selection_height,
							board.corner_position.endz - piece_size/2 - stackno*(stack_dist+piece_size)
						);
					}
					else{
						const invertBlackZ = shouldInvertBlackPiecesZ();
						const zPos = invertBlackZ
							? board.corner_position.endz - piece_size/2 - stackno*(stack_dist+piece_size)
							: board.corner_position.z + piece_size/2 + stackno*(stack_dist+piece_size);
						piece.position.set(
							board.corner_position.x - stackOffsetFromBorder - piece_size/2,
							baseY + stack_selection_height,
							zPos
						);
					}
				}
				continue;
			}
			if(piece.iscapstone){
				const grow=capstone_height-piece.geometry.parameters.height;
				piece.position.y+=grow/2;
				if(piece.iswhitepiece){
					piece.geometry = capGeometryW;
				}
				else{
					piece.geometry = capGeometryB;
				}
				piece.updateMatrix();
			}
			else{
				// Track if piece was standing before reset
				const wasStanding = piece.isstanding;

				// Reset rotation first
				piece.rotation.set(0,0,0);
				piece.updateMatrix();
				piece.isstanding = false;

				// reapply geometry.
				if(piece.iswhitepiece){
					piece.geometry = geometryW;
				}
				else{
					piece.geometry = geometryB;
				}
				piece.updateMatrix();

				// Reapply standing orientation if it was standing
				if(wasStanding){
					piece.isstanding = true;
					// Rotate black walls 90 degrees (before X rotation)
					if(!piece.iswhitepiece){piece.rotateY(Math.PI / 2);}
					piece.rotateX(-Math.PI / 2);
					if(diagonal_walls){piece.rotateZ(-Math.PI / 4);}
				}
			}
			// Update Y position for pieces on squares (piece_size may have changed)
			if(piece.onsquare){
				const sq = piece.onsquare;
				const st = this.get_stack(sq);
				const stackIndex = st.indexOf(piece);
				if(piece.iscapstone){
					piece.position.y = sq_height/2 + capstone_height/2 + piece_height * stackIndex;
				}
				else if(piece.isstanding){
					piece.position.y = sq_height/2 + piece_size/2 + piece_height * stackIndex;
				}
				else{
					piece.position.y = sq_height + stackIndex * piece_height;
				}
			}
			else if(!piece.onsquare){
				const selectionOffset = (piece === this.selected) ? stack_selection_height : 0;
				if(piece.iscapstone){
					if(piece.iswhitepiece){
						piece.position.set(
							board.corner_position.endx + capstone_radius + stackOffsetFromBorder,
							capstone_height/2-sq_height/2 + selectionOffset,
							board.corner_position.z + capstone_radius + piece.pieceNum*(stack_dist+capstone_radius*2)
						);
					}
					else{
						const invertBlackZ = shouldInvertBlackPiecesZ();
						const zPos = invertBlackZ
							? board.corner_position.z + capstone_radius + piece.pieceNum*(stack_dist+capstone_radius*2)
							: board.corner_position.endz - capstone_radius - piece.pieceNum*(stack_dist+capstone_radius*2);
						piece.position.set(
							board.corner_position.x - capstone_radius - stackOffsetFromBorder,
							capstone_height/2-sq_height/2 + selectionOffset,
							zPos
						);
					}
				}
				else{
					const stackno = Math.floor(piece.pieceNum / 10);
					const stackheight = piece.pieceNum % 10;
					const baseY = piece.isstanding ? (piece_size/2-sq_height/2) : (stackheight*piece_height+piece_height/2-sq_height/2);
					// Use positionAsWhite to preserve swapped first-turn pieces
					const posAsWhite = piece.positionAsWhite !== undefined ? piece.positionAsWhite : piece.iswhitepiece;
					if(posAsWhite){
						piece.position.set(
							board.corner_position.endx + stackOffsetFromBorder + piece_size/2,
							baseY + selectionOffset,
							board.corner_position.endz - piece_size/2 - stackno*(stack_dist+piece_size)
						);
					}
					else{
						const invertBlackZ = shouldInvertBlackPiecesZ();
						const zPos = invertBlackZ
							? board.corner_position.endz - piece_size/2 - stackno*(stack_dist+piece_size)
							: board.corner_position.z + piece_size/2 + stackno*(stack_dist+piece_size);
						piece.position.set(
							board.corner_position.x - stackOffsetFromBorder - piece_size/2,
							baseY + selectionOffset,
							zPos
						);
					}
				}
			}
		}
		// refit custom models to the new piece size
		refreshCustomPieces();
	},
	file: function(no){
		return String.fromCharCode('A'.charCodeAt(0) + no);
	},
	//file is no. rank is no.
	squarename: function(file,rank){
		return this.file(file) + (rank + 1);
	},
	get_board_obj: function(file,rank){
		return this.sq[file][gameData.size - 1 - rank].board_object;
	},
	// Square notation spans the largest board (a-h, 1-8), so a coordinate parsed
	// from a PTN can name a square this board does not have. get_board_obj would
	// index outside this.sq and throw, so callers handling untrusted notation
	// must check first. Uses the allocated dimension rather than gameData.size,
	// which load() leaves as a string from the PTN tag.
	isOnBoard: function(file,rank){
		const n = this.sq.length;
		return file >= 0 && file < n && rank >= 0 && rank < n;
	},
	incmovecnt: function(){
		this.save_board_pos();
		incrementMoveCounter();
	},
	// We save an array that contains a description of the pieces in each cell.
	// Each piece is either a:	p=flatstone, c=capstone, w=wall
	// Uppercase is a whitepiece, Lowercase is a blackpiece
	save_board_pos: function(){
		const bp = [];
		//for all squares, convert stack info to board position info
		for(let i=0;i<gameData.size;i++){
			for(let j=0;j<gameData.size;j++){
				const bp_sq = [];
				const stk = this.sq[i][j];
				for(let s=0;s<stk.length;s++){
					const pc = stk[s];
					let c = 'p';
					if(pc.iscapstone){c = 'c';}
					else if(pc.isstanding){c = 'w';}

					if(pc.iswhitepiece){c = c.charAt(0).toUpperCase();}

					bp_sq.push(c);
				}
				bp.push(bp_sq);
			}
		}
		this.board_history.push(bp);
	},
	// called on show move and undo
	apply_board_pos: function(moveNum){
		// grab the given board_history
		// pos is a single dim. array of size*size containing arrays of piece types
		const pos = this.board_history[moveNum - gameData.move_start];
		if(pos === 'undefined'){
			console.warn("no board position found for moveNum " + moveNum);
			return;
		}

		// scan through each cell in the pos array
		for(let i=0;i<gameData.size;i++){//file
			for(let j=0;j<gameData.size;j++){//rank
				const sq = this.get_board_obj(i,j);
				const sqpos = pos[i*gameData.size + j];
				// sqpos describes a stack of pieces in that square
				// scan through those pieces
				for(let s=0;s<sqpos.length;s++){
					const pcType = sqpos[s];
					const iscap = (pcType==='c' || pcType==='C');
					const iswall = (pcType==='w' || pcType==='W');
					const iswhite = (pcType===pcType.charAt(0).toUpperCase());

					// get an available piece
					const pc = this.getfromstack(iscap,iswhite);
					// what if there is not a piece available? Maybe that
					// is not possible, because when we first created the board
					// we know that there were enough pieces.
					if(iswall){this.standup(pc);}

					this.pushPieceOntoSquare(sq,pc);
					if(iswhite){this.whitepiecesleft--;}
					else{this.blackpiecesleft--;}
				}
			}
		}
	},
	mousepick: function(){
		raycaster.setFromCamera(mouse,camera);
		const intersects = raycaster.intersectObjects(scene.children);
		for(let a=0;a<intersects.length;a++){
			let potential=intersects[a].object;
			// a custom model is a child of its piece
			while(potential.parent && potential.parent !== scene){potential = potential.parent;}
			if(potential.isboard){
				return ["board",potential,potential.rank,potential.file];
			}
			else if(potential.isboard===false){
				if(potential.onsquare){
					if(!clickthrough){
						return ["board",potential.onsquare,potential.onsquare.rank,potential.onsquare.file];
					}
				}
				else{
					return ["piece",potential];
				}
			}
		}
		return ["none"];
	},
	leftclick: function(){
		const pick=this.mousepick();
		this.remove_total_highlight();
		if(!checkIfMyMove()){
			return;
		}
		if(pick[0]=="board"){
			const destinationstack = this.get_stack(pick[1]);
			if(this.selected){
				if(destinationstack.length==0){
					// Defer placement until mouseup confirms it was a click, not a drag
					pendingPlacement = { sq: pick[1], piece: this.selected, hideSelectionShadow: true };
					this.selected = null;
				}
			}
			// Left click move stack
			else if(this.selectedStack){
				const tp = this.top_of_stack(pick[1]);
				if(tp && (tp.iscapstone || (tp.isstanding && !this.selectedStack[this.selectedStack.length - 1].iscapstone))){
					// Can't drop on capstone or standing stone (unless flattening with capstone)
				}
				else{
					const prev = this.move.squares[this.move.squares.length - 1];
					const rel = this.sqrel(prev,pick[1]);
					let goodmove=false;
					if(this.move.dir === 'U' && rel !== 'OUTSIDE'){
						goodmove=true;
					}
					else if(this.move.dir === rel || rel === 'O'){
						goodmove=true;
					}
					if(goodmove){
						// Stop any playing animation to prevent race conditions when clicking rapidly
						if(animation.playing){
							animation.stop();
						}
						const obj = this.selectedStack.pop();
						const isLastPiece = this.selectedStack.length === 0;
						const isSameSquare = pick[1] === this.move.squares[this.move.squares.length - 1];
						const isMoveCanceled = isLastPiece && pick[1] === this.move.start;
						if(isLastPiece){
							const wallToFlatten = this.top_of_stack(pick[1]);
							const hasWallToFlatten = wallToFlatten && wallToFlatten.isstanding && !wallToFlatten.iscapstone && obj.iscapstone;
							const objectsToAnimate = hasWallToFlatten ? [obj, wallToFlatten] : [obj];
							animation.push(objectsToAnimate);
							this.pushPieceOntoSquare(pick[1],obj);
							const animType = isSameSquare ? 'move' : 'jump';
							animation.push(objectsToAnimate, animType, isSameSquare ? 100 : 200);
							// Only play sound if move was actually made, not canceled
							animation.play(isMoveCanceled ? null : playMoveSound);
						}
						else{
							const allPieces = [obj].concat(this.selectedStack);
							animation.push(allPieces);
							this.pushPieceOntoSquare(pick[1],obj);
							this.move_stack_over(pick[1],this.selectedStack, false);
							animation.push(allPieces, 'move', 100);
							animation.play();
						}
						this.move.squares.push(pick[1]);

						if(this.move.squares.length > 1 && this.move.dir === 'U'){this.setmovedir();}

						if(this.selectedStack.length === 0){
							this.move.end = pick[1];
							this.selectedStack = null;
							this.unhighlight_sq();
							this.generateMove();
						}
					}
				}
			}
			else{
				if(!gameData.is_game_end){
					const stk = this.get_stack(pick[1]);
					if(stk.length === 0){
						// Defer placement until mouseup confirms it was a click, not a drag
						const isWhiteToMove = isWhitePieceToMove();
						const pieceToPlace = this.getfromstack(false, isWhiteToMove);
						if(pieceToPlace){
							pendingPlacement = { sq: pick[1], piece: pieceToPlace, hideSelectionShadow: false };
						}
					}
					else if(gameData.move_count >= 2 && this.is_top_mine(pick[1])){
						this.selectStack(stk);
						this.move.start = pick[1];
						this.move.squares.push(pick[1]);
					}
				}
			}
		}
		else if(pick[0]=="piece"){
			if(this.selected){
				if(this.selected === pick[1] && gameData.move_count>=2){
					this.rotate(pick[1], true);
					justRotatedPiece = true;
				}
				else{
					this.cancelMove();
				}
			}
			else if(this.selectedStack){
				this.cancelMove();
			}
			else{
				if(!gameData.is_game_end){
					if(gameData.move_count < 2){
						// First turn rule: select the swapped piece (opponent's color on your side)
						// No capstones on first moves
						if(!pick[1].iscapstone){
							// Determine whose turn it is (not what color to pick)
							const isWhitePlayerTurn = (gameData.move_count % 2 === 0);
							const pieceToSelect = this.getSwappedFirstPiece(isWhitePlayerTurn);
							if(pieceToSelect){
								pieceToSelect.isFirstTurnPiece = true;
								this.select(pieceToSelect);
								justSelectedPiece = true;
							}
						}
					}
					else{
						// Normal turns: select your own colored pieces
						// isWhitePieceToMove returns the color of piece to pick (same as player color after move 2)
						const myColor = isWhitePieceToMove();
						if(pick[1].iswhitepiece === myColor){
							const pieceToSelect = this.getfromstack(pick[1].iscapstone, pick[1].iswhitepiece);
							if(pieceToSelect){
								this.select(pieceToSelect);
								justSelectedPiece = true;
							}
						}
					}
				}
			}
		}
		// Background click cancel is handled in onDocumentMouseUp to allow view rotation
	},
	mousemove: function(){
		const pick=this.mousepick();
		if(pick[0]=="board" && this.selectedStack){
			const tp = this.top_of_stack(pick[1]);
			if(tp && (tp.iscapstone || (tp.isstanding && !this.selectedStack[this.selectedStack.length - 1].iscapstone))){
				this.unhighlight_sq();
			}
			else{
				const prev = this.move.squares[this.move.squares.length - 1];
				const rel = this.sqrel(prev,pick[1]);
				let goodmove=false;
				if(this.move.dir === 'U' && rel !== 'OUTSIDE'){
					goodmove=true;
				}
				else if(this.move.dir === rel || rel === 'O'){
					goodmove=true;
				}
				if(goodmove){
					this.highlight_sq(pick[1]);
				}
				else{
					this.unhighlight_sq();
				}
			}
		}
		else if(pick[0]=="board" && this.selected){
			const destinationstack = this.get_stack(pick[1]);
			if(destinationstack.length==0){
				this.highlight_sq(pick[1]);
			}
			else{
				this.unhighlight_sq();
			}
		}
		else if(pick[0]=="board" && checkIfMyMove() && !gameData.is_game_end){
			// Highlight empty squares or player-controlled squares when it's the player's turn
			const stk = this.get_stack(pick[1]);
			if(stk.length === 0 || this.is_top_mine(pick[1])){
				this.highlight_sq(pick[1]);
			}
			else{
				this.unhighlight_sq();
			}
		}
		else{
			this.unhighlight_sq();
		}
	},
	getfromstack: function(cap,iswhite){
		//	scan through the pieces for the first appropriate one
		for(let i = this.piece_objects.length-1;i >= 0;i--){
			const obj = this.piece_objects[i];
			// not on a square, and matches color, and matches type
			if(!obj.onsquare &&
					(obj.iswhitepiece === iswhite) &&
					(cap === obj.iscapstone)){
				return obj;
			}
		}
		return null;
	},
	placePieceOnSquare: function(piece, sq){
		// Double Black Stack (DBS): white's first move places a second black flat on top,
		// animated together with the first flat so the pair moves down as a unit.
		// select() sets selectedCompanion for the lift-then-place flow; the direct
		// click-to-place flow skips select(), so resolve the companion here too
		// (otherwise the second flat teleports instead of animating). Falls back to
		// null for non-DBS moves, so the single-piece path is unchanged.
		const companion = this.selectedCompanion || this.getDoubleBlackStackCompanion();
		const movers = companion ? [piece, companion] : [piece];
		animation.push(movers);
		this.pushPieceOntoSquare(sq, piece);
		if(companion){
			this.pushPieceOntoSquare(sq, companion);
			this.blackpiecesleft--;
			this.selectedCompanion = null;
		}
		animation.push(movers, 'jump', 300);
		animation.play(playMoveSound);

		let stone = 'Piece';
		if(piece.iscapstone){stone = 'Cap';}
		else if(piece.isstanding){stone = 'Wall';}
		this.highlightLastMove_sq(sq, gameData.move_count);
		this.lastMovedSquareList.push({file: sq.file, rank: sq.rank});

		const sqname = this.squarename(sq.file, sq.rank);
		let msg = "P " + sqname;
		if(stone !== 'Piece'){msg += " " + stone.charAt(0);}
		sendMove(msg);
		this.notatePmove(sqname, stone === 'Piece' ? '' : stone.charAt(0));

		if(piece.iswhitepiece){
			this.whitepiecesleft--;
		}
		else{
			this.blackpiecesleft--;
		}
		if(gameData.is_scratch){
			let over = this.checkroadwin();
			if(!over){
				over = this.checksquaresover();
				const pcs = piece.iswhitepiece ? this.whitepiecesleft : this.blackpiecesleft;
				if(!over && pcs <= 0){
					this.findwhowon();
					gameOver();
				}
			}
		}
		// If no lifted companion was animated above (e.g. a fallback path), add the
		// extra black flat now. The own-move flow normally handles it inline above.
		if(!companion){
			this.addDoubleBlackStackFlatIfApplicable(sq);
		}
		this.incmovecnt();
	},
	// Get the swapped first-turn piece (opponent's color positioned on player's side)
	getSwappedFirstPiece: function(forWhitePlayer){
		// The swapped piece has pieceNum = tottiles - 1
		// For white player: want the BLACK piece (which is positioned on white's side)
		// For black player: want the WHITE piece (which is positioned on black's side)
		const wantWhitePiece = !forWhitePlayer;
		const targetPieceNum = this.tottiles - 1;
		for(let i = 0; i < this.piece_objects.length; i++){
			const obj = this.piece_objects[i];
			if(!obj.onsquare && !obj.iscapstone &&
					obj.pieceNum === targetPieceNum &&
					obj.iswhitepiece === wantWhitePiece){
				return obj;
			}
		}
		return null;
	},
	// Double Black Stack opening: on white's first move, place a second black flat
	// on top of the swapped black flat, drawn from black's reserves (rendered "2a1").
	// Must run after the first flat is on the square and before the position snapshot
	// (incmovecnt) so board_history captures both flats.
	addDoubleBlackStackFlatIfApplicable: function(sq){
		if(gameData.opening !== 'double black stack' || gameData.move_count !== 0){
			return;
		}
		const obj = this.getfromstack(false, false); // a black flat
		if(!obj){
			return;
		}
		obj.isFirstTurnPiece = true;
		this.pushPieceOntoSquare(sq, obj);
		this.blackpiecesleft--;
	},
	// The second staged black flat (pieceNum tottiles-2) for the Double Black Stack
	// opening — the companion that lifts/lowers/places together with the first flat.
	getDoubleBlackStackCompanion: function(){
		if(gameData.opening !== 'double black stack' || gameData.move_count !== 0){
			return null;
		}
		const targetPieceNum = this.tottiles - 2;
		for(let i = 0; i < this.piece_objects.length; i++){
			const obj = this.piece_objects[i];
			if(!obj.onsquare && !obj.iscapstone && !obj.iswhitepiece && obj.pieceNum === targetPieceNum){
				return obj;
			}
		}
		return null;
	},
	//move the server sends
	serverPmove: function(file,rank,caporwall,skipAnimation){
		let oldpos = -1;
		if(gameData.move_shown!=gameData.move_count){
			oldpos = gameData.move_shown;
		}

		dontanimate = true;
		fastforward();
		const obj = this.getfromstack((caporwall === 'C'),isWhitePieceToMove());

		if(!obj){
			console.warn("something is wrong");
			return;
		}

		// Mark as first-turn piece if this is one of the first two moves
		if(gameData.move_count < 2){
			obj.isFirstTurnPiece = true;
		}

		// Double Black Stack: on the opponent's screen, white's first move places a
		// second black flat that must animate together with the first (same frame).
		const companion = this.getDoubleBlackStackCompanion();
		if(companion){ companion.isFirstTurnPiece = true; }

		const hlt = this.get_board_obj(file.charCodeAt(0) - 'A'.charCodeAt(0),rank - 1);
		if(skipAnimation || oldpos !== -1){
			// Just place the piece without animation (loading history or viewing earlier position)
			if(caporwall === 'W'){
				this.standup(obj);
			}
			this.pushPieceOntoSquare(hlt,obj);
			if(companion){
				this.pushPieceOntoSquare(hlt, companion);
				this.blackpiecesleft--;
			}
			// Still play sound if viewing earlier position (not loading history)
			if(oldpos !== -1 && !skipAnimation){
				playMoveSound();
			}
		}
		else{
			const movers = companion ? [obj, companion] : [obj];
			// Record start position before any changes
			animation.push(movers);
			// Apply standup rotation if wall
			if(caporwall === 'W'){
				this.standup(obj);
			}
			this.pushPieceOntoSquare(hlt,obj);
			if(companion){
				this.pushPieceOntoSquare(hlt, companion);
				this.blackpiecesleft--;
			}
			animation.push(movers, 'jump', 300);
			animation.play(playMoveSound);
		}
		this.highlightLastMove_sq(hlt, gameData.move_count);
		this.lastMovedSquareList.push({file: hlt.file, rank: hlt.rank});

		// Only fall back to the teleport helper when no companion was animated above.
		if(!companion){
			this.addDoubleBlackStackFlatIfApplicable(hlt);
		}
		this.notatePmove(file + rank,caporwall);
		this.incmovecnt();

		if(oldpos !== -1){board.showmove(oldpos, true);}
		dontanimate = false;
	},
	//Move move the server sends
	serverMmove: function(f1,r1,f2,r2,nums,skipAnimation){
		let oldpos = -1;
		if(gameData.move_shown != gameData.move_count){
			oldpos = gameData.move_shown;
		}

		dontanimate = true;
		fastforward();
		let tot = 0;
		for(let i = 0;i < nums.length;i++){tot += nums[i];}

		const tstk = [];
		const s1 = this.get_board_obj(f1.charCodeAt(0) - 'A'.charCodeAt(0),r1 - 1);
		const stk = this.get_stack(s1);
		for(let i = 0;i < tot;i++){
			tstk.push(stk.pop());
		}
		let fi = 0,ri = 0;
		if(f1 === f2){ri = r2 > r1 ? 1 : -1;}
		if(r1 === r2){fi = f2 > f1 ? 1 : -1;}

		// Collect all pieces and their target squares first
		const allPieces = [];
		const pieceTargets = [];
		let finalSq = null;
		for(let i = 0;i < nums.length;i++){
			const sq = this.get_board_obj(s1.file + (i + 1) * fi,s1.rank + (i + 1) * ri);
			for(let j = 0;j < nums[i];j++){
				const piece = tstk.pop();
				allPieces.push(piece);
				pieceTargets.push(sq);
			}
			finalSq = sq;
		}
		// Highlight and record only the final destination square (once per move)
		this.highlightLastMove_sq(finalSq, gameData.move_count);
		this.lastMovedSquareList.push({file: finalSq.file, rank: finalSq.rank});

		if(skipAnimation || oldpos !== -1){
			// Just place pieces without animation (loading history or viewing earlier position)
			for(let i = 0; i < allPieces.length; i++){
				this.pushPieceOntoSquare(pieceTargets[i], allPieces[i]);
			}
			// Still play sound if viewing earlier position (not loading history)
			if(oldpos !== -1 && !skipAnimation){
				playMoveSound();
			}
		}
		else{
			// Check if any walls will be flattened (capstone landing on standing wall)
			const wallsToFlatten = [];
			for(let i = 0; i < allPieces.length; i++){
				if(allPieces[i].iscapstone){
					const targetStack = this.get_stack(pieceTargets[i]);
					const topPiece = targetStack.length > 0 ? targetStack[targetStack.length - 1] : null;
					if(topPiece && topPiece.isstanding && !topPiece.iscapstone){
						wallsToFlatten.push(topPiece);
					}
				}
			}
			// Record start positions for all pieces including walls to flatten
			const objectsToAnimate = allPieces.concat(wallsToFlatten);
			animation.push(objectsToAnimate);
			// Set end positions for all pieces
			for(let i = 0; i < allPieces.length; i++){
				this.pushPieceOntoSquare(pieceTargets[i], allPieces[i]);
			}
			animation.push(objectsToAnimate, 'jump', 300);
			animation.play(playMoveSound);
		}
		this.calculateMoveNotation(
			f1.charCodeAt(0) - 'A'.charCodeAt(0),
			Number(r1) - 1,
			f2.charCodeAt(0) - 'A'.charCodeAt(0),
			Number(r2) - 1,
			nums
		);
		this.incmovecnt();

		if(oldpos !== -1){board.showmove(oldpos, true);}
		dontanimate = false;
	},
	flatscore: function(ply){
		let whitec = 0;
		let blackc = 0;
		if(!(ply>=0)){
			ply=this.board_history.length-1;
		}
		const position=this.board_history[ply];
		if(!position){
			return [0,0];
		}
		for(let i = 0;i < gameData.size*gameData.size;i++){
			if(position[i].length>0){
				const toppiece=position[i][position[i].length-1];
				whitec+=toppiece=="P";
				blackc+=toppiece=="p";
			}
		}
		return [whitec,blackc];
	},
	findwhowon: function(){
		let whitec = 0;
		let blackc = gameData.komi/2;
		for(let i = 0;i < gameData.size;i++){
			for(let j = 0;j < gameData.size;j++){
				const stk = this.sq[i][j];
				if(stk.length === 0){continue;}
				const top = stk[stk.length - 1];
				if(top.isstanding || top.iscapstone){continue;}
				if(top.iswhitepiece){whitec++;}
				else{blackc++;}
			}
		}
		if(whitec === blackc){gameData.result = "1/2-1/2";}
		else if(whitec > blackc){gameData.result = "F-0";}
		else{gameData.result = "0-F";}
	},
	checkroadwin: function(){
		for(let i = 0;i < gameData.size;i++){
			for(let j = 0;j < gameData.size;j++){
				const cur_st = this.sq[i][j];
				cur_st.graph = -1;
				if(cur_st.length === 0){continue;}

				const ctop = cur_st[cur_st.length - 1];
				if(ctop.isstanding && !ctop.iscapstone){continue;}

				cur_st.graph = (i + j * gameData.size).toString();

				if(i - 1 >= 0){
					const left_st = this.sq[i - 1][j];
					if(left_st.length !== 0){
						const ltop = left_st[left_st.length - 1];
						if(!(ltop.isstanding && !ltop.iscapstone)){
							if(ctop.iswhitepiece === ltop.iswhitepiece){
								for(let r = 0;r < gameData.size;r++){
									for(let c = 0;c < gameData.size;c++){
										if(this.sq[r][c].graph === cur_st.graph){
											this.sq[r][c].graph = left_st.graph;
										}
									}
								}
							}
						}
					}
				}
				if(j - 1 >= 0){
					const top_st = this.sq[i][j - 1];
					if(top_st.length !== 0){
						const ttop = top_st[top_st.length - 1];
						if(!(ttop.isstanding && !ttop.iscapstone)){
							if(ctop.iswhitepiece === ttop.iswhitepiece){
								for(let r = 0;r < gameData.size;r++){
									for(let c = 0;c < gameData.size;c++){
										if(this.sq[r][c].graph === cur_st.graph){
											this.sq[r][c].graph = top_st.graph;
										}
									}
								}
							}
						}
					}
				}
			}
		}
		let whitewin = false;
		let blackwin = false;
		for(let tr = 0;tr < gameData.size;tr++){
			const tsq = this.sq[tr][0];
			const no = tsq.graph;
			if(no === -1){continue;}
			for(let br = 0;br < gameData.size;br++){
				const brno = this.sq[br][gameData.size - 1].graph;
				if(no === brno){
					if(tsq[tsq.length - 1].iswhitepiece){whitewin = true;}
					else{blackwin = true;}
				}
			}
		}
		for(let tr = 0;tr < gameData.size;tr++){
			const tsq = this.sq[0][tr];
			const no = tsq.graph;
			if(no === -1){continue;}
			for(let br = 0;br < gameData.size;br++){
				const brno = this.sq[gameData.size - 1][br].graph;
				if(no === brno){
					if(tsq[tsq.length - 1].iswhitepiece){whitewin = true;}
					else{blackwin = true;}
				}
			}
		}
		if(whitewin && blackwin){gameData.result = (gameData.move_count%2 == 0)?"R-0":"0-R";}
		else if(whitewin){gameData.result = "R-0";}
		else if(blackwin){gameData.result = "0-R";}

		if(whitewin || blackwin){
			gameOver();
			return true;
		}
		return false;
	},
	checksquaresover: function(){
		for(let i = 0;i < gameData.size;i++){
			for(let j = 0;j < gameData.size;j++){
				if(this.sq[i][j].length === 0){return false;}
			}
		}

		this.findwhowon();
		gameOver("All spaces covered.");
		return true;
	},
	reverseboard: function(){
		if(localStorage.getItem('auto_rotate')!=='false'){
			this.boardside = (this.boardside === "white") ? "black" : "white";
			camera.position.z = -camera.position.z;
			camera.position.x = -camera.position.x;
			controls.target.z=-controls.target.z;
			controls.target.x=-controls.target.x;
		}
	},
	setmovedir: function(){
		const s1 = this.move.start;
		const s2 = this.move.squares[this.move.squares.length - 1];
		if(s1.file === s2.file && s1.rank === s2.rank){return;}

		if(s1.file === s2.file){
			if(s2.rank > s1.rank){this.move.dir = 'N';}
			else{this.move.dir = 'S';}
		}
		else{
			if(s2.file > s1.file){this.move.dir = 'E';}
			else{this.move.dir = 'W';}
		}
	},
	notatePmove: function(sqname,pos){
		if(pos === 'W'){pos = 'S';}
		else if(pos === 'C'){pos = 'C';}
		else{pos = '';}
		// Double Black Stack: white's first ply is written "2a1"
		const dbsPrefix = (gameData.opening === 'double black stack' && gameData.move_count === 0) ? '2' : '';
		notate(dbsPrefix + pos + sqname.toLowerCase());
		storeNotation();
	},
	//all params are nums
	calculateMoveNotation: function(stf,str,endf,endr,nos){
		let dir = '';
		if(stf === endf){dir = (endr < str) ? '-' : '+';}
		else{dir = (endf < stf) ? '<' : '>';}
		let tot = 0;
		let lst = '';
		for(let i = 0;i < nos.length;i++){
			tot += Number(nos[i]);
			lst = lst + (nos[i] + '').trim();
		}
		if(tot === 1){
			const s1 = this.get_board_obj(stf,str);
			if(this.get_stack(s1).length === 0){
				tot = '';
				lst = '';
			}
			else if(tot === Number(lst)){lst = '';}
		}
		else if(tot === Number(lst)){lst = '';}
		const move = tot + this.squarename(stf,str).toLowerCase()
				+ dir + '' + lst;
		notate(move);
		storeNotation();
	},
	generateMove: function(){
		const st = this.squarename(this.move.start.file,this.move.start.rank);
		const end = this.squarename(this.move.end.file,this.move.end.rank);
		const lst = [];
		let prev = null;

		for(let i = 0,c = 0;i < this.move.squares.length;i++){
			const obj = this.move.squares[i];
			if(obj === this.move.start){continue;}

			if(obj === prev){lst[c - 1] = lst[c - 1] + 1;}
			else{
				prev = obj;
				lst[c] = 1;
				c++;
			}
		}
		if(st !== end){
			let nos = "";
			for(let i = 0;i < lst.length;i++){nos += lst[i] + " ";}
			sendMove("M " + st + " " + end + " " + nos.trim());
			this.calculateMoveNotation(
				this.move.start.file,
				this.move.start.rank,
				this.move.end.file,
				this.move.end.rank,
				nos
			);
			if(gameData.is_scratch){
				this.checkroadwin();
				this.checksquaresover();
			}
			this.incmovecnt();
			this.highlightLastMove_sq(this.move.end, gameData.move_count - 1);
			this.lastMovedSquareList.push({file: this.move.end.file, rank: this.move.end.rank});
		}
		this.move = { start: null, end: null, dir: 'U', squares: []};
	},
	pushPieceOntoSquare: function(sq,pc){
		const st = this.get_stack(sq);
		const top = this.top_of_stack(sq);
		let flattened = null;
		if(top && top.isstanding && !top.iscapstone && pc.iscapstone){
			flattened = top;
			this.rotate(top, false);
		}

		pc.position.x = sq.position.x;

		if(pc.isstanding){
			if(pc.iscapstone){pc.position.y = sq_height/2 + capstone_height/2 + piece_height*st.length;}
			else{pc.position.y = sq_height/2 + piece_size/2 + piece_height * st.length;}
		}
		else{pc.position.y = sq_height + st.length * piece_height;}
		pc.position.z = sq.position.z;

		pc.onsquare = sq;
		st.push(pc);
		return flattened;
	},
	rotate: function(piece, animate){
		if(piece.iscapstone){return;}
		if(piece.isstanding){this.flatten(piece, animate);}
		else{this.standup(piece, animate);}
	},
	flatten: function(piece, animate){
		if(!piece.isstanding){return;}
		if(animate && animation.playing){
			// Stop current animation and jump to final state before starting new one
			animation.stop();
		}
		if(animate){animation.push([piece]);}
		piece.position.y -= piece_size / 2 - piece_height / 2;
		if(diagonal_walls){piece.rotateZ(Math.PI / 4);}
		piece.rotateX(Math.PI / 2);
		// Reverse black wall 90-degree rotation (after X rotation)
		if(!piece.iswhitepiece){piece.rotateY(-Math.PI / 2);}
		piece.isstanding = false;
		applyCustomModel(piece);
		if(animate){
			animation.push([piece], 'move', 150);
			animation.play();
		}
	},
	standup: function(piece, animate){
		if(piece.isstanding){return;}
		if(animate && animation.playing){
			// Stop current animation and jump to final state before starting new one
			animation.stop();
		}
		if(animate){animation.push([piece]);}
		piece.position.y += piece_size / 2 - piece_height / 2;
		// Rotate black walls 90 degrees (before X rotation)
		if(!piece.iswhitepiece){piece.rotateY(Math.PI / 2);}
		piece.rotateX(-Math.PI / 2);
		if(diagonal_walls){piece.rotateZ(-Math.PI / 4);}
		piece.isstanding = true;
		applyCustomModel(piece);
		if(animate){
			animation.push([piece], 'move', 150);
			animation.play();
		}
	},
	rightclick: function(){
		settingscounter=(settingscounter+1)&15;
		if(this.selected && gameData.move_count>=2){
			this.rotate(this.selected, true);
		}
		else if(this.selectedStack){
			this.cancelMove();
		}
		else{
			const pick=this.mousepick();
			if(pick[0]=="piece"){
				// Right-click on unplayed piece - select it as standing
				// Only works on your turn, after move 2, and not at game end
				if(!gameData.is_game_end && gameData.move_count >= 2 && checkIfMyMove()){
					// After move 2, select your own color pieces
					if(pick[1].iswhitepiece === isWhitePieceToMove() && !pick[1].iscapstone){
						const pieceToSelect = this.getfromstack(false, pick[1].iswhitepiece);
						if(pieceToSelect){
							// Select and standup as a single animation
							animation.push([pieceToSelect]);
							// Raise by selection height + standing height difference
							pieceToSelect.position.y += stack_selection_height + (piece_size / 2 - piece_height / 2);
							// Rotate black walls 90 degrees (before X rotation)
							if(!pieceToSelect.iswhitepiece){pieceToSelect.rotateY(Math.PI / 2);}
							pieceToSelect.rotateX(-Math.PI / 2);
							if(diagonal_walls){pieceToSelect.rotateZ(-Math.PI / 4);}
							pieceToSelect.isstanding = true;
							applyCustomModel(pieceToSelect);
							this.selected = pieceToSelect;
							animation.push([pieceToSelect], 'move', 150);
							animation.play();
						}
					}
				}
			}
			else if(pick[0]=="board"){
				const square=pick[1];
				const stack=this.get_stack(square);
				let i;
				for(i=0;i<scene.children.length;i++){
					const obj=scene.children[i];
					if(!obj.isboard && obj.onsquare){
						obj.visible=false;
					}
				}
				for(i=0;i<stack.length;i++){
					stack[i].visible=true;
				}
				this.totalhighlighted=square;
			}
		}
	},
	remove_total_highlight: function(){
		if(this.totalhighlighted !== null){
			for(let i = 0;i < scene.children.length;i++){
				const obj = scene.children[i];
				if(obj.isboard || !obj.onsquare){continue;}
				obj.visible = true;
			}
			this.totalhighlighted = null;
		}
	},
	rightup: function(){
		settingscounter=(settingscounter+1)&15;
		this.remove_total_highlight();
	},
	//bring pieces to original positions,
	resetpieces: function(){
		for(let i = this.piece_objects.length - 1;i >= 0;i--){
			const piece = this.piece_objects[i];
			// the contact shadow is not a child of the piece; left in the scene, a new one would pile up on each history step
			if(piece.contactShadow){
				scene.remove(piece.contactShadow);
				piece.contactShadow.geometry.dispose();
			}
			scene.remove(piece);
		}

		this.whitepiecesleft = this.tottiles + this.totcaps;
		this.blackpiecesleft = this.tottiles + this.totcaps;

		this.piece_objects = [];
		this.highlighted = null;
		this.selected = null;
		this.selectedStack = null;
		this.move = { start: null, end: null, dir: 'U', squares: []};

		for(let i = 0;i < gameData.size;i++){
			for(let j = 0;j < gameData.size;j++){
				this.sq[i][j].length = 0;
			}
		}
		this.addpieces();
	},
	resetBoardStacks: function(){
		for(let i = 0;i < gameData.size;i++){
			this.sq[i] = [];
			for(let j = 0;j < gameData.size;j++){
				this.sq[i][j] = [];
			}
		}

		// the scene was cleared: add back the table and fill lights as initEmpty does, or piece sides render black
		this.addtable();
		this.addlight();
		this.addboard();
		this.addpieces();
		this.updateShadowCamera();
		updateShadowsVisibility();
	},
	showmove: function(no,override){
		if(gameData.move_count <= gameData.move_start || no>gameData.move_count || no<gameData.move_start || (gameData.move_shown === no && !override)){
			return;
		}
		const prevdontanim = dontanimate;
		dontanimate = true;
		setShownMove(no);
		this.unhighlight_sq();
		this.resetpieces();
		this.apply_board_pos(no);
		// Update last move highlighter to show the move at this position
		this.unHighlightLastMove_sq();
		if(no > gameData.move_start && this.lastMovedSquareList.length >= no - gameData.move_start){
			// Pass the move number (no - 1) since we're showing the move that led to position 'no'
			const coords = this.lastMovedSquareList[no - gameData.move_start - 1];
			this.highlightLastMove_sq(this.get_board_obj(coords.file, coords.rank), no - 1);
		}
		dontanimate = prevdontanim;
	},
	undo: function(){
		this.unHighlightLastMove_sq();
		// This resetpieces() is to make sure there aren't any pieces
		// in mid-move, in case the user clicked a piece to place it, but
		// then clicked undo.
		this.resetpieces();
		this.apply_board_pos(gameData.move_count);
		this.board_history.pop();
		this.lastMovedSquareList.pop();
		// Highlight the previous move if there is one
		if(this.lastMovedSquareList.length > 0){
			const coords = this.lastMovedSquareList.at(-1);
			this.highlightLastMove_sq(this.get_board_obj(coords.file, coords.rank), gameData.move_count - 1);
		}
	},
	sqrel: function(sq1,sq2){
		const f1 = sq1.file;
		const r1 = sq1.rank;
		const f2 = sq2.file;
		const r2 = sq2.rank;
		if(f1 === f2 && r1 === r2){return 'O';}

		if(f1 === f2){
			if(r2 === r1 + 1){return 'N';}
			else if(r1 === r2 + 1){return 'S';}
		}
		else if(r1 === r2){
			if(f2 === f1 + 1){return 'E';}
			else if(f1 === f2 + 1){return 'W';}
		}
		return 'OUTSIDE';
	},
	select: function(obj){
		// Double Black Stack: lift the companion black flat together with the first flat.
		const companion = this.getDoubleBlackStackCompanion();
		const dbsCompanion = (companion && companion !== obj) ? companion : null;
		const movers = dbsCompanion ? [obj, dbsCompanion] : [obj];
		animation.push(movers);
		// Reposition unplayed pieces to correct location before lifting
		// (piece_size may have changed since piece was created)
		if(!obj.onsquare){
			if(obj.iscapstone){
				const posAsWhite = obj.positionAsWhite !== undefined ? obj.positionAsWhite : obj.iswhitepiece;
				if(posAsWhite){
					obj.position.set(
						board.corner_position.endx + capstone_radius + stackOffsetFromBorder,
						capstone_height/2-sq_height/2 + stack_selection_height,
						board.corner_position.z + capstone_radius + obj.pieceNum*(stack_dist+capstone_radius*2)
					);
				}
				else{
					const invertBlackZ = shouldInvertBlackPiecesZ();
					const zPos = invertBlackZ
						? board.corner_position.z + capstone_radius + obj.pieceNum*(stack_dist+capstone_radius*2)
						: board.corner_position.endz - capstone_radius - obj.pieceNum*(stack_dist+capstone_radius*2);
					obj.position.set(
						board.corner_position.x - capstone_radius - stackOffsetFromBorder,
						capstone_height/2-sq_height/2 + stack_selection_height,
						zPos
					);
				}
			}
			else{
				const stackno = Math.floor(obj.pieceNum / 10);
				let stackheight = obj.pieceNum % 10;
				// Double Black Stack: white's first-to-play flat rests one lower (black donated a flat).
				if(gameData.opening === 'double black stack' && obj.iswhitepiece && obj.pieceNum === board.tottiles - 1 && ((board.tottiles - 1) % 10) > 0){
					stackheight -= 1;
				}
				const baseY = obj.isstanding ? (piece_size/2-sq_height/2) : (stackheight*piece_height+piece_height/2-sq_height/2);
				const posAsWhite = obj.positionAsWhite !== undefined ? obj.positionAsWhite : obj.iswhitepiece;
				if(posAsWhite){
					obj.position.set(
						board.corner_position.endx + stackOffsetFromBorder + piece_size/2,
						baseY + stack_selection_height,
						board.corner_position.endz - piece_size/2 - stackno*(stack_dist+piece_size)
					);
				}
				else{
					const invertBlackZ = shouldInvertBlackPiecesZ();
					const zPos = invertBlackZ
						? board.corner_position.endz - piece_size/2 - stackno*(stack_dist+piece_size)
						: board.corner_position.z + piece_size/2 + stackno*(stack_dist+piece_size);
					obj.position.set(
						board.corner_position.x - stackOffsetFromBorder - piece_size/2,
						baseY + stack_selection_height,
						zPos
					);
				}
			}
		}
		else{
			obj.position.y += stack_selection_height;
		}
		this.selected = obj;
		// Lift the Double Black Stack companion by the same amount so it stays stacked on top.
		if(dbsCompanion){
			dbsCompanion.position.y += stack_selection_height;
			this.selectedCompanion = dbsCompanion;
		}
		animation.push(movers, 'move', 100);
		animation.play();
	},
	unselect: function(options){
		const animate = !options || options.animate !== false;
		if(this.selected){
			const piece = this.selected;
			// Double Black Stack: lower the companion black flat together with the first.
			const companion = this.selectedCompanion;
			const movers = companion ? [piece, companion] : [piece];
			animate && animation.push(movers);
			// If piece is standing (wall), flatten it back and adjust height accordingly
			if(piece.isstanding && !piece.iscapstone){
				piece.position.y -= stack_selection_height + (piece_size / 2 - piece_height / 2);
				if(diagonal_walls){piece.rotateZ(Math.PI / 4);}
				piece.rotateX(Math.PI / 2);
				// Reverse black wall 90-degree rotation (after X rotation)
				if(!piece.iswhitepiece){piece.rotateY(-Math.PI / 2);}
				piece.isstanding = false;
				applyCustomModel(piece);
			}
			else{
				piece.position.y -= stack_selection_height;
			}
			if(companion){
				companion.position.y -= stack_selection_height;
			}
			animate && animation.push(movers, 'move', 75);
			this.selected = null;
			this.selectedCompanion = null;
			animate && animation.play();
		}
	},
	selectStack: function(stk){
		this.selectedStack = [];
		const objectsToAnimate = [];
		// Pop pieces from the stack
		for(let i = 0;stk.length > 0 && i < gameData.size;i++){
			const obj = stk.pop();
			objectsToAnimate.push(obj);
			this.selectedStack.push(obj);
		}
		if(objectsToAnimate.length > 0){
			animation.push(objectsToAnimate);
			for(let i = 0;i < objectsToAnimate.length;i++){
				objectsToAnimate[i].position.y += stack_selection_height;
			}
			animation.push(objectsToAnimate, 'move', 100);
			animation.play();
		}
	},
	unselectStackElem: function(obj, options){
		const animate = !options || options.animate !== false;
		if(animate){animation.push([obj]);}
		obj.position.y -= stack_selection_height;
		if(animate){animation.push([obj], 'move', 75);}
	},
	unselectStack: function(){
		const stk = this.selectedStack.reverse();
		const lastsq = this.move.squares[this.move.squares.length - 1];
		//push unselected stack elems onto last moved square
		for(let i = 0;i < stk.length;i++){
			this.unselectStackElem(stk[i], {animate: false});
			this.pushPieceOntoSquare(lastsq,stk[i]);
			this.move.squares.push(lastsq);
		}
		this.selectedStack = null;
	},
	cancelMove: function(){
		// Animate unplayed piece back down (and reset to flat if standing)
		if(this.selected && !this.selected.onsquare){
			const piece = this.selected;
			const needsFlatten = piece.isstanding && !piece.iscapstone;
			// Double Black Stack: lower the companion black flat together with the first.
			const companion = this.selectedCompanion;
			const movers = companion ? [piece, companion] : [piece];
			// Record current position for animation start
			animation.push(movers);
			// Calculate absolute final position (not relative to current)
			let stackheight = piece.pieceNum % 10;
			// Double Black Stack: white's first-to-play flat rests one lower (black donated a flat).
			if(gameData.opening === 'double black stack' && piece.iswhitepiece && piece.pieceNum === board.tottiles - 1 && ((board.tottiles - 1) % 10) > 0){
				stackheight -= 1;
			}
			let finalY;
			if(piece.iscapstone){
				finalY = capstone_height/2 - sq_height/2;
			}
			else{
				// Flat position (standing pieces get flattened)
				finalY = stackheight * piece_height + piece_height/2 - sq_height/2;
			}
			piece.position.y = finalY;
			// Reset rotation to flat
			if(needsFlatten){
				piece.rotation.set(0, 0, 0);
				piece.isstanding = false;
				applyCustomModel(piece);
			}
			// Lower the companion back to its staged position (one level above the
			// first flat's rest slot) by reversing the selection lift.
			if(companion){
				companion.position.y -= stack_selection_height;
			}
			animation.push(movers, 'move', 100);
			animation.play();
			this.selected = null;
			this.selectedCompanion = null;
			return;
		}
		// Animate selected stack back to starting position
		if(this.move.start){
			const startSq = this.move.start;
			const lastSq = this.move.squares[this.move.squares.length - 1];
			const isSameSquare = startSq === lastSq;
			let allPieces = [];

			// Collect pieces from dropped squares
			// For each unique square, we need to pop pieces and reverse them
			// (because popping gives reverse order of how they were dropped on that square)
			// But across different squares, we keep the forward order
			let prevSq = null;
			let currentSquarePieces = [];
			for(let i = 1; i < this.move.squares.length; i++){
				const sq = this.move.squares[i];
				if(sq !== startSq){
					// If we've moved to a new square, flush the previous square's pieces
					if(prevSq !== null && sq !== prevSq){
						currentSquarePieces.reverse();
						allPieces = allPieces.concat(currentSquarePieces);
						currentSquarePieces = [];
					}
					const stack = this.get_stack(sq);
					if(stack.length > 0){
						const piece = stack.pop();
						piece.onsquare = null;
						currentSquarePieces.push(piece);
					}
					prevSq = sq;
				}
			}
			// Flush the last square's pieces
			if(currentSquarePieces.length > 0){
				currentSquarePieces.reverse();
				allPieces = allPieces.concat(currentSquarePieces);
			}

			// Collect pieces still in selectedStack (top to bottom order in selectedStack)
			// We want bottom pieces first, so reverse
			if(this.selectedStack && this.selectedStack.length > 0){
				const remaining = this.selectedStack.slice().reverse();
				allPieces = allPieces.concat(remaining);
			}

			if(allPieces.length > 0){
				// Record start positions for animation (at current positions)
				animation.push(allPieces);
				// Lower selected pieces and set final positions
				for(let j = 0; j < allPieces.length; j++){
					if(this.selectedStack && this.selectedStack.indexOf(allPieces[j]) !== -1){
						allPieces[j].position.y -= stack_selection_height;
					}
				}
				// Use pushPieceOntoSquare to set correct final positions
				for(let k = 0; k < allPieces.length; k++){
					this.pushPieceOntoSquare(startSq, allPieces[k]);
				}
				const animType = isSameSquare ? 'move' : 'jump';
				animation.push(allPieces, animType, isSameSquare ? 100 : 200);
				animation.play();
				this.selectedStack = null;
				this.move = { start: null, end: null, dir: 'U', squares: []};
				this.unhighlight_sq();
				return;
			}
		}
		// Fallback to showmove for other cases
		this.showmove(gameData.move_shown, true);
	},
	highlightLastMove_sq: function(sq, moveNum){
		if(!sq){return;}
		if(!this.lastMoveHighlighterVisible){return;}
		this.unHighlightLastMove_sq(this.lastMoveHighlighted);
		this.lastMoveHighlighted = sq;

		// Set color based on who made the move
		// If moveNum is provided, use it; otherwise use move_shown
		const moveNumber = (moveNum !== undefined) ? moveNum : gameData.move_shown;
		// Even move numbers (0, 2, 4...) are white's moves
		const lastMoveWasWhite = (moveNumber % 2 === 0);
		lastMoveHighlighter.material.color.setHex(lastMoveWasWhite ? 0xffffff : 0x000000);

		lastMoveHighlighter.position.x = sq.position.x;
		lastMoveHighlighter.position.y = sq_height / 2;
		lastMoveHighlighter.position.z = sq.position.z;
		scene.add(lastMoveHighlighter);
	},
	unHighlightLastMove_sq: function(){
		this.lastMoveHighlighted = null;
		scene.remove(lastMoveHighlighter);
	},
	highlight_sq: function(sq){
		this.unhighlight_sq(this.highlighted);
		this.highlighted = sq;

		// Temporarily hide last move highlighter if hovering over the same square
		if(this.lastMoveHighlighted === sq){
			scene.remove(lastMoveHighlighter);
		}

		// Set color based on whose turn it is (even move_count = white's turn)
		const isWhiteTurn = (gameData.move_count % 2 === 0);
		highlighter.material.color.setHex(isWhiteTurn ? 0xffffff : 0x000000);

		highlighter.position.x = sq.position.x;
		highlighter.position.y = sq_height / 2;
		highlighter.position.z = sq.position.z;
		scene.add(highlighter);
	},
	unhighlight_sq: function(){
		if(this.highlighted){
			// Restore last move highlighter if it was hidden
			if(this.lastMoveHighlighted === this.highlighted && this.lastMoveHighlighterVisible){
				scene.add(lastMoveHighlighter);
			}
			this.highlighted = null;
			scene.remove(highlighter);
		}
	},
	get_stack: function(sq){
		return this.sq[sq.file][sq.rank];
	},
	top_of_stack: function(sq){
		const st = this.get_stack(sq);
		if(st.length === 0){return null;}
		return st[st.length - 1];
	},
	is_top_mine: function(sq){
		const ts = this.top_of_stack(sq);
		if(!ts){return true;}
		if(ts.iswhitepiece && gameData.my_color === "white"){return true;}
		if(!ts.iswhitepiece && gameData.my_color !== "white"){return true;}
		return false;
	},
	move_stack_over: function(sq,stk,animate){
		if(stk.length === 0){
			if(animate){animation.play();}
			return;
		}
		const top = this.top_of_stack(sq);

		const ts = stk[stk.length - 1];
		if(ts.onsquare === sq){
			if(animate){animation.play();}
			return;
		}

		// Calculate the target Y position for the bottom piece of the selected stack
		// It should be stack_selection_height above the top of the destination stack
		// Note: top piece's position.y is already set to its FINAL position by pushPieceOntoSquare
		let topY;
		if(top){
			// Top of existing stack - use piece's final position plus half its height
			if(top.iscapstone){
				topY = top.position.y + capstone_height / 2;
			}
			else if(top.isstanding){
				topY = top.position.y + piece_size / 2;
			}
			else{
				topY = top.position.y + piece_height / 2;
			}
		}
		else{
			// Empty square - use board surface
			topY = sq_height / 2;
		}
		// Bottom of selected stack should be at topY + stack_selection_height + half piece height
		// But the bottom piece of stk is a flat, so use piece_height / 2
		let bottomPieceHalfHeight = piece_height / 2;
		if(ts.iscapstone){
			bottomPieceHalfHeight = capstone_height / 2;
		}
		else if(ts.isstanding){
			bottomPieceHalfHeight = piece_size / 2;
		}
		const bottomPieceTargetY = topY + stack_selection_height + bottomPieceHalfHeight;
		const currentBottomY = ts.position.y;
		const deltaY = bottomPieceTargetY - currentBottomY;

		if(animate){animation.push(stk);}
		for(let i = 0;i < stk.length;i++){
			stk[i].position.x = sq.position.x;
			stk[i].position.z = sq.position.z;
			stk[i].position.y += deltaY;
			stk[i].onsquare = sq;
		}
		if(animate){
			animation.push(stk, 'move', 100);
			animation.play();
		}
	},
	loadptn: function(parsed){
		const size = parseInt(parsed.tags.Size,10);
		if(!(size >= 3 && size <= 8)){
			alert('warning','invalid PTN: invalid size');
			return;
		}
		this.clear();
		this.create(size,+parsed.tags.Flats,+parsed.tags.Caps);
		this.initEmpty();

		for(let ply = 0;ply < parsed.moves.length;ply++){
			const move = parsed.moves[ply];
			let match, dbsMatch;
			// Double Black Stack: White's opening ply is stored as "2a1" (a 2-flat
			// black stack). That token matches neither notation pattern below, so
			// without this branch the ply is dropped and every later move loads with
			// the wrong colour/position (move_count never advances). Mirror live play
			// (addDoubleBlackStackFlatIfApplicable): place the swapped black flat,
			// then a second black flat on top.
			if(gameData.opening === 'double black stack' && gameData.move_count === 0 &&
				(dbsMatch = /^2([a-h])([1-8])$/.exec(move)) !== null){
				const file = dbsMatch[1].charCodeAt(0) - 'a'.charCodeAt(0);
				const rank = parseInt(dbsMatch[2]) - 1;
				if(!this.isOnBoard(file,rank)){
					console.warn("unparseable: " + move);
					continue;
				}
				const obj = this.getfromstack(false, false); // a black flat
				if(!obj){
					console.warn("bad PTN: too many pieces");
					return;
				}
				const hlt = this.get_board_obj(file,rank);
				this.pushPieceOntoSquare(hlt,obj);
				this.addDoubleBlackStackFlatIfApplicable(hlt);
				this.lastMovedSquareList.push({file: hlt.file, rank: hlt.rank});
			}
			else if((match = matchPTNPlacement(move)) !== null){
				const piece = match[1];
				const file = match[2].charCodeAt(0) - 'a'.charCodeAt(0);
				const rank = parseInt(match[3]) - 1;
				if(!this.isOnBoard(file,rank)){
					console.warn("unparseable: " + move);
					continue;
				}
				const obj = this.getfromstack((piece === 'C'),isWhitePieceToMove());
				if(!obj){
					console.warn("bad PTN: too many pieces");
					return;
				}
				if(piece === 'S'){
					this.standup(obj);
				}
				const hlt = this.get_board_obj(file,rank);
				this.pushPieceOntoSquare(hlt,obj);
				this.lastMovedSquareList.push({file: hlt.file, rank: hlt.rank});
			}
			else if((match = matchPTNMovement(move)) !== null){
				const count = match[1];
				const file = match[2].charCodeAt(0) - 'a'.charCodeAt(0);
				const rank = parseInt(match[3]) - 1;
				const dir = match[4];
				let drops = match[5];

				if(drops === ''){
					if(count == ''){drops = [1];}
					else{drops = [count];}
				}
				else{
					drops = drops.split('');
				}
				let tot = 0;
				for(let i = 0;i < drops.length;i++){tot += parseInt(drops[i]);}

				let df = 0,dr = 0;
				if(dir == '<'){
					df = -1;
				}
				else if(dir == '>'){
					df = 1;
				}
				else if(dir == '-'){
					dr = -1;
				}
				else if(dir == '+'){
					dr = 1;
				}

				// Validate the whole path up front. get_stack returns the live stack and
				// the drop loop mutates squares as it goes, so discovering an off-board
				// square partway through would leave a half-applied move on the board.
				// The drops run in a straight line, so the endpoints bound the rest.
				if(!this.isOnBoard(file,rank)
					|| !this.isOnBoard(file + drops.length * df, rank + drops.length * dr)){
					console.warn("unparseable: " + move);
					continue;
				}

				const s1 = this.get_board_obj(file,rank);
				const stk = this.get_stack(s1);
				const tstk = [];

				for(let i = 0;i < tot;i++){tstk.push(stk.pop());}

				let finalSq;
				for(let i = 0;i < drops.length;i++){
					const sq = this.get_board_obj(
						s1.file + (i + 1) * df,
						s1.rank + (i + 1) * dr
					);
					for(let j = 0;j < parseInt(drops[i]);j++){
						this.pushPieceOntoSquare(sq,tstk.pop());
					}
					finalSq = sq;
				}
				this.lastMovedSquareList.push({file: finalSq.file, rank: finalSq.rank});
			}
			else{
				console.warn("unparseable: " + move);
				continue;
			}
			notate(move);
			this.incmovecnt();
		}
		// Highlight the last move after loading
		if(this.lastMovedSquareList.length > 0){
			const coords = this.lastMovedSquareList.at(-1);
			this.highlightLastMove_sq(this.get_board_obj(coords.file, coords.rank), gameData.move_count - 1);
		}
		// Presence of the tag is not the test — getNotation writes [Result ""]
		// for a game still in progress, so an empty value has to leave the game
		// running rather than declare it over.
		if(parsed.tags.Result){
			gameData.result = parsed.tags.Result;
			gameOver();
		}
		else{
			gameData.result = '';
		}
	},
	// This function loads any valid TPS
	// It also will allow some liberties with the notation:
	//	 * if you don't complete a row it assumes the cells are empty
	//	 * the initial TPS tagname is optional
	//	 * the player & move elements are optional
	loadtps: function(tps){
		const parsed = parseTPS(tps);
		gameData.size = parsed.size;
		let moveNumber = parsed.linenum;
		this.clear();
		this.create(parsed.size, defaultPiecesAndCaps[parsed.size][0], defaultPiecesAndCaps[parsed.size][0][1]);
		this.renderBoardFromTPS(parsed.grid);

		playerToMove = parsed.player;
		if(!playerToMove){
			playerToMove = 1;
		}
		else if(playerToMove != WHITE_PLAYER && playerToMove != BLACK_PLAYER){
			alert('warning','Invalid TPS - player turn must be 1 or 2 - not ' + parsed.player);
			return;
		}
		if(!moveNumber){
			moveNumber = 1;
		}
		else if(moveNumber < 1){
			alert('warning','Invalid TPS - move number must be positive integer');
			return;
		}
		if(this.checkroadwin()){return;}
		if(this.checksquaresover()){return;}

		const assumedMoveCount = this.moveCountCalc(moveNumber,moveNumber,playerToMove);

		let infoMsg = "";
		let playMsg = "";

		// We want to make some sense of the moveCount...
		const p1Cnt = this.count_pieces_on_board(WHITE_PLAYER);
		const p2Cnt = this.count_pieces_on_board(BLACK_PLAYER);
		if(p1Cnt == 0 && p2Cnt == 0){
			// nothing played yet
			initCounters(0);
			gameData.my_color = "white";
			playMsg = "White should start the game by placing a black piece.";
		}
		else if(p1Cnt == 1 && p2Cnt == 0){
			// someone has placed a lone white piece
			alert('danger','Invalid TPS - player 1 must place a black piece first.');
			this.clear();
			this.initEmpty();
			return;
		}
		else if(p2Cnt == 1 && p1Cnt == 0){
			// white has placed a black piece
			initCounters(1);
			gameData.my_color = "black";
			if(playerToMove === WHITE_PLAYER){
				infoMsg = "TPS has wrong player turn.";
			}
			playMsg = "It is black's turn to place the first white piece";
		}
		else{
			// There is at least one of each piece on the board.
			// The move count must be at least as high as 2 times
			// the number of pieces that one player has on the board
			const minMoves = this.moveCountCalc(p1Cnt,p2Cnt,playerToMove);
			if(assumedMoveCount < minMoves){
				initCounters(minMoves);
				infoMsg = "Initializing move number to correpond with the number of pieces on the board.";
			}
			playMsg = "It is " + gameData.my_color + "'s turn to play.";
		}

		// player-opp is white, player-me is black. Seems like those
		// names are backward, we'll just roll with it.
		document.getElementById("player-opp").className = (gameData.my_color === "white" ? "selectplayer" : "");
		document.getElementById("player-me").className = (gameData.my_color === "black" ? "selectplayer" : "");

		this.whitepiecesleft = this.tottiles + this.totcaps - p1Cnt;
		this.blackpiecesleft = this.tottiles + this.totcaps - p2Cnt;
		if(this.whitepiecesleft <= 0 && this.blackpiecesleft <= 0){
			alert('danger','TPS nonsense - all pieces used up by both players');
			gameData.is_game_end = true;
			return;
		}
		if(this.whitepiecesleft <=0){
			gameData.result = "F-0";
			gameOver('All white pieces used.');
			return;
		}
		if(this.blackpiecesleft <=0){
			gameData.result = "0-F";
			gameOver('All black pieces used.');
			return;
		}
		notate("load");

		this.showmove(gameData.move_shown);
		alert('info',infoMsg + " " + playMsg);
	},
	// assumes that the movecount and movestart have been initialized meaningfully
	// and 0,0 is OK
	count_pieces_on_board: function(player){
		let count = 0;
		const pos = this.board_history[gameData.move_count - gameData.move_start];
		for(let i=0;i < pos.length;i++){
			const pieces = pos[i];
			// remember, upper case is white(p1) and lower case is black(p2),
			for(let s=0;s < pieces.length;s++){
				if(player === WHITE_PLAYER && pieces[s] === pieces[s].toUpperCase() ||
					player === BLACK_PLAYER && pieces[s] === pieces[s].toLowerCase()){
					count++;
				}
			}
		}
		return count;
	},
	moveCountCalc: function(p1Turns,p2Turns,playerToMove){
		return Math.max(p1Turns,p2Turns)*2 + (playerToMove===2 ? 1 : 0);
	},
	pushInitialEmptyBoard: function(size){
		const bp = [];
		for(let i = 0;i < size;i++){
			this.sq[i] = [];
			for(let j = 0;j < size;j++){
				this.sq[i][j] = [];
				bp.push([]);
			}
		}
		this.board_history.push(bp);
	},
	renderBoardFromTPS: function(grid){
		function parseIndividualDigits(cell){
			const cellRegex = /^([12]+)([SC]?)$/;
			const match = cellRegex.exec(cell);

			if(!match){
				return null; // Invalid cell
			}

			const digits = match[1]; // e.g., "1", "2", "12", "21", etc.
			const suffix = match[2]; // e.g., "", "S", or "C"

			// Convert the string of digits into an array of individual numbers
			const pieces = [...digits].map(digit => parseInt(digit, 10));

			return {
				pieces, // Array of individual pieces: [1], [2], [1,2], [2,1], etc.
				suffix,
				hasS: suffix === "S",
				hasC: suffix === "C"
			};
		}
		this.resetBoardStacks();
		document.getElementById("player-opp").className = "selectplayer";
		document.getElementById("player-me").className = "";
		// we have a grid by size and need to iterate over it to place the pieces
		// always atart in the lower left corner a1 and work up
		for(let i = 0; i < grid.length; i++){ // iterate through rows
			for(let j = 0; j < grid[i].length; j++){ // iterate through columns
				if(grid[i][j].toLowerCase() !== 'x'){
					// a cell is either empty (maybe multiple), or a stack of one or more pieces
					const cellValues = parseIndividualDigits(grid[i][j]);
					const square = this.get_board_obj(j, i);
					for(let k = 0; k < cellValues.pieces.length; k++){
						// handle top of the stack
						if(k === cellValues.pieces.length - 1){
							if(cellValues.hasS){
								const pc = this.getfromstack(false,cellValues.pieces[k] === 1);
								if(pc === null || typeof pc === 'undefined'){
									alert('danger','Invalid TPS - too many pieces for player ' + k + ' at row ' + i + ', "' + j + '"');
									return;
								}
								this.standup(pc);
								this.pushPieceOntoSquare(square,pc);
							}
							else if(cellValues.hasC){
								const pc = this.getfromstack(true,cellValues.pieces[k] === 1);
								if(pc === null || typeof pc === 'undefined'){
									alert('danger','Invalid TPS - too many pieces for player ' + k + ' at row ' + i + ', "' + j + '"');
									return;
								}
								this.pushPieceOntoSquare(square,pc);
							}
							else{
								const pc = this.getfromstack(false,cellValues.pieces[k] === 1);
								if(pc === null || typeof pc === 'undefined'){
									alert('danger','Invalid TPS - too many pieces for player ' + k + ' at row ' + i + ', "' + j + '"');
									return;
								}
								this.pushPieceOntoSquare(square,pc);
							}
						}
						else{
							const pc = this.getfromstack(false,cellValues.pieces[k] === 1);
							if(pc === null || typeof pc === 'undefined'){
								alert('danger','Invalid TPS - too many pieces for player ' + k + ' at row ' + i + ', "' + j + '"');
								return;
							}
							this.pushPieceOntoSquare(square,pc);
						}
					}
				}
			}
		}
		this.save_board_pos();
	}
};

function onWindowResize(){
	if(rendererdone){
		renderer.setSize(document.documentElement.clientWidth, document.documentElement.clientHeight);
		pixelratio=(window.devicePixelRatio||1)*scalelevel;
		renderer.setPixelRatio(pixelratio);
		adjustsidemenu();
		closeMobileMenu();
		setTimeout(generateCamera, 100);
	}
}

function onDocumentMouseMove(e){
	const x = e.clientX - canvas.offsetLeft;
	const y = e.clientY - canvas.offsetTop;
	mouse.x = (pixelratio * x / canvas.width) * 2 - 1;
	mouse.y = -(pixelratio * y / canvas.height) * 2 + 1;

	board.mousemove();
}

const mouseDownPos = { x: 0, y: 0 };
const mouseDragThreshold = 5;
let justRotatedPiece = false;
let justSelectedPiece = false;
let pendingPlacement = null; // { sq, piece, hideSelectionShadow } - deferred until mouseup confirms click

function onDocumentMouseDown(e){
	justRotatedPiece = false;
	justSelectedPiece = false;
	const x = e.clientX - canvas.offsetLeft;
	const y = e.clientY - canvas.offsetTop;
	mouse.x = (pixelratio * x / canvas.width) * 2 - 1;
	mouse.y = -(pixelratio * y / canvas.height) * 2 + 1;
	mouseDownPos.x = e.clientX;
	mouseDownPos.y = e.clientY;

	if(e.button === 2){
		board.rightclick();
	}
	else if(e.button === 0){
		if(gameData.move_count !== gameData.move_shown){return;}
		board.leftclick();
	}
	board.mousemove();
}

function onDocumentMouseUp(e){
	if(e.button === 2){
		e.preventDefault();
		board.rightup();
	}
	else if(e.button === 0){
		// Check if this was a click (not a drag)
		const dx = e.clientX - mouseDownPos.x;
		const dy = e.clientY - mouseDownPos.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		const wasClick = dist < mouseDragThreshold;

		// Handle pending piece placement (deferred from mousedown)
		if(pendingPlacement){
			if(wasClick && checkIfMyMove() && !gameData.is_game_end){
				board.placePieceOnSquare(pendingPlacement.piece, pendingPlacement.sq);
			}
			else if(pendingPlacement.hideSelectionShadow){
				// Was a drag with a selected piece - restore the selection
				board.selected = pendingPlacement.piece;
			}
			pendingPlacement = null;
		}

		if(wasClick && !justRotatedPiece && !justSelectedPiece){
			// This was a click, not a drag - cancel move if on background
			// Don't cancel if we just rotated or selected a piece (raycaster might miss moved piece)
			const pick = board.mousepick();
			if(pick[0] === "none" && (board.selected || board.selectedStack)){
				board.cancelMove();
			}
		}
	}
}

function init3DBoard(){
	canvas = document.getElementById("gamecanvas");

	scene = new THREE.Scene();

	renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: antialiasing_mode });
	renderer.setSize(document.documentElement.clientWidth, document.documentElement.clientHeight);
	pixelratio = (window.devicePixelRatio || 1) * scalelevel;
	renderer.setPixelRatio(pixelratio);
	renderer.setClearColor(clearcolor, 1);
	maxaniso = Math.min((renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : renderer.getMaxAnisotropy()) || 1, 16);

	window.addEventListener("resize", onWindowResize, false);
	window.addEventListener("keyup", onKeyUp, false);

	rendererdone = true;
	const geometry = new THREE.TorusGeometry(sq_size / 2 + 5, 3, 16, 100);
	highlighter = new THREE.Mesh(geometry, materials.highlighter);
	highlighter.rotateX(Math.PI / 2);
	lastMoveHighlighter = new THREE.Mesh(geometry, materials.lastMoveHighlighter);
	lastMoveHighlighter.rotateX(Math.PI / 2);
	// Enable shadow mapping on renderer
	renderer.shadowMap.enabled = true;
	// PCFShadowMap is soft in r187+ (it samples around each point using shadow.radius); PCFSoftShadowMap was removed
	renderer.shadowMap.type = THREE.PCFShadowMap;
	// The main light, casting every piece's shadow
	shadowLight = new THREE.DirectionalLight(0xffffff, lightIntensity.shadow);
	shadowLight.position.set(...shadowLightPosition);
	shadowLight.target.position.set(0, 0, 0);
	shadowLight.castShadow = true;
	shadowLight.shadow.mapSize.width = 2048;
	shadowLight.shadow.mapSize.height = 2048;
	shadowLight.shadow.bias = -0.001;
	// pieces also receive shadows; pushing the lookup out along the surface normal keeps them from shadowing themselves
	shadowLight.shadow.normalBias = 0.5;
	shadowLight.shadow.radius = 6;
	shadowLight.ispassive = true;
	scene.add(shadowLight);
	scene.add(shadowLight.target);
	generateCamera();
	initBoard();
	if(camera && controls){
		startAnimation();
	}
	else{
		console.warn("Camera or controls not ready, retrying...");
		waitForSceneReady();
	}

	canvas.addEventListener("mousedown", onDocumentMouseDown, false);
	canvas.addEventListener("mouseup", onDocumentMouseUp, false);
	canvas.addEventListener("mousemove", onDocumentMouseMove, false);
	canvas.addEventListener("contextmenu", function(e){e.preventDefault();}, false);

	materials.updateBoardMaterials();
	materials.updatePieceMaterials();
	loadCustomPieces();

	if(location.search.slice(0,6)===('?load=')){
		const text = decodeURIComponent(location.search.split('?load=')[1]);
		document.getElementById("loadptntext").value = text;
		document.title = "Tak Review";
		hideElement("landing");
		load();
	}
}

function waitForSceneReady(attempts = 0){
	const maxAttempts = 10;
	const retryDelay = 100;

	if(attempts >= maxAttempts){
		console.error("Failed to initialize scene after multiple attempts");
		return;
	}

	if(camera && controls){
		startAnimation();
	}
	else{
		setTimeout(() => {
			generateCamera();
			waitForSceneReady(attempts + 1);
		}, retryDelay);
	}
}

function startAnimation(){
	if(!camera || !controls){
		console.error("Cannot start animation without camera and controls");
		return;
	}
	animate();
}
