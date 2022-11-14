import * as THREE from 'three';
import {FABRIKSolver} from './FABRIKSolver.js'
class GUI {

    constructor(editor) {
       
        this.editor = editor;

        this.boneProperties = {};
        this.create();
    }
    create() {
        
        LiteGUI.init(); 
        
        // Create menu bar
        // this.createMenubar();
        
        // Create main area
        this.mainArea = new LiteGUI.Area({id: "mainarea", content_id:"canvasarea", height: "calc( 100% - 31px )", main: true});
        LiteGUI.add( this.mainArea );
        
        this.mainArea.onresize = window.onresize;
       
        
        this.createSidePanel()
       
    }

    createSidePanel() {

        this.mainArea.split("horizontal", [null,"300px"], true);
        var docked = new LiteGUI.Panel("sidePanel", {title: 'Inverse Kinematics', scroll: true});
        // docked.content = this.datGUI.domElement
        this.mainArea.getSection(1).add( docked );
        $(docked).bind("closed", function() { this.mainArea.merge(); });
        this.sidePanel = docked;
        
        
        docked.content.id = "main-inspector-content";
        docked.content.style.width = "100%";

        this.resize();
    }

    updateSidePanel(root = this.sidePanel, options = {}) {

        let newChain = {
            name: "",
            origin: null,
            endEffector: null,
            target: null
        };

        // Editor widgets 
        var widgets = new LiteGUI.Inspector();
        root.content.replaceChildren();
        $(root.content).append(widgets.root);
        const makePretitle = (src) => { return "<img src='data/imgs/mini-icon-"+src+".png' style='margin-right: 4px;margin-top: 6px;'>"; }
        
        widgets.on_refresh = (o) => {
            o = o || {};
            widgets.clear();
            //Character Selector
            widgets.addSection("Character", { pretitle: makePretitle('stickman') });
            widgets.addCombo("Model",  this.editor.currentModel, { values : this.editor.models, callback: (v) => {
                this.editor.currentModel = v;
                this.editor.initCharacter();
            }});

            //Solver Selector
            widgets.addSection("Solver", { pretitle: makePretitle('gizmo') });
            widgets.addCombo("Solver",  this.editor.solver, { values : this.editor.solvers, callback: (v) => {
                // if(v == "MIX") {
                //     this.editor.initFabrik(false);
                // }
                // else if(v == "FABRIK") {
                //     this.editor.initFabrik(true);
                // }
                this.editor.solver = v;
                widgets.refresh();
            }});

            //Chains
            let chains = widgets.addSection("Chains", {});
            
            /*----------------------------------------------- CCDIK Inspector -----------------------------------------------*/
            if(this.editor.solver == "CCDIK") {

                for(let i = 0; i < this.editor.chains.length; i++){
                    widgets.addTitle(this.editor.chains[i].name, {width:'50%'});
                    
                    let bones = this.editor.skeleton.bones;
                    for(let j = 0; j < this.editor.chains[i].links.length; j++){
                        widgets.addInfo("Bone", bones[this.editor.chains[i].links[j].index].name);
                        widgets.widgets_per_row = 3;
                        widgets.addCheckbox("limitX", this.editor.chains[i].links[j].limitX, {width: '100%', callback: (v) => { 
                                if(!v){ 
                                    this.editor.chains[i].links[j].rotationMin.x = -2*Math.PI
                                    this.editor.chains[i].links[j].rotationMax.x = 2*Math.PI
                                }
                        }});
                        widgets.addCheckbox("limitY", this.editor.chains[i].links[j].limitY, {width: '100%', callback: (v) => { 
                            if(!v){ 
                                this.editor.chains[i].links[j].rotationMin.y = -2*Math.PI
                                this.editor.chains[i].links[j].rotationMax.y = 2*Math.PI
                            }}
                        });
                        widgets.addCheckbox("limitZ", this.editor.chains[i].links[j].limitZ, {width: '100%', callback: (v) => { 
                            if(!v){ 
                                this.editor.chains[i].links[j].rotationMin.z = -2*Math.PI
                                this.editor.chains[i].links[j].rotationMax.z = 2*Math.PI
                            }}
                        });
                        widgets.widgets_per_row = 1;
                        if(this.editor.chains[i].links[j].rotationMin) {
                            let rotMin =  [this.editor.chains[i].links[j].rotationMin.x, this.editor.chains[i].links[j].rotationMin.y, this.editor.chains[i].links[j].rotationMin.z];
                            widgets.addVector3("Rotation min", rotMin, {min: -2*Math.PI, max: 2*Math.PI, callback:
                                value => {
                                    let v = this.editor.chains[i].links[j];
                                    if(v.limitX) {
                                        this.editor.chains[i].links[j].rotationMin.x = value[0];
                                        this.editor.CCDIKSolver.iks[i].links[j].rotationMin.x = value[0];
                                    }
                                    if(v.limitY) {
                                        this.editor.chains[i].links[j].rotationMin.y = value[1];
                                        this.editor.CCDIKSolver.iks[i].links[j].rotationMin.y = value[1];
                                    }
                                    if(v.limitZ) {
                                        this.editor.chains[i].links[j].rotationMin.z = value[2];
                                        this.editor.CCDIKSolver.iks[i].links[j].rotationMin.z = value[2];
                                    }
                                }
                            }); 
                        }
                        else{
                            widgets.addButton(null, "Add minimum rotation", {callback: v => {

                                this.editor.chains[i].links[j].rotationMin = new THREE.Vector3(-2*Math.PI,   -2*Math.PI,   -2*Math.PI );
                                this.editor.CCDIKSolver.iks[i].links[j].rotationMin = new THREE.Vector3(-2*Math.PI,   -2*Math.PI,   -2*Math.PI );
                                widgets.refresh();
                            }})
                        }
                        if(this.editor.chains[i].links[j].rotationMax)
                        {                   
                            let rotMax =  [this.editor.chains[i].links[j].rotationMax.x, this.editor.chains[i].links[j].rotationMax.y, this.editor.chains[i].links[j].rotationMax.z];
                            widgets.addVector3("Rotation max", this.editor.chains[i].links[j].rotationMax, {min: -2*Math.PI, max: 2*Math.PI, callback:
                                value => {
                                    let v = this.editor.chains[i].links[j];
                                    if(v.limitX){
                                        this.editor.chains[i].links[j].rotationMax.x = value[0];
                                        this.editor.CCDIKSolver.iks[i].links[j].rotationMax.x = value[0];
                                    }
                                    if(v.limitY) {
                                        this.editor.chains[i].links[j].rotationMax.y = value[1];
                                        this.editor.CCDIKSolver.iks[i].links[j].rotationMax.y = value[1];
                                    }
                                    if(v.limitZ) {
                                        this.editor.chains[i].links[j].rotationMax.z = value[2];                
                                        this.editor.CCDIKSolver.iks[i].links[j].rotationMax.z = value[2];                
                                    }
                                }
                            }); 
                            widgets.addSeparator();    
                        }
                        else {
                            widgets.addButton(null, "Add maximum rotation", {callback: v => {

                                this.editor.chains[i].links[j].rotationMax = new THREE.Vector3(2*Math.PI,   2*Math.PI,   2*Math.PI );
                                this.editor.CCDIKSolver.iks[i].links[j].rotationMax = new THREE.Vector3(2*Math.PI,   2*Math.PI,   2*Math.PI );
                                widgets.refresh();
                            }})
                        }

                        if(this.editor.chains[i].links[j].limitation){
                            let axis = this.editor.chains[i].links[j].limitation;
                            widgets.addVector3("Rotation axis", [axis.x, axis.y, axis.z], {callback: v => {
                                this.editor.chains[i].links[j].limitation.x = v[0];
                                this.editor.chains[i].links[j].limitation.y = v[1];
                                this.editor.chains[i].links[j].limitation.z = v[2];   
                                
                                this.editor.CCDIKSolver.iks[i].links[j].limitation.x = v[0];
                                this.editor.CCDIKSolver.iks[i].links[j].limitation.y = v[1];
                                this.editor.CCDIKSolver.iks[i].links[j].limitation.z = v[2];   
                            }})
                        }
                        else {
                            widgets.addButton(null, "Add rotation axis", {callback: v => {

                                this.editor.chains[i].links[j].limitation = new THREE.Vector3(1,0,0);
                                this.editor.CCDIKSolver.iks[i].links[j].limitation = new THREE.Vector3(1,0,0);
                                widgets.refresh();
                            }})
                        }
                    }
                    let rBtn = widgets.addButton(null, "Delete chain", { callback: v => {
                        this.editor.removeChain(this.editor.chains[i].name);
                        widgets.refresh();
                    }})
                    rBtn.getElementsByTagName("button")[0].style["background-color"] =  "indianred";
                    widgets.addSeparator();
                }
            }
            /*----------------------------------------------- FABRIK Inspector -----------------------------------------------*/
            else if(this.editor.solver == "FABRIK") {

                for(let i = 0; i < this.editor.fabrikChains.length; i++){
                    widgets.addTitle(this.editor.fabrikChains[i].name, {});
                    
                    let bones = this.editor.skeleton.bones;
                    for(let j = this.editor.fabrikChains[i].bones.length - 1; j >= 0; j--){
                        widgets.addInfo("Bone", bones[this.editor.fabrikChains[i].bones[j]].name);
                        widgets.widgets_per_row = 1;
                        let constraint = this.editor.fabrikChains[i].constraints[j];
                        if(constraint) {
                            let types = Object.keys(FABRIKSolver.JOINTTYPES);
                            widgets.addString("Constraint type", types[constraint.type - 1], {disabled: true});
                            for(let c in constraint) {
                                if(c == "type") 
                                    continue;
                                widgets.addDefault(c, constraint[c])
                            }
                            widgets.addButton(null, "Remove constraint", { callback: v => {
                                this.editor.fabrikChains[i].constraints[j] = null;
                                this.editor.FABRIKSolver.chains[i].constraints[j] = null;
                                widgets.refresh();
                            }})
                        }else{
                            widgets.addButton(null, "Add constraint", { callback: v => {
                                this.createFabrikConstraintDialog(i, j, bones[this.editor.fabrikChains[i].bones[j]].name, widgets.refresh.bind(widgets));
                            }})
                        }
                        widgets.addSeparator();    
                    }
                    let rBtn = widgets.addButton(null, "Delete chain", { callback: v => {
                        this.editor.removeChain(this.editor.chains[i].name);
                        widgets.refresh();
                    }})
                    rBtn.getElementsByTagName("button")[0].style["background-color"] =  "indianred";
                    widgets.addSeparator();
                }
            }

            /** Add new chain */
            widgets.addTitle("New chain");
            
            widgets.addString("Name", newChain.name, {required: true, callback: (v) => {
                newChain.name = v;
            }});
            
            widgets.widgets_per_row = 2;
            
            let origin = newChain.origin == null? null: this.editor.skeleton.bones[newChain.origin].name
            widgets.addString("Origin bone", origin, { width: '80%', disabled: true})
            widgets.addButton(null, "+", {title: "From selected", width: '10%', micro: true, callback: v => {
                newChain.origin = this.editor.gizmo.selectedBone;
                widgets.refresh();
            }})
            widgets.addButton(null, "<img src='./data/imgs/mini-icon-trash.png'/>", {width: '10%', micro: true, callback: v => {
                newChain.origin = "";
                widgets.refresh();
            }})
            // widgets.widgets_per_row = 1;
            // widgets.addButton(null, "From selected", {callback: v => {
            //     newChain.origin = this.editor.gizmo.selectedBone;
            //     widgets.refresh();
            // }})
            
            let endEffector = newChain.endEffector == null? null: this.editor.skeleton.bones[newChain.endEffector].name
            widgets.widgets_per_row = 2;
            widgets.addString("End-effector bone", endEffector, {  width: '80%', disabled: true});
            widgets.addButton(null, "+", {title: "From selected", width: '10%', micro: true, callback: v => {
                newChain.endEffector = this.editor.gizmo.selectedBone;
                widgets.refresh();
            }})
            widgets.addButton(null, "<img src='./data/imgs/mini-icon-trash.png'/>", { width: '10%', micro: true, callback: v => {
                newChain.endEffector = "";
                widgets.refresh();
            }})
            widgets.widgets_per_row = 1;
            // widgets.addButton(null, "From selected", {callback: v => {
            //     newChain.endEffector = this.editor.gizmo.selectedBone;
            //     widgets.refresh();
            // }})

            let btn = widgets.addButton(null, "Add chain", {id: "chain-btn", callback: v => {
                if(newChain.name == "") {
                    alert("Name required");
                    return;
                }
                if(newChain.origin == "") {
                    alert("Origin bone required");
                    return;
                }
                if(newChain.endEffector == "") {
                    alert("End effector bone required");
                    return;
                }
                this.editor.addChain(newChain,widgets.refresh.bind(widgets) );
             
            }})
            btn.getElementsByTagName("button")[0].style["background-color"] =  "cadetblue";
        }
        widgets.on_refresh(options);
        
        // update scroll position
        var element = root.content.querySelectorAll(".inspector")[0];
        var maxScroll = element.scrollHeight;
        element.scrollTop = options.maxScroll ? maxScroll : (options.scroll ? options.scroll : 0);
    }

    createFabrikConstraintDialog(chainIdx, chainBoneIdx, boneName, callback = null) {

        let inspector = new LiteGUI.Inspector();
        inspector.addTitle(boneName);
        let types = Object.keys(FABRIKSolver.JOINTTYPES);
        let constraint = {
            type: FABRIKSolver.JOINTTYPES.BALLSOCKET,
            ballsocket: {
                twist: [ -Math.PI*0.25, Math.PI*0.25 ], 
                polar:[0, Math.PI*0.45]
            },
            hinge: {
                twist:[ 0, 0.0001 ], 
                axis:[1,0,0], 
                min: Math.PI, 
                max: Math.PI * 1.8 
            }
        };
        inspector.on_refresh = (o) => {
            inspector.clear();
            inspector.widgets_per_row = 1;
            inspector.addCombo("Constraint type", types[constraint.type - 1], {values: types, callback: v => {
                constraint.type = FABRIKSolver.JOINTTYPES[v];
                inspector.refresh();
            }});

            if(constraint.type == FABRIKSolver.JOINTTYPES.HINGE ) {
                for(let i in constraint.hinge) {
                    inspector.addDefault(i, constraint.hinge[i], {callback: v => {
                        constraint.hinge[i] = v;
                    } })
                }
            }
            else {
                for(let i in constraint.ballsocket) {
                    inspector.addDefault(i, constraint.ballsocket[i], {callback: v => {
                        constraint.ballsocket[i] = v;
                    } })
                }
            }
            inspector.widgets_per_row = 2;
            inspector.addButton(null, "Add", { callback: v => {
                //add constraint to the chain               
                if(constraint.type == FABRIKSolver.JOINTTYPES.HINGE) {
                    constraint.hinge.type = constraint.type;
                    this.editor.fabrikChains[chainIdx].constraints[chainBoneIdx] = constraint.hinge;
                    this.editor.FABRIKSolver.chains[chainIdx].constraints[chainBoneIdx] = constraint.hinge;

                    //--TO DO-- call FABRIKSolver.fixConstrants  ---> create addConstraint on solver?
                }
                else {
                    constraint.hinge.type = constraint.type;
                    this.editor.fabrikChains[chainIdx].constraints[chainBoneIdx] = constraint.ballsocket;
                    this.editor.FABRIKSolver.chains[chainIdx].constraints[chainBoneIdx] = constraint.ballsocket;
                    //--TO DO-- call FABRIKSolver.fixConstrants  ---> create addConstraint on solver?
                }
                dialog.close();
                if(callback)
                    callback();
            }});
            inspector.addButton(null, "Cancel", { callback: v => {
                dialog.close();
            }});
        }
        inspector.on_refresh();
        let dialog = new LiteGUI.Dialog({title: "Bone constraints", close: true});
        dialog.add(inspector);
        dialog.show();
    }


    resize() {
      
       
    }


}


export { GUI };