import * as THREE from "three";

class IKHelper {

    constructor(editor) {

        if(!editor)
        throw("No editor to attach Helper!");

        this.raycastEnabled = true;

        let scene = editor.scene;

        this.camera = editor.camera;
        this.scene = scene;
		this.raycaster = null;
        this.selectedBone = null;
        this.selectedChain = null;
        this.bonePoints = null;

        // Update in first iteration
        this.mustUpdate = true; 

        this.visible = true;
        // constraint helpers
        this.omniConstraint = null;
        this.initConstraintHelpers();
        
    }

    initConstraintHelpers() {

        const material = new THREE.MeshBasicMaterial({
            depthTest: false,
            side: THREE.DoubleSide,
            fog: false,
            toneMapped: false,
            transparent: true
        });
        material.color.set(0x8ea05f);
        material.opacity = 0.8;

        // BALL-SOCKET
        const sphere = new THREE.SphereGeometry( 10, 16, 16);
        this.ballConstraint = new THREE.Mesh( sphere, material );
        this.ballConstraint.visible = false;

        // HINGE
        const circle = new THREE.CircleGeometry( 10, 15);
        this.hingeConstraint = new THREE.Mesh( circle, material );
        this.hingeConstraint.visible = false;
    }

    begin(character) {
        this.character = character;
        if(!character.skeletonHelper)
            throw("No skeletonHelper found.");
        this.skeletonHelper = character.skeletonHelper;

        // point cloud for bones
        const pointsShaderMaterial = new THREE.ShaderMaterial( {
            uniforms: {
                color: { value: new THREE.Color( 0xfffff ) },
                pointTexture: { value: new THREE.TextureLoader().load( 'data/imgs/disc.png' ) },
                alphaTest: { value: 0.9 }
            },
            depthTest: false,
            vertexShader: ShaderChunk["Point"].vertexshader,
            fragmentShader: ShaderChunk["Point"].fragmentshader
        });

        
        let vertices = [];
        
        for(let bone of this.skeletonHelper.bones) {
            let tempVec = new THREE.Vector3();
            bone.getWorldPosition(tempVec);
            vertices.push( tempVec );
        }
        
        this.selectedBone = vertices.length ? 0 : null;
        
        const geometry = new THREE.BufferGeometry();
        geometry.setFromPoints(vertices);
        
        const positionAttribute = geometry.getAttribute( 'position' );
        const size = 0.1;
        geometry.setAttribute( 'size', new THREE.Float32BufferAttribute( new Array(positionAttribute.count).fill(size), 1 ) );

        this.bonePoints = new THREE.Points( geometry, pointsShaderMaterial );
        this.bonePoints.name = "GizmoPoints";
        this.bonePoints.renderOrder = 1;
        this.scene.remove(this.scene.getObjectByName("GizmoPoints"));
        this.scene.add( this.bonePoints );
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 0.05;
        
        this.bindEvents();
        
        // First update to get bones in place
        this.update(true, 0.0);

        if(this.selectedBone != null) 
            this.updateBoneColors();
    }


    bindEvents() {

        if(!this.skeletonHelper)
            throw("No skeleton");

        const canvas = document.getElementById("webgl-canvas");

        canvas.addEventListener( 'mousemove', e => {

            if(!this.bonePoints)
            return;

            const pointer = new THREE.Vector2(( e.offsetX / canvas.clientWidth ) * 2 - 1, -( e.offsetY / canvas.clientHeight ) * 2 + 1);
            this.raycaster.setFromCamera(pointer, this.camera);
            const intersections = this.raycaster.intersectObject( this.bonePoints );
            canvas.style.cursor = intersections.length ? "crosshair" : "default";
        });

        canvas.addEventListener( 'pointerdown', e => {

            if(e.button != 0 || !this.bonePoints || (!this.raycastEnabled && !e.ctrlKey) || this.bonePoints.material.depthTest)
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
                this.onBoneSelected();
            }
        });
    }

    update(state, dt) {

        if(state) this.updateBones(dt);

        if(!this.visible || this.selectedBone == null || !this.mustUpdate)
            return;

            
        let chain = this.character.FABRIKSolver.getChain(this.selectedChain);
        if(!chain)
            return;

        let idx = chain.chain.indexOf(this.selectedBone);
        let constraint = chain.constraints[idx];
        if(!constraint)
            return;
            
        let mat = new THREE.Matrix3();
        mat.fromArray([...constraint._swingUp, ...constraint._swingFront, ...constraint._swingRight]);
        
        if(this.hingeConstraint.visible) {

            this.hingeConstraint.setRotationFromAxisAngle(new THREE.Vector3(1,0,0), -Math.PI*0.5);

            this.hingeConstraint.applyMatrix4(new THREE.Matrix4().setFromMatrix3(mat));
            this.hingeConstraint.position.copy(this.skeletonHelper.bones[this.selectedBone].position);

        }
        if(this.ballConstraint.visible) {

            this.ballConstraint.setRotationFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI*0.5);

            this.ballConstraint.applyMatrix4(new THREE.Matrix4().setFromMatrix3(mat));
            this.ballConstraint.position.copy(this.skeletonHelper.bones[this.selectedBone].position);
        }
        // this.mustUpdate = false; 
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

    onBoneSelected() {
        this.updateBoneColors();
        this.hingeConstraint.visible = false;
        this.ballConstraint.visible = false;

        for(let i = 0; i < this.character.FABRIKSolver.chains.length; i++) {
            let boneIdx = this.character.FABRIKSolver.chains[i].chain.indexOf(this.selectedBone);
            if(boneIdx < 0)
                continue;
            
            let constraint = this.character.FABRIKSolver.chains[i].constraints[boneIdx];
            if(!constraint)
                continue;
           
            if(constraint._type == this.character.FABRIKSolver.constructor.JOINTTYPES.HINGE)
                this.updateHingeHelper(constraint);
            else if(constraint._type == this.character.FABRIKSolver.constructor.JOINTTYPES.BALLSOCKET)
                this.updateBallHelper(constraint);
        }
    }
    
    updateHingeHelper(constraint) {
        let mat = new THREE.Matrix3();
        mat.fromArray([...constraint._swingUp, ...constraint._swingFront, ...constraint._swingRight]);

        let min = constraint._limits[0];
        let max = constraint._limits[1];
        if(min > max) {
            min -= 2*Math.PI;
        }
        max = Math.abs(max - min);
        
        this.hingeConstraint.visible = true;
        this.hingeConstraint.geometry = new THREE.CircleGeometry( 10, 15, min - Math.PI*0.5, max);
        this.hingeConstraint.setRotationFromAxisAngle(new THREE.Vector3(1,0,0), -Math.PI*0.5);
        this.hingeConstraint.applyMatrix4(new THREE.Matrix4().setFromMatrix3(mat));
        this.hingeConstraint.position.copy(this.skeletonHelper.bones[this.selectedBone].position);
        
        this.scene.remove(this.hingeConstraint);
        this.skeletonHelper.bones[this.selectedBone].parent.add( this.hingeConstraint );
    }

    updateBallHelper(constraint) {
        let mat = new THREE.Matrix3();
        mat.fromArray([...constraint._swingUp, ...constraint._swingFront, ...constraint._swingRight]);

        let polMin = constraint._polar[0];
        let polMax = constraint._polar[1];

        let aziMin = constraint._azimuth[0];
        let aziMax = constraint._azimuth[1];

        if(polMin > polMax) { //vertical -- theta
            polMin -= 2*Math.PI;
        }
        polMax = Math.abs(polMax - polMin);

        if(aziMin > aziMax) { //XY horizontal -- phi
            aziMin -= 2*Math.PI;
        }
        aziMax = Math.abs(aziMax - aziMin);
        
        this.ballConstraint.visible = true;
        this.ballConstraint.geometry = new THREE.SphereGeometry( 10, 15, 15, aziMin, aziMax, polMin , polMax);

        this.ballConstraint.setRotationFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI*0.5);
        this.ballConstraint.applyMatrix4(new THREE.Matrix4().setFromMatrix3(mat));
        this.ballConstraint.position.copy(this.skeletonHelper.bones[this.selectedBone].position);
        
        this.scene.remove(this.ballConstraint);
        this.skeletonHelper.bones[this.selectedBone].parent.add( this.ballConstraint );
        this.scene.remove(this.ballConstraint);
        this.skeletonHelper.bones[this.selectedBone].parent.add( this.ballConstraint );
    }

    /**update bone colors depending on the selected bone */
    updateBoneColors() {
        const geometry = this.bonePoints.geometry;
        const positionAttribute = geometry.getAttribute( 'position' );
        const colors = [];
        const color = new THREE.Color(0.23, 0.7, 0.65);
        const colorSelected = new THREE.Color(0.50, 1, 0.95);

        for ( let i = 0, l = positionAttribute.count; i < l; i ++ ) {
            (i != this.selectedBone ? color : colorSelected).toArray( colors, i * 3 );
        }

        geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
    }

    /** set selected bone by name */
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

    onGUI() {

        this.updateBones();
        this.updateTracks();
    }

    /** change visibility of the helper */
    setVisibility(v) {
        this.visible = v;
        this.skeletonHelper.visible = v;
        this.bonePoints.visible = v;
        this.ballConstraint.visible = v;
        this.hingeConstraint.visible = v;
    }
    
};

const ShaderChunk = {

	Point: {
		vertexshader: `
			attribute float size;
			attribute vec3 color;
			varying vec3 vColor;
			void main() {
				vColor = color;
				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
				gl_PointSize = size * ( 300.0 / -mvPosition.z );
				gl_Position = projectionMatrix * mvPosition;
			}
		`,

		fragmentshader: `
			uniform vec3 color;
			uniform sampler2D pointTexture;
			uniform float alphaTest;
			varying vec3 vColor;
			void main() {
				gl_FragColor = vec4(vColor, 1.0 );
				gl_FragColor = gl_FragColor * texture2D( pointTexture, gl_PointCoord );
				if ( gl_FragColor.a < alphaTest ) discard;
			}
		`
	}

};

export { IKHelper };
