// based on passed in settings, create a 2D board for the game
const defaultBoardSizeSettings = {
	3: {
		stones: 10,
		capstones: 0
	},
	4: {
		stones: 15,
		capstones: 0
	},
	5: {
		stones: 21,
		capstones: 1
	},
	6: {
		stones: 30,
		capstones: 1
	},
	7: {
		stones: 40,
		capstones: 2
	},
	8: {
		stones: 50,
		capstones: 2
	}
}
// function create2DBoard(settings) {
// 	const board = [];
// 	const rows = settings.rows || 8; // default to 8 rows
// 	const cols = settings.cols || 8; // default to 8 columns

// 	for (let i = 0; i < rows; i++) {
// 		const row = [];
// 		for (let j = 0; j < cols; j++) {
// 		row.push(null); // initialize each cell as empty
// 		}
// 		board.push(row);
// 	}

// 	return board;
// }

// render board to the Dom on the 2dCanvas element
function render2DBoard(board, boardID) {
	const canvas = document.getElementById("board-2d-container");
	const squares = document.getElementById("squares-2d");
	if (!canvas) {
		console.error(`Canvas with id ${boardID} not found.`);
		return;
	}
	const yAxisElement = document.getElementById("y-axis");
	canvas.classList.add("size-" + board.size);
	// set letter on the x axis
	const xAxisElement = document.getElementById("x-axis");
	
	// render y axis
	for (let i = 0; i < board.size; i++) {
		const divElement = document.createElement("div");
		divElement.innerHTML = `${i + 1}`;
		yAxisElement.appendChild(divElement);
	}
	//render x axis
	for (let i = 0; i < board.size; i++) {
		const divElement = document.createElement("div");
		const letter = String.fromCharCode(65 + i); // A, B, C, ...
		divElement.innerHTML = letter;
		xAxisElement.appendChild(divElement);
	}
	let row = board.size;
	for (let i = 0; i < board.size * board.size; i++) {
		const squareElement = document.createElement("div");
		squareElement.className = "square";
		if (i % 2 === 0) {
			squareElement.classList.add("black");
		} else {
			squareElement.classList.add("white");
		}
		if (i % board.size === 0 && i !== 0) {
			row--;
		}
		// set the style for grid-row on the square
		squareElement.style.gridRow = row;
		// if the index is a modulus of 5 subtract 1 from row to set the new row
		
		squareElement.style.grid
		squareElement.setAttribute("data-index", `${String.fromCharCode(65 + i)+ (i+1)}`);
		squares.appendChild(squareElement);
	}
}

function create2dPieces(settings) {
	const boardSize = settings.boardSize || 5; // default to 5x5
	const sizeSettings = defaultBoardSizeSettings[boardSize];
	const stones = settings.stones || sizeSettings.stones;
	const capstones = settings.capstones || sizeSettings.capstones;
	
	return {
		stones,
		capstones
	};
}

function render2dPieces(settings, boardElement) {
	 if (!boardElement) {
		console.error("Board element is required for rendering pieces.");
		return;
	}
	const pieces = create2dPieces(settings);
	 for (let i = 0; i < pieces.stones; i++) {
		// render each stone on the board
	}
	 for (let i = 0; i < pieces.capstones; i++) {
		// render each capstone on the board
	}
}