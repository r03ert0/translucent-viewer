/* globals THREE */

import Translucent from "./translucent.js";

const renderLocations = (scene, locations) => {
  // Add stereotaxic coordinates as spheres
  const geom = new THREE.SphereGeometry(1, 16, 16);
  const color = 0xff0000;
  let j;
  for(j = 0; j < locations.length; j++) {
    const [x, y, z] = locations[j];
    const sph = new THREE.Mesh( geom, new THREE.MeshLambertMaterial({color: color}));
    sph.position.x=parseFloat(x)*0.14;
    sph.position.y=parseFloat(y)*0.14+3;
    sph.position.z=parseFloat(z)*0.14-2;
    scene.add(sph);
  }

};

export default class TranslucentLocations {
  constructor (pars) {
    this.locations = pars.locations;
    this.tr = new Translucent(pars);
  }

  async init () {
    await this.tr.init();
    renderLocations(this.tr.scene, this.locations);
  }
}
