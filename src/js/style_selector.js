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
	"white_Craig_Laparo": { id: "white_Craig_Laparo", name: "White Regal by Gruppler", multi_file: false, fix_position: true, file: "white_Craig_Laparo", order: 1 },
	"black_Craig_Laparo": { id: "black_Craig_Laparo", name: "Black Regal by Gruppler", multi_file: false, fix_position: true, file: "black_Craig_Laparo", order: 2 },
	"blossom_Levi_Huillet": { id: "blossom_Levi_Huillet", name: "Blossom by Levi", multi_file: false, fix_position: true, file: "blossom_Levi_Huillet", order: 3 },
	"hummingbird_Levi_Huillet": { id: "hummingbird_Levi_Huillet", name: "Hummingbird by Levi", multi_file: false, fix_position: true, file: "hummingbird_Levi_Huillet", order: 4 },
	"white_coral": { id: "white_coral", name: "White Coral", multi_file: true, fix_position: false, file: "white_coral_pieces", order: 5 },
	"white_simple": { id: "white_simple", name: "Plain White", multi_file: true, fix_position: false, file: "white_simple_pieces", order: 6 },
	"white_marble": { id: "white_marble", name: "White Marble", multi_file: false, fix_position: true, file: "white_marble", order: 7 },
	"red_marble": { id: "red_marble", name: "Red Marble", multi_file: false, fix_position: true, file: "red_marble", order: 8 },
	"black_pietersite": { id: "black_pietersite", name: "Black Pietersite", multi_file: true, fix_position: false, file: "black_pietersite_pieces", order: 9 },
	"black_simple": { id: "black_simple", name: "Plain Black", multi_file: true, fix_position: false, file: "black_simple_pieces", order: 10 },
	"black_marble": { id: "black_marble", name: "Black Marble", multi_file: false, fix_position: true, file: "black_marble", order: 11 }
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
	whitePiece.parentElement.remove();
	const blackPiece = document.getElementById(`black_${id}_piece`);
	blackPiece.parentElement.remove();
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
	for(let i = 0; i < sortedPieces.length; i++){
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

function makeStyleSelector(){
	makeBoardSelector('white');
	makeBoardSelector('black');

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
