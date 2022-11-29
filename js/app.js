import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';
//import { CCDIKSolver } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/animation/CCDIKSolver.js';
import { FABRIKSolver, CCDIKSolver } from './IKSolver.js'
import { GUI } from './gui.js'
//import { IKHelper } from './IKHelper.js'
import { IKHelperExtended } from './IKHelperExtended.js'

class App {

    constructor() {

        this.clock = new THREE.Clock();
        this.loaderGLB = new GLTFLoader();
        
        this.scene = null;
        this.renderer = null;
        this.camera = null;
        this.controls = null;

        //Current solver selected 
        this.solvers = ["CCDIK", "FABRIK", "MIX"];
        this.solver = this.solvers[1];
        
        // current model selected
        let eva = new Character("Eva", "./data/models/Eva_Y2.glb");
        this.modelsNames = ["Eva", "LowPoly"];
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

        /*this.ikHelper = new IKHelperHelper();
        this.ikHelper.onSelect = (objectName) => {
            this.gui.setTextInfo(objectName);
        }
        this.ikHelper.onDeselect = () => {
            this.gui.setTextInfo("");
        }*/
        this.renderer.render( this.scene, this.camera );
        
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

        //load models and add them to the scene
        this.initCharacter();

    }

    initCharacter() {     

        //called after load the 3D model
        function loadModel ( callback, character, glb ){
            character.model = glb.scene;
            
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
                character.model.scale.set(0.25,0.25,0.25);
            }

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

            //Add character to the scene and put it visible if it's the current model selected
            character.model.name = "Character_" + character.name;
            character.model.visible = this.currentModel.name == character.name;
            this.scene.add(character.model);
            
            //Add skeleton helper's character to the scene and put it visible if it's the current model selected
            //character.skeletonHelper = new THREE.SkeletonHelper( character.model );
            // character.skeletonHelper.visible = true;
            // character.skeletonHelper.frustumCulled = false;
            // character.skeletonHelper.name = "SkeletonHelper_" + character.name;
            // character.skeletonHelper.visible = this.currentModel.name == character.name;
            // this.scene.add(character.skeletonHelper);
            
            this.addChain(character, {name:"Arm", origin: character.bonesIdxs["LeftArm"], endEffector: character.bonesIdxs["LeftHand"]}, null, new THREE.Vector3(1,1,0));

            if ( callback ){ 
                callback(character); 
            }

        }

        function loadfinished(character) {
          
            window.addEventListener("keydown", this.onKeyDown.bind(this));
            
            this.initGUI();
            this.animate();

            $('#loading').fadeOut(); //hide
        }

        //Load all models
        for(let i = 0; i < this.models.length; i++) {

            let callback = null;
            if(i == this.models.length - 1)
                callback = loadfinished.bind(this);
                
            this.loaderGLB.load( this.models[i].url, loadModel.bind( this, callback,  this.models[i] ) );
        }
        
    }

    changeCurrentModel(name) {

        this.currentModel.setVisibility(false, this.updateAttachedControls.bind(this));
   
        for(let i in this.models) {
            if(this.models[i].name == name) {
                this.currentModel = this.models[i];
                this.currentModel.setVisibility(true, this.updateAttachedControls.bind(this));
                
                break;
            }
        }
    }
    
    
    updateAttachedControls(v) {
        // CHANGE VISIBILITY OF CHAIN TARGETS ATTACHED CONTROLS
        for(let i in this.currentModel.chains) {
            this.scene.getObjectByName("control"+i).visible = v;
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
        let target = this.scene.getObjectByName('IKTarget' + chain.name);
        if(chain.target){
            target = this.scene.getObjectByName(chain.target);
        }
        if(!target){

            if(this['IKTarget'+chain.name] ){
                target = this['IKTarget'+chain.name] ;
            }
            else{

                target  = new THREE.Bone();
                target.position.copy(targetPos);
                this.scene.add( target );
                let transfControl = new TransformControls( this.camera, this.renderer.domElement );
                transfControl.addEventListener( 'dragging-changed',  ( event ) => { this.controls.enabled = ! event.value; } );
                transfControl.addEventListener( 'mouseDown',  ( event ) => { 
                    this.setSelectedChain(event.target.name.replace("control",""));
                 } );
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
        }
        target.visible = true;
        //Create array of chain bones
        let origin = character.skeleton.bones[chain.origin];
        let endEffector = character.skeleton.bones[chain.endEffector];
        let bones = [];
        
        let bone = endEffector;
        while(bone.name != origin.parent.name){
            let i = character.skeleton.bones.indexOf(bone);
            bones.push(i);
            bone = bone.parent;
        }

        // create constraints
        let constraints = [];
        constraints.length = bones.length;
        constraints.fill(null);

        let ikChain =  {
            name: chain.name,
            bones: bones, 
            constraints: constraints,
            target: target 
        }
        character.chains[ikChain.name] = ikChain;
        
        if ( !character.FABRIKSolver ){ character.FABRIKSolver = new FABRIKSolver( character.skeleton ); }
        character.FABRIKSolver.createChain(ikChain.bones, ikChain.constraints, ikChain.target, ikChain.name);

        if ( !character.CCDIKSolver ){ character.CCDIKSolver = new CCDIKSolver( character.skeleton ); }
        character.CCDIKSolver.createChain(ikChain.bones, ikChain.constraints, ikChain.target, ikChain.name);
        
        if ( !character.ikHelper ){ 
            character.ikHelper = new IKHelperExtended(); 
            character.ikHelper.begin( character.FABRIKSolver, this.scene, this.camera );
            character.ikHelper.onSelect = (objectName) => {
                this.gui.setTextInfo(objectName);
            }
            character.ikHelper.onDeselect = () => {
                this.gui.setTextInfo("");
            }
            character.ikHelper.setVisibility(this.currentModel.name == character.name);
        }

        this.setSelectedChain(chain.name, character);
        

        if(callback)
            callback();
    }

    addConstraint(chainName, boneIdxChain, constraint ) {
        let character = this.currentModel;
        character.FABRIKSolver.setConstraintToBone( chainName, boneIdxChain, constraint );
        constraint = character.CCDIKSolver.setConstraintToBone( chainName, boneIdxChain, constraint );
        let bone = character.chains[chainName].bones[boneIdxChain];
        if(constraint) {
            //this.ikHelper.addConstraintToChain(constraint, bone, chainName);
        }
    }

    updateConstraint(chainName, boneIdxChain, constraint ) {
        let character = this.currentModel;
        character.FABRIKSolver.setConstraintToBone( chainName, boneIdxChain, constraint );
        constraint = character.CCDIKSolver.setConstraintToBone( chainName, boneIdxChain, constraint );
        let bone = character.chains[chainName].bones[boneIdxChain];
        if (constraint == null) {
            //this.ikHelper.removeHelper(bone, chainName);
        }
    }

    removeChain(chainName, callback = null) {
        let character = this.currentModel;
        
        if(!character.chains[chainName]) 
            return;

        //remove chain from solvers
        character.CCDIKSolver.removeChain(chainName);
        character.FABRIKSolver.removeChain(chainName);
        for(let c in character.chains) {
            if(character.chains[c].target.name == character.chains[chainName].target.name && c != chainName) {
                //remove helper
                //this.ikHelper.removeChainHelpers(chainName);
                delete character.chains[chainName];
                let keys = Object.keys(character.chains);
                if(keys.length)
                    this.setSelectedChain(keys[0], character);
                if(callback)
                    callback();
                return;
            }
        }
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

        //remove helper
        //this.ikHelper.removeChainHelpers(chainName);
        delete character.chains[chainName];
        let keys = Object.keys(character.chains);
        if(keys.length)
            this.setSelectedChain(keys[0], character);

        if(callback)
            callback();

    }

    setSelectedChain(name, character = this.currentModel) {
        character.selectedChain = name;
        character.ikHelper.updateHelpers = true;
        this.gui.updateSidePanel();
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
                
        this.currentModel.ikHelper.update(true, et);
        this.renderer.render( this.scene, this.camera );
    }
    
    onKeyDown ( e ){
        let it = this.currentModel.FABRIKSolver.iterations;

        switch( e.key ){
            case 'a': 
            this.currentModel.FABRIKSolver.constraintsEnabler = !this.currentModel.FABRIKSolver.constraintsEnabler; 
            this.currentModel.CCDIKSolver.constraintsEnabler = !this.currentModel.CCDIKSolver.constraintsEnabler; 
            break; 
            case '1': it = 1; break;
            case '2': it = 2; break;
            case '3': it = 3; break;
            case '4': it = 4; break;
            case '5': it = 5; break;
            case '6': it = 6; break;
            case '7': it = 10; break;
            case '8': it = 20; break;
            case '9': it = 30; break;
        }

        this.currentModel.FABRIKSolver.setIterations( it );
        this.currentModel.CCDIKSolver.setIterations( it );
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
        this.chains = {};
        this.selectedChain = null;
        this.skeleton = null;
        //this.skeletonHelper = null;
        this.FABRIKSolver = null;
        this.CCDIKSolver = null;
        this.ikHelper = null;
    }

    setVisibility( v, callback = null ) {
        //this.skeletonHelper.visible = v;
        this.model.visible = v;

        if( this.ikHelper ) { this.ikHelper.setVisibility(v); }
        for(let i in this.chains) {
            this.chains[i].target.visible = v;
        }

        if(callback)
            callback(v);
    }
}

let app = new App();
app.init();
window.global = {app:app};
export { app };
