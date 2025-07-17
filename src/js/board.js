const WHITE_PLAYER = 1;
const BLACK_PLAYER = 2;
var stack_dist = 15;
var piece_size = 60;
var piece_height = 15;
var sq_size = 90;
var sq_height = 15;
var capstone_height = 70;
var capstone_radius = 30;
var stack_selection_height = 60;
var border_size = 30;
let borderOffset = 27;
var stackOffsetFromBorder = 50;
var letter_size = 12;
var diagonal_walls = false;
var table_width = 1280;
var table_depth = 920;
var table_height = 50;

var light_position = [0, 800, -45];
var light_radius = [1.8, 1600];

var raycaster = new THREE.Raycaster();
var highlighter;
var lastMoveHighlighter;
var mouse = new THREE.Vector2();
var offset = new THREE.Vector3();

var antialiasing_mode = true;
var maxaniso=1;
var anisolevel=16;
var dontanimate = false;
var scenehash = 0;
var lastanimate = 0;
var camera,scene,renderer,light,canvas,controls = null;
var perspective;

function animate(){
	if(is2DBoard){return;}
	if(!dontanimate){
		controls.update();
		var newscenehash=floathashscene();
		var now=Date.now();
		if(scenehash!=newscenehash || lastanimate+1000<=now){
			scenehash=newscenehash;
			lastanimate=now;
			renderer.render(scene,camera);
		}
	}
	requestAnimationFrame(animate);
}

function combinefrustumvectors(a,b){
	var a2=a.dot(a);
	var b2=b.dot(b);
	var ab=a.dot(b);
	var a2b2=a2*b2;
	var div=a2b2-ab*ab;
	var bmul=(a2b2-a2*ab)/div;
	var amul=(a2b2-b2*ab)/div;
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
	var cuttop = $('header').height() + BOARD_PADDING;
	var cutleft = getLeftPadding();
	var cutright = getRightPadding();
	var cutbottom = 0 + BOARD_PADDING;

	var pointlist = [];
	var xsizea = gameData.size*sq_size/2+border_size+stackOffsetFromBorder+piece_size;
	var xsizeb = (gameData.size-1)*sq_size/2+piece_size/2;
	var yneg = sq_height/2;
	var yposa = 10*piece_height-yneg;
	var yposb = 20*piece_height+yneg;
	var zsizea = gameData.size*sq_size/2+border_size;
	var zsizeb = xsizeb;

	for(let a = -1; a < 2; a += 2){
		for(let b = -1; b < 2; b += 2){
			pointlist.push(new THREE.Vector3(a*xsizea,-yneg,b*zsizea));
			pointlist.push(new THREE.Vector3(a*xsizea,yposa,b*zsizea));
			pointlist.push(new THREE.Vector3(a*xsizeb,yposb,b*zsizeb));
		}
	}
	var invcamdir;
	if(camera && !fixedcamera){
		invcamdir=camera.position.clone().sub(controls.center).normalize();
	}
	else{
		invcamdir=new THREE.Vector3(-4,25,25).normalize();
	}
	var camdir=invcamdir.clone().negate();
	var up=new THREE.Vector3(0,1,0);
	var camleft=new THREE.Vector3();
	camleft.crossVectors(up,camdir).normalize();
	var camup=new THREE.Vector3();
	camup.crossVectors(camdir,camleft).normalize();
	var camright=camleft.clone().negate();
	var camdown=camup.clone().negate();
	if(perspective>0){
		var fw=pixelratio*(window.innerWidth+Math.abs(cutleft-cutright));
		var fh=pixelratio*(window.innerHeight+Math.abs(cuttop-cutbottom));
		var ox=pixelratio*(Math.max(0,cutright-cutleft));
		var oy=pixelratio*(Math.max(0,cutbottom-cuttop));
		var xv=pixelratio*(window.innerWidth-cutleft-cutright);
		var yv=pixelratio*(window.innerHeight-cuttop-cutbottom);
		var perspectiveheight=fh*perspective/(yv+xv)/90;
		var perspectivewidth=perspectiveheight*fw/fh;
		var perspectiveangle=Math.atan(perspectiveheight)*360/Math.PI;
		var scaletop=perspectiveheight*yv/fh;
		var scalebottom=scaletop;
		var scaleleft=perspectivewidth*xv/fw;
		var scaleright=scaleleft;
		var fvtop=camup.clone().divideScalar(scaletop).add(invcamdir).normalize();
		var fvbottom=camdown.clone().divideScalar(scalebottom).add(invcamdir).normalize();
		var fvleft=camleft.clone().divideScalar(scaleleft).add(invcamdir).normalize();
		var fvright=camright.clone().divideScalar(scaleright).add(invcamdir).normalize();
		var maxleft=0;
		var maxright=0;
		var maxtop=0;
		var maxbottom=0;
		for(a=0;a<pointlist.length;a++){
			var newdist=fvleft.dot(pointlist[a]);
			maxleft=Math.max(maxleft,newdist);
			var newdist=fvright.dot(pointlist[a]);
			maxright=Math.max(maxright,newdist);
			var newdist=fvtop.dot(pointlist[a]);
			maxtop=Math.max(maxtop,newdist);
			var newdist=fvbottom.dot(pointlist[a]);
			maxbottom=Math.max(maxbottom,newdist);
		}

		var camdist=0;
		var camcenter=new THREE.Vector3(0,0,0);

		if(fixedcamera){
			var lrcampos=combinefrustumvectors(fvleft.clone().multiplyScalar(maxleft),fvright.clone().multiplyScalar(maxright));
			var tbcampos=combinefrustumvectors(fvtop.clone().multiplyScalar(maxtop),fvbottom.clone().multiplyScalar(maxbottom));
			var lrlen=lrcampos.dot(invcamdir);
			var tblen=tbcampos.dot(invcamdir);

			if(lrlen<tblen){
				var addin=(maxleft+maxright)*(tblen/lrlen-1)/2;
				lrcampos=combinefrustumvectors(fvleft.clone().multiplyScalar(maxleft+addin),fvright.clone().multiplyScalar(maxright+addin));

				lrlen=lrcampos.dot(invcamdir);
				addin+=(maxleft+maxright+addin*2)*(tblen/lrlen-1)/2;
				lrcampos=combinefrustumvectors(fvleft.clone().multiplyScalar(maxleft+addin),fvright.clone().multiplyScalar(maxright+addin));

			}
			else{
				var addin=(maxtop+maxbottom)*(lrlen/tblen-1)/2;
				tbcampos=combinefrustumvectors(fvtop.clone().multiplyScalar(maxtop+addin),fvbottom.clone().multiplyScalar(maxbottom+addin));

				tblen=tbcampos.dot(invcamdir);
				addin+=(maxtop+maxbottom+addin*2)*(lrlen/tblen-1)/2;
				tbcampos=combinefrustumvectors(fvtop.clone().multiplyScalar(maxtop+addin),fvbottom.clone().multiplyScalar(maxbottom+addin));

			}

			camdist=lrcampos.dot(invcamdir);
			var camdiff=tbcampos.clone().sub(lrcampos);
			var lradjust=camup.clone().multiplyScalar(camdiff.dot(camup));
			var finalcampos=lrcampos.clone().add(lradjust);

			var centeroffset=camdir.clone().multiplyScalar(finalcampos.dot(invcamdir));
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

			var finalcampos=invcamdir.clone().multiplyScalar(camdist);

			camera = new THREE.PerspectiveCamera(perspectiveangle,canvas.width / canvas.height,Math.max(camdist/5-800,10),camdist*3+800);
			camera.setViewOffset(fw,fh,ox,oy,canvas.width,canvas.height);
			camera.position.set(finalcampos.x,finalcampos.y,finalcampos.z);
		}

		controls = new THREE.OrbitControls(camera,renderer.domElement);
		controls.minDistance = camdist/5;
		controls.maxDistance = camdist*3;
		controls.enableKeys = false;
		controls.center.set(camcenter.x,camcenter.y,camcenter.z);
		controls.enablePan=false;

		if(ismobile){
			controls.zoomSpeed = 0.5;
		}
	}
	else{
		var maxleft=0;
		var maxright=0;
		var maxtop=0;
		var maxbottom=0;
		for(a=0;a<pointlist.length;a++){
			var newleft=camleft.dot(pointlist[a]);
			maxleft=Math.max(maxleft,newleft);
			maxright=Math.min(maxright,newleft);
			var newtop=camup.dot(pointlist[a]);
			maxtop=Math.max(maxtop,newtop);
			maxbottom=Math.min(maxbottom,newtop);
		}
		var scalex=(maxleft-maxright)/(window.innerWidth-cutleft-cutright);
		var scaley=(maxtop-maxbottom)/(window.innerHeight-cuttop-cutbottom);
		var scale=Math.max(scalex,scaley);
		var xpadding=(window.innerWidth-cutleft-cutright)*(1-scalex/scale);
		var ypadding=(window.innerHeight-cuttop-cutbottom)*(1-scaley/scale);
		cutleft+=xpadding/2;
		cutright+=xpadding/2;
		cuttop+=ypadding/2;
		cutbottom+=ypadding/2;

		camera = new THREE.OrthographicCamera(-maxleft-cutleft*scale,-maxright+cutright*scale,maxtop+cuttop*scale,maxbottom-cutbottom*scale,2000,5000);
		var campos=invcamdir.multiplyScalar(3500);
		camera.position.set(campos.x,campos.y,campos.z);

		controls = new THREE.OrbitControls(camera,renderer.domElement);
		controls.minZoom = 0.5;
		controls.maxZoom = 3;
		controls.enableKeys = false;
		controls.center.set(0,0,0);
		controls.enablePan=false;

		if(ismobile){
			controls.zoomSpeed = 0.5;
		}
	}
	if(fixedcamera){
		controls.enableRotate=false;
		controls.enableZoom=false;
		board.boardside="white";
	}
	if(!gameData.isScratch && (gameData.my_color=="black") != (board.boardside=="black")){
		board.reverseboard();
	}
}

function floathashscene(){
	var hash=0;
	var multiplier=1;
	updatepoint(camera.position);
	updatepoint(controls.center);
	update(camera.zoom);
	var a;
	for(a=0;a<board.piece_objects.length;a++){
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

var materials = {
	images_root_path: 'images/',
	board_texture_path: 'images/board/',
	pieces_texture_path: 'images/pieces/',
	white_sqr_style_name: 'sand-velvet-diamonds',
	black_sqr_style_name: 'sand-velvet-diamonds',
	white_piece_style_name: "white_coral",
	black_piece_style_name: "black_pietersite",
	white_cap_style_name: "white_coral",
	black_cap_style_name: "black_pietersite",
	table_texture_path: 'images/wooden_table.png',
	boardOverlayPath: 'images/board/overlay.png',
	borderColor: 0x6f4734,
	borders: [],
	letters: [],
	white_piece: new THREE.MeshBasicMaterial({color: 0xd4b375}),
	black_piece: new THREE.MeshBasicMaterial({color: 0x573312}),
	white_cap: new THREE.MeshBasicMaterial({color: 0xd4b375}),
	black_cap: new THREE.MeshBasicMaterial({color: 0x573312}),
	white_sqr: new THREE.MeshBasicMaterial({color: 0xe6d4a7}),
	black_sqr: new THREE.MeshBasicMaterial({color: 0xba6639}),
	boardOverlay: new THREE.MeshBasicMaterial({map: {}}),
	overlayMap: {
		3: { "size": 270, "offset": { "x": 0.5333, "y": 0.0556 }, "repeat": { "x": 0.2, "y": 0.1667 } },
		4: { "size": 360, "offset": { "x": 0, "y": 0 }, "repeat": { "x": 0.2667, "y": 0.2222 } },
		5: { "size": 450, "offset": { "x": 0.5333, "y": 0.2778 }, "repeat": { "x": 0.3333, "y": 0.2778 } },
		6: { "size": 540, "offset": { "x": 0, "y": 0.2222 }, "repeat": { "x": 0.4, "y": 0.3333 } },
		7: { "size": 630, "offset": { "x": 0.5333, "y": 0.6111 }, "repeat": { "x": 0.4667, "y": 0.3889 } },
		8: { "size": 720, "offset": { "x": 0.0007, "y": 0.5556 }, "repeat": { "x": 0.5333, "y": 0.4444 } }
	},
	border: new THREE.MeshBasicMaterial({color: 0x6f4734}),
	letter: new THREE.MeshBasicMaterial({color: 0xFFF5B5}),
	highlighter: new THREE.LineBasicMaterial({color: 0x0000f0}),
	lastMoveHighlighter: new THREE.LineBasicMaterial({color: 0xfff9b8}),
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
		var loader = new THREE.TextureLoader();

		this.white_sqr = new THREE.MeshBasicMaterial({map: loader.load(this.getWhiteSquareTextureName(),this.boardLoadedFn), transparent: true});
		this.black_sqr = new THREE.MeshBasicMaterial({map: loader.load(this.getBlackSquareTextureName(),this.boardLoadedFn), transparent: true});
		var an=Math.min(maxaniso,anisolevel);
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
		let mesh = new THREE.MeshBasicMaterial({ map: loader.load(val), transparent: true});
		for(let i = 0; i < this.borders.length; i++){
			this.borders[i].material = mesh;
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
		const mesh = new THREE.MeshBasicMaterial({color: color});
		mesh.color.setHex(color);
		for(let i = 0; i < this.borders.length; i++){
			this.borders[i].material = mesh;
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
		var loader = new THREE.TextureLoader();
		this.piecesLoaded = 0;

		this.black_piece = new THREE.MeshBasicMaterial({map: loader.load(this.getBlackPieceTextureName(),this.piecesLoadedFn)});
		this.white_piece = new THREE.MeshBasicMaterial({map: loader.load(this.getWhitePieceTextureName(),this.piecesLoadedFn)});
		this.white_cap = new THREE.MeshBasicMaterial({map: loader.load(this.getWhiteCapTextureName(),this.piecesLoadedFn)});
		this.black_cap = new THREE.MeshBasicMaterial({map: loader.load(this.getBlackCapTextureName(),this.piecesLoadedFn)});
		var an=Math.min(maxaniso,anisolevel);
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
				}
			}
		}
	}
};

var boardFactory = {
	boardfont: null,
	makeSquare: function(file,rankInverse,scene){
		var geometry = new THREE.BoxGeometry(sq_size,sq_height,sq_size);
		geometry.center();
		var square = new THREE.Mesh(geometry,((file+rankInverse) % 2 ? materials.white_sqr : materials.black_sqr));
		square.position.set(
			board.sq_position.startx + file*sq_size,
			0,
			board.sq_position.startz + rankInverse*sq_size
		);
		square.file = file;
		square.rank = gameData.size - 1 - rankInverse;
		square.isboard = true;
		scene.add(square);
		return square;
	},
	makeBorders: function(scene){
		materials.borders = [];
		if(localStorage.getItem('borderTexture')){
			const loader = new THREE.TextureLoader();
			materials.border = new THREE.MeshBasicMaterial({ map: loader.load(localStorage.getItem('borderTexture')), transparent: true}, materials.boardLoadedFn());
		}
		// We use the same geometry for all 4 borders. This means the borders
		// overlap each other at the corners. Probably OK at this point, but
		// maybe there are cases where that would not be good.
		let geometry = new THREE.BoxGeometry(board.length,piece_height,border_size);
		geometry.center();
		let border;
		if(localStorage["borderColor"] && !localStorage.getItem('borderTexture')){
			let color = localStorage["borderColor"];
			if(color.startsWith("#")){
				color = color.substring(1);
				color = '0x' + color;
			}
			materials.border.color.setHex(color);
		}
		// Top border
		border = new THREE.Mesh(geometry,materials.border);
		border.position.set(0,0,board.corner_position.z + border_size/2);
		materials.borders.push(border);
		// Bottom border
		border = new THREE.Mesh(geometry,materials.border);
		border.position.set(0,0,board.corner_position.endz - border_size/2);
		border.rotateY(Math.PI);
		materials.borders.push(border);
		// Left border
		border = new THREE.Mesh(geometry,materials.border);
		border.position.set(board.corner_position.x + border_size/2,0,0);
		border.rotateY(Math.PI/2);
		materials.borders.push(border);
		// Right border
		border = new THREE.Mesh(geometry,materials.border);
		border.position.set(board.corner_position.endx - border_size/2,0,0);
		border.rotateY(-Math.PI / 2);
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
			var loader = new THREE.FontLoader();
			loader.load('fonts/helvetiker_regular.typeface.js',gotfont);
		}

		function gotfont(font){
			boardFactory.boardfont=font;
			// add the letters and numbers around the border
			for(var i = 0;i < gameData.size;i++){
				var geometry,letter;
				// Top letters
				geometry = new THREE.TextGeometry(
					String.fromCharCode('A'.charCodeAt(0) + i),
					{size: letter_size,height: 1,font: font,weight: 'normal'}
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
					{size: letter_size,height: 1,font: font,weight: 'normal'}
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
					{size: letter_size,height: 1,font: font,weight: 'normal'}
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
					{size: letter_size,height: 1,font: font,weight: 'normal'}
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

var pieceFactory = {
	makePiece: function(playerNum,pieceNum,scene){
		var materialMine = (playerNum === WHITE_PLAYER ? materials.white_piece : materials.black_piece);
		var materialOpp = (playerNum === WHITE_PLAYER ? materials.black_piece : materials.white_piece);
		var geometry=piecegeometry(playerNum === WHITE_PLAYER?"white":"black");

		var stackno = Math.floor(pieceNum / 10);
		var stackheight = pieceNum % 10;
		var piece = new THREE.Mesh(geometry,materialMine);
		piece.iswhitepiece = (playerNum === WHITE_PLAYER);
		if(playerNum === WHITE_PLAYER){
			piece.position.set(
				board.corner_position.endx + stackOffsetFromBorder + piece_size/2,
				stackheight*piece_height+piece_height/2-sq_height/2,
				board.corner_position.endz - piece_size/2 - stackno*(stack_dist+piece_size)
			);
		}
		else{
			piece.position.set(
				board.corner_position.x - stackOffsetFromBorder - piece_size/2,
				stackheight*piece_height+piece_height/2-sq_height/2,
				board.corner_position.z + piece_size/2 + stackno*(stack_dist+piece_size)
			);
		}

		piece.isstanding = false;
		piece.onsquare = null;
		piece.isboard = false;
		piece.iscapstone = false;
		piece.pieceNum=pieceNum;
		scene.add(piece);
		return piece;
	},
	makeCap: function(playerNum,capNum,scene){
		var geometry = capgeometry(playerNum === WHITE_PLAYER?"white":"black");

		// the capstones go at the other end of the row
		var piece;
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
			piece.position.set(
				board.corner_position.x - capstone_radius - stackOffsetFromBorder,
				capstone_height/2-sq_height/2,
				board.corner_position.endz - capstone_radius - capNum*(stack_dist+capstone_radius*2)
			);
			piece.iswhitepiece = false;
		}
		piece.isstanding = true;
		piece.onsquare = null;
		piece.isboard = false;
		piece.iscapstone = true;
		piece.pieceNum=capNum;
		scene.add(piece);
		return piece;
	}
};

function piecegeometry(color){
	var geometry = new THREE.BoxGeometry(piece_size,piece_height,piece_size);
	var geometrytype;
	if(color=="white"){
		geometrytype=piecesMap[materials.white_piece_style_name];
	}
	else{
		geometrytype=piecesMap[materials.black_piece_style_name];
	}
	if(!geometrytype.multi_file){
		var a,b;
		for(a=0;a<12;a++){
			for(b=0;b<3;b++){
				geometry.faceVertexUvs[0][a][b].x=geometry.faceVertexUvs[0][a][b].x==0?9/16:15/16;
				if(a>3 && a<8){
					geometry.faceVertexUvs[0][a][b].y=geometry.faceVertexUvs[0][a][b].y==0?1/32:13/32;
				}
				else{
					geometry.faceVertexUvs[0][a][b].y=geometry.faceVertexUvs[0][a][b].y==0?29/64:35/64;
				}
			}
		}
	}
	return geometry;
}

function capgeometry(color){
	capstone_radius=piece_size*0.4;
	capstone_height=Math.min(piece_size*1.1,70);
	var geometry = new THREE.CylinderGeometry(capstone_radius,capstone_radius,capstone_height,30);
	var a,b;
	var geometrytype;
	if(color=="white"){
		geometrytype=piecesMap[materials.white_cap_style_name];
	}
	else{
		geometrytype=piecesMap[materials.black_cap_style_name];
	}
	if(geometrytype.multi_file){
		for(a=60;a<120;a++){
			for(b=0;b<3;b++){
				geometry.faceVertexUvs[0][a][b].x=(geometry.faceVertexUvs[0][a][b].x-0.5)*0.25+0.5;
				geometry.faceVertexUvs[0][a][b].y=(geometry.faceVertexUvs[0][a][b].y-0.5)*0.5+0.5;
			}
		}
	}
	else{
		for(a=0;a<60;a++){
			for(b=0;b<3;b++){
				var newx=0.5*geometry.faceVertexUvs[0][a][b].y;
				var newy=1-geometry.faceVertexUvs[0][a][b].x;
				geometry.faceVertexUvs[0][a][b].x=newx;
				geometry.faceVertexUvs[0][a][b].y=newy;
			}
		}
		for(a=60;a<120;a++){
			for(b=0;b<3;b++){
				geometry.faceVertexUvs[0][a][b].x=(geometry.faceVertexUvs[0][a][b].x-0.5)*0.375+0.75;
				geometry.faceVertexUvs[0][a][b].y=(geometry.faceVertexUvs[0][a][b].y-0.5)*0.375+0.78125;
			}
		}
	}
	return geometry;
}

/*
 * Construct a burred box with parameter width, height, depth
 * as well as burringWidth and burringHeight.
 */
function constructBurredBox(width, height, depth, burringDepth, burringHeight, burringVertical){
	var geometry = new THREE.Geometry();
	geometry.parameters = [];
	geometry.parameters.width = width;
	geometry.parameters.height = height;
	geometry.parameters.depth = depth;

	// calculate relative burrings and side height.
	var relBurWidth = burringDepth / width;
	var relativeSideHeight = (height - burringHeight * 2) / width;

	// construct UVS points.
	var tex_area = [
		new THREE.Vector2(relBurWidth, relBurWidth),
		new THREE.Vector2(1 - relBurWidth, relBurWidth),
		new THREE.Vector2(1 - relBurWidth, 1 - relBurWidth),
		new THREE.Vector2(relBurWidth, 1 - relBurWidth)
	];
	var tex_side_area = [
		new THREE.Vector2(0, 1 - relativeSideHeight),
		new THREE.Vector2(1, 1 - relativeSideHeight),
		new THREE.Vector2(1, 1),
		new THREE.Vector2(0, 1)
	];
	var tex_top = [
		new THREE.Vector2(relBurWidth, 1 - relBurWidth),
		new THREE.Vector2(1 - relBurWidth, 1 - relBurWidth),
		new THREE.Vector2(1, 1),
		new THREE.Vector2(0, 1)
	];
	var tex_bottom = [
		new THREE.Vector2(1 - relBurWidth, relBurWidth),
		new THREE.Vector2(relBurWidth, relBurWidth),
		new THREE.Vector2(0, 0),
		new THREE.Vector2(1, 0)
	];
	var tex_left = [
		new THREE.Vector2(relBurWidth, relBurWidth),
		new THREE.Vector2(relBurWidth, 1 - relBurWidth),
		new THREE.Vector2(0, 1),
		new THREE.Vector2(0, 0)
	];
	var tex_right = [
		new THREE.Vector2(1 - relBurWidth, 1 - relBurWidth),
		new THREE.Vector2(1 - relBurWidth, relBurWidth),
		new THREE.Vector2(1, 0),
		new THREE.Vector2(1, 1)
	];

	// construct vertices.
	geometry.vertices.push(
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
	for(i = 0; i < 6; ++i){
		geometry.faces.push(
			new THREE.Face3(i*4 + 2, i*4 + 1, i*4 + 3),
			new THREE.Face3(i*4 + 1, i*4 + 0, i*4 + 3)
		);
	}
	// texture areas.
	for(i = 0; i < 6; ++i){
		if(i < 2){
			geometry.faceVertexUvs[0][i*2 + 0] = [tex_area[2], tex_area[1], tex_area[3]];
			geometry.faceVertexUvs[0][i*2 + 1] = [tex_area[1], tex_area[0], tex_area[3]];
		}
		else{
			geometry.faceVertexUvs[0][i*2 + 0] = [tex_side_area[2], tex_side_area[1], tex_side_area[3]];
			geometry.faceVertexUvs[0][i*2 + 1] = [tex_side_area[1], tex_side_area[0], tex_side_area[3]];
		}
	}
	// edges.
	geometry.faces.push(
		// top.
		new THREE.Face3(11, 0, 10),
		new THREE.Face3(0, 1, 10),
		new THREE.Face3(15, 2, 14),
		new THREE.Face3(2, 3, 14),
		new THREE.Face3(19, 3, 18),
		new THREE.Face3(3, 0, 18),
		new THREE.Face3(23, 1, 22),
		new THREE.Face3(1, 2, 22),
		// bottom.
		new THREE.Face3(9, 4, 8),
		new THREE.Face3(4, 5, 8),
		new THREE.Face3(13, 6, 12),
		new THREE.Face3(6, 7, 12),
		new THREE.Face3(21, 7, 20),
		new THREE.Face3(7, 4, 20),
		new THREE.Face3(17, 5, 16),
		new THREE.Face3(5, 6, 16),
		// around.
		new THREE.Face3(18, 11, 17),
		new THREE.Face3(11, 8, 17),
		new THREE.Face3(10, 23, 9),
		new THREE.Face3(23, 20, 9),
		new THREE.Face3(22, 15, 21),
		new THREE.Face3(15, 12, 21),
		new THREE.Face3(14, 19, 13),
		new THREE.Face3(19, 16, 13)
	);
	// textures edges top.
	geometry.faceVertexUvs[0][12] = [tex_bottom[2], tex_bottom[1], tex_bottom[3]];
	geometry.faceVertexUvs[0][13] = [tex_bottom[1], tex_bottom[0], tex_bottom[3]];
	geometry.faceVertexUvs[0][14] = [tex_top[2], tex_top[1], tex_top[3]];
	geometry.faceVertexUvs[0][15] = [tex_top[1], tex_top[0], tex_top[3]];
	geometry.faceVertexUvs[0][16] = [tex_left[2], tex_left[1], tex_left[3]];
	geometry.faceVertexUvs[0][17] = [tex_left[1], tex_left[0], tex_left[3]];
	geometry.faceVertexUvs[0][18] = [tex_right[2], tex_right[1], tex_right[3]];
	geometry.faceVertexUvs[0][19] = [tex_right[1], tex_right[0], tex_right[3]];
	// textures edges bottom.
	geometry.faceVertexUvs[0][20] = [tex_bottom[2], tex_bottom[1], tex_bottom[3]];
	geometry.faceVertexUvs[0][21] = [tex_bottom[1], tex_bottom[0], tex_bottom[3]];
	geometry.faceVertexUvs[0][22] = [tex_top[2], tex_top[1], tex_top[3]];
	geometry.faceVertexUvs[0][23] = [tex_top[1], tex_top[0], tex_top[3]];
	geometry.faceVertexUvs[0][24] = [tex_left[2], tex_left[1], tex_left[3]];
	geometry.faceVertexUvs[0][25] = [tex_left[1], tex_left[0], tex_left[3]];
	geometry.faceVertexUvs[0][26] = [tex_right[2], tex_right[1], tex_right[3]];
	geometry.faceVertexUvs[0][27] = [tex_right[1], tex_right[0], tex_right[3]];
	// textures edges around.
	for(i = 0; i < 4; ++i){
		geometry.faceVertexUvs[0][28 + i * 2] = [tex_side_area[3], tex_side_area[3], tex_side_area[0]];
		geometry.faceVertexUvs[0][28 + i * 2 + 1] = [tex_side_area[3], tex_side_area[0], tex_side_area[0]];
	}

	// corners.
	geometry.faces.push(
		// top.
		new THREE.Face3(18, 0, 11),
		new THREE.Face3(10, 1, 23),
		new THREE.Face3(22, 2, 15),
		new THREE.Face3(14, 3, 19),
		// bottom.
		new THREE.Face3(8, 5, 17),
		new THREE.Face3(20, 4, 9),
		new THREE.Face3(12, 7, 21),
		new THREE.Face3(16, 6, 13)
	);
	// texture corners.
	for(i = 0; i < 2; ++i){
		geometry.faceVertexUvs[0][36 + i * 4] = [tex_left[3], tex_left[0], tex_left[3]];
		geometry.faceVertexUvs[0][37 + i * 4] = [tex_bottom[3], tex_bottom[0], tex_bottom[3]];
		geometry.faceVertexUvs[0][38 + i * 4] = [tex_right[3], tex_right[0], tex_right[3]];
		geometry.faceVertexUvs[0][39 + i * 4] = [tex_top[3], tex_top[0], tex_top[3]];
	}

	// do posterior work.
	geometry.computeBoundingBox();
	geometry.computeFaceNormals();
	geometry.center();
	return geometry;
}

var board = {
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

		document.getElementById("player-opp").className = "selectplayer";
		document.getElementById("player-me").className = "";

		if((gameData.my_color=="black") != (this.boardside=="black")){this.reverseboard();}
	},
	//remove all scene objects, reset player names, stop time, etc
	clear: function(){
		for(var i = scene.children.length - 1;i >= 0;i--){
			scene.remove(scene.children[i]);
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
		for(i = 0;i < gameData.size;i++){
			for(j = 0;j < gameData.size;j++){
				// We draw them from the left to right and top to bottom.
				// But, note, the naming (A1, B1, etc) is left to right and bottom to top.
				var square = boardFactory.makeSquare(i,j,scene);
				this.board_objects.push(square);
				this.sq[i][j].board_object = square;
			}
		}

		// draw the border around the squares
		boardFactory.makeBorders(scene);
		// draw the text around the board
		boardFactory.makeBorderText(scene);
		if(localStorage.getItem('boardOverlay')){
			this.addOverlay(localStorage.getItem('boardOverlay'));
		}
	},
	addOverlay: function(value){
		var overlay_texture = new THREE.TextureLoader().load(value ?? materials.boardOverlayPath);
		overlay_texture.wrapS = overlay_texture.wrapT = THREE.ClampToEdgeWrapping;
		overlay_texture.offset.set(materials.overlayMap[gameData.size].offset.x, materials.overlayMap[gameData.size].offset.y);
		overlay_texture.repeat.set(materials.overlayMap[gameData.size].repeat.x, materials.overlayMap[gameData.size].repeat.y);
		var overlay_material = new THREE.MeshLambertMaterial({map: overlay_texture});
		overlay_texture.magFilter = THREE.LinearFilter;
		overlay_texture.minFilter = THREE.LinearFilter;
		overlay_texture.generateMipmaps = true;
		overlay_texture.anisotropy = 4;
		var geometry = new THREE.BoxGeometry(materials.overlayMap[gameData.size].size, 2, materials.overlayMap[gameData.size].size);
		this.overlay = new THREE.Mesh(geometry, overlay_material);
		this.overlay.position.set(
			0,
			7,
			0
		);
		this.overlay.ispassive = true;
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
		var table_texture = new THREE.TextureLoader().load(materials.table_texture_path);
		var table_material = new THREE.MeshLambertMaterial({map: table_texture});
		table_material.magFilter = THREE.LinearFilter;
		table_material.minFilter = THREE.LinearMipMapFilter;
		table_material.anisotropy = 1;
		var geometry = constructBurredBox(table_width, table_height, table_depth, 5, 5, 5);
		this.table = new THREE.Mesh(geometry, table_material);
		this.table.position.set(0, -(table_height + sq_height) / 2, -sq_size / 2);
		this.table.ispassive = true;
		scene.add(this.table);
		this.table.visible = true;
		if(!JSON.parse(localStorage.getItem('show_table'))){
			this.table.visible = false;
		}
	},
	// Add light for the table
	addlight: function(){
		var light = new THREE.PointLight(0xAAAAAA, light_radius[0], light_radius[1]);
		light.position.x = light_position[0];
		light.position.y = light_position[1];
		light.position.z = light_position[2];
		light.ispassive = true;
		scene.add(light);
		var hemisphereLight = new THREE.HemisphereLight(0xFFFFFF, 0xFFFFFF, 0.6);
		hemisphereLight.color.setHSL(0.15, 0.1, 0.7);
		hemisphereLight.groundColor.setHSL(0.1, 0.8, 1);
		hemisphereLight.ispassive = true;
		scene.add(hemisphereLight);
	},
	// addpieces: add the pieces to the scene, not on the board
	addpieces: function(){
		var piece;
		var stacks=Math.ceil(this.tottiles/10+this.totcaps);
		stack_dist=Math.min((border_size*2+sq_size*gameData.size-stacks*piece_size)/Math.max(stacks-1,1),piece_size);
		for(var i=0;i < this.tottiles;i++){
			piece = pieceFactory.makePiece(WHITE_PLAYER,i,scene);
			this.piece_objects.push(piece);

			piece = pieceFactory.makePiece(BLACK_PLAYER,i,scene);
			this.piece_objects.push(piece);
		}

		for(var i=0;i < this.totcaps;i++){
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
	// called if the user changes the texture or size of the pieces
	updatepieces: function(){
		var stacks=Math.ceil(this.tottiles/10+this.totcaps);
		stack_dist=Math.min((border_size*2+sq_size*gameData.size-stacks*piece_size)/Math.max(stacks-1,1),piece_size);
		var geometryW=piecegeometry("white");
		var geometryB=piecegeometry("black");
		var capGeometryW = capgeometry("white");
		var capGeometryB = capgeometry("black");
		materials.updatePieceMaterials();
		var old_size = this.piece_objects[0].geometry.parameters.width;

		// for all pieces...
		for(i = 0;i < this.piece_objects.length;i++){
			var piece=this.piece_objects[i];
			if(piece.iscapstone){
				var grow=capstone_height-piece.geometry.parameters.height;
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
				// if standing, reset and reapply orientation.
				if(piece.isstanding){
					piece.rotation.set(0,0,0);
					piece.updateMatrix();
					piece.position.y -= old_size / 2 - piece_height / 2;
					piece.isstanding = false;
					this.standup(piece);
				}

				// reapply geometry.
				if(piece.iswhitepiece){
					piece.geometry = geometryW;
				}
				else{
					piece.geometry = geometryB;
				}
				piece.updateMatrix();
			}
			if(!piece.onsquare){
				if(piece.iscapstone){
					if(piece.iswhitepiece){
						piece.position.set(
							board.corner_position.endx + capstone_radius + stackOffsetFromBorder,
							capstone_height/2-sq_height/2,
							board.corner_position.z + capstone_radius + piece.pieceNum*(stack_dist+capstone_radius*2)
						);
					}
					else{
						piece.position.set(
							board.corner_position.x - capstone_radius - stackOffsetFromBorder,
							capstone_height/2-sq_height/2,
							board.corner_position.endz - capstone_radius - piece.pieceNum*(stack_dist+capstone_radius*2)
						);
					}
				}
				else{
					var stackno = Math.floor(piece.pieceNum / 10);
					var stackheight = piece.pieceNum % 10;
					if(piece.iswhitepiece){
						piece.position.set(
							board.corner_position.endx + stackOffsetFromBorder + piece_size/2,
							stackheight*piece_height+piece_height/2-sq_height/2,
							board.corner_position.endz - piece_size/2 - stackno*(stack_dist+piece_size)
						);
					}
					else{
						piece.position.set(
							board.corner_position.x - stackOffsetFromBorder - piece_size/2,
							stackheight*piece_height+piece_height/2-sq_height/2,
							board.corner_position.z + piece_size/2 + stackno*(stack_dist+piece_size)
						);
					}
				}
			}
		}
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
	incmovecnt: function(){
		this.save_board_pos();
		incrementMoveCounter();
	},
	// We save an array that contains a description of the pieces in each cell.
	// Each piece is either a:	p=flatstone, c=capstone, w=wall
	// Uppercase is a whitepiece, Lowercase is a blackpiece
	save_board_pos: function(){
		var bp = [];
		//for all squares, convert stack info to board position info
		for(var i=0;i<gameData.size;i++){
			for(var j=0;j<gameData.size;j++){
				var bp_sq = [];
				var stk = this.sq[i][j];
				for(var s=0;s<stk.length;s++){
					var pc = stk[s];
					var c = 'p';
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
		var pos = this.board_history[moveNum - gameData.move_start];
		if(pos === 'undefined'){
			console.warn("no board position found for moveNum " + moveNum);
			return;
		}

		// scan through each cell in the pos array
		for(var i=0;i<gameData.size;i++){//file
			for(var j=0;j<gameData.size;j++){//rank
				var sq = this.get_board_obj(i,j);
				var sqpos = pos[i*gameData.size + j];
				// sqpos describes a stack of pieces in that square
				// scan through those pieces
				for(var s=0;s<sqpos.length;s++){
					var pc = sqpos[s];
					var iscap = (pc==='c' || pc==='C');
					var iswall = (pc==='w' || pc==='W');
					var iswhite = (pc===pc.charAt(0).toUpperCase());

					// get an available piece
					var pc = this.getfromstack(iscap,iswhite);
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
		var intersects = raycaster.intersectObjects(scene.children);
		var a;
		for(a=0;a<intersects.length;a++){
			var potential=intersects[a].object;
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
		var pick=this.mousepick();
		this.remove_total_highlight();
		if(!checkIfMyMove()){
			return;
		}
		if(pick[0]=="board"){
			var destinationstack = this.get_stack(pick[1]);
			if(this.selected){
				if(destinationstack.length==0){
					var sel=this.selected;
					this.unselect();
					var hlt=pick[1];
					this.pushPieceOntoSquare(hlt,sel);
					//check if actually moved
					var stone = 'Piece';
					if(sel.iscapstone){stone = 'Cap';}
					else if(sel.isstanding){stone = 'Wall';}

					console.log(
						"Place " + gameData.move_count,
						sel.iswhitepiece ? 'White' : 'Black',
						stone,
						this.squarename(hlt.file,hlt.rank)
					);
					this.highlightLastMove_sq(hlt);
					this.lastMovedSquareList.push(hlt);

					var sqname = this.squarename(hlt.file,hlt.rank);
					var msg = "P " + sqname;
					if(stone !== 'Piece'){msg += " " + stone.charAt(0);}
					sendMove(msg);
					this.notatePmove(sqname,stone.charAt(0));

					var pcs;
					if(gameData.my_color === "white"){
						this.whitepiecesleft--;
						pcs = this.whitepiecesleft;
					}
					else{
						this.blackpiecesleft--;
						pcs = this.blackpiecesleft;
					}
					if(gameData.is_scratch){
						var over = this.checkroadwin();
						if(!over){
							over = this.checksquaresover();
							if(!over && pcs <= 0){
								this.findwhowon();
								gameOver();
							}
						}
					}
					this.incmovecnt();
				}
			}
			// Left click move stack
			else if(this.selectedStack){
				var tp = this.top_of_stack(pick[1]);
				if(tp && (tp.iscapstone || (tp.isstanding && !this.selectedStack[this.selectedStack.length - 1].iscapstone))){
					console.log('selected stack?');
				}
				else{
					var prev = this.move.squares[this.move.squares.length - 1];
					var rel = this.sqrel(prev,pick[1]);
					var goodmove=false;
					if(this.move.dir === 'U' && rel !== 'OUTSIDE'){
						goodmove=true;
					}
					else if(this.move.dir === rel || rel === 'O'){
						goodmove=true;
					}
					if(goodmove){
						var obj = this.selectedStack.pop();
						this.pushPieceOntoSquare(pick[1],obj);
						this.move_stack_over(pick[1],this.selectedStack);
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
				if(gameData.move_count >= 2 && !gameData.is_game_end){
					var stk = this.get_stack(pick[1]);
					if(this.is_top_mine(pick[1]) && stk.length > 0){
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
					this.rotate(pick[1]);
				}
				else{
					this.unselect(pick[1]);
				}
			}
			else if(this.selectedStack){
				this.showmove(gameData.move_shown,true);

			}
			else{
				if(!gameData.is_game_end){
					// these must match to pick up this obj
					if(pick[1].iswhitepiece === isWhitePieceToMove()){
					//no capstone move on 1st moves
						if(gameData.move_count<2 && pick[1].iscapstone){

						}
						else{
							this.select(pick[1]);
						}
					}
				}
			}
		}
		else if(pick[0]=="none"){
			if(this.selected){
				this.showmove(gameData.move_shown,true);
			}
			else if(this.selectedStack){
				this.showmove(gameData.move_shown,true);
			}
			else{

			}
		}
	},
	mousemove: function(){
		var pick=this.mousepick();
		if(pick[0]=="board" && this.selectedStack){
			var tp = this.top_of_stack(pick[1]);
			if(tp && (tp.iscapstone || (tp.isstanding && !this.selectedStack[this.selectedStack.length - 1].iscapstone))){
				this.unhighlight_sq();
			}
			else{
				var prev = this.move.squares[this.move.squares.length - 1];
				var rel = this.sqrel(prev,pick[1]);
				var goodmove=false;
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
			var destinationstack = this.get_stack(pick[1]);
			if(destinationstack.length==0){
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
		for(i = this.piece_objects.length-1;i >= 0;i--){
			var obj = this.piece_objects[i];
			// not on a square, and matches color, and matches type
			if(!obj.onsquare &&
					(obj.iswhitepiece === iswhite) &&
					(cap === obj.iscapstone)){
				return obj;
			}
		}
		return null;
	},
	//move the server sends
	serverPmove: function(file,rank,caporwall){
		var oldpos = -1;
		if(gameData.move_shown!=gameData.move_count){
			oldpos = gameData.move_shown;
		}

		dontanimate = true;
		fastforward();
		var obj = this.getfromstack((caporwall === 'C'),isWhitePieceToMove());

		if(!obj){
			console.warn("something is wrong");
			return;
		}

		if(caporwall === 'W'){
			this.standup(obj);
		}

		var hlt = this.get_board_obj(file.charCodeAt(0) - 'A'.charCodeAt(0),rank - 1);
		this.pushPieceOntoSquare(hlt,obj);
		this.highlightLastMove_sq(hlt);
		this.lastMovedSquareList.push(hlt);

		this.notatePmove(file + rank,caporwall);
		this.incmovecnt();

		if(oldpos !== -1){board.showmove(oldpos);}
		dontanimate = false;
	},
	//Move move the server sends
	serverMmove: function(f1,r1,f2,r2,nums){
		var oldpos = -1;
		if(gameData.move_shown != gameData.move_count){
			oldpos = gameData.move_shown;
		}

		dontanimate = true;
		fastforward();
		var s1 = this.get_board_obj(f1.charCodeAt(0) - 'A'.charCodeAt(0),r1 - 1);
		var fi = 0,ri = 0;
		if(f1 === f2){ri = r2 > r1 ? 1 : -1;}
		if(r1 === r2){fi = f2 > f1 ? 1 : -1;}

		var tot = 0;
		for(i = 0;i < nums.length;i++){tot += nums[i];}

		var tstk = [];
		var stk = this.get_stack(s1);
		for(i = 0;i < tot;i++){
			tstk.push(stk.pop());
		}
		for(i = 0;i < nums.length;i++){
			var sq = this.get_board_obj(s1.file + (i + 1) * fi,s1.rank + (i + 1) * ri);
			for(j = 0;j < nums[i];j++){
				this.pushPieceOntoSquare(sq,tstk.pop());
				this.highlightLastMove_sq(sq);
				this.lastMovedSquareList.push(sq);
			}
		}
		this.calculateMoveNotation(
			f1.charCodeAt(0) - 'A'.charCodeAt(0),
			Number(r1) - 1,
			f2.charCodeAt(0) - 'A'.charCodeAt(0),
			Number(r2) - 1,
			nums
		);
		this.incmovecnt();

		if(oldpos !== -1){board.showmove(oldpos);}
		dontanimate = false;
	},
	flatscore: function(ply){
		var whitec = 0;
		var blackc = 0;
		if(!(ply>=0)){
			ply=this.board_history.length-1;
		}
		var position=this.board_history[ply];
		if(!position){
			return [0,0];
		}
		for(i = 0;i < gameData.size*gameData.size;i++){
			if(position[i].length>0){
				var toppiece=position[i][position[i].length-1];
				whitec+=toppiece=="P";
				blackc+=toppiece=="p";
			}
		}
		return [whitec,blackc];
	},
	findwhowon: function(){
		var whitec = 0;
		var blackc = gameData.komi/2;
		for(i = 0;i < gameData.size;i++){
			for(j = 0;j < gameData.size;j++){
				var stk = this.sq[i][j];
				if(stk.length === 0){continue;}
				var top = stk[stk.length - 1];
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
		for(var i = 0;i < gameData.size;i++){
			for(var j = 0;j < gameData.size;j++){
				var cur_st = this.sq[i][j];
				cur_st.graph = -1;
				if(cur_st.length === 0){continue;}

				var ctop = cur_st[cur_st.length - 1];
				if(ctop.isstanding && !ctop.iscapstone){continue;}

				cur_st.graph = (i + j * gameData.size).toString();

				if(i - 1 >= 0){
					var left_st = this.sq[i - 1][j];
					if(left_st.length !== 0){
						var ltop = left_st[left_st.length - 1];
						if(!(ltop.isstanding && !ltop.iscapstone)){
							if(ctop.iswhitepiece === ltop.iswhitepiece){
								for(var r = 0;r < gameData.size;r++){
									for(var c = 0;c < gameData.size;c++){
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
					var top_st = this.sq[i][j - 1];
					if(top_st.length !== 0){
						var ttop = top_st[top_st.length - 1];
						if(!(ttop.isstanding && !ttop.iscapstone)){
							if(ctop.iswhitepiece === ttop.iswhitepiece){
								for(var r = 0;r < gameData.size;r++){
									for(var c = 0;c < gameData.size;c++){
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
		var whitewin = false;
		var blackwin = false;
		for(var tr = 0;tr < gameData.size;tr++){
			var tsq = this.sq[tr][0];
			var no = tsq.graph;
			if(no === -1){continue;}
			for(var br = 0;br < gameData.size;br++){
				var brno = this.sq[br][gameData.size - 1].graph;
				if(no === brno){
					if(tsq[tsq.length - 1].iswhitepiece){whitewin = true;}
					else{blackwin = true;}
				}
			}
		}
		for(var tr = 0;tr < gameData.size;tr++){
			var tsq = this.sq[0][tr];
			var no = tsq.graph;
			if(no === -1){continue;}
			for(var br = 0;br < gameData.size;br++){
				var brno = this.sq[gameData.size - 1][br].graph;
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
		for(i = 0;i < gameData.size;i++){
			for(j = 0;j < gameData.size;j++){
				if(this.sq[i][j].length === 0){return false;}
			}
		}

		this.findwhowon();
		this.gameOver("All spaces covered.");
		return true;
	},
	reverseboard: function(){
		if(localStorage.getItem('auto_rotate')!=='false'){
			this.boardside = (this.boardside === "white") ? "black" : "white";
			camera.position.z = -camera.position.z;
			camera.position.x = -camera.position.x;
			controls.center.z=-controls.center.z;
			controls.center.x=-controls.center.x;
		}
	},
	setmovedir: function(){
		var s1 = this.move.start;
		var s2 = this.move.squares[this.move.squares.length - 1];
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
		notate(pos + sqname.toLowerCase());
		storeNotation();
	},
	//all params are nums
	calculateMoveNotation: function(stf,str,endf,endr,nos){
		var dir = '';
		if(stf === endf){dir = (endr < str) ? '-' : '+';}
		else{dir = (endf < stf) ? '<' : '>';}
		var tot = 0;
		var lst = '';
		for(var i = 0;i < nos.length;i++){
			tot += Number(nos[i]);
			lst = lst + (nos[i] + '').trim();
		}
		if(tot === 1){
			var s1 = this.get_board_obj(stf,str);
			if(this.get_stack(s1).length === 0){
				tot = '';
				lst = '';
			}
			else if(tot === Number(lst)){lst = '';}
		}
		else if(tot === Number(lst)){lst = '';}
		var move = tot + this.squarename(stf,str).toLowerCase()
				+ dir + '' + lst;
		notate(move);
		storeNotation();
	},
	generateMove: function(){
		var st = this.squarename(this.move.start.file,this.move.start.rank);
		var end = this.squarename(this.move.end.file,this.move.end.rank);
		var lst = [];
		var prev = null;

		for(i = 0,c = 0;i < this.move.squares.length;i++){
			var obj = this.move.squares[i];
			if(obj === this.move.start){continue;}

			if(obj === prev){lst[c - 1] = lst[c - 1] + 1;}
			else{
				prev = obj;
				lst[c] = 1;
				c++;
			}
		}
		if(st !== end){
			var nos = "";
			for(i = 0;i < lst.length;i++){nos += lst[i] + " ";}
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
			this.highlightLastMove_sq(this.move.end);
			this.lastMovedSquareList.push(this.move.end);
		}
		this.move = { start: null, end: null, dir: 'U', squares: []};
	},
	pushPieceOntoSquare: function(sq,pc){
		var st = this.get_stack(sq);
		var top = this.top_of_stack(sq);
		if(top && top.isstanding && !top.iscapstone && pc.iscapstone){this.rotate(top);}

		pc.position.x = sq.position.x;

		if(pc.isstanding){
			if(pc.iscapstone){pc.position.y = sq_height/2 + capstone_height/2 + piece_height*st.length;}
			else{pc.position.y = sq_height/2 + piece_size/2 + piece_height * st.length;}
		}
		else{pc.position.y = sq_height + st.length * piece_height;}
		pc.position.z = sq.position.z;
		pc.onsquare = sq;
		st.push(pc);
	},
	rotate: function(piece){
		if(piece.iscapstone){return;}
		if(piece.isstanding){this.flatten(piece);}
		else{this.standup(piece);}
	},
	flatten: function(piece){
		if(!piece.isstanding){return;}
		piece.position.y -= piece_size / 2 - piece_height / 2;
		if(diagonal_walls){piece.rotateZ(Math.PI / 4);}
		piece.rotateX(Math.PI / 2);
		piece.isstanding = false;
	},
	standup: function(piece){
		if(piece.isstanding){return;}
		piece.position.y += piece_size / 2 - piece_height / 2;
		piece.rotateX(-Math.PI / 2);
		if(diagonal_walls){piece.rotateZ(-Math.PI / 4);}
		piece.isstanding = true;
	},
	rightclick: function(){
		settingscounter=(settingscounter+1)&15;
		if(this.selected && gameData.move_count>=2){
			this.rotate(this.selected);
		}
		else if(this.selectedStack){
			this.showmove(gameData.move_shown,true);
		}
		else{
			var pick=this.mousepick();
			if(pick[0]=="board"){
				var square=pick[1];
				var stack=this.get_stack(square);
				var i;
				for(i=0;i<scene.children.length;i++){
					var obj=scene.children[i];
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
			for(var i = 0;i < scene.children.length;i++){
				var obj = scene.children[i];
				if(obj.isboard || !obj.onsquare){continue;}
				obj.visible = true;
			}
			this.totalhighlighted = null;
		}
	},
	rightup: function(){
		settingscounter=(settingscounter+1)&15;
		console.log('right up');
		this.remove_total_highlight();
	},
	//bring pieces to original positions,
	resetpieces: function(){
		for(var i = this.piece_objects.length - 1;i >= 0;i--){
			scene.remove(this.piece_objects[i]);
		}

		this.whitepiecesleft = this.tottiles + this.totcaps;
		this.blackpiecesleft = this.tottiles + this.totcaps;

		this.piece_objects = [];
		this.highlighted = null;
		this.selected = null;
		this.selectedStack = null;
		this.move = { start: null, end: null, dir: 'U', squares: []};

		for(var i = 0;i < gameData.size;i++){
			for(var j = 0;j < gameData.size;j++){
				this.sq[i][j].length = 0;
			}
		}
		this.addpieces();
	},
	resetBoardStacks: function(){
		for(var i = 0;i < gameData.size;i++){
			this.sq[i] = [];
			for(var j = 0;j < gameData.size;j++){
				this.sq[i][j] = [];
			}
		}

		this.addboard();
		this.addpieces();
	},
	showmove: function(no,override){
		if(gameData.move_count <= gameData.move_start || no>gameData.move_count || no<gameData.move_start || (gameData.move_shown === no && !override)){
			return;
		}
		var prevdontanim = dontanimate;
		dontanimate = true;
		console.log('showmove '+no);
		this.unhighlight_sq();
		this.resetpieces();
		this.apply_board_pos(gameData.move_shown);
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
		if(gameData.move_count >= 1){
			this.highlightLastMove_sq(this.lastMovedSquareList.at(-1));
		}
	},
	sqrel: function(sq1,sq2){
		var f1 = sq1.file;
		var r1 = sq1.rank;
		var f2 = sq2.file;
		var r2 = sq2.rank;
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
		obj.position.y += stack_selection_height;
		this.selected = obj;
	},
	unselect: function(){
		if(this.selected){
			this.selected.position.y -= stack_selection_height;
			this.selected = null;
		}
	},
	selectStack: function(stk){
		this.selectedStack = [];
		for(i = 0;stk.length > 0 && i < gameData.size;i++){
			obj = stk.pop();
			obj.position.y += stack_selection_height;
			this.selectedStack.push(obj);
		}
	},
	unselectStackElem: function(obj){
		obj.position.y -= stack_selection_height;
	},
	unselectStack: function(){
		var stk = this.selectedStack.reverse();
		var lastsq = this.move.squares[this.move.squares.length - 1];
		//push unselected stack elems onto last moved square
		for(i = 0;i < stk.length;i++){
			this.unselectStackElem(stk[i]);
			this.pushPieceOntoSquare(lastsq,stk[i]);
			this.move.squares.push(lastsq);
		}
		this.selectedStack = null;
	},
	highlightLastMove_sq: function(sq){
		if(JSON.parse(localStorage.getItem("show_last_move_highlight"))){
			this.lastMoveHighlighterVisible = true;
		}
		if(!this.lastMoveHighlighterVisible){return;}
		this.unHighlightLastMove_sq(this.lastMoveHighlighted);
		this.lastMoveHighlighted = sq;

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

		highlighter.position.x = sq.position.x;
		highlighter.position.y = sq_height / 2;
		highlighter.position.z = sq.position.z;
		scene.add(highlighter);
	},
	unhighlight_sq: function(){
		if(this.highlighted){
			this.highlighted = null;
			scene.remove(highlighter);
		}
	},
	get_stack: function(sq){
		return this.sq[sq.file][sq.rank];
	},
	top_of_stack: function(sq){
		var st = this.get_stack(sq);
		if(st.length === 0){return null;}
		return st[st.length - 1];
	},
	is_top_mine: function(sq){
		var ts = this.top_of_stack(sq);
		if(!ts){return true;}
		if(ts.iswhitepiece && gameData.my_color === "white"){return true;}
		if(!ts.iswhitepiece && gameData.my_color !== "white"){return true;}
		return false;
	},
	move_stack_over: function(sq,stk){
		if(stk.length === 0){return;}
		var top = this.top_of_stack(sq);
		if(!top){top = sq;}

		var ts = stk[stk.length - 1];
		if(ts.onsquare === sq){return;}

		var diffy = ts.position.y - top.position.y;

		for(i = 0;i < stk.length;i++){
			stk[i].position.x = sq.position.x;
			stk[i].position.z = sq.position.z;
			stk[i].position.y += stack_selection_height - diffy;
			stk[i].onsquare = sq;
		}
	},
	loadptn: function(parsed){
		var size = parseInt(parsed.tags.Size,10);
		if(!(size >= 3 && size <= 8)){
			alert('warning','invalid PTN: invalid size');
			return;
		}
		this.clear();
		this.create(size,+parsed.tags.Flats,+parsed.tags.Caps);
		this.initEmpty();

		for(var ply = 0;ply < parsed.moves.length;ply++){
			var move = parsed.moves[ply];
			var match;
			if((match = /^([SFC]?)([a-h])([0-8])$/.exec(move)) !== null){
				var piece = match[1];
				var file = match[2].charCodeAt(0) - 'a'.charCodeAt(0);
				var rank = parseInt(match[3]) - 1;
				var obj = this.getfromstack((piece === 'C'),isWhitePieceToMove());
				if(!obj){
					console.warn("bad PTN: too many pieces");
					return;
				}
				if(piece === 'S'){
					this.standup(obj);
				}
				var hlt = this.get_board_obj(file,rank);
				this.pushPieceOntoSquare(hlt,obj);
			}
			else if((match = /^([1-9]?)([a-h])([0-8])([><+-])(\d*)$/.exec(move)) !== null){
				var count = match[1];
				var file = match[2].charCodeAt(0) - 'a'.charCodeAt(0);
				var rank = parseInt(match[3]) - 1;
				var dir = match[4];
				var drops = match[5];

				if(drops === ''){
					if(count == ''){drops = [1];}
					else{drops = [count];}
				}
				else{
					drops = drops.split('');
				}
				var tot = 0;
				var i,j;
				for(i = 0;i < drops.length;i++){tot += parseInt(drops[i]);}

				var df = 0,dr = 0;
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

				var s1 = this.get_board_obj(file,rank);
				var stk = this.get_stack(s1);
				var tstk = [];

				for(i = 0;i < tot;i++){tstk.push(stk.pop());}

				for(i = 0;i < drops.length;i++){
					var sq = this.get_board_obj(
						s1.file + (i + 1) * df,
						s1.rank + (i + 1) * dr
					);
					for(j = 0;j < parseInt(drops[i]);j++){
						this.pushPieceOntoSquare(sq,tstk.pop());
					}
				}
			}
			else{
				console.warn("unparseable: " + move);
				continue;
			}
			notate(move);
			this.incmovecnt();
		}
		if(parsed.tags.Result !== undefined){
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

		var assumedMoveCount = this.moveCountCalc(moveNumber,moveNumber,playerToMove);

		var infoMsg = "";
		var playMsg = "";

		// We want to make some sense of the moveCount...
		var p1Cnt = this.count_pieces_on_board(WHITE_PLAYER);
		var p2Cnt = this.count_pieces_on_board(BLACK_PLAYER);
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
			var minMoves = this.moveCountCalc(p1Cnt,p2Cnt,playerToMove);
			if(assumedMoveCount < minMoves){
				assumedMoveCount = minMoves;
				infoMsg = "Initializing move number to correpond with the number of pieces on the board.";
			}
			playMsg = "It is " + gameData.my_color + "'s turn to play.";
			initCounters(assumedMoveCount);
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
			this.gameOver('All white pieces used.');
			return;
		}
		if(this.blackpiecesleft <=0){
			gameData.result = "0-F";
			this.gameOver('All black pieces used.');
			return;
		}
		notate("load");

		this.showmove(gameData.move_shown);
		alert('info',infoMsg + " " + playMsg);
	},
	// assumes that the movecount and movestart have been initialized meaningfully
	// and 0,0 is OK
	count_pieces_on_board: function(player){
		var count = 0;
		var pos = this.board_history[gameData.move_count - gameData.move_start];
		for(i=0;i < pos.length;i++){
			var pieces = pos[i];
			// remember, upper case is white(p1) and lower case is black(p2),
			for(s=0;s < pieces.length;s++){
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
		var bp = [];
		for(var i = 0;i < size;i++){
			this.sq[i] = [];
			for(var j = 0;j < size;j++){
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
								console.log('regular flat', cellValues.pieces[k]);
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
	var x = e.clientX - canvas.offsetLeft;
	var y = e.clientY - canvas.offsetTop;
	mouse.x = (pixelratio * x / canvas.width) * 2 - 1;
	mouse.y = -(pixelratio * y / canvas.height) * 2 + 1;

	board.mousemove();
}

function onDocumentMouseDown(e){
	var x = e.clientX - canvas.offsetLeft;
	var y = e.clientY - canvas.offsetTop;
	mouse.x = (pixelratio * x / canvas.width) * 2 - 1;
	mouse.y = -(pixelratio * y / canvas.height) * 2 + 1;

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
}

function onKeyUp(e){
	switch (e.keyCode){
		case 27://ESC
			board.showmove(gameData.move_shown,true);
			break;
		case 38://UP
			stepback();
			break;
		case 40://DOWN
			stepforward();
			break;
	}
}

function removeEventListeners(){
	if(canvas){
		canvas.removeEventListener("mousedown", onDocumentMouseDown, false);
		canvas.removeEventListener("mouseup", onDocumentMouseUp, false);
		canvas.removeEventListener("mousemove", onDocumentMouseMove, false);
		canvas.removeEventListener("contextmenu", function(e){
			e.preventDefault();
		}, false);
	}
	window.removeEventListener("resize", onWindowResize, false);
	window.removeEventListener("keyup", onKeyUp, false);
}

function init3DBoard(){
	canvas = document.getElementById("gamecanvas");

	scene = new THREE.Scene();

	renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: antialiasing_mode });
	renderer.setSize(document.documentElement.clientWidth, document.documentElement.clientHeight);
	pixelratio = (window.devicePixelRatio || 1) * scalelevel;
	renderer.setPixelRatio(pixelratio);
	renderer.setClearColor(clearcolor, 1);
	maxaniso = Math.min(renderer.getMaxAnisotropy() || 1, 16);

	window.addEventListener("resize", onWindowResize, false);
	window.addEventListener("keyup", onKeyUp, false);

	initBoard();
	rendererdone = true;
	var geometry = new THREE.TorusGeometry(sq_size / 2 + 5, 3, 16, 100);
	highlighter = new THREE.Mesh(geometry, materials.highlighter);
	highlighter.rotateX(Math.PI / 2);
	lastMoveHighlighter = new THREE.Mesh(geometry, materials.lastMoveHighlighter);
	lastMoveHighlighter.rotateX(Math.PI / 2);
	generateCamera();
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