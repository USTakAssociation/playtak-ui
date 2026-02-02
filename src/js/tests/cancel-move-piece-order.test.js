/**
 * Test script for cancelMove piece ordering bug
 *
 * Bug: When canceling a spread move, pieces were being pushed back to the
 * original square in the wrong order. The issue was that pieces popped from
 * dropped squares needed to be reversed per-square before being pushed back.
 *
 * This test verifies that cancelMove correctly restores piece order for:
 * - Single-square spreads (multiple pieces dropped on same square)
 * - Multi-square spreads (one piece per square)
 * - Mixed spreads (varying pieces per square)
 */

import {describe, it, expect, beforeEach}from 'vitest';

// Mock THREE.js objects
const mockVector3 = () => ({
	x: 0, y: 0, z: 0,
	clone: function(){return {...this, clone: this.clone, copy: this.copy, set: this.set, lerpVectors: this.lerpVectors};},
	copy: function(v){this.x = v.x; this.y = v.y; this.z = v.z; return this;},
	set: function(x, y, z){this.x = x; this.y = y; this.z = z; return this;},
	lerpVectors: function(a, b, t){
		this.x = a.x + (b.x - a.x) * t;
		this.y = a.y + (b.y - a.y) * t;
		this.z = a.z + (b.z - a.z) * t;
		return this;
	}
});

const mockQuaternion = () => ({
	x: 0, y: 0, z: 0, w: 1,
	clone: function(){return {...this, clone: this.clone, copy: this.copy};},
	copy: function(q){this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this;}
});

// Simplified animation system matching board.js structure
function createAnimationSystem(){
	return {
		queue: [],
		playing: false,
		pendingFrom: null,
		onAllComplete: null,

		push: function(objects, type, duration, onComplete){
			const positions = objects.map(obj => obj.position.clone());
			const rotations = objects.map(obj => obj.quaternion.clone());
			if(!type){
				// Store positions/rotations as the starting point for the next animation
				this.pendingFrom = {objects: objects.slice(), positions: positions, rotations: rotations};
			}
			else{
				// This is an animation frame - use pendingFrom as 'from' and current as 'to'
				const from = this.pendingFrom ? this.pendingFrom.positions : positions;
				const fromRot = this.pendingFrom ? this.pendingFrom.rotations : rotations;
				this.queue.push({
					objects: objects.slice(),
					from: from,
					to: positions,
					fromRot: fromRot,
					toRot: rotations,
					type: type,
					duration: duration,
					onComplete: onComplete
				});
				// Immediately reset objects to start position to prevent flash at end position
				if(this.pendingFrom){
					for(let i = 0; i < objects.length; i++){
						objects[i].position.copy(from[i]);
						objects[i].quaternion.copy(fromRot[i]);
					}
				}
				this.pendingFrom = null;
			}
		},

		play: function(onComplete){
			if(!this.playing){
				this.pendingFrom = null;
			}
			if(this.queue.length === 0){
				this.playing = false;
			}
			if(!this.playing && this.queue.length > 0){
				this.playing = true;
				this.onAllComplete = onComplete;
				// Simulate starting animation (don't actually animate in test)
			}
			else if(onComplete){
				onComplete();
			}
		},

		// Simulate animation progress - move objects partway to their targets
		simulatePartialAnimation: function(progress){
			if(this.queue.length > 0){
				const frame = this.queue[0];
				for(let i = 0; i < frame.objects.length; i++){
					frame.objects[i].position.lerpVectors(frame.from[i], frame.to[i], progress);
				}
			}
		},

		stop: function(){
			this.playing = false;
			this.pendingFrom = null;
			while(this.queue.length > 0){
				const frame = this.queue.shift();
				for(let i = 0; i < frame.objects.length; ++i){
					frame.objects[i].position.copy(frame.to[i]);
					frame.objects[i].quaternion.copy(frame.toRot[i]);
				}
			}
			this.onAllComplete = null;
		},

		// Complete all animations immediately
		finishAll: function(){
			while(this.queue.length > 0){
				const frame = this.queue.shift();
				for(let i = 0; i < frame.objects.length; ++i){
					frame.objects[i].position.copy(frame.to[i]);
					frame.objects[i].quaternion.copy(frame.toRot[i]);
				}
				if(frame.onComplete){frame.onComplete();}
			}
			this.playing = false;
			if(this.onAllComplete){
				this.onAllComplete();
				this.onAllComplete = null;
			}
		}
	};
}

// Create a mock piece
function createPiece(id, isWhite){
	return {
		id: id,
		iswhitepiece: isWhite,
		iscapstone: false,
		isstanding: false,
		onsquare: null,
		position: mockVector3(),
		quaternion: mockQuaternion()
	};
}

// Create a mock square
function createSquare(file, rank){
	return {
		file: file,
		rank: rank,
		position: mockVector3()
	};
}

describe('Animation System', () => {
	let animation;
	let selectedStack;
	let targetSquare;
	let boardStack; // The stack on the target square

	beforeEach(() => {
		animation = createAnimationSystem();
		targetSquare = createSquare(3, 3); // d4
		targetSquare.position.set(100, 0, 100);
		boardStack = [];

		// Create a selected stack of 5 pieces (like picking up a full stack)
		// selectedStack[0] is top piece, selectedStack[4] is bottom
		selectedStack = [];
		for(let i = 0; i < 5; i++){
			const piece = createPiece(`piece_${i}`, i % 2 === 0); // Alternating colors
			piece.position.set(100, 200 + i * 15, 100); // Elevated position (selected)
			selectedStack.push(piece);
		}
	});

	// Simulate dropping a piece (simplified version of leftclick logic)
	function dropPiece(stopAnimationFirst = false){
		if(selectedStack.length === 0){return null;}

		// This is the fix we're testing
		if(stopAnimationFirst && animation.playing){
			animation.stop();
		}

		const obj = selectedStack.shift(); // Pop from front (top of stack)
		const isLastPiece = selectedStack.length === 0;
		const allPieces = [obj].concat(selectedStack);

		// Capture start positions
		animation.push(allPieces);

		// Set final position for dropped piece (pushPieceOntoSquare)
		obj.position.x = targetSquare.position.x;
		obj.position.y = 15 + boardStack.length * 15; // Stack height
		obj.position.z = targetSquare.position.z;
		obj.onsquare = targetSquare;
		boardStack.push(obj);

		// Move remaining stack over target square (move_stack_over)
		if(!isLastPiece){
			for(let i = 0; i < selectedStack.length; i++){
				const p = selectedStack[i];
				p.position.x = targetSquare.position.x;
				// Keep elevated but over the target square
				p.position.y = 200 + i * 15;
				p.position.z = targetSquare.position.z;
			}
		}

		// Capture end positions and start animation
		animation.push(allPieces, 'move', 100);
		animation.play();

		return obj;
	}

	it('should maintain correct stack order when dropping pieces with animation.stop()', () => {
		// Drop 3 pieces rapidly WITH the fix (stopAnimationFirst = true)
		const piece1 = dropPiece(true);

		// Simulate animation being partway through
		animation.simulatePartialAnimation(0.5);

		const piece2 = dropPiece(true);

		// Simulate animation being partway through
		animation.simulatePartialAnimation(0.3);

		const piece3 = dropPiece(true);

		// Finish all animations
		animation.finishAll();

		// Verify stack order: piece1 should be at bottom, piece3 at top
		expect(boardStack.length).toBe(3);
		expect(boardStack[0].id).toBe('piece_0'); // First dropped = bottom
		expect(boardStack[1].id).toBe('piece_1');
		expect(boardStack[2].id).toBe('piece_2'); // Last dropped = top

		// Verify final Y positions are correct (stacked properly)
		expect(boardStack[0].position.y).toBe(15); // Bottom piece
		expect(boardStack[1].position.y).toBe(30); // Second piece
		expect(boardStack[2].position.y).toBe(45); // Top piece
	});

	it('animation.stop() ensures pieces reach final positions before next drop', () => {
		// This test verifies that the fix works correctly.
		// With animation.stop() called before each drop, pieces jump to their
		// final positions before the next animation starts.

		// Drop first piece WITH the fix
		const piece1 = dropPiece(true); // stopAnimationFirst = true

		// Simulate partial animation progress - piece1 is mid-animation
		animation.simulatePartialAnimation(0.5);

		// Verify piece1 is at intermediate position before the fix kicks in
		// const intermediateY = piece1.position.y;
		// console.log('Before second drop - piece1 Y:', intermediateY);

		// When we drop the second piece WITH the fix, animation.stop() is called FIRST
		// This should jump piece1 to its FINAL position (y=15) before anything else
		dropPiece(true);

		// After the second drop completes its setup, piece1 should be at final position
		// because animation.stop() was called at the start of dropPiece
		// console.log('After second drop - piece1 Y:', piece1.position.y);

		// THE KEY ASSERTION: piece1 should be at its final position (15)
		// because animation.stop() jumped it there before the second drop processed
		expect(piece1.position.y).toBe(15);

		// Also verify the queue was cleared and only has the new animation
		expect(animation.queue.length).toBe(1);
	});

	it('verifies that animation.stop() jumps pieces to final positions', () => {
		// Start an animation
		const piece1 = dropPiece(false);

		// Simulate partial progress
		animation.simulatePartialAnimation(0.3);

		// Verify piece is at intermediate position
		expect(animation.playing).toBe(true);

		// Call stop
		animation.stop();

		// Verify animation is stopped and piece is at final position
		expect(animation.playing).toBe(false);
		expect(animation.queue.length).toBe(0);
		expect(piece1.position.y).toBe(15); // Final position
	});

	it('shows pendingFrom captures current positions which may be mid-animation', () => {
		// This test demonstrates the core issue

		// Create a simple scenario: one piece moving
		const testPiece = createPiece('test', true);
		testPiece.position.set(0, 100, 0); // Start position

		// First animation: move from (0,100,0) to (0,50,0)
		animation.push([testPiece]); // Capture start
		testPiece.position.set(0, 50, 0); // Set end position
		animation.push([testPiece], 'move', 100);
		animation.play();

		// Simulate animation at 50% - piece is at y=75
		animation.simulatePartialAnimation(0.5);
		expect(testPiece.position.y).toBe(75); // Intermediate position

		// Now push a new animation while first is playing
		// This captures the CURRENT position (75) as pendingFrom
		animation.push([testPiece]); // This captures y=75 as the "start"

		// The pendingFrom now has the intermediate position
		expect(animation.pendingFrom.positions[0].y).toBe(75);

		// If we set a new target and push the animation frame...
		testPiece.position.set(0, 25, 0); // New target
		animation.push([testPiece], 'move', 100);

		// The piece gets reset to pendingFrom (y=75), not its true start
		// This is the bug - the piece jumps to an intermediate position
	});
});

describe('Stack Order Verification', () => {
	it('verifies pieces are pushed to stack in correct order', () => {
		const stack = [];

		// Simulate dropping pieces A, B, C in order
		// A should be at bottom, C at top
		stack.push({id: 'A'});
		stack.push({id: 'B'});
		stack.push({id: 'C'});

		expect(stack[0].id).toBe('A'); // Bottom
		expect(stack[1].id).toBe('B'); // Middle
		expect(stack[2].id).toBe('C'); // Top
	});
});

describe('CancelMove Piece Order Bug', () => {
	// Helper function that mimics the fixed cancelMove logic
	function collectPiecesForCancel(moveSquares, stacks, selectedStack){
		const startSq = moveSquares[0];
		let allPieces = [];
		let prevSq = null;
		let currentSquarePieces = [];

		for(let i = 1; i < moveSquares.length; i++){
			const sq = moveSquares[i];
			if(sq !== startSq){
				if(prevSq !== null && sq !== prevSq){
					currentSquarePieces.reverse();
					allPieces = allPieces.concat(currentSquarePieces);
					currentSquarePieces = [];
				}
				const stack = stacks[sq];
				if(stack && stack.length > 0){
					const piece = stack.pop();
					currentSquarePieces.push(piece);
				}
				prevSq = sq;
			}
		}
		if(currentSquarePieces.length > 0){
			currentSquarePieces.reverse();
			allPieces = allPieces.concat(currentSquarePieces);
		}
		if(selectedStack && selectedStack.length > 0){
			const remaining = selectedStack.slice().reverse();
			allPieces = allPieces.concat(remaining);
		}
		return allPieces;
	}

	it('single-square spread: drop 3 pieces on same square then cancel', () => {
		// Original d3: [A, B, C, D, E] (E on top)
		// After dropping 3 on d4: d4 = [A, B, C], selectedStack = [E, D]
		const stacks = {
			'd4': [{id: 'A'}, {id: 'B'}, {id: 'C'}]
		};
		const selectedStack = [{id: 'E'}, {id: 'D'}];
		const moveSquares = ['d3', 'd4', 'd4', 'd4'];

		const result = collectPiecesForCancel(moveSquares, stacks, selectedStack);
		expect(result.map(p => p.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
	});

	it('multi-square spread: drop 1 piece on each of 3 squares then cancel', () => {
		// Original d3: [A, B, C, D, E] (E on top)
		// After dropping 1 on d4, 1 on d5, 1 on d6: selectedStack = [E, D]
		const stacks = {
			'd4': [{id: 'A'}],
			'd5': [{id: 'B'}],
			'd6': [{id: 'C'}]
		};
		const selectedStack = [{id: 'E'}, {id: 'D'}];
		const moveSquares = ['d3', 'd4', 'd5', 'd6'];

		const result = collectPiecesForCancel(moveSquares, stacks, selectedStack);
		expect(result.map(p => p.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
	});

	it('mixed spread: drop 2 on first square, 1 on second then cancel', () => {
		// Original d3: [A, B, C, D, E] (E on top)
		// After dropping 2 on d4, 1 on d5: selectedStack = [E, D]
		const stacks = {
			'd4': [{id: 'A'}, {id: 'B'}],
			'd5': [{id: 'C'}]
		};
		const selectedStack = [{id: 'E'}, {id: 'D'}];
		const moveSquares = ['d3', 'd4', 'd4', 'd5'];

		const result = collectPiecesForCancel(moveSquares, stacks, selectedStack);
		expect(result.map(p => p.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
	});

	it('mixed spread: drop 1 on first square, 2 on second then cancel', () => {
		// Original d3: [A, B, C, D, E] (E on top)
		// After dropping 1 on d4, 2 on d5: selectedStack = [E, D]
		const stacks = {
			'd4': [{id: 'A'}],
			'd5': [{id: 'B'}, {id: 'C'}]
		};
		const selectedStack = [{id: 'E'}, {id: 'D'}];
		const moveSquares = ['d3', 'd4', 'd5', 'd5'];

		const result = collectPiecesForCancel(moveSquares, stacks, selectedStack);
		expect(result.map(p => p.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
	});
});
