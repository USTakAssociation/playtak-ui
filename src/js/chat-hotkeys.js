// Markdown formatting hotkeys for the chat input, Discord-style.
// Ctrl+B  → **bold**
// Ctrl+I  → *italic*
// Ctrl+U  → __underline__
// Ctrl+Shift+X → ~~strikethrough~~
// Ctrl+E  → `code`
// Paste URL while text is selected → [selected](url)

$(function(){
	const input = document.getElementById("chat-me");
	if(!input){return;}

	const formatMap = {
		"b": {prefix: "**", suffix: "**"},
		"i": {prefix: "*", suffix: "*"},
		"u": {prefix: "__", suffix: "__"},
		"e": {prefix: "`", suffix: "`"}
	};

	input.addEventListener("keydown", function(e){
		if(!e.ctrlKey && !e.metaKey){return;}

		// Ctrl+Shift+X → strikethrough
		if(e.shiftKey && e.key.toLowerCase() === "x"){
			e.preventDefault();
			wrapSelection(input, "~~", "~~");
			return;
		}

		const key = e.key.toLowerCase();
		const fmt = formatMap[key];
		if(!fmt){return;}

		e.preventDefault();
		wrapSelection(input, fmt.prefix, fmt.suffix);
	});

	input.addEventListener("paste", function(e){
		const sel = getSelection(input);
		if(!sel.text){return;} // no selection — let normal paste happen

		const clipText = (e.clipboardData || window.clipboardData).getData("text");
		if(!clipText){return;}

		// Only intercept if pasting a URL
		if(!/^https?:\/\/\S+$/.test(clipText.trim())){return;}

		e.preventDefault();
		replaceSelection(input, "[" + sel.text + "](" + clipText.trim() + ")");
	});

	function getSelection(el){
		const start = el.selectionStart;
		const end = el.selectionEnd;
		return {
			start: start,
			end: end,
			text: el.value.substring(start, end)
		};
	}

	function replaceSelection(el, replacement){
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const val = el.value;
		el.value = val.substring(0, start) + replacement + val.substring(end);
		const cursorPos = start + replacement.length;
		el.setSelectionRange(cursorPos, cursorPos);
		el.focus();
	}

	function wrapSelection(el, prefix, suffix){
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const val = el.value;
		const selected = val.substring(start, end);

		if(selected){
			// Wrap the selected text
			const wrapped = prefix + selected + suffix;
			el.value = val.substring(0, start) + wrapped + val.substring(end);
			// Select the inner text (without the markers)
			el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
		}
		else{
			// No selection — insert markers and place cursor in the middle
			const inserted = prefix + suffix;
			el.value = val.substring(0, start) + inserted + val.substring(end);
			const cursorPos = start + prefix.length;
			el.setSelectionRange(cursorPos, cursorPos);
		}
		el.focus();
	}
});
