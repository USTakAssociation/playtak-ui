// this file contains all the global variables and functions for the play tak game interface
const BOARD_PADDING = 10;
let gameData = {
	id: 0,
	opponent: null,
	my_color: 'white',
	is_my_move: false,
	size: 5, 
	time: null,
	increment: null,
	komi: 0,
	pieces: 21,
	capstones: 1,
	unrated: false,
	tournament: false,
	triggerMove: 0,
	timeAmount: 0,
	bot: 0,
	is_scratch: true,
	observing: false,
	move_count: 0, // how many moves have been made in this game,
	// move_start is the initial move number of this game.
	// An empty board starts from 0, but a game loaded from
	// TPS may start at some other move.
	// This matters during Undo, because we can't undo beyond
	// the initial board layout received from the TPS.
	move_start: 0,
	move_shown: 0, // which move are we showing (we can show previous moves
	result: '',
	is_game_end: false, // the game has ended and play cannot continue,
}

const defaultPiecesAndCaps = {
	3: [10, 0],
	4: [15, 0],
	5: [21, 1],
	6: [30, 1],
	7: [40, 2],
	8: [50, 2],
}
let hasPlayedHurry = false;

function resetGameDataToDefault() {
	gameData = {
		id: 0,
		opponent: null,
		my_color: 'white',
		is_my_move: false,
		size: 5, 
		time: null,
		increment: null,
		komi: 0,
		pieces: 21,
		capstones: 1,
		unrated: false,
		tournament: false,
		triggerMove: 0,
		timeAmount: 0,
		bot: 0,
		is_scratch: true,
		observing: false,
		move_count: 0,
		move_start: 0,
		move_shown: 0,
		result: '',
		is_game_end: false,
	}
}
function changeScratchBoardSize() {
	const size = document.getElementById("scratchBoardSize").value;
	const piecesCaps = defaultPiecesAndCaps[size];
	if (piecesCaps) {
		document.getElementById("scratchPieceCount").value = piecesCaps[0];
		document.getElementById("scratchCapCount").value = piecesCaps[1];
	}
}

function playScratch() {
	resetGameDataToDefault();
	clearStoredNotation();
	clearNotationMenu();
	document.getElementById("open-game-over").style.display = "none";
	if (gameData.observing) {
		server.send("Unobserve " + gameData.id);
		gameData.observing = false;
	}
	if (gameData.is_scratch) {
		gameData.size = parseInt(document.getElementById("scratchBoardSize").value);
		gameData.pieces = parseInt(document.getElementById("scratchPieceCount").value);
		gameData.capstones = parseInt(document.getElementById("scratchCapCount").value);
		gameData.komi = 0;
		gameData.id = 0;
		initBoard();
		if (is2DBoard) {
			set2DPlayer(null);
		}
		storeNotation();
	} else {
		alert('warning', 'You can`t play a scratch game while playing an online game');
	}
	$("#creategamemodal").modal("hide");
}

function initBoard() {
	$("#komirule").html("+" + Math.floor(gameData.komi / 2) + (gameData.komi & 1 ? ".5" : ".0"));
	$("#piecerule").html(gameData.pieces + "/" + gameData.capstones);
	if(gameData.triggerMove > 0){
		document.getElementById("extra-time").style.display = 'block';
		document.getElementById("extra-time-rule").innerHTML = `${gameData.triggerMove}/+${gameData.timeAmount/60}`;
	}
	// reset the game data and new new values
	if (!is2DBoard) {
		board.clear();
		board.create(gameData.size, gameData.pieces, gameData.capstones);
		board.initEmpty();
		return;
	}
	set2DBoard(`[Size "${gameData.size}"][Komi "${gameData.komi}"][Flats "${gameData.pieces}"][Caps "${gameData.capstones}"]`);
	if (gameData.my_color === 'black') {
		setDisable2DBoard(true);
	} else {
		setDisable2DBoard(false);
	}
	if (!gameData.is_scratch) {
		set2DPlayer(gameData.my_color === 'white' ? 1 : 2);
	}

}

function initCounters(startMove) {
	gameData.move_start = startMove;
	gameData.move_count = startMove;
	gameData.move_shown = startMove;
}

function incrementMoveCounter() {
	if(gameData.move_shown === gameData.move_count){
		$('.curmove:first').removeClass('curmove');
		$('.moveno'+gameData.move_count+':first').addClass('curmove');
		gameData.move_shown++;
	}
	gameData.move_count++;
	document.getElementById("move-sound").currentTime = 0;
	document.getElementById("move-sound").play();

	$('#player-me').toggleClass('selectplayer');
	$('#player-opp').toggleClass('selectplayer');

	// In a scratch game I'm playing both colors
	if(gameData.is_scratch){
		if(gameData.my_color === "white"){gameData.my_color = "black"}
		else{gameData.my_color = "white"}
	}

	$('#undo').removeClass('i-requested-undo').removeClass('opp-requested-undo').addClass('request-undo');
}

function load() {
	clearStoredNotation();
	resetGameDataToDefault();
	clearNotationMenu();
	document.getElementById("open-game-over").style.display = "none";
	$("#creategamemodal").modal("hide");
	if(!gameData.is_scratch && !gameData.observing) {
		alert('warning',"TPS/PTN won't be displayed in the middle of an online game");
		return;
	}

	server.unobserve();

	const text = document.getElementById("loadptntext").value;

	const tpsRegex = /([,x12345678SC\/]+)\s+(\d+)\s+(\d+|-)/
	const isTPS = tpsRegex.test(text)
	let parsed = parsePTN(text);
	if (parsed !== null && !isTPS) {
		if (parsed.tags === undefined || parsed.tags === null 
			|| parsed.tags.Size === undefined || parsed.tags.Size === null
		) {
			alert('warning','Invalid PTN: no size tag found');
			return;
		}
		$('.player1-name:first').html(parsed.tags.Player1)
		$('.player2-name:first').html(parsed.tags.Player2)
		if(parsed.tags.Clock !== undefined){
			$('.player1-time:first').html(parsed.tags.Clock)
			$('.player2-time:first').html(parsed.tags.Clock)
		}
		gameData.size = parsed.tags.Size;
		gameData.komi = parsed.tags.Komi || 0;
		gameData.pieces = parsed.tags.Flats || defaultPiecesAndCaps[gameData.size][0];
		gameData.capstones = parsed.tags.Caps || defaultPiecesAndCaps[gameData.size][1];
	} else if (!parsed && !isTPS) {
		alert('warning','Invalid PTN/TPS')
		return;
	}

	const resultArray = ['0-1', '1-0', '1/2-1/2', 'F-0', '0-F','R-0', '0-R']

	if (is2DBoard) {
		if (parsed && !isTPS) {
			if (resultArray.includes(parsed.moves[parsed.moves.length - 1])) {
				parsed.moves.pop()
			}
			for(let i = 0; i < parsed.moves.length; i++){
				if((/^([SFC]?)([a-h])([0-8])$/.exec(parsed.moves[i])) === null && (/^([1-9]?)([a-h])([0-8])([><+-])(\d*)$/.exec(parsed.moves[i])) === null){
					console.warn("unparseable: " + parsed.moves[i])
					continue;
				}
				notate(parsed.moves[i]);
				incrementMoveCounter();
			}
			set2DBoard(text);
			sendAction('LAST')
		} else {
			const parsedTPS = parseTPS(text);
			//set defaults
			gameData.size = parsedTPS.size;
			gameData.pieces = defaultPiecesAndCaps[gameData.size][0];
			gameData.capstones = defaultPiecesAndCaps[gameData.size][1];
			set2DBoard(`[Size "${gameData.size}"][Flats "${gameData.pieces}"][Caps "${gameData.capstones}"] [TPS "${text}"]`);
		}
	} else {
		dontanimate = true;
		if(parsed && !isTPS) {board.loadptn(parsed)}
		else{board.loadtps(text)};
		dontanimate = false;
	}

	document.getElementById("loadptntext").value = "";
}

function loadCurrentGameState() {
	const currentGame = localStorage.getItem("currentGame");
	if (!currentGame) {
		alert('warning', 'No current game found in local storage');
		return;
	}
	const parsed = parsePTN(currentGame);
	clearNotationMenu();
	initCounters(0);
	if (is2DBoard) {
		set2DBoard(currentGame);
		sendAction('LAST')
		for(let i = 0; i < parsed.moves.length; i++){
			if((/^([SFC]?)([a-h])([0-8])$/.exec(parsed.moves[i])) === null && (/^([1-9]?)([a-h])([0-8])([><+-])(\d*)$/.exec(parsed.moves[i])) === null){
				console.warn("unparseable: " + parsed.moves[i])
				continue;
			}
			notate(parsed.moves[i]);
			incrementMoveCounter();
		}
		if (gameData.is_scratch) {
			setDisable2DBoard(false);
		}
		// check if my move
		
	} else {
		dontanimate = true;
		board.loadptn(parsed);
		dontanimate = false;
	}
}

function adjustBoardWidth() {
	if (is2DBoard) {
		set2DBoardPadding();
		return;
	}
	generateCamera();
}

// time controls
function startTime(fromFn) {
	if(typeof fromFn === 'undefined' && !server.timervar) {return}
	const t = invarianttime();
	const elapsed = t - lastTimeUpdate;
	let t1;
	const isMyMove = checkIfMyMove();
	let t1f=lastWt;
	let t2f=lastBt;

	if(gameData.move_count%2 === 0) {
		t1f = Math.max(lastWt - elapsed, 0);
		t1 = t1f;
	}
	else{
		t2f = Math.max(lastBt - elapsed, 0);
		t1 = t2f;
	}
	const nextUpdate = ((t1-1)%100)+1;
	settimers(t1f,t2f);
	if(t1<=10000 && isMyMove && !hasPlayedHurry){
		hasPlayedHurry = true;
		const hurrySound = document.getElementById("hurry-sound")
		hurrySound.currentTime = 0;
		hurrySound.play();
	}
	if(!isMyMove){
		hasPlayedHurry = false;
	}
	clearTimeout(server.timervar);
	server.timervar = setTimeout(startTime, nextUpdate);
}

function stopTime() {
	clearTimeout(server.timervar);
	server.timervar = null;
}

function settimers(p1t,p2t,noHurry){
	$('.player1-time:first').html(formatTime(p1t));
	$('.player2-time:first').html(formatTime(p2t));
	if(p1t <= 10000 && !noHurry){
		$('.player1-time:first').addClass("hurrytime");
	}else{
		$('.player1-time:first').removeClass("hurrytime");
	}
	if(p2t <= 10000 && !noHurry){
		$('.player2-time:first').addClass("hurrytime");
	}else{
		$('.player2-time:first').removeClass("hurrytime");
	}
}

function getZero(t) {
	return t < 10 ? '0' + t : t;
}

function formatTime(time){
	if(time < 0){
		time = 0;
	}
	if(time > 59900){
		const st = Math.ceil(time/1000);
		return Math.floor(st/60) + ':' + getZero(st%60);
	}else{
		const dst = Math.ceil(time/100);
		return getZero(Math.floor(dst/10)) + ".<span style='font-size:70%;'>" + (dst%10) + "</span>";
	}
}
// notation controls
function clearNotationMenu() {
	const tbl = document.getElementById("moveslist");
	while(tbl.rows.length > 0){ tbl.deleteRow(0) }
	document.getElementById("extra-time-rule").innerHTML = '';
	document.getElementById("extra-time").style.display = "none";
	$('#draw').removeClass('i-offered-draw').removeClass('opp-offered-draw').addClass('offer-draw');
	stopTime();

	$('#player-me-name').removeClass('player1-name');
	$('#player-me-name').removeClass('player2-name');
	$('#player-opp-name').removeClass('player1-name');
	$('#player-opp-name').removeClass('player2-name');

	$('#player-me-time').removeClass('player1-time');
	$('#player-me-time').removeClass('player2-time');
	$('#player-opp-time').removeClass('player1-time');
	$('#player-opp-time').removeClass('player2-time');

	$('#player-me').removeClass('selectplayer');
	$('#player-opp').removeClass('selectplayer');

	//i'm always black after clearing
	$('#player-me-name').addClass('player2-name');
	$('#player-opp-name').addClass('player1-name');

	$('#player-me-time').addClass('player2-time');
	$('#player-opp-time').addClass('player1-time');

	$('#player-me-img').removeClass("iswhite");
	$('#player-me-img').addClass("isblack");
	$('#player-opp-img').removeClass("isblack");
	$('#player-opp-img').addClass("iswhite");

	$('#player-opp').addClass('selectplayer');

	$('.player1-name:first').html('You');
	$('.player2-name:first').html('You');
	settimers(0, 0, true);

	$('#gameoveralert').modal('hide');
}

function getCurrentNotationRow() {
	const moveList = document.getElementById("moveslist");
	return moveList.rows[moveList.rows.length - 1];
}

function insertNewNotationRow(rowNum) {
	const moveList = document.getElementById("moveslist");
	// make a new row
	const row = moveList.insertRow();
	// insert the numbering cell
	const cell0 = row.insertCell(0);
	cell0.innerHTML = rowNum + '.';

	// insert the left and right cell
	row.insertCell(1);
	row.insertCell(2);
	return row;
}

function clearStoredNotation() {
	localStorage.removeItem("currentGame");
}

function storeNotation(txt) {
	localStorage.setItem("currentGame", txt ? txt: getNotation());
}

function notate(txt) {
	if(txt==='R-0'||txt==='0-R'||txt==='F-0'||txt==='0-F'||txt==='1-0'||txt==='0-1'||txt==='1/2-1/2'){
		const moveList = document.getElementById("moveslist");
		const row = moveList.insertRow();
		const cell0 = row.insertCell(0);
		cell0.innerHTML = '';

		const cell1 = row.insertCell(1);
		
		cell1.innerHTML = txt;

		$('#notationbar').scrollTop(10000);
		return;
	}

	if(txt === 'load'){
		// If move_count is odd, then this initial position goes
		// in the left column and the next move will go in the right column.
		// If move_count is even, then the left column will be empty, and
		// this initial position goes in the right column,
		// and the next move will go in the left column of the next row
		if(gameData.move_count % 2 === 1){
			const row = this.insertNewNotationRow(Math.floor(gameData.move_count / 2 + 1));
			const cell1 = row.cells[1];
			cell1.innerHTML = '<a href="#" onclick="showMove('+(gameData.move_count)+');"><span class="curmove moveno'+(gameData.move_count-1)+'">' + txt + '</span></a>';
		}else{
			const row = this.insertNewNotationRow(Math.floor(gameData.move_count / 2 + 1) - 1);
			const cell1 = row.cells[1];
			cell1.innerHTML = '<span>--</span>';
			const cell2 = row.cells[2];
			cell2.innerHTML = '<a href="#" onclick="showMove('+(gameData.move_count)+');"><span class="curmove moveno'+(gameData.move_count-1)+'">' + txt + '</span></a>';
		}
		return;
	}

	// if the move count is non-zero and is an odd# then the code
	// assumes there must be a row in the moveslist table that
	// we can add a new cell to.
	if(gameData.move_count !== 0 && gameData.move_count % 2 === 1){
		const row = this.getCurrentNotationRow();
		const cell2 = row.cells[2];
		cell2.innerHTML = '<a href="#" onclick="showMove('+(gameData.move_count+1)+');"><span class=moveno'+gameData.move_count+'>'+txt+'</span></a>';
	}
	else{
		const row = this.insertNewNotationRow(Math.floor(gameData.move_count / 2 + 1));
		// get the left cell of the new row
		const cell1 = row.cells[1];
		cell1.innerHTML = '<a href="#" onclick="showMove('+(gameData.move_count+1)+');"><span class=moveno'+gameData.move_count+'>'+txt+'</span></a>';
	}
	$('#notationbar').scrollTop(10000);
}

function updateLastMove(move) {
	if(gameData.move_count <= gameData.move_start){ return }
	gameData.move_count = gameData.move_count - 1;
	gameData.move_shown = gameData.move_shown - 1;
	$('#player-me').toggleClass('selectplayer');
	$('#player-opp').toggleClass('selectplayer');

	if(gameData.is_scratch){
		if(gameData.my_color === "black"){gameData.my_color = "white"}
		else{gameData.my_color = "black"}
	}

	//fix notation
	const moveList = document.getElementById("moveslist")
	let lr = moveList.rows[moveList.rows.length - 1];
	const tempCount = gameData.move_count - 1;
	// clears out the next row
	if(gameData.move_count % 2 == 0){
		moveList.deleteRow(moveList.rows.length - 1);
		// update the inner html of the last cell
		lr = moveList.rows[moveList.rows.length - 1];
		lr.cells[2].innerHTML = '<a href="#" onclick="showMove('+(gameData.move_count)+');"><span class=moveno'+tempCount+'>'+move+'</span></a>';
	} else{
		lr.cells[1].innerHTML = '<a href="#" onclick="showMove('+(gameData.move_count)+');"><span class=moveno'+tempCount+'>'+move+'</span></a>';
		lr.cells[2].innerHTML = '';
	}
	$('.curmove:first').removeClass('curmove');
	$('.moveno'+(tempCount)+':first').addClass('curmove');
	storeNotation();
}

function firstMove() {
	setShownMove(gameData.move_start);
	if (is2DBoard) {
		sendAction('FIRST');
		return;
	}
	board.showmove(gameData.move_start, true);
}

function lastMove() {
	setShownMove(gameData.move_count);
	if (is2DBoard) {
		sendAction('LAST');
		return;
	}
	board.showmove(gameData.move_count, true);
}

function previousMove() {
	const moveId = gameData.move_shown - 1;
	if(gameData.move_count <= gameData.move_start || moveId > gameData.move_count || moveId < gameData.move_start || (gameData.move_shown === moveId && !override)){
		return;
	}
	setShownMove(moveId);
	if (is2DBoard) {
		sendAction('PREV');
		return;
	}
	board.showmove(moveId, true);
}

function nextMove() {
	const moveId = gameData.move_shown+1;
	if(gameData.move_count <= gameData.move_start || moveId > gameData.move_count || moveId < gameData.move_start || (gameData.move_shown === moveId && !override)){
		return;
	}
	setShownMove(moveId);
	if (is2DBoard) {
		sendAction('NEXT');
		return;
	}
	board.showmove(moveId, true);
}

function showMove(moveId) {
	if (is2DBoard) {
		goToPlay(moveId - 1);
		setShownMove(moveId);
	} else {
		setShownMove(moveId);
		board.showmove(moveId, true);
	}
}

function setShownMove(moveId) {
	gameData.move_shown = moveId;
	$('.curmove:first').removeClass('curmove');
	$('.moveno'+(gameData.move_shown - 1)+':first').addClass('curmove');
}

function undoMove() {
	// we can't undo before the place we started from
	if(gameData.move_count <= gameData.move_start){ return }
	gameData.move_count--;
	gameData.move_shown = gameData.move_count;
	if (is2DBoard) {
		sendAction('UNDO');
	} else {
		board.undo();
	}
	
	$('#player-me').toggleClass('selectplayer');
	$('#player-opp').toggleClass('selectplayer');

	if(gameData.is_scratch){
		if(gameData.my_color === "white"){gameData.my_color = "black"}
		else{gameData.my_color = "white"}
	}

	//fix notation
	const moveList = document.getElementById("moveslist");
	let lr = moveList.rows[moveList.rows.length - 1];

	// first check if we are undoing the last move that finished
	// the game, if we have to do something a bit special
	const txt1 = lr.cells[1].innerHTML.trim()
	const txt2 = lr.cells[2].innerHTML.trim()
	if(txt1==='R-0'||txt1==='F-0'||txt1==='1-0'||txt1==='1/2'||txt2==='0-F'||txt2==='0-R'||txt2==='0-1'){
		moveList.deleteRow(moveList.rows.length - 1);
		lr = moveList.rows[moveList.rows.length - 1];
		gameData.is_game_end = false;
	}

	if(gameData.move_count % 2 == 0){
		moveList.deleteRow(moveList.rows.length - 1);
	}
	else{
		lr.cells[2].innerHTML = "";
	}

	$('.curmove:first').removeClass('curmove');
	$('.moveno'+(gameData.move_count-1)+':first').addClass('curmove');
}

function checkIfMyMove() {
	if(gameData.is_scratch){ return true; }
	if(gameData.observing){ return false; }
	const toMove = (gameData.move_count % 2 === 0) ? "white" : "black";
	return toMove === gameData.my_color;
}

function isWhitePieceToMove() {
	// white always goes first, so must pick up a black piece
	if(gameData.move_count === 0){return false}
	// black always goes second, so must pick up a white piece
	if(gameData.move_count === 1){return true}
	// after that, if we've made an even number of moves, then it is
	// white's turn, and she must pick up a white piece
	return gameData.move_count % 2 === 0;
}

function sendMove(move) {
	if(gameData.is_scratch){ return }
	server.send("Game#" + gameData.id + " " + move);
}

function getLeftPadding() {
	const notation = document.getElementById("rmenu");
	const notationAttr = notation.hasAttribute("hidden");
	const notationHiddenState = (typeof notationAttr !== undefined && notationAttr !== false);
	const settingsDrawer = document.getElementById("settings-drawer");
	const settingsAttr = settingsDrawer.hasAttribute("hidden");
	const settingsDrawerHiddenState = (typeof settingsAttr !== undefined && settingsAttr !== false);
	let leftPadding = (notationHiddenState ? 0 : 209) + BOARD_PADDING;
	if (!settingsDrawerHiddenState && notationHiddenState){
		leftPadding = 209 + BOARD_PADDING;
	}
	return leftPadding;
}

function getRightPadding() {
	const chat = document.getElementById("cmenu");
	const chatAttr = chat.hasAttribute("hidden");
	const chatHiddenState = (typeof chatAttr !== undefined && chatAttr !== false);

	return (chatHiddenState ? 0 : 24 + (+localStorage.getItem("chat_size") || 180)) + BOARD_PADDING;
}

function gameOver(preMessage) {
	preMessage = (typeof preMessage === 'undefined') ? "" : preMessage + " ";
	notate(gameData.result);
	alert("info",preMessage + "Game over!! " + gameData.result);
	gameData.is_game_end = true;
	if (is2DBoard) {
		setDisable2DBoard(true);
	}
}