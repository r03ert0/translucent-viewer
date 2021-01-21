'use strict';

function Translucent() {
    var me = {
        brain: null,
        scene: null,
        renderer: null,
        composer: null,
        camera:null,
        cameraControl: null,
        light: null,
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
        init: async function init(pars) {
            var {elemId} = pars;
            let backgroundColor = 0xffffff;
            let brainColor = 'black';
            if(typeof pars.backgroundColor !== 'undefined') {
                backgroundColor = pars.backgroundColor;
            }
            if(typeof pars.brainColor !== 'undefined') {
                brainColor = pars.brainColor;
            }
            var pr=new Promise(function(resolve, reject) {
                /*
                me.loadScript('http://localhost/libs/jquery/1.10.2/jquery.min.js',function(){return window.jQuery!=undefined})
                .then(function(){return me.loadScript('http://localhost/libs/three.js/98/three.min.js')},function(){return window.THREE!=undefined})
                .then(function(){return me.loadScript('http://localhost/libs/three.js/98/SubdivisionModifier.js')},function(){return window.THREE.SubdivisionModifier!=undefined})
                .then(function(){return me.loadScript('http://localhost/libs/three.js/98/OrbitControls.js')},function(){return window.THREE.OrbitControls!=undefined})
                .then(function(){return me.loadScript('http://localhost/libs/three.js/98/TrackballControls.js')},function(){return window.THREE.TrackballControls!=undefined})
                .then(function(){return me.loadScript('https://cdn.rawgit.com/mrdoob/three.js/r98/examples/js/controls/TrackballControls.js')},function(){return window.THREE.TrackballControls!=undefined})
                .then(function(){return me.loadScript('http://localhost/libs/three.js/98/PLYLoader.js')},function(){return window.THREE.PLYLoader!=undefined})
                .then(function(){return me.loadScript('http://localhost/libs/pako/0.2.5/pako.min.js')},function(){return window.pako!=undefined})
                .then(function(){return me.loadScript('http://localhost/structjs/struct.js')},function(){return window.Struct!=undefined})
                .then(function(){return me.loadScript('http://localhost/mrijs/mri.js')},function(){return window.MRI!=undefined})
                */
                me.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jquery/1.10.2/jquery.min.js',function(){return window.jQuery!=undefined})
                .then(function(){return me.loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/98/three.min.js')},function(){return window.THREE!=undefined})
                .then(function(){return me.loadScript('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r98/examples/js/modifiers/SubdivisionModifier.js')},function(){return window.THREE.SubdivisionModifier!=undefined})
                .then(function(){return me.loadScript('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r98/examples/js/controls/TrackballControls.js')},function(){return window.THREE.TrackballControls!=undefined})
                .then(function(){return me.loadScript('https://cdn.jsdelivr.net/gh/mrdoob/three.js@r98/examples/js/loaders/PLYLoader.js')},function(){return window.THREE.PLYLoader!=undefined})
                .then(function(){return me.loadScript('https://cdnjs.cloudflare.com/ajax/libs/pako/1.0.5/pako.min.js')},function(){return window.pako!=undefined})
                .then(function(){return me.loadScript('https://cdn.jsdelivr.net/gh/r03ert0/structjs@v0.0.1/struct.js')},function(){return window.Struct!=undefined})
                .then(function(){return me.loadScript('https://cdn.jsdelivr.net/gh/r03ert0/mrijs@v0.0.2/mri.js')},function(){return window.MRI!=undefined})
                .then(async () => {
                    // init renderer
                    me.renderer = new THREE.WebGLRenderer({
                        antialias: true, // to get smoother output
                        preserveDrawingBuffer: true // to allow screenshot
                    });
                    me.renderer.setPixelRatio( window.devicePixelRatio );
                    me.renderer.setClearColor( backgroundColor, 1 );
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
//                  me.cameraControls = new THREE.OrbitControls( me.camera, document.getElementById(elemId) )
                    me.cameraControls = new THREE.TrackballControls( me.camera, document.getElementById(elemId) )
                    me.cameraControls.rotateSpeed=10;

/*
                    me.cameraControls.addEventListener('mousewheel', () => {console.log('mousewheel');});//me.cameraControls.update);
                    me.cameraControls.addEventListener('mousemove', () => {console.log('mousemove');});//me.cameraControls.update()});
                    me.cameraControls.addEventListener('mouseup', () => {console.log('mouseup');});//me.cameraControls.update);

                    me.cameraControls.addEventListener('mousewheel', () => {me.cameraControls.update()});
                    me.cameraControls.addEventListener('mousemove', () => {me.cameraControls.update()});
                    me.cameraControls.addEventListener('mouseup', () => {me.cameraControls.update()});
*/

                    // add light
                    me.light = new THREE.AmbientLight( Math.random() * 0xffffff );
                    me.scene.add( me.light );
                    me.light = new THREE.PointLight( 0xffffff,2,80 );
                    me.light.position.copy( me.camera.position );
                    me.scene.add( me.light );
                    me.cameraControls.addEventListener('change', () => {
                        me.light.position.copy( me.camera.position );
                        //me.render();
                    } );

                    // add the translucent brain mesh
                    var oReq = new XMLHttpRequest();
                    oReq.open('GET', 'http://localhost/translucent-viewer/lrh3.ply', true);
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
                                glowColor: {type: 'c', value: new THREE.Color(brainColor)},
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
                        //me.render();

                        resolve();
                    };
                    oReq.onerror=function(err) {
                        console.error('ERROR', err);
                        reject();
                    };
                    oReq.send();
                });
            });
            return pr;
        },
        // animation loop
        animate: function animate() {
            requestAnimationFrame( me.animate );
            me.render();
        },
        // render the scene
        render: function render() {
            me.cameraControls.update();
            me.renderer.render( me.scene, me.camera );
        }
    };
    return me;
}
