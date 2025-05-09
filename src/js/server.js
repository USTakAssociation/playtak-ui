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

var ratinglist={}
function fetchratings(){
	var xhttp = new XMLHttpRequest()
	xhttp.onreadystatechange = function(){
		if(this.readyState == 4 && this.status == 200){
			var rawratings=JSON.parse(xhttp.responseText)
			var a,b
			for(a=0;a<rawratings.length;a++){
				var pl=rawratings[a]
				var names=pl[0].split(" ")
				for(b=0;b<names.length;b++){
					ratinglist["!"+names[b]]=pl
				}
			}
			server.rendeergameslist()
			server.rendeerseekslist()
			server.updateplayerinfo()
		}
	}
	xhttp.open("GET",'/ratinglist.json',true)
	xhttp.send()
	//Run shortly after ratings have been generated, random time within 3 minute window, in order to not DDoS the server.
	setTimeout(fetchratings,(Math.ceil(Date.now()/3600000+0.16)-Math.random()*0.05-0.1)*3600000-Date.now())
}

function getratingstring(player){
	var pl=ratinglist["!"+player]
	if(!pl || pl[1]<100){
		return "&numsp;&numsp;&numsp;&numsp;"
	}
	if(pl[1]<1000){
		return "&numsp;"+pl[1]
	}
	return pl[1]+""
}
function getrating(player){
	var pl=ratinglist["!"+player]
	if(pl){
		return pl[1]
	}
	return 0
}
function isbot(player){
	var pl=ratinglist["!"+player]
	if(pl){
		return !!pl[4]
	}
	return false
}

var server = {
	connection:null
	,timeoutvar:null
	,myname:null
	,tries:0
	,timervar:null
	,lastTimeUpdate:null
	,anotherlogin:false
	,loggedin:false
	,seekslist:[]
	,gameslist:[]
	,changeseektime:0
	,newSeek:false

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
		server.send("Protocol 1")
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
	,msg:function(e){
		e = e.replace(/[\n\r]+$/,"")
		if(startswith("OK", e) || startswith("Welcome!", e)){
			// welcome or ok message from the server nothing to do here
		}else if (startswith("Game Start", e)) {
			console.log("Game Start: " + e);
			//Game Start no. size player_white vs player_black yourcolor time
			var spl = e.split(" ");
			board.newgame(Number(spl[3]), spl[7], +spl[9], +spl[10], +spl[11], +spl[12], +spl[13]);
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

			if (spl[7] === "white") {
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

			$(".player1-name:first").html(spl[4]);
			$(".player2-name:first").html(spl[6]);
			document.title = "Tak: " + spl[4] + " vs " + spl[6];

			var time = Number(spl[8]);
			settimers(time * 1000, time * 1000);

			var opponentname;
			if (spl[7] === "white") {
				//I am white
				opponentname = spl[6];
			} else {
				//I am black
				opponentname = spl[4];
			}
			chathandler.createRoom("priv-" + opponentname, "<b>" + opponentname + "</b>");
			chathandler.selectRoom("priv-" + opponentname);

			var chimesound = document.getElementById("chime-sound");
			//chimesound.pause()
			chimesound.currentTime = 0;
			chimesound.play();
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
					document.title = "Play Tak";
					board.result = spl[2];

					var msg = "Game over <span class='bold'>" + spl[2] + "</span><br>";
					var res;
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
		//Online players
		else if (startswith("Online ", e)) {
			$("#onlineplayers").removeClass("hidden");
			var op = document.getElementById("onlineplayersbadge");
			op.innerHTML = Number(e.split("Online ")[1]);
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
		document.getElementById("playerinfo").innerHTML=""
		$("#playerinfo").append((this.myname||"")+" ("+getratingstring(this.myname)+")")
		document.getElementById("playerinfo").href="ratings.html"+(this.myname?"#"+this.myname:"")
	}
	,rendeergameslist:function(){
		var listtable=document.getElementById("gamelist")
		listtable.innerHTML=""
		var a
		for(a=0;a<this.gameslist.length;a++){
			var game=this.gameslist[a]
			var p1 = game.player1
			var p2 = game.player2
			var sz = "<span class='badge'>"+game.size+"x"+game.size+"</span>"
			let p1Element = `<span data-hover="rating">${getratingstring(p1)}</span>&nbsp;<span class="playernamegame">${p1}</span>`;
			let p2Element = `<span class="playernamegame">${p2}</span>&nbsp;<span data-hover="rating">${getratingstring(p2)}</span>`;
			var row = $('<tr/>').addClass('game'+game.id).click(game,function(ev){server.observegame(ev.data)}).appendTo($('#gamelist'))
			$('<td/>').append(p1Element + " vs " + p2Element).appendTo(row);
			$('<td/>').append(sz).addClass("right").appendTo(row)
			$('<td/>').append(minuteseconds(game.time)).addClass("right").attr("data-hover","Time control").appendTo(row)
			$('<td/>').append('+'+minuteseconds(game.increment)).addClass("right").attr("data-hover","Time increment per move").appendTo(row)
			$('<td/>').append('+'+Math.floor(game.komi/2)+"."+(game.komi&1?"5":"0")).attr("data-hover","Komi - If the game ends without a road, black will get this number on top of their flat count when the winner is determined").addClass("right").appendTo(row)
			$('<td/>').append(game.pieces+"/"+game.capstones).addClass("right").attr("data-hover","Stone count - The number of stones/capstones that each player has in this game").appendTo(row)
			$('<td/>').append((game.unrated?"P":"")+(game.tournament?"T":"")).addClass("right").attr("data-hover",(game.unrated?"Unrated game":"")+(game.tournament?"Tournament game":"")).appendTo(row)
			$("<td/>").append(game.triggerMove + "/+" + parseInt(game.timeAmount)).addClass("right").attr("data-hover", "Trigger move and extra time to add in minutes").appendTo(row);
		}
		document.getElementById("gamecount").innerHTML=this.gameslist.length
	}
	,rendeerseekslist:function(){
		var humanlisttable=document.getElementById("seeklist")
		humanlisttable.innerHTML=""
		var botlisttable=document.getElementById("seeklistbot")
		botlisttable.innerHTML=""
		this.seekslist.sort(function(a,b){return getrating(b.player)-getrating(a.player) || ((a.player.toLowerCase()+" "+a.player)>(b.player.toLowerCase()+" "+b.player)?1:-1)})
		var a
		var playercount=0
		var botcount=0
		var myrating=1000
		var levelgap=150
		if(this.myname){
			myrating=getrating(this.myname)||1000
		}
		// remove private seek badge
		const seekBadge = document.getElementById("seekBadge");
		seekBadge.classList.remove("seek-badge");
		for(a=0;a<this.seekslist.length;a++){
			var seek=this.seekslist[a]
			if(seek.opponent != "" && seek.opponent.toLowerCase() != this.myname.toLowerCase() &&  seek.player.toLowerCase() != this.myname.toLowerCase()){
				continue;
			}
			var colourleft="white"
			var colourright="black"
			if(seek.color=="W"){
				colourright="white"
			}
			if(seek.color=="B"){
				colourleft="black"
			}
			var imgstring='<svg class="colourcircle" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" stroke-width="2" fill="'+colourleft+'"></circle><clipPath id="g-clip"><rect height="16" width="8" x="8" y="0"></rect></clipPath><circle cx="8" cy="8" r="6" stroke-width="2" fill="'+colourright+'" clip-path="url(#g-clip)"></circle></svg>'

			var pspan = "<span class='playername'>"+seek.player+"</span>"
			var sizespan = "<span class='badge'>"+seek.size+"</span>"
			var row = $('<tr/>')
				.addClass('seek'+seek.id)
				.click(seek.id,function(ev){server.acceptseek(ev.data)})
			if(seek.opponent!=""){
				row.addClass("privateseek");
				if(!seekBadge.classList.contains("seek-badge")) {
					seekBadge.classList.add("seek-badge")
				}
			}
			if(isbot(seek.player)){
				row.appendTo($('#seeklistbot'))
				botcount++
			}
			else{
				row.appendTo($('#seeklist'))
				playercount++
			}
			var rating=getrating(seek.player)
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
			$('<td/>').append(imgstring).appendTo(row)
			$('<td/>').append(pspan).appendTo(row)
			$('<td/>').append(ratingdecoration+getratingstring(seek.player)).addClass("right").attr("data-hover",ratingtext).appendTo(row)
			$('<td/>').append(sizespan).addClass("right").appendTo(row)
			$('<td/>').append(minuteseconds(seek.time)).addClass("right").attr("data-hover","Time control").appendTo(row)
			$('<td/>').append('+'+minuteseconds(seek.increment)).addClass("right").attr("data-hover","Time increment per move").appendTo(row)
			$('<td/>').append('+'+Math.floor(seek.komi/2)+"."+(seek.komi&1?"5":"0")).addClass("right").attr("data-hover","Komi - If the game ends without a road, black will get this number on top of their flat count when the winner is determined").appendTo(row)
			$('<td/>').append(seek.pieces+"/"+seek.capstones).addClass("right").attr("data-hover","Stone count - The number of stones/capstones that each player has in this game").appendTo(row)
			$('<td/>').append((seek.unrated?"P":"")+(seek.tournament?"T":"")).addClass("right").attr("data-hover",(seek.unrated?"Unrated game":"")+(seek.tournament?"Tournament game":"")).appendTo(row)
			$('<td/>').append(seek.trigger_move+"/+"+seek.time_amount).addClass("right").attr("data-hover", "Extra Time - The trigger move the player must reach and the time to add to the clock").appendTo(row)
		}
		if(!botcount){
			$('<tr/>').append($('<td colspan="9"/>')).appendTo($('#seeklistbot'))
		}
		$('<tr/>').append($('<td colspan="9"/>')).appendTo($('#seeklist'))
		document.getElementById("seekcount").innerHTML=playercount
		document.getElementById("seekcountbot").innerHTML=botcount
		this.changeseektime=Date.now()
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
		$('#joingame-modal').modal('hide')
	}
	,unobserve:function(){
		if(board.gameno !== 0){this.send("Unobserve " + board.gameno)}
	}
	,observegame:function(game){
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
	}
}
