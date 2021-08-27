import * as sn from './surfacenets.js';

addEventListener('message', (e) => {
  // console.log('Worker: Message received from main script:', e.data);
  const [dim, datatype, pixdim, level, data] = e.data;
  const g = sn.init({dim, datatype, pixdim, level, data});
  postMessage(g);
});
