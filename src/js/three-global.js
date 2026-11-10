// three.js only ships as ES modules now, but the app scripts are classic scripts
// that expect a global THREE. Expose one, with the addons under their old names.
import *as THREE from 'three';
import {OrbitControls}from 'three/addons/controls/OrbitControls.js';
import {FontLoader}from 'three/addons/loaders/FontLoader.js';
import {TextGeometry}from 'three/addons/geometries/TextGeometry.js';

// The r110 controls turned horizontal drags by width, r187 by height, which spins far faster on wide screens.
class OrbitControlsWidth extends OrbitControls {
	_rotateLeft(angle){
		super._rotateLeft(angle * this.domElement.clientHeight / this.domElement.clientWidth);
	}
}

window.THREE = {...THREE, OrbitControls: OrbitControlsWidth, FontLoader, TextGeometry};
