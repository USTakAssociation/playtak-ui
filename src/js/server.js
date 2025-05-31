function randomtoken(){
	var a,b
	var s=Math.random()+";"+Math.random()+";"+Math.random()+";"+(+new Date())+";"
	if(window.crypto){
		var a = new Uint8Array(16)
		crypto.getRandomValues(a)
		for(b=0;b<16;b++){
			s+=a[b]+";"
		}
	}
	if(window.performance && performance.now){
		s+=performance.now()+";"
	}
	var rands=[0,0,0,0]
	var muls=[10007,10069,10093,10099]
	var mods=[2000000011,2000000063,2000000099,2000000333]
	for(a=0;a<s.length;a++){
		for(b=0;b<4;b++){
			var cc=s.charCodeAt(a)
			rands[b]=((rands[b]^cc)*muls[b])%mods[b]
		}
	}
	var out=""
	for(a=0;a<4;a++){
		for(b=0;b<5;b++){
			out+=String.fromCharCode(97+rands[a]%26)
			rands[a]=Math.floor(rands[a]/26)
		}
	}
	return out
}
function refreshguesttoken(){
	var now=+new Date()
	var tokenexpire=+localStorage["guesttokendecay"]
	if(tokenexpire && now<tokenexpire){
		localStorage.setItem("guesttokendecay",now+3600*1000*4)
	}
}
refreshguesttoken()
setInterval(refreshguesttoken,3600*1000)

function decode_utf8(ar){
	var a
	out=""
	var intermediate=0
	var missing=0
	for(a=0;a<ar.length;a++){
		var code=ar[a]
		if(missing==0){
			if(code<128){
				out+=String.fromCharCode(code)
			}
			else if(code>=192){
				if(code<224){
					intermediate=code-192
					missing=1
				}
				else if(code<240){
					intermediate=code-224
					missing=2
				}
				else if(code<248){
					intermediate=code-240
					missing=3
				}
				else{
					out+="?"
				}
			}
			else{
				out+="?"
			}
		}
		else{
			if(code<128 || code>=192){
				missing=0
				out+="?"
			}
			else{
				intermediate=intermediate*64+code-128
				missing--
				if(missing==0){
					if(intermediate<0x10000){
						out+=String.fromCharCode(intermediate)
					}
					else{
						intermediate -= 0x10000
						out+=String.fromCharCode((intermediate >> 10) + 0xD800,(intermediate % 0x400) + 0xDC00)
					}
				}
			}
		}
	}
	return out
}

waitinginterval=null
function waitforreply(){
	if(waitinginterval===null){
		waitinginterval=setInterval(waitedtoolong,4000)
	}
}
function gotreply(){
	if(waitinginterval!==null){
		clearInterval(waitinginterval)
		waitinginterval=null
	}
}
function waitedtoolong(){
	alert("danger","Server unresponsive")
}

function invarianttime(){
	if(window.performance && performance.now){
		return Math.floor(performance.now())
	}
	return +(new Date())
}

function minuteseconds(seconds){
	seconds=+seconds
	var minutes=Math.floor(seconds/60)
	seconds=seconds%60
	return (minutes>0?minutes:"")+":"+(seconds<10?"0":"")+seconds
}

function startswith(start,str){
	return str.slice(0,start.length)===start
}

async function getPlayersRating(playerName) {
	if (!playerName) {
		return 0;
	}
	// if player name is guest then return
	if (playerName.startsWith("Guest")) {
		return 0;
	}
	// set the url based on the current host
	let url = '';
	// if localhost, use the local server
	if (window.location.host.indexOf("localhost") > -1 || window.location.host.indexOf("127.0.0.1") > -1) {
		url = 'http://localhost:3004/v1/ratings/' + playerName;
	}
	// if in beta use the beta api url
	else if (window.location.host.indexOf("beta") > -1) {
		url = 'https://api.beta.playtak.com/v1/ratings/' + playerName;
	} else  {
		url = 'https://api.playtak.com/v1/ratings/' + playerName;
	}
	// fetch the data from the server
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Response status: ${response.status}`);
		}
		const json = await response.json();
		if (json.rating) {
			return json.rating;
		} else {
			return 0;
		}
	} catch (error) {
		console.error(error.message);
		return null;
	}
}

var server = {
	connection: null,
	timeoutvar: null,
	myname: null,
	myRating: 0,
	tries: 0,
	timervar: null,
	lastTimeUpdate: null,
	anotherlogin: false,
	loggedin: false,
	seekslist: [],
	gameslist: [],
	onlinePlayers: [],
	changeseektime: 0,
	newSeek: false

	,connect:function(){
		if(this.connection && this.connection.readyState>1){
			this.connection = null
		}
		if(this.anotherlogin){
			return
		}
		if(!this.connection){
			var proto = 'wss://'
			var url = window.location.host + '/ws'
			if(window.location.host.indexOf("localhost")>-1 || window.location.host.indexOf("127.0.0.1")>-1 || window.location.host.indexOf("192.168.")==0){
				proto = 'ws://'
				url=window.location.host.replace(/\:\d+$/,"")+":9999" + '/ws'
				// uncomment to play locally against the live server
				//url = "www.playtak.com:9999/ws";
			}
			this.connection = new WebSocket(proto+url,"binary")
			this.connection.onerror = function(e){
				console.error("Connection error: " + e);
			}
			this.connection.onmessage = function(e){
				var blob = e.data
				var reader = new FileReader()
				reader.onload = function(event){
					var ui8a=new Uint8Array(reader.result)
					var res_text=decode_utf8(ui8a)
					server.msg(res_text)
				}
				reader.readAsArrayBuffer(blob)
				gotreply()
			}
			this.connection.onclose = function(e){
				server.loggedin=false
				resetToLoginState();
				$('#onlineplayers').addClass('hidden')
				document.getElementById("onlineplayersbadge").innerHTML = "0"
				document.getElementById("seekcount").innerHTML = "0"
				document.getElementById("seekcountbot").innerHTML = "0"
				document.getElementById("gamecount").innerHTML = "0"
				board.scratch = true
				board.observing = false
				board.gameno = 0
				document.title = "Play Tak"
				server.myname=null
				server.seekslist=[]
				server.gameslist=[]
				server.rendeergameslist()
				server.rendeerseekslist()
				server.updateplayerinfo()
				stopTime()
				document.getElementById("removeSeek").removeAttribute("disabled");
				document.getElementById("createSeek").removeAttribute("disabled");

				if(localStorage.getItem('keeploggedin')==='true' && !server.anotherlogin){
					alert("info","Connection lost. Trying to reconnect...")
					server.startLoginTimer()
				}
				else{
					alert("info","You're disconnected from server")
				}
			}
		}
	}
	,logout:function(){
		localStorage.removeItem('keeploggedin');
		localStorage.removeItem('usr');
		localStorage.removeItem('token');
		localStorage.removeItem('isLoggedIn');
		localStorage.removeItem("guesttoken");
		localStorage.removeItem("guesttokendecay");
		this.seekslist = [];
		this.gameslist = [];
		this.myname = null;
		this.myRating = 0;
		document.getElementById("removeSeek").removeAttribute("disabled");
		document.getElementById("createSeek").removeAttribute("disabled");
		resetToLoginState();
		if(this.connection){
			this.connection.close()
			alert("info","Disconnnecting from server....")
			this.connection=null
		}
	}
	,loginbutton:function(){
		this.logout();
		showElement('landing');
	}

	,loginTimer:null

	,startLoginTimer:function(){
		if(server.loginTimer !== null){return}
		server.loginTimer = setTimeout(server.loginTimerFn,5000)
	}

	,stopLoginTimer:function(){
		if(server.loginTimer == null){return}
		clearTimeout(server.loginTimer)
		server.loginTimer = null
	}

	,loginTimerFn:function(){
		if(!server.anotherlogin){
			server.connect()
			server.loginTimer = setTimeout(server.loginTimerFn,5000)
		}
		else{
			server.loginTimer = null
		}
	}
	
	,sendClient:function(){
		server.send("Client TakWeb-22.04.12")
		server.send("Protocol 2")
	}

	,login:function(){
		this.anotherlogin=false
		this.connect()
		if(this.connection.readyState==0){
			this.connection.onopen=function(){server.login()}
		}
		else if(this.connection.readyState==1){
			var name = $('#login-username').val().replace(/\s/g,"")
			var pass = $('#login-pwd').val()

			server.sendClient()
			this.send("Login " + name + " " + pass)
		}
	}
	,guestlogin:function(){
		this.anotherlogin=false
		this.connect()
		if(this.connection.readyState==0){
			this.connection.onopen=function(){server.guestlogin()}
		}
		else if(this.connection.readyState==1){
			var now=+new Date()
			var tokenexpire=+localStorage["guesttokendecay"]
			var token
			if(tokenexpire && now<tokenexpire){
				token=localStorage["guesttoken"]
			}
			else{
				token=randomtoken()
				localStorage.setItem("guesttoken",token)
			}
			localStorage.setItem("guesttokendecay",now+3600*1000*4)
			server.sendClient()
			this.send("Login Guest "+token)
		}
	}
	,register:function(){
		this.anotherlogin=false
		this.connect()
		if(this.connection.readyState==0){
			this.connection.onopen=function(){server.register()}
		}
		else if(this.connection.readyState==1){
			hideElement("sign-up");
			showElement("loading");
			var name = $('#register-username').val()
			var email = $('#register-email').val()
			var retyped_email = $('#retype-register-email').val()

			if(email !== retyped_email){
				alert("danger","Email addresses don't match");
				hideElement('loading');
				showElement('sign-up');
				return;
			}

			this.send("Register " + name + " " + email)
		}
	}
	,changepassword:function(){
		this.anotherlogin=false
		this.connect()
		if(this.connection.readyState==0){
			this.connection.onopen=function(){server.changepassword()}
		}
		else if(this.connection.readyState==1){
			var curpass = $('#cur-pwd').val()
			var newpass = $('#new-pwd').val()
			var retypenewpass = $('#retype-new-pwd').val()

			if(newpass !== retypenewpass){
				alert("danger","Passwords don't match")
			}
			else{
				this.send("ChangePassword "+curpass+" "+newpass)
			}
		}
	}
	,sendresettoken:function(){
		this.anotherlogin=false
		this.connect()
		if(this.connection.readyState==0){
			this.connection.onopen=function(){server.sendresettoken()}
		}
		else if(this.connection.readyState==1){
			hideElement("send-token");
			showElement('loading');
			var name = $('#resettoken-username').val()
			var email = $('#resettoken-email').val()
			this.send('SendResetToken '+name+' '+email)
		}
	}
	,resetpwd:function(){
		this.anotherlogin=false
		this.connect()
		if(this.connection.readyState==0){
			this.connection.onopen=function(){server.resetpwd()}
		}
		else if(this.connection.readyState==1){
			var name = $('#resetpwd-username').val()
			var token = $('#resetpwd-token').val()
			var npwd = $('#reset-new-pwd').val()
			var rnpwd = $('#reset-retype-new-pwd').val()
			if(npwd !== rnpwd){
				alert("danger","Passwords don't match")
			}
			else{
				this.send('ResetPassword '+name+' '+token+' '+npwd)
			}
		}
	}
	,keepalive:function(){
		if(server.connection && server.connection.readyState === 1){//open connection
			server.send("PING")
		}
	}
	,msg: async function(e){
		e = e.replace(/[\n\r]+$/,"")
		if(startswith("OK", e) || startswith("Welcome!", e)){
			// welcome or ok message from the server nothing to do here
		}else if (startswith("Game Start", e)) {
			localStorage.removeItem("current-game-data");
			console.log("Game Start: " + e);
			document.getElementById("rematch").removeAttribute("disabled");
			document.getElementById("open-game-over").classList.add("hidden");
			document.getElementById("rematch").classList.add("hidden");
			$('#joingame-modal').modal('hide');
			//Game Start no. size player_white vs player_black your color time
			var spl = e.split(" ");
			const p1 = spl[3];
			const p2 = spl[5];
			const opponent = (p1 === this.myname) ? p2 : p1;
			board.newgame(Number(spl[7]), spl[6], +spl[10], +spl[11], +spl[12], +spl[15], +spl[16]);
			const gameData = {
				id: +spl[2],
				opponent,
				color: spl[6],
				size: spl[7], 
				time: +spl[8],
				increment: +spl[9],
				komi: +spl[10],
				pieces: +spl[11],
				capstones: +spl[12],
				unrated: +spl[13],
				tournament: +spl[14],
				triggerMove: +spl[15],
				timeAmount: +spl[16],
				bot: +spl[17],
			}
			// store the game object in local storage
			localStorage.setItem("current-game-data", JSON.stringify(gameData));
			board.gameno = Number(spl[2]);
			console.log("gno " + board.gameno);

			$("#player-me-name").removeClass("player1-name");
			$("#player-me-name").removeClass("player2-name");
			$("#player-opp-name").removeClass("player1-name");
			$("#player-opp-name").removeClass("player2-name");

			$("#player-me-time").removeClass("player1-time");
			$("#player-me-time").removeClass("player2-time");
			$("#player-opp-time").removeClass("player1-time");
			$("#player-opp-time").removeClass("player2-time");

			$("#player-me").removeClass("selectplayer");
			$("#player-opp").removeClass("selectplayer");

			if (spl[6] === "white") {
				//I am white
				$("#player-me-name").addClass("player1-name");
				$("#player-opp-name").addClass("player2-name");

				$("#player-me-time").addClass("player1-time");
				$("#player-opp-time").addClass("player2-time");

				$("#player-me-img").addClass("iswhite");
				$("#player-me-img").removeClass("isblack");
				$("#player-opp-img").addClass("isblack");
				$("#player-opp-img").removeClass("iswhite");

				$("#player-me").addClass("selectplayer");
			} else {
				//I am black
				$("#player-me-name").addClass("player2-name");
				$("#player-opp-name").addClass("player1-name");

				$("#player-me-time").addClass("player2-time");
				$("#player-opp-time").addClass("player1-time");

				$("#player-me-img").removeClass("iswhite");
				$("#player-me-img").addClass("isblack");
				$("#player-opp-img").removeClass("isblack");
				$("#player-opp-img").addClass("iswhite");

				$("#player-opp").addClass("selectplayer");
			}

			$(".player1-name:first").html(p1);
			$(".player2-name:first").html(p2);
			document.title = "Tak: " + p1 + " vs " + p2;

			var time = Number(spl[8]);
			settimers(time * 1000, time * 1000);

			var opponentname;
			if (spl[6] === "white") {
				//I am white
				opponentname = p2;
			} else {
				//I am black
				opponentname = p1;
			}
			chathandler.createRoom("priv-" + opponentname, "<b>" + opponentname + "</b>");
			chathandler.selectRoom("priv-" + opponentname);

			document.getElementById("chime-sound").currentTime = 0;
			document.getElementById("chime-sound").play();

			document.getElementById("createSeek").setAttribute("disabled", "disabled");
			document.getElementById("removeSeek").setAttribute("disabled", "disabled");
		} else if (startswith("Observe ", e)) {
			//Observe Game#1 player1 vs player2, 4x4, 180, 7 half-moves played, player2 to move
			var spl = e.split(" ");

			var p1 = spl[2];
			var p2 = spl[3];

			board.clear();
			board.create(+spl[4], "white", false, true, +spl[7], +spl[8], +spl[9], +spl[12], +spl[13]);
			board.initEmpty();
			board.gameno = +spl[1];
			$(".player1-name:first").html(p1);
			$(".player2-name:first").html(p2);
			document.title = "Tak: " + p1 + " vs " + p2;

			var time = +spl[5];
			settimers(time * 1000, time * 1000);
		} else if (startswith("GameList Add ", e)) {
			//GameList Add Game#1 player1 vs player2, 4x4, 180, 15, 0 half-moves played, player1 to move
			var spl = e.split(" ");
			this.gameslist.push({
				id: +spl[2],
				time: +spl[6],
				increment: +spl[7],
				player1: spl[3],
				player2: spl[4],
				size: +spl[5],
				komi: +spl[8],
				pieces: +spl[9],
				capstones: +spl[10],
				unrated: spl[11] == 1,
				tournament: spl[12] == 1,
				triggerMove: spl[13],
				timeAmount: parseInt(spl[14]) / 60
			});
			this.rendeergameslist();
		} else if (startswith("GameList Remove ", e)) {
			//GameList Remove Game#1 player1 vs player2, 4x4, 180, 0 half-moves played, player1 to move
			var spl = e.split(" ");
			var id = +spl[2];
			var newgameslist = [];
			var a;
			for (a = 0; a < this.gameslist.length; a++) {
				if (id != this.gameslist[a].id) {
					newgameslist.push(this.gameslist[a]);
				}
			}
			this.gameslist = newgameslist;
			this.rendeergameslist();
		} else if (startswith("Game#", e)) {
			var spl = e.split(" ");
			var gameno = Number(e.split("Game#")[1].split(" ")[0]);
			//Game#1 ...
			if (gameno === board.gameno) {
				//Game#1 P A4 (C|W)
				if (spl[1] === "P") {
					board.serverPmove(spl[2].charAt(0), Number(spl[2].charAt(1)), spl[3]);
				}
				//Game#1 M A2 A5 2 1
				else if (spl[1] === "M") {
					var nums = [];
					for (i = 4; i < spl.length; i++) {
						nums.push(Number(spl[i]));
					}
					board.serverMmove(
						spl[2].charAt(0),
						Number(spl[2].charAt(1)),
						spl[3].charAt(0),
						Number(spl[3].charAt(1)),
						nums
					);
				}
				//Game#1 Time 170 200
				else if (spl[1] === "Time") {
					var wt = Math.max(+spl[2] || 0, 0) * 1000;
					var bt = Math.max(+spl[3] || 0, 0) * 1000;
					lastWt = wt;
					lastBt = bt;

					lastTimeUpdate = invarianttime();

					board.timer_started = true;
					startTime(true);
				}
				//Game#1 Timems 170000 200000
				else if (spl[1] === "Timems") {
					var wt = Math.max(+spl[2] || 0, 0);
					var bt = Math.max(+spl[3] || 0, 0);
					lastWt = wt;
					lastBt = bt;

					lastTimeUpdate = invarianttime();

					board.timer_started = true;
					startTime(true);
				}
				//Game#1 RequestUndo
				else if (spl[1] === "RequestUndo") {
					alert("info", "Your opponent requests to undo the last move");
					$("#undo").toggleClass("opp-requested-undo request-undo");
				}
				//Game#1 RemoveUndo
				else if (spl[1] === "RemoveUndo") {
					alert("info", "Your opponent removes undo request");
					$("#undo").toggleClass("opp-requested-undo request-undo");
				}
				//Game#1 Undo
				else if (spl[1] === "Undo") {
					board.undo();
					alert("info", "Game has been UNDOed by 1 move");
					$("#undo").removeClass("i-requested-undo").removeClass("opp-requested-undo").addClass("request-undo");
				}
				//Game#1 OfferDraw
				else if (spl[1] === "OfferDraw") {
					$("#draw").toggleClass("opp-offered-draw offer-draw");
					alert("info", "Draw is offered by your opponent");
				}
				//Game#1 RemoveDraw
				else if (spl[1] === "RemoveDraw") {
					$("#draw").removeClass("i-offered-draw").removeClass("opp-offered-draw").addClass("offer-draw");
					alert("info", "Draw offer is taken back by your opponent");
				}
				//Game#1 Over result
				else if (spl[1] === "Over") {
					document.getElementById("open-game-over").classList.remove("hidden");
					document.title = "Play Tak";
					board.result = spl[2];

					var msg = "Game over <span class='bold'>" + spl[2] + "</span><br>";
					var type;

					if (spl[2] === "R-0" || spl[2] === "0-R") {
						type = "making a road";
					} else if (spl[2] === "F-0" || spl[2] === "0-F") {
						var score = board.flatscore();
						type = "having more top flats (" + score[0] + " to " + score[1] + "+" + Math.floor(board.komi / 2) + (board.komi & 1 ? ".5" : ".0") + ")";
					} else if (spl[2] === "1-0" || spl[2] === "0-1") {
						type = "resignation or time";
					}

					if (spl[2] === "R-0" || spl[2] === "F-0" || spl[2] === "1-0") {
						if (board.observing === true) {
							msg += "White wins by " + type;
						} else if (board.mycolor === "white") {
							msg += "You win by " + type;
						} else {
							msg += "Your opponent wins by " + type;
						}
					} else if (spl[2] === "1/2-1/2") {
						msg += "The game is a draw!";
					} else if (spl[2] === "0-0") {
						msg += "The game is aborted!";
					} else {
						//black wins
						if (board.observing === true) {
							msg += "Black wins by " + type;
						} else if (board.mycolor === "white") {
							msg += "Your opponent wins by " + type;
						} else {
							msg += "You win by " + type;
						}
					}
					// get the game object and check if it's a bot game
					const gameData = JSON.parse(localStorage.getItem("current-game-data"));
					if (!board.observing && (gameData && !gameData.bot)) {
						document.getElementById("rematch").classList.remove("hidden");
					}

					stopTime();

					$("#gameoveralert-text").html(msg);
					$("#gameoveralert").modal("show");
					board.gameover();
					server.newSeek = false;
					document.getElementById('createSeek').removeAttribute("disabled");
					document.getElementById("removeSeek").removeAttribute("disabled");
				}
				//Game#1 Abandoned
				else if (spl[1] === "Abandoned.") {
					//Game#1 Abandoned. name quit
					document.title = "Play Tak";

					if (board.mycolor === "white") {
						board.result = "1-0";
					} else {
						board.result = "0-1";
					}

					var msg = "Game abandoned by " + spl[2] + ".";
					if (!board.observing) {
						msg += " You win!";
					}

					stopTime();

					$("#gameoveralert-text").html(msg);
					$("#gameoveralert").modal("show");
					board.gameover();
				}
			}
		} else if (startswith("Login or Register", e)) {
			server.stopLoginTimer();
			clearInterval(this.timeoutvar);
			this.timeoutvar = setInterval(this.keepalive, 10000);
			if (localStorage.getItem("keeploggedin") === "true" && this.tries < 3) {
				var uname = localStorage.getItem("usr");
				var token = localStorage.getItem("token");
				server.sendClient();
				server.send("Login " + uname + " " + token);
				this.tries++;
			} else {
				localStorage.removeItem("keeploggedin");
				localStorage.removeItem("usr");
				localStorage.removeItem("token");
				localStorage.removeItem("isLoggedIn");
				resetToLoginState();
			}
		}
		//Registered ...
		else if (startswith("Registered", e)) {
			alert("success", "You're registered! Check mail for password");
			hideElement("loading");
			hideElement("sign-up");
			hideElement("hero-actions");
			showElement("landing-login");
		}
		// Registration Error
		else if (startswith("Registration Error: ", e)) {
			console.error("Registration Error: ", e);
			alert("danger", e);
			hideElement("loading");
			hideElement("hero-actions");
			showElement("sign-up");
		}
		else if (startswith("Reset Token Error:", e)){
			alert("danger", e);
			hideElement("loading");
			hideElement("hero-actions");
			showElement("send-token");
		}
		//Authentication failure
		else if (startswith("Authentication failure", e)) {
			localStorage.removeItem("keeploggedin");
			localStorage.removeItem("usr");
			localStorage.removeItem("token");
			showElement("login-error");
			alert("danger", "Authentication failure");
		} else if (startswith("Wrong password", e)) {
			showElement("login-error");
		}
		//You're already logged in
		else if (startswith("You're already logged in", e)) {
			alert("warning", "You're already logged in from another window");
			this.connection.close();
		}
		//Welcome kaka!
		else if (startswith("Welcome ", e)) {
			this.tries = 0;
			hideElement("loading");
			setLoggedInState();
			// Guest logging back in
			if (localStorage.getItem("guesttoken") && !localStorage.getItem("usr")) {
				hideElement("landing");
			} else if (localStorage.getItem("isLoggedIn")) {
				// Logged in user
				setLoggedInState();
			} else {
				hideElement("landing");
			}

			this.myname = e.split("Welcome ")[1].split("!")[0];
			server.updateplayerinfo();
			alert("success", "You're logged in " + this.myname + "!");
			document.title = "Play Tak";
			server.loggedin = true;
			this.updatePlayerRatingInfo(await getPlayersRating(this.myname));
			var rem = $("#keeploggedin").is(":checked");
			if (rem === true && !startswith("Guest", this.myname)) {
				var name = $("#login-username").val();
				var token = $("#login-pwd").val();

				localStorage.setItem("keeploggedin", "true");
				localStorage.setItem("usr", name);
				localStorage.setItem("token", token);
			}
			hideElement("login-error");
			localStorage.setItem("isLoggedIn", true);
		} else if (startswith("Password changed", e)) {
			$("#settings-modal").modal("hide");
			alert("success", "Password changed!");
		} else if (startswith("Message", e)) {
			var msg = e.split("Message ");

			if (e.includes("You've logged in from another window. Disconnecting")) {
				server.anotherlogin = true;
			}

			alert("info", "Server says: " + msg[1]);
		} else if (startswith("Error", e)) {
			var msg = e.split("Error:")[1];
			alert("danger", "Server says: " + msg);
		}
		//Shout <name> msg
		else if (startswith("Shout ", e)) {
			var regex = /Shout <([^\s]*)> (.*)/g;
			var match = regex.exec(e);
			chathandler.received("global", "", match[1], match[2]);
		}
		//ShoutRoom name <name> msg
		else if (startswith("ShoutRoom", e)) {
			var regex = /ShoutRoom ([^\s]*) <([^\s]*)> (.*)/g;
			var match = regex.exec(e);

			chathandler.received("room", match[1], match[2], match[3]);
		}
		//Tell <name> msg
		else if (startswith("Tell", e)) {
			var regex = /Tell <([^\s]*)> (.*)/g;
			var match = regex.exec(e);

			chathandler.received("priv", match[1], match[1], match[2]);
		}
		//Told <name> msg
		else if (startswith("Told", e)) {
			var regex = /Told <([^\s]*)> (.*)/g;
			var match = regex.exec(e);

			chathandler.received("priv", match[1], this.myname, match[2]);
		} else if (startswith("CmdReply", e)) {
			var msg = e.split("CmdReply ")[1];
			msg = '<span class="cmdreply">' + msg + "</span>";
		}
		else if (startswith("sudoReply", e)) {
			var msg = e.split("sudoReply ")[1];

			chathandler.received("admin", "admin", "&gt;", msg);
		}
		//new seek
		else if (startswith("Seek new", e)) {
			// Seek new 1 {player} 5 900 20 A 0 21 1 0 0 0 0 {oppoenent}
			var spl = e.split(" ");
			const playerRating = await getPlayersRating(spl[3]);
			this.seekslist.push({
				id: +spl[2],
				player: spl[3],
				size: spl[4] + "x" + spl[4],
				time: Number(spl[5]),
				increment: Number(spl[6]),
				color: spl[7],
				komi: +spl[8],
				pieces: +spl[9],
				capstones: +spl[10],
				unrated: spl[11] == 1,
				tournament: spl[12] == 1,
				trigger_move: spl[13],
				time_amount: (parseInt(spl[14]) / 60).toString(),
				opponent: spl[15],
				bot: spl[16],
				player_rating: playerRating
			});
			this.rendeerseekslist();
		}
		//remove seek
		else if (startswith("Seek remove", e)) {
			//Seek remove 1 chaitu 5 15
			var spl = e.split(" ");
			var id = +spl[2];
			var newseekslist = [];
			var a;
			for (a = 0; a < this.seekslist.length; a++) {
				if (id != this.seekslist[a].id) {
					newseekslist.push(this.seekslist[a]);
				}
			}
			this.seekslist = newseekslist;
			this.rendeerseekslist();
		}
		// accept rematch
		else if (startswith("Accept Rematch", e)) {
			const spl = e.split(" ");
			const gameId = +spl[2];
			this.acceptseek(gameId);
		}
		else if (startswith("Rematch", e)) {
			alert("info", "Rematch seek created!");
		}
		//Online count
		else if (startswith("Online ", e)) {
		}
		else if (startswith("OnlinePlayers ", e)) {
			const msgArray = e.split("OnlinePlayers ");
			this.onlinePlayers = JSON.parse(msgArray[1]) 
			document.getElementById("onlineplayers").classList.remove("hidden");
			document.getElementById("onlineplayersbadge").innerHTML = this.onlinePlayers.length;
			this.renderOnlinePlayers();
		}
		//Reset token sent
		else if (startswith("Reset token sent", e)) {
			hideElement("loading");
			showElement("forgot-password");
			hideElement("send-token");
			showElement("reset-password");
		}
		//Wrong token
		else if (startswith("Wrong token", e)) {
			alert("danger", "Wrong token. Try again");
		}
		//Password is changed
		else if (startswith("Password is changed", e)) {
			alert("danger", "Password changed. Login with your new password.");
			hideElement("reset-password");
			hideElement("forgot-password");
			showElement("landing-login");
		} else if (startswith("Joined room ", e)) {
			var spl = e.split(" ");
			var roomname = spl[2];
			var players = roomname.split("-");
			var id = "room-" + roomname;
			if (players.length == 2) {
				chathandler.createRoom(id, "<div><b>" + players[0] + "</b> vs <b>" + players[1] + "</b></div>");
			} else {
				chathandler.createRoom(id, roomname);
			}
			chathandler.selectRoom(id);
		} else if (startswith("Is Mod", e)) {
			chathandler.createRoom("admin-admin", "<b>Moderate Tak</b>");
		} else {
			console.error("Unknown message from server: " + e);	
		}
	}
	,updateplayerinfo:function(){
		document.getElementById("player-name").innerText = this.myname || "";
		// if myname starts with guest then return
		if (this.myname && this.myname.startsWith("Guest")) {
			return;
		}
		document.getElementById("playerinfo").href="ratings.html"+(this.myname?"#"+this.myname:"")
	},
	updatePlayerRatingInfo: function (rating) {
		this.myRating = rating;
		document.getElementById("player-rating").innerText = `(${rating || 'ratings'})`;
	}
	,rendeergameslist:async function(){
		var listtable=document.getElementById("gamelist")
		listtable.innerHTML=""
		var a
		for(a=0;a<this.gameslist.length;a++){
			var game=this.gameslist[a]
			var p1 = game.player1
			let p1Rating = await getPlayersRating(p1);
			if(!p1Rating){
				p1Rating = "";
			}
			var p2 = game.player2
			let p2Rating = await getPlayersRating(p2);
			if(!p2Rating){
				p2Rating = "";
			}
			const players = document.createElement("button");
			players.className = "btn btn-transparent";
			players.setAttribute("data-hover", "Watch game");
			let p1Element = `<span data-hover="rating">${p1Rating}</span>&nbsp;<span class="playernamegame">${p1}</span>`;
			let p2Element = `<span class="playernamegame">${p2}</span>&nbsp;<span data-hover="rating">${p2Rating}</span>`;
			players.innerHTML = p1Element + " vs " + p2Element;
			const actionButton = document.createElement("button");
			actionButton.className = "btn btn-transparent";
			actionButton.innerHTML = `<svg viewBox="0 0 576 512"><path d="M160 256C160 185.3 217.3 128 288 128C358.7 128 416 185.3 416 256C416 326.7 358.7 384 288 384C217.3 384 160 326.7 160 256zM288 336C332.2 336 368 300.2 368 256C368 211.8 332.2 176 288 176C287.3 176 286.7 176 285.1 176C287.3 181.1 288 186.5 288 192C288 227.3 259.3 256 224 256C218.5 256 213.1 255.3 208 253.1C208 254.7 208 255.3 208 255.1C208 300.2 243.8 336 288 336L288 336zM95.42 112.6C142.5 68.84 207.2 32 288 32C368.8 32 433.5 68.84 480.6 112.6C527.4 156 558.7 207.1 573.5 243.7C576.8 251.6 576.8 260.4 573.5 268.3C558.7 304 527.4 355.1 480.6 399.4C433.5 443.2 368.8 480 288 480C207.2 480 142.5 443.2 95.42 399.4C48.62 355.1 17.34 304 2.461 268.3C-.8205 260.4-.8205 251.6 2.461 243.7C17.34 207.1 48.62 156 95.42 112.6V112.6zM288 80C222.8 80 169.2 109.6 128.1 147.7C89.6 183.5 63.02 225.1 49.44 256C63.02 286 89.6 328.5 128.1 364.3C169.2 402.4 222.8 432 288 432C353.2 432 406.8 402.4 447.9 364.3C486.4 328.5 512.1 286 526.6 256C512.1 225.1 486.4 183.5 447.9 147.7C406.8 109.6 353.2 80 288 80V80z"/></svg>`;
			var row = $('<tr/>').addClass('game'+game.id).appendTo($('#gamelist'))
			$('<td/>').append(actionButton).attr("data-hover", "Watch game").click(game,function(ev){server.observegame(ev.data)}).appendTo(row);
			$('<td/>').append(players).click(game,function(ev){server.observegame(ev.data)}).appendTo(row);
			$('<td/>').append("<span class='badge'>"+game.size+"x"+game.size+"</span>").addClass("right").appendTo(row)
			$('<td/>').append(minuteseconds(game.time)).addClass("right").attr("data-hover","Time control").appendTo(row)
			$('<td/>').append('+'+minuteseconds(game.increment)).addClass("right").attr("data-hover","Time increment per move").appendTo(row)
			$('<td/>').append('+'+Math.floor(game.komi/2)+"."+(game.komi&1?"5":"0")).attr("data-hover","Komi - If the game ends without a road, black will get this number on top of their flat count when the winner is determined").addClass("right").appendTo(row)
			$('<td/>').append(game.pieces+"/"+game.capstones).addClass("right").attr("data-hover","Stone count - The number of stones/capstones that each player has in this game").appendTo(row)
			$('<td/>').append((game.unrated?"P":"")+(game.tournament?"T":"")).addClass("right").attr("data-hover",(game.unrated?"Unrated game":"")+(game.tournament?"Tournament game":"")).appendTo(row)
			$("<td/>").append(game.triggerMove + "/+" + parseInt(game.timeAmount)).addClass("right").attr("data-hover", "Trigger move and extra time to add in minutes").appendTo(row);
		}
		document.getElementById("gamecount").innerHTML=this.gameslist.length
	}
	,rendeerseekslist: async function(){
		document.getElementById("seeklist").innerHTML = "";
		document.getElementById("seeklistbot").innerHTML = "";
		this.seekslist.sort(function(a,b){return b.player_rating - a.player_rating || ((a.player.toLowerCase()+" "+a.player)>(b.player.toLowerCase()+" "+b.player)?1:-1)})
		var a
		var playercount=0
		var botcount=0
		var myrating=1000
		var levelgap=150
		if(this.myname && this.myRating){
			myrating=this.myRating || 1000;
		}
		// remove private seek badge
		const seekBadge = document.getElementById("seekBadge");
		seekBadge.classList.remove("seek-badge");
		for(a=0;a<this.seekslist.length;a++){
			var seek=this.seekslist[a]
			const mySeek = seek.player.toLowerCase() == this.myname.toLowerCase();
			if(seek.opponent != "0" && seek.opponent != "" && seek.opponent.toLowerCase() != this.myname.toLowerCase() && seek.player.toLowerCase() != this.myname.toLowerCase()){
				continue;
			}
			var colourleft="white"
			var colourright="black"
			let yourColor = 'random';
			if(seek.color=="W"){
				colourright="white"
				yourColor = "black";
				if(mySeek) {
					yourColor = colourleft;
				}
			}
			if(seek.color=="B"){
				colourleft="black"
				yourColor = "white";
				if(mySeek) {
					yourColor = colourleft;
				}
			}
			var imgstring='<svg class="colourcircle" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke-width="2" fill="'+colourleft+'"></circle><clipPath id="g-clip"><rect height="16" width="8" x="8" y="0"></rect></clipPath><circle cx="8" cy="8" r="6" stroke-width="2" fill="'+colourright+'" clip-path="url(#g-clip)"></circle></svg>'
			var sizespan = "<span class='badge'>"+seek.size+"</span>"
			var row = $('<tr/>')
				.addClass('seek'+seek.id)
			if(seek.opponent != "" && seek.opponent != "0"){
				row.addClass("privateseek");
				if(!seekBadge.classList.contains("seek-badge")) {
					seekBadge.classList.add("seek-badge")
				}
			}
			if(seek.bot === "1"){
				row.appendTo($('#seeklistbot'))
				botcount++
			}
			else{
				row.appendTo($('#seeklist'))
				playercount++
			}
			const rating = seek.player_rating
			var ratingdecoration=""
			var ratingtext=""
			if(rating){
				if(rating>=myrating+levelgap){
					ratingdecoration="<span class='ratingup'>"+("↑↑↑".slice(0,Math.min(Math.floor((rating-myrating)/levelgap),3)))+"</span>"
				}
				else if(rating<=myrating-levelgap){
					ratingdecoration="<span class='ratingdown'>"+("↓↓↓".slice(0,Math.min(Math.floor((myrating-rating)/levelgap),3)))+"</span>"
				}
				else{
					ratingdecoration="<span class='ratingequal'>≈</span>"
				}
				
				if(rating>=myrating+levelgap*3){
					ratingtext="This player is much stronger than you"
				}
				else if(rating>=myrating+levelgap*2){
					ratingtext="This player is moderately stronger than you"
				}
				else if(rating>=myrating+levelgap*1){
					ratingtext="This player is a bit stronger than you"
				}
				else if(myrating>=rating+levelgap*3){
					ratingtext="This player is much weaker than you"
				}
				else if(myrating>=rating+levelgap*2){
					ratingtext="This player is moderately weaker than you"
				}
				else if(myrating>=rating+levelgap*1){
					ratingtext="This player is a bit weaker than you"
				}
				else{
					ratingtext="This player is approximately your level"
				}
			}
			let gameType = "";
			let gameTypeText = "";
			if (!seek.unrated && !seek.tournament) {
				gameType = "N";
				gameTypeText = "Normal game";
			} else if (seek.unrated && !seek.tournament) {
				gameType = "U";
				gameTypeText = "Unrated game";
			} else if (!seek.unrated && seek.tournament) {
				gameType = "T";
				gameTypeText = "Tournament game";
			}
			
			const challengePlayerButton = document.createElement("button");
			challengePlayerButton.className = "btn btn-transparent seek-button";
			challengePlayerButton.innerHTML = `<span class='playername'>${seek.player}</span>`;
			const deleteIcon = '<svg viewBox="0 0 24 24"><path d="M17,4V5H15V4H9V5H7V4A2,2,0,0,1,9,2h6A2,2,0,0,1,17,4Z"/><path d="M20,6H4A1,1,0,0,0,4,8H5V20a2,2,0,0,0,2,2H17a2,2,0,0,0,2-2V8h1a1,1,0,0,0,0-2ZM11,17a1,1,0,0,1-2,0V11a1,1,0,0,1,2,0Zm4,0a1,1,0,0,1-2,0V11a1,1,0,0,1,2,0Z"/></svg>'
			const challengeIcon = `<svg viewBox="0 0 32 32"><path d="M28.414,24l-3-3l2.293-2.293l-1.414-1.414l-2.236,2.236l-3.588-4.186L25,11.46V6h-5.46L16,10.13  L12.46,6H7v5.46l4.531,3.884l-3.588,4.186l-2.236-2.236l-1.414,1.414L6.586,21l-3,3L7,27.414l3-3l2.293,2.293l1.414-1.414 l-2.237-2.237L16,19.174l4.53,3.882l-2.237,2.237l1.414,1.414L22,24.414l3,3L28.414,24z M6.414,24L8,22.414L8.586,23L7,24.586 L6.414,24z M9,10.54V8h2.54l3.143,3.667l-1.85,2.159L9,10.54z M20.46,8H23v2.54L10.053,21.638l-0.69-0.69L20.46,8z M18.95,16.645 l3.688,4.302l-0.69,0.69l-4.411-3.781L18.95,16.645z M25,24.586L23.414,23L24,22.414L25.586,24L25,24.586z"/></svg>`;
			const actionButton = document.createElement("button");
			actionButton.className = "btn btn-transparent";
			actionButton.innerHTML = mySeek ? deleteIcon : challengeIcon;
			$('<td/>').append(actionButton).click(seek.id,function(ev){
					if (mySeek) { 
						return server.removeseek(ev.data);
					 }
					return server.acceptseek(ev.data)
				}).attr("data-hover", mySeek ? "Remove seek" : "Challenge " + seek.player).appendTo(row)
			$('<td/>').append(imgstring).attr("data-hover","Your color will be " + yourColor).appendTo(row)
			$('<td/>').append(challengePlayerButton).click(seek.id,function(ev){
					if (mySeek) { 
						return server.removeseek(ev.data);
					 }
					return server.acceptseek(ev.data)
				}).attr("data-hover", mySeek ? "Remove seek" : "Challenge " + seek.player).appendTo(row)
			$('<td/>').append(ratingdecoration + " " + (seek.player_rating || "")).addClass("right").attr("data-hover",ratingtext).appendTo(row)
			$('<td/>').append(sizespan).addClass("right").appendTo(row)
			$('<td/>').append(minuteseconds(seek.time)).addClass("right").attr("data-hover","Time control").appendTo(row)
			$('<td/>').append('+'+minuteseconds(seek.increment)).addClass("right").attr("data-hover","Time increment per move").appendTo(row)
			$('<td/>').append('+'+Math.floor(seek.komi/2)+"."+(seek.komi&1?"5":"0")).addClass("right").attr("data-hover","Komi - If the game ends without a road, black will get this number on top of their flat count when the winner is determined").appendTo(row)
			$('<td/>').append(seek.pieces+"/"+seek.capstones).addClass("right").attr("data-hover","Stone count - The number of stones/capstones that each player has in this game").appendTo(row)
			$('<td/>').append(gameType).addClass("right").attr("data-hover",gameTypeText).appendTo(row)
			$('<td/>').append(seek.trigger_move+"/+"+seek.time_amount).addClass("right").attr("data-hover", "Extra Time - The trigger move the player must reach and the time to add to the clock").appendTo(row)
		}
		if(!botcount){
			$('<tr/>').append($('<td colspan="9">No Bot Games Currently Available</td>')).appendTo($('#seeklistbot'))
		}
		if (!playercount){
			$('<tr/>').append($('<td colspan="9">No Player Games Currently Available</td>')).appendTo($('#seeklist'))
		}
		document.getElementById("seekcount").innerHTML=playercount
		document.getElementById("seekcountbot").innerHTML=botcount
		this.changeseektime=Date.now()
	},
	renderOnlinePlayers:function(){
		const onlineTable = document.getElementById("online-list");
		onlineTable.innerHTML = "";
		for (let i = 0; i < this.onlinePlayers.length; i++) {
			// if the name is the current loggedin player, skip
			if (this.onlinePlayers[i]=== this.myname) {
				continue;
			}
			const player = this.onlinePlayers[i];
			const row = document.createElement("tr");
			// create a player link to the rantings page
			const playerLink = document.createElement("a");
			playerLink.href = "ratings.html#" + player;
			// target="_blank" to open in new tab
			playerLink.target = "_blank";
			playerLink.setAttribute("data-hover", "Click to see " + player + "'s rating");
			playerLink.innerText = player;
			row.innerHTML += `<td>${playerLink.outerHTML}</td><td>`
			// createa challenge button
			const challengeButton = document.createElement("button");
			challengeButton.className = "btn btn-transparent";
			challengeButton.setAttribute("data-hover", "Challenge " + player);
			challengeButton.innerHTML = `<svg viewBox="0 0 32 32"><path d="M28.414,24l-3-3l2.293-2.293l-1.414-1.414l-2.236,2.236l-3.588-4.186L25,11.46V6h-5.46L16,10.13  L12.46,6H7v5.46l4.531,3.884l-3.588,4.186l-2.236-2.236l-1.414,1.414L6.586,21l-3,3L7,27.414l3-3l2.293,2.293l1.414-1.414  l-2.237-2.237L16,19.174l4.53,3.882l-2.237,2.237l1.414,1.414L22,24.414l3,3L28.414,24z M6.414,24L8,22.414L8.586,23L7,24.586  L6.414,24z M9,10.54V8h2.54l3.143,3.667l-1.85,2.159L9,10.54z M20.46,8H23v2.54L10.053,21.638l-0.69-0.69L20.46,8z M18.95,16.645 l3.688,4.302l-0.69,0.69l-4.411-3.781L18.95,16.645z M25,24.586L23.414,23L24,22.414L25.586,24L25,24.586z"/></svg>`;
			challengeButton.setAttribute("onclick", `server.challengePlayer('${player}')`);
			row.innerHTML += `${challengeButton.outerHTML}`;
			// create a message button
			const messageButton = document.createElement("button");
			messageButton.className = "btn btn-transparent";
			messageButton.setAttribute("data-hover", "Message " + player);
			messageButton.innerHTML = `<svg viewBox="0 0 24 24"><g><path d="M12 14V11M12 11V8M12 11H9M12 11H15M7.12357 18.7012L5.59961 19.9203C4.76744 20.5861 4.35115 20.9191 4.00098 20.9195C3.69644 20.9198 3.40845 20.7813 3.21846 20.5433C3 20.2696 3 19.7369 3 18.6712V7.2002C3 6.08009 3 5.51962 3.21799 5.0918C3.40973 4.71547 3.71547 4.40973 4.0918 4.21799C4.51962 4 5.08009 4 6.2002 4H17.8002C18.9203 4 19.4801 4 19.9079 4.21799C20.2842 4.40973 20.5905 4.71547 20.7822 5.0918C21 5.5192 21 6.07899 21 7.19691V14.8036C21 15.9215 21 16.4805 20.7822 16.9079C20.5905 17.2842 20.2843 17.5905 19.908 17.7822C19.4806 18 18.9215 18 17.8036 18H9.12256C8.70652 18 8.49829 18 8.29932 18.0408C8.12279 18.0771 7.95216 18.1368 7.79168 18.2188C7.61149 18.3108 7.44964 18.4403 7.12722 18.6982L7.12357 18.7012Z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
			messageButton.setAttribute("onclick", `server.messagePlayer('${player}')`);
			row.innerHTML += `${messageButton.outerHTML}`;
			row.innerHTML += `</td>`;
			onlineTable.appendChild(row);
		}
	},
	challengePlayer: function(player) {
		// close online player modal
		$('#online-players-modal').modal('hide');
		// open new game modal
		$('#creategamemodal').modal('show');
		// set the opponent name in the new game modal
		document.getElementById("opname").value = player;
	},
	messagePlayer: function(player) {
		// close online player modal
		$('#online-players-modal').modal('hide');
		// force shwo the chat panel
		adjustsidemenu(null, "show");
		const id="priv-" + player;
		chathandler.createRoom(id,"<b>" + player + "</b>");
		chathandler.selectRoom(id);
	}
	,chat:function(type,name,msg){
		if(type === 'global'){this.send('Shout '+msg)}
		else if(type == 'room'){this.send('ShoutRoom ' + name + ' ' + msg)}
		else if(type === 'priv'){this.send('Tell ' + name + ' ' + msg)}
		else if(type === 'admin'){this.send( msg )}
		else{console.log('undefined chat type')}
	}
	,leaveroom:function(room){
		this.send('LeaveRoom ' + room)
	}
	,send:function(e){
		if(this.connection && this.connection.readyState === 1){
			this.connection.send(e + "\n")
			waitforreply()
		}
		else{
			this.error("You are not logged on to the server")
		}
	}
	,error:function(e){
		alert("danger",e)
	}
	,seek:function(){
		// check if user already has an active seek
		if (server.newSeek) {
			return;
		}
		const size =+ document.getElementById("boardsize").value;
		const time =+ document.getElementById("timeselect").value;
		const inc =+ document.getElementById("incselect").value;
		const color = document.getElementById("colorselect").value;
		const komi =+ document.getElementById("komiselect").value;
		const pieces =+ document.getElementById("piececount").value;
		const capstones =+ document.getElementById("capcount").value;
		const gametype =+ document.getElementById("gametype").value;
		const opponent = document.getElementById("opname").value.replace(/[^A-Za-z0-9_]/g,"");
		const triggerMove =+ document.getElementById("triggerMove").value;
		const timeAmount =+ document.getElementById("timeAmount").value;

		const timeCalc = (time*60);
		const unrated = (gametype==2?1:0);
		const tournament = (gametype==1?1:0);
		const seekCMD =`Seek ${size} ${timeCalc} ${inc} ${color} ${komi} ${pieces} ${capstones} ${unrated} ${tournament} ${triggerMove} ${timeAmount} ${opponent}`;
		this.send(seekCMD);
		$('#creategamemodal').modal('hide');
		server.newSeek = true;
		document.getElementById('createSeek').setAttribute("disabled", "disabled");
	}
	,removeseek:function(){
		this.send("Seek 0 0 0 A 0 0 0 0 0 ")
		$('#creategamemodal').modal('hide')
		document.getElementById('createSeek').removeAttribute("disabled");
		document.getElementById("rematch").removeAttribute("disabled");
		// remove seek state
		server.newSeek = false;
	}
	,draw:function(){
		if(board.scratch){return}
		else if(board.observing){return}

		if($('#draw').hasClass("offer-draw")){//offer
			$('#draw').toggleClass('i-offered-draw offer-draw')
			this.send("Game#" + board.gameno + " OfferDraw")
		}
		else if($('#draw').hasClass("i-offered-draw")){//remove offer
			$('#draw').toggleClass('i-offered-draw offer-draw')
			this.send("Game#" + board.gameno + " RemoveDraw")
		}
		else{//accept the offer
			$('#draw').removeClass('i-offered-draw').removeClass('opp-offered-draw').addClass('offer-draw')
			this.send("Game#" + board.gameno + " OfferDraw")
		}
	}
	,undo:function(){
		if(board.observing){return}

		if($('#undo').hasClass('request-undo')){//request undo
			this.send("Game#" + board.gameno + " RequestUndo")
			$('#undo').toggleClass('request-undo i-requested-undo')
			alert('info','Undo request sent')
		}
		else if($('#undo').hasClass('opp-requested-undo')){//accept request
			this.send("Game#" + board.gameno + " RequestUndo")
			$('#undo').toggleClass('request-undo opp-requested-undo')
		}
		else if($('#undo').hasClass('i-requested-undo')){//remove request
			this.send("Game#" + board.gameno + " RemoveUndo")
			$('#undo').toggleClass('request-undo i-requested-undo')
			alert('info','Undo request removed')
		}
	}
	,resign:function(){
		if(board.scratch){return}
		else if(board.observing){return}

		this.send("Game#" + board.gameno + " Resign")
	}
	,acceptseek:function(e){
		if(this.changeseektime+800>Date.now()){
			return
		}
		this.send("Accept " + e)
		$('#joingame-modal').modal('hide');
		$('#game-over-modal').modal('hide');
		document.getElementById("open-game-over").classList.add("hidden");
	}
	,unobserve:function(){
		if(board.gameno !== 0 && board.gameno !== null){this.send("Unobserve " + board.gameno)}
	}
	,observegame:function(game){
		document.getElementById("open-game-over").classList.add("hidden");
		document.getElementById("rematch").removeAttribute("disabled");
		$('#watchgame-modal').modal('hide')
		if(board.observing === false && board.scratch === false){ //don't observe game while playing another
			return
		}
		if(game.id === board.gameno){return}
		this.unobserve()
		this.send("Observe " + game.id)
		var players=[game.player1,game.player2]
		players.sort()
		this.send("JoinRoom "+players.join("-"))
	},
	rematch: function() {
		// send a request to the server to start a rematch
		//check the locall storage for the gameobject
		const gameData = localStorage.getItem("current-game-data");
		if (gameData) {
			const game = JSON.parse(gameData);
			// check the seek list for the game id and accept it
			const seekIndex = this.seekslist.findIndex(seek => seek.id === game.id);
			if (seekIndex !== -1) {
				this.acceptseek(this.seekslist[seekIndex].id);
				return
			}
			// swap the player color for the new seek
			const newColor = game.color === "black" ? "W" : "B";
			this.send(`Rematch ${game.id} ${game.size} ${game.time} ${game.increment} ${newColor} ${game.komi} ${game.pieces} ${game.capstones} ${game.unrated} ${game.tournament} ${game.triggerMove} ${game.timeAmount} ${game.opponent}`);
			document.getElementById("rematch").setAttribute("disabled", "disabled");
			document.getElementById('createSeek').setAttribute("disabled", "disabled");
		} else {
			alert("danger", "No previous game found for rematch.");
		}
	}
}
