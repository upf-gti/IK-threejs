# FABRIKSolver - ThreeJs
A solver for IK with FABRIK Algorithm for ThreeJs

```javascript
let scene = new THREE.Scene();
// ... scene setup ...

//load some skinned model, or generate a skeleton manually sopmehow
let model = loadModel()
let skeleton = model.getSkeleton() // returns Threejs Skeleton

let target = new THREE.Object3D();
target.position.set(0,0,1);
scene.add( target );

let ikSolver = new FABRIKSolver( skeleton );
ikSolver.setIterations( 1 );
ikSolver.setSquaredDistanceThreshold( 0.0001 );



ikSolver.createChain(
    [5,4,3,2,1,0],
    [ 
        null, // ignored always

        {type: FABRIKSolver.JOINTTYPES.OMNI, twist:[ 0, 0.0001 ] },   

        {type: FABRIKSolver.JOINTTYPES.HINGE, twist:[ 0, 0.0001 ], axis:[1,0,0], min: 0, max: Math.PI * 0.5 },   
        
        {type: FABRIKSolver.JOINTTYPES.HINGE, twist:[ 0, 0.0001 ], axis:[1,0,0] }, // unconstrained angle of hinge   
        
        {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, twist:[ -Math.PI*0.25, Math.PI*0.25 ], polar:[0, Math.PI*0.5], azimuth:[-Math.PI * 0.6, Math.PI*0.4]},

        {type: FABRIKSolver.JOINTTYPES.BALLSOCKET, twist:[ -Math.PI*0.25, Math.PI*0.25 ], polar:[0, Math.PI*0.5]} // unconstrained azimuth
    ],
    target,
    "MyChain"
);


ikSolver.update();

// ... render ...

target.position.set(1,0,0);
ikSolver.update();

// ... render ...

```

# Static Members

## JOINTTYPES
Enumeration of types
- OMNI: 0
- HINGE: 1
- BALLSOCKET: 2


# Methods

## constructor( skeleton )

- skeleton : (ThreeJs skeleton).

---
## setIterations( iterations )

Sets the amount of iterations to compute during update.

- iterations : (int).

---
## setSquaredDistanceThreshold( sqDist )

Sets the maximum squared distance to consider a certain effector as well positioned.

- sqDist : (number >= 0).

---
## createChain( newChain, newConstraints, targetObj, name )

Adds a new chain to the internal list. **Chains inserted last will have higher priority.**

- newChain : (array) ordered list of bone indices that constitute the chain. [ effector, parent, parent-parent, ... , root chain ]. 
- newConstraints : (array or null) list of the same lenght as newChain containing an object for each bone in the chain with its constraints. All *null*s will be considered as unconstrained. Effector does not have constraints, meaning the first entry will be ignored
- targetObj : (object) Target object to follow. Must either be an Object3D in the scene or an object with a 'position' property containing a Vector3
- name : (string).

---
## removeChain( name )

Removes the specified chain from the internal list if found.

- name : (string).

---
## removeAllChains( )

Removes all chains from this solver.

---
## getChain( name )

Searches for a chain named as name and returns its description.

- name : (string).

Returns an **object** if an existing chain is found, **null** otherwise.

---
## setConstraintToBone( chainName, idxBoneInChain, newConstraint )

Modifies a constraint of a bone in an existing chain.

- chainName : (string) Name of chain to fetch.
- idxBoneInChain : (int) Index in the chain array (not the actual bone number).
- newConstraint : (object) Object with all desired attributes for that constraint. See [JOINTTYPES Member](#jointtypes) and [Constraint Types](./Constraing%20Types.md).

Returns **true** if successful, **false** otherwise.

---
## update( )

Computes the FABRIK algorithm over all chains.

---


