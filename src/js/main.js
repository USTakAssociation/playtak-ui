const gamePresets = {
	"beginner": {
		size: 6,
		komi: 4,
		type: 1, // 1 for tournament, 0 for normal, 2 for unrated
		pieces: 30,
		capstones: 1,
		time: 900,
		increment: 10,
		trigger_move: "",
		time_amount: "",
		required_fields: ['opname']
	},
	"intermediate": {
		size: 6,
		komi: 4,
		type: 1,
		pieces: 30,
		capstones: 1,
		time: 900,
		increment: 10,
		trigger_move: "",
		time_amount: "",
		required_fields: ['opname']
	},
	"league": {
		size: 6,
		komi: 4,
		type: 1,
		pieces: 30,
		capstones: 1,
		time: 900, // seconds
		increment: 10,
		trigger_move: 35,
		time_amount: 300, // seconds
		required_fields: ['opname']
	},
	"7_open": {
		size: 7,
		komi: 4,
		type: 1,
		pieces: 40,
		capstones: 2,
		time: 1200, // seconds
		increment: 15,
		trigger_move: 40,
		time_amount: 600, // seconds
		required_fields: ['opname']
	},
	"7_blitz": {
		size: 7,
		komi: 4,
		type: 1,
		pieces: 40,
		capstones: 2,
		time: 300, // seconds
		increment: 5,
		trigger_move: "",
		time_amount: "", // seconds
		required_fields: ['opname']
	},
	"trans-atlan": {
		size: 6,
		komi: 4,
		type: 1,
		pieces: 30,
		capstones: 1,
		time: 1200, // seconds
		increment: 15,
		trigger_move: "35",
		time_amount: "600", // seconds
		required_fields: ['opname']
	}
};

var ismobile=false;
var isidevice=false;
var fixedcamera=false;
var clickthrough=true;
var hovertext=true;
var pixelratio=1;
var rendererdone=false;
var clearcolor=0xdddddd;

var settingscounter=0;
var is2DBoard = false;
var fson = false;

function alert(type,msg){
	$('#alert-text').text(msg);
	var $alert = $('#alert');
	$alert.removeClass("alert-success alert-info alert-warning alert-danger");

	$alert.addClass("alert-"+type);
	$alert.removeAttr('style');
	$alert.stop(true,true);
	$alert.fadeTo(7000,500).slideUp(500,function(){
		$alert.css("display","none");
	});
}

function togglefs(){
	if(fson){
		document.exitFullscreen();
	}
	else{
		document.documentElement.requestFullscreen();
	}
	fson = !fson;
}

function init(){
	var ua = navigator.userAgent.toLowerCase();
	if(ua.indexOf("android") > -1 || ua.indexOf("iphone") > -1 || ua.indexOf("ipod") > -1 || ua.indexOf("ipad") > -1){
		ismobile = true;
	}
	if(ua.indexOf("iphone") > -1 || ua.indexOf("ipod") > -1 || ua.indexOf("ipad") > -1){
		isidevice = true;
		document.body.ongesturestart =
			document.body.ongesturechange =
			document.body.ongestureend =
				function(ev){
					ev.preventDefault();
				};
	}

	if(ismobile && !isidevice){
		let fsbutton = document.createElement("button");
		let li = document.createElement("li");
		fsbutton.title = "Toggle Fullscreen";
		fsbutton.className = "navitem";
		fsbutton.innerHTML = '<svg viewBox="0 0 14 14" class="navicon"><g fill-rule="evenodd" id="Page-1" stroke="none" stroke-width="1"><g id="Core" transform="translate(-257.000000, -257.000000)"><g id="fullscreen-exit" transform="translate(257.000000, 257.000000)"><path d="M0,11 L3,11 L3,14 L5,14 L5,9 L0,9 L0,11 L0,11 Z M3,3 L0,3 L0,5 L5,5 L5,0 L3,0 L3,3 L3,3 Z M9,14 L11,14 L11,11 L14,11 L14,9 L9,9 L9,14 L9,14 Z M11,3 L11,0 L9,0 L9,5 L14,5 L14,3 L11,3 L11,3 Z" id="Shape"/></g></g></g></svg>';
		fsbutton.onclick = togglefs;
		li.appendChild(fsbutton);
		document.getElementById("main-nav").appendChild(li);
	}
	clearStoredNotation();
	loadInterfaceSettings();
	const ninjaElement = document.getElementById("ninja");
	const ninjaParams = "&moveNumber=false&unplayedPieces=true&disableStoneCycling=true&showBoardPrefsBtn=false&disableNavigation=true&disablePTN=true&disableText=true&flatCounts=false&turnIndicator=false&showHeader=false&showEval=false&showRoads=false&stackCounts=false&notifyGame=false";
	if(window.location.host.indexOf("localhost") > -1 ||
		window.location.host.indexOf("127.0.0.1") > -1 ||
		window.location.host.indexOf("192.168.") == 0 ||
		window.location.host.indexOf("beta.playtak.com") > -1
	){
		ninjaElement.src = "https://next.ptn.ninja/" + ninjaParams;
	}
	else{
		ninjaElement.src = "https://ptn.ninja/" + ninjaParams;
	}
	if(localStorage.getItem("2d_board") === "true"){
		document.getElementById("ninja-wrapper").style.display = "block";
		document.getElementById("3d-settings").style.display = "none";
		document.getElementById("2d-settings").style.display = "block";
		document.getElementById('2d-board-checkbox').checked = true;
		is2DBoard = true;
		init2DBoard();
	}
	else{
		makeStyleSelector();
		load3DSettings();
		init3DBoard();
	}
	storeNotation();
}

function adjustsidemenu(notation,chat){
	var vertical = window.screen.width<window.screen.height;
	var notationstore = "shownotation"+(vertical?"v":"h");
	var chatstore = "showchat"+(vertical?"v":"h");

	var notationstate=localStorage[notationstore];
	if(notation=="show"){
		notationstate="show";
	}
	else if(notation=="hide"){
		notationstate="hide";
	}
	else if(notation=="toggle"){
		notationstate=notationstate=="show"?"hide":"show";
	}
	else{
		if(!(notationstate=="show" || notationstate=="hide")){
			notationstate=(window.innerWidth<600?"hide":"show");
		}
	}
	localStorage[notationstore]=notationstate;
	const rmenu = document.getElementById("rmenu");
	// check is the rmenu has the hidden attribute
	const rmenuHidden = rmenu.hasAttribute("hidden");
	if(typeof rmenuHidden !== 'undefined' && rmenuHidden !== false){
		if(notationstate=="show"){
			document.getElementById('notation-arrow').classList.add('rotate-arrow');
			document.getElementById("notation-toggle-text").style.left = "200px";
			rmenu.removeAttribute("hidden");
			adjustBoardWidth();
		}
	}
	else if(notationstate=="hide"){
		rmenu.setAttribute("hidden", "true");
		document.getElementById("notation-arrow").classList.remove("rotate-arrow");
		document.getElementById("notation-toggle-text").style.left = "0px";
		adjustBoardWidth();
	}

	var chatstate=localStorage[chatstore];
	if(chat=="show"){
		chatstate="show";
	}
	else if(chat=="hide"){
		chatstate="hide";
	}
	else if(chat=="toggle"){
		chatstate=chatstate=="show"?"hide":"show";
	}
	else{
		if(!(chatstate=="show" || chatstate=="hide")){
			chatstate=(window.innerWidth<600?"hide":"show");
		}
	}
	localStorage[chatstore]=chatstate;
	const cmenu = document.getElementById("cmenu");
	const cmenuHidden = cmenu.hasAttribute("hidden");
	if(typeof cmenuHidden !== 'undefined' && cmenuHidden !== false){
		if(chatstate=="show"){
			document.getElementById('chat-toggle-button').style.right = (chathandler.chat_width + 12) + "px";
			document.getElementById("chat-arrow").classList.remove("rotate-arrow");
			cmenu.removeAttribute("hidden");
			adjustBoardWidth();
		}
	}
	else if(chatstate=="hide"){
		document.getElementById("chat-toggle-button").style.right = "0px";
		document.getElementById("chat-arrow").classList.add("rotate-arrow");
		cmenu.setAttribute("hidden", "true");
		adjustBoardWidth();
	}
}

let settingsToggle = false;
function toggleSettingsDrawer(){
	const settings = document.getElementById("settings-drawer");
	if(!settingsToggle){
		settings.removeAttribute("hidden");
		settingsToggle = true;
	}
	else{
		settings.setAttribute("hidden", "true");
		settingsToggle = false;
	}
	adjustBoardWidth();
}

var menuToggle = false;
function toggleMobileMenu(){
	const header = document.getElementById('header');
	if(!menuToggle){
		header.style.height = "auto";
		hideElement("mobile-open");
		showElement("mobile-close", 'block');
		menuToggle = true;
	}
	else{
		header.style.height = "36px";
		hideElement("mobile-close");
		showElement("mobile-open", 'block');
		menuToggle = false;
	}
}

function closeMobileMenu(){
	if(!menuToggle){return;}
	const header = document.getElementById('header');
	header.style.height = "36px";
	hideElement("mobile-close");
	showElement("mobile-open", "block");
	menuToggle = false;
	generateCamera();
}

function showPrivacyPolicy(){
	$('#help-modal').modal('hide');
	$('#privacy-modal').modal('show');
}

function getHeader(key,val){
	return '['+key+' "'+val+'"]\r\n';
}

function openGameOverModal(){
	$('#gameoveralert').modal('show');
}

function copyGameIdToClipboard(){
	var gameId = gameData.id || "";
	navigator.clipboard.writeText(gameId).then(() => {
		alert('success','Copied Game ID: ' + gameId);
	}, () => {
		alert('danger','Unable to copy Game ID!');
	});
}

function getNotation(id){
	const p1 = $('.player1-name:first').html();
	const p2 = $('.player2-name:first').html();
	const date = new Date();

	if(id){
		const dt = date.getFullYear()+'.'+(date.getMonth()+1)+'.'+date.getDate()+' '+date.getHours()+'.'+getZero(date.getMinutes());
		$(`#${id || "download_notation"}`).attr("download", p1 + " vs " + p2 + " " + dt + ".ptn");
	}

	let res='';
	res += getHeader('Site','PlayTak.com');
	res += getHeader('Date',date.getFullYear()+'.'+(date.getMonth()+1)+'.'+date.getDate());
	res += getHeader('Player1',p1);
	res += getHeader('Player2',p2);
	res += getHeader('Size',gameData.size);
	res += getHeader('Komi',gameData.komi/2);
	res += getHeader('Flats',gameData.pieces);
	res += getHeader('Caps',gameData.capstones);
	res += getHeader('Result',gameData.result);
	res += '\r\n';

	$('#moveslist tr').each(function(){
		var line="";
		$('td',this).each(function(){
			var val = $(this).text();
			if(line && val){
				line += ' ';
			}
			line += val;
		});
		res += line+'\r\n';
	});

	return res;
}

function downloadNotation(id){
	$(`#${id}`).attr('href','data:text/plain;charset=utf-8,'+encodeURIComponent(getNotation(id)));
}

function copyNotationToClipboard(){
	var ptn = getNotation();
	navigator.clipboard.writeText(ptn).then(() => {
		alert('success','Copied PTN!');
	}, () => {
		alert('danger','Unable to copy!');
	});
}

function openInPtnNinja(){
	var link = 'http://ptn.ninja/' + encodeURIComponent(getNotation());
	window.open(link,'_blank');
}

function copyNotationLink(){
	var link = 'http://www.playtak.com/?load=' + encodeURIComponent(getNotation());

	navigator.clipboard.writeText(link).then(() => {
		alert('success','Copied PTN Link!');
	}, () => {
		alert('danger','Unable to copy!');
	});
}

function undoButton(){
	if(gameData.is_scratch){undoMove();}
	else{server.undo();}
}

function fastrewind(){
	firstMove();
}

function stepback(){
	previousMove();
}

function stepforward(){
	nextMove();
}

function fastforward(){
	lastMove();
}

function resetFormFieldAttributes(){
	const form = document.getElementById("create-game-form");
	// remove the required attribute from all elements
	const allFields = form.querySelectorAll("input, select");
	allFields.forEach(field => {
		field.removeAttribute("required");
		field.removeAttribute("disabled");
	});
}

function changePreset(event){
	resetFormFieldAttributes();
	const presetValue = event.target.value;

	const preset = gamePresets[presetValue];

	if(presetValue === "none"){
		const storedValues = JSON.parse(localStorage.getItem("current-game-settings") || '{}');
		if(!Object.keys(storedValues).length){return;}
		// get the stored values
		document.getElementById("boardsize").value = storedValues.size;
		document.getElementById("piececount").value = storedValues.pieces;
		document.getElementById("capcount").value = storedValues.capstones;
		document.getElementById("komiselect").value = storedValues.komi;
		document.getElementById("gametype").value = storedValues.type;
		document.getElementById("timeselect").value = storedValues.time;
		document.getElementById("incselect").value = storedValues.increment;
		document.getElementById("triggerMove").value = storedValues.trigger_move;
		document.getElementById("timeAmount").value = storedValues.time_amount;
		return;
	}
	else if(preset){
		// store the current values if user changes back to the noen preset
		const currentValues = {
			size: document.getElementById("boardsize").value,
			pieces: document.getElementById("piececount").value,
			capstones: document.getElementById("capcount").value,
			komi: document.getElementById("komiselect").value,
			type: document.getElementById("gametype").value,
			time: document.getElementById("timeselect").value,
			increment: document.getElementById("incselect").value,
			trigger_move: document.getElementById("triggerMove").value,
			time_amount: document.getElementById("timeAmount").value
		};
		localStorage.setItem("current-game-settings", JSON.stringify(currentValues));
		document.getElementById("boardsize").value = preset.size;
		document.getElementById("boardsize").setAttribute("disabled", "true");
		document.getElementById("piececount").value = preset.pieces;
		document.getElementById("piececount").setAttribute("disabled", "true");
		document.getElementById("capcount").value = preset.capstones;
		document.getElementById("capcount").setAttribute("disabled", "true");
		document.getElementById("komiselect").value = preset.komi;
		document.getElementById("komiselect").setAttribute("disabled", "true");
		document.getElementById("gametype").value = preset.type;
		document.getElementById("gametype").setAttribute("disabled", "true");
		document.getElementById("timeselect").value = preset.time;
		document.getElementById("timeselect").setAttribute("disabled", "true");
		document.getElementById("incselect").value = preset.increment;
		document.getElementById("incselect").setAttribute("disabled", "true");
		document.getElementById("triggerMove").value = preset.trigger_move;
		document.getElementById("triggerMove").setAttribute("disabled", "true");
		document.getElementById("timeAmount").value = preset.time_amount;
		document.getElementById("timeAmount").setAttribute("disabled", "true");
		// set the required attributes for the fields that are required in the preset
		for(let i = 0; i < preset.required_fields.length; i++){
			const element = document.getElementById(preset.required_fields[i]);
			if(element){
				element.setAttribute("required", "true");
			}
		}
		return;
	}
	else{
		alert('danger', 'Invalid game preset selected');
	}
}

function changeboardsize(){
	var size=document.getElementById("boardsize").value;
	var piecescaps = {"3": [10,0], "4": [15,0], "5": [21,1], "6": [30,1], "7": [40,2], "8": [50,2]}[size];
	if(piecescaps){
		document.getElementById("piececount").value=piecescaps[0];
		document.getElementById("capcount").value=piecescaps[1];
	}
}

function resetGameSettings(){
	resetFormFieldAttributes();
	// remove the stored values from localStorage
	localStorage.removeItem("current-game-settings");
	// reset the game settings to default values
	document.getElementById("boardsize").value = "5";
	document.getElementById("piececount").value = "21";
	document.getElementById("capcount").value = "1";
	document.getElementById("komiselect").value = "0";
	document.getElementById("gametype").value = "0";
	document.getElementById("timeselect").value = "600";
	document.getElementById("incselect").value = "20";
	document.getElementById("triggerMove").value = "";
	document.getElementById("timeAmount").value = "";
	document.getElementById("colorselect").value = "A";
	document.getElementById("opname").value = "";
	document.getElementById("preset").value = "none";
}

function loadGameSettings(){
	const storedValues = JSON.parse(localStorage.getItem("current-game-settings") || '{}');
	if(!Object.keys(storedValues).length){return;}
	document.getElementById("boardsize").value = storedValues.size;
	document.getElementById("piececount").value = storedValues.pieces;
	document.getElementById("capcount").value = storedValues.capstones;
	document.getElementById("komiselect").value = storedValues.komi;
	document.getElementById("gametype").value = storedValues.type;
	document.getElementById("timeselect").value = storedValues.time;
	document.getElementById("incselect").value = storedValues.increment;
	document.getElementById("triggerMove").value = storedValues.trigger_move;
	document.getElementById("colorselect").value = storedValues.color || "A";
}

function resetToLoginState(){
	// header reset
	hideElement("playerinfo");
	showElement("login-button", 'block');
	hideElement("logout-button");
	// Landing page reset
	hideElement("sign-up");
	hideElement("landing-login");
	hideElement("forgot-password");
	hideElement("play-button");
	hideElement("close-events");
	showElement("hero-actions");
	showElement("signup-button");
	showElement("landing-login-button");
	showElement("action-links");
}

function setLoggedInState(){
	// header
	hideElement("login-button");
	showElement("logout-button", "block");
	showElement("playerinfo");

	//Landing
	hideElement("signup-button");
	hideElement("landing-login-button");
	hideElement("action-links");
	hideElement("landing-login");
	showElement("play-button");
	showElement("hero-actions");
	showElement("close-events");
}

function showEvents(){
	showElement('landing');
	const element = document.getElementById("events");
	element.scrollIntoView();
}

function hideElement(element){
	document.getElementById(element).style.display = "none";
}

function showElement(element, type){
	document.getElementById(element).style.display = type || "flex";
}

// Landing functions
async function fetchEvents(){
	showElement('loading-events');
	try{
		let path = '/events';
		let url = 'https://api.' + window.location.host;
		if(
			window.location.host.indexOf("localhost") > -1 ||
			window.location.host.indexOf("127.0.0.1") > -1 ||
			window.location.host.indexOf("192.168.") == 0
		){
			url = "http://localhost:3004";
		}
		const results = await fetch(url + path, {
			method: 'GET'
		});
		const data = await results.json();
		createEventTable(data);
		hideElement('loading-events');
	}
	catch(error){
		hideElement("loading-events");
		console.error(error);
	}
}

function createEventTable(data){
	const filterButtons = document.getElementById("filter-buttons");
	filterButtons.classList = "flex gap--8 flex-wrap";
	// create the category buttons
	for(let i = 0; i < data.categories.length; i++){
		const categoryClean = data.categories[i].toLowerCase().replace(" ", "-");
		const filterButton = document.createElement("button");
		filterButton.innerHTML = data.categories[i];
		filterButton.id = `filter-${categoryClean}`;
		filterButton.classList = "btn btn-pill btn--secondary";
		if(categoryClean === "all"){
			filterButton.classList = "btn btn-pill btn-primary";
		}
		filterButton.onclick = () => filterTable(categoryClean);
		filterButtons.appendChild(filterButton);
	}

	const table = document.getElementById('event-data');
	for(let i = 0; i < data.data.length; i++){
		const el = data.data[i];
		const tr = table.insertRow(-1);
		tr.id = el.category.toLowerCase().replace(' ', '-');
		const name = tr.insertCell(-1);
		name.innerHTML = `<b>${el.name}</b>`;
		const dates = tr.insertCell(-1);
		const range =
			!el.start_date && !el.end_date
				? "TBD"
				: el.start_date && el.end_date ? `${el.start_date} - ${el.end_date}` : `${el.start_date || el.end_date}`;
		dates.innerHTML = range;
		const details = tr.insertCell(-1);
		details.innerHTML = el.details ? `<a href="${el.details}" target="_blank">Details</a>` : "";
		el.registration ? details.innerHTML += ` | <a href="${el.registration}" target="_blank">Registration</a> `: '';
		el.standings ? details.innerHTML += ` | <a href="${el.standings}" target="_blank">Standings</a> `: '';
	}
}

function filterTable(category){
	const table = document.getElementById('event-data');
	const trs = table.childNodes;
	const filterAll = document.getElementById('filter-all');
	// loop through button and reset classes
	const filterButtons = document.getElementById("filter-buttons");
	filterButtons.childNodes.forEach(el => {
		el.classList = 'btn btn-pill btn-secondary';
	});
	// reset styles for all filter
	if(category === 'all'){
		filterAll.classList = 'btn btn-pill btn-primary';
		trs.forEach(el => {
			el.style.display = '';
		});
		return;
	}
	// set active button style
	const button = document.getElementById(`filter-${category}`);
	button.classList = 'btn btn-pill btn-primary';
	filterAll.classList = 'btn btn-pill btn-secondary';

	// loop through rows and set display style
	trs.forEach(element => {
		element.style.display = element.id === category ? "" : "none";
	});
}

$(document).ready(function(){
	if(localStorage.getItem("2d_board") === "true"){
		is2DBoard = true;
	}
	if(localStorage.getItem('sound')==='false'){
		turnsoundoff();
	}
	chathandler.init();
	if(localStorage.getItem('keeploggedin') === 'true' && !is2DBoard){
		server.connect();
	}
	else if(!is2DBoard){
		server.connect();
	}
	if(localStorage.getItem("usr") && localStorage.getItem('disable-landing') === 'true'){
		hideElement('landing');
	}
	if(localStorage.getItem("isLoggedIn")){
		hideElement("signup-button");
		hideElement("landing-login-button");
		hideElement("action-links");
		showElement("play-button");
	}
	loadGameSettings();
	// get current game settings
	fetchEvents();
	init();
});