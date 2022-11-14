import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
import { CCDIKSolver} from 'https://cdn.skypack.dev/three@0.136/examples/jsm/animation/CCDIKSolver.js';
import { FABRIKSolver } from './FABRIKSolver.js'
import { GUI } from './gui.js'
import {Gizmo} from './gizmo.js'

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
        //this.skeletonHelper = null;

        this.msg = {};

        // this.chains = [];
        // this.fabrikChains = [];
        this.solvers = ["CCDIK", "FABRIK", "MIX"];
        this.solver = this.solvers[0];
        this.modelsNames = ["Eva", "LowPoly"];
        // this.currentModel = this.models[0];
        let eva = new Character("Eva", "./data/models/Eva_Y2.glb");
        let lowPoly = new Character("LowPoly", "./data/models/lowPoly/woman.gltf");
        this.models = [eva, lowPoly];
        
        this.currentModel = this.models[1];
        this.gui = new GUI(this);        
    
    }

    init() {
        let that = this;
        
        this.initScene();
        
        // renderer
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        //this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        //this.renderer.toneMappingExposure = 0.7;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.shadowMap.enabled = true;
        this.renderer.domElement.id = "webgl-canvas";
        let canvasArea = document.getElementById("canvasarea");
        canvasArea.appendChild( this.renderer.domElement );

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
        this.initCharacter();
        this.gizmo = new Gizmo(this);
        
        window.addEventListener( 'resize', this.onWindowResize.bind(this) );
        
    }
    
    initScene() {
        
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

    }

    initCharacter() {
        

        function loadModel ( callback, character, glb ){
            character.model = glb.scene;
            
            //model.rotateOnAxis (new THREE.Vector3(1,0,0), -Math.PI/2);
            character.model.castShadow = true;
            const textureLoader = new THREE.TextureLoader();
            character.model.traverse( (object) => {
                if ( object.isMesh || object.isSkinnedMesh ) {
                    object.material.side = THREE.FrontSide;
                    object.frustumCulled = false;
                    object.castShadow = true;
                    object.receiveShadow = true;
                    // woman.gltf
                    if(character.name == "LowPoly") {
                        textureLoader.load( "./data/models/lowPoly/woman.png", (texture) => { 
                            object.material = new THREE.MeshStandardMaterial( {side: THREE.FrontSide, map: texture, roughness: 0.7, metalness: 0.1} );
                            object.material.map.flipY = false;
                        } );
                    }
                    character.skeleton = object.skeleton;
                    // object.pose()
                }
                    
            } );
                
            if(character.name == "Eva") {
                //EVA
                character.model.scale.set(0.01,0.01,0.01);
            } else{
                //woman.gltf
                // this.model.position.set(0.05, 0.8, 0 );
                // this.model.rotateY(-Math.PI/2)
                character.model.scale.set(0.25,0.25,0.25);
            }

            //this.skeleton = this.model.getObjectByName("Woman").skeleton;
            character.model.skeleton = character.skeleton;
            character.bonesIdxs = {};
            for(let i = 0; i < character.skeleton.bones.length; i++) {
                let name = character.skeleton.bones[i].name.replace("mixamorig_", "");
                if(name == "LeftUpLeg") {
                    character.bonesIdxs["LeftUpLeg"] = i;
                }
                else if(name == "LeftLeg") {
                    character.bonesIdxs["LeftLeg"] = i;
                }
                else if(name == "LeftFoot") {
                    character.bonesIdxs["LeftFoot"] = i;
                }
                else if(name == "LeftArm") {
                    character.bonesIdxs["LeftArm"] = i;
                }
                else if(name == "LeftForeArm") {
                    character.bonesIdxs["LeftForeArm"] = i;
                }
                else if(name == "LeftHand") {
                    character.bonesIdxs["LeftHand"] = i;
                }
            }
            character.model.name = "Character_"+character.name;
            character.model.visible = this.currentModel.name == character.name;
            this.scene.add(character.model);
            
            character.skeletonHelper = new THREE.SkeletonHelper( character.model );
            character.skeletonHelper.visible = true;
            character.skeletonHelper.frustumCulled = false;
            character.skeletonHelper.name = "SkeletonHelper_" + character.name;
            character.skeletonHelper.visible = this.currentModel.name == character.name;;
            this.scene.add(character.skeletonHelper);
            // load the actual animation to play
            //this.mixer = new THREE.AnimationMixer( model );

            if ( callback ){ callback(character); }

        }


        function loadfinished(character) {
    
            
            window.addEventListener("keydown", this.onKeyDown.bind(this));
            
            this.addChain(character, {name:"Arm", origin: character.bonesIdxs["LeftArm"], endEffector: character.bonesIdxs["LeftHand"]}, null, new THREE.Vector3(1,1,0));
            this.initGUI();

            if(this.currentModel.name == character.name)
                this.gizmo.begin(character.skeletonHelper)
            this.animate();
            $('#loading').fadeOut(); //hide();
        }

        // this.scene.remove(this.scene.getObjectByName("Character"));
        // this.scene.remove(this.scene.getObjectByName("SkeletonHelper"));
        // let path = './data/models/';
        // path += (this.currentModel == 'LowPoly') ? 'lowPoly/woman.gltf' : 'Eva_Y2.glb';
        for(let i in this.models) {
            this.loaderGLB.load( this.models[i].url, loadModel.bind( this, loadfinished.bind(this),  this.models[i] ) );
        }
        
    }
    changeCurrentModel(name) {

        this.scene.getObjectByName("Character_"+this.currentModel.name).visible = false;
        this.scene.getObjectByName("SkeletonHelper_"+this.currentModel.name).visible = false;
        for(let i in this.models) {
            if(this.models[i].name == name) {
                this.currentModel = this.models[i];
                this.gizmo.begin(this.models[i].skeletonHelper);
                this.scene.getObjectByName("Character_"+name).visible = true;
                this.scene.getObjectByName("SkeletonHelper_"+name).visible = true;
                break;
            }
        }
    }
    /**
    * @description
    * Initialization of CCD solver. Add Left Arm and Left Leg chains [Bone origin, ..., Bone end-effector] to the solver with their corresponding constraints and targetgs.
    */
    initCCDIK(){
        if(this.currentModel == "LowPoly") {

            this.chains = [
                {
                    name: 'leftArm',
                    target: this.skeleton.bones.length - 2, // "target_hand_l"
                    effector: this.bonesIdxs["LeftHand"], // "hand_l"
                    links: [
                        {
                            index: this.bonesIdxs["LeftForeArm"], // "lowerarm_l"
                            limitX: true,
                            limitY: true,
                            limitZ: true,
                            rotationMin: new THREE.Vector3(0,   0,   0 ), //68, 103.13, -22.92
                            rotationMax: new THREE.Vector3(0, 1.1, 1.1 ) // 97, -63, 17
                        },
                        {
                            index: this.bonesIdxs["LeftArm"], // "Upperarm_l"
                            limitX: true,
                            limitY: true,
                            limitZ: true,
                            rotationMin: new THREE.Vector3(-1.8, -0.7,  -2 ), //6, -40, 103.13
                            rotationMax: new THREE.Vector3( 1.4,  0.0, 1.8 ) // 63, 0, -80 
                        },
                    ],
                },
                {
                    name: 'leftLeg',
                    target: this.skeleton.bones.length - 1, // "target_leg_l"
                    effector: this.bonesIdxs["LeftFoot"], // "foot_l"
                    links: [
                        {
                            index: this.bonesIdxs["LeftLeg"], // "leg_l"
                            limitX: true,
                            limitY: true,
                            limitZ: true,
                            rotationMin: new THREE.Vector3(-Math.PI, -0.4, 0 ), //68, 103.13, -22.92
                            rotationMax: new THREE.Vector3(       0,  0.4, 0 ) // 97, -63, 17
                        },
                        {
                            index: this.bonesIdxs["LeftUpLeg"], // "Upperleg_l"
                            limitX: true,
                            limitY: true,
                            limitZ: true,
                            rotationMin: new THREE.Vector3(-1.8, -0.4, -Math.PI  ), //6, -40, 103.13
                            rotationMax: new THREE.Vector3( 1.4,  0.4,  Math.PI ) // 63, 0, -80 
                        },
                    ],
                }
            ];
            
        }
        else {
            this.chains = [
                {
                    name: 'leftArm',
                    target: this.skeleton.bones.length - 2, // "target_hand_l"
                    effector: this.bonesIdxs["LeftHand"], // "hand_l"
                    links: [
                        {
                            index: this.bonesIdxs["LeftForeArm"], // "lowerarm_l"
                            limitX: true,
                            limitY: true,
                            limitZ: true,
                            rotationMin: new THREE.Vector3(0,   0,   0 ), //68, 103.13, -22.92
                            rotationMax: new THREE.Vector3(0, 1.1, 1.1 ) // 97, -63, 17
                        },
                        {
                            index: this.bonesIdxs["LeftArm"], // "Upperarm_l"
                            limitX: true,
                            limitY: true,
                            limitZ: true,
                            rotationMin: new THREE.Vector3(-1.8, -0.7,  -2 ), //6, -40, 103.13
                            rotationMax: new THREE.Vector3( 1.4,  0.0, 1.8 ) // 63, 0, -80 
                        },
                    ],
                },
                {
                    name: 'leftLeg',
                    target: this.skeleton.bones.length - 1, // "target_leg_l"
                    effector: this.bonesIdxs["LeftFoot"], // "foot_l"
                    links: [
                        {
                            index: this.bonesIdxs["LeftLeg"], // "leg_l"
                            limitX: false,
                            limitY: false,
                            limitZ: false,
                            rotationMin: new THREE.Vector3(-Math.PI, -0.4, 0 ), //68, 103.13, -22.92
                            rotationMax: new THREE.Vector3(       0,  0.4, 0 ) // 97, -63, 17
                        },
                        {
                            index: this.bonesIdxs["LeftUpLeg"], // "Upperleg_l"
                            limitX: false,
                            limitY: false,
                            limitZ: false,
                            rotationMin: new THREE.Vector3(-1.8, -0.4, -Math.PI  ), //6, -40, 103.13
                            rotationMax: new THREE.Vector3( 1.4,  0.4,  Math.PI ) // 63, 0, -80 
                        },
                    ],
                }
            ];
        }
        
        this.CCDIKSolver = new CCDIKSolver( this.model, this.chains );
        
    }
    
    /**
     * @description
     * Initialization of FABRIK solver. Add Left Arm and Left Leg chains [Bone origin, ..., Bone end-effector] to the solver with their corresponding constraints and targetgs.
     * @params
    * constraints: Boolean that indicates if the chains have to be constrained
    */
    initFabrik() {
        this.chainsFABRIK = [
            {
                name: "leftArm",
                chain: [10, 9, 8], 
                constraints: [ null,    {type: FABRIKSolver.JOINTTYPES.HINGE, twist:[ 0, Math.PI*0.5 ], axis:[1,0,0], min: Math.PI, max: Math.PI * 1.8 },   {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, twist:[ -Math.PI*0.25, Math.Pi*0.25 ], polar:[0, Math.PI*0.5], azimuth:[0, Math.PI*2-0.0001]}], 
                target: this.IKTargetArm // OBject3D (or equivalents) for now. It must be in the scene
            },
            { 
                name: "leftLeg",
                chain: [33, 32, 31], 
                constraints:  [ null,    {type: FABRIKSolver.JOINTTYPES.HINGE, twist:[ 0, 0.0001 ], axis:[1,0,0], min: Math.PI, max: Math.PI * 1.8 },   {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, twist:[ -Math.PI*0.25, Math.Pi*0.25 ], polar:[0, Math.PI*0.45], azimuth:[0, Math.PI*2-0.0001]}], 
                target:  this.IKTargetLeg // OBject3D (or equivalents) for now. It must be in the scene
            }
        ]
        this.FABRIKSolver = new FABRIKSolver( this.skeleton );
        this.fabrikChains = [ 
            {
                name: "leftLeg",
                bones: [this.bonesIdxs["LeftFoot"], this.bonesIdxs["LeftLeg"], this.bonesIdxs["LeftUpLeg"]], 
                constraints:   [ 
                        null,    
                        {type: FABRIKSolver.JOINTTYPES.HINGE, twist:[ 0, 0.0001 ], axis:[1,0,0], min: Math.PI, max: Math.PI * 1.8 },   
                        {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, twist:[ -Math.PI*0.25, Math.PI*0.25 ], polar:[0, Math.PI*0.45]}
                    ],
                target: this.IKTargetLeg // OBject3D (or equivalents) for now. It must be in the scene
            },
            {
                name: "leftArm",
                bones: [ this.bonesIdxs["LeftHand"], this.bonesIdxs["LeftForeArm"], this.bonesIdxs["LeftArm"]], 
                constraints: [ 
                        null,    
                        {type: FABRIKSolver.JOINTTYPES.HINGE, twist:[ 0, Math.PI*0.5 ], axis:[1,0,0], min: Math.PI, max: Math.PI * 1.8 },   
                        {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, twist:[ -Math.PI*0.25, Math.PI*0.25 ], polar:[0, Math.PI*0.5]}
                    ], 
                target: this.IKTargetArm // OBject3D (or equivalents) for now. It must be in the scene     
            }
        ];

        if(constraints) {

            this.FABRIKSolver.createChain( this.fabrikChains[0].bones, this.fabrikChains[0].constraints, this.fabrikChains[0].target, this.fabrikChains[0].name ); 

            this.FABRIKSolver.createChain( this.fabrikChains[1].bones, this.fabrikChains[1].constraints, this.fabrikChains[1].target, this.fabrikChains[1].name );  


        }
        else {
            this.FABRIKSolver.createChain( 
                [this.bonesIdxs["LeftFoot"], this.bonesIdxs["LeftLeg"], this.bonesIdxs["LeftUpLeg"]], 
                [ null,    null,   null], 
                this.IKTargetLeg // OBject3D (or equivalents) for now. It must be in the scene
            );  
            this.FABRIKSolver.createChain( 
                [ this.bonesIdxs["LeftHand"], this.bonesIdxs["LeftForeArm"], this.bonesIdxs["LeftArm"]], 
                [ null,    null,   null], 
                this.IKTargetArm // OBject3D (or equivalents) for now. It must be in the scene
            );  
        }
    }

    initGUI() {
        this.gui.updateSidePanel();
    }

    addChain(character, chain, callback = null, targetPos = new THREE.Vector3()) {

        if(!chain.origin)  {
            console.error("No bone origin")
            return;
        }
        if(!chain.endEffector)  {
            console.error("No bone end-effector")
            return;
        }

        //Add target to the scene
        let target = null;
        if(this['IKTarget'+chain.name] ){
            target = this['IKTarget'+chain.name] ;
        }else{

            target  = new THREE.Bone();
            target.position.copy(targetPos);
            this.scene.add( target );
            let transfControl = new TransformControls( this.camera, this.renderer.domElement );
            transfControl.addEventListener( 'dragging-changed',  ( event ) => { this.controls.enabled = ! event.value; } );
            transfControl.attach( target );
            transfControl.size = 0.6;
            transfControl.name = "control"+ chain.name;
            this.scene.add( transfControl );
        }
        target.name = 'IKTarget' + chain.name;
      
        character.skeleton.bones.push(target)
        character.skeleton.boneInverses.push(new THREE.Matrix4()) ;
        character.skeleton.computeBoneTexture();
        character.skeleton.update();

        //Create array of chain bones
        let origin = character.skeleton.bones[chain.origin];
        let endEffector = character.skeleton.bones[chain.endEffector];
        let bones = [];
        
        let bone = endEffector;
        let links = [];
        while(bone.name != origin.parent.name){
            let i = character.skeleton.bones.indexOf(bone);
            bones.push(i);
            links.push({index:i, limitX: false, limitY: false, limitZ: false, rotationMin: new THREE.Vector3(-2*Math.PI, -2*Math.PI, -2*Math.PI), rotationMax: new THREE.Vector3(2*Math.PI, 2*Math.PI, 2*Math.PI)});
         
            bone = bone.parent;
            
        }

        let constraints = [];
        constraints.length = bones.length;
        constraints.fill(null);

        // FABRIK CHAIN
        let fabrikChain =  {
            name: chain.name,
            bones: bones, 
            constraints:   constraints,
            target: target // OBject3D (or equivalents) for now. It must be in the scene
        }
        character.FABRIKSolver = new FABRIKSolver( character.skeleton );
        character.fabrikChains.push(fabrikChain);
        character.FABRIKSolver.createChain(fabrikChain.bones, fabrikChain.constraints, fabrikChain.target, fabrikChain.name);

        links.shift(0,1)
        
        //CCDIK CHAIN
        let CCDIKChain =  {
            name: chain.name,
            effector: chain.endEffector,
            target: character.skeleton.bones.length - 1, // OBject3D (or equivalents) for now. It must be in the scene
            links:  links
        }
        //character.CCDIKChain.iks.push(CCDIKChain)
        character.chains.push(CCDIKChain);
        character.CCDIKSolver = null;
        character.CCDIKSolver = new CCDIKSolver( character.model, character.chains );

        
        if(callback)
            callback();
    }

    removeChain(character, chainName, callback = null) {
        for(let i = 0; i < character.chains.length; i++) {
            if(character.chains[i].name == chainName) {
                character.chains.splice(i,1);
                character.fabrikChains.splice(i,1);
                //remove chain from solvers
                character.CCDIKSolver.iks.splice(i,1)
                character.FABRIKSolver.removeChain(chainName);
                //remove bone related to target
                let b = character.skeleton.bones.indexOf(character.skeleton.getBoneByName("IKTarget"+chainName));
                character.skeleton.bones.splice(b,1);
                character.skeleton.boneInverses.splice(b,1) ;
                character.skeleton.computeBoneTexture();
                character.skeleton.update();
                //remove target from the scene
                let t = this.scene.getObjectByName("IKTarget"+chainName);
                this.scene.remove(t);
                let c = this.scene.getObjectByName("control"+chainName);
                c.detach(t);
                this.scene.remove(c);
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
        
        
        if(this.currentModel.CCDIKSolver && this.currentModel.FABRIKSolver) {
            switch(this.solver) {
                case "CCDIK":
                    this.currentModel.CCDIKSolver.update();
                    break;
                    
                case "FABRIK":
                    this.currentModel.FABRIKSolver.update();
                    break;
                    
                case "MIX":
                    this.currentModel.FABRIKSolver.update();
                    
                    this.currentModel.CCDIKSolver.update();
                    break;
            }
        }
                
        this.gizmo.update(true, et);
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

class Character {
    constructor(name, url) {
        this.name = name;
        this.url = url;
        this.model = null;
        this.chains = [];
        this.fabrikChains = [];
        this.skeleton = null;
        this.skeletonHelper = null;
        this.FABRIKSolver = null;
        this.CCDIKSolver = null;
    }
}

let app = new App();
app.init();
window.global = {app:app};
export { app };
