// three.js only ships as ES modules now, but the app scripts are classic scripts
// that expect a global THREE. Expose one, with the addons under their old names.
import *as THREE from 'three';
import {OrbitControls}from 'three/addons/controls/OrbitControls.js';
import {FontLoader}from 'three/addons/loaders/FontLoader.js';
import {TextGeometry}from 'three/addons/geometries/TextGeometry.js';

// shortcut: r110-style colour (no colour management) to match the old look; switch to sRGB before loading glTF models.
// Set here, before any app script creates a material, or those colours get converted.
THREE.ColorManagement.enabled = true;

window.THREE = {...THREE, OrbitControls, FontLoader, TextGeometry};
