import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { CCDIKSolver} from 'https://cdn.skypack.dev/three@0.136/examples/jsm/animation/CCDIKSolver.js';
import {GUI} from 'https://cdn.skypack.dev/dat.gui'
import { FABRIKSolver } from './FABRIKSolver.js'

class App {

    constructor() {

        this.clock = new THREE.Clock();
        this.loaderGLB = new GLTFLoader();
        
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.controls = null;

        
        // current model selected
        this.model = null;
        this.mixer = null;
        this.skeletonHelper = null;

        this.msg = {};
        this.gui = new GUI();
        this.chains = [];
        this.solvers = ["CCDIK", "FABRIK", "MIX"];
        this.solver = this.solvers[1];
    }

    init() {
        let that = this;
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0xa0a0a0 );
        
        const gridHelper = new THREE.GridHelper( 10, 10 );
        gridHelper.position.set(0,0.001,0);
        this.scene.add( gridHelper );
        
        let ground = new THREE.Mesh( new THREE.PlaneGeometry( 300, 300 ), new THREE.MeshStandardMaterial( { color: 0x141414, depthWrite: true, roughness: 1, metalness: 0 } ) );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add( ground );
        
        // lights
        let hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.3 );
        this.scene.add( hemiLight );

        let dirLight = new THREE.DirectionalLight ( 0xffffff, 0.5 );
        dirLight.position.set( 3,5,3 );
        this.scene.add( dirLight );

        
        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        //this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        //this.renderer.toneMappingExposure = 0.7;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild( this.renderer.domElement );

        // camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.01, 1000);
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.object.position.set(0.0, 1.5, 1);
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 7;
        this.controls.target.set(0.0, 1.3, 0);
        this.controls.update();

        // so the screen is not black while loading
        this.renderer.render( this.scene, this.camera );
        
        function loadModel ( callback, glb  ){
            let model = this.model = glb.scene;

            model = glb.scene;
            //model.rotateOnAxis (new THREE.Vector3(1,0,0), -Math.PI/2);
            model.castShadow = true;
            
            /*// EVA
            model.traverse( (object) => {
                if ( object.isMesh || object.isSkinnedMesh ) {
                    object.material.side = THREE.FrontSide;
                    object.frustumCulled = false;
                    object.castShadow = true;
                    object.receiveShadow = true;
                    if (object.name == "Eyelashes")
                        object.castShadow = false;
                        if(object.material.map) 
                        object.material.map.anisotropy = 16;
                    } else if (object.isBone) {
                        object.scale.set(1.0, 1.0, 1.0);
                    }
                    
                } );
                */
            // woman.gltf
            const textureLoader = new THREE.TextureLoader();
            model.traverse( (object) => {
                if ( object.isMesh || object.isSkinnedMesh ) {
                    object.material.side = THREE.FrontSide;
                    object.frustumCulled = false;
                    object.castShadow = true;
                    object.receiveShadow = true;
                    textureLoader.load( "./data/models/lowPoly/woman.png", (texture) => { 
                        object.material = new THREE.MeshStandardMaterial( {side: THREE.FrontSide, map: texture, roughness: 0.7, metalness: 0.1} );
                        object.material.map.flipY = false;
                    } );
                    object.pose()
                }
                   
            } );
                

            let skeletonHelper = this.skeletonHelper = new THREE.SkeletonHelper( model );
            skeletonHelper.visible = true;
            skeletonHelper.frustumCulled = false;
            this.scene.add(skeletonHelper);
            this.scene.add(model);

            // load the actual animation to play
            this.mixer = new THREE.AnimationMixer( model );

            if ( callback ){ callback (); }

        }


        function loadfinished() {
            //EVA
            this.model.position.set(0.05, 0.8, 0 );
            this.model.rotateY(-Math.PI/2)
            //woman.gltf
            this.model.scale.set(0.25,0.25,0.25);

            this.skeleton = this.model.getObjectByName("Woman").skeleton;
            
            this.IKTargetArm = new THREE.Bone();
            this.scene.add( this.IKTargetArm );
            this.skeleton.bones.push(this.IKTargetArm)
            this.skeleton.boneInverses.push(new THREE.Matrix4());
            this.skeleton.boneMatrices =  [...this.skeleton.boneMatrices, ...new THREE.Matrix4().toArray()];
            this.IKTargetLeg = new THREE.Bone();
            this.scene.add( this.IKTargetLeg );
            this.skeleton.bones.push(this.IKTargetLeg)
            this.skeleton.boneInverses.push(new THREE.Matrix4());
            this.skeleton.boneMatrices =  [...this.skeleton.boneMatrices, ...new THREE.Matrix4().toArray()];

            this.transfControl = new TransformControls( this.camera, this.renderer.domElement );
            this.transfControl.addEventListener( 'dragging-changed', function ( event ) { that.controls.enabled = ! event.value; } );
            this.transfControl.attach( this.IKTargetArm );
            this.transfControl.size = 0.6;
            this.scene.add( this.transfControl );
            this.transfControl2 = new TransformControls( this.camera, this.renderer.domElement );
            this.transfControl2.addEventListener( 'dragging-changed', function ( event ) { that.controls.enabled = ! event.value; } );
            this.transfControl2.attach( this.IKTargetLeg );
            this.transfControl2.size = 0.6;
            this.scene.add( this.transfControl2 );


            this.IKTargetArm.position.set(1, 1, 0)
            this.IKTargetLeg.position.set(0.5, 0, 0)
            
            window.addEventListener("keydown", this.onKeyDown.bind(this));
            
            this.animate();
            this.initCCDIK();
            this.initFabrik(true);
            this.initGUI()
            $('#loading').fadeOut(); //hide();
        }
        
        //this.loaderGLB.load( './data/models/Eva_Y.glb', loadModel.bind( this, loadfinished.bind(this) ) );
        this.loaderGLB.load( './data/models/lowPoly/woman.gltf', loadModel.bind( this, loadfinished.bind(this) ) );
        
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
        
    }
    
    /**
    * @description
    * Initialization of CCD solver. Add Left Arm and Left Leg chains [Bone origin, ..., Bone end-effector] to the solver with their corresponding constraints and targetgs.
    */
    initCCDIK(){
        this.chains = [
            {
                name: 'leftArm',
                target: this.skeleton.bones.length-2, // "target_hand_l"
                effector: 10, // "hand_l"
                links: [
                    {
                        index: 9, // "lowerarm_l"
                        limitX: true,
                        limitY: true,
                        limitZ: true,
                        rotationMin: new THREE.Vector3(0 ,0, 0 ), //68, 103.13, -22.92
                        rotationMax: new THREE.Vector3(0 ,1.1,1.1 ) // 97, -63, 17
                    },
                    {
                        index: 8, // "Upperarm_l"
                        limitX: true,
                        limitY: true,
                        limitZ: true,
                        rotationMin: new THREE.Vector3(-1.8, -0.7, -2  ), //6, -40, 103.13
                        rotationMax: new THREE.Vector3( 1.4,  0.0, 1.8 ) // 63, 0, -80 
                    },
                ],
            },
            {
                name: 'leftLeg',
                target: this.skeleton.bones.length-1, // "target_leg_l"
                effector: 33, // "foot_l"
                links: [
                    {
                        index: 32, // "leg_l"
                        limitX: true,
                        limitY: true,
                        limitZ: true,
                        rotationMin: new THREE.Vector3(-Math.PI ,-0.4, 0 ), //68, 103.13, -22.92
                        rotationMax: new THREE.Vector3(0 ,0.4,0 ) // 97, -63, 17
                    },
                    {
                        index: 31, // "Upperleg_l"
                        limitX: true,
                        limitY: true,
                        limitZ: true,
                        rotationMin: new THREE.Vector3(-1.8, -0.4, -Math.PI  ), //6, -40, 103.13
                        rotationMax: new THREE.Vector3( 1.4,  0.4, Math.PI ) // 63, 0, -80 
                    },
                ],
            }
        ];
        
      
        this.CCDIKSolver = new CCDIKSolver( this.model.getObjectByName("Woman"), this.chains );

    }

    /**
    * @description
    * Initialization of FABRIK solver. Add Left Arm and Left Leg chains [Bone origin, ..., Bone end-effector] to the solver with their corresponding constraints and targetgs.
    * @params
    * constraints: Boolean that indicates if the chains have to be constrained
    */
    initFabrik(constraints) {

        this.FABRIKSolver = new FABRIKSolver( this.skeleton );
        if(constraints) {

            this.FABRIKSolver.createChain( 
                [33, 32, 31], 
                [ null,    {type: FABRIKSolver.JOINTTYPES.HINGE, twist:[ 0, 0.0001 ], axis:[1,0,0], min: Math.PI, max: Math.PI * 1.8 },   {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, twist:[ -Math.PI*0.25, Math.Pi*0.25 ], polar:[0, Math.PI*0.45]}], 
                this.IKTargetLeg // OBject3D (or equivalents) for now. It must be in the scene
            ); 

            this.FABRIKSolver.createChain( 
                [10, 9, 8], 
                [ null,    {type: FABRIKSolver.JOINTTYPES.HINGE, twist:[ 0, Math.PI*0.5 ], axis:[1,0,0], min: Math.PI, max: Math.PI * 1.8 },   {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, twist:[ -Math.PI*0.25, Math.Pi*0.25 ], polar:[0, Math.PI*0.5]}], 
                this.IKTargetArm // OBject3D (or equivalents) for now. It must be in the scene
            );  


        }
        else {
            this.FABRIKSolver.createChain( 
                [33, 32, 31], 
                [ null,    null,   null], 
                this.IKTargetLeg // OBject3D (or equivalents) for now. It must be in the scene
            );  
            this.FABRIKSolver.createChain( 
                [10, 9], 
                [ null,    null,   null], 
                this.IKTargetArm // OBject3D (or equivalents) for now. It must be in the scene
            );  
        }
    }

    initGUI() {
        let solver = this.gui.addFolder("Solver");

        solver.add({solver: this.solver}, 'solver', this.solvers).name("Solver").onChange(v => {
            
            if(v == "MIX") {
                this.initFabrik(false);
            }
            else if(v == "FABRIK") {
                this.initFabrik(true);
            }
            this.solver = v;
            
        })
        
        let constraintsEnabler = { v: true };
        //solver.add( constraintsEnabler, "v" ).onChange( v => { this.FABRIKSolver.constraintsEnabler = v; });

        for(let i = 0; i < this.chains.length; i++){
            let folder = this.gui.addFolder(this.chains[i].name);
            let bones = this.skeleton.bones;
            for(let j = 0; j < this.chains[i].links.length; j++){
                let subfolder = folder.addFolder("Bone "+ bones[this.chains[i].links[j].index].name);
                
                subfolder.add(this.chains[i].links[j], "limitX").listen().onChange(v => { 
                    if(!v){ 
                        this.chains[i].links[j].rotationMin.x = -2*Math.PI
                        this.chains[i].links[j].rotationMax.x = 2*Math.PI
                    }});
                    subfolder.add(this.chains[i].links[j].rotationMin, "x", -2*Math.PI, 2*Math.PI)
                .name("Min")           
                .onChange(                      
                    value => {
                        this.chains[i].links[j].rotationMin.x = value;                
                    }
                ); 
                subfolder.add(this.chains[i].links[j].rotationMax, "x", -2*Math.PI, 2*Math.PI) 
                .name("Max")            
                .onChange(                      
                    value => {
                        this.chains[i].links[j].rotationMax.x = value;               
                    }
                ); 

                subfolder.add(this.chains[i].links[j], "limitY").listen();
                subfolder.add(this.chains[i].links[j].rotationMin, "y", -2*Math.PI, 2*Math.PI) 
                .name("Min")         
                .onChange(                    
                    value => {
                        this.chains[i].links[j].rotationMin.y = value;             
                    }
                ); 

                subfolder.add(this.chains[i].links[j].rotationMax, "y", -2*Math.PI, 2*Math.PI) 
                .name("Max")      
                .onChange(          
                    value => {
                        this.chains[i].links[j].rotationMax.y = value;            
                    }
                ); 

                subfolder.add(this.chains[i].links[j], "limitZ").listen();
                subfolder.add(this.chains[i].links[j].rotationMin, "z", -2*Math.PI, 2*Math.PI) 
                .name("Min")             
                .onChange(                     
                    value => {
                        this.chains[i].links[j].rotationMin.z = value;                                      
                    }
                ); 
                subfolder.add(this.chains[i].links[j].rotationMax, "z", -2*Math.PI, 2*Math.PI) 
                .name("Max")        
                .onChange(                      
                    value => {
                        this.chains[i].links[j].rotationMax.z = value;                                          
                    }
                ); 
            }

        }
    }
    animate() {

        requestAnimationFrame( this.animate.bind(this) );

        let delta = this.clock.getDelta();
        let et = this.clock.getElapsedTime();

       // if ( this.mixer ) { this.mixer.update(delta); }

        // EVA correct hand's size
        //this.model.getObjectByName("mixamorig_RightHand").scale.set( 0.85, 0.85, 0.85 );
        //this.model.getObjectByName("mixamorig_LeftHand").scale.set( 0.85, 0.85, 0.85 );

        //this.skeleton.pose();
        for( let i = 0; i<this.skeleton.bones.length; ++i){
            this.skeleton.bones[i].scale.set(1,1,1);
        }

        if(this.CCDIKSolver && this.FABRIKSolver) {
            switch(this.solver) {
                case "CCDIK":
                    this.CCDIKSolver.update();
                    break;

                case "FABRIK":
                    this.FABRIKSolver.update();
                    break;

                case "MIX":
                    this.FABRIKSolver.update();
                    
                    this.CCDIKSolver.update();
                    break;
            }
        }

            
        this.renderer.render( this.scene, this.camera );
    }
    
    onKeyDown ( e ){
        switch( e.key ){
            case 'a': this.FABRIKSolver.constraintsEnabler = !this.FABRIKSolver.constraintsEnabler; break; 
            case '1': this.FABRIKSolver.iterations = 1; break;
            case '2': this.FABRIKSolver.iterations = 2; break;
            case '3': this.FABRIKSolver.iterations = 3; break;
            case '4': this.FABRIKSolver.iterations = 4; break;
            case '5': this.FABRIKSolver.iterations = 5; break;
            case '6': this.FABRIKSolver.iterations = 6; break;
            case '7': this.FABRIKSolver.iterations = 10; break;
            case '8': this.FABRIKSolver.iterations = 20; break;
            case '9': this.FABRIKSolver.iterations = 30; break;
        }
    }

    onWindowResize() {

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }

}

let app = new App();
app.init();
window.global = {app:app};
export { app };
