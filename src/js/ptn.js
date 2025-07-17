function parsePTN(text){
	text = text.replace(/\r/g, "");
	text = text.replace(/\{[^}]+\}/gm, "");

	var header = parsePTNHeader(text);

	var body = text.replace(/\[(\S+)\s+\"([^"]+)\"\]/g, "").trim();
	var moves = parsePTNMoves(body);
	if(header && moves){
		return {
			tags: header,
			moves: moves
		};
	}
	return null;
}

function parsePTNHeader(header){
	var tags = {};
	var match;
	var re = /\[(\S+)\s+\"([^"]+)\"\]/gm;
	while((match = re.exec(header)) !== null){
		tags[match[1]] = match[2];
	}
	return tags;
}

function parsePTNMoves(body){
	var bits = body.split(/\s+/);
	var moves = [];
	for(var i = 0; i < bits.length; i++){
		var tok = bits[i];
		if(tok.match(/\d+\./)){
			continue;
		}
		moves.push(tok);
	}
	return moves;
}

// Play Tak Server notation conversion functions
// copied from https://gist.github.com/gruppler/031b8863b9439700d5ab30694aab0b9d
// takes in psn and converts it to ptn
function toPTN(notation){
	return notation
		.split(",")
		.map((ply) =>
			ply
				.replace(
					/^P ([A-H][1-8]) ?(C|W)?/,
					(s, sq, type) => (type ? type.replace("W", "S") : "") + sq.toLowerCase()
				)
				.replace(/^M ([A-H][1-8]) ([A-H][1-8])(( \d)+)/, (s, sq1, sq2, drops) => {
					drops = drops.split(" ");
					const total = drops.reduce((total, count) => total + +count, 0) + "";
					drops = drops.join("");
					const a = +(sq1[0] !== sq2[0]);
					const b = +(a ? sq1[0] < sq2[0] : sq1[1] < sq2[1]);
					const direction = [
						["-", "+"],
						["<", ">"]
					][a][b];
					return (total > 1 ? total : "") + sq1.toLowerCase() + direction + (drops !== total ? drops : "");
				}))
		.join(" ");
}

// takes ptn and converts it to psn
function fromPTN(notation){
	const atoi = (coord) => ["ABCDEFGH".indexOf(coord[0]), parseInt(coord[1], 10) - 1];
	const itoa = ([x, y]) => "ABCDEFGH"[x] + (y + 1);

	return notation
		.split(" ")
		.map((ply) => {
			const matchData = ply.match(/(\d)?([CS])?([a-h])([1-8])(([<>+-])([1-8]+)?(\*)?)?/i);

			if(!matchData){
				throw new Error("Invalid PTN format");
			}

			let [ptn, pieceCount, specialPiece, column, row, movement, direction, drops, wallSmash] = matchData;

			const type = movement ? "M" : "P";
			const sq1 = column.toUpperCase() + row;

			ply = `${type} ${sq1}`;

			if(type === "P" && specialPiece){
				if(specialPiece === "S"){
					ply += " W";
				}
				else if(specialPiece === "C"){
					ply += " C";
				}
			}
			else if(type === "M"){
				if(!pieceCount){
					pieceCount = 1;
				}
				if(!drops){
					drops = String(pieceCount);
				}
				const distance = drops.length;
				let sq2 = atoi(sq1);
				switch (direction){
					case "+":
						sq2[1] = sq2[1] + distance;
						break;
					case "-":
						sq2[1] = sq2[1] - distance;
						break;
					case ">":
						sq2[0] = sq2[0] + distance;
						break;
					case "<":
						sq2[0] = sq2[0] - distance;
						break;
				}
				sq2 = itoa(sq2);
				ply += ` ${sq2} ${drops.split("").join(" ")}`;
			}

			return ply;
		})
		.join(",");
}

/**
 * Copied from tps-ninja
 * supports - as an alternative to / for handling TPS passed from a URL
 * @param {string} tps
 * @returns Object with grid, player, linenum, size, and error properties
 */
function parseTPS(tps){
	const matchData = tps
		.toUpperCase()
		.match(/^([X1-8SC,/-]+)\s+([12])\s+(\d+)$/);
	const result = {};

	if(!matchData){
		result.error = "Invalid TPS notation";
		return result;
	}

	[, result.grid, result.player, result.linenum] = matchData;

	result.grid = result.grid
		.replace(/X(\d+)/g, (x, count) => {
			const spaces = ["X"];
			while(spaces.length < count){
				spaces.push("X");
			}
			return spaces.join(",");
		})
		.split(/[/-]/)
		.reverse()
		.map((row) => row.split(","));
	result.size = result.grid.length;
	result.player = Number(result.player);
	result.linenum = Number(result.linenum);

	const validCell = /^(X|[12]+[SC]?)$/;
	if(
		result.grid.find(
			(row) =>
				row.length !== result.size || row.find((cell) => !validCell.test(cell))
		)
	){
		result.error = "Invalid TPS notation";
	}
	return result;
};
