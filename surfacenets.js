/* eslint-disable max-depth */
/* eslint-disable complexity */

const cubeEdges = new Int32Array(24); // surfacenets
const edgeTable = new Int32Array(256); // surfacenets
let buffer = new Int32Array(4096); // surfacenets

const initSurfacenets = () => {
  // self.postMessage({msg:"initSurfacenets"});

  let i, j;
  let k = 0;
  for(i=0; i<8; ++i) {
    for(j=1; j<=4; j<<=1) {
      const p = i^j;
      if(i <= p) {
        cubeEdges[k++] = i;
        cubeEdges[k++] = p;
      }
    }
  }
  for(i=0; i<256; ++i) {
    let em = 0;
    for(j=0; j<24; j+=2) {
      const a = Boolean(i & (1<<cubeEdges[j]));
      const b = Boolean(i & (1<<cubeEdges[j+1]));
      em |= a !== b ? (1 << (j >> 1)) : 0;
    }
    edgeTable[i] = em;
  }
};

// eslint-disable-next-line max-statements
export const surfaceNets = (dim, datatype, pixdims, level, data) => {
  const
    faces = [],
    grid = new Float32Array(8),
    vertices = [],
    x = new Int32Array(3);
  let bufNo = 1;
  let n = 0;
  const R = new Int32Array([1, (dim[0]+1), (dim[0]+1)*(dim[1]+1)]);

  if(R[2] * 2 > buffer.length) {
    buffer = new Int32Array(R[2] * 2);
  }

  for(x[2]=0; x[2]<dim[2]-1; ++x[2], n+=dim[0], bufNo ^= 1, R[2]=-R[2]) {
    let m = 1 + (dim[0]+1) * (1 + bufNo * (dim[1]+1));
    for(x[1]=0; x[1]<dim[1]-1; ++x[1], ++n, m+=2) {
      for(x[0]=0; x[0]<dim[0]-1; ++x[0], ++n, ++m) {
        let g = 0,
          idx = n,
          mask = 0;
        for(let k=0; k<2; ++k, idx += dim[0]*(dim[1]-2)) {
          for(let j=0; j<2; ++j, idx += dim[0]-2) {
            for(let i=0; i<2; ++i, ++g, ++idx) {
              const p = data[idx] - level; // to select a single value: (Math.abs(data[idx]-level)<0.5)?1.0:-1.0;
              grid[g] = p;
              mask |= (p < 0) ? (1<<g) : 0;
            }
          }
        }
        if(mask === 0 || mask === 0xff) {
          continue;
        }
        const edgeMask = edgeTable[mask];
        const v = [0.0, 0.0, 0.0];
        let eCount = 0;
        for(let i=0; i<12; ++i) {
          if(!(edgeMask & (1<<i))) {
            continue;
          }
          ++eCount;
          const e0 = cubeEdges[i<<1]; //Unpack vertices
          const e1 = cubeEdges[(i<<1)+1];
          const g0 = grid[e0]; //Unpack grid values
          const g1 = grid[e1];
          let t = g0 - g1; //Compute point of intersection
          if(Math.abs(t) > 1e-6) {
            t = g0 / t;
          } else {
            continue;
          }
          for(let j=0, k=1; j<3; ++j, k<<=1) {
            const a = e0 & k;
            const b = e1 & k;
            if(a !== b) {
              v[j] += a ? 1.0 - t : t;
            } else {
              v[j] += a ? 1.0 : 0;
            }
          }
        }
        const s = 1.0 / eCount;
        for(let i=0; i<3; ++i) {
          v[i] = (x[i] + s * v[i])*pixdims[i];
        }
        buffer[m] = vertices.length;
        vertices.push(v);
        for(let i=0; i<3; ++i) {
          if(!(edgeMask & (1<<i)) ) {
            continue;
          }
          const iu = (i+1)%3;
          const iv = (i+2)%3;
          if(x[iu] === 0 || x[iv] === 0) {
            continue;
          }
          const du = R[iu];
          const dv = R[iv];
          if(mask & 1) {
            faces.push([buffer[m], buffer[m-du-dv], buffer[m-du]]);
            faces.push([buffer[m], buffer[m-dv], buffer[m-du-dv]]);
          } else {
            faces.push([buffer[m], buffer[m-du-dv], buffer[m-dv]]);
            faces.push([buffer[m], buffer[m-du], buffer[m-du-dv]]);
          }
        }
      }
    }
  }

  return {vertices, faces};
};

export const init = ({dim, datatype, pixdim, level, data}) => {
  initSurfacenets();
  const mesh = surfaceNets(dim, datatype, pixdim, level, data);

  return mesh;
};
