import * as THREE from "three";
import { TransformControls } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/controls/TransformControls.js';

class Gizmo {

    constructor(editor) {

        if(!editor)
        throw("No editor to attach Gizmo!");

        this.raycastEnabled = true;
        this.undoSteps = [];

        let transform = new TransformControls( editor.camera, editor.renderer.domElement );
        window.trans = transform;
        transform.setSpace( 'local' );
        transform.setMode( 'translate' );
        //transform.addEventListener( 'change', e => { console.log(e)});
        transform.setSize(0.2);
        transform.addEventListener( 'objectChange', e => {
            this.updateBones();

            if(this.selectedBone != null) {
                // editor.gui.updateBoneProperties();
            }
        });

        transform.addEventListener( 'mouseUp', e => {
            if(this.selectedBone === undefined)
            return;
           
        } );

        transform.addEventListener( 'dragging-changed', e => {
            const enabled = e.value;
            editor.controls.enabled = !enabled;
            this.raycastEnabled = !this.raycastEnabled;
            
            if(this.selectedBone == null)
            return;

            const bone = this.editor.skeletonHelper.bones[this.selectedBone];

            if(enabled) {
                this.undoSteps.push( {
                    boneId: this.selectedBone,
                    pos: bone.position.toArray(),
                    quat: bone.quaternion.toArray(),
                } );
            }
        });

        let scene = editor.scene;
        scene.add( transform );

        this.camera = editor.camera;
        this.scene = scene;
        this.transform = transform;
		this.raycaster = null;
        this.selectedBone = null;
        this.bonePoints = null;
        this.editor = editor;

        // Update in first iteration
        this.mustUpdate = true; 
    }

    begin(skeletonHelper) {
        
        this.skeletonHelper = skeletonHelper;

        // point cloud for bones
        // const pointsShaderMaterial = new THREE.ShaderMaterial( {
        //     uniforms: {
        //         color: { value: new THREE.Color( 0xffffff ) },
        //         pointTexture: { value: new THREE.TextureLoader().load( 'data/imgs/disc.png' ) },
        //         alphaTest: { value: 0.9 }
        //     },
        //     depthTest: false,
        //     vertexShader: ShaderChunk["Point"].vertexshader,
        //     fragmentShader: ShaderChunk["Point"].fragmentshader
        // });
        const pointsShaderMaterial = new THREE.MeshBasicMaterial({depthTest: false});
        const geometry = new THREE.BufferGeometry();

        let vertices = [];

        for(let bone of skeletonHelper.bones) {
            let tempVec = new THREE.Vector3();
            bone.getWorldPosition(tempVec);
            vertices.push( tempVec );
        }

        this.selectedBone = vertices.length ? 0 : null;

        geometry.setFromPoints(vertices);
        
        const positionAttribute = geometry.getAttribute( 'position' );
        const size = 0.05;
        geometry.setAttribute( 'size', new THREE.Float32BufferAttribute( new Array(positionAttribute.count).fill(size), 0.1 ) );

        this.bonePoints = new THREE.Points( geometry, pointsShaderMaterial );
        this.bonePoints.name = "GizmoPoints";
        this.scene.add( this.bonePoints );
        
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 0.05;
        
        this.bindEvents();
        
        // First update to get bones in place
        this.update(true, 0.0);

        if(this.selectedBone != null) 
            this.updateBoneColors();
    }

    stop() {
        this.transform.detach();
    }

    bindEvents() {

        if(!this.skeletonHelper)
            throw("No skeleton");

        let transform = this.transform;
        

        const canvas = document.getElementById("webgl-canvas");

        canvas.addEventListener( 'mousemove', e => {

            if(!this.bonePoints || this.editor.state)
            return;

            const pointer = new THREE.Vector2(( e.offsetX / canvas.clientWidth ) * 2 - 1, -( e.offsetY / canvas.clientHeight ) * 2 + 1);
            this.raycaster.setFromCamera(pointer, this.camera);
            const intersections = this.raycaster.intersectObject( this.bonePoints );
            canvas.style.cursor = intersections.length ? "crosshair" : "default";
        });

        canvas.addEventListener( 'pointerdown', e => {

            if(e.button != 0 || !this.bonePoints || this.editor.state || (!this.raycastEnabled && !e.ctrlKey) || this.bonePoints.material.depthTest)
            return;

            const pointer = new THREE.Vector2(( e.offsetX / canvas.clientWidth ) * 2 - 1, -( e.offsetY / canvas.clientHeight ) * 2 + 1);
            this.raycaster.setFromCamera(pointer, this.camera);
            const intersections = this.raycaster.intersectObject( this.bonePoints );
            if(!intersections.length)
                return;

            const intersection = intersections.length > 0 ? intersections[ 0 ] : null;

            if(intersection) {
  
                this.selectedBone = intersection.index;
                let boneName = this.skeletonHelper.bones[this.selectedBone].name;

                this.mustUpdate = true;
             
                this.updateBoneColors();
            }
        });

        canvas.addEventListener( 'keydown', e => {

            switch ( e.key ) {

                case 'q':
                    transform.setSpace( transform.space === 'local' ? 'world' : 'local' );
                    // this.editor.gui.updateSidePanel();
                    break;

                case 'Shift':
                    transform.setTranslationSnap( this.editor.defaultTranslationSnapValue );
                    transform.setRotationSnap( THREE.MathUtils.degToRad( this.editor.defaultRotationSnapValue ) );
                    break;

                case 'w':
                    const bone = this.editor.skeletonHelper.bones[this.selectedBone];
                 
                    transform.setMode( 'translate' );
                    // this.editor.gui.updateSidePanel();
                    break;

                case 'e':
                    transform.setMode( 'rotate' );
                    // this.editor.gui.updateSidePanel();
                    break;

                case 'x':
                    transform.showX = ! transform.showX;
                    break;

                case 'y':
                    transform.showY = ! transform.showY;
                    break;

                case 'z':
                    if(e.ctrlKey){

                        if(!this.undoSteps.length)
                        return;
                        
                        const step = this.undoSteps.pop();
                        let bone = this.editor.skeletonHelper.bones[step.boneId];
                        bone.position.fromArray( step.pos );
                        bone.quaternion.fromArray( step.quat );
                        this.updateBones();
                    }
                    else
                        transform.showZ = ! transform.showZ;
                    break;
            }

        });

        window.addEventListener( 'keyup', function ( event ) {

            switch ( event.key ) {

                case 'Shift': // Shift
                    transform.setTranslationSnap( null );
                    transform.setRotationSnap( null );
                    break;
            }
        });
    }

    update(state, dt) {

        if(state) this.updateBones(dt);

        if(this.selectedBone == null || !this.mustUpdate)
        return;

        this.transform.attach( this.skeletonHelper.bones[this.selectedBone] );
        this.mustUpdate = false; 
    }

    updateBones( dt ) {

        if(!this.bonePoints)
            return;

        let vertices = [];

        for(let bone of this.skeletonHelper.bones) {
            let tempVec = new THREE.Vector3();
            bone.getWorldPosition(tempVec);
            vertices.push( tempVec );
        }

        this.bonePoints.geometry.setFromPoints(vertices);
        this.bonePoints.geometry.computeBoundingSphere();
    }

    updateBoneColors() {
        const geometry = this.bonePoints.geometry;
        const positionAttribute = geometry.getAttribute( 'position' );
        const colors = [];
        const color = new THREE.Color(0.9, 0.9, 0.3);
        const colorSelected = new THREE.Color(0.33, 0.8, 0.75);

        for ( let i = 0, l = positionAttribute.count; i < l; i ++ ) {
            (i != this.selectedBone ? color : colorSelected).toArray( colors, i * 3 );
        }

        geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
    }

    setBone( name ) {

        let bone = this.skeletonHelper.skeleton.getBoneByName(name);
        if(!bone) {
            console.warn("No bone with name " + name);
            return;
        }

        const boneId = this.skeletonHelper.bones.findIndex((bone) => bone.name == name);
        if(boneId > -1){
            this.selectedBone = boneId;
            this.updateBoneColors();
        }
    }

    setMode( mode ) {
        this.transform.setMode( mode );
    }

    setSpace( space ) {
        this.transform.setSpace( space );
    }

    showOptions( inspector ) {
        inspector.addNumber( "Translation snap", this.editor.defaultTranslationSnapValue, { min: 0.5, max: 5, step: 0.5, callback: (v) => {
            this.editor.defaultTranslationSnapValue = v;
            this.editor.updateGizmoSnap();
        }});
        inspector.addNumber( "Rotation snap", this.editor.defaultRotationSnapValue, { min: 15, max: 180, step: 15, callback: (v) => {
            this.editor.defaultRotationSnapValue = v;
            this.editor.updateGizmoSnap();
        }});
        inspector.addSlider( "Size", this.editor.getGizmoSize(), { min: 0.2, max: 2, step: 0.1, callback: (v) => {
            this.editor.setGizmoSize(v);
        }});
        inspector.addTitle("Bone markers")
        inspector.addSlider( "Size", this.editor.getGizmoSize(), { min: 0.01, max: 1, step: 0.01, callback: (v) => {
            this.editor.setBoneSize(v);
        }});

        const depthTestEnabled = this.bonePoints.material.depthTest;
        inspector.addCheckbox( "Depth test", depthTestEnabled, (v) => { this.bonePoints.material.depthTest = v; })
    }

    onGUI() {

        this.updateBones();
        this.updateTracks();
    }
    
};

Gizmo.ModeToKeyType = {
    'Translate': 'position',
    'Rotate': 'quaternion',
    'Scale': 'scale'
};

export { Gizmo };
