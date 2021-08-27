/* globals THREE, MRI */

import Translucent from "./translucent.js";

// toon shader
const vertexShader = `
  varying vec3 vVertexWorldPosition;
  varying vec3 vVertexNormal;
  void main() {
    vVertexNormal = normalize(normalMatrix * normal);
    vVertexWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const fragmentShader = `
  uniform vec3 glowColor;
  uniform vec3 glowColor2;
  uniform float coeficient;
  uniform float power;
  varying vec3 vVertexNormal;
  varying vec3 vVertexWorldPosition;
  varying vec4 vFragColor;
  void main() {
    vec3 worldCameraToVertex= vVertexWorldPosition - cameraPosition;
    vec3 viewCameraToVertex = (viewMatrix * vec4(worldCameraToVertex, 0.0)).xyz;
    viewCameraToVertex = normalize(viewCameraToVertex);
    float intensity = pow(coeficient + dot(vVertexNormal, viewCameraToVertex), power);
    intensity=(intensity>0.33)?((intensity>0.66)?1.0:0.33):0.0;
    gl_FragColor = vec4(glowColor*(intensity)+glowColor2*(1.0-intensity), 1.0);
  }`;
let material;

const initToonShaderMaterial = () => {
  material = new THREE.ShaderMaterial({
    uniforms: {
      coeficient: {
        type: 'f',
        value: 1.0
      },
      power: {
        type: 'f',
        value: 2
      },
      glowColor: {
        type: 'c',
        value: new THREE.Color('black')
      },
      glowColor2: {
        type: 'c',
        value: new THREE.Color('red')
      }
    },
    vertexShader,
    fragmentShader
  });
};

// eslint-disable-next-line max-statements
const _drawResult = (result, self) => {
  self.cluster.vertices.length = 0;
  self.cluster.faces.length = 0;

  for (let i = 0; i < result.vertices.length; ++i) {
    var v = result.vertices[i];
    var z = 0.5;
    self.cluster.vertices.push(new THREE.Vector3(v[0] * z, v[1] * z, v[2] * z));
  }

  for (let i = 0; i < result.faces.length; ++i) {
    const f = result.faces[i];
    if (f.length === 3) {
      self.cluster.faces.push(new THREE.Face3(f[0], f[1], f[2]));
    } else if (f.length === 4) {
      self.cluster.faces.push(new THREE.Face4(f[0], f[1], f[2], f[3]));
    } else {
      // Polygon needs to be subdivided
    }
  }

  const cb = new THREE.Vector3();
  const ab = new THREE.Vector3();
  cb.crossSelf = function (a) {
    var b = this.x,
      c = this.y,
      d = this.z;
    this.x = c * a.z - d * a.y;
    this.y = d * a.x - b * a.z;
    this.z = b * a.y - c * a.x;

    return this;
  };

  for (let i = 0; i < self.cluster.faces.length; ++i) {
    const f = self.cluster.faces[i];
    const vA = self.cluster.vertices[f.a];
    const vB = self.cluster.vertices[f.b];
    const vC = self.cluster.vertices[f.c];
    cb.subVectors(vC, vB);
    ab.subVectors(vA, vB);
    cb.crossSelf(ab);
    cb.normalize();
    f.normal.copy(cb);
  }

  self.cluster.verticesNeedUpdate = true;
  self.cluster.elementsNeedUpdate = true;
  self.cluster.normalsNeedUpdate = true;

  self.cluster.computeBoundingBox();
  self.cluster.computeBoundingSphere();

  initToonShaderMaterial();
  if (self.surfacemesh !== null) {
    self.tr.scene.remove(self.surfacemesh);
    self.surfacemesh = null;
  }
  self.surfacemesh = new THREE.Mesh(self.cluster, material);
  self.tr.scene.add(self.surfacemesh);

  // hack
  self.surfacemesh.position.x = -self.cmap.dim[0] / 4.0;
  self.surfacemesh.position.y = -self.cmap.dim[1] / 4.0;
  self.surfacemesh.position.z = -self.cmap.dim[2] / 4.0;
};

export default class TranslucentCluster {
  constructor (pars = {assetsPath: "./"}) {
    this.assetsPath = pars.assetsPath;
    this.cluster = {
      vertices: [],
      faces: []
    };
    this.flagDataLoaded = false;
    this.cmap = {
      dim: [0, 0, 0]
    };
    this.surfacemesh = null;

    this.tr = new Translucent(pars);
    this.snw = new Worker(this.assetsPath + "surfacenets.worker.js", {type: "module"});
  }

  updateMesh (field) {
    this.cmap = field;

    // Create surface mesh
    this.cluster = new THREE.Geometry();

    this.snw.postMessage([
      field.dim,
      field.datatype,
      [1, 1, 1], // field.pixdim,
      field.level,
      field.data
    ]);
  }

  createEmptyData (dim) {
    const data = new Float32Array(dim[0] * dim[1] * dim[2]);
    let i;
    for (i = 0; i < dim[0] * dim[1] * dim[2]; i++) {
      data[i] = 0;
    }
    this.cmap = {
      data,
      dim,
      level: 0.1
    };
    this.updateMesh(this.cmap);
    this.flagDataLoaded = true;
  }

  async createTestData (path) {
    var m = new MRI();
    await m.init();
    await m.loadMRIFromPath(path);

    this.cmap = {
      dim: m.dim,
      datatype: m.datatype,
      pixdim: m.pixdim,
      data: m.data,
      level: 0.06
    };
    this.updateMesh(this.cmap);
    this.flagDataLoaded = true;
  }

  async init () {
    await this.tr.init();
    await this.createTestData(this.assetsPath + 'demo-data/1.average-phir.nii.gz');

    this.snw.addEventListener('message', (event) => {
      const {vertices, faces} = event.data;
      _drawResult({vertices, faces}, this);
    });
  }
}
