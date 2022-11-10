import * as datGUI from 'https://cdn.skypack.dev/dat.gui'

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
                if(v == "MIX") {
                    this.editor.initFabrik(false);
                }
                else if(v == "FABRIK") {
                    this.editor.initFabrik(true);
                }
                this.editor.solver = v;
                widgets.refresh();
            }});

            //Chains
            let chains = widgets.addSection("Chains", {});
            if(this.editor.solver == "CCDIK") {

                for(let i = 0; i < this.editor.chains.length; i++){
                    let folder = widgets.addTitle(this.editor.chains[i].name, {});
                    
                    let bones = this.editor.skeleton.bones;
                    for(let j = 0; j < this.editor.chains[i].links.length; j++){
                        let subfolder = widgets.addInfo("Bone", bones[this.editor.chains[i].links[j].index].name);
                        widgets.widgets_per_row = 3;
                        widgets.addCheckbox("limitX", this.editor.chains[i].links[j].limitX, {width: '100%', callback: (v) => { 
                            if(!v){ 
                                this.editor.chains[i].links[j].rotationMin.x = -2*Math.PI
                            this.editor.chains[i].links[j].rotationMax.x = 2*Math.PI
                        }}
                    });
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
                    let rotMin =  [this.editor.chains[i].links[j].rotationMin.x, this.editor.chains[i].links[j].rotationMin.y, this.editor.chains[i].links[j].rotationMin.z];
                    widgets.addVector3("Rotation min", rotMin, {min: -2*Math.PI, max: 2*Math.PI, callback:
                        value => {
                            let v = this.editor.chains[i].links[j];
                            if(v.limitX)
                            this.editor.chains[i].links[j].rotationMin.x = value[0];
                            if(v.limitY)
                                this.editor.chains[i].links[j].rotationMin.y = value[1];
                                if(v.limitZ)
                                this.editor.chains[i].links[j].rotationMin.z = value[2];
                            }
                        }); 
                        let rotMax =  [this.editor.chains[i].links[j].rotationMax.x, this.editor.chains[i].links[j].rotationMax.y, this.editor.chains[i].links[j].rotationMax.z];
                        widgets.addVector3("Rotation max", this.editor.chains[i].links[j].rotationMax, {min: -2*Math.PI, max: 2*Math.PI, callback:
                            value => {
                                let v = this.editor.chains[i].links[j];
                                if(v.limitX)
                                this.editor.chains[i].links[j].rotationMax.x = value[0];
                                if(v.limitY)
                                this.editor.chains[i].links[j].rotationMax.y = value[1];
                                if(v.limitZ)
                                this.editor.chains[i].links[j].rotationMax.z = value[2];                
                            }
                        }); 
                        
                        widgets.addSeparator();    
                    }
                    widgets.addSeparator();
                }
            }
            else if(this.editor.solver == "FABRIK") {

                for(let i = 0; i < this.editor.fabrikChains.length; i++){
                    let folder = widgets.addTitle(this.editor.fabrikChains[i].name, {});
                    
                    let bones = this.editor.skeleton.bones;
                    for(let j = this.editor.fabrikChains[i].bones.length - 1; j >= 0; j--){
                        let subfolder = widgets.addInfo("Bone", bones[this.editor.fabrikChains[i].bones[j]].name);
                        widgets.widgets_per_row = 1;
                        let constraint = this.editor.fabrikChains[i].constraints[j];
                        if(constraint) {
                            for(let c in constraint) {

                                widgets.addDefault(c, constraint[c])
                            }
                        }
                        
                        
                        
                        widgets.addSeparator();    
                    }
                    widgets.addSeparator();
                }
            }
            widgets.addTitle("New chain");
            
            widgets.addString("Name", newChain.name, {placeholder: "rightHand...", callback: (v) => {
                newChain.name = v;
            }})
            
            widgets.widgets_per_row = 2;
            let origin = newChain.origin == null? null: this.editor.skeleton.bones[newChain.origin].name
            widgets.addString("Origin bone", origin, { width: '85%', disabled: false})
            widgets.addButton(null, "<img src='./data/imgs/mini-icon-trash.png'/>", {width: '15%', micro: true})
            widgets.widgets_per_row = 1;
            widgets.addButton(null, "From selected", {callback: v => {
                newChain.origin = this.editor.gizmo.selectedBone;
                widgets.refresh();
            }})
            
            let endEffector = newChain.endEffector == null? null: this.editor.skeleton.bones[newChain.endEffector].name
            widgets.widgets_per_row = 2;
            widgets.addString("End-effector bone", endEffector, {  width: '85%', disabled: false})
            widgets.addButton(null, "<img src='./data/imgs/mini-icon-trash.png'/>", { width: '15%', micro: true})
            widgets.widgets_per_row = 1;
            widgets.addButton(null, "From selected", {callback: v => {
                newChain.endEffector = this.editor.gizmo.selectedBone;
                widgets.refresh();
            }})

            widgets.addButton(null, "Add chain", {callback: v => {
                this.editor.addChain(newChain,widgets.refresh.bind(widgets) );
             
            }})
        }
        widgets.on_refresh(options);
        
        // update scroll position
        var element = root.content.querySelectorAll(".inspector")[0];
        var maxScroll = element.scrollHeight;
        element.scrollTop = options.maxScroll ? maxScroll : (options.scroll ? options.scroll : 0);
    }

    initGui() {
        for(let f in this.datGUI.__folders) {
            this.datGUI.removeFolder(this.datGUI.__folders[f]);
        }
        let character = this.datGUI.addFolder("Character");
        character.add( {character: this.editor.currentModel}, 'character', this.editor.models).name('Character').onChange(v => {
            this.currentModel = v;
            this.initCharacter();
        })

        let solver = this.datGUI.addFolder("Solver");

        solver.add({solver: this.editor.solver}, 'solver', this.editor.solvers).name("Solver").onChange(v => {
            
            if(v == "MIX") {
                this.editor.initFabrik(false);
            }
            else if(v == "FABRIK") {
                this.editor.initFabrik(true);
            }
            this.editor.solver = v;
            
        })
        solver.open();

        let chains = this.datGUI.addFolder("Chains");

        for(let i = 0; i < this.editor.chains.length; i++){
            let folder = chains.addFolder(this.editor.chains[i].name);
            let bones = this.editor.skeleton.bones;
            for(let j = 0; j < this.editor.chains[i].links.length; j++){
                let subfolder = folder.addFolder("Bone "+ bones[this.editor.chains[i].links[j].index].name);
                
                subfolder.add(this.editor.chains[i].links[j], "limitX").listen().onChange(v => { 
                    if(!v){ 
                        this.editor.chains[i].links[j].rotationMin.x = -2*Math.PI
                        this.editor.chains[i].links[j].rotationMax.x = 2*Math.PI
                    }});
                    subfolder.add(this.editor.chains[i].links[j].rotationMin, "x", -2*Math.PI, 2*Math.PI)
                .name("Min")           
                .onChange(                      
                    value => {
                        this.editor.chains[i].links[j].rotationMin.x = value;                
                    }
                ); 
                subfolder.add(this.editor.chains[i].links[j].rotationMax, "x", -2*Math.PI, 2*Math.PI) 
                .name("Max")            
                .onChange(                      
                    value => {
                        this.editor.chains[i].links[j].rotationMax.x = value;               
                    }
                ); 

                subfolder.add(this.editor.chains[i].links[j], "limitY").listen().onChange(v => { 
                    if(!v){ 
                        this.chains[i].links[j].rotationMin.y = -2*Math.PI
                        this.chains[i].links[j].rotationMax.y = 2*Math.PI
                    }});
                subfolder.add(this.editor.chains[i].links[j].rotationMin, "y", -2*Math.PI, 2*Math.PI) 
                .name("Min")         
                .onChange(                    
                    value => {
                        this.editor.chains[i].links[j].rotationMin.y = value;             
                    }
                ); 

                subfolder.add(this.editor.chains[i].links[j].rotationMax, "y", -2*Math.PI, 2*Math.PI) 
                .name("Max")      
                .onChange(          
                    value => {
                        this.editor.chains[i].links[j].rotationMax.y = value;            
                    }
                ); 

                subfolder.add(this.editor.chains[i].links[j], "limitZ").listen().onChange(v => { 
                    if(!v){ 
                        this.editor.chains[i].links[j].rotationMin.z = -2*Math.PI
                        this.editor.chains[i].links[j].rotationMax.z = 2*Math.PI
                    }});
                subfolder.add(this.editor.chains[i].links[j].rotationMin, "z", -2*Math.PI, 2*Math.PI) 
                .name("Min")             
                .onChange(                     
                    value => {
                        this.editor.chains[i].links[j].rotationMin.z = value;                                      
                    }
                ); 
                subfolder.add(this.editor.chains[i].links[j].rotationMax, "z", -2*Math.PI, 2*Math.PI) 
                .name("Max")        
                .onChange(                      
                    value => {
                        this.editor.chains[i].links[j].rotationMax.z = value;                                          
                    }
                ); 
            }

        }
        chains.add({ addChain: this.addChain}, "addChain").name("New chain");
    }

    addChain() {
        let options = {
            title: "New chain",
            close: 'fade'
        };
		
		
		let dialog = new LiteGUI.Dialog( options );
        let inspector = new LiteGUI.Inspector();
        let origin = inspector.addString("Origin") ;
        let btn_origin = inspector.addButton("Select");
        dialog.add(inspector)
		if(!options.noclose)
			dialog.addButton("Close",{ close: true });
		dialog.makeModal('fade');
		dialog.show();
      
    }
    resize() {
      
       
    }


}


export { GUI };