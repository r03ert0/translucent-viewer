'use strict';

var translucentCluster = {
    cmap: {
        dims: []
    },
    flagDataLoaded: null,
    brain: null,
    createTestData: async function createTestData(path) {
        var me=translucentCluster;
        var m = new MRI();
        await m.init();
        await m.loadMRIFromPath(path);
        me.cmap={data:m.data, dims:m.dim, level:0.06};
        me.updateMesh(me.cmap);
        me.flagDataLoaded=true;
    },
    cube_edges: new Int32Array(24),
    edge_table: new Int32Array(256),
    configureCubeEdges: function configureCubeEdges() {
        var me=translucentCluster;
        var k = 0;
        for(var i=0; i<8; ++i) {
            for(var j=1; j<=4; j<<=1) {
                var p = i^j;
                if(i <= p) {
                    me.cube_edges[k++] = i;
                    me.cube_edges[k++] = p;
                }
            }
        }
        for(var i=0; i<256; ++i) {
            var em = 0;
            for(var j=0; j<24; j+=2) {
                var a = !!(i & (1<<me.cube_edges[j]));
                var b = !!(i & (1<<me.cube_edges[j+1]));
                em |= a !== b ? (1 << (j >> 1)) : 0;
            }
            me.edge_table[i] = em;
        }
    },
    buffer: new Int32Array(4096),
    SurfaceNets: function SurfaceNets(data, dims, level) { 
        var me=translucentCluster;
        var vertices = [];
        var faces = [];
        var n = 0;
        var x = new Int32Array(3);
        var R = new Int32Array([1, (dims[0]+1), (dims[0]+1)*(dims[1]+1)]);
        var grid = new Float32Array(8);
        var buf_no = 1;

        if(R[2] * 2 > me.buffer.length)
            me.buffer = new Int32Array(R[2] * 2);

        for(x[2]=0; x[2]<dims[2]-1; ++x[2], n+=dims[0], buf_no ^= 1, R[2]=-R[2])
        {
            var m = 1 + (dims[0]+1) * (1 + buf_no * (dims[1]+1));
            for(x[1]=0; x[1]<dims[1]-1; ++x[1], ++n, m+=2)
            for(x[0]=0; x[0]<dims[0]-1; ++x[0], ++n, ++m)
            {
                var mask = 0, g = 0, idx = n;
                for(var k=0; k<2; ++k, idx += dims[0]*(dims[1]-2))
                for(var j=0; j<2; ++j, idx += dims[0]-2)      
                for(var i=0; i<2; ++i, ++g, ++idx)
                {
                    var p = data[idx]-level;
                    grid[g] = p;
                    mask |= (p < 0) ? (1<<g) : 0;
                }
                if(mask === 0 || mask === 0xff)
                    continue;
                var edge_mask = me.edge_table[mask];
                var v = [0.0,0.0,0.0];
                var e_count = 0;
                for(var i=0; i<12; ++i) {
                    if(!(edge_mask & (1<<i)))
                        continue;
                    ++e_count;
                    var e0 = me.cube_edges[ i<<1 ];    // Unpack vertices
                    var e1 = me.cube_edges[(i<<1)+1];
                    var g0 = grid[e0];                 // Unpack grid values
                    var g1 = grid[e1];
                    var t  = g0 - g1;                  // Compute point of intersection
                    if(Math.abs(t) > 1e-6)
                        t = g0 / t;
                    else
                        continue;
                    for(var j=0, k=1; j<3; ++j, k<<=1) {
                        var a = e0 & k;
                        var b = e1 & k;
                        if(a !== b)
                            v[j] += a ? 1.0 - t : t;
                        else
                            v[j] += a ? 1.0 : 0;
                    }
                }
                var s = 1.0 / e_count;
                for(var i=0; i<3; ++i)
                    v[i] = x[i] + s * v[i];
                me.buffer[m] = vertices.length;
                vertices.push(v);
                for(var i=0; i<3; ++i) {
                    if(!(edge_mask & (1<<i)) )
                        continue;
                    var iu = (i+1)%3;
                    var iv = (i+2)%3;
                    if(x[iu] === 0 || x[iv] === 0)
                        continue;
                    var du = R[iu];
                    var dv = R[iv];
                    if(mask & 1) {
                        faces.push([me.buffer[m], me.buffer[m-du-dv], me.buffer[m-du]]);
                        faces.push([me.buffer[m], me.buffer[m-dv], me.buffer[m-du-dv]]);
                    }
                    else {
                        faces.push([me.buffer[m], me.buffer[m-du-dv], me.buffer[m-dv]]);
                        faces.push([me.buffer[m], me.buffer[m-du], me.buffer[m-du-dv]]);
                    }
                }
            }
        }
        return {
            vertices: vertices,
            faces: faces
        };
    },
    scene: null,
    renderer: null,
    composer: null,
    camera:null,
    cameraControl: null,
    cluster:{
        vertices: [],
        faces: []
    },
    surfacemesh:null,
    updateMesh: function updateMesh(field) {
        var me=translucentCluster;
        if(typeof me.surfacemesh !== 'undefined') {
            me.scene.remove( me.surfacemesh );
        }

        //Create surface mesh
        me.cluster = new THREE.Geometry();

        var start = (new Date()).getTime();
        var result = me.SurfaceNets(field.data,field.dims,field.level);
        var end = (new Date()).getTime();

        me.cluster.vertices.length = 0;
        me.cluster.faces.length = 0;

        for(var i=0; i<result.vertices.length; ++i) {
            var v = result.vertices[i];
            var z=0.5;
            me.cluster.vertices.push(new THREE.Vector3(v[0]*z, v[1]*z, v[2]*z));
        }

        for(var i=0; i<result.faces.length; ++i) {
            var f = result.faces[i];
            if(f.length === 3) {
                me.cluster.faces.push(new THREE.Face3(f[0], f[1], f[2]));
            } else if(f.length === 4) {
                me.cluster.faces.push(new THREE.Face4(f[0], f[1], f[2], f[3]));
            } else {
                //Polygon needs to be subdivided
            }
        }
        
        var cb = new THREE.Vector3(), ab = new THREE.Vector3();
        cb.crossSelf=function(a){
            var b=this.x,c=this.y,d=this.z;
            this.x=c*a.z-d*a.y;
            this.y=d*a.x-b*a.z;
            this.z=b*a.y-c*a.x;
            return this;
        };
    
        for (var i=0; i<me.cluster.faces.length; ++i) {
            var f = me.cluster.faces[i];
            var vA = me.cluster.vertices[f.a];
            var vB = me.cluster.vertices[f.b];
            var vC = me.cluster.vertices[f.c];
            cb.subVectors(vC, vB);
            ab.subVectors(vA, vB);
            cb.crossSelf(ab);
            cb.normalize();
            f.normal.copy(cb)
        }

        me.cluster.verticesNeedUpdate = true;
        me.cluster.elementsNeedUpdate = true;
        me.cluster.normalsNeedUpdate = true;

        me.cluster.computeBoundingBox();
        me.cluster.computeBoundingSphere();

        // toon shader
        var material = new THREE.ShaderMaterial({
            uniforms: { 
                coeficient: {type: 'f', value: 1.0},
                power: {type: 'f', value: 2},
                glowColor: {type: 'c', value: new THREE.Color('black')},
                glowColor2: {type: 'c', value: new THREE.Color('red')},
            },
            vertexShader: [ 'varying vec3 vVertexWorldPosition;',
                                'varying vec3 vVertexNormal;',
                                'void main(){',
                                '  vVertexNormal = normalize(normalMatrix * normal);',
                                '  vVertexWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;',
                                '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                                '}',
                                ].join('\n'),
            fragmentShader: [ 'uniform vec3 glowColor;',
                                'uniform vec3 glowColor2;',
                                'uniform float coeficient;',
                                'uniform float power;',
                                'varying vec3 vVertexNormal;',
                                'varying vec3 vVertexWorldPosition;',
                                'varying vec4 vFragColor;',
                                'void main(){',
                                '  vec3 worldCameraToVertex= vVertexWorldPosition - cameraPosition;',
                                '  vec3 viewCameraToVertex = (viewMatrix * vec4(worldCameraToVertex, 0.0)).xyz;',
                                '  viewCameraToVertex = normalize(viewCameraToVertex);',
                                '  float intensity = pow(coeficient + dot(vVertexNormal, viewCameraToVertex), power);',
                                '   intensity=(intensity>0.33)?((intensity>0.66)?1.0:0.33):0.0;',
                                '  gl_FragColor = vec4(glowColor*(intensity)+glowColor2*(1.0-intensity), 1.0);',
                                '}',
                            ].join('\n')
        });
        me.surfacemesh=new THREE.Mesh( me.cluster, material );
        me.scene.add( me.surfacemesh );

        // hack
        me.surfacemesh.position.x = -field.dims[0]/4.0;
        me.surfacemesh.position.y = -field.dims[1]/4.0;
        me.surfacemesh.position.z = -field.dims[2]/4.0;
    },
    // script loader
    loadScript: function loadScript(path, testScriptPresent) {
        var pr = new Promise(function(resolve, reject) {
            if(testScriptPresent && testScriptPresent()) {
                console.log("[loadScript] Script",path,"already present, not loading it again");
                resolve();
            }
            var s = document.createElement("script");
            s.src = path;
            s.onload=function () {
                document.body.appendChild(s);
                console.log("Loaded",path);
                resolve();
            };
            s.onerror=function() {
                console.error('ERROR');
                reject();
            };
            document.body.appendChild(s);
        });
        return pr;
    },
    // init the scene
    init: async function init(elemId) {
        var me=translucentCluster;
        var pr=new Promise(function(resolve, reject) {
            me.loadScript('http://localhost/libs/jquery/1.10.2/jquery.min.js',function(){return window.jQuery!=undefined})
            .then(function(){return me.loadScript('http://localhost/libs/three.js/98/three.min.js')},function(){return window.THREE!=undefined})
            .then(function(){return me.loadScript('http://localhost/libs/three.js/98/SubdivisionModifier.js')},function(){return window.THREE.SubdivisionModifier!=undefined})
            .then(function(){return me.loadScript('http://localhost/libs/three.js/98/TrackballControls.js')},function(){return window.THREE.TrackballControls!=undefined})
            .then(function(){return me.loadScript('http://localhost/libs/three.js/98/PLYLoader.js')},function(){return window.THREE.PLYLoader!=undefined})
            .then(function(){return me.loadScript('http://localhost/libs/pako/0.2.5/pako.min.js')},function(){return window.pako!=undefined})
            .then(function(){return me.loadScript('http://localhost/structjs/struct.js')},function(){return window.Struct!=undefined})
            .then(function(){return me.loadScript('http://localhost/mrijs/mri.js')},function(){return window.MRI!=undefined})
            /*
            me.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jquery/1.10.2/jquery.min.js',function(){return window.jQuery!=undefined})
            .then(function(){return me.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/74/three.min.js')},function(){return window.THREE!=undefined})
            .then(function(){return me.loadScript('https://cdn.rawgit.com/mrdoob/three.js/r74/examples/js/modifiers/SubdivisionModifier.js')},function(){return window.THREE.SubdivisionModifier!=undefined})
            .then(function(){return me.loadScript('https://cdn.rawgit.com/mrdoob/three.js/r74/examples/js/controls/TrackballControls.js')},function(){return window.THREE.TrackballControls!=undefined})
            .then(function(){return me.loadScript('https://cdn.rawgit.com/mrdoob/three.js/r74/examples/js/loaders/PLYLoader.js')},function(){return window.THREE.PLYLoader!=undefined})
            .then(function(){return me.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pako/1.0.5/pako.min.js')},function(){return window.pako!=undefined})
            .then(function(){return me.loadScript('https://cdn.rawgit.com/r03ert0/structjs/v0.0.1/struct.js')},function(){return window.Struct!=undefined})
            .then(function(){return me.loadScript('https://cdn.rawgit.com/r03ert0/mrijs/v0.0.2/mri.js')},function(){return window.MRI!=undefined})
            */
            .then(async () => {
                // init renderer
                me.renderer = new THREE.WebGLRenderer({
                    antialias: true, // to get smoother output
                    preserveDrawingBuffer: true // to allow screenshot
                });
                me.renderer.setPixelRatio( window.devicePixelRatio );
                me.renderer.setClearColor( 0xffffff, 1 );
                var width=$('#'+elemId).width();
                var height=$('#'+elemId).height();
                me.renderer.setSize(width,height);
                $('#'+elemId).get(0).appendChild(me.renderer.domElement);

                // create a scene
                me.scene = new THREE.Scene();

                // add a camera to the scene
                me.camera = new THREE.PerspectiveCamera(35, width / height,10, 100 );
                me.camera.position.set(0, 0, 40);
                me.scene.add(me.camera);

                // add a trackball camera contol
                me.cameraControls = new THREE.TrackballControls( me.camera, document.getElementById('container') )
                me.cameraControls.rotateSpeed=10;

                // initialise surface nets
                me.configureCubeEdges();

                // add test data
                await me.createTestData('demo-data/1.average-phir.nii.gz');

                // add the translucent brain mesh
                var oReq = new XMLHttpRequest();
                oReq.open('GET', 'lrh3.ply', true);
                oReq.responseType='text';
                oReq.onload = function(oEvent) {
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
                            glowColor: {type: 'c', value: new THREE.Color('black')},
                        },
                        vertexShader: [ 'varying vec3 vVertexWorldPosition;',
                                            'varying vec3 vVertexNormal;',
                                            'void main(){',
                                            '  vVertexNormal = normalize(normalMatrix * normal);',
                                            '  vVertexWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;',
                                            '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                                            '}',
                                            ].join('\n'),
                        fragmentShader: [ 'uniform vec3 glowColor;',
                                            'uniform float coeficient;',
                                            'uniform float power;',
                                            'varying vec3 vVertexNormal;',
                                            'varying vec3 vVertexWorldPosition;',
                                            'varying vec4 vFragColor;',
                                            'void main(){',
                                            '  vec3 worldCameraToVertex= vVertexWorldPosition - cameraPosition;',
                                            '  vec3 viewCameraToVertex = (viewMatrix * vec4(worldCameraToVertex, 0.0)).xyz;',
                                            '  viewCameraToVertex = normalize(viewCameraToVertex);',
                                            '  float intensity = pow(coeficient+dot(vVertexNormal, viewCameraToVertex), power);',
                                            '  gl_FragColor = vec4(glowColor*intensity, intensity);',
                                            '}',
                                        ].join('\n'),
                        transparent: true,
                        depthWrite: false,
                    });
                    var modifier = new THREE.SubdivisionModifier(1);
                    geometry = modifier.modify(geometry);

                    // hack
                    for(var i=0;i<geometry.vertices.length;i++)
                    {
                        geometry.vertices[i].x*=0.14;
                        geometry.vertices[i].y*=0.14;
                        geometry.vertices[i].z*=0.14;
                        geometry.vertices[i].y+=3;
                        geometry.vertices[i].z-=2;
                    }

                    me.brain=new THREE.Mesh(geometry,material);
                    me.scene.add(me.brain);

                    me.animate();

                    resolve();
                };
                oReq.onerror=function() {
                    console.error('ERROR');
                    reject();
                };
                oReq.send();
            });
        });
        return pr;
    },
    // animation loop
    animate: function animate() {
        var me=translucentCluster;
        requestAnimationFrame( me.animate );
        me.render();
    },
    // render the scene
    render: function render() {
        var me=translucentCluster;
        me.cameraControls.update();
        me.renderer.render( me.scene, me.camera );
    }
}
