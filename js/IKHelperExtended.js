import {IKHelper} from "./IKHelper.js";
import * as THREE from "three";

class IKHelperExtended extends IKHelper {

    constructor() {
        super( )
        this.raycastEnabled = true;

        this.camera = null;
		this.raycaster = null;
        this.selectedBone = null;
        this.selectedChain = null;

        this.onSelect = null;
        this.onDeselect = null;
    }

    begin(ikSolver, scene, camera) {
        super.begin(ikSolver, scene);

        this.camera = camera;

        this.selectedBone = this.skeleton.bones.length ? 0 : null;
        
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 0.05;
        
        this.bindEvents();

        if(this.selectedBone != null) 
            this.updateBoneColors();
    }


    bindEvents() {

        if(!this.skeleton)
            throw("No skeleton");

        const canvas = document.getElementById("webgl-canvas");

        canvas.addEventListener( 'mousemove', e => {

            if(!this.bonePoints || !this.visible)
            return;



            const pointer = new THREE.Vector2(( e.offsetX / canvas.clientWidth ) * 2 - 1, -( e.offsetY / canvas.clientHeight ) * 2 + 1);
            this.raycaster.setFromCamera(pointer, this.camera);
            const intersections = this.raycaster.intersectObject( this.bonePoints );
            canvas.style.cursor = intersections.length ? "crosshair" : "default";
        });

        canvas.addEventListener( 'pointerdown', e => {

            if(!this.visible || e.button != 0 || !this.bonePoints || (!this.raycastEnabled && !e.ctrlKey) || this.bonePoints.material.depthTest)
            return;

            const pointer = new THREE.Vector2(( e.offsetX / canvas.clientWidth ) * 2 - 1, -( e.offsetY / canvas.clientHeight ) * 2 + 1);
            this.raycaster.setFromCamera(pointer, this.camera);
            const intersections = this.raycaster.intersectObject( this.bonePoints );
            if(!intersections.length) {
                this.selectedBone = null;
                this.updateBoneColors();
                if(this.onDeselect)
                    this.onDeselect();
                return;
            }

            const intersection = intersections.length > 0 ? intersections[ 0 ] : null;

            if(intersection) {
  
                this.selectedBone = intersection.index;
                let boneName = this.skeleton.bones[this.selectedBone].name;
                this.updateBoneColors();

                if(this.onSelect)
                    this.onSelect(boneName);
            }
            
        });
    }

   
    /**update bone colors depending on the selected bone */
    updateBoneColors() {
        const geometry = this.bonePoints.geometry;
        const positionAttribute = geometry.getAttribute( 'position' );
        const colors = [];
        const color = new THREE.Color(1.0, 1.0, 1.0);
        const colorSelected = new THREE.Color(0.9, 0.5, 0.85);

        for ( let i = 0, l = positionAttribute.count; i < l; i ++ ) {
            (i != this.selectedBone ? color : colorSelected).toArray( colors, i * 3 );
        }

        geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
    }

    /** set selected bone by name */
    setBone( name ) {

        let bone = this.skeleton.getBoneByName(name);
        if(!bone) {
            console.warn("No bone with name " + name);
            return;
        }

        const boneId = this.skeleton.bones.findIndex((bone) => bone.name == name);
        if(boneId > -1){
            this.selectedBone = boneId;
            this.updateBoneColors();
        }
    }

};

IKHelperExtended.VISIBILITYFLAGS = IKHelper.VISIBILITYFLAGS;

export { IKHelperExtended };
