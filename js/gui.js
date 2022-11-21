import * as THREE from 'three';
import {FABRIKSolver} from './IKSolver.js'
class GUI {

    constructor(editor) {
       
        this.editor = editor;
        this.boneProperties = {};
        this.textInfo = document.getElementById("info");
        this.create();
    }
    create() {
        
        LiteGUI.init(); 
  
        // Create main area
        this.mainArea = new LiteGUI.Area({id: "mainarea", content_id:"canvasarea", height: "calc( 100% - 31px )", main: true});
        LiteGUI.add( this.mainArea );
        
        this.mainArea.onresize = window.onresize;
        
        this.createSidePanel()
       
    }

    createSidePanel() {

        this.mainArea.split("horizontal", [null,"300px"], true);
        var docked = new LiteGUI.Panel("sidePanel", {title: 'Inverse Kinematics', scroll: true, height:'100vh'});
        this.mainArea.getSection(1).add( docked );
        $(docked).bind("closed", function() { this.mainArea.merge(); });
        this.sidePanel = docked;
        
        docked.content.id = "main-inspector-content";
        docked.content.style.width = "100%";

        this.resize();
    }

    updateSidePanel(root = this.sidePanel, options = {}) {
        if(!this.editor.currentModel.selectedChain) {
            let c = Object.keys(this.editor.currentModel.chains);
            if(c.length)
                this.editor.setSelectedChain(c[0]);
        }
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
            widgets.widgets_per_row = 1;
            //Character Selector
            widgets.addSection("Character", { pretitle: makePretitle('stickman') });
            widgets.addCombo("Model",  this.editor.currentModel.name, { values : this.editor.modelsNames, callback: (v) => {
                this.editor.changeCurrentModel(v);
                widgets.refresh();
            }});

            widgets.addCheckbox("Show skeleton", this.editor.ikHelper.visible, {callback: v => {
                this.editor.ikHelper.setVisibility(v);
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
            let names = Object.keys(chains);
            widgets.addCombo("Current chain", this.editor.currentModel.selectedChain, {values: names, callback: v => {
                this.editor.setSelectedChain(v);
                widgets.refresh();
            }})
            // for(let i in chains){
                let chain = chains[this.editor.currentModel.selectedChain];
                if(chain) {
                        
                    widgets.addTitle(chain.name, {});
                    
                    let bones = this.editor.currentModel.skeleton.bones;
                    for(let j = chain.bones.length - 1; j >= 0; j--){
                        widgets.addInfo("Bone", bones[chain.bones[j]].name);
                        widgets.widgets_per_row = 1;
                        let constraint = chain.constraints[j];
                        if(constraint) {
                            let types = Object.keys(FABRIKSolver.JOINTTYPES);
                            widgets.addString("Constraint type", types[constraint.type], {disabled: true});

                            for(let c in constraint) {
                                
                                if(c == "type") 
                                    continue;
                                else if(c == 'min' || c == 'max') {
                                    widgets.addNumber(c, constraint[c]*180/Math.PI, {min: -360, max : 360, callback: v => {
                                        constraint[c] = v*Math.PI/180;
                                        this.editor.updateConstraint( chain.name, j, constraint );

                                    }});
                                    chain.constraints[j] = constraint;
                                    continue;
                                }
                                else if(c == 'twist' || c == 'polar' || c == 'azimuth') {
                                    let values = [constraint[c][0]*180/Math.PI, constraint[c][1]*180/Math.PI];
                                    widgets.addVector2(c, values, {min: c == 'polar' ? 0 : -360, max: c == 'polar' ? 180 : 360, callback: v => {
                                        constraint[c][0] = v[0]*Math.PI/180;
                                        constraint[c][1] = v[1]*Math.PI/180;
                                        this.editor.updateConstraint( chain.name, j, constraint );

                                    }});
                                    chain.constraints[j] = constraint;
                                    continue;
                                }
                                widgets.addDefault(c, constraint[c], v=>{
                                    if ( v.length > 0 ){
                                        for ( let k = 0; k < v.length; ++k ){ constraint[c][k] = v[k]; }
                                    }else
                                    { 
                                        constraint[c] = v; 
                                    }
                                    this.editor.updateConstraint( chain.name, j, constraint );
                                });
                                chain.constraints[j] = constraint;
                            }
                            widgets.addButton(null, "Remove constraint", { callback: v => {

                                this.editor.updateConstraint( chain.name, j, null );
                                
                                chain.constraints[j] = null;
                                
                                widgets.refresh();
                            }})
                        }else{
                            if(j > 0){
                                widgets.addButton(null, "Add constraint", { callback: v => {
                                    this.createConstraintDialog(chain.name, j, bones[chain.bones[j]].name, widgets.refresh.bind(widgets));
                                }})
                            }
                        }
                        widgets.addSeparator();    

                    }
                    let rBtn = widgets.addButton(null, "Delete chain", { callback: v => {
                        this.editor.removeChain(chain.name);
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
            
            //Select origin bone
            let origin = newChain.origin == null ? null: this.editor.currentModel.skeleton.bones[newChain.origin].name
            widgets.addString("Origin bone", origin, { width: '80%', disabled: true})
            widgets.addButton(null, "+", {title: "From selected", width: '10%', micro: true, callback: v => {
                newChain.origin = this.editor.ikHelper.selectedBone;
                widgets.refresh();
            }});
            widgets.addButton(null, "<img src='./data/imgs/mini-icon-trash.png'/>", {width: '10%', micro: true, callback: v => {
                newChain.origin = "";
                widgets.refresh();
            }});
            
            //Select end effector bone
            let endEffector = newChain.endEffector == null? null: this.editor.currentModel.skeleton.bones[newChain.endEffector].name
            widgets.widgets_per_row = 2;
            widgets.addString("End-effector bone", endEffector, {  width: '80%', disabled: true});
            widgets.addButton(null, "+", {title: "From selected", width: '10%', micro: true, callback: v => {
                newChain.endEffector = this.editor.ikHelper.selectedBone;
                widgets.refresh();
            }});
            widgets.addButton(null, "<img src='./data/imgs/mini-icon-trash.png'/>", { width: '10%', micro: true, callback: v => {
                newChain.endEffector = "";
                widgets.refresh();
            }});
            widgets.widgets_per_row = 1;
            
            widgets.addCheckbox("Auto target", !newChain.target, { callback: v => {
                newChain.target = !v;
                widgets.refresh();
            }});

            if(newChain.target) {
                widgets.widgets_per_row = 2;
                widgets.addString("Target", newChain.target == true ? null : newChain.target, {  width: '80%', disabled: true});
                widgets.addButton(null, "+", {title: "From selected", width: '10%', micro: true, callback: v => {
                    newChain.target = this.editor.scene.getObjectByName("control"+this.editor.currentModel.selectedChain).children[0].object.name;
                    widgets.refresh();
                }});
            }

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
                this.editor.addChain(this.editor.currentModel, newChain, widgets.refresh.bind(widgets) );
                
            }})
            btn.getElementsByTagName("button")[0].style["background-color"] =  "cadetblue";
        }
        widgets.on_refresh(options);
        
        // update scroll position
        var element = root.content.querySelectorAll(".inspector")[0];
        var maxScroll = element.scrollHeight;
        element.scrollTop = options.maxScroll ? maxScroll : (options.scroll ? options.scroll : 0);
    }

    createConstraintDialog(chainName, chainBoneIdx, boneName, callback = null) {

        let d = document.getElementById("dialog");
        if(d)
            d.parentElement.removeChild(d);

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
                else if(i == 'min' || i == 'max') {
                    inspector.addNumber(i, constraintsAttributes[i]*180/Math.PI, {min: -360, max : 360, callback: v => {
                        constraintsAttributes[i] = v*Math.PI/180;
                        
                    }});
                }
                else if(i == 'twist' || i == 'polar' || i == 'azimuth') {
                    let values = [constraintsAttributes[i][0]*180/Math.PI, constraintsAttributes[i][1]*180/Math.PI];
                    inspector.addVector2(i, values, {min: i == 'polar' ? 0 : -360, max: i == 'polar' ? 180 : 360, callback: v => {
                        constraintsAttributes[i][0] = v[0]*Math.PI/180;
                        constraintsAttributes[i][1] = v[1]*Math.PI/180;
                        
                    }});
                }
                else {
                    inspector.addDefault(i, constraintsAttributes[i], {callback: v => {
                        constraintsAttributes[i] = v;
                    } });
                }
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
                this.editor.currentModel.chains[chainName].constraints[chainBoneIdx] = newConstraint;
                this.editor.addConstraint(chainName, chainBoneIdx, newConstraint )
                
                dialog.close();
                if(callback)
                    callback();
            }});
            inspector.addButton(null, "Cancel", { callback: v => {
                dialog.close();
            }});
        }
        inspector.on_refresh();
        let dialog = new LiteGUI.Dialog({id: "dialog", title: boneName +" constraints", close: true, draggable: true});
        dialog.add(inspector);
        dialog.show();
    }

    setTextInfo(text) {
        this.textInfo.innerText = text;
    }

    resize() {
      
       
    }


}


export { GUI };