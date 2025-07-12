function parsePTN(text) {
	text = text.replace(/\r/g, "");
	text = text.replace(/\{[^}]+\}/gm, "");

	var header = parsePTNHeader(text);

	var body = text.replace(/\[(\S+)\s+\"([^"]+)\"\]/g, "").trim();
	var moves = parsePTNMoves(body);
	if (header && moves) {
		return {
			tags: header,
			moves: moves,
		};
	}
	return null;
}

function parsePTNHeader(header) {
	var tags = {};
	var match;
	var re = /\[(\S+)\s+\"([^"]+)\"\]/gm;
	while ((match = re.exec(header)) !== null) {
		tags[match[1]] = match[2];
	}
	return tags;
}

function parsePTNMoves(body) {
	var bits = body.split(/\s+/);
	var moves = [];
	for (var i = 0; i < bits.length; i++) {
		var tok = bits[i];
		if (tok.match(/\d+\./)) {
			continue;
		}
		moves.push(tok);
	}
	return moves;
}

// Play Tak Server notation conversion functions
// copied from https://gist.github.com/gruppler/031b8863b9439700d5ab30694aab0b9d
// takes in psn and converts it to ptn
function toPTN(notation) {
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
						["<", ">"],
					][a][b];
					return (total > 1 ? total : "") + sq1.toLowerCase() + direction + (drops !== total ? drops : "");
				})
		)
		.join(" ");
}

// takes ptn and converts it to psn
function fromPTN(notation) {
	const atoi = (coord) => ["ABCDEFGH".indexOf(coord[0]), parseInt(coord[1], 10) - 1];
	const itoa = ([x, y]) => "ABCDEFGH"[x] + (y + 1);

	return notation
		.split(" ")
		.map((ply) => {
			const matchData = ply.match(/(\d)?([CS])?([a-h])([1-8])(([<>+-])([1-8]+)?(\*)?)?/i);

			if (!matchData) {
				throw new Error("Invalid PTN format");
			}

			let [ptn, pieceCount, specialPiece, column, row, movement, direction, drops, wallSmash] = matchData;

			const type = movement ? "M" : "P";
			const sq1 = column.toUpperCase() + row;

			ply = `${type} ${sq1}`;

			if (type === "P" && specialPiece) {
				if (specialPiece === "S") {
					ply += " W";
				} else if (specialPiece === "C") {
					ply += " C";
				}
			} else if (type === "M") {
				if (!pieceCount) {
					pieceCount = 1;
				}
				if (!drops) {
					drops = String(pieceCount);
				}
				const distance = drops.length;
				let sq2 = atoi(sq1);
				switch (direction) {
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
function parseTPS(tps) {
	const matchData = tps
		.toUpperCase()
		.match(/^([X1-8SC,/-]+)\s+([12])\s+(\d+)$/);
	const result = {};

	if (!matchData) {
		result.error = "Invalid TPS notation";
		return result;
	}

	[, result.grid, result.player, result.linenum] = matchData;

	result.grid = result.grid
		.replace(/X(\d+)/g, (x, count) => {
		const spaces = ["X"];
		while (spaces.length < count) {
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
	if (
		result.grid.find(
		(row) =>
			row.length !== result.size || row.find((cell) => !validCell.test(cell))
		)
	) {
		result.error = "Invalid TPS notation";
	}
	return result;
};

if (typeof require === "function") {
	var ptn1 =
		'[Site "PlayTak.com"]\n' +
		'[Event "Online Play"]\n' +
		'[Date "2016.10.22"]\n' +
		'[Time "22:06:19"]\n' +
		'[Player1 "nelhage"]\n' +
		'[Player2 "Ally"]\n' +
		'[Clock "10:0 +15"]\n' +
		'[Result "F-0"]\n' +
		'[Size "5"]\n' +
		"\n" +
		"1. a1 e1\n" +
		"2. d2 a2\n" +
		"3. a3 b2\n" +
		"4. b3 Cc3\n" +
		"5. Cc2 b4\n" +
		"6. b1 1c3<1\n" +
		"7. 1b1+1 2b3-2\n" +
		"8. Sb3 a4\n" +
		"9. e2 e4\n" +
		"10. d4 d5\n" +
		"11. c4 c5\n" +
		"12. c3 e5\n" +
		"13. b5 1b4+1\n" +
		"14. 1c4+1 2b5>2\n" +
		"15. Sb5 3c5-3\n" +
		"16. 1d4<1 1c5-1\n" +
		"17. 1c3+1 Sb4\n" +
		"18. 5c4>32 1b4>1\n" +
		"19. c3 2c4>2\n" +
		"20. c5 c4\n" +
		"21. b4 1c4+1\n" +
		"22. c4 5d4<23\n" +
		"23. 1b5>1 1e5-1\n" +
		"24. 2c5-2 4e4-112\n" +
		"25. d1 1d5<1\n" +
		"26. 4c4>13 4b4>4\n" +
		"27. d3 d5\n" +
		"28. e5 5c4>5\n" +
		"29. c4 Sb4\n" +
		"30. 1c2>1 c1\n" +
		"31. 2d2+11 4b2>13\n" +
		"32. 3e4-12 b1\n" +
		"33. 1d1<1 b2\n" +
		"34. 1b3-1 d1\n" +
		"35. 3e2-3 3d2+3\n" +
		"36. 5d4+5 2e3+11\n" +
		"37. 4d5>4 5d3+5\n" +
		"38. 5e1<5 Se3\n" +
		"39. b5";

	console.log(parsePTN(ptn1));
}
