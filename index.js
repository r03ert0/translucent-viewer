/* globals MRI */
import TranslucentCluster from "./translucent-cluster.js";

const trc = new TranslucentCluster({elemId: 'container'});

const updateStats = () => {
  //Update statistics
  document.querySelector('#resolution').innerText = `${
    trc.cmap.dim[0]
  } x ${
    trc.cmap.dim[1]
  } x ${
    trc.cmap.dim[2]
  }`;
  document.querySelector('#vertcount').innerText = trc.cluster.vertices.length;
  document.querySelector('#facecount').innerText = trc.cluster.faces.length;
};

const toggleBrain = () => {
  if (trc.brain) {
    trc.brain.visible = !trc.brain.visible;
  }
};

const handleFileSelect = (evt) => {
  var file = evt.target.files.item(0);
  var m = new MRI();

  m.init()
    .then(() => m.loadMRIFromFile(file))
    .then(() => {
      trc.cmap.data = m.data;
      trc.cmap.dim = m.dim;
      trc.cmap.level = 0.06;
      trc.updateMesh(trc.cmap);
      trc.flagDataLoaded = true;
      updateStats();
    });
};

const handleLevelChange = () => {
  var level = Number(document.querySelector('#level').value) / 100;
  trc.cmap.level = parseFloat(level);
  trc.updateMesh(trc.cmap);
  document.querySelector('#levelValue').innerText = level;
  updateStats();
};

trc.init().then(() => {
  updateStats();

  // Configure file upload
  document.querySelector('#file').addEventListener('change', handleFileSelect);
  document.querySelector('#level').addEventListener('input', handleLevelChange);
  document.querySelector('#showBrain').addEventListener('change', toggleBrain);

  document.querySelector('#level').value = `${0.06 * 100}`;
  document.querySelector('#showBrain').checked = true;
});
