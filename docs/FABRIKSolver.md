# FABRIKSolver - ThreeJs
A solver for IK with FABRIK Algorithm for ThreeJs

```javascript
function

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
- newConstraints : (array or null) list of the same lenght as newChain containing an object for each bone in the chain with its constraints. All *null*s will be considered as unconstrained.
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


