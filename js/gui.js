import * as THREE from 'three';
import {FABRIKSolver} from './IKSolver.js'
class GUI {

    constructor(editor) {
       
        this.editor = editor;
        this.showSkeleton = true;
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
        
        widgets.on_refresh = () => {
            
            widgets.clear();
            //Character Selector
            widgets.addSection("Character", { pretitle: makePretitle('stickman') });
            widgets.addCombo("Model",  this.editor.currentModel.name, { values : this.editor.modelsNames, callback: (v) => {
                this.editor.changeCurrentModel(v);
                this.showSkeleton = true;
                widgets.refresh();
            }});

            widgets.addCheckbox("Show skeleton", this.showSkeleton, {callback: v => {
                this.showSkeleton = v;
                this.editor.currentModel.skeletonHelper.visible = v;
                this.editor.gizmo.setVisibility(v);
            }})
            //Solver Selector
            widgets.addSection("Solver", { pretitle: makePretitle('gizmo') });
            widgets.addCombo("Solver",  this.editor.solver, { values : this.editor.solvers, callback: (v) => {
                this.editor.solver = v;
                widgets.refresh();
            }});

            //Chains
             widgets.addSection("Chains", {});
            
            /*----------------------------------------------- IK Solver Inspector -----------------------------------------------*/
            let chains = this.editor.currentModel.chains;
            for(let i = 0; i < chains.length; i++){
                widgets.addTitle(chains[i].name, {});
                
                let bones = this.editor.currentModel.skeleton.bones;
                for(let j = chains[i].bones.length - 1; j >= 0; j--){
                    widgets.addInfo("Bone", bones[chains[i].bones[j]].name);
                    widgets.widgets_per_row = 1;
                    let constraint = chains[i].constraints[j];
                    if(constraint) {
                        let types = Object.keys(FABRIKSolver.JOINTTYPES);
                        widgets.addString("Constraint type", types[constraint.type], {disabled: true});

                        for(let c in constraint) {
                            if(c == "type") 
                                continue;
                            widgets.addDefault(c, constraint[c], v=>{
                                if ( v.length > 0 ){
                                    for ( let k = 0; k < v.length; ++k ){ constraint[c][k] = v[k]; }
                                }else{ constraint[c] = v; }
                                this.editor.currentModel.FABRIKSolver.setConstraintToBone( chains[i].name, j, constraint ); 
                                this.editor.currentModel.CCDIKSolver.setConstraintToBone( chains[i].name, j, constraint ); 
                            });
                            chains[i].constraints[j] = constraint;
                        }
                        widgets.addButton(null, "Remove constraint", { callback: v => {

                            this.editor.currentModel.FABRIKSolver.setConstraintToBone( chains[i].name, j, null );
                            this.editor.currentModel.CCDIKSolver.setConstraintToBone( chains[i].name, j, null );
                            chains[i].constraints[j] = null;
                            widgets.refresh();
                        }})
                    }else{
                        widgets.addButton(null, "Add constraint", { callback: v => {
                            this.createIKSolverConstraintDialog(i, j, bones[chains[i].bones[j]].name, widgets.refresh.bind(widgets));
                        }})
                    }
                    widgets.addSeparator();    
                }
                let rBtn = widgets.addButton(null, "Delete chain", { callback: v => {
                    this.editor.removeChain(this.editor.currentModel, chains[i].name);
                    widgets.refresh();
                }})
                rBtn.getElementsByTagName("button")[0].style["background-color"] =  "indianred";
                widgets.addSeparator();
            }
        

            /** Add new chain */
            widgets.addTitle("New chain");
            
            widgets.addString("Name", newChain.name, {required: true, callback: (v) => {
                newChain.name = v;
            }});
            
            widgets.widgets_per_row = 2;
            
            let origin = newChain.origin == null? null: this.editor.currentModel.skeleton.bones[newChain.origin].name
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
            
            let endEffector = newChain.endEffector == null? null: this.editor.currentModel.skeleton.bones[newChain.endEffector].name
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
                this.editor.addChain(this.editor.currentModel, newChain,widgets.refresh.bind(widgets) );
                
            }})
            btn.getElementsByTagName("button")[0].style["background-color"] =  "cadetblue";
        }
        widgets.on_refresh(options);
        
        // update scroll position
        var element = root.content.querySelectorAll(".inspector")[0];
        var maxScroll = element.scrollHeight;
        element.scrollTop = options.maxScroll ? maxScroll : (options.scroll ? options.scroll : 0);
    }

    createIKSolverConstraintDialog(chainIdx, chainBoneIdx, boneName, callback = null) {

        let inspector = new LiteGUI.Inspector();
        inspector.addTitle(boneName);
        let types = Object.keys(FABRIKSolver.JOINTTYPES);
        let constraint = {
            type: FABRIKSolver.JOINTTYPES.OMNI,
            omni: {
                type: FABRIKSolver.JOINTTYPES.OMNI,
                twist:[0,Math.PI]
            },
            hinge: {
                type: FABRIKSolver.JOINTTYPES.HINGE,
                twist:[ 0, 0.0001 ], 
                axis:[1,0,0], 
                min: Math.PI, 
                max: Math.PI * 1.8 
            },
            ballsocket: {
                type: FABRIKSolver.JOINTTYPES.BALLSOCKET,
                twist: [ -Math.PI*0.25, Math.PI*0.25 ],
                axis: [0,0,1], 
                polar:[0, Math.PI*0.45],
                azimuth: [0,Math.PI*0.5],
            }
        };
        inspector.on_refresh = (o) => {
            inspector.clear();
            inspector.widgets_per_row = 1;
            inspector.addCombo("Constraint type", types[constraint.type], {values: types, callback: v => {
                constraint.type = FABRIKSolver.JOINTTYPES[v];
                inspector.refresh();
            }});

            let constraintsAttributes = null;
            if(constraint.type == FABRIKSolver.JOINTTYPES.HINGE ) {
                constraintsAttributes = constraint.hinge;
            }
            else if (constraint.type == FABRIKSolver.JOINTTYPES.BALLSOCKET) {
                constraintsAttributes = constraint.ballsocket;
            }
            else {
                constraintsAttributes = constraint.omni;
            }
            for(let i in constraintsAttributes) {
                if(i == 'type')
                    continue;
                inspector.addDefault(i, constraintsAttributes[i], {callback: v => {
                    constraintsAttributes[i] = v;
                } });
            }
            inspector.widgets_per_row = 2;
            inspector.addButton(null, "Add", { callback: v => {
                let newConstraint = null;
                //add constraint to the chain               
                if(constraint.type == FABRIKSolver.JOINTTYPES.HINGE) {
                    newConstraint = constraint.hinge;
                }
                else if ( constraint.type == FABRIKSolver.JOINTTYPES.BALLSOCKET ){
                    newConstraint = constraint.ballsocket;
                }
                else {
                    newConstraint = constraint.omni;
                }
                this.editor.currentModel.chains[chainIdx].constraints[chainBoneIdx] = newConstraint;
                this.editor.currentModel.FABRIKSolver.setConstraintToBone( this.editor.currentModel.FABRIKSolver.chains[chainIdx].name, chainBoneIdx, newConstraint);
                this.editor.currentModel.CCDIKSolver.setConstraintToBone( this.editor.currentModel.CCDIKSolver.chains[chainIdx].name, chainBoneIdx, newConstraint);
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