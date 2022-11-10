import * as THREE from 'three';

let _quat = new THREE.Quaternion();
let _quat2 = new THREE.Quaternion();
let _quat3 = new THREE.Quaternion();
let _quat4 = new THREE.Quaternion();
let _vec3 = new THREE.Vector3();
let _vec3_2 = new THREE.Vector3();
let _vec3_3 = new THREE.Vector3();
let __vec3_1 = new THREE.Vector3();
let __vec3_2 = new THREE.Vector3();
let __vec3_3 = new THREE.Vector3();
let _mat3 = new THREE.Matrix3();
let _mat3_2 = new THREE.Matrix3();
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
        this.constraints = [];
        this.constraintsEnabler = true;
        this.iterations = 1;

        let numBones = this.skeleton.bones.length;
        // precompute world bind matrices (to not compute them constantly). Used in constraints. (some T-poses have rotations already applied... that is why this is needed)
        this.bindLocalMatrices = [];
        this.bindLocalMatrices.length = numBones;
        this.bindQuats = [];
        this.bindQuats.length;
        
        for ( let i = 0; i < numBones; ++i ){
            let parentIdx = this.skeleton.bones.indexOf( this.skeleton.bones[i].parent );

            this.bindLocalMatrices[i] = this.skeleton.boneInverses[i].clone();
            this.bindLocalMatrices[i].invert();

            if ( parentIdx > -1){
                this.bindLocalMatrices[i].premultiply( this.skeleton.boneInverses[ parentIdx ] );
            }
            _quat.setFromRotationMatrix( this.bindLocalMatrices[i] );
            this.bindQuats[i] = _quat.clone();
        }
        
        // generate world position buffers
        this.positions = [];
        this.targetPositions = [];
        this.positions.length = numBones;
        this.targetPositions.length = numBones;
        for (let i = 0; i < numBones; ++i){
            this.positions[i] =  new THREE.Vector3();
            this.targetPositions[i] = new THREE.Vector3();
        }


        //--- each entry is comparing itself with its parent
        // direction of this bone ( parent -> this bone ) in bind position in parent coords (used in constraints) 
        this.boneDirs = [];
        this.boneDirs.length = numBones;
        this.boneLengths = [];
        this.boneLengths.length = numBones;
        
        for( let i = 0; i < numBones; ++i ){
            let parentIdx = this.skeleton.bones.indexOf( this.skeleton.bones[i].parent );

            _vec3.setFromMatrixPosition( this.bindLocalMatrices[ i ] ); // child's raw position
            this.boneLengths[i] = _vec3.length();

            if ( parentIdx > -1 ){ // if not root bone
                _mat3.setFromMatrix4( this.bindLocalMatrices[ parentIdx ] );
                _vec3.applyMatrix3( _mat3 ); // apply bind rotation
            }

            // now vec3 is the i-th bone in bind position in parent space coordinates
            _vec3.normalize();
            this.boneDirs[i] = _vec3.clone();
        }
        

    }

    //targetObj requires a worldposition
    createChain ( newChain, newConstraints, targetObj ){
        //        { x: [min, max], y:[min, max], z:[min, max] }
        // if constraints || x || y || z null, that axis becomes unconstrained. Other

        let chainInfo = {};

        let chain = JSON.parse(JSON.stringify(newChain));
        let constraints = JSON.parse( JSON.stringify( newConstraints ) );
        if ( constraints ){
            for( let i = 0; i < chain.length; ++i ){
                let c = constraints[i];
                if ( !c ){ continue; }
                
                switch( c.type ){
                    case FABRIKSolver.JOINTTYPES.HINGE: c.joint = new JointHinge(); c.joint.changeConstraints(c); break;//this.__fixHingeConstraints( c ); break;
                    case FABRIKSolver.JOINTTYPES.BALLSOCKET: c.joint = new JointBallSocket(); c.joint.changeConstraints(c); break;//this.__fixBallSocketConstraints( c ); break;
                    default: c.type = FABRIKSolver.JOINTTYPES.OMNI; break;
                }       

                if ( c.twist ){
                    c.twist[0] = c.twist[0] % (Math.PI*2); 
                    c.twist[1] = c.twist[1] % (Math.PI*2); 
                    if ( c.twist[0] < 0 ){ c.twist[0] += Math.PI*2; } 
                    if ( c.twist[1] < 0 ){ c.twist[1] += Math.PI*2; } 
                }

                constraints[i] = c;
            }
        }else{ constraints = null; }
        
        // add to list
        chainInfo.chain = chain;
        chainInfo.constraints = constraints;
        chainInfo.target = targetObj;
        this.chains.push( chainInfo );
    }

    _applyConstraint ( chainIdx, chainBoneIndex = 1 ){
        let chain = this.chains[ chainIdx ].chain;
        let chainConstraints = this.chains[ chainIdx ].constraints;
        if ( !chainConstraints ){ return; }
        let constraint = chainConstraints[ chainBoneIndex ];
        if ( !constraint ){ return; }

        let childIdx = chain[ chainBoneIndex - 1 ];
        let boneIdx = chain[ chainBoneIndex ];
        let bone = this.skeleton.bones[ boneIdx ];        

        let invBindRot = _quat;
        let poseRot = _quat2;
        let twist = _quat3;
        let swing = _quat4;
        let bindTwistAxis = _vec3; // bone in bind position

        //--- in bone space, create a lookAt matrix with the bind bone as +z
        bindTwistAxis.copy( this.boneDirs[ childIdx ] ); 

        _vec3_2.set( 0,0,0 );
        _vec3_3.set( 0,1,0 );
        _mat4.lookAt( bindTwistAxis, _vec3_2, _vec3_3 ); // apparently it does not set the translation... threjs...
        let lookAtMat = _mat3; // L -> W
        lookAtMat.setFromMatrix4(_mat4);
        let invLookAtMat = _mat3_2; // W -> L
        invLookAtMat.setFromMatrix4(_mat4);
        invLookAtMat.invert(); // this probably is just the transpose
        //---

        let bindRot = this.bindQuats[ boneIdx ];
        invBindRot.copy( bindRot );
        invBindRot.invert();

        poseRot.multiplyQuaternions( bone.quaternion, invBindRot ); // get only rotation starting from the bind pose

        // T = [ WR,  proj(VR)_VT ]
        _vec3_2.set( poseRot.x, poseRot.y, poseRot.z );
        _vec3_2.projectOnVector( bindTwistAxis );
        twist.set( _vec3_2.x, _vec3_2.y, _vec3_2.z, poseRot.w );
        twist.normalize();
        
        // S = R*inv(T)
        swing.copy( twist );
        swing.invert();
        swing.premultiply( poseRot );
        swing.normalize();

        // swing bone and transform into lookAt space (bone == +z)
        let posInAxisSpace = _vec3_2;
        posInAxisSpace.copy( bindTwistAxis );
        posInAxisSpace.applyQuaternion( swing );
        posInAxisSpace.applyMatrix3(invLookAtMat); // transform into space "bind Bone == +z"

        // actual SWING constraint
        switch( constraint.type ){
            case FABRIKSolver.JOINTTYPES.HINGE: constraint.joint.applyConstraintSwing( posInAxisSpace ); break; //this.__hinge( posInAxisSpace, constraint ); break;
            case FABRIKSolver.JOINTTYPES.BALLSOCKET: constraint.joint.applyConstraintSwing( posInAxisSpace); break;//this.__ballSocket( posInAxisSpace, constraint ); break;
            default: break;
        }  

        // from "bind Bone == +z" space back to joint space
        posInAxisSpace.applyMatrix3( lookAtMat );
        
        // compute swing
        let swingAxis = _vec3_3;
        swingAxis.crossVectors( bindTwistAxis, posInAxisSpace );


        if ( swingAxis.lengthSq() < 0.0001 ){ // posinaxis is parallel to twist axis
            if  ( bindTwistAxis.dot(posInAxisSpace) < -0.9999){  // opposite side
                swingAxis.set(-bindTwistAxis.y,bindTwistAxis.x,bindTwistAxis.z );
                swingAxis.crossVectors( swingAxis, bindTwistAxis );
                swing.setFromAxisAngle( swingAxis, Math.PI );
                swing.normalize();
            }
            else{ swing.set(0,0,0,1); } // same vector as twist. No swing required
        }
        else{ 
            swingAxis.normalize();
            swing.setFromAxisAngle( swingAxis, bindTwistAxis.angleTo( posInAxisSpace ) );
            swing.normalize();
        }
        
        // actual TWIST constraint
        if( constraint.twist ){
            let twistAngle = 2* Math.acos( twist.w ); 
            let tempTwistAxis = _vec3_3;
            tempTwistAxis.set( twist.x, twist.y, twist.z );
            if ( tempTwistAxis.dot( bindTwistAxis ) < 0 ){ twistAngle = ( -twistAngle ) + Math.PI * 2; } // correct angle value as acos only returns 0-180

            twistAngle = _constraintAngle( twistAngle, constraint.twist[0], constraint.twist[1] );            
            twist.setFromAxisAngle( bindTwistAxis, twistAngle );
        }

        // commit results
        bone.quaternion.set( bindRot.x, bindRot.y, bindRot.z, bindRot.w );
        bone.quaternion.premultiply( twist );
        bone.quaternion.premultiply( swing );
        bone.quaternion.normalize();



    }

    update ( ){
        // final step of rotations probably wrong. Matrixworld and matrix of parents and childs are not being updated. So bones are not being progressively snaped to their targets
        let bones = this.skeleton.bones;
        let positions = this.positions;
        let targetPositions = this.targetPositions;
        
        for( let it = 0; it < this.iterations; ++it ){

            for ( let chainIdx = 0; chainIdx < this.chains.length; ++chainIdx ){

                let chain = this.chains[ chainIdx ].chain;
                let targetObj = this.chains[chainIdx].target;
                // current pose world positions
                for (let i = 0; i < positions.length; ++i){
                    bones[i].updateMatrixWorld(true);
                    positions[i].setFromMatrixPosition( bones[i].matrixWorld );
                }


                // forward - move points to target
                let currTargetPoint = _vec3;
                if ( targetObj.getWorldPosition ){ targetObj.getWorldPosition( currTargetPoint ); }
                else{ currTargetPoint.copy( targetObj.position ); }

                for ( let i = 0; i < chain.length-1; ++i ){
                    let boneIdx = chain[i]; // child
                    let nextBoneIdx = chain[i+1]; // parent
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
                currTargetPoint = positions[ chain[ chain.length -1] ].clone();
                for ( let i = chain.length-1; i >= 1; --i ){
                    let boneIdx = chain[i]; // parent
                    let nextBoneIdx = chain[i-1]; // child
                    let boneSize = positions[ boneIdx ].distanceTo( positions[ nextBoneIdx ] );

                    let tp = targetPositions[ boneIdx ];
                    tp.copy( currTargetPoint );

                    // compute new distance vector movedPoint --> next Unmoved Joint
                    currTargetPoint.sub( targetPositions[ nextBoneIdx] );
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
                    let wToL = bones[ boneIdx ].matrixWorld.clone();
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



    // -------------------- HINGE -------------------- 
    /*__fixHingeConstraints ( constraint ){
        if( constraint.axis ){
            if ( constraint.axis.isVector3 ){
                __vec3_1.copy( constraint.axis );
            }else{
                __vec3_1.set( constraint.axis[0], constraint.axis[1], constraint.axis[2] );
            }
            __vec3_1.normalize();
            constraint.axis = __vec3_1.clone();
            
            // set right axis, to compute angle
            __vec3_1.set( 0,0,1 );
            let dot = constraint.axis.dot( __vec3_1 ); 
            if ( dot > 0.9999 ){ __vec3_1.set( 1,0,0 ); } // axis is +z, right will be +x
            if ( dot < -0.9999 ){ __vec3_1.set( -1,0,0 ); } // axis is -z, right will be -x
            else{ 
                __vec3_2.set( 0,1,0 ); // up
                __vec3_1.crossVectors( __vec3_2, constraint.axis );
                __vec3_1.normalize();
            }
            constraint.right = __vec3_1.clone();
        }
        if ( constraint.min ){ constraint.min = constraint.min % (Math.PI*2); if ( constraint.min < 0 ){ constraint.min += Math.PI*2; } }
        if ( constraint.max ){ constraint.max = constraint.max % (Math.PI*2); if ( constraint.max < 0 ){ constraint.max += Math.PI*2; } }
        return constraint;
    }

    __hinge( position, constraint ){
        if ( !constraint.axis ){ return; }

        __vec3_1.copy( constraint.axis );

        let dot = __vec3_1.dot( position );
        if ( dot < -0.9999 && dot > 0.9999 ){ position.copy( constraint.right ); } // position parallel to rotation axis
        else{ position.sub( __vec3_1.multiplyScalar( dot ) ); } // project

        if ( isNaN(constraint.min) || isNaN(constraint.max) ){ return; }

        
        //TODO:  can be optimized to no use any angle, but cos and sin instead

        let angle = constraint.right.angleTo(position); // [0,180]
        
        // fix angle range from [0,180] to [0,360]
        __vec3_2.crossVectors( constraint.right, position );        
        if (__vec3_2.dot( constraint.axis ) < 0){ angle = -angle + Math.PI*2; }
        
        angle = _constraintAngle( angle, constraint.min, constraint.max );
        position.copy( constraint.right );
        position.applyAxisAngle( constraint.axis, angle );
    }
    */

    // -------------------- BALL SOCKET -------------------- 

    /* // without azimuth. Probably faster 
    __fixBallSocketConstraints ( constraint ){
        // range [0-180]
        if ( constraint.min ){ constraint.min = constraint.min % (Math.PI); if ( constraint.min < 0 ){ constraint.min += Math.PI*2; } }
        if ( constraint.max ){ constraint.max = constraint.max % (Math.PI); if ( constraint.max < 0 ){ constraint.max += Math.PI*2; } }
    }

    __ballSocket ( position, constraint ){
    
        let front = __vec3_1; front.set( 0,0,1 );
        let dot = front.dot( position );

        position.sub( front.multiplyScalar( dot ) );
        position.normalize();

        let min = Math.cos( constraint.min ); 
        let max = Math.cos( constraint.max ); 
        if ( min > dot ){ dot = min; }
        if ( max < dot ){ dot = max; }

        let sin = Math.sqrt( 1 - dot * dot ); // 1 = sin^2 + cos^2
        position.multiplyScalar( sin );
    }*/


    // -------------------- SPHERICAL COORDINATES -------------------- 
/*
    __fixBallSocketConstraints ( constraint ){
        if ( constraint.polar ){ // POLAR range [0-180]
            constraint.polar[0] = Math.max(0, Math.min( Math.PI, constraint.polar[0] ) );
            constraint.polar[1] = Math.max( constraint.polar[0], Math.max(0, Math.min( Math.PI, constraint.polar[1] ) ) );
        }
        if ( constraint.azimuth ){ 
            constraint.azimuth[0] = constraint.azimuth[0] % (Math.PI*2); if ( constraint.azimuth[0] < 0 ){ constraint.azimuth[0] += Math.PI*2; } 
            constraint.azimuth[1] = constraint.azimuth[1] % (Math.PI*2); if ( constraint.azimuth[1] < 0 ){ constraint.azimuth[1] += Math.PI*2; } 
        }

        // fix axis
        if ( !constraint.axis ){ __vec3_1.set(0,0,1); }// same direction as bone
        else if ( constraint.axis.isVector3 ){ __vec3_1.copy( constraint.axis ); }
        else{ __vec3_1.set( constraint.axis[0], constraint.axis[1], constraint.axis[2] ); }
        __vec3_1.normalize();
        if ( __vec3_1.lengthSq < 0.00001 ){ __vec3_1.set(0,0,1); }
        constraint.axis = __vec3_1.clone(); // front axis
        
        // compute right axis ( X = cross(Y,Z) ) check front axis is not Y
        __vec3_1.set( 0,1,0 );
        let dot = constraint.axis.dot( __vec3_1 ); 
        if ( dot > 0.9999 || dot < -0.9999 ){ __vec3_1.set( 1,0,0 ); } // axis is y, right will be +x
        else{ 
            __vec3_2.set( 0,1,0 ); // up
            __vec3_1.crossVectors( __vec3_2, constraint.axis ); // cross( Y, Z )
            __vec3_1.normalize(); // X axis
        }

        constraint.right = __vec3_1.clone(); // right axis
        constraint.up = new THREE.Vector3();
        constraint.up.crossVectors( constraint.axis, constraint.right ); // Y = cross( Z, X )
        constraint.up.normalize();
        
    }

    // spherical coords
    __ballSocket ( position, constraint ){

        if ( !constraint.polar && !constraint.azimuth ){ return; }
        let swingPolarAngle = 0;
        let swingAzimuthAngle = 0; // XY plane where +X is 0º
        
        let front = constraint.axis;
        let right = constraint.right;
        let up = constraint.up
        let xy = __vec3_3; 
        xy.copy( front );
        xy.subVectors( position, xy.multiplyScalar( front.dot(position) ) ); // rejection of position


        // compute polar and azimuth angles
        swingPolarAngle = front.angleTo( position );
        swingAzimuthAngle = right.angleTo( xy );
        if( up.dot( xy ) < 0 ){ swingAzimuthAngle = -swingAzimuthAngle + Math.PI*2;}

        // constrain angles
        if ( constraint.polar ){ swingPolarAngle = _constraintAngle( swingPolarAngle, constraint.polar[0], constraint.polar[1] );           }
        if ( constraint.azimuth ){ swingAzimuthAngle = _constraintAngle( swingAzimuthAngle, constraint.azimuth[0], constraint.azimuth[1] ); }

        // regenerate point with fixed angles
        position.set( right.x, right.y, right.z );
        position.applyAxisAngle( front, swingAzimuthAngle );
        __vec3_1.crossVectors( position, front );
        __vec3_1.normalize();
        position.applyAxisAngle( __vec3_1, Math.PI * 0.5 - swingPolarAngle );
    }
*/

};


/*class Joint {
    constructor(){
        this.type = FABRIKSolver.JOINTTYPES.OMNI;
        this.
    }
    changeConstraints ( constraints ){
        // actual TWIST constraint
        if( constraints.twist ){
            let twistAngle = 2* Math.acos( twist.w ); 
            let tempTwistAxis = _vec3_3;
            tempTwistAxis.set( twist.x, twist.y, twist.z );
            if ( tempTwistAxis.dot( bindTwistAxis ) < 0 ){ twistAngle = ( -twistAngle ) + Math.PI * 2; } // correct angle value as acos only returns 0-180

            twistAngle = _constraintAngle( twistAngle, constraint.twist[0], constraint.twist[1] );            
            twist.setFromAxisAngle( bindTwistAxis, twistAngle );
        }
    }
    applyConstraintSwing( position ){}
    applyConstraintTwist( twistQuat ){}
}
*/
class JointBallSocket {
    constructor(){
        this.type = FABRIKSolver.JOINTTYPES.BALLSOCKET;
        
        this.front = new THREE.Vector3(0,0,1); // axis on which it rotates
        this.up = new THREE.Vector3(0,1,0);
        this.right = new THREE.Vector3(1,0,0);

        this.polar = null; // [min, max] rads
        this.azimuth = null; // [min, max] rads
    }

    changeConstraints ( constraints ){

        this.polar = null;
        this.azimuth = null;

        if ( constraints.polar ){ // POLAR range [0-180]
            this.polar = [0, Math.PI]; 
            this.polar[0] = Math.max(0, Math.min( Math.PI, constraints.polar[0] ) );
            this.polar[1] = Math.max( this.polar[0], Math.max(0, Math.min( Math.PI, constraints.polar[1] ) ) );
        }
        if ( constraints.azimuth ){
            this.azimuth = [0, Math.PI*2]
            this.azimuth[0] = constraints.azimuth[0] % (Math.PI*2); 
            this.azimuth[1] = constraints.azimuth[1] % (Math.PI*2);
            if ( this.azimuth[0] < 0 ){ this.azimuth[0] += Math.PI*2; } 
            if ( this.azimuth[1] < 0 ){ this.azimuth[1] += Math.PI*2; } 
        }

        // fix axis
        if ( !constraints.axis ){ __vec3_1.set(0,0,1); }// same direction as bone
        else if ( constraints.axis.isVector3 ){ __vec3_1.copy( constraints.axis ); }
        else{ __vec3_1.set( constraints.axis[0], constraints.axis[1], constraints.axis[2] ); }
        
        if ( __vec3_1.lengthSq < 0.00001 ){ __vec3_1.set(0,0,1); }
        __vec3_1.normalize();
        this.front.copy( __vec3_1 ); // front axis
        
        // compute right axis ( X = cross(Y,Z) ) check front axis is not Y
        __vec3_1.set( 0,1,0 );
        let dot = this.front.dot( __vec3_1 ); 
        if ( dot > 0.9999 || dot < -0.9999 ){ __vec3_1.set( 1,0,0 ); } // axis is y, right will be +x
        else{ 
            __vec3_2.set( 0,1,0 ); // up
            __vec3_1.crossVectors( __vec3_2, this.front ); // cross( Y, Z )
            __vec3_1.normalize(); // X axis
        }

        this.right.copy( __vec3_1 ); // right axis
        this.up.crossVectors( this.front, this.right ); // Y = cross( Z, X )
        this.up.normalize();

    }

    // modifies position vector
    applyConstraintSwing( position ){
        if ( !this.polar && !this.azimuth ){ return; }
        let swingPolarAngle = 0;
        let swingAzimuthAngle = 0; // XY plane where +X is 0º
        
        let front = this.front;
        let right = this.right;
        let up = this.up
        let xy = __vec3_3; 
        xy.copy( front );
        xy.subVectors( position, xy.multiplyScalar( front.dot(position) ) ); // rejection of position


        // compute polar and azimuth angles
        swingPolarAngle = front.angleTo( position );
        swingAzimuthAngle = right.angleTo( xy );
        if( up.dot( xy ) < 0 ){ swingAzimuthAngle = -swingAzimuthAngle + Math.PI*2;}

        // constrain angles
        if ( this.polar ){ swingPolarAngle = _constraintAngle( swingPolarAngle, this.polar[0], this.polar[1] );           }
        if ( this.azimuth ){ swingAzimuthAngle = _constraintAngle( swingAzimuthAngle, this.azimuth[0], this.azimuth[1] ); }

        // regenerate point with fixed angles
        position.set( right.x, right.y, right.z );
        position.applyAxisAngle( front, swingAzimuthAngle );
        __vec3_1.crossVectors( position, front );
        __vec3_1.normalize();
        position.applyAxisAngle( __vec3_1, Math.PI * 0.5 - swingPolarAngle );
    }
}

class JointHinge {
    constructor(){
        this.type = FABRIKSolver.JOINTTYPES.HINGE;
        
        this.front = new THREE.Vector3(0,0,1); // axis on which it rotates
        this.right = new THREE.Vector3(1,0,0);

        this.angles = null; // [min,max] rads
    }

    changeConstraints ( constraints ){
        // fix axis
        if ( !constraints.axis ){ __vec3_1.set(0,0,1); }// same direction as bone
        else if ( constraints.axis.isVector3 ){ __vec3_1.copy( constraints.axis ); }
        else{ __vec3_1.set( constraints.axis[0], constraints.axis[1], constraints.axis[2] ); }
        
        if ( __vec3_1.lengthSq < 0.00001 ){ __vec3_1.set(0,0,1); }
        __vec3_1.normalize();
        this.front.copy( __vec3_1 ); // front axis
        
        // compute right axis ( X = cross(Y,Z) ) check front axis is not Y
        __vec3_1.set( 0,1,0 );
        let dot = this.front.dot( __vec3_1 ); 
        if ( dot > 0.9999 || dot < -0.9999 ){ __vec3_1.set( 1,0,0 ); } // axis is y, right will be +x
        else{ 
            __vec3_2.set( 0,1,0 ); // up
            __vec3_1.crossVectors( __vec3_2, this.front ); // cross( Y, Z )
            __vec3_1.normalize(); // X axis
        }

        this.right.copy( __vec3_1 ); // right axis

        this.angles = null;
        if ( !isNaN(constraints.min) &&  !isNaN(constraints.max) ){ 
            this.angles = [0,Math.PI*2];
            this.angles[0] = constraints.min % (Math.PI*2);
            this.angles[1] = constraints.max % (Math.PI*2); 
            if ( this.angles[0] < 0 ){ this.angles[0] += Math.PI*2; } 
            if ( this.angles[1] < 0 ){ this.angles[1] += Math.PI*2; } 
        }
    }

    // modifies position vector
    applyConstraintSwing( position ){
        __vec3_1.copy( this.front );

        let dot = __vec3_1.dot( position );
        if ( dot < -0.9999 && dot > 0.9999 ){ position.copy( this.right ); } // position parallel to rotation axis
        else{ position.sub( __vec3_1.multiplyScalar( dot ) ); } // project

        if ( !this.angles ){ return; }

        
        //TODO:  can be optimized to no use any angle, but cos and sin instead

        let angle = this.right.angleTo(position); // [0,180]
        
        // fix angle range from [0,180] to [0,360]
        __vec3_2.crossVectors( this.right, position );        
        if (__vec3_2.dot( this.front ) < 0){ angle = -angle + Math.PI*2; }
        
        angle = _constraintAngle( angle, this.angles[0], this.angles[1] );
        position.copy( this.right );
        position.applyAxisAngle( this.front, angle );
    }
}

FABRIKSolver.JOINTTYPES = { OMNI: 0, HINGE: 1, BALLSOCKET: 2 }; // omni is just the default no constrained joint


export{ FABRIKSolver };