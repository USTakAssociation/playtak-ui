let ptnNinjaHasLoaded = false;
const ninja = document.getElementById("ninja");
let plyID = 0;

async function messageHandler(event) {
	if (event.source !== ninja.contentWindow) {
		return;
	}
	// Consider the PTN ninja embed loaded after first GAME_STATE message
	// Only initialize puzzles after this point
	if (!ptnNinjaHasLoaded) {
		if (event.data.action === "GAME_STATE") {
			ptnNinjaHasLoaded = true;
			load2DSettings();
			initBoard();
			server.connect();
		} else {
			return; // Ignore other messages until ptn.ninja is fully loaded
		}
	}
	switch (event.data.action) {
		case "GAME_STATE":
			if (gameData.is_scratch) {
				if (!event.data.value.isFirstMove && plyID === event.data.value.plyID) {
					// reset the notation to match the piece change
					// update the last notation to the correct value
					updateLastMove(event.data.value.ply);
				}
				plyID = event.data.value.plyID
			}
			// check if game is not already over and has ended and post result with alert
			if (!gameData.is_game_end && gameData.is_scratch && event.data.value.isGameEnd === true) {
				if (event.data.value.result && event.data.value.result.text) {
					gameData.result = event.data.value.result.text
				} else {
					gameData.result = "Game Over";
				}
				gameOver();
			}
			break;
		case "INSERT_PLIES":
			notate(event.data.value);
			incrementMoveCounter();
			if(!gameData.observing) {
				setDisable2DBoard(false);
			}
			break;
		case "INSERT_PLY":
			// send move to server;
			if(!gameData.is_scratch && !gameData.observing && checkIfMyMove()){
				server.send("Game#" + gameData.id + " " + fromPTN(event.data.value))
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

function init2DBoard() {
	set2DBoardPadding();
	window.addEventListener( "message", messageHandler, false);
}

function removeBoardMessageHandler() {
	window.removeEventListener("message", messageHandler);
}

function set2DPlayer(value) {
	ninja.contentWindow.postMessage({
		action: 'SET_PLAYER',
		value: value
	}, '*');
}

function goToPlay(moveId) {
	ninja.contentWindow.postMessage({
		action: 'GO_TO_PLY',
		value: {
			plyID: moveId,
			isDone: true
		}
	}, '*');
}
// PREV | NEXT | FIRST | LAST | UNDO | REDO
function sendAction(action) {
	ninja.contentWindow.postMessage({
		action,
	}, '*');
}

function set2DUI(value) {
	ninja.contentWindow.postMessage({
		action: 'SET_UI',
		value: value
	}, '*');
}

function set2DBoard(data) {
	ninja.contentWindow.postMessage({
		action: 'SET_CURRENT_PTN',
		value: data
	}, '*');
}

function set2DPlay(value) {
	lastMove();
	ninja.contentWindow.postMessage({
		action: 'INSERT_PLIES',
		value: {
			plies: value
		}
	}, '*');
}

function setDisable2DBoard(value) {
	ninja.contentWindow.postMessage({
		action: 'SET_UI',
		value: {
			disableBoard: value
		}
	}, '*');
}

function set2DBoardPadding() {
	const notationWidth = document.getElementById("rmenu").clientWidth;
	const settingsWidth = document.getElementById("settings-drawer").clientWidth;
	const chat = document.getElementById("cmenu");
	const chatAttr = chat.hasAttribute("hidden");
	const chatHiddenState = (typeof chatAttr !== undefined && chatAttr !== false);
	let paddingLeft = settingsWidth > 0 ? settingsWidth : notationWidth;
	let paddingRight = (chatHiddenState ? 0 : (+localStorage.getItem("chat_size") || 180) + 10);
	const ninja = document.getElementById("ninja");
	ninja.style.paddingLeft = paddingLeft + "px";
	ninja.style.paddingRight = paddingRight + "px"
}