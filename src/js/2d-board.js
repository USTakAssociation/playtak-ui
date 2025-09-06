let ptnNinjaHasLoaded = false;
const ninja = document.getElementById("ninja");

async function messageHandler(event){
	if(event.source !== ninja.contentWindow){
		return;
	}
	const { action, value } = event.data;
	// Consider the PTN Ninja embed loaded after first GAME_STATE message
	if(!ptnNinjaHasLoaded){
		if(action === "GAME_STATE"){
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
	switch (action){
		case "SET_UI":
			// check for the key is in the object
			if(value.hasOwnProperty("board3D")){
				localStorage.setItem('2d-board-3d', value.board3D);
				document.getElementById("2d-3d-toggle").checked = value.board3D;
				const options = document.getElementById('2d-board-3d-options');
				if(document.getElementById('2d-3d-toggle').checked){
					options.style.display = 'flex';
				}
				else{
					options.style.display = 'none';
				}
			}
			if(value.hasOwnProperty("animateBoard")){
				document.getElementById("2d-animations-toggle").checked = value.animateBoard;
				localStorage.setItem('2d-axis', value.animateBoard);
			}
			if(value.hasOwnProperty("axisLabels")){
				document.getElementById("2d-axis-toggle").checked = value.axisLabels;
				localStorage.setItem('2d-axis', value.axisLabels);
			}
			if(value.hasOwnProperty("axisLabelsSmall")){
				document.getElementById("2d-axis-small-toggle").checked = value.axisLabelsSmall;
				localStorage.setItem('2d-axis-small', value.axisLabelsSmall);
			}
			if(value.hasOwnProperty("highlightSquares")){
				document.getElementById("2d-highlight-toggle").checked = value.highlightSquares;
				localStorage.setItem('2d-last-move-highlight', value.highlightSquares);
			}
			break;
		case "GAME_STATE":
			if(value.flatsWithoutKomi){
				gameData.flatCount = value.flatsWithoutKomi;
			}
			if(!gameData.is_game_end && value.isGameEnd === true){
				if(value.result && value.result.text){
					gameData.result = value.result.text;
				}
				else if(gameData.is_scratch){
					gameData.result = "Game Over";
				}

				if(!gameData.is_scratch){
					handleGameOverState();
				}
				gameOver();
			}
			break;
		case "INSERT_PLY":
			// send move to server;
			if(!gameData.is_scratch && !gameData.observing && checkIfMyMove()){
				server.send("Game#" + gameData.id + " " + fromPTN(value));
				setDisable2DBoard(true);
			}
			notate(value);
			incrementMoveCounter();
			storeNotation();
			break;
		case "DELETE_PLY":
			if(!gameData.observing && checkIfMyMove()){
				setDisable2DBoard(false);
			}
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

function send2DAction(action, value){
	ninja.contentWindow.postMessage({
		action,
		value
	}, '*');
}

function set2DPlayer(value){
	send2DAction('SET_PLAYER', value);
}

function goToPly(moveId){
	send2DAction('GO_TO_PLY', {
		plyID: moveId,
		isDone: true
	});
}

function set2DUI(value){
	send2DAction('SET_UI', value);
}

function set2DBoard(value){
	send2DAction('SET_CURRENT_PTN', value);
}

function appendPly(value){
	send2DAction('APPEND_PLY', value);
}

function setDisable2DBoard(value){
	send2DAction('SET_UI', {
		disableBoard: value
	});
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