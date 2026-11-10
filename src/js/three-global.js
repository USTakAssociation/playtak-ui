// three.js only ships as ES modules now, but the app scripts are classic scripts
// that expect a global THREE. Expose one, with the addons under their old names.
import *as THREE from 'three';
import {OrbitControls}from 'three/addons/controls/OrbitControls.js';
import {FontLoader}from 'three/addons/loaders/FontLoader.js';
import {TextGeometry}from 'three/addons/geometries/TextGeometry.js';

// Keep the r110 controls' feel where r187 changed it.
class OrbitControlsR110 extends OrbitControls {
	// r110 turned horizontal drags by width, r187 by height, which spins far faster on wide screens.
	_rotateLeft(angle){
		super._rotateLeft(angle * this.domElement.clientHeight / this.domElement.clientWidth);
	}
	// r110 zoomed one step per wheel event, so a mouse notch (48px or more in every browser) stays one step,
	// while a trackpad's many tiny events each count as part of a step.
	// shortcut: 30px per step was tuned by feel on a Mac trackpad; raise it to slow trackpads down, lower it to speed them up.
	_getZoomScale(delta){
		return Math.pow(0.95, this.zoomSpeed * Math.min(1, Math.abs(delta) / 30));
	}
}

window.THREE = {...THREE, OrbitControls: OrbitControlsR110, FontLoader, TextGeometry};
