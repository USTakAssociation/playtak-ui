// View<->model bridge for the #incselect dropdown. The dropdown packs two server
// fields (a numeric increment + a boolean increment_scales) into one option token
// like "20" (fixed) or "1*n" (scales with move number). Increment is treated as
// numeric DATA everywhere; the string token only exists as the <select>.value.

// Decode an #incselect token into { increment: Number, increment_scales: Boolean }.
function parseIncrementValue(value) {
	const str = String(value ?? "0");
	const scales = str.endsWith("*n");
	const increment = parseInt(scales ? str.slice(0, -2) : str, 10) || 0;
	return { increment, increment_scales: scales };
}

// Encode { increment, increment_scales } back into an #incselect token ("20" / "1*n").
function incrementTokenForSelect(increment, increment_scales) {
	return increment_scales ? `${increment}*n` : String(increment);
}

const gamePresets = {
	beginner: {
		size: 6,
		komi: 4,
		type: 1, // 1 for tournament, 0 for normal, 2 for unrated
		pieces: 30,
		capstones: 1,
		time: 900,
		increment: 10,
		increment_scales: false,
		trigger_move: "",
		time_amount: "",
		required_fields: ["opname"],
	},
	intermediate: {
		size: 6,
		komi: 4,
		type: 1,
		pieces: 30,
		capstones: 1,
		time: 900,
		increment: 10,
		increment_scales: false,
		trigger_move: "",
		time_amount: "",
		required_fields: ["opname"],
	},
	league: {
		size: 6,
		komi: 4,
		type: 1,
		pieces: 30,
		capstones: 1,
		time: 600, // seconds
		increment: 20,
		increment_scales: false,
		trigger_move: "",
		time_amount: "", // seconds
		required_fields: ["opname"],
	},
	"7_open": {
		size: 7,
		komi: 4,
		type: 1,
		pieces: 40,
		capstones: 2,
		time: 1200, // seconds
		increment: 15,
		increment_scales: false,
		trigger_move: 40,
		time_amount: 600, // seconds
		required_fields: ["opname"],
	},
	"7_blitz": {
		size: 7,
		komi: 4,
		type: 1,
		pieces: 40,
		capstones: 2,
		time: 300, // seconds
		increment: 5,
		increment_scales: false,
		trigger_move: "",
		time_amount: "", // seconds
		required_fields: ["opname"],
	},
	"trans-atlan": {
		size: 6,
		komi: 4,
		type: 1,
		pieces: 30,
		capstones: 1,
		time: 1200, // seconds
		increment: 15,
		increment_scales: false,
		trigger_move: "35",
		time_amount: "600", // seconds
		required_fields: ["opname"],
	},
	"tak-open": {
		size: 6,
		komi: 4,
		type: 1,
		pieces: 30,
		capstones: 1,
		time: 900, // seconds
		increment: 15,
		increment_scales: false,
		trigger_move: "",
		time_amount: "", // seconds
		required_fields: ["opname"],
	},
	mentee: {
		size: 6,
		komi: 4,
		type: 1,
		pieces: 30,
		capstones: 1,
		time: 600, // seconds
		increment: 15,
		increment_scales: false,
		trigger_move: "",
		time_amount: "", // seconds
		required_fields: ["opname"],
	},
	"tiebreaker-blitz": {
		size: 6,
		komi: 4,
		type: 1,
		pieces: 30,
		capstones: 1,
		time: 180, // seconds
		increment: 5,
		increment_scales: false,
		trigger_move: "",
		time_amount: "", // seconds
		required_fields: ["opname"],
	}
};
// MIT Icon https://www.svgrepo.com/svg/343672/fullscreen-exit
const fullscreenIcon = `<svg class="navicon-20" viewBox="0 0 32 32" fill="none" stroke="currentcolor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M4 12 L12 12 12 4 M20 4 L20 12 28 12 M4 20 L12 20 12 28 M28 20 L20 20 20 28" fill="none"/></svg>`;
// PD Icon https://www.svgrepo.com/svg/502614/delete
const deleteIcon = `<svg viewBox="0 0 24 24" fill="none"><g fill="none" stroke="var(--primary-stroke-color)"><path d="M10 11V17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11V17" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 7H20" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 7H12H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V7Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7H9V5Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
// Lucide Icons (ISC) - swords - https://lucide.dev/icons/swords
const challengeIcon = `<svg class="navicon-20" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><g fill="none" stroke="var(--primary-stroke-color)" stroke-width="2" transform="translate(12 12) scale(1.3) translate(-12 -12)"><path d="m13 19 6-6" /><path d="M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5" /><path d="m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586" /><path d="m16 16 4 4" /><path d="m19 21 2-2" /><path d="m5 14 4 4" /><path d="m5 21-2-2" /><path d="M7.5 16.5 4 20" /></g></svg>`;
// Message Square Plus Icon - Dazzle UI | https://www.svgrepo.com/svg/533278/message-square-plus
const messageIcon =	`<svg viewBox="0 0 24 24" fill="none"><path d="M9 11H15M12 8V14M21 20L17.6757 18.3378C17.4237 18.2118 17.2977 18.1488 17.1656 18.1044C17.0484 18.065 16.9277 18.0365 16.8052 18.0193C16.6672 18 16.5263 18 16.2446 18H6.2C5.07989 18 4.51984 18 4.09202 17.782C3.71569 17.5903 3.40973 17.2843 3.21799 16.908C3 16.4802 3 15.9201 3 14.8V7.2C3 6.07989 3 5.51984 3.21799 5.09202C3.40973 4.71569 3.71569 4.40973 4.09202 4.21799C4.51984 4 5.0799 4 6.2 4H17.8C18.9201 4 19.4802 4 19.908 4.21799C20.2843 4.40973 20.5903 4.71569 20.782 5.09202C21 5.51984 21 6.0799 21 7.2V20Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="var(--primary-stroke-color)"/></svg>`;
// PD Icon https://www.svgrepo.com/svg/535754/dots-vertical
const ellipsisIcon = `<svg viewBox="0 0 16 16" fill="none"><path d="M8 12C9.10457 12 10 12.8954 10 14C10 15.1046 9.10457 16 8 16C6.89543 16 6 15.1046 6 14C6 12.8954 6.89543 12 8 12Z"/><path d="M8 6C9.10457 6 10 6.89543 10 8C10 9.10457 9.10457 10 8 10C6.89543 10 6 9.10457 6 8C6 6.89543 6.89543 6 8 6Z"/><path d="M10 2C10 0.89543 9.10457 -4.82823e-08 8 0C6.89543 4.82823e-08 6 0.895431 6 2C6 3.10457 6.89543 4 8 4C9.10457 4 10 3.10457 10 2Z"/></svg>`;
//  MLP Icon https://www.svgrepo.com/svg/503004/close
const closeIcon = `<svg class="navicon-20" viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M19.207 6.207a1 1 0 0 0-1.414-1.414L12 10.586 6.207 4.793a1 1 0 0 0-1.414 1.414L10.586 12l-5.793 5.793a1 1 0 1 0 1.414 1.414L12 13.414l5.793 5.793a1 1 0 0 0 1.414-1.414L13.414 12l5.793-5.793z"/></svg>`
// PD icon https://www.svgrepo.com/svg/505373/eye-open 
const watchIcon = `<svg viewBox="0 0 24 24" fill="none"><g fill="none" stroke="var(--primary-stroke-color)"><path d="M12 5C5.63636 5 2 12 2 12C2 12 5.63636 19 12 19C18.3636 19 22 12 22 12C22 12 18.3636 5 12 5Z" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

// Evaluated at load rather than inside init(): prefers2DBoard() reads ismobile
// from $(document).ready, which runs before init() does. Leaving it unset until
// init() would make the two prefers2DBoard() call sites disagree.
function isMobileUserAgent() {
	const ua = navigator.userAgent.toLowerCase();
	return (
		ua.indexOf("android") > -1 ||
		ua.indexOf("iphone") > -1 ||
		ua.indexOf("ipod") > -1 ||
		ua.indexOf("ipad") > -1
	);
}

let ismobile = isMobileUserAgent();
let isidevice = false;
let fixedcamera = false;
let clickthrough = true;
let hovertext = true;
let pixelratio = 1;
let rendererdone = false;
let clearcolor = parseInt(boardDefaults.backgroundColor.replace("#", "0x"));

let settingscounter = 0;
let is2DBoard = false;
let fson = false;

// Which board to show. An explicit choice always wins; only users who have never
// picked a side fall through to the mobile default. The default is deliberately
// not persisted, so it never silently locks a mode in.
function prefers2DBoard() {
	const stored = localStorage.getItem("2d_board");
	if (stored === "true") {
		return true;
	}
	if (stored === "false") {
		return false;
	}
	return ismobile;
}

function alert(type, msg) {
	$("#alert-text").text(msg);
	const $alert = $("#alert");
	$alert.removeClass("alert-success alert-info alert-warning alert-danger");

	$alert.addClass("alert-" + type);
	$alert.removeAttr("style");
	$alert.stop(true, true);
	$alert.fadeTo(7000, 500).slideUp(500, function () {
		$alert.css("display", "none");
	});
}

function togglefs() {
	if (fson) {
		document.exitFullscreen();
	} else {
		document.documentElement.requestFullscreen();
	}
	fson = !fson;
}

function init() {
	// ismobile is already set at load; isidevice stays here because it attaches
	// gesture handlers to document.body.
	const ua = navigator.userAgent.toLowerCase();
	if (
		ua.indexOf("iphone") > -1 ||
		ua.indexOf("ipod") > -1 ||
		ua.indexOf("ipad") > -1
	) {
		isidevice = true;
		document.body.ongesturestart =
			document.body.ongesturechange =
			document.body.ongestureend =
				function (ev) {
					ev.preventDefault();
				};
	}

	if (ismobile && !isidevice) {
		let fsbutton = document.createElement("button");
		let li = document.createElement("li");
		fsbutton.title = "Toggle Fullscreen";
		fsbutton.className = "navitem";
		fsbutton.innerHTML = fullscreenIcon;
		fsbutton.onclick = togglefs;
		li.appendChild(fsbutton);
		document.getElementById("main-nav").appendChild(li);
	}
	clearStoredNotation();
	loadInterfaceSettings();
	const ninjaElement = document.getElementById("ninja");
	// Show game header (turn indicator, player names, clocks) defaults to true,
	// but honor the user's saved preference when loading the iframe.
	const showHeader = localStorage.getItem("2d-header") !== "false";
	const ninjaParams =
		"&moveNumber=false&unplayedPieces=true&disableStoneCycling=true&showBoardPrefsBtn=false&disableNavigation=true&disablePTN=true&disableText=true&flatCounts=false&turnIndicator=" +
		showHeader +
		"&gameTimer=" +
		showHeader +
		"&showHeader=false&showEval=false&showRoads=false&stackCounts=false&notifyGame=false";
	if (
		window.location.host.indexOf("localhost") > -1 ||
		window.location.host.indexOf("127.0.0.1") > -1 ||
		window.location.host.indexOf("192.168.") == 0 ||
		window.location.host.indexOf("beta.playtak.com") > -1
	) {
		ninjaElement.src = "https://next.ptn.ninja/" + ninjaParams;
	} else {
		ninjaElement.src = "https://ptn.ninja/" + ninjaParams;
	}
	if (prefers2DBoard()) {
		document.getElementById("ninja-wrapper").style.display = "block";
		document.getElementById("3d-settings").style.display = "none";
		document.getElementById("2d-settings").style.display = "block";
		is2DBoard = true;
		init2DBoard();
	} else {
		makeStyleSelector();
		load3DSettings();
		init3DBoard();
	}
	updateBoardModeButtons();
	storeNotation();
}

function adjustsidemenu(notation, chat) {
	const vertical = window.screen.width < window.screen.height;
	const notationstore = "shownotation" + (vertical ? "v" : "h");
	const chatstore = "showchat" + (vertical ? "v" : "h");

	let notationstate = localStorage[notationstore];
	if (notation == "show") {
		notationstate = "show";
	} else if (notation == "hide") {
		notationstate = "hide";
	} else if (notation == "toggle") {
		notationstate = notationstate == "show" ? "hide" : "show";
	} else {
		if (!(notationstate == "show" || notationstate == "hide")) {
			notationstate = window.innerWidth < 600 ? "hide" : "show";
		}
	}
	localStorage[notationstore] = notationstate;
	const rmenu = document.getElementById("rmenu");
	// check is the rmenu has the hidden attribute
	const rmenuHidden = rmenu.hasAttribute("hidden");
	if (typeof rmenuHidden !== "undefined" && rmenuHidden !== false) {
		if (notationstate == "show") {
			document.getElementById("notation-arrow").classList.add("rotate-arrow");
			document.getElementById("notation-toggle-text").style.left = "200px";
			rmenu.removeAttribute("hidden");
			adjustBoardWidth();
		}
	} else if (notationstate == "hide") {
		rmenu.setAttribute("hidden", "true");
		document.getElementById("notation-arrow").classList.remove("rotate-arrow");
		document.getElementById("notation-toggle-text").style.left = "0px";
		adjustBoardWidth();
	}

	let chatstate = localStorage[chatstore];
	if (chat == "show") {
		chatstate = "show";
	} else if (chat == "hide") {
		chatstate = "hide";
	} else if (chat == "toggle") {
		chatstate = chatstate == "show" ? "hide" : "show";
	} else {
		if (!(chatstate == "show" || chatstate == "hide")) {
			chatstate = window.innerWidth < 600 ? "hide" : "show";
		}
	}
	localStorage[chatstore] = chatstate;
	const cmenu = document.getElementById("cmenu");
	const cmenuHidden = cmenu.hasAttribute("hidden");
	if (typeof cmenuHidden !== "undefined" && cmenuHidden !== false) {
		if (chatstate == "show") {
			document.getElementById("chat-toggle-button").style.right =
				chathandler.chat_width + 12 + "px";
			document.getElementById("chat-arrow").classList.remove("rotate-arrow");
			cmenu.removeAttribute("hidden");
			adjustBoardWidth();
		}
	} else if (chatstate == "hide") {
		document.getElementById("chat-toggle-button").style.right = "0px";
		document.getElementById("chat-arrow").classList.add("rotate-arrow");
		cmenu.setAttribute("hidden", "true");
		adjustBoardWidth();
	}
}

let settingsToggle = false;
function toggleSettingsDrawer() {
	const settings = document.getElementById("settings-drawer");
	if (!settingsToggle) {
		settings.removeAttribute("hidden");
		settingsToggle = true;
	} else {
		settings.setAttribute("hidden", "true");
		settingsToggle = false;
	}
	adjustBoardWidth();
}

let menuToggle = false;
function toggleMobileMenu() {
	const header = document.getElementById("header");
	if (!menuToggle) {
		header.style.height = "auto";
		hideElement("mobile-open");
		showElement("mobile-close", "block");
		menuToggle = true;
	} else {
		header.style.height = "36px";
		hideElement("mobile-close");
		showElement("mobile-open", "block");
		menuToggle = false;
	}
}

function closeMobileMenu() {
	if (!menuToggle) {
		return;
	}
	const header = document.getElementById("header");
	header.style.height = "36px";
	hideElement("mobile-close");
	showElement("mobile-open", "block");
	menuToggle = false;
	generateCamera();
}

function showPrivacyPolicy() {
	$("#help-modal").modal("hide");
	$("#privacy-modal").modal("show");
}

function getHeader(key, val) {
	return "[" + key + ' "' + val + '"]\r\n';
}

function openGameOverModal() {
	$("#gameoveralert").modal("show");
}

function copyGameIdToClipboard() {
	const gameId = gameData.id || "";
	navigator.clipboard.writeText(gameId).then(
		() => {
			alert("success", "Copied Game ID: " + gameId);
		},
		() => {
			alert("danger", "Unable to copy Game ID!");
		},
	);
}

function getNotation(id) {
	const p1 = $(".player1-name:first").html();
	const p2 = $(".player2-name:first").html();
	const date = new Date();

	if (id) {
		const dt =
			date.getFullYear() +
			"." +
			(date.getMonth() + 1) +
			"." +
			date.getDate() +
			" " +
			date.getHours() +
			"." +
			getZero(date.getMinutes());
		$(`#${id || "download_notation"}`).attr(
			"download",
			p1 + " vs " + p2 + " " + dt + ".ptn",
		);
	}

	let res = "";
	res += getHeader("Site", "PlayTak.com");
	res += getHeader(
		"Date",
		date.getFullYear() + "." + (date.getMonth() + 1) + "." + date.getDate(),
	);
	res += getHeader("Player1", p1);
	res += getHeader("Player2", p2);
	res += getHeader("Size", gameData.size);
	res += getHeader("Komi", gameData.komi / 2);
	res += getHeader("Flats", gameData.pieces);
	res += getHeader("Caps", gameData.capstones);
	// Opening variant (PTN Ninja tag). Omitted for the default "swap".
	if (gameData.opening && gameData.opening !== "swap") {
		res += getHeader("Opening", gameData.opening);
	}
	res += getHeader("Result", gameData.result);
	res += "\r\n";

	$("#moveslist tr").each(function () {
		let line = "";
		$("td", this).each(function () {
			const val = $(this).text();
			if (line && val) {
				line += " ";
			}
			line += val;
		});
		res += line + "\r\n";
	});

	return res;
}

function downloadNotation(id) {
	$(`#${id}`).attr(
		"href",
		"data:text/plain;charset=utf-8," + encodeURIComponent(getNotation(id)),
	);
}

function copyNotationToClipboard() {
	const ptn = getNotation();
	navigator.clipboard.writeText(ptn).then(
		() => {
			alert("success", "Copied PTN!");
		},
		() => {
			alert("danger", "Unable to copy!");
		},
	);
}

function openInPtnNinja() {
	const link = "https://ptn.ninja/" + encodeURIComponent(getNotation());
	window.open(link, "_blank");
}

function copyNotationLink() {
	const link =
		"https://www.playtak.com/?load=" + encodeURIComponent(getNotation());

	navigator.clipboard.writeText(link).then(
		() => {
			alert("success", "Copied PTN Link!");
		},
		() => {
			alert("danger", "Unable to copy!");
		},
	);
}

function undoButton() {
	if (gameData.is_scratch) {
		undoMove();
	} else {
		server.undo();
	}
}

function fastrewind() {
	firstMove();
}

function stepback() {
	previousMove();
}

function stepforward() {
	nextMove();
}

function fastforward() {
	lastMove();
}

function resetFormFieldAttributes() {
	const form = document.getElementById("create-game-form");
	// remove the required attribute from all elements
	const allFields = form.querySelectorAll("input, select");
	allFields.forEach((field) => {
		field.removeAttribute("required");
		field.removeAttribute("disabled");
	});
}

function changePreset(event) {
	resetFormFieldAttributes();
	const presetValue = event.target.value;

	const preset = gamePresets[presetValue];

	if (presetValue === "none") {
		const storedValues = JSON.parse(
			localStorage.getItem("current-game-settings") || "{}",
		);
		if (!Object.keys(storedValues).length) {
			return;
		}
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
		document.getElementById("openingselect").value = storedValues.opening || "swap";
		return;
	} else if (preset) {
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
			time_amount: document.getElementById("timeAmount").value,
			opening: document.getElementById("openingselect").value,
		};
		localStorage.setItem(
			"current-game-settings",
			JSON.stringify(currentValues),
		);
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
		document.getElementById("incselect").value = incrementTokenForSelect(preset.increment, preset.increment_scales);
		document.getElementById("incselect").setAttribute("disabled", "true");
		document.getElementById("triggerMove").value = preset.trigger_move;
		document.getElementById("triggerMove").setAttribute("disabled", "true");
		document.getElementById("timeAmount").value = preset.time_amount;
		document.getElementById("timeAmount").setAttribute("disabled", "true");
		// set the required attributes for the fields that are required in the preset
		for (let i = 0; i < preset.required_fields.length; i++) {
			const element = document.getElementById(preset.required_fields[i]);
			if (element) {
				element.setAttribute("required", "true");
			}
		}
		return;
	} else {
		alert("danger", "Invalid game preset selected");
	}
}

function changeboardsize() {
	const size = document.getElementById("boardsize").value;
	const piecescaps = {
		3: [10, 0],
		4: [15, 0],
		5: [21, 1],
		6: [30, 1],
		7: [40, 2],
		8: [50, 2],
	}[size];
	if (piecescaps) {
		document.getElementById("piececount").value = piecescaps[0];
		document.getElementById("capcount").value = piecescaps[1];
	}
}

function resetGameSettings() {
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
	document.getElementById("openingselect").value = "swap";
	document.getElementById("opname").value = "";
	document.getElementById("preset").value = "none";
}

function loadGameSettings() {
	const storedValues = JSON.parse(
		localStorage.getItem("current-game-settings") || "{}",
	);
	if (!Object.keys(storedValues).length) {
		return;
	}
	document.getElementById("boardsize").value = storedValues.size;
	document.getElementById("piececount").value = storedValues.pieces;
	document.getElementById("capcount").value = storedValues.capstones;
	document.getElementById("komiselect").value = storedValues.komi;
	document.getElementById("gametype").value = storedValues.type;
	document.getElementById("timeselect").value = storedValues.time;
	document.getElementById("incselect").value = storedValues.increment;
	document.getElementById("triggerMove").value = storedValues.trigger_move;
	document.getElementById("colorselect").value = storedValues.color || "A";
	document.getElementById("openingselect").value = storedValues.opening || "swap";
}

function resetToLoginState() {
	// header reset
	hideElement("playerinfo");
	showElement("login-button", "block");
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

function setLoggedInState() {
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

function showEvents() {
	showElement("landing");
	const element = document.getElementById("events");
	element.scrollIntoView();
}

function hideElement(element) {
	document.getElementById(element).style.display = "none";
}

function showElement(element, type) {
	document.getElementById(element).style.display = type || "flex";
}

// Landing functions
async function fetchEvents() {
	showElement("loading-events");
	try {
		let path = "/events";
		let url = "https://api." + window.location.host;
		if (
			window.location.host.indexOf("localhost") > -1 ||
			window.location.host.indexOf("127.0.0.1") > -1 ||
			window.location.host.indexOf("192.168.") == 0
		) {
			url = "http://localhost:3004";
		}
		const results = await fetch(url + path, {
			method: "GET",
		});
		// An error response is still JSON, so parsing it succeeds and the failure
		// only surfaced once createEventTable read .categories off it. The events
		// list comes from a Google Sheet the API reaches with a credential that
		// contributors do not have, so a local API answers 500 as a matter of
		// course — check the response here and report it once, rather than as a
		// TypeError from the middle of rendering.
		if (!results.ok) {
			throw new Error(
				`Events request failed: ${results.status} ${results.statusText}`,
			);
		}
		const data = await results.json();
		if (!data || !Array.isArray(data.categories) || !Array.isArray(data.data)) {
			throw new Error("Events response is missing its categories/data lists");
		}
		createEventTable(data);
		hideElement("loading-events");
	} catch (error) {
		hideElement("loading-events");
		console.error(error);
	}
}

function createEventTable(data) {
	const filterButtons = document.getElementById("filter-buttons");
	filterButtons.classList = "flex gap--8 flex-wrap";
	// create the category buttons
	for (let i = 0; i < data.categories.length; i++) {
		const categoryClean = data.categories[i].toLowerCase().replace(" ", "-");
		const filterButton = document.createElement("button");
		filterButton.innerHTML = data.categories[i];
		filterButton.id = `filter-${categoryClean}`;
		filterButton.classList = "btn btn-pill btn--secondary";
		if (categoryClean === "all") {
			filterButton.classList = "btn btn-pill btn-primary";
		}
		filterButton.onclick = () => filterTable(categoryClean);
		filterButtons.appendChild(filterButton);
	}

	const table = document.getElementById("event-data");
	for (let i = 0; i < data.data.length; i++) {
		const el = data.data[i];
		const tr = table.insertRow(-1);
		tr.id = el.category.toLowerCase().replace(" ", "-");
		const name = tr.insertCell(-1);
		name.innerHTML = `<b>${el.name}</b>`;
		const dates = tr.insertCell(-1);
		const range =
			!el.start_date && !el.end_date
				? "TBD"
				: el.start_date && el.end_date
					? `${el.start_date} - ${el.end_date}`
					: `${el.start_date || el.end_date}`;
		dates.innerHTML = range;
		const details = tr.insertCell(-1);
		details.innerHTML = el.details
			? `<a href="${el.details}" target="_blank">Details</a>`
			: "";
		el.registration
			? (details.innerHTML += ` | <a href="${el.registration}" target="_blank">Registration</a> `)
			: "";
		el.standings
			? (details.innerHTML += ` | <a href="${el.standings}" target="_blank">Standings</a> `)
			: "";
	}
}

function filterTable(category) {
	const table = document.getElementById("event-data");
	const trs = table.childNodes;
	const filterAll = document.getElementById("filter-all");
	// loop through button and reset classes
	const filterButtons = document.getElementById("filter-buttons");
	filterButtons.childNodes.forEach((el) => {
		el.classList = "btn btn-pill btn-secondary";
	});
	// reset styles for all filter
	if (category === "all") {
		filterAll.classList = "btn btn-pill btn-primary";
		trs.forEach((el) => {
			el.style.display = "";
		});
		return;
	}
	// set active button style
	const button = document.getElementById(`filter-${category}`);
	button.classList = "btn btn-pill btn-primary";
	filterAll.classList = "btn btn-pill btn-secondary";

	// loop through rows and set display style
	trs.forEach((element) => {
		element.style.display = element.id === category ? "" : "none";
	});
}

$(document).ready(function () {
	if (prefers2DBoard()) {
		is2DBoard = true;
	}
	if (localStorage.getItem("sound") === "false") {
		turnsoundoff();
	}
	chathandler.init();
	if (localStorage.getItem("keeploggedin") === "true" && !is2DBoard) {
		server.connect();
	} else if (!is2DBoard) {
		server.connect();
	}
	if (
		localStorage.getItem("usr") &&
		localStorage.getItem("disable-landing") === "true"
	) {
		hideElement("landing");
	}
	if (localStorage.getItem("isLoggedIn")) {
		hideElement("signup-button");
		hideElement("landing-login-button");
		hideElement("action-links");
		showElement("play-button");
	}
	loadGameSettings();
	// opt-in Bootstrap popovers (e.g. the increment-scaling help in the create-game form)
	$('[data-toggle="popover"]').popover();
	// get current game settings
	fetchEvents();
	init();
});
