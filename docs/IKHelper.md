# IKSolver - ThreeJs
Inverse Kinematics Solvers implemented with FABRIK and CCD Algorithms for ThreeJs


```javascript
import { FABRIKSolver, CCDIKSolver } from "IKSolver.js"
import { IKHelper } from "IKHelper.js"
let scene = new THREE.Scene();
// ... scene setup ...

let ikSolver = new FABRIKSolver( skeleton );

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
- NONE : 0x00,
- ALL : 0xff,
- SKELETON : 0x01,
- BONEPOINTS : 0X02,
- CONSTRAINTS : 0X04,


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

Frees al gpu memory and detaches internal objects from the Threejs scen

---
## update()

Updates bone points positions

---
## setVisibility( v )

Show/Hides elements (if enabled)

- v: (boolean)

---
## setVisibilityFlags( flags )

Sets which elements will be visible (when enabled by setVisibility)

- flags : (integer) Bitwise value that encodes which elements will be visible. Use VISIBILITYFLAGS to select which to enable

---
## setVisualisationScale( v )

Makes constraints bigger/smaller

- v: (number)
