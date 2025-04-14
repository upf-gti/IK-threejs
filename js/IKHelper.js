import * as THREE from "three";

class IKHelper {

    constructor() {

        this.scene = null;
        this.bonePoints = null;

        this.ikSolver = null;
        this.constraintHelpers = [];

        this.skeleton = null;
        this.skeletonHelper = null;

        this.visible = IKHelper.VISIBILITYFLAGS.ALL;       
        this.visibleFlags = IKHelper.VISIBILITYFLAGS.ALL;
        this.visualisationScale = 10;

    }

    begin(ikSolver, scene) {
        this.dispose();

        this.scene = scene;
        this.ikSolver = ikSolver;
        ikSolver.addEventListener( "onSetConstraint", (e) => {
            this._removeHelper( e.c.chain[e.i], e.c.name);
            if( e.c.constraints[e.i] ){
                this._addConstraintToChain( e.c.constraints[e.i], e.c.chain[e.i], e.c.name );
            }
        });

        ikSolver.addEventListener( "onCreateChain", (e) => { 
            if ( !this.constraintHelpers[e.name] ) {
                this.constraintHelpers[e.name] = {};
            }
        });

        ikSolver.addEventListener( "onDestroyChain", (e) =>{
            this._removeChainHelpers(e.name);
        } );

        this.skeleton = ikSolver.skeleton;
        this.skeletonHelper = new THREE.SkeletonHelper( this.skeleton.bones[0] );
        this.skeletonHelper.visible = !!(this.visible & this.visibleFlags & IKHelper.VISIBILITYFLAGS.SKELETON);;
        this.skeletonHelper.frustumCulled = false;
        this.scene.add(this.skeletonHelper);
        
        //Change skeleton helper lines colors
        let colorArray = this.skeletonHelper.geometry.attributes.color.array;
        for(let i = 0; i < colorArray.length; i+=6) { 
            colorArray[i+3] = 0/250;//58/256; 
            colorArray[i+4] = 94/256;//161/256; 
            colorArray[i+5] = 166/256;//156/256;
        }
        this.skeletonHelper.geometry.attributes.color.array = colorArray;
        this.skeletonHelper.material.linewidth = 4;
        
        // point cloud for bones
        const pointsShaderMaterial = new THREE.ShaderMaterial( {
            uniforms: {
                color: { value: new THREE.Color( "#0291ff" ) },
                pointTexture: { value: new THREE.TextureLoader().load( 'data/imgs/disc.png' ) },
                alphaTest: { value: 0.9 }
            },
            depthTest: false,
            vertexShader: ShaderChunk["Point"].vertexshader,
            fragmentShader: ShaderChunk["Point"].fragmentshader
        });

        
        let vertices = [];
        
        for(let bone of this.skeleton.bones) {
            let tempVec = new THREE.Vector3();
            bone.getWorldPosition(tempVec);
            vertices.push( tempVec );
        }
                
        const geometry = new THREE.BufferGeometry();
        geometry.setFromPoints(vertices);
        
        const positionAttribute = geometry.getAttribute( 'position' );
        const size = 0.1;
        geometry.setAttribute( 'size', new THREE.Float32BufferAttribute( new Array(positionAttribute.count).fill(size), 1 ) );

        this.bonePoints = new THREE.Points( geometry, pointsShaderMaterial );
        this.bonePoints.renderOrder = 1;
        this.bonePoints.visible = !!(this.visible & this.visibleFlags & IKHelper.VISIBILITYFLAGS.BONEPOINTS);
        this.scene.add( this.bonePoints );
      

        this._initConstraintHelpers();

        // First update to get bones in place
        this.update();

    }

    dispose(){
        if( this.skeletonHelper ){ 
            if ( this.skeletonHelper.dispose ){
                this.skeletonHelper.dispose();
            }
            this.scene.remove(this.skeletonHelper);
        }
        if ( this.bonePoints ){
            this.bonePoints.geometry.dispose();
            this.bonePoints.material.dispose();
            this.scene.remove( this.bonePoints );
        }
        if ( this.constraintHelpers ){
            for( let chain in this.constraintHelpers) {
                this._removeChainHelpers( chain );
            }
        }
        this.constraintHelpers = {};
        
    }


    _initConstraintHelpers() {

        for( let chain in this.constraintHelpers) {
            this._removeChainHelpers( chain );
        }
        this.constraintHelpers = {};

        let chains = this.ikSolver.chains;
        for(let i in chains) {
            let chain = chains[i];
            this.constraintHelpers[chain.name] = {};
            for(let j = 0; j < chain.constraints.length; j++) {
                let constraint = chain.constraints[j];
                if(!constraint)
                    continue;
            
                if(constraint._type == this.ikSolver.constructor.JOINTTYPES.HINGE) {
                    this._addHingeHelper(constraint, chain.chain[j], chain.name);
                }
                else if(constraint._type == this.ikSolver.constructor.JOINTTYPES.BALLSOCKET) {
                    this._addBallsocketHelper(constraint, chain.chain[j], chain.name);
                }
                else
                    this._addOmniHelper(constraint, chain.chain[j], chain.name);
            }
        }
    }

    _addConstraintToChain(constraint, bone, chainName) {
        if(constraint._type == this.ikSolver.constructor.JOINTTYPES.HINGE) {
            this._addHingeHelper(constraint, bone, chainName)
        }
        else if(constraint._type == this.ikSolver.constructor.JOINTTYPES.BALLSOCKET) {
            this._addBallsocketHelper(constraint, bone, chainName)
        }
        else {
            this._addOmniHelper(constraint, bone, chainName)
        }
    }

    _addOmniHelper(constraint, bone, chainName) {

        const material = new THREE.MeshBasicMaterial({
            depthTest: false,
            side: THREE.DoubleSide,
            fog: false,
            toneMapped: false,
            transparent: true
        });
        material.color.set(0x8ea05f);
        material.opacity = 0.7;
       
        const sphere = new THREE.SphereGeometry( 1, 16, 16);
        let helper = new THREE.Mesh( sphere, material );
        helper.visible = !!(this.visible & this.visibleFlags & IKHelper.VISIBILITYFLAGS.CONSTRAINTS);
        helper.scale.set(this.visualisationScale,this.visualisationScale,this.visualisationScale);
        helper.position.copy(this.skeleton.bones[bone].position);
        helper.bone = bone;

        this.skeleton.bones[bone].parent.add( helper );
        if(!this.constraintHelpers[chainName])
            this.constraintHelpers[chainName] = {};
        this.constraintHelpers[chainName][bone] = helper;
    }

    _addBallsocketHelper(constraint, bone, chainName) {

        const material = new THREE.MeshBasicMaterial({
            depthTest: false,
            side: THREE.DoubleSide,
            fog: false,
            toneMapped: false,
            transparent: true
        });
        material.color.set(0xD433FF);
        material.opacity = 0.7;

        let mat = new THREE.Matrix3();
        mat.fromArray([...constraint._swingUp, ...constraint._swingFront, ...constraint._swingRight]);

        
        let polMin = 0;
        let polMax = Math.PI;
        
        if ( constraint._polar ){
            polMin = constraint._polar[0];
            polMax = constraint._polar[1];
        }

        let aziMin = 0;
        let aziMax = Math.PI * 2;
        if ( constraint._azimuth ){
            aziMin = constraint._azimuth[0];
            aziMax = constraint._azimuth[1];
        }
        if(polMin > polMax) { //vertical -- theta
            polMin -= 2*Math.PI;
        }
        polMax = Math.abs(polMax - polMin);

        if(aziMin > aziMax) { //XY horizontal -- phi
            aziMin -= 2*Math.PI;
        }
        aziMax = Math.abs(aziMax - aziMin);
    
        const sphere = new THREE.SphereGeometry( 1, 16, 16, aziMin, aziMax, polMin , polMax);
        let helper = new THREE.Mesh( sphere, material );
        helper.visible = !!(this.visible & this.visibleFlags & IKHelper.VISIBILITYFLAGS.CONSTRAINTS);

        helper.setRotationFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI*0.5);
        helper.applyMatrix4(new THREE.Matrix4().setFromMatrix3(mat));
        helper.scale.set(this.visualisationScale,this.visualisationScale,this.visualisationScale);
        helper.position.copy(this.skeleton.bones[bone].position);
        helper.bone = bone;

        this.skeleton.bones[bone].parent.add( helper );
        if(!this.constraintHelpers[chainName])
            this.constraintHelpers[chainName] = {};
        this.constraintHelpers[chainName][bone] = helper;
    }

    _addHingeHelper(constraint, bone, chainName) {

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

        let min = 0;
        let max = Math.PI * 2;
        if ( constraint._limits ){
            min = constraint._limits[0];
            max = constraint._limits[1];
            if(min > max) {
                min -= 2*Math.PI;
            }
        }
        max = Math.abs(max - min);

        let circle = new THREE.CircleGeometry( 1, 15, min - Math.PI*0.5, max);

        let helper = new THREE.Mesh( circle, material );
        helper.visible = !!(this.visible & this.visibleFlags & IKHelper.VISIBILITYFLAGS.CONSTRAINTS);
        helper.setRotationFromAxisAngle(new THREE.Vector3(1,0,0), -Math.PI*0.5);
        helper.applyMatrix4(new THREE.Matrix4().setFromMatrix3(mat));
        helper.scale.set(this.visualisationScale,this.visualisationScale,this.visualisationScale);
        helper.position.copy(this.skeleton.bones[bone].position);
        helper.bone = bone;

        this.skeleton.bones[bone].parent.add( helper );
        if(!this.constraintHelpers[chainName])
            this.constraintHelpers[chainName] = {};
        this.constraintHelpers[chainName][bone] = helper;
    }

    _removeHelper(idx, chainName) {
        if ( this.constraintHelpers && this.constraintHelpers[chainName] && this.constraintHelpers[chainName][idx] ){
            this.constraintHelpers[chainName][idx].removeFromParent(); // remove from scene
            this.constraintHelpers[chainName][idx].geometry.dispose(); // memory
            this.constraintHelpers[chainName][idx].material.dispose(); // memory
            delete this.constraintHelpers[chainName][idx];
        }
    }

    _removeChainHelpers(chainName) {
        for(let idx in this.constraintHelpers[chainName]) {
            this._removeHelper(idx, chainName);
        }
        delete this.constraintHelpers[chainName];
    }

    update() {

        this._updateBones();
        return;

    }

    _updateBones( ) {

        if(!this.bonePoints)
            return;

        let vertices = [];

        for(let bone of this.skeleton.bones) {
            let tempVec = new THREE.Vector3();
            bone.getWorldPosition(tempVec);
            vertices.push( tempVec );
        }

        this.bonePoints.geometry.setFromPoints(vertices);
        this.bonePoints.geometry.computeBoundingSphere();
    }
    

    /** change visibility of the helper */
    setVisibility(v) {
        this.visible = (v) ? IKHelper.VISIBILITYFLAGS.ALL : IKHelper.VISIBILITYFLAGS.NONE;

        let flags = this.visible & this.visibleFlags;
        if( this.skeletonHelper ){ this.skeletonHelper.visible = !!(flags & IKHelper.VISIBILITYFLAGS.SKELETON); }
        if( this.bonePoints ){ this.bonePoints.visible = !!(flags & IKHelper.VISIBILITYFLAGS.BONEPOINTS); }
        for( let c in this.constraintHelpers) {
            let chain = this.constraintHelpers[c];
            for(let h in chain) {
                chain[h].visible = !!(flags & IKHelper.VISIBILITYFLAGS.CONSTRAINTS);
            }
        }
    }   

    setVisibilityFlags( flags ){
        if( isNaN(flags) ){ return; }
        this.visibleFlags = flags;
        this.setVisibility( this.visible );
    }

    /** change scale of helpers */
    setVisualisationScale(v){
        this.visualisationScale = v;
        for( let c in this.constraintHelpers) {
            let chain = this.constraintHelpers[c];
            for(let h in chain) {
                chain[h].scale.set(v,v,v);
            }
        }
    }
};

IKHelper.VISIBILITYFLAGS = {
    NONE : 0x00,
    ALL : 0xff,
    SKELETON : 0x01,
    BONEPOINTS : 0X02,
    CONSTRAINTS : 0X04,
}

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

				gl_FragColor = vec4( color * vColor, 1.0 );

				gl_FragColor = gl_FragColor * texture2D( pointTexture, gl_PointCoord );

				if ( gl_FragColor.a < alphaTest ) discard;

			}

		`
    }

};

export { IKHelper };
