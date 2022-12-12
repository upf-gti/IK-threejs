# IKHelper - ThreeJs
Shows the skeleton, joints and constraints associated to them in an instance of an [IKSolver](./IKSolver.md).


```javascript
import { FABRIKSolver, CCDIKSolver } from "IKSolver.js"
import { IKHelper } from "IKHelper.js"
let scene = new THREE.Scene();
// ... scene setup ...

let ikSolver = new FABRIKSolver( skeleton ); // could be CCDIKSoler also

let ikHelper = new IKHelper();
ikHelper.begin( ikSolver, scene );

ikHelper.setVisibilityFlags( IKHelper.VISIBILITYFLAGS.CONSTRAINTS | IKHelper.VISIBILITYFLAGS.SKELETON   );
ikHelper.setVisibility( true );

ikSolver.update();
ikHelper.update(); 
// ... render ...

// onDestroy
ikHelper.dispose();

```
# Static Members

## VISIBILITYFLAGS
Enumeration of types
- ```NONE``` : 0x00,
- ```ALL``` : 0xff,
- ```SKELETON``` : 0x01,
- ```BONEPOINTS``` : 0x02,
- ```CONSTRAINTS``` : 0x04,

Can be accessed from IKHelper class as 
- ```IKHelper.VISIBILITYFLAGS``` 

# Methods

## constructor()

---
## begin( ikSolver, scene )

Initialises the internal elements for the visualisation of the ikSolver 
WARNING: call dispose when finished using this instance

- ikSolver : (baseSolver) an instance of an ik solver (either FABRIKSolver or CCDIKSolver)
- scene : (Threejs.Scene) the scene where to include any visualisation object

---
## dispose ()

Frees al gpu memory and detaches internal objects from the Threejs scene

---
## update()

Updates bone points positions

---
## setVisibility( v )

Show/Hides elements (if enabled)

- v: (boolean)

---
## setVisibilityFlags( flags )

Sets which elements will be visible (when enabled by ```setVisibility```). 

- flags : (integer) Value that encodes which elements will be visible. Use [VISIBILITYFLAGS](#visibilityflags) to select which to enable. Use bitwise operations to stack multiple flags
```javascript
let flags = IKHelper.VISIBILITYFLAGS;

ikHelper.setVisibilityFlags( flags.CONSTRAINTS | flags.SKELETON ); //only constraints and bone lines will be visible

ikHelper.setVisibilityFlags( flags.BONEPOINTS ); //only joint points will be shown
```
---
## setVisualisationScale( v )

Makes constraints bigger/smaller

- v: (number)
