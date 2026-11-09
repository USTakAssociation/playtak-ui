// three.js only ships as ES modules now, but the app scripts are classic scripts
// that expect a global THREE. Expose one, with the addons under their old names.
import *as THREE from 'three';
import {OrbitControls}from 'three/addons/controls/OrbitControls.js';
import {FontLoader}from 'three/addons/loaders/FontLoader.js';
import {TextGeometry}from 'three/addons/geometries/TextGeometry.js';

window.THREE = {...THREE, OrbitControls, FontLoader, TextGeometry};
