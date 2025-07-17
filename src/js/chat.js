var chathandler={
	chat_width: 200,
	rooms: {},
	cur_room: 'global-',

	createRoom: function(id,name){
		if(this.rooms.hasOwnProperty(id)){
			return;
		}
		var header=$("<div class='roomheader flex flex-space-between flex-align-center'/>").append(name).click(selectThis);
		var roombody=$("<div class='roombody'/>");
		if(id!="global-"){
			var closebutton=$("<button class='chatclose'><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 512'><path d='M310.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L160 210.7 54.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L114.7 256 9.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 301.3 265.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L205.3 256 310.6 150.6z'/></svg></button>").click(closeThis);
			header.append(closebutton);
		}
		this.rooms[id]=[header,roombody,""];
		$("#roomslist").append(header);
		$("#room_divs").append(roombody);
		function selectThis(){
			chathandler.selectRoom(id);
		}
		function closeThis(){
			header.remove();
			roombody.remove();
			delete chathandler.rooms[id];
			if(chathandler.cur_room==id){
				chathandler.selectRoom("global-");
			}
			if(id.split("-")[0]=="room"){
				server.leaveroom(id.replace(/^room\-/,""));
			}
		}
	},
	createPrivateRoom: function(name){
		this.createRoom("priv-"+name,"<b>"+name+"</b>");
	},

	selectRoom: function(id){
		if(this.rooms.hasOwnProperty(id)){
			if(this.rooms.hasOwnProperty(this.cur_room)){
				var oldroom=this.rooms[this.cur_room];
				oldroom[0].removeClass("selected");
				oldroom[1].removeClass("selected");
			}
			var room=this.rooms[id];
			room[0].addClass("selected");
			room[0].removeClass("newmessages");
			let childEl = room[0].children();
			for(let i = 0; i < childEl.length; i++){
				const element = childEl[i];
				if(element.className === 'chat-bubble'){
					element.remove();
				}
			}
			room[1].addClass("selected");
			$("#roomslist").prepend(room[0]);
			this.cur_room=id;
			$("#room_divs").scrollTop($("#room_divs")[0].scrollHeight);
		}
	},
	init: function(){
		this.createRoom("global-","<b>Global</b>");
		this.selectRoom("global-");
	},
	received: function(type,roomName,name,txt){
		var id=type+"-"+roomName;
		if(id!=this.cur_room){
			if(type=="priv" && !this.rooms.hasOwnProperty(id)){
				this.createRoom(id,"<b>"+roomName+"</b>");
			}
			if(this.rooms.hasOwnProperty(id)){
				this.rooms[id][0].addClass("newmessages");
				let chatBubble = document.createElement("div");
				chatBubble.classList.add("chat-bubble");
				this.rooms[id][0].append(chatBubble);
				$("#roomslist").prepend(this.rooms[id][0]);
				$("#roomslist").prepend(this.rooms[this.cur_room][0]);
			}
		}
		if(this.rooms.hasOwnProperty(id)){
			var $cs = this.rooms[id][1];

			var now = new Date();
			var hours = now.getHours();
			var mins = now.getMinutes();
			var cls = 'chattime';
			var timenow = getZero(hours) + ':' + getZero(mins);

			// add check to include chat time
			if(timenow !== this.rooms[id][2]){
				let hiddenAttr = localStorage.getItem('hide-chat-time') === 'true' ? ' hidden' : '';
				$cs.append('<div class="' + cls + '"' + hiddenAttr + '>' + timenow + '</div>');
				this.rooms[id][2] = timenow;
			}
			$cs.append('<span class="chatname context-player">' + name + ':</span>');
			var options = {};

			var occ = (txt.match(new RegExp(server.myname,"g")) || []).length;
			txt = txt.linkify(options);
			var occ2 = (txt.match(new RegExp(server.myname,"g")) || []).length;

			//someone said our name and link in string doesn't contain name
			if(occ === occ2 && txt.indexOf(server.myname) > -1){
				txt = txt.replace(new RegExp('(^|[^\\w\\d])(' + server.myname + ')(?=$|[^\\w\\d])','g'),'$1<span class="chatmyname">$2</span>');
			}

			$cs.append(' ' + txt + '<br>');

			$("#room_divs").scrollTop($("#room_divs")[0].scrollHeight);
		}
	},
	adjustChatWidth: function(width){
		this.chat_width = width;

		$('#chat-size-display').html(this.chat_width);
		$('#chat-size-slider').val(this.chat_width);
		$('#cmenu').width(this.chat_width);

		const vertical = window.screen.width < window.screen.height;
		const chatstore = "showchat" + (vertical ? "v" : "h");
		if(localStorage[chatstore] === "hide"){
			return;
		}
		$('#chat-toggle-button').css('right',this.chat_width+12);
	},
	hideChatTime: function(){
		if(document.getElementById('hide-chat-time').checked){
			localStorage.setItem('hide-chat-time','true');
			$('.chattime').each(function(index){
				$(this).attr('hidden', "true");
			});
		}
		else{
			localStorage.setItem('hide-chat-time','false');
			$('.chattime').each(function(index){
				$(this).removeAttr('hidden');
			});
		}
	},
	send: function(){
		var msg = $('#chat-me').val();
		if(this.cur_room=="global-"){
			server.chat('global','',msg);
		}
		else if(this.cur_room.split("-")[0] == "room"){
			server.chat("room", this.cur_room.split("room-")[1], msg);
		}
		else if(this.cur_room == "admin-admin"){
			server.chat("admin", null, msg);
		}
		else{
			//Assuming priv
			server.chat("priv", this.cur_room.split("priv-")[1], msg);
		}
		$('#chat-me').val('');
		return false;
	}
};


$(function(){
	$.contextMenu({
		selector: '.context-player',
		trigger: 'left',
		items: {
			PrivateChat: {
				name: "Private chat",
				callback: function(key,opt){
					var name = opt.$trigger[0].innerText.split(':')[0];
					var id="priv-"+name;
					chathandler.createRoom(id,"<b>"+name+"</b>");
					chathandler.selectRoom(id);
				}
			},
			Challenge: {
				name: "Challenge",
				callback: function(key, opt){
					const playerName = opt.$trigger[0].innerText.split(':')[0];
					server.challengePlayer(playerName);
				}
			},
			Games: {
				name: "Past Games",
				callback: function(key,opt){
					var name = opt.$trigger[0].innerText.split(':')[0].replace(/[^a-zA-Z0-9_]/g,"");
					//yuck.. but we don't need any more sophistication
					var url="https://www.playtak.com/games/search?player_white="+name+"&mirror=true";
					window.open(url);
				}
			}
		}
	});

	$('.context-player').on('click',function(e){
		console.log('clicked',this);
	});
});
