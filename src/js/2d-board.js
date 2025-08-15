let ptnNinjaHasLoaded = false;
const ninja = document.getElementById("ninja");
let plyID = 0;

async function messageHandler(event){
	if(event.source !== ninja.contentWindow){
		return;
	}
	// Consider the PTN ninja embed loaded after first GAME_STATE message
	// Only initialize puzzles after this point
	if(!ptnNinjaHasLoaded){
		if(event.data.action === "GAME_STATE"){
			ptnNinjaHasLoaded = true;
			load2DSettings();
			initBoard();
			server.connect();
			if(location.search.slice(0,6)===('?load=')){
				const text = decodeURIComponent(location.search.split('?load=')[1]);
				document.getElementById("loadptntext").value = text;
				document.title = "Tak Review";
				hideElement("landing");
				load();
			}
		}
		else{
			return; // Ignore other messages until ptn.ninja is fully loaded
		}
	}
	switch (event.data.action){
		case "SET_UI":
			// check for the key is in the object
			if(event.data.value.hasOwnProperty("board3D")){
				localStorage.setItem('2d-board-3d', event.data.value.board3D);
				document.getElementById("2d-3d-toggle").checked = event.data.value.board3D;
				const options = document.getElementById('2d-board-3d-options');
				if(document.getElementById('2d-3d-toggle').checked){
					options.style.display = 'flex';
				}
				else{
					options.style.display = 'none';
				}
			}
			if(event.data.value.hasOwnProperty("animateBoard")){
				document.getElementById("2d-animations-toggle").checked = event.data.value.animateBoard;
				localStorage.setItem('2d-axis', event.data.value.animateBoard);
			}
			if(event.data.value.hasOwnProperty("axisLabels")){
				document.getElementById("2d-axis-toggle").checked = event.data.value.axisLabels;
				localStorage.setItem('2d-axis', event.data.value.axisLabels);
			}
			if(event.data.value.hasOwnProperty("axisLabelsSmall")){
				document.getElementById("2d-axis-small-toggle").checked = event.data.value.axisLabelsSmall;
				localStorage.setItem('2d-axis-small', event.data.value.axisLabelsSmall);
			}
			if(event.data.value.hasOwnProperty("highlightSquares")){
				document.getElementById("2d-highlight-toggle").checked = event.data.value.highlightSquares;
				localStorage.setItem('2d-last-move-highlight', event.data.value.highlightSquares);
			}
			break;
		case "GAME_STATE":
			if(gameData.is_scratch){
				if(!event.data.value.isFirstMove && plyID === event.data.value.plyID){
					// reset the notation to match the piece change
					// update the last notation to the correct value
					updateLastMove(event.data.value.ply);
				}
				plyID = event.data.value.plyID;
			}
			if(event.data.value.flatsWithoutKomi){
				gameData.flatCount = event.data.value.flatsWithoutKomi;
			}
			if(!gameData.is_game_end && !gameData.is_scratch && event.data.value.isGameEnd === true){
				if(event.data.value.result && event.data.value.result.text){
					gameData.result = event.data.value.result.text;
				}
				handleGameOverState();
				gameOver();
			}
			//Scratch Game check if game is not already over and has ended and post result with alert
			if(!gameData.is_game_end && gameData.is_scratch && event.data.value.isGameEnd === true){
				if(event.data.value.result && event.data.value.result.text){
					gameData.result = event.data.value.result.text;
				}
				else{
					gameData.result = "Game Over";
				}
				gameOver();
			}
			break;
		case "APPEND_PLY":
			notate(event.data.value);
			incrementMoveCounter();
			storeNotation();
			if(!gameData.observing){
				setDisable2DBoard(false);
			}
			break;
		case "INSERT_PLIES":
			if(!gameData.observing){
				setDisable2DBoard(false);
			}
			break;
		case "INSERT_PLY":
			// send move to server;
			if(!gameData.is_scratch && !gameData.observing && checkIfMyMove()){
				server.send("Game#" + gameData.id + " " + fromPTN(event.data.value));
				setDisable2DBoard(true);
			}
			notate(event.data.value);
			incrementMoveCounter();
			storeNotation();
			break;
		default:
			break;
	}
}

function init2DBoard(){
	set2DBoardPadding();
	window.addEventListener("message", messageHandler, false);
	window.addEventListener("keyup", onKeyUp, false);
}

function removeBoardMessageHandler(){
	window.removeEventListener("message", messageHandler);
}

function set2DPlayer(value){
	ninja.contentWindow.postMessage({
		action: 'SET_PLAYER',
		value: value
	}, '*');
}

function goToPly(moveId){
	ninja.contentWindow.postMessage({
		action: 'GO_TO_PLY',
		value: {
			plyID: moveId,
			isDone: true
		}
	}, '*');
}
// PREV | NEXT | FIRST | LAST | UNDO | REDO
function sendAction(action){
	ninja.contentWindow.postMessage({
		action
	}, '*');
}

function set2DUI(value){
	ninja.contentWindow.postMessage({
		action: 'SET_UI',
		value: value
	}, '*');
}

function set2DBoard(data){
	ninja.contentWindow.postMessage({
		action: 'SET_CURRENT_PTN',
		value: data
	}, '*');
}

function set2DPlay(value){
	lastMove();
	ninja.contentWindow.postMessage({
		action: 'INSERT_PLIES',
		value: {
			plies: value
		}
	}, '*');
}

function appendPlay(value){
	lastMove();
	ninja.contentWindow.postMessage({
		action: 'APPEND_PLY',
		value: value
	}, '*');
}

function setDisable2DBoard(value){
	ninja.contentWindow.postMessage({
		action: 'SET_UI',
		value: {
			disableBoard: value
		}
	}, '*');
}

function set2DBoardPadding(){
	const notationWidth = document.getElementById("rmenu").clientWidth;
	const settingsWidth = document.getElementById("settings-drawer").clientWidth;
	const chat = document.getElementById("cmenu");
	const chatAttr = chat.hasAttribute("hidden");
	const chatHiddenState = (typeof chatAttr !== undefined && chatAttr !== false);
	let paddingLeft = settingsWidth > 0 ? settingsWidth : notationWidth;
	let paddingRight = (chatHiddenState ? 0 : (+localStorage.getItem("chat_size") || 180) + 10);
	const ninja = document.getElementById("ninja");
	ninja.style.paddingLeft = paddingLeft + "px";
	ninja.style.paddingRight = paddingRight + "px";
}