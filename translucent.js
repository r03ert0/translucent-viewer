/* globals THREE */

const vertexShader = `
varying vec3 vVertexWorldPosition;
varying vec3 vVertexNormal;
void main(){
  vVertexNormal = normalize(normalMatrix * normal);
  vVertexWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const fragmentShader = `
uniform vec3 glowColor;
uniform float coeficient;
uniform float power;
varying vec3 vVertexNormal;
varying vec3 vVertexWorldPosition;
varying vec4 vFragColor;
void main(){
  vec3 worldCameraToVertex= vVertexWorldPosition - cameraPosition;
  vec3 viewCameraToVertex = (viewMatrix * vec4(worldCameraToVertex, 0.0)).xyz;
  viewCameraToVertex = normalize(viewCameraToVertex);
  float intensity = pow(coeficient+dot(vVertexNormal, viewCameraToVertex), power);
  gl_FragColor = vec4(glowColor*intensity, intensity);
}`;

const loadScript = async (path, testScriptPresent) => {
  await new Promise((resolve, reject) => {
    if(testScriptPresent && testScriptPresent()) {
      console.log("[loadScript] Script", path, "already present, not loading it again");
      resolve();
    }
    var s = document.createElement("script");
    s.src = path;
    s.onload=function () {
      document.body.appendChild(s);
      console.log("Loaded", path);
      resolve();
    };
    s.onerror=function(err) {
      console.error('ERROR');
      reject(err);
    };
    document.body.appendChild(s);
  });
};

const _loadAllScripts = async () => {
  // await loadScript('http://localhost/libs/three.js/r119/build/three.min.js', () => typeof window.THREE !== "undefined");
  // await loadScript('http://localhost/libs/three.js/r119/examples/js/modifiers/SubdivisionModifier.js', () => typeof window.THREE.SubdivisionModifier !== "undefined");
  // await loadScript('http://localhost/libs/three.js/r119/examples/js/controls/TrackballControls.js', () => typeof window.THREE.TrackballControls !== "undefined");
  // await loadScript('http://localhost/libs/three.js/r119/examples/js/loaders/PLYLoader.js', () => typeof window.THREE.PLYLoader !== "undefined");
  // await loadScript('http://localhost/libs/pako/0.2.5/pako.min.js', () => typeof window.pako !== "undefined");
  // await loadScript('http://localhost/structjs/struct.js', () => typeof window.Struct !== "undefined");
  // await loadScript('http://localhost/mrijs-neuroanatomy/mri.js', () => typeof window.MRI !== "undefined");

  await loadScript('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r119/build/three.min.js', () => typeof window.THREE !== "undefined");
  await loadScript('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r119/examples/js/modifiers/SubdivisionModifier.js', () => typeof window.THREE.SubdivisionModifier !== "undefined");
  await loadScript('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r119/examples/js/controls/TrackballControls.js', () => typeof window.THREE.TrackballControls !== "undefined");
  await loadScript('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r119/examples/js/loaders/PLYLoader.js', () => typeof window.THREE.PLYLoader !== "undefined");
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pako/1.0.5/pako.min.js', () => typeof window.pako !== "undefined");
  await loadScript('https://cdn.rawgit.com/r03ert0/structjs/v0.0.1/struct.js', () => typeof window.Struct !== "undefined");
  await loadScript('https://cdn.jsdelivr.net/gh/neuroanatomy/mrijs/mri.js', () => typeof window.MRI !== "undefined");
};

// eslint-disable-next-line max-statements
const _initRender = ({backgroundColor, alpha, elemId, brainColor}) => {
  // init renderer
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false, // to get smoother output
    preserveDrawingBuffer: false // to allow screenshot
  });
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setClearColor( backgroundColor, alpha );
  const width=document.querySelector(`#${elemId}`).clientWidth;
  const height=document.querySelector(`#${elemId}`).clientHeight;
  renderer.setSize(width, height);
  document.querySelector(`#${elemId}`).appendChild(renderer.domElement);

  // create a scene
  const scene = new THREE.Scene();
  scene.background = null;

  // add a camera to the scene
  const camera = new THREE.PerspectiveCamera(35, width / height, 10, 500 );
  camera.position.set(0, 0, 40);
  scene.add(camera);

  // add a trackball camera contol
  // cameraControls = new THREE.OrbitControls( camera, document.getElementById(elemId) )
  const cameraControls = new THREE.TrackballControls( camera, document.getElementById(elemId) );
  cameraControls.rotateSpeed=10;

  /*
    cameraControls.addEventListener('mousewheel', () => {console.log('mousewheel');});//cameraControls.update);
    cameraControls.addEventListener('mousemove', () => {console.log('mousemove');});//cameraControls.update()});
    cameraControls.addEventListener('mouseup', () => {console.log('mouseup');});//cameraControls.update);

    cameraControls.addEventListener('mousewheel', () => {cameraControls.update()});
    cameraControls.addEventListener('mousemove', () => {cameraControls.update()});
    cameraControls.addEventListener('mouseup', () => {cameraControls.update()});
  */

  // add lights
  let light = new THREE.AmbientLight( Math.random() * 0xffffff );
  scene.add( light );

  light = new THREE.PointLight( 0xffffff, 2, 80 );
  light.position.copy( camera.position );
  scene.add( light );
  cameraControls.addEventListener('change', () => {
    light.position.copy( camera.position );
    //render();
  } );

  // add the translucent brain mesh
  var oReq = new XMLHttpRequest();
  oReq.open('GET', './lrh3.ply', true);
  oReq.responseType='text';
  // eslint-disable-next-line max-statements
  oReq.onload = function() {
    var tmp=this.response;
    var buffergeometry=new THREE.PLYLoader().parse(tmp);
    var geometry = new THREE.Geometry().fromBufferGeometry(buffergeometry);
    geometry.mergeVertices();
    geometry.sourceType = 'ply';

    geometry.computeFaceNormals();
    geometry.computeVertexNormals();

    // translucent shader
    var material = new THREE.ShaderMaterial({
      uniforms: {
        coeficient: {type: 'f', value: 1.0},
        power: {type: 'f', value: 2},
        glowColor: {type: 'c', value: new THREE.Color(brainColor)}
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false
    });
    var modifier = new THREE.SubdivisionModifier(1);
    geometry = modifier.modify(geometry);

    // hack
    for(var i=0; i<geometry.vertices.length; i++) {
      geometry.vertices[i].x*=0.14;
      geometry.vertices[i].y*=0.14;
      geometry.vertices[i].z*=0.14;
      geometry.vertices[i].y+=3;
      geometry.vertices[i].z-=2;
    }

    const brain=new THREE.Mesh(geometry, material);
    scene.add(brain);
    //render();
  };

  oReq.onerror=function(err) {
    console.error('ERROR', err);
    throw new Error("Unable to initialise Translucent");
  };

  oReq.send();

  return [scene, renderer, camera, cameraControls];
};

const _render = (scene, renderer, cameraControls, camera) => {
  cameraControls.update();
  renderer.render( scene, camera );
};

const _animate = (scene, renderer, cameraControls, camera) => {
  requestAnimationFrame( () => { _animate(scene, renderer, cameraControls, camera); } );
  _render(scene, renderer, cameraControls, camera);
};
export default class Translucent {
  constructor ({elemId="", backgroundColor=0, alpha=1, brainColor='white'}) {
    this.scene = null;
    this.renderer = null;
    this.camera = null;
    this.cameraControls = null;
    this.brain = null;
    this.elemId = elemId;
    this.backgroundColor = backgroundColor;
    this.alpha = alpha;
    this.brainColor = brainColor;
  }

  async init () {
    console.log("init tr");
    await _loadAllScripts();
    ([this.scene, this.renderer, this.camera, this.cameraControls] = _initRender({
      elemId: this.elemId,
      backgroundColor: this.backgroundColor,
      alpha: this.alpha,
      brainColor: this.brainColor
    }));
    _animate(this.scene, this.renderer, this.cameraControls, this.camera);
  }
}
