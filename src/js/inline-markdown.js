// Lightweight inline markdown renderer for chat messages.
// Supports: **bold**, *italic*, __underline__, ~~strikethrough~~, `code`, [links](url), bare URLs

function escapeHtml(str){
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function inlineMarkdown(text){
	if(!text){return "";}

	let html = escapeHtml(text);

	// `code`
	html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

	// **bold**
	html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

	// *italic*
	html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

	// __underline__
	html = html.replace(/__(.+?)__/g, "<u>$1</u>");

	// ~~strikethrough~~
	html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

	// [text](url)
	html = html.replace(
		/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
		'<a href="$2" target="_blank" rel="noopener">$1</a>'
	);

	// Bare URLs (not already inside a markdown link)
	html = html.replace(
		/(^|[\s(])(https?:\/\/[^\s<)]+)/g,
		'$1<a href="$2" target="_blank" rel="noopener">$2</a>'
	);

	// Newlines
	html = html.replace(/\n/g, "<br>");

	return html;
}
