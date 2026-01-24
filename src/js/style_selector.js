const overlaysMap = {
	"aaron": { id: "aaron", name: "Aaron", file: "board_overlay_aaron_181a19.jpg", border: "#181a19", order: 1 },
	"devi": { id: "devi", name: "Devi", file: "board_overlay_devi_intersections_271a18.jpg", border: "#271a18", order: 2 },
	"nok": { id: "nok", name: "Nok", file: "board_overlay_nok.jpg", border: "#692106", order: 3 }
};

const squaresMap = {
	"sand-velvet": { id: "sand-velvet", name: "Velvet Sand", file: 'white_sand-velvet', order: 1 },
	"sand-velvet-diamonds": { id: "sand-velvet-diamonds", name: "Velvet Sand Diamonds", file: 'white_sand-velvet-diamonds', order: 2 },
	"sand-velvet-diamonds2": { id: "sand-velvet-diamonds2", name: "Velvet Sand Cross", file: 'white_sand-velvet-diamonds2', order: 3 },
	"white_ornate": { id: "white_ornate", name: "Ornate Light", file: 'white_ornate', order: 4 },
	"black_ornate": { id: "black_ornate", name: "Ornate Dark", file: 'black_ornate', order: 5 },
	"white-velvet": { id: "white-velvet", name: "White Velvet", file: 'white_white-velvet', order: 6 },
	"blue-velvet": { id: "blue-velvet", name: "Blue Velvet", file: 'black_blue-velvet', order: 7 },
	"black-simple": { id: "black-simple", name: "Orange Simple", file: 'black_simple', order: 8 },
	"white-simple": { id: "white-simple", name: "White Simple", file: 'white_simple', order: 9 },
	"none": { id: "none", name: "None", file: 'white_none', transparent: true, order: 10 }
};

const piecesMap = {
	"white_regal": { id: "white_regal", name: "Regal by Gruppler", multi_file: false, fix_position: true, file: "white_regal", order: 1 },
	"black_regal": { id: "black_regal", name: "Regal by Gruppler", multi_file: false, fix_position: true, file: "black_regal", order: 2 },
	"white_bloom": { id: "white_bloom", name: "Bloom by Gruppler", multi_file: false, fix_position: true, file: "white_bloom", order: 3 },
	"black_bloom": { id: "black_bloom", name: "Bloom by Gruppler", multi_file: false, fix_position: true, file: "black_bloom", order: 4 },
	"white_archvenison": { id: "white_archvenison", name: "White by Archvenison", multi_file: false, fix_position: true, file: "white_archvenison", order: 5 },
	"black_archvenison": { id: "black_archvenison", name: "Black by Archvenison", multi_file: false, fix_position: true, file: "black_archvenison", order: 6 },
	"white_blight": { id: "white_blight", name: "White by Blight", multi_file: false, fix_position: true, file: "white_blight", order: 6 },
	"black_blight": { id: "black_blight", name: "Black by Blight", multi_file: false, fix_position: true, file: "black_blight", order: 7 },
	"blossom_Levi_Huillet": { id: "blossom_Levi_Huillet", name: "Blossom by Levi", multi_file: false, fix_position: true, file: "blossom_Levi_Huillet", order: 7 },
	"hummingbird_Levi_Huillet": { id: "hummingbird_Levi_Huillet", name: "Hummingbird by Levi", multi_file: false, fix_position: true, file: "hummingbird_Levi_Huillet", order: 7 },
	"stained_glass_venat": { id: "stained_glass_venat", name: "Stained Glass by Venat", multi_file: false, fix_position: true, file: "stained_glass_venat", order: 8 },
	"white_coral": { id: "white_coral", name: "White Coral", multi_file: true, fix_position: false, file: "white_coral_pieces", order: 9 },
	"white_simple": { id: "white_simple", name: "Plain White", multi_file: true, fix_position: false, file: "white_simple_pieces", order: 10 },
	"white_marble": { id: "white_marble", name: "White Marble", multi_file: false, fix_position: true, file: "white_marble", order: 11 },
	"red_marble": { id: "red_marble", name: "Red Marble", multi_file: false, fix_position: true, file: "red_marble", order: 12 },
	"black_pietersite": { id: "black_pietersite", name: "Black Pietersite", multi_file: true, fix_position: false, file: "black_pietersite_pieces", order: 13 },
	"black_simple": { id: "black_simple", name: "Plain Black", multi_file: true, fix_position: false, file: "black_simple_pieces", order: 14 },
	"black_marble": { id: "black_marble", name: "Black Marble", multi_file: false, fix_position: true, file: "black_marble", order: 15 }
};

function setSquareStyle(name, id, color){
	document.getElementById(`${color}_square_select`).innerText = name;
	// remove active on all other items in the list
	const options = document.getElementById(color + "_square_options");
	for(let i = 0; i < options.children.length; i++){
		const element = options.children[i].querySelector("button");
		if(element){
			element.classList.remove("active");
		}
	}
	document.getElementById(`${color}_${id}_square`).classList.add('active');
	materials[`${color}_sqr_style_name`] = id;
	localStorage.setItem(`board_style_${color}2`, id);
	board.updateboard();
	settingscounter = (settingscounter + 1) & 15;
}

function makeSquareElement(squareData, file, color){
	const li = document.createElement('li');
	const div = document.createElement('div');
	const name = document.createElement('div');
	name.innerText = squareData.name;
	if(squareData.transparent){
		const temp = file.split("/board");
		file = temp[0] + "/board/preview" + temp[1];
	}
	div.style.backgroundImage = `url('${file}')`;
	div.style.backgroundSize = '50px';
	div.style.minWidth = '50px';
	div.style.maxWidth = '50px';
	div.style.height = '50px';
	const option = document.createElement("button");
	option.id = `${color}_${squareData.id}_square`;
	option.setAttribute('onclick', `setSquareStyle('${squareData.name}', '${squareData.id}', '${color}'); event.preventDefault();`);
	option.classList.add("btn", "btn-transparent", "dropdown-item", 'flex', 'gap--8', 'flex-align-center');
	option.appendChild(div);
	option.appendChild(name);
	li.appendChild(option);
	return li;
}

function makeBoardSelector(color){
	const squareOptionsElement = document.getElementById(color + "_square_options");
	squareOptionsElement.replaceChildren();
	const sortedSquare = Object.values(squaresMap).sort((a, b) => a.order - b.order);
	for(let i = 0; i < sortedSquare.length; i++){
		const li = makeSquareElement(sortedSquare[i], `images/board/${sortedSquare[i].file}.png`, color);
		squareOptionsElement.appendChild(li);
	}
}

function deleteCustomPiece(id){
	const whitePiece = document.getElementById(`white_${id}_piece`);
	if(whitePiece && whitePiece.parentElement){
		whitePiece.parentElement.remove();
	}
	const blackPiece = document.getElementById(`black_${id}_piece`);
	if(blackPiece && blackPiece.parentElement){
		blackPiece.parentElement.remove();
	}
	localStorage.removeItem(id);
	delete piecesMap[id];
	if(localStorage['set_custom_piece_white'] === id){
		materials.white_piece_style_name = 'white_coral';
		materials.white_cap_style_name = 'white_coral';
		localStorage.removeItem('set_custom_piece_white');
		localStorage.removeItem('piece_style_white3');
		document.getElementById(`white_piece_select`).innerText = piecesMap['white_coral'].name;
		board.updatepieces();
	}
	if(localStorage['set_custom_piece_black'] === id){
		materials.black_piece_style_name = 'black_pietersite';
		materials.black_cap_style_name = 'black_pietersite';
		document.getElementById(`black_piece_select`).innerText = piecesMap['black_pietersite'].name;
		localStorage.removeItem('set_custom_piece_black');
		localStorage.removeItem('piece_style_black3');
		board.updatepieces();
	}
	// delete from the custom piece storage
	const uploadPieces = JSON.parse(localStorage['customPieces'] || '[]');
	for(let i = 0; i < uploadPieces.length; i++){
		if(uploadPieces[i] === id){
			uploadPieces.splice(i,1);
			localStorage.setItem('customPieces', JSON.stringify(uploadPieces));
			break;
		}
	}
}

function makePieceElement(pieceData, file, color){
	const li = document.createElement('li');
	const div = document.createElement('div');
	const name = document.createElement('div');
	name.innerText = pieceData.name;
	div.style.backgroundImage = `url('${file}')`;
	div.style.backgroundSize = '52px';
	div.style.minWidth = '52px';
	div.style.maxWidth = '52px';
	div.style.height = '52px';
	if(pieceData.fix_position){
		div.style.backgroundSize = '135px';
		div.style.backgroundPosition = "-75px -79px";
		div.style.backgroundRepeat = "no-repeat";
	}
	const option = document.createElement("button");
	option.id = `${color}_${pieceData.id}_piece`;
	option.setAttribute('onclick', `setPieceStyle('${pieceData.name}', '${pieceData.id}', '${color}', ${pieceData.custom ? pieceData.custom : false}); event.preventDefault();`);
	option.classList.add("btn", "btn-transparent", "dropdown-item", 'flex', 'gap--8', 'flex-align-center');
	option.appendChild(div);
	option.appendChild(name);
	li.appendChild(option);
	if(pieceData.can_delete){
		const deleteButton = document.createElement("button");
		deleteButton.classList.add('btn', 'btn-transparent');
		deleteButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M17,4V5H15V4H9V5H7V4A2,2,0,0,1,9,2h6A2,2,0,0,1,17,4Z"/><path d="M20,6H4A1,1,0,0,0,4,8H5V20a2,2,0,0,0,2,2H17a2,2,0,0,0,2-2V8h1a1,1,0,0,0,0-2ZM11,17a1,1,0,0,1-2,0V11a1,1,0,0,1,2,0Zm4,0a1,1,0,0,1-2,0V11a1,1,0,0,1,2,0Z"/></svg>';
		deleteButton.setAttribute("onclick", `deleteCustomPiece("${pieceData.id}")`);
		li.appendChild(deleteButton);
	}
	return li;
}

function setPieceStyle(name, id, color, custom){
	localStorage.removeItem(`set_custom_piece_${color}`);
	document.getElementById(`${color}_piece_select`).innerText = name;
	// remove active on all other items in the list
	const options = document.getElementById(color + "_piece_options");
	for(let i = 0; i < options.children.length; i++){
		const element = options.children[i].querySelector("button");
		if(element){
			element.classList.remove("active");
		}
	}
	if(custom){
		localStorage.setItem(`set_custom_piece_${color}`, id);
	}
	document.getElementById(`${color}_${id}_piece`).classList.add('active');
	materials[`${color}_piece_style_name`] = id;
	materials[`${color}_cap_style_name`] = id;
	if(custom){
		localStorage.setItem(`set_custom_piece_${color}`, id);
	}
	localStorage.setItem(`piece_style_${color}3`, id);
	board.updatepieces();
	settingscounter = (settingscounter + 1) & 15;
}

function makePieceSelector(color){
	const pieceOptionsElement = document.getElementById(color + "_piece_options");
	pieceOptionsElement.replaceChildren();
	const sortedPieces = Object.values(piecesMap).sort((a, b) => a.order - b.order);
	const oppositeColor = color === 'white' ? 'black' : 'white';
	for(let i = 0; i < sortedPieces.length; i++){
		const pieceId = sortedPieces[i].id.toLowerCase();
		// Skip pieces that are explicitly for the opposite color
		if(pieceId.includes(oppositeColor)){continue;}
		const li = makePieceElement(sortedPieces[i], `images/pieces/${sortedPieces[i].file}.png`, color);
		pieceOptionsElement.appendChild(li);
	}
}

function appendCustomPieceStyle(id, name, fileData){
	const pieceData = {id, name: id, can_delete: true, multi_file: false, fix_position: true, custom: true};
	piecesMap[id] = pieceData;
	const liWhite = makePieceElement(pieceData, fileData, 'white');
	const liBlack = makePieceElement(pieceData, fileData, 'black');
	document.getElementById("white_piece_options").appendChild(liWhite);
	document.getElementById("black_piece_options").appendChild(liBlack);
}

function setOverlayStyle(name, id){
	document.getElementById('overlay_select').innerText = name;
	// remove active on all other items in the list
	const options = document.getElementById("overlay_options");
	for(let i = 0; i < options.children.length; i++){
		const element = options.children[i].querySelector("button");
		if(element){
			element.classList.remove("active");
		}
	}
	document.getElementById(`${id}_overlay`).classList.add('active');

	// Clear custom overlay UI when selecting a preset
	const boardOverlayInput = document.getElementById("board-overlay");
	if(boardOverlayInput){boardOverlayInput.value = '';}
	const boardOverlayForm = document.getElementById('board-overlay-form');
	if(boardOverlayForm){boardOverlayForm.style.display = "block";}
	const removeOverlayBtn = document.getElementById('remove-overlay');
	if(removeOverlayBtn){removeOverlayBtn.style.display = "none";}

	if(id === 'none'){
		// Remove overlay
		board.removeOverlay();
		localStorage.removeItem('boardOverlay');
		localStorage.setItem('boardOverlayId', 'none');
	}
	else{
		const overlayData = overlaysMap[id];
		const overlayPath = `images/board/overlays/${overlayData.file}`;
		board.removeOverlay();
		board.addOverlay(overlayPath);
		// Only store the ID for preset overlays, not the path
		// (boardOverlay is reserved for custom uploaded overlays)
		localStorage.removeItem('boardOverlay');
		localStorage.setItem('boardOverlayId', id);
		// Apply the associated border color
		document.getElementById("borderColor").value = overlayData.border;
		localStorage["borderColor"] = overlayData.border;
		board.updateBorderColor(overlayData.border);
	}
	settingscounter = (settingscounter + 1) & 15;
}

function makeOverlayElement(overlayData){
	const li = document.createElement('li');
	const div = document.createElement('div');
	const name = document.createElement('div');
	name.innerText = overlayData.name;
	div.style.backgroundImage = `url('images/board/overlays/${overlayData.file}')`;
	div.style.backgroundSize = 'cover';
	div.style.backgroundPosition = 'center';
	div.style.minWidth = '50px';
	div.style.maxWidth = '50px';
	div.style.height = '50px';
	div.style.borderRadius = '4px';
	const option = document.createElement("button");
	option.id = `${overlayData.id}_overlay`;
	option.setAttribute('onclick', `setOverlayStyle('${overlayData.name}', '${overlayData.id}'); event.preventDefault();`);
	option.classList.add("btn", "btn-transparent", "dropdown-item", 'flex', 'gap--8', 'flex-align-center');
	option.appendChild(div);
	option.appendChild(name);
	li.appendChild(option);
	return li;
}

function makeOverlaySelector(){
	const overlayOptionsElement = document.getElementById("overlay_options");
	if(!overlayOptionsElement){return;}
	overlayOptionsElement.replaceChildren();

	// Add "None" option first
	const noneLi = document.createElement('li');
	const noneOption = document.createElement("button");
	noneOption.id = 'none_overlay';
	noneOption.setAttribute('onclick', `setOverlayStyle('None', 'none'); event.preventDefault();`);
	noneOption.classList.add("btn", "btn-transparent", "dropdown-item", 'flex', 'gap--8', 'flex-align-center');
	noneOption.innerText = 'None';
	noneLi.appendChild(noneOption);
	overlayOptionsElement.appendChild(noneLi);

	// Sort overlays alphabetically by name
	const sortedOverlays = Object.values(overlaysMap).sort((a, b) => a.name.localeCompare(b.name));
	for(let i = 0; i < sortedOverlays.length; i++){
		const li = makeOverlayElement(sortedOverlays[i]);
		overlayOptionsElement.appendChild(li);
	}
}

function initOverlaySelector(){
	makeOverlaySelector();
	// Set initial selection based on localStorage or default to aaron
	const savedOverlayId = localStorage.getItem('boardOverlayId');
	if(savedOverlayId && (savedOverlayId === 'none' || overlaysMap[savedOverlayId])){
		const name = savedOverlayId === 'none' ? 'None' : overlaysMap[savedOverlayId].name;
		document.getElementById('overlay_select').innerText = name;
		document.getElementById(`${savedOverlayId}_overlay`).classList.add('active');
	}
	else{
		// Default to aaron - apply its border color
		document.getElementById('overlay_select').innerText = overlaysMap['aaron'].name;
		document.getElementById('aaron_overlay').classList.add('active');
		document.getElementById("borderColor").value = overlaysMap['aaron'].border;
		localStorage["borderColor"] = overlaysMap['aaron'].border;
		board.updateBorderColor(overlaysMap['aaron'].border);
	}
}

function makeStyleSelector(){
	makeBoardSelector('white');
	makeBoardSelector('black');

	makeOverlaySelector();

	makePieceSelector('white');
	makePieceSelector('black');
	// legacy version
	if(localStorage.piecetexture0){
		appendCustomPieceStyle('piecetexture0', `Custom 0`, localStorage.piecetexture0);
	}
	if(localStorage.piecetexture1){
		appendCustomPieceStyle('piecetexture1', `Custom 1`, localStorage.piecetexture1);
	}
	const uploadPieces = JSON.parse(localStorage['customPieces'] || '[]');
	for(let i = 0; i < uploadPieces.length; i++){
		if(localStorage[`${uploadPieces[i]}`]){
			appendCustomPieceStyle(uploadPieces[i], uploadPieces[i], localStorage[`${uploadPieces[i]}`]);
		}
		else{
			// some how the piece was deleted from local storage but not from the list go ahead and remove it
			uploadPieces.splice(i,1);
			localStorage.setItem('customPieces', JSON.stringify(uploadPieces));
		}
	}
}
