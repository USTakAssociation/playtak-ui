const default2DThemes = [
	{ id: "aaron", name: "Aaron"},
	{ id: "aer", name: "Aer"},
	{ id: "aether", name: "Aether"},
	{ id: "aqua", name: "Aqua"},
	{ id: "atlas", name: "Atlas"},
	{ id: "backlit", name: "Backlit"},
	{ id: "bubbletron", name: "BubbleTron"},
	{ id: "classic", name: "Classic"},
	{ id: "discord", name: "Discord"},
	{ id: "essence", name: "Essence"},
	{ id: "fresh", name: "Fresh"},
	{ id: "ignis", name: "Ignis"},
	{ id: "luna", name: "Luna"},
	{ id: "paper", name: "Paper"},
	{ id: "retro", name: "Retro"},
	{ id: "stealth", name: "Stealth"},
	{ id: "terra", name: "Terra"},
	{ id: "zen", name: "Zen"}
];

// sound controls
function turnsoundon(){
	var movesound = document.getElementById("move-sound");
	var chimesound = document.getElementById("chime-sound");
	var hurrysound = document.getElementById("hurry-sound");
	movesound.muted = false;
	chimesound.muted = false;
	hurrysound.muted = false;
	movesound.currentTime=0;
	movesound.play();
	localStorage.setItem('sound','true');
	document.getElementById("soundoff").style.display="none";
	document.getElementById("soundon").style.display="inline-block";
}

function turnsoundoff(){
	var movesound = document.getElementById("move-sound");
	var chimesound = document.getElementById("chime-sound");
	var hurrysound = document.getElementById("hurry-sound");
	movesound.muted = true;
	chimesound.muted = true;
	hurrysound.muted = true;
	localStorage.setItem('sound','false');
	document.getElementById("soundoff").style.display="inline-block";
	document.getElementById("soundon").style.display="none";
}

/*
 * Notify checkbox change for checkbox:
 *	 Disable landing
 */
function disableLanding(){
	if(!document.getElementById('show-landing').checked){
		localStorage.setItem('disable-landing', true);
	}
	else{
		localStorage.removeItem("disable-landing", true);
	}
}

/*
 * Notify checkbox change for checkbox:
 *	 Dark Mode
 */
function checkboxDarkMode(){
	var body = document.body;
	// Handle switching from light to dark
	if(document.getElementById('dark-mode').checked){
		localStorage.setItem('theme','dark-theme');
		// Add attribute to body
		body.classList.add('dark-theme');
		if(localStorage.getItem('clearcolor') === '#dddddd'){
			localStorage.removeItem('clearcolor');
			document.getElementById("clearcolorbox").value = boardDefaults.backgroundColor;
			clearcolorchange();
		}
	}
	else{
		// Handle switching from dark to light
		if(localStorage.getItem('clearcolor') === boardDefaults.backgroundColor){
			localStorage.removeItem('clearcolor');
			document.getElementById("clearcolorbox").value = '#dddddd';
			clearcolorchange();
		}
		localStorage.setItem('theme','light-theme');
		body.classList.remove('dark-theme');
		body.classList.add('light-theme');
	}
}

/*
 * Notify checkbox change for checkbox:
 *	 Diagonal walls
 */
function checkboxDiagonalWalls(){
	if(document.getElementById('wall-orientation').checked){
		localStorage.setItem('diagonal_walls','true');
		diagonal_walls = true;
	}
	else{
		localStorage.setItem('diagonal_walls','false');
		diagonal_walls = false;
	}
	board.updatepieces();
}

/*
 * Notify slider movement:
 *	 Piece size
 */
function sliderPieceSize(newSize){
	if(parseInt(newSize)!=piece_size){
		localStorage.setItem('piece_size',newSize);
		document.getElementById('piece-size-display').innerHTML=newSize;
		piece_size = parseInt(newSize);
		if(fixedcamera || true){
			generateCamera();
		}
	}
}

/*
 * Notify checkbox change for checkbox:
 *	 Enable or disable animations
 */
function toggleAnimations(event){
	var enabled = event.target.checked;
	localStorage.setItem('animations_enabled', enabled ? 'true' : 'false');
	animationsEnabled = enabled;
}

/*
 * Update animation speed
 */
function updateAnimationSpeed(value){
	var speed = parseFloat(value);
	animationSpeed = speed;
	localStorage.setItem('animation_speed', speed.toString());
	document.getElementById('animation-speed-value').textContent = speed.toFixed(1) + 'x';
}

/*
 * Notify checkbox change for checkbox:
 *	 Enable or disable shadows
 */
function toggleShadows(event){
	var enabled = event.target.checked;
	localStorage.setItem('shadows_enabled', enabled ? 'true' : 'false');
	shadowsEnabled = enabled;
	updateShadowsVisibility();
}

/*
 * Notify checkbox change for checkbox:
 *	 Show or hide table
 */
function showTable(event){
	localStorage.setItem('show_table', event.target.checked);
	board.table.visible = event.target.checked;
	if(board.shadowPlane){
		board.shadowPlane.visible = !event.target.checked;
	}
}

/*
 * Notify checkbox change for checkbox:
 *	 Show or hide last move highlighter
 */
function showLastMoveHighlighter(event){
	localStorage.setItem("show_last_move_highlight", event.target.checked);
	board.lastMoveHighlighterVisible = event.target.checked;
	if(!event.target.checked){
		board.unHighlightLastMove_sq();
	}
	else{
		// Re-highlight the last moved square when turning on
		if(board.lastMovedSquareList.length > 0){
			board.highlightLastMove_sq(board.lastMovedSquareList.at(-1));
		}
	}
}

function perspectiveChange(newPerspective){
	if(perspective != +newPerspective){
		localStorage.setItem('perspective',newPerspective);
		document.getElementById('perspective-display').innerHTML=newPerspective;
		perspective = +newPerspective;
		generateCamera();
	}
}

document.getElementById("piecetexture").onchange=gotnewtexturefile;
function gotnewtexturefile(){
	var reader = new FileReader();
	let fileName;
	if(this.files.length){
		fileName = this.files[0].name;
		const regex = /\s/;
		// ensure the filename has no spaces
		if(regex.test(fileName)){
			alert('danger', 'File name cannot contain spaces, please rename the file and try again');
			return;
		}
		reader.addEventListener("load",fileLoaded,false);
		reader.readAsDataURL(this.files[0]);
	}
	function fileLoaded(){
		// split on the last .{ext} to ge the name
		const name = fileName.replace(/\.[^/.]+$/, "");
		const uploadPieces = JSON.parse(localStorage['customPieces'] || '[]');
		if(uploadPieces.includes(name)){
			alert('warning', 'File has already been uploaded, please delete it from the list first');
			return;
		}
		uploadPieces.push(name);
		appendCustomPieceStyle(name, name, reader.result);
		localStorage.setItem('customPieces', JSON.stringify(uploadPieces));
		localStorage.setItem(name, reader.result);
	}
}

/*
 * Notify radio button check:
 *	 Board style - black
 */
function radioBoardStyleBlack(styleName){
	document.getElementById('board-style-black-' + styleName).checked = true;
	materials.black_sqr_style_name = styleName;
	localStorage.setItem('board_style_black2',styleName);
	board.updateboard();
	settingscounter=(settingscounter+1)&15;
}

/*
 * Notify radio button check:
 *	 Board style - white
 */
function radioBoardStyleWhite(styleName){
	document.getElementById('board-style-white-' + styleName).checked = true;
	materials.white_sqr_style_name = styleName;
	localStorage.setItem('board_style_white2',styleName);
	board.updateboard();
	settingscounter=(settingscounter+1)&15;
}

/*
 * Notify checkbox change for checkbox:
 *	 Antialiasing
 */
function checkboxAntialiasing(){
	if(document.getElementById('antialiasing-checkbox').checked){
		localStorage.setItem('antialiasing_mode','true');
	}
	else{
		localStorage.setItem('antialiasing_mode','false');
	}
}

/*
*
*/
function notifyBorderColorChange(){
	var val = document.getElementById("borderColor").value;
	if(val && val.length < 7){return;}
	localStorage["borderColor"] = val;
	board.updateBorderColor(val);
	removeBorderTexture();
	document.getElementById("border-texture").value = '';
}

// Border texture change
/* document.getElementById("border-texture").onchange = setBorderTexture;
function setBorderTexture(){
	if(this.files[0].size > 2097152){
		alert("danger", "File is too big! must be less than 2MB");
		this.value = "";
		return;
	}
	var reader = new FileReader();
	if(this.files.length){
		reader.addEventListener("load",fileLoaded,false);
		reader.readAsDataURL(this.files[0]);
	}
	function fileLoaded(){
		localStorage.borderTexture=reader.result||0;
		board.updateBorderTexture(localStorage.borderTexture);
	}
	// update the state to hide the upload and show the button
	document.getElementById('border-texture-form').style.display = "none";
	document.getElementById('remove-border-texture').style.display = "inline-block";
}

function removeBorderTexture(){
	if(!localStorage.getItem('borderTexture')){
		return;
	}
	document.getElementById("border-texture").value = '';
	// update the settings state to hide the button and show the upload
	localStorage.removeItem('borderTexture');
	board.removeBorderTexture();
	document.getElementById('border-texture-form').style.display = "block";
	document.getElementById('remove-border-texture').style.display = "none";
} */

/*
*
*/
function notifyBorderSizeChange(value){
	document.getElementById("border-size-display").innerHTML = value;
	localStorage["borderColor"] = value;
	board.updateBorderSize(value);
}

/*
 * Notify checkbox change for checkbox:
 *	 Show or hide border text
 */
function hideBorderText(event){
	localStorage.setItem('hideBorderText', event.target.checked);
	board.updateLetterVisibility(!event.target.checked);
}

function notifyLetterColorChange(){
	var val = document.getElementById("letterColor").value;
	localStorage["letterColor"] = val;
	board.updateLetterColor(val);
}

document.getElementById("board-overlay").onchange = setNewOverlay;
function setNewOverlay(){
	if(this.files[0].size > 2097152){
		console.warn('overlay too big');
		alert('danger', "File is too big! Must be less than 2MB");
		this.value = "";
		return;
	}
	var reader = new FileReader();
	if(this.files.length){
		reader.addEventListener("load",fileLoaded,false);
		reader.readAsDataURL(this.files[0]);
	}
	function fileLoaded(){
		localStorage.boardOverlay=reader.result||0;
		board.addOverlay(localStorage.boardOverlay);
	}
	// update the state to hide the upload and show the button
	document.getElementById('board-overlay-form').style.display = "none";
	document.getElementById('remove-overlay').style.display = "inline-block";
}

function removeOverlay(){
	// update the settings state to hide the button and show the upload
	document.getElementById("board-overlay").value = '';
	localStorage.removeItem('boardOverlay');
	localStorage.setItem('boardOverlayId', 'none');
	board.removeOverlay();
	document.getElementById('board-overlay-form').style.display = "block";
	document.getElementById('remove-overlay').style.display = "none";
	// Reset overlay selector UI to None
	const overlaySelect = document.getElementById('overlay_select');
	if(overlaySelect){overlaySelect.innerText = 'None';}
	const options = document.getElementById("overlay_options");
	if(options){
		for(let i = 0; i < options.children.length; i++){
			const element = options.children[i].querySelector("button");
			if(element){element.classList.remove("active");}
		}
	}
	const noneOverlay = document.getElementById('none_overlay');
	if(noneOverlay){noneOverlay.classList.add('active');}
}

/*
 * Notify checkbox change for checkbox:
*/
function addBoardOverlay(event){
	board.addOverlay();
}

function checkboxFixCamera(){
	if(document.getElementById('fix-camera-checkbox').checked){
		localStorage.setItem('fixedcamera','true');
		fixedcamera=true;
	}
	else{
		localStorage.setItem('fixedcamera','false');
		fixedcamera=false;
	}
	generateCamera();
}

function checkboxClick(){
	if(document.getElementById('click-checkbox').checked){
		localStorage.setItem('clickthrough','true');
		clickthrough=true;
	}
	else{
		localStorage.setItem('clickthrough','false');
		clickthrough=false;
	}
}

function checkboxHover(){
	if(document.getElementById('hover-checkbox').checked){
		localStorage.setItem('hovertext','true');
		hovertext=true;
		$('[data-toggle="tooltip"]').tooltip({
			container: 'body',
			trigger: 'hover'
		});
	}
	else{
		localStorage.setItem('hovertext','false');
		hovertext=false;
		$('[data-toggle="tooltip"]').tooltip('dispose');
	}
}

function clearcolorchange(value){
	if(value && value.length < 7){return;}
	var val = document.getElementById("clearcolorbox").value;
	localStorage["clearcolor"] = val;
	clearcolor = parseInt(val.replace('#', '0x'));
	if(renderer){
		renderer.setClearColor(clearcolor,1);
		settingscounter=(settingscounter+1)&15;
	}
}

/*
 * Notify checkbox change for checkbox:
 *	 Hide 'Send' button
 */
function checkboxHideSend(){
	if(document.getElementById('hide-send-checkbox').checked){
		localStorage.setItem('hide-send','true');
		document.getElementById('send-button').style.display = "none";
	}
	else{
		localStorage.setItem('hide-send','false');
		document.getElementById('send-button').style.display = "initial";
	}
}

/*
 * Notify checkbox change for checkbox:
 *	 Rotate board when player 2
 */
function checkboxAutoRotate(){
	if(document.getElementById('auto-rotate-checkbox').checked){
		localStorage.setItem('auto_rotate','true');
	}
	else{
		localStorage.setItem('auto_rotate','false');
	}
}

function sliderChatSize(newSize){
	if(newSize!=localStorage['chat_size']){
		chathandler.adjustChatWidth(+newSize);
		localStorage.setItem('chat_size',newSize);
		adjustBoardWidth();
	}
}

function sliderAniso(anisoin,lazy){
	if(!lazy || localStorage['aniso']!=anisoin){
		anisolevel=[1,4,8,16][anisoin];
		localStorage['aniso']=anisoin;
		$('#aniso-display').html(["Off","4x","8x","16x"][anisoin]);
		$('#aniso-slider').val(anisoin);
		materials.updateBoardMaterials();
		materials.updatePieceMaterials();
	}
}

function sliderScale(scaleIn,lazy){
	if(!lazy || localStorage['scale']!=scaleIn){
		scalelevel = [0.5,Math.SQRT1_2,1,Math.SQRT2,2][scaleIn];
		localStorage['scale'] = scaleIn;
		$('#scale-display').html(["0.5","0.7","1.0","1.4","2.0"][scaleIn]);
		$('#scale-slider').val(scaleIn);
		onWindowResize();
	}
}

function toggle2DBoard(){
	removeBoardMessageHandler();
	removeEventListeners();
	if(document.getElementById('2d-board-checkbox').checked){
		localStorage.setItem('2d_board','true');
		is2DBoard = true;
		// hide the 3d board and show the 2d board
		document.getElementById("gamecanvas").style.display = "none";
		document.getElementById("ninja-wrapper").style.display = "block";
		document.getElementById("3d-settings").style.display = "none";
		document.getElementById('2d-settings').style.display = "block";
		load2DSettings();
		init2DBoard();
		set2DBoard(`[Size "${gameData.size}"][Komi "${gameData.komi}"][Flats "${gameData.pieces}"][Caps "${gameData.capstones}"]`);
	}
	else{
		document.getElementById('2d-settings').style.display = "none";
		document.getElementById("3d-settings").style.display = "flex";
		localStorage.setItem('2d_board','false');
		is2DBoard = false;
		document.getElementById("ninja-wrapper").style.display = "none";
		document.getElementById("gamecanvas").style.display = "block";
		makeStyleSelector();
		load3DSettings();
		init3DBoard();
		setTimeout(() => {
			dontanimate = true;
			animate();
			dontanimate = false;
		}, 500);
	}
	if(localStorage.getItem("currentGame")){
		setTimeout(() => {
			loadCurrentGameState();
		}, 400);
	}
}

function set2DTheme(theme){
	set2DUI({theme});
	const options = document.getElementById("2d-theme-options");
	for(let i = 0; i < options.children.length; i++){
		const element = options.children[i].querySelector("button");
		if(element){
			element.classList.remove("active");
		}
	}
	const themeObject = default2DThemes.find(t => t.id === theme);
	if(!themeObject){
		alert('danger', 'Theme not found: ' + theme);
	}
	document.getElementById('set-2d-theme').innerText = themeObject.name;
	document.getElementById(theme).classList.add('active');
	localStorage.setItem('2d-theme', theme);
	localStorage.removeItem('2d-custom-theme');
}

function set2DCustomTheme(){
	const customTheme = document.getElementById('2d-custom-theme').value;
	if(!customTheme || customTheme.length < 10){
		alert('danger', 'Custom theme must be a valid JSON object with at least 10 characters');
		return;
	}
	const options = document.getElementById("2d-theme-options");
	for(let i = 0; i < options.children.length; i++){
		const element = options.children[i].querySelector("button");
		if(element){
			element.classList.remove("active");
		}
	}
	localStorage.removeItem('2d-theme');
	// clear the active on the default themes
	document.getElementById('set-2d-theme').innerText = 'Custom Theme Set';
	localStorage.setItem('2d-custom-theme', customTheme);
	set2DUI({theme: JSON.parse(customTheme)});
}

function toggle2DBoard3D(){
	localStorage.setItem('2d-board-3d', document.getElementById('2d-3d-toggle').checked);
	set2DUI({
		board3D: document.getElementById('2d-3d-toggle').checked
	});
	const options = document.getElementById('2d-board-3d-options');
	if(document.getElementById('2d-3d-toggle').checked){
		options.style.display = 'flex';
	}
	else{
		options.style.display = 'none';
	}
}

function toggle2DOrtho(){
	const value = document.getElementById('2d-ortho').checked;
	localStorage.setItem('2d-ortho', value);
	set2DUI({ orthographic: value});
}

function perspective2DChange(value){
	document.getElementById('2d-perspective-display').innerText = value;
	localStorage.setItem('2d-perspective', value);
	set2DUI({ perspective: value });
}

function toggle2DAnimations(){
	const checked = document.getElementById('2d-animations-toggle').checked;
	localStorage.setItem('2d-animations', checked);
	set2DUI({
		animateBoard: checked
	});
}

function toggle2DAxis(){
	const checked = document.getElementById('2d-axis-toggle').checked;
	localStorage.setItem('2d-axis', checked);
	set2DUI({
		axisLabels: checked
	});
}

function toggle2DAxisSmall(){
	const checked = document.getElementById('2d-axis-small-toggle').checked;
	localStorage.setItem('2d-axis-small', checked);
	set2DUI({
		axisLabelsSmall: checked
	});
}

function toggle2DHighlightSquare(){
	const checked = document.getElementById('2d-highlight-toggle').checked;
	localStorage.setItem('2d-last-move-highlight', checked);
	set2DUI({
		highlightSquares: checked
	});
}

function generate2DThemes(themes){
	const optionsElement = document.getElementById("2d-theme-options");
	optionsElement.innerHTML = '';
	for(let i = 0; i < themes.length; i++){
		const li = document.createElement("li");
		const button = document.createElement("button");
		button.classList.add("btn", "btn-transparent", "dropdown-item");
		button.id = themes[i].id;
		button.innerText = themes[i].name;
		button.setAttribute("onclick", `set2DTheme('${themes[i].id}'); event.preventDefault();`);
		li.appendChild(button);
		optionsElement.appendChild(li);
	}
}

function load2DSettings(){
	// get available themes
	generate2DThemes(default2DThemes);
	if(localStorage.getItem("2d-custom-theme")){
		// set the custom value
		document.getElementById('set-2d-theme').innerText = 'Custom Theme Set';
		// find theme in default themes array
		document.getElementById('2d-custom-theme').value = localStorage.getItem("2d-custom-theme");
		set2DUI({theme: JSON.parse(localStorage.getItem("2d-custom-theme"))});
	}
	else if(localStorage.getItem('2d-theme')){
		let theme = default2DThemes.find(t => t.id === localStorage.getItem("2d-custom-theme"));
		if(!theme){
			// if not found, set to default theme
			theme = default2DThemes[7];
		}
		document.getElementById('set-2d-theme').innerText = theme.name;
		set2DTheme(localStorage.getItem('2d-theme'));
	}

	if(localStorage.getItem('2d-board-3d')){
		const value = localStorage.getItem('2d-board-3d') === 'true' ? true : false;
		document.getElementById('2d-3d-toggle').checked = value;
		set2DUI({
			board3D: value
		});
		const options = document.getElementById('2d-board-3d-options');
		if(value){
			options.style.display = 'flex';
		}
		else{
			options.style.display = 'none';
		}
	}

	if(localStorage.getItem('2d-ortho')){
		const value = localStorage.getItem('2d-ortho') === 'true' ? true : false;
		document.getElementById('2d-ortho').checked = value;
		set2DUI({
			orthographic: value
		});
	}

	if(localStorage.getItem('2d-perspective')){
		document.getElementById("2d-perspective-slider").value = localStorage.getItem('2d-perspective');
		document.getElementById('2d-perspective-display').innerText = localStorage.getItem('2d-perspective');
		set2DUI({ perspective: localStorage.getItem('2d-perspective') });
	}

	if(localStorage.getItem('2d-animations')){
		const value = localStorage.getItem('2d-animations') === 'true' ? true : false;
		document.getElementById('2d-animations-toggle').checked = value;
		set2DUI({ animateBoard: value });
	}

	if(localStorage.getItem('2d-axis')){
		const value = localStorage.getItem('2d-axis') === 'true' ? true : false;
		document.getElementById('2d-axis-toggle').checked = value;
		set2DUI({ axisLabels: value });
	}

	if(localStorage.getItem('2d-axis-small')){
		const value = localStorage.getItem('2d-axis-small') === 'true' ? true : false;
		document.getElementById('2d-axis-small-toggle').checked = value;
		set2DUI({ axisLabelsSmall: value });
	}

	if(localStorage.getItem('2d-last-move-highlight')){
		const value = localStorage.getItem('2d-last-move-highlight') === 'true' ? true : false;
		document.getElementById('2d-highlight-toggle').checked = value;
		set2DUI({ highlightSquares: value });
	}
}

/*
 * Settings loaded on initialization. Try to keep them in the order of the window.
 * First the left-hand div, then the right-hand div.
 */
function load3DSettings(){
	if(!is2DBoard){
		// load animations setting
		if(localStorage.getItem("animations_enabled") !== null){
			animationsEnabled = localStorage.getItem("animations_enabled") === 'true';
			document.getElementById("animations-checkbox").checked = animationsEnabled;
		}
		// load animation speed setting
		if(localStorage.getItem("animation_speed") !== null){
			var speed = parseFloat(localStorage.getItem("animation_speed"));
			animationSpeed = speed;
			document.getElementById("animation-speed-slider").value = speed;
			document.getElementById("animation-speed-value").textContent = speed.toFixed(1) + 'x';
		}
		// load shadows setting
		if(localStorage.getItem("shadows_enabled") !== null){
			shadowsEnabled = localStorage.getItem("shadows_enabled") === 'true';
			document.getElementById("shadows-checkbox").checked = shadowsEnabled;
		}
		// load background color setting
		document.getElementById("clearcolorbox").value = localStorage["clearcolor"] || "#dddddd";
		clearcolorchange();
		// diagonal walls
		if(localStorage.getItem("diagonal_walls") !== "false"){
			document.getElementById("wall-orientation").checked = true;
			diagonal_walls = true;
		}
		// load piece size setting
		if(localStorage.getItem("piece_size") !== null){
			piece_size = parseInt(localStorage.getItem("piece_size"));
			document.getElementById("piece-size-display").innerHTML = piece_size;
			document.getElementById("piece-size-slider").value = piece_size;
		}
		// show table - default to hidden
		show_table = localStorage.getItem("show_table") === 'true';
		let storedTheme =
			localStorage.getItem("theme") ||
			(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark-theme" : null);
		if(localStorage.getItem("show_table") === null && ismobile && storedTheme === "dark-theme"){
			show_table = true;
			localStorage.setItem("show_table", true);
		}
		document.getElementById("show-table").checked = show_table;
		// Apply table visibility setting
		if(board && board.table){
			board.table.visible = show_table;
			if(board.shadowPlane){
				board.shadowPlane.visible = !show_table;
			}
		}
		// show last move highlighter
		if(localStorage.getItem("show_last_move_highlight") === null){
			showLastMove = true;
			document.getElementById("show-last-move").checked = true;
		}
		else{
			showLastMove = JSON.parse(localStorage.getItem("show_last_move_highlight"));
			document.getElementById("show-last-move").checked = showLastMove;
		}
		board.lastMoveHighlighterVisible = showLastMove;
		// load white piece style setting
		if(localStorage.getItem("piece_style_white3") !== null){
			const styleName = localStorage.getItem("piece_style_white3");
			// not default white coral
			if(styleName !== materials.white_piece_style_name && piecesMap[styleName]){
				materials.white_piece_style_name = styleName;
				materials.white_cap_style_name = styleName;
				document.getElementById(`white_${piecesMap[localStorage['piece_style_white3']].id}_piece`).classList.add('active');
				document.getElementById(`white_piece_select`).innerText = piecesMap[localStorage['piece_style_white3']].name;
			}
			else{
				document.getElementById(`white_${materials.white_piece_style_name}_piece`).classList.add('active');
				document.getElementById(`white_piece_select`).innerText = piecesMap[materials.white_piece_style_name].name;
			}
		}
		else{
			// Set default from boardDefaults
			document.getElementById(`white_${materials.white_piece_style_name}_piece`)?.classList.add('active');
			document.getElementById(`white_piece_select`).innerText = piecesMap[materials.white_piece_style_name]?.name || 'White by Archvenison';
		}
		// load black piece style setting
		if(localStorage.getItem("piece_style_black3") !== null){
			const styleName = localStorage.getItem("piece_style_black3");
			if(styleName !== materials.white_piece_style_name && piecesMap[styleName]){
				materials.black_piece_style_name = styleName;
				materials.black_cap_style_name = styleName;
				document.getElementById(`black_${piecesMap[localStorage['piece_style_black3']].id}_piece`).classList.add('active');
				document.getElementById(`black_piece_select`).innerText = piecesMap[localStorage['piece_style_black3']].name;
			}
			else{
				document.getElementById(`black_${materials.black_piece_style_name}_piece`).classList.add('active');
				document.getElementById(`black_piece_select`).innerText = piecesMap[materials.black_piece_style_name].name;
			}
		}
		else{
			// Set default from boardDefaults
			document.getElementById(`black_${materials.black_piece_style_name}_piece`)?.classList.add('active');
			document.getElementById(`black_piece_select`).innerText = piecesMap[materials.black_piece_style_name]?.name || 'Black by Archvenison';
		}

		// load white board style setting
		if(localStorage.getItem("board_style_white2") !== null){
			let styleName = localStorage.getItem("board_style_white2");
			if(styleName && styleName === 'simple'){
				styleName = 'white-'+ styleName;
			}
			if(styleName !== materials.white_sqr_style_name && squaresMap[styleName]){
				materials.white_sqr_style_name = styleName;
				document.getElementById(`white_${styleName}_square`).classList.add('active');
				document.getElementById(`white_square_select`).innerText = squaresMap[styleName].name;
			}
			else{
				document.getElementById(`white_${materials.white_sqr_style_name}_square`).classList.add('active');
				document.getElementById(`white_square_select`).innerText = squaresMap[materials.white_sqr_style_name].name;
			}
		}
		else{
			// Set default from boardDefaults
			document.getElementById(`white_${materials.white_sqr_style_name}_square`)?.classList.add('active');
			document.getElementById(`white_square_select`).innerText = squaresMap[materials.white_sqr_style_name]?.name || 'Velvet Sand Diamonds';
		}
		// load black board style setting
		if(localStorage.getItem("board_style_black2") !== null){
			let styleName = localStorage.getItem("board_style_black2");
			if(styleName && styleName === 'simple'){
				styleName = 'black-'+ styleName;
			}
			if(styleName !== materials.black_sqr_style_name && squaresMap[styleName]){
				materials.black_sqr_style_name = styleName;
				document.getElementById(`black_${styleName}_square`).classList.add('active');
				document.getElementById(`black_square_select`).innerText = squaresMap[styleName].name;
			}
			else{
				document.getElementById(`black_${materials.black_sqr_style_name}_square`).classList.add('active');
				document.getElementById(`black_square_select`).innerText = squaresMap[materials.black_sqr_style_name].name;
			}
		}
		else{
			// Set default from boardDefaults
			document.getElementById(`black_${materials.black_sqr_style_name}_square`)?.classList.add('active');
			document.getElementById(`black_square_select`).innerText = squaresMap[materials.black_sqr_style_name]?.name || 'Velvet Sand Diamonds';
		}
		// border color setting
		if(localStorage["borderColor"]){
			document.getElementById("borderColor").value = localStorage["borderColor"];
		}
		// load border texture setting
		if(localStorage.getItem("borderTexture")){
			document.getElementById("remove-border-texture").style.display = "inline-block";
			document.getElementById('border-texture-form').style.display = "none";
		}
		//  load border text setting
		if(localStorage.getItem('hideBorderText') === 'true'){
			board.updateLetterVisibility(false);
			document.getElementById('hide-border-text').checked = true;
		}
		// load letter color setting
		var letterColor = localStorage["letterColor"] || boardDefaults.letterColor;
		document.getElementById("letterColor").value = letterColor;
		board.updateLetterColor(letterColor);
		// board overlay setting
		initOverlaySelector();
		// Only show custom overlay remove button if there's a custom overlay (not a preset)
		if(localStorage.getItem("boardOverlay") && !localStorage.getItem("boardOverlayId")){
			document.getElementById("remove-overlay").style.display = "inline-block";
			document.getElementById('board-overlay-form').style.display = "none";
		}
		// auto rotate board when player 2 setting
		if(localStorage.getItem("auto_rotate") !== "false"){
			document.getElementById("auto-rotate-checkbox").checked = true;
		}
		else{
			document.getElementById("auto-rotate-checkbox").checked = false;
		}
		// load antialiasing setting
		if(localStorage.getItem("antialiasing_mode") === "false"){
			document.getElementById("antialiasing-checkbox").checked = false;
			antialiasing_mode = false;
		}
		// anisotropic filtering
		sliderAniso(+localStorage["aniso"] >= 0 ? +localStorage["aniso"] : 3);
		// rendering scale
		sliderScale(+localStorage["scale"] >= 0 ? +localStorage["scale"] : 2);

		// load perspective setting
		perspective = localStorage.getItem("perspective");
		if(!perspective){
			perspective = 80;
		}
		perspective = +perspective;
		document.getElementById("perspective-display").innerHTML = +perspective;
		document.getElementById("perspective-slider").value = perspective;
		// fixed camera
		if(localStorage.getItem("fixedcamera") === "false"){
			fixedcamera = false;
		}
		else if(localStorage.getItem("fixedcamera") === "true"){
			fixedcamera = true;
		}
		document.getElementById("fix-camera-checkbox").checked = fixedcamera;
		// click through
		if(localStorage.getItem("clickthrough") === "false"){
			clickthrough = false;
		}
		document.getElementById("click-checkbox").checked = clickthrough;
	}
}

function loadInterfaceSettings(){
	// load disable landing setting
	if(localStorage.getItem("disable-landing") === "true"){
		document.getElementById("show-landing").checked = false;
	}
	// Load theme setting
	var storedTheme =
		localStorage.getItem("theme") ||
		(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark-theme" : null);
	if(storedTheme === "dark-theme"){
		var body = document.body;
		body.classList.add(storedTheme);
		document.getElementById("dark-mode").checked = true;
		if(!localStorage.getItem("clearcolor")){
			localStorage.setItem("clearcolor", boardDefaults.backgroundColor);
			document.getElementById("clearcolorbox").value = boardDefaults.backgroundColor;
			clearcolorchange();
		}
	}
	// load hide chat timestamp setting
	if(localStorage.getItem("hide-chat-time") === "true"){
		document.getElementById("hide-chat-time").checked = true;
		$(".chattime").each(function(index){
			$(this).addClass("hidden");
		});
	}
	// load chat send button visibility setting
	if(localStorage.getItem("hide-send") === "true"){
		document.getElementById("hide-send-checkbox").checked = true;
		document.getElementById("send-button").style.display = "none";
	}
	// load chat size setting
	chathandler.adjustChatWidth(+localStorage.getItem("chat_size") || 180);
	adjustsidemenu();
	// load hover text setting
	if(localStorage.getItem("hovertext") === "false"){
		hovertext = false;
		$('[data-toggle="tooltip"]').tooltip('dispose');
	}
	else if(localStorage.getItem("hovertext") === "true"){
		hovertext = true;
		$('[data-toggle="tooltip"]').tooltip({
			container: 'body',
			trigger: 'hover'
		});
	}
	else{
		hovertext = !ismobile;
		localStorage.setItem("hovertext", `${!ismobile}`);
	}
	document.getElementById("hover-checkbox").checked = hovertext;
}
