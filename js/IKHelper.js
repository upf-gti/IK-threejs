import * as THREE from "three";

class IKHelper {

    constructor(editor) {

        if(!editor)
        throw("No editor to attach Helper!");

        this.raycastEnabled = true;

        this.editor = editor;
        this.camera = editor.camera;
        this.scene = editor.scene;
		this.raycaster = null;
        this.selectedBone = null;
        this.selectedChain = null;
        this.bonePoints = null;

        this.constraintHelpers = [];

        this.visible = true;       
        
        this.onSelect = null;
        this.onDeselect = null;
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
        
        this.initConstraintHelpers();

        this.bindEvents();
        
        // First update to get bones in place
        this.update(true, 0.0);

        if(this.selectedBone != null) 
            this.updateBoneColors();
    }

    initConstraintHelpers() {

        for( let chain in this.constraintHelpers) {
            for(let constraint in this.constraintHelpers[chain]) {
                this.scene.remove(this.constraintHelpers[chain][constraint]);
                delete this.constraintHelpers[chain][constraint];
            }
            delete this.constraintHelpers[chain];
        }
        this.constraintHelpers = {};

        let chains = this.character.chains;
        for(let i in chains) {
            let chain = chains[i];
            this.constraintHelpers[chain.name] = {};
            for(let j = 0; j < chain.constraints.length; j++) {
                let constraint = chain.constraints[j];
                if(!constraint)
                    continue;
            
                if(constraint._type == this.character.FABRIKSolver.constructor.JOINTTYPES.HINGE) {
                    this.addHingeHelper(constraint, chain.bones[j], chain.name);
                }
                else if(constraint._type == this.character.FABRIKSolver.constructor.JOINTTYPES.BALLSOCKET) {
                    this.addBallsocketHelper(constraint, chain.bones[j], chain.name);
                }
                else
                    this.addOmniHelper(constraint, chain.bones[j], chain.name);
            }
        }
    }

    addOmniHelper(constraint, bone, chainName) {

        const material = new THREE.MeshBasicMaterial({
            depthTest: false,
            side: THREE.DoubleSide,
            fog: false,
            toneMapped: false,
            transparent: true
        });
        material.color.set(0x8ea05f);
        material.opacity = 0.8;

        let mat = new THREE.Matrix3();
        mat.fromArray([...constraint._swingUp, ...constraint._swingFront, ...constraint._swingRight]);

        
        const sphere = new THREE.SphereGeometry( 10, 16, 16);
        let helper = new THREE.Mesh( sphere, material );
        helper.visible = false;

        helper.setRotationFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI*0.5);
        helper.applyMatrix4(new THREE.Matrix4().setFromMatrix3(mat));
        helper.position.copy(this.skeletonHelper.bones[bone].position);
        helper.bone = bone;

        this.skeletonHelper.bones[bone].parent.add( helper );
        if(!this.constraintHelpers[chainName])
            this.constraintHelpers[chainName] = {};
        this.constraintHelpers[chainName][bone] = helper;
    }

    addBallsocketHelper(constraint, bone, chainName) {

        const material = new THREE.MeshBasicMaterial({
            depthTest: false,
            side: THREE.DoubleSide,
            fog: false,
            toneMapped: false,
            transparent: true
        });
        material.color.set(0xD433FF);
        material.opacity = 0.8;

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
    
        const sphere = new THREE.SphereGeometry( 10, 16, 16);
        let helper = new THREE.Mesh( sphere, material );
        helper.visible = false;

        helper.setRotationFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI*0.5);
        helper.applyMatrix4(new THREE.Matrix4().setFromMatrix3(mat));
        helper.position.copy(this.skeletonHelper.bones[bone].position);
        helper.bone = bone;

        this.skeletonHelper.bones[bone].parent.add( helper );
        if(!this.constraintHelpers[chainName])
        this.constraintHelpers[chainName] = {};
        this.constraintHelpers[chainName][bone] = helper;
    }

    addHingeHelper(constraint, bone, chainName) {

        const material = new THREE.MeshBasicMaterial({
            depthTest: false,
            side: THREE.DoubleSide,
            fog: false,
            toneMapped: false,
            transparent: true
        });
        material.color.set(0x90FF33);
        material.opacity = 0.8;

        let mat = new THREE.Matrix3();
        mat.fromArray([...constraint._swingUp, ...constraint._swingFront, ...constraint._swingRight]);

        let min = constraint._limits[0];
        let max = constraint._limits[1];
        if(min > max) {
            min -= 2*Math.PI;
        }
        max = Math.abs(max - min);
        
        let circle = new THREE.CircleGeometry( 10, 15, min - Math.PI*0.5, max);

        let helper = new THREE.Mesh( circle, material );
        helper.visible = true;
        helper.setRotationFromAxisAngle(new THREE.Vector3(1,0,0), -Math.PI*0.5);
        helper.applyMatrix4(new THREE.Matrix4().setFromMatrix3(mat));
        helper.position.copy(this.skeletonHelper.bones[bone].position);
        helper.bone = bone;

        this.skeletonHelper.bones[bone].parent.add( helper );
        if(!this.constraintHelpers[chainName])
            this.constraintHelpers[chainName] = {};
        this.constraintHelpers[chainName][bone] = helper;
    }

    removeHelper(idx, chainName) {
        this.constraintHelpers[chainName][idx].removeFromParent();
        this.scene.remove(this.constraintHelpers[chainName][idx]);
        delete this.constraintHelpers[chainName][idx];
    }

    removeChainHelpers(chainName) {
        for(let idx in this.constraintHelpers[chainName]) {
            this.removeHelper(idx, chainName);
        }
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
                let boneName = this.skeletonHelper.bones[this.selectedBone].name;
                this.updateBoneColors();

                if(this.onSelect)
                    this.onSelect(boneName);
            }
            
        });
    }

    update(state, dt) {

        if(state) this.updateBones(dt);

        if(!this.visible || !this.character.selectedChain)
            return;

        let chainName = this.character.selectedChain;
        let chain = this.character.FABRIKSolver.getChain(chainName);
        if(!chain)
            return;

        if(this.constraintHelpers[chainName]) {
            for(let h in this.constraintHelpers[chainName]) {
                let helper = this.constraintHelpers[chainName][h];
                let boneIdx = chain.chain.indexOf(helper.bone);
                let constraint = chain.constraints[boneIdx];
                let mat = new THREE.Matrix3();
                mat.fromArray([...constraint._swingUp, ...constraint._swingFront, ...constraint._swingRight]);

                if(constraint._type == this.character.FABRIKSolver.constructor.JOINTTYPES.HINGE) {
                    let min = constraint._limits[0];
                    let max = constraint._limits[1];
                    if(min > max) {
                        min -= 2*Math.PI;
                    }
                    max = Math.abs(max - min);
                    
                    helper.geometry = new THREE.CircleGeometry( 10, 15, min - Math.PI*0.5, max)
                    helper.setRotationFromAxisAngle(new THREE.Vector3(1,0,0), -Math.PI*0.5);
                }
                else if(constraint._type == this.character.FABRIKSolver.constructor.JOINTTYPES.BALLSOCKET) { 
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
                    
                    helper.geometry = new THREE.SphereGeometry( 10, 15, 15, aziMin, aziMax, polMin , polMax);
                    helper.setRotationFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI*0.5);
                }
                helper.applyMatrix4(new THREE.Matrix4().setFromMatrix3(mat));
                helper.position.copy(this.skeletonHelper.bones[helper.bone].position);
                helper.visible = true;
            }
        }
        if(!this.updateHelpers)
            return;
        this.updateHelpers = false;
        for(let c in this.constraintHelpers) {
            if(c == chainName)
                continue;
            for(let h in this.constraintHelpers[c]) {
                this.constraintHelpers[c][h].visible = false;
            }

        }
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

    addConstraintToChain(constraint, bone, chainName) {
    
        if(constraint._type == this.character.FABRIKSolver.constructor.JOINTTYPES.HINGE) {
            this.addHingeHelper(constraint, bone, chainName)
        }
        else if(constraint._type == this.character.FABRIKSolver.constructor.JOINTTYPES.BALLSOCKET) {
            this.addBallsocketHelper(constraint, bone, chainName)
        }
        else {
            this.addOmniHelper(constraint, bone, chainName)
        }
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

    /** change visibility of the helper */
    setVisibility(v) {
        this.visible = v;
        this.skeletonHelper.visible = v;
        this.bonePoints.visible = v;
        for( let c in this.constraintHelpers) {
            let chain = this.constraintHelpers[c];
            for(let h in chain) {
                chain[h].visible = v;
            }
        }
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
