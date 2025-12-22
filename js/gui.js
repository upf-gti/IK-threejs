import * as THREE from 'three';
import {FABRIKSolver} from './IKSolver.js';
import {LX} from 'lexgui';

LX.mainArea = await LX.init();

// fontawesome - person
LX.registerIcon("fwperson", `<svg viewBox="0 0 640 640"><path d="M376 88C376 57.1 350.9 32 320 32C289.1 32 264 57.1 264 88C264 118.9 289.1 144 320 144C350.9 144 376 118.9 376 88zM400 300.7L446.3 363.1C456.8 377.3 476.9 380.3 491.1 369.7C505.3 359.1 508.3 339.1 497.7 324.9L427.2 229.9C402 196 362.3 176 320 176C277.7 176 238 196 212.8 229.9L142.3 324.9C131.8 339.1 134.7 359.1 148.9 369.7C163.1 380.3 183.1 377.3 193.7 363.1L240 300.7L240 576C240 593.7 254.3 608 272 608C289.7 608 304 593.7 304 576L304 416C304 407.2 311.2 400 320 400C328.8 400 336 407.2 336 416L336 576C336 593.7 350.3 608 368 608C385.7 608 400 593.7 400 576L400 300.7z"/></svg>`)

//odnoklassniki
LX.registerIcon("odnoklassniki", `<svg fill="#000000" width="64px" height="64px" viewBox="0 0 512 512"><path style="display: inline;" d="M256.018,259.156c71.423,0,129.31-57.899,129.31-129.334C385.327,58.387,327.44,0.5,256.018,0.5 c-71.448,0-129.359,57.887-129.359,129.322C126.658,201.257,184.57,259.156,256.018,259.156z M256.018,66.196 c35.131,0,63.612,28.482,63.612,63.625c0,35.144-28.481,63.625-63.612,63.625c-35.168,0-63.638-28.481-63.638-63.625 C192.38,94.678,220.849,66.196,256.018,66.196z M405.075,274.938c-7.285-14.671-27.508-26.872-54.394-5.701 c-36.341,28.619-94.664,28.619-94.664,28.619s-58.361,0-94.702-28.619c-26.873-21.171-47.083-8.97-54.381,5.701 c-12.75,25.563,1.634,37.926,34.096,58.761c27.721,17.803,65.821,24.452,90.411,26.935l-20.535,20.535 c-28.918,28.905-56.826,56.838-76.201,76.213c-11.59,11.577-11.59,30.354,0,41.931l3.48,3.506c11.59,11.577,30.354,11.577,41.943,0 l76.201-76.214c28.943,28.919,56.851,56.839,76.225,76.214c11.59,11.577,30.354,11.577,41.943,0l3.48-3.506 c11.59-11.59,11.59-30.354,0-41.943l-76.201-76.2l-20.584-20.598c24.614-2.545,62.29-9.22,89.786-26.872 C403.441,312.863,417.801,300.5,405.075,274.938z"></path></svg>`);

class GUI {

    constructor(editor) {
       
        this.editor = editor;
        this.boneProperties = {};
        this.textInfo = document.getElementById("info");
    }

    init() {
         
        // Create main area
        this.mainArea = LX.mainArea;
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
        const panel = this.sidePanel;
        
        panel.on_refresh = () => {
            panel.clear();
            panel.widgets_per_row = 1;
            //Character Selector
            panel.branch("Character", { icon: "fwperson" });
            panel.addSelect("Model", this.editor.modelsNames, this.editor.currentModel.name, (v) => {
                this.editor.changeCurrentModel(v);
                panel.on_refresh();
            });

            if(this.editor.currentModel.ikHelper) {
    
                panel.addNumber("Helper size", this.editor.currentModel.ikHelper.visualisationScale, v => {
                    this.editor.currentModel.ikHelper.setVisualisationScale(v);
                });
            }

            //Solver Selector
            panel.branch("Solver", { icon: "odnoklassniki" });
            panel.addSelect("Solver", this.editor.solvers, this.editor.solver, (v) => {
                this.editor.solver = v;
            });

            //Chains
            panel.branch("Chains", { icon: "CircleNodes@solid",});
            /*----------------------------------------------- IK Solver Inspector -----------------------------------------------*/
            let chains = this.editor.currentModel.chains;
            let names = Object.keys(chains);
            panel.addSelect("Current chain", names, this.editor.currentModel.selectedChain, v => {
                this.editor.setSelectedChain(v);
                panel.on_refresh();
            })
 
            let chain = chains[this.editor.currentModel.selectedChain];
            if(chain) {
                // Used by the gui to remember user settings for each bone and mode.
                if( !chain.guiConstraintSettings ){
                    chain.guiConstraintSettings = [];
                    for( let j = 0; j < chain.bones.length; ++j ){
                        chain.guiConstraintSettings.push({
                            OMNI: {
                                type: FABRIKSolver.JOINTTYPES.OMNI,
                                twist:[0,Math.PI]
                            },
                            HINGE: {
                                type: FABRIKSolver.JOINTTYPES.HINGE,
                                twist:[ 0, 0.0001 ], 
                                axis:[1,0,0], 
                                min: Math.PI, 
                                max: Math.PI * 1.8 
                            },
                            BALLSOCKET: {
                                type: FABRIKSolver.JOINTTYPES.BALLSOCKET,
                                twist: [ -Math.PI*0.25, Math.PI*0.25 ],
                                axis: [0,0,1], 
                                polar:[0, Math.PI*0.45],
                                azimuth: [0,Math.PI*0.5],
                            }
                        });
                    }
                }
                                
                const constraintTypes = ["NONE"].concat( Object.keys(FABRIKSolver.JOINTTYPES) );
                const bones = this.editor.currentModel.skeleton.bones;
                for(let j = chain.bones.length - 1; j >= 0; j--){
                    panel.addText("Bone", bones[chain.bones[j]].name, null, {disabled: true});

                    if ( j == 0 ){ break; }

                    const addConstraintToGUI = (chain, constraintIdx, constraint, panel) =>{
                        for(let c in constraint) {
                            if(c == "type") 
                                continue;
                            else if(c == 'min' || c == 'max') {
                                panel.addNumber(c, constraint[c]*180/Math.PI, v => {
                                    constraint[c] = v*Math.PI/180;
                                    this.editor.updateConstraint( chain.name, constraintIdx, constraint );
                                }, {min: -360, max : 360, step: 1});
                                continue;
                            }
                            else if(c == 'twist' || c == 'polar' || c == 'azimuth') {
                                let values = [constraint[c][0]*180/Math.PI, constraint[c][1]*180/Math.PI];
                                let vec = panel.addVector2(c, values, v => {
                                    constraint[c][0] = v[0]*Math.PI/180;
                                    constraint[c][1] = v[1]*Math.PI/180;
                                    this.editor.updateConstraint( chain.name, constraintIdx, constraint );
                                }, {min: c == 'polar' ? 0 : -360, max: c == 'polar' ? 180 : 360});
                                // Remove lock button
                                vec.root.querySelectorAll(".lexcomponent").forEach((vv,ii,arr)=>{if(vv.title=="Lock"){vv.remove();}});

                                continue;
                            }
                            else if ( c == 'axis') {
                                let vec = panel.addVector3(c, constraint[c], v => {
                                    if ( v.length > 0 ){
                                        for ( let k = 0; k < v.length; ++k ){ constraint[c][k] = v[k]; }
                                    }else{ 
                                        constraint[c] = v; 
                                    }
                                    this.editor.updateConstraint( chain.name, constraintIdx, constraint ); 
                                });
                                // Remove lock button
                                vec.root.querySelectorAll(".lexcomponent").forEach((vv,ii,arr)=>{if(vv.title=="Lock"){vv.remove();}});
                                continue;
                            }
                            panel.addNumber(c, constraint[c], v=>{
                                if ( v.length > 0 ){
                                    for ( let k = 0; k < v.length; ++k ){ constraint[c][k] = v[k]; }
                                }else{ 
                                    constraint[c] = v; 
                                }
                                this.editor.updateConstraint( chain.name, constraintIdx, constraint );
                            });
                        }
                    }

                    panel.addSelect("Constraint", constraintTypes, chain.constraints[j] ? constraintTypes[chain.constraints[j].type + 1] : "NONE", 
                        (v,e) =>{
                            const chainBoneSettings = v == "NONE" ? null : chain.guiConstraintSettings[j][v];
                            this.editor.updateConstraint(chain.name, j, chainBoneSettings );
                            chain.constraints[j] = chainBoneSettings; 
                        },
                        {
                            "on_OMNI": addConstraintToGUI.bind(this, chain, j, chain.guiConstraintSettings[j].OMNI),
                            "on_HINGE": addConstraintToGUI.bind(this, chain, j, chain.guiConstraintSettings[j].HINGE),
                            "on_BALLSOCKET": addConstraintToGUI.bind(this, chain, j, chain.guiConstraintSettings[j].BALLSOCKET),
                        }
                    );

                    panel.addSeparator();    

                }
                let rBtn = panel.addButton(null, "Delete chain", v => {
                    this.editor.removeChain(chain.name);
                    panel.on_refresh();
                });
                rBtn.root.getElementsByTagName("button")[0].classList.add("selected");
                rBtn.root.getElementsByTagName("button")[0].style.background =  "indianred";
                panel.addSeparator();
            }
            

            /** Add new chain */
            panel.addTitle("New chain");
            
            panel.addText("Name", newChain.name, (v) => {
                newChain.name = v;
            }, {required: true});
            
            panel.sameLine(3);
            
            //Select origin bone
            let origin = newChain.origin == null ? null: this.editor.currentModel.skeleton.bones[newChain.origin].name
            panel.addText("Origin bone", origin, null, { width: '80%', disabled: true})
            panel.addButton(null, "+", v => {
                newChain.origin = this.editor.currentModel.ikHelper.selectedBone;
                const name = this.editor.currentModel.skeleton.bones[newChain.origin].name;
                panel.components["Origin bone"].set( name );
            }, {title: "From selected", width: '10%'});
            panel.addButton("deleteOrigin", null, v => {
                newChain.origin = "";
                panel.components["Origin bone"].set( "" );
            }, {width: '10%', icon: "Trash", hideName: true});
            
            //Select end effector bone
            let endEffector = newChain.endEffector == null? null: this.editor.currentModel.skeleton.bones[newChain.endEffector].name
            
            panel.sameLine(3);
            panel.addText("End-effector bone", endEffector, null, {  width: '80%', disabled: true});
            panel.addButton(null, "+", v => {
                newChain.endEffector = this.editor.currentModel.ikHelper.selectedBone;
                const name = this.editor.currentModel.skeleton.bones[newChain.endEffector].name;
                panel.components["End-effector bone"].set( name );
            }, {title: "From selected", width: '10%'});
            panel.addButton("deleteEnd", null, v => {
                newChain.endEffector = "";
                panel.components["End-effector bone"].set( "" );
            }, { width: '10%', icon: "Trash", hideName: true });
            panel.widgets_per_row = 1;
            
            // panel.addCheckbox("Auto target", !newChain.target, v => {
            //     newChain.target = !v;
            // }, {
            //     className: "contrast",
            //     suboptions: (p)=>{
            //         p.sameLine(2);
            //         p.addText("Target", newChain.target == true ? null : newChain.target, null, {  width: '80%', disabled: true});
            //         p.addButton(null, "+", 
            //             v => {
            //                 newChain.target = this.editor.scene.getObjectByName("control"+this.editor.currentModel.selectedChain).children[0].object.name;
            //             },
            //             {title: "From selected", width: '10%'}
            //         );
            //     }
            // });

            let btn = panel.addButton(null, "Add chain", v => {
                if(newChain.name == "") {
                    alert("Name required");
                    return;
                }
                if(typeof(newChain.origin) != 'number') {
                    alert("Origin bone required");
                    return;
                }
                if(typeof(newChain.endEffector) != 'number') {
                    alert("End effector bone required");
                    return;
                }
                this.editor.addChain(this.editor.currentModel, newChain, panel.on_refresh.bind(panel) );
                
            }, {id: "chain-btn"})
            btn.root.getElementsByTagName("button")[0].classList.add("selected");// =  "cadetblue";
        }
        panel.on_refresh(options);
        
        // update scroll position
        const element = this.sidePanel.root;
        const maxScroll = element.scrollHeight;
        element.scrollTop = options.maxScroll ? maxScroll : (options.scroll ? options.scroll : 0);
    }

    attachCanvas(element, app) {

        this.canvasArea.root.id = "canvasarea";
        this.canvasArea.attach( element );

        const canvasButtons = [
            {
                name: 'Grid',
                property: 'showGrid',
                icon: 'Grid@solid',
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
                icon: 'Bone@solid',
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
                icon: "Sun@solid",
                swap: "Moon@solid",
                callback:  (swapValue) => { LX.setTheme( swapValue ? "light" : "dark" ) }
            }
    
        ]

        this.canvasArea.addOverlayButtons(canvasButtons, { float: "htc" } );

        return this.canvasArea;
    }

    setTextInfo(text) {
        this.textInfo.innerText = text;
    }

    resize() {
       
    }


}


export { GUI };