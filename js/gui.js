import * as THREE from 'three';
import {FABRIKSolver} from './IKSolver.js'
import {LX} from 'lexgui'

class GUI {

    constructor(editor) {
       
        this.editor = editor;
        this.boneProperties = {};
        this.textInfo = document.getElementById("info");
    }

    init() {
         
        // Create main area
        this.mainArea = LX.init();
        [this.canvasArea, this.sidePanelArea] = this.mainArea.split({sizes: ["80%", "20%"]});

        this.createSidePanel();
    }

    createSidePanel() {

        this.sidePanel = this.sidePanelArea.addPanel( {id: "main-inspector-content", title: 'Inverse Kinematics', scroll: true, width:"auto"} );
       
        this.sidePanel.root.style.zIndex = 1;
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
        const widgets = this.sidePanel;
        
        widgets.on_refresh = () => {
            
            widgets.clear();
            widgets.widgets_per_row = 1;
            //Character Selector
            widgets.branch("Character", { icon: "fa-solid fa-person" });
            widgets.addSelect("Model", this.editor.modelsNames, this.editor.currentModel.name, (v) => {
                this.editor.changeCurrentModel(v);
                widgets.on_refresh();
            });

            if(this.editor.currentModel.ikHelper) {
    
                widgets.addNumber("Helper size", this.editor.currentModel.ikHelper.visualisationScale, v => {
                    this.editor.currentModel.ikHelper.setVisualisationScale(v);
                });
            }

            //Solver Selector
            widgets.branch("Solver", { icon: "fa-brands fa-odnoklassniki" });
            widgets.addSelect("Solver", this.editor.solvers, this.editor.solver, (v) => {
                this.editor.solver = v;
                widgets.on_refresh();
            });

            //Chains
            widgets.branch("Chains", { icon: "fa-solid fa-circle-nodes",});
            /*----------------------------------------------- IK Solver Inspector -----------------------------------------------*/
            let chains = this.editor.currentModel.chains;
            let names = Object.keys(chains);
            widgets.addSelect("Current chain", names, this.editor.currentModel.selectedChain, v => {
                this.editor.setSelectedChain(v);
                widgets.on_refresh();
            })
            // for(let i in chains){
                let chain = chains[this.editor.currentModel.selectedChain];
                if(chain) {
                        
                    widgets.addTitle(chain.name, {});
                    
                    let bones = this.editor.currentModel.skeleton.bones;
                    for(let j = chain.bones.length - 1; j >= 0; j--){
                        widgets.addText("Bone", bones[chain.bones[j]].name, null, {disabled: true});
                        widgets.widgets_per_row = 1;
                        let constraint = chain.constraints[j];
                        if(constraint) {
                            let types = Object.keys(FABRIKSolver.JOINTTYPES);
                            widgets.addText("Constraint type", types[constraint.type], null, {disabled: true});

                            for(let c in constraint) {
                                
                                if(c == "type") 
                                    continue;
                                else if(c == 'min' || c == 'max') {
                                    widgets.addNumber(c, constraint[c]*180/Math.PI, v => {
                                        constraint[c] = v*Math.PI/180;
                                        this.editor.updateConstraint( chain.name, j, constraint );
                                    }, {min: -360, max : 360});
                                    chain.constraints[j] = constraint;
                                    continue;
                                }
                                else if(c == 'twist' || c == 'polar' || c == 'azimuth') {
                                    let values = [constraint[c][0]*180/Math.PI, constraint[c][1]*180/Math.PI];
                                    widgets.addVector2(c, values, v => {
                                        constraint[c][0] = v[0]*Math.PI/180;
                                        constraint[c][1] = v[1]*Math.PI/180;
                                        this.editor.updateConstraint( chain.name, j, constraint );

                                    }, {min: c == 'polar' ? 0 : -360, max: c == 'polar' ? 180 : 360});
                                    chain.constraints[j] = constraint;
                                    continue;
                                }
                                else if ( c == 'axis') {
                                    widgets.addVector3(c, constraint[c], v => {
                                        if ( v.length > 0 ){
                                            for ( let k = 0; k < v.length; ++k ){ constraint[c][k] = v[k]; }
                                        }else
                                        { 
                                            constraint[c] = v; 
                                        }
                                        this.editor.updateConstraint( chain.name, j, constraint ); 
                                    });
                                    chain.constraints[j] = constraint;
                                    continue;
                                }
                                widgets.addNumber(c, constraint[c], v=>{
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
                            widgets.addButton(null, "Remove constraint", v => {

                                this.editor.updateConstraint( chain.name, j, null );
                                
                                chain.constraints[j] = null;
                                
                                widgets.on_refresh();
                            })
                        }else{
                            if(j > 0){
                                widgets.addButton(null, "Add constraint",v => {
                                    this.createConstraintDialog(chain.name, j, bones[chain.bones[j]].name, widgets.on_refresh.bind(widgets));
                                })
                            }
                        }
                        widgets.addSeparator();    

                    }
                    let rBtn = widgets.addButton(null, "Delete chain", v => {
                        this.editor.removeChain(chain.name);
                        widgets.on_refresh();
                    })
                    rBtn.root.getElementsByTagName("button")[0].classList.add("selected");
                    rBtn.root.getElementsByTagName("button")[0].style.background =  "indianred";
                    widgets.addSeparator();
                }
            

            /** Add new chain */
            widgets.addTitle("New chain");
            
            widgets.addText("Name", newChain.name, (v) => {
                newChain.name = v;
            }, {required: true});
            
            widgets.sameLine(3);
            
            //Select origin bone
            let origin = newChain.origin == null ? null: this.editor.currentModel.skeleton.bones[newChain.origin].name
            widgets.addText("Origin bone", origin, null, { width: '80%', disabled: true})
            widgets.addButton(null, "+", v => {
                newChain.origin = this.editor.currentModel.ikHelper.selectedBone;
                widgets.on_refresh();
            }, {title: "From selected", width: '10%', micro: true,});
            widgets.addButton(null, '<i class="fa-solid fa-trash-can"></i>', v => {
                newChain.origin = "";
                widgets.on_refresh();
            }, {width: '10%', micro: true});
            
            //Select end effector bone
            let endEffector = newChain.endEffector == null? null: this.editor.currentModel.skeleton.bones[newChain.endEffector].name
            
            widgets.sameLine(3);
            widgets.addText("End-effector bone", endEffector, null, {  width: '80%', disabled: true});
            widgets.addButton(null, "+", v => {
                newChain.endEffector = this.editor.currentModel.ikHelper.selectedBone;
                widgets.on_refresh();
            }, {title: "From selected", width: '10%', micro: true});
            widgets.addButton(null, '<i class="fa-solid fa-trash-can"></i>', v => {
                newChain.endEffector = "";
                widgets.on_refresh();
            }, { width: '10%', micro: true});
            widgets.widgets_per_row = 1;
            
            widgets.addCheckbox("Auto target", !newChain.target, { callback: v => {
                newChain.target = !v;
                widgets.on_refresh();
            }});

            if(newChain.target) {
                widgets.sameLine(2);
                widgets.addText("Target", newChain.target == true ? null : newChain.target, null, {  width: '80%', disabled: true});
                widgets.addButton(null, "+", {title: "From selected", width: '10%', micro: true, callback: v => {
                    newChain.target = this.editor.scene.getObjectByName("control"+this.editor.currentModel.selectedChain).children[0].object.name;
                    widgets.on_refresh();
                }});
            }

            let btn = widgets.addButton(null, "Add chain", v => {
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
                this.editor.addChain(this.editor.currentModel, newChain, widgets.on_refresh.bind(widgets) );
                
            }, {id: "chain-btn"})
            btn.root.getElementsByTagName("button")[0].classList.add("selected");// =  "cadetblue";
        }
        widgets.on_refresh(options);
        
        // update scroll position
        var element = this.sidePanel.root
        var maxScroll = element.scrollHeight;
        element.scrollTop = options.maxScroll ? maxScroll : (options.scroll ? options.scroll : 0);
    }

    attachCanvas(element, app) {

        this.canvasArea.root.id = "canvasarea";
        this.canvasArea.attach( element );

        const canvasButtons = [
            {
                name: 'Grid',
                property: 'showGrid',
                icon: 'fa-solid fa-table-cells',
                selectable: true,
                selected: true,
                callback: (v, e) => {
                    app.grid.visible = !app.grid.visible;
                    app.orientationHelper.visible = !app.orientationHelper.visible; 
                }
            },
            {
                name: 'Skeleton',
                property: "showSkeleton",
                icon: 'fa-solid fa-bone',
                selectable: true,
                selected: true,
                callback: (v) => {
                    if(!app.currentModel.ikHelper) {
                        return;
                    }
                    app.currentModel.ikHelper.visible = !app.currentModel.ikHelper.visible;
                    app.currentModel.ikHelper.setVisibility(app.currentModel.ikHelper.visible);
                }
            },
            {
                title: "Change Theme",
                icon: "fa-solid fa-sun",
                swap: "fa-solid fa-moon",
                callback:  (swapValue) => { LX.setTheme( swapValue ? "light" : "dark" ) }
            }
    
        ]

        this.canvasArea.addOverlayButtons(canvasButtons, { float: "htc" } );

        return this.canvasArea;
    }

    createConstraintDialog(chainName, chainBoneIdx, boneName, callback = null) {

        
        let d = document.getElementById("dialog");
        if(d)
            d.parentElement.removeChild(d);

        // let inspector = new LiteGUI.Inspector();
        // inspector.addTitle(boneName);
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
        const dialog = new LX.Dialog( boneName +" constraints", p => {
            p.on_refresh = () => {
                p.clear();
                p.addSelect("Constraint type", types, types[constraint.type], v => {
                    constraint.type = FABRIKSolver.JOINTTYPES[v];
                    p.on_refresh(p);
                })

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
                        p.addNumber(i, constraintsAttributes[i]*180/Math.PI, v => {
                            constraintsAttributes[i] = v*Math.PI/180;  
                        }, {min: -360, max : 360});
                    }
                    else if(i == 'twist' || i == 'polar' || i == 'azimuth') {
                        let values = [constraintsAttributes[i][0]*180/Math.PI, constraintsAttributes[i][1]*180/Math.PI];
                        p.addVector2(i, values, v => {
                            constraintsAttributes[i][0] = v[0]*Math.PI/180;
                            constraintsAttributes[i][1] = v[1]*Math.PI/180;
                            
                        }, {min: i == 'polar' ? 0 : -360, max: i == 'polar' ? 180 : 360});
                    }
                    else if ( i == 'axis') {
                        p.addVector3(i, constraintsAttributes[i], v => {
                            constraintsAttributes[i] = v;   
                        });
                    }

                    else {
                        p.addNumber(i, constraintsAttributes[i], v => {
                            constraintsAttributes[i] = v;
                        });
                    }
                }
                // p.sameLine(2);
                p.addButton(null, "Add", v => {
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
                });
                // p.addButton(null, "Cancel", v => {
                //     dialog.close();
                // });
            }
            p.on_refresh();
        }, { width: "50%"})
    
        // let dialog = new LiteGUI.Dialog({id: "dialog", title: boneName +" constraints", close: true, draggable: true});
        // dialog.add(inspector);
        // dialog.show();
    }

    setTextInfo(text) {
        this.textInfo.innerText = text;
    }

    resize() {
       
    }


}


export { GUI };