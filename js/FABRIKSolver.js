import * as THREE from 'three';

let _quat = new THREE.Quaternion();
let _quat2 = new THREE.Quaternion();

let _quat3 = new THREE.Quaternion(); // twist
let _quat4 = new THREE.Quaternion(); // swing

let _vec3 = new THREE.Vector3();
let _vec3_2 = new THREE.Vector3();
let _vec3_3 = new THREE.Vector3();

let __vec3_1 = new THREE.Vector3();

let _mat3 = new THREE.Matrix3();
let _mat4 = new THREE.Matrix4();


// needed for applying a constraint. range of constraint and angle >= 0
function _snapToClosestAngle ( angle, minConstraint = 0, maxConstraint = 360 ){
    // needed to ensure boundaries when constraint crosses the 0º/360º (discontinuity)
    let min = Math.min ( Math.abs( minConstraint - angle), Math.min( Math.abs( minConstraint - ( angle - Math.PI * 2 ) ), Math.abs( minConstraint - ( angle + Math.PI * 2 ) ) ) );
    let max = Math.min ( Math.abs( maxConstraint - angle), Math.min( Math.abs( maxConstraint - ( angle - Math.PI * 2 ) ), Math.abs( maxConstraint - ( angle + Math.PI * 2 ) ) ) );
    
    if ( min < max ){ return minConstraint; } 
    return maxConstraint;
}

// angle && minConstraint && maxConstraint = [0,360]
function _constraintAngle ( angle, minConstraint = 0, maxConstraint = 360 ){
    if ( angle < 0 ){ angle += Math.PI * 2; }
    if ( minConstraint > maxConstraint ){ // range crosses 0º (like range [300º, 45º] )
        if ( angle > maxConstraint && angle < minConstraint ){ // out of boundaries
            angle = _snapToClosestAngle( angle, minConstraint, maxConstraint ); 
        }
    }else{ // normal range (like [0º, 135º] )
        if ( !( angle > minConstraint && angle < maxConstraint ) ){ // out of boundaries
            angle = _snapToClosestAngle( angle, minConstraint, maxConstraint );
        }    
    }
    return angle;
}

/* -------------- threejs skeleton info

Skeleton class holds all the information (see pose() and update() for more visual info)
 - this.boneInverses: holds the inverse world matrices of the BIND pose
        inv( [ParentParentParent]*[ParentParent] * [Parent] *[MyBone] )
        
        - this.boneMatrices: holds the current world matrices of the bones in a single array (probably for streaming it directly to the gpu). Modifying it directly does not change gpu skinning (but changes skeletonHelper...)
    WARNING: probably they are really world matrices, as in not in local space of the model, but really scene world matrices. i.e. the object models are also applied

    - bone.matrixWorld: current world matrix. Modifying it directly does not change gpu skinning (but changes skeletonHelper...) Also, subsequent bones do not see the changes
    WARNING: this matrix also contains the object models applied. i.e. a skeleton inside an object, will have the object's model applied to all bone's matrixWorld
    
    - modifying bone quaternion/position does NOT instantly modify the matrix nor the matrixWorld
    
    */


    // RIGHT HANDED COORDS
class FABRIKSolver {
       
    constructor ( skeleton ){
        this.skeleton = skeleton;
        this.chains = [];
        this.constraintsEnabler = true;
        this.iterations = 1;
        this.sqThreshold = 0.00001;
        
        let numBones = this.skeleton.bones.length;
        // precompute bind rotations (to not compute them constantly). Used in constraints. (some T-poses have rotations already applied... that is why this is needed)
        this._bindQuats = [];
        this._bindQuats.length;
        
        // direction of this bone ( parent -> this bone ) in bind position in parent coords (used in constraints) 
        this._boneDirs = [];
        this._boneDirs.length = numBones;
        this._boneLengths = []; // unusable right now due to bind size vs scaled world sizes
        this._boneLengths.length = numBones;
        
        for ( let i = 0; i < numBones; ++i ){
            let parentIdx = this.skeleton.bones.indexOf( this.skeleton.bones[i].parent );

            _mat4.copy( this.skeleton.boneInverses[i] );
            _mat4.invert();

            if ( parentIdx > -1){
                _mat4.premultiply( this.skeleton.boneInverses[ parentIdx ] );
            }
            _quat.setFromRotationMatrix( _mat4 );
            this._bindQuats[i] = _quat.clone();
            _vec3.setFromMatrixPosition( _mat4 ); // child's raw position with respect to its parent
            this._boneLengths[i] = _vec3.length();

            this._boneDirs[i] = _vec3.clone(); // parent bind rotation not applied yet
        }
        
        // If skeleton.bones is always ordered, then boneDirs can be computed during bindQuats discovery
        for( let i = 0; i < numBones; ++i ){
            let parentIdx = this.skeleton.bones.indexOf( this.skeleton.bones[i].parent );
            if ( parentIdx > -1 ){ // if not root bone
                this._boneDirs[i].applyQuaternion( this._bindQuats[ parentIdx ] ); // apply bind rotation
            }
            // now vec3 is the i-th bone in bind position in parent space coordinates
            this._boneDirs[i].normalize();
        }
        
        
        // generate world position buffers
        this._positions = [];
        this._targetPositions = [];
        this._positions.length = numBones;
        this._targetPositions.length = numBones;
        for (let i = 0; i < numBones; ++i){
            this._positions[i] =  new THREE.Vector3();
            this._targetPositions[i] = new THREE.Vector3();
        }

    }

    /**
     * @param {int} iterations 
     */
    setIterations ( iterations ){
        if ( isNaN(iterations) ){ this.iterations = 1; }
        else if ( iterations < 0 ){ this.iterations = 1; }
        else{ this.iterations = iterations; }
    }

    /**
     * Maximum squared distance to consider a certain effector as well positioned
     * @param {number} sqDist 
     */
    setSquaredDistanceThreshold ( sqDist ){
        if ( isNaN(sqDist) ){ this.sqThreshold = 0.001; }
        else if ( sqDist < 0 ){ this.sqThreshold = 0.001; }
        else{ this.sqThreshold = sqDist; }
    }
    
    /**
     * creates a new chain
     * @param {Array(int)} newChain ordered array with bone indices (from skeleton.bones). [ efector, parent, parent parent, ... , rootChain ]
     * @param {Array(obj)} newConstraints array of objects (one for each bone) containing all desired constraints. Effector constriants wlil be ignored
     * @param {Object3D} targetObj 
     * @param {string} name of the chain 
     */
    createChain ( newChain, newConstraints, targetObj, name = "" ){
        //        { x: [min, max], y:[min, max], z:[min, max] }
        // if constraints || x || y || z null, that axis becomes unconstrained. Other
        
        let chainInfo = {};

        let chain = JSON.parse(JSON.stringify(newChain));
        let constraints = []; 
        constraints.length = chain.length;
        constraints[0] = null; // effector will not be rotated. Right now, the entry is necessary but not used
        for( let i = 1; i < chain.length; ++i ){
            if( !newConstraints || i >= newConstraints.length ){ constraints[i] = null; continue; }
            this._setConstraintToBone( chain, constraints, i, newConstraints[i] );
        }
        
        // add to list
        chainInfo.name = (typeof(name) === 'string' ) ? name : "";
        chainInfo.chain = chain;
        chainInfo.constraints = constraints;
        chainInfo.target = targetObj;
        this.chains.push( chainInfo );
    }

    /** O(N)
     * @param {string} name 
     * @returns 
     */
    removeChain( name ){
        for (let i = 0; i< this.chains.length; ++i){
            if ( this.chains[i].name === name ){ this.chains.splice(i, 1); }
        }
    }

    /**
     * removes all chains 
     */
    removeAllChains () {
        this.chains = [];
    }
    
    /** O(N)
     * @param {string} name
     */
    getChain( name ){
        for (let i = 0; i< this.chains.length; ++i){
            if ( this.chains[i].name === name ){ return this.chains[i]; }
        }
        return null;
    }

    /**
     * modifies a constraint of a bone in an existing chain
     * @param {string} chainName 
     * @param {int} idxBoneInChain index in the chain array (not the actual bone number)
     * @param {obj} newConstraint object with all desired attributes for that constraint
     * @returns boolean
     */
    setConstraintToBone( chainName, idxBoneInChain, newConstraint ){
        let chainInfo = this.getChain( chainName );
        if ( !chainInfo ) { return false; }
        return this._setConstraintToBone( chainInfo.chain, chainInfo.constraints, idxBoneInChain, newConstraint );
    }   

    /**
     * Internal. Changes the constraint associated to a bone in a chain. 
     * @param {Array(int)} chain array of bone indices of skeleton of the chain
     * @param {Array(obj)} chainConstraints array of constraints of chain
     * @param {int} i index in the chain of the bone to modify
     * @param {obj} newConstraint new constraint attributes. Can be null 
     * @returns 
     */
    _setConstraintToBone( chain, chainConstraints, i, newConstraint ){
        if ( i <= 0 || i >= chain.length ){ return false; } // effector or out of boundaries

        if( !newConstraint ){ 
            chainConstraints[ i ] = null; 
            return true; 
        }

        // same type. Do not allocate new memory, just change values
        if ( chainConstraints[ i ] && chainConstraints[ i ]._type == newConstraint.type ){
            chainConstraints[ i ].setConstraint( newConstraint );
            return true;
        }
        
        let c = null;
        switch( newConstraint.type ){
            case FABRIKSolver.JOINTTYPES.HINGE: c = new JCHinge( this._boneDirs[ chain[ i-1 ] ] ); break;
            case FABRIKSolver.JOINTTYPES.BALLSOCKET: c = new JCBallSocket( this._boneDirs[ chain[ i-1 ] ] ); break;
            default: c = new JointConstraint( this._boneDirs[ chain[ i-1 ] ] ); break;
        }

        c.setConstraint( newConstraint );
        chainConstraints[ i ] = c;
        return true;
    }

    /**
     * Applies rotation restrictions on the specified bone. Bone 0 (effector) is not accepted as no restrictions should be applied to it
     * @param {int} chainIdx 
     * @param {int > 0} chainBoneIndex 
     * @returns 
     */
    _applyConstraint ( chainIdx, chainBoneIndex = 1 ){
        let chain = this.chains[ chainIdx ].chain;
        let chainConstraints = this.chains[ chainIdx ].constraints;
        if ( !chainConstraints ){ return; }
        let constraint = chainConstraints[ chainBoneIndex ];
        if ( !constraint ){ return; }

        let boneIdx = chain[ chainBoneIndex ];
        let bone = this.skeleton.bones[ boneIdx ];        

        let invBindRot = _quat;
        let poseRot = _quat2;

        let bindRot = this._bindQuats[ boneIdx ];
        invBindRot.copy( bindRot );
        invBindRot.invert();

        // get only rotation starting from the bind pose
        poseRot.multiplyQuaternions( bone.quaternion, invBindRot ); 

        //actual twist-swing constraint
        constraint.applyConstraint( poseRot, poseRot );

        // commit results
        bone.quaternion.copy( bindRot );
        bone.quaternion.premultiply( poseRot );
        bone.quaternion.normalize();
    }

    update ( ){
        // final step of rotations probably wrong. Matrixworld and matrix of parents and childs are not being updated. So bones are not being progressively snaped to their targets
        let bones = this.skeleton.bones;
        let positions = this._positions;
        let targetPositions = this._targetPositions;
        
        for( let it = 0; it < this.iterations; ++it ){

            for ( let chainIdx = 0; chainIdx < this.chains.length; ++chainIdx ){
                let chain = this.chains[ chainIdx ].chain;
                let targetObj = this.chains[chainIdx].target;

                // forward - move points to target
                let currTargetPoint = _vec3;
                if ( targetObj.getWorldPosition ){ targetObj.getWorldPosition( currTargetPoint ); }
                else{ currTargetPoint.copy( targetObj.position ); }
                

                if ( currTargetPoint.distanceToSquared( bones[ chain[0] ].getWorldPosition(_vec3_2) ) <= this.sqThreshold ){ continue; }
                
                // current pose world positions
                for (let i = 0; i < positions.length; ++i){
                    positions[i].setFromMatrixPosition( bones[i].matrixWorld );
                }
                
                for ( let i = 0; i < chain.length-1; ++i ){
                    let boneIdx = chain[i]; // child
                    let nextBoneIdx = chain[i+1]; // parent
                    // this._boneLengths cannot be used. Bind can be unscaled and real world might be scaled
                    let boneSize = positions[ boneIdx ].distanceTo( positions[ nextBoneIdx ] ); // computing this makes sense if bones change sizes. Usually they do not. Maybe precompute them

                    let tp = targetPositions[ boneIdx ];
                    tp.copy( currTargetPoint );

                    // compute new distance vector from Child-Moved-Point --> Parent-Unmoved-Joint
                    currTargetPoint.sub( positions[ nextBoneIdx] );
                    currTargetPoint.normalize();
                    currTargetPoint.multiplyScalar( -boneSize );

                    // set next moved point for Parent
                    currTargetPoint.add( tp );
                }
                targetPositions[ chain[chain.length-1] ].copy( currTargetPoint );


                // backward - move points back to skeleton
                currTargetPoint = positions[ chain[ chain.length -1 ] ].clone();
                for ( let i = chain.length-1; i >= 1; --i ){
                    let boneIdx = chain[i]; // parent
                    let nextBoneIdx = chain[i-1]; // child
                    // this._boneLengths cannot be used. Bind can be unscaled and real world might be scaled
                    let boneSize = positions[ boneIdx ].distanceTo( positions[ nextBoneIdx ] );

                    let tp = targetPositions[ boneIdx ];
                    tp.copy( currTargetPoint );

                    // compute new distance vector movedPoint --> next Unmoved Joint
                    currTargetPoint.sub( targetPositions[ nextBoneIdx ] );
                    currTargetPoint.normalize();
                    currTargetPoint.multiplyScalar( -boneSize );

                    currTargetPoint.add( tp );
                }  
                targetPositions[ chain[0] ].copy( currTargetPoint );



                // compute rotations
                // from parent to effector
                let axis = _vec3;
                let quat = _quat;
                for ( let i = chain.length-1; i > 0; --i ){ // last bone (effector) does not need rotation fix
                    let boneIdx = chain[i]; // parent
                    let nextBoneIdx = chain[i-1]; // child
                    
                    bones[ boneIdx ].updateMatrixWorld(true);
                    let wToL = _mat4;
                    wToL.copy( bones[ boneIdx ].matrixWorld );
                    wToL.invert();

                    // Parent local space but with rotated child. Child position
                    let oldVec = _vec3_2;
                    oldVec.copy( bones[ nextBoneIdx ].position );
                    oldVec.applyQuaternion( bones[boneIdx].quaternion ); // apply original rotation to not mess up axis alignments when ik-adjusting
                    oldVec.normalize();
                    
                    // Parent local space. Child new target position
                    let newVec = _vec3_3;
                    newVec.copy( targetPositions[ nextBoneIdx ] );
                    newVec.applyMatrix4( wToL );
                    newVec.applyQuaternion( bones[boneIdx].quaternion ); // apply original rotation to not mess up axis alignments when ik-adjusting
                    newVec.normalize();
                    
                    let angle = oldVec.angleTo( newVec );
                    if ( angle > -0.001 && angle < 0.001 ){ continue; }// no additional rotation required
                    axis.crossVectors( oldVec, newVec );
                    axis.normalize();

                    quat.setFromAxisAngle( axis, angle );
                    quat.normalize();

                    bones[ boneIdx ].quaternion.premultiply( quat ); 
                    
                    if( this.constraintsEnabler )
                        this._applyConstraint( chainIdx, i );

                    bones[ boneIdx ].updateMatrixWorld(true);
                
                }
            }  
        }
    }
}


// ---------------- JOINTS ---------------- 
/**
 * Simple omni-swing joint. Allows for twist constraints 
 */
class JointConstraint{
    
    /**
     * @param {THREE.Vector3} boneDir direction of the bone that start at this joint. Used to determine twist, swing and constraints
     */
    constructor( boneDir ){
        this._boneDir = new THREE.Vector3(); 
        if ( boneDir.isVector3 ){ this._boneDir.copy( boneDir ); }
        else if ( !isNaN(boneDir.x) ){ this._boneDir.set( boneDir.x, boneDir.y, boneDir.z ); }
        else { this._boneDir.set( boneDir[0], boneDir[1], boneDir[2] ); }
        this._boneDir.normalize();

        this._twist = null; //[ 0, Math.PI*2 - 0.0001 ];
        // twist axis == this._boneDir

        this._swingFront = new THREE.Vector3(0,0,1); // axis on which joint rotates
        this._swingUp = new THREE.Vector3(0,1,0);
        this._swingRight = new THREE.Vector3(1,0,0);

        this._type = FABRIKSolver.JOINTTYPES.OMNI; 
    }
    
    /**
     * @param {Object} constraint 
     * possible (concurrent) properties:
     *  - twist : [ minAngle, maxAngle ]  
     */
    setConstraint( constraint ){
        let temp1 = _vec3;
        let temp2 = _vec3_2;

        if ( constraint.twist ){
            this._twist = [0,0.0001];
            this._twist[0] = constraint.twist[0] % (Math.PI*2); 
            this._twist[1] = constraint.twist[1] % (Math.PI*2); 
            if ( this._twist[0] < 0 ){ this._twist[0] += Math.PI*2; } 
            if ( this._twist[1] < 0 ){ this._twist[1] += Math.PI*2; } 
        }
        else{ this._twist = null; }

        if ( this._type == FABRIKSolver.JOINTTYPES.OMNI ){ return; }
        // compute front, right, up vectors. Usual information for constraint computation
        let front = this._swingFront;
        let right = this._swingRight;
        let up = this._swingUp;

        // fix axis ( user assumes that (0,0,1) == boneDir )
        if ( !constraint.axis ){ front.set(0,0,1); } // default same direction as bone
        else if ( constraint.axis.isVector3 ){ front.copy( constraint.axis ); }
        else{ front.set( constraint.axis[0], constraint.axis[1], constraint.axis[2] ); }
        
        if ( front.lengthSq < 0.00001 ){ front.set(0,0,1); } // default same direction as bone
        front.normalize();
        
        // compute right axis ( X = cross(Y,Z) ) check front axis is not Y
        up.set( 0,1,0 );
        right.crossVectors( up, front ); // X = cross( Y, Z )
        if ( right.lengthSq < 0.0001 ){ right.set( 1,0,0 ); } // z axis == -+y axis, right will be +x
        else{ right.normalize(); }

        up.crossVectors( front, right ); // Y = cross( Z, X )
        up.normalize();

        // transform front, right, up from '+z == boneDir' space to bone space
        temp1.set( 0,0,0 );
        temp2.set( 0,1,0 ); // default up
        _mat4.lookAt( this._boneDir, temp1, temp2 ); // apparently it does not set the translation... threejs...
        let lookAtMat = _mat3; // L -> W
        lookAtMat.setFromMatrix4(_mat4);
        
        front.applyMatrix3( lookAtMat );
        right.applyMatrix3( lookAtMat );
        up.applyMatrix3( lookAtMat );
        
    }
    
    /**
     * Internal function. Derived classes implements their cusotm behaviours
     * @param {THREE.Vector3} swingPos position of bone after applying the swing rotation. Overwritten with corrected position  
     */
     _applyConstraintSwing( swingPos ){}

    /**
     * @param {THREE.Quaternion} inQuat quaternion to correct. This quaternion represent the rotation to apply to boneDir
     * @param {THREE.Quaternion} outQuat corrected quaternion. Can be the same as inQuat
     */
    applyConstraint( inQuat, outQuat ){ 
        let boneDir = this._boneDir;
        let twist = _quat3;
        let swing = _quat4;
        let swingPos = _vec3_2;
        let swingCorrectedAxis = _vec3_3;
        let twistCorrectedAxis = _vec3_3; // this is used after swingCorrectedAxis has finished

        // TwistQuat = [ WR,  proj_VTwist( VRot ) ]
        _vec3_2.set( inQuat.x, inQuat.y, inQuat.z );
        _vec3_2.projectOnVector( boneDir );
        twist.set( _vec3_2.x, _vec3_2.y, _vec3_2.z, inQuat.w );
        twist.normalize();
        
        // SwingQuat = R*inv(T)
        swing.copy( twist );
        swing.invert();
        swing.premultiply( inQuat );
        swing.normalize();

        // swing bone
        swingPos.copy( boneDir );
        swingPos.applyQuaternion( swing );

        // actual SWING pos constraint. Specific of each class
        this._applyConstraintSwing( swingPos );
        
        // compute corrected swing. 
        swingCorrectedAxis.crossVectors( boneDir, swingPos );

        if ( swingCorrectedAxis.lengthSq() < 0.0001 ){ // swing corrected Position is parallel to twist axis
            if  ( boneDir.dot( swingPos ) < -0.9999){  // opposite side -> rotation = 180º
                swingCorrectedAxis.set( -boneDir.y, boneDir.x, boneDir.z ); 
                swingCorrectedAxis.crossVectors( swingCorrectedAxis, boneDir ); // find any axis perpendicular to bone
                swingCorrectedAxis.normalize();
                swing.setFromAxisAngle( swingCorrectedAxis, Math.PI ); // rotate 180º
                swing.normalize();
            }
            else{ swing.set(0,0,0,1); } // same vector as twist. No swing required
        }
        else{ 
            swingCorrectedAxis.normalize();
            swing.setFromAxisAngle( swingCorrectedAxis, boneDir.angleTo( swingPos ) );
            swing.normalize();
        }
        
        // actual TWIST constraint
        if( this._twist ){
            let twistAngle = 2* Math.acos( twist.w ); 
            twistCorrectedAxis.set( twist.x, twist.y, twist.z ); // in reality this is axis*sin(angle/2) but it does not have any effect here
            if ( twistCorrectedAxis.dot( boneDir ) < 0 ){ twistAngle = ( -twistAngle ) + Math.PI * 2; } // correct angle value as acos only returns 0-180

            twistAngle = _constraintAngle( twistAngle, this._twist[0], this._twist[1] );            
            twist.setFromAxisAngle( boneDir, twistAngle );
        }

        // result
        outQuat.copy(twist);
        outQuat.premultiply(swing);
    }
}


/**
 * Uses spherical coordinates to handle swing constraint
 */
class JCBallSocket extends JointConstraint {
    /**
     * @param {THREE.Vector3} boneDir direction of the bone that start at this joint. Used to determine twist, swing and constraints
     */
    constructor( boneDir ){
        super( boneDir );
        this._type = FABRIKSolver.JOINTTYPES.BALLSOCKET;
        
        this._polar = null; // [min, max] rads
        this._azimuth = null; // [min, max] rads
    }

    /**
     * @param {Object} constraint 
     * possible (concurrent) properties:
     *  - twist : [ minAngle, maxAngle ]  rads
     *  - axis : THREE.Vector3 axis of swing rotation. +z == bone direction
     *  - polar : [ minAngle, maxAngle ] rads. valid ranges are inside [0,PI]. Aperture with respect to axis
     *  - azimuth : [ minAngle, maxAngle ] rads. valid ranges [0, 2PI]. Angle in the plane generated by axis
     */
    setConstraint( constraint ){
        super.setConstraint( constraint );
        this._polar = null;
        this._azimuth = null;

        if ( constraint.polar ){ // POLAR range [0-180]
            this._polar = [0, Math.PI]; 
            this._polar[0] = Math.max(0, Math.min( Math.PI, constraint.polar[0] ) );
            this._polar[1] = Math.max( this._polar[0], Math.max(0, Math.min( Math.PI, constraint.polar[1] ) ) );
        }
        if ( constraint.azimuth ){
            this._azimuth = [0, Math.PI*2]
            this._azimuth[0] = constraint.azimuth[0] % (Math.PI*2); 
            this._azimuth[1] = constraint.azimuth[1] % (Math.PI*2);
            if ( this._azimuth[0] < 0 ){ this._azimuth[0] += Math.PI*2; } 
            if ( this._azimuth[1] < 0 ){ this._azimuth[1] += Math.PI*2; } 
        }
    }

    /**
     * Internal function. Derived classes implements their cusotm behaviours
     * @param {THREE.Vector3} swingPos position of bone after applying the swing rotation. Overwritten with corrected position  
     */
    _applyConstraintSwing( swingPos ){
        if ( !this._polar && !this._azimuth ){ return; }
        let swingPolarAngle = 0;
        let swingAzimuthAngle = 0; // XY plane where +X is 0º
        
        let front = this._swingFront;
        let right = this._swingRight;
        let up = this._swingUp;
        let xy = __vec3_1; 
        xy.copy( front );
        xy.subVectors( swingPos, xy.multiplyScalar( front.dot( swingPos ) ) ); // rejection of swingPos

        // compute polar and azimuth angles
        swingPolarAngle = front.angleTo( swingPos );
        swingAzimuthAngle = right.angleTo( xy );
        if( up.dot( xy ) < 0 ){ swingAzimuthAngle = -swingAzimuthAngle + Math.PI * 2; }

        // constrain angles
        if ( this._polar ){ swingPolarAngle = _constraintAngle( swingPolarAngle, this._polar[0], this._polar[1] );           }
        if ( this._azimuth ){ swingAzimuthAngle = _constraintAngle( swingAzimuthAngle, this._azimuth[0], this._azimuth[1] ); }

        // regenerate point with fixed angles
        swingPos.set( right.x, right.y, right.z );
        swingPos.applyAxisAngle( front, swingAzimuthAngle );
        __vec3_1.crossVectors( swingPos, front ); // find perpendicular vector
        __vec3_1.normalize();
        swingPos.applyAxisAngle( __vec3_1, Math.PI * 0.5 - swingPolarAngle ); //cross product starts at swingPos. Polar is angle from front -> a = 90 - a
    }
}

/**
 * Simple hinge constraint
 */
class JCHinge extends JointConstraint {
    /**
     * @param {THREE.Vector3} boneDir direction of the bone that start at this joint. Used to determine twist, swing and constraints
     */
    constructor( boneDir ){
        super( boneDir );
        this._type = FABRIKSolver.JOINTTYPES.HINGE;
        this._limits = null; // [min,max] rads
    }

    /**
     * @param {Object} constraint 
     * possible (concurrent) properties:
     *  - twist : [ minAngle, maxAngle ]  rads
     *  - axis : THREE.Vector3 axis of swing rotation. +z == bone direction
     *  - min : minimum angle. Valid ranges [0, 2PI]. Angle in the plane generated by axis
     *  - max : minimum angle. Valid ranges [0, 2PI]. Angle in the plane generated by axis
     */
     setConstraint( constraint ){
        super.setConstraint( constraint );
        this._limits = null;
        if ( !isNaN(constraint.min) && !isNaN(constraint.max) ){ 
            this._limits = [0,Math.PI*2];
            this._limits[0] = constraint.min % (Math.PI*2);
            this._limits[1] = constraint.max % (Math.PI*2); 
            if ( this._limits[0] < 0 ){ this._limits[0] += Math.PI*2; } 
            if ( this._limits[1] < 0 ){ this._limits[1] += Math.PI*2; } 
        }
    }

    /**
     * Internal function. Derived classes implements their cusotm behaviours
     * @param {THREE.Vector3} swingPos position of bone after applying the swing rotation. Overwritten with corrected position  
     */
     _applyConstraintSwing( swingPos ){
        __vec3_1.copy( this._swingFront );

        let dot = __vec3_1.dot( swingPos );
        if ( dot < -0.9999 && dot > 0.9999 ){ swingPos.copy( this._swingRight ); } // swingPos parallel to rotation axis
        else{ swingPos.sub( __vec3_1.multiplyScalar( dot ) ); } // project onto plane

        if ( !this._limits ){ return; }

        //TODO:  can be optimized to no use any angle, but cos and sin instead
        let angle = this._swingRight.angleTo( swingPos ); // [0,180]
        
        // fix angle range from [0,180] to [0,360]
        if ( this._swingUp.dot( swingPos ) < 0){ angle = -angle + Math.PI*2; }
        
        angle = _constraintAngle( angle, this._limits[0], this._limits[1] );
        swingPos.copy( this._swingRight );
        swingPos.applyAxisAngle( this._swingFront, angle );
    }
}

FABRIKSolver.JOINTTYPES = { OMNI: 0, HINGE: 1, BALLSOCKET: 2 }; // omni is just the default no constrained joint


export{ FABRIKSolver };