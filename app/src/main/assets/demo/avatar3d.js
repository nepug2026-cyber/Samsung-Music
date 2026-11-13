/* RetroSound One 1.4 — phone-only, original procedural 3D raccoon.
   Offline WebGL 1; smooth, bone-hierarchical motion; no assets/network or autoplay.
   Android Auto uses MediaLibraryService and never loads this renderer. */
(()=>{'use strict';
const canvas=document.getElementById('avatar3D');if(!canvas)return;
const outfits=[
 {id:'raccoon',species:'raccoon',name:'Енот-диджей',icon:'🦝',body:'#bf4037',trim:'#f4ddbd',legs:'#273345',hat:'#c33c32'},
 {id:'cat',species:'cat',name:'Кот-танцор',icon:'🐈',body:'#45857c',trim:'#efcc9f',legs:'#364054',hat:'#b9805b'},
 {id:'fox',species:'fox',name:'Лис-музыкант',icon:'🦊',body:'#497b70',trim:'#e8bd96',legs:'#34495d',hat:'#bd7644'},
 {id:'robot',species:'robot',name:'Робот-битмейкер',icon:'🤖',body:'#5a7e99',trim:'#ace0db',legs:'#3b5068',hat:'#719eaf'},
 {id:'dog',species:'dog',name:'Пёс в наушниках',icon:'🐕',body:'#ac6e48',trim:'#ebd4ae',legs:'#394b57',hat:'#9d704a'},
 {id:'fairy',species:'fairy',name:'Сказочный герой',icon:'✨',body:'#896ba5',trim:'#efc9e4',legs:'#645175',hat:'#aa93bd'},
 {id:'jazz',species:'raccoon',name:'Енот · джаз',icon:'🎷',body:'#6c4562',trim:'#eed6a3',legs:'#343348',hat:'#584458'},
 {id:'disco',species:'fox',name:'Лис · диско',icon:'🪩',body:'#c49a5c',trim:'#f1dea2',legs:'#845978',hat:'#b88443'},
 {id:'rock',species:'cat',name:'Кот · рок',icon:'🎸',body:'#8b4552',trim:'#efb596',legs:'#343c4b',hat:'#6d3645'},
 {id:'cosmic',species:'robot',name:'Космический робот',icon:'🚀',body:'#8dabbc',trim:'#edd7a5',legs:'#59647d',hat:'#a6c4d3'}
];window.RetroAvatarModels=outfits;
const cfg={index:0,dance:'auto',bpm:116,playing:false,level:0,position:0,enabled:true};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), lerp=(a,b,t)=>a+(b-a)*t;
const prefersStill=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let gl;
try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,premultipliedAlpha:true,powerPreference:'default'});}catch{}
if(!gl){
  const ctx=canvas.getContext('2d');window.RetroAvatar3D={models:outfits,ready:false,set:patch=>Object.assign(cfg,patch)};
  function fallback(){if(!ctx)return;ctx.clearRect(0,0,240,260);if(!cfg.enabled)return;
    const o=outfits[cfg.index%outfits.length],t=performance.now()/1000,sw=cfg.playing&&!prefersStill()?Math.sin(t*4)*3:0;
    ctx.save();ctx.translate(120,140+sw);ctx.fillStyle='#00000017';ctx.beginPath();ctx.ellipse(0,88,48,8,0,0,7);ctx.fill();
    ctx.fillStyle=o.legs;ctx.fillRect(-26,17,18,67);ctx.fillRect(8,17,18,67);
    ctx.fillStyle=o.body;ctx.beginPath();ctx.ellipse(0,10,40,50,0,0,7);ctx.fill();
    ctx.fillStyle='#a4a5a2';ctx.beginPath();ctx.arc(0,-59,39,0,7);ctx.fill();
    for(const s of [-1,1]){ctx.fillStyle='#52565f';ctx.beginPath();ctx.arc(s*27,-88,14,0,7);ctx.fill();ctx.fillStyle='#33383f';ctx.beginPath();ctx.ellipse(s*15,-62,14,10,s*.15,0,7);ctx.fill();}
    ctx.fillStyle='#fff';for(const s of [-1,1]){ctx.beginPath();ctx.arc(s*14,-63,5,0,7);ctx.fill();}ctx.fillStyle='#252c38';ctx.beginPath();ctx.arc(0,-46,7,0,7);ctx.fill();ctx.restore();
  }
  let prev=0;function loop(t){requestAnimationFrame(loop);if(t-prev>80){prev=t;fallback();}}requestAnimationFrame(loop);return;
}
const vsrc=`attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uMVP,uModel;varying vec3 nrm,pos;void main(){vec4 p=uModel*vec4(aPosition,1.);pos=p.xyz;nrm=normalize(mat3(uModel)*aNormal);gl_Position=uMVP*vec4(aPosition,1.);}`;
const fsrc=`precision mediump float;uniform vec3 uColor;uniform float uGloss,uAlpha;varying vec3 nrm,pos;void main(){vec3 n=normalize(nrm);vec3 key=normalize(vec3(-.45,.85,1.25)),fill=normalize(vec3(.8,.3,.65));float a=max(0.,dot(n,key)),b=max(0.,dot(n,fill));float h=dot(n,normalize(key+vec3(0.,.15,1.)));float shiny=pow(max(0.,h),mix(12.,52.,uGloss))*uGloss*.34;float rim=pow(1.-max(0.,dot(n,normalize(vec3(0.,0.,1.)))),3.)*.15;vec3 lit=uColor*(.40+.58*a+.16*b)+vec3(1.,.83,.65)*shiny+vec3(.6,.8,1.)*rim;gl_FragColor=vec4(pow(lit,vec3(.92)),uAlpha);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let prog;
try{prog=gl.createProgram();gl.attachShader(prog,shader(gl.VERTEX_SHADER,vsrc));gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,fsrc));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);}catch(e){console.warn('RetroSound 3D unavailable',e);canvas.style.opacity='0';window.RetroAvatar3D={models:outfits,ready:false,set:patch=>Object.assign(cfg,patch)};return;}
const aPos=gl.getAttribLocation(prog,'aPosition'),aNor=gl.getAttribLocation(prog,'aNormal');
const uMVP=gl.getUniformLocation(prog,'uMVP'),uModel=gl.getUniformLocation(prog,'uModel'),uColor=gl.getUniformLocation(prog,'uColor'),uGloss=gl.getUniformLocation(prog,'uGloss'),uAlpha=gl.getUniformLocation(prog,'uAlpha');
gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
const id=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a,b){const c=new Array(16).fill(0);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)c[j*4+i]+=a[k*4+i]*b[j*4+k];return c;}
function tr(x,y,z){const m=id();m[12]=x;m[13]=y;m[14]=z;return m;}function sc(x,y,z){const m=id();m[0]=x;m[5]=y;m[10]=z;return m;}
function rx(a){const m=id(),c=Math.cos(a),s=Math.sin(a);m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;}
function ry(a){const m=id(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;}
function rz(a){const m=id(),c=Math.cos(a),s=Math.sin(a);m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m;}
function node(base,x,y,z,ax=0,ay=0,az=0){return mul(base,mul(tr(x,y,z),mul(ry(ay),mul(rx(ax),rz(az)))));}
function persp(fov,aspect,near,far){const f=1/Math.tan(fov/2),m=new Array(16).fill(0);m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=2*far*near/(near-far);return m;}
function makeMesh(p,n,idx){let out={};out.pos=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,out.pos);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(p),gl.STATIC_DRAW);
 out.nor=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,out.nor);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(n),gl.STATIC_DRAW);
 out.idx=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,out.idx);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idx),gl.STATIC_DRAW);out.count=idx.length;return out;}
function sphere(){const p=[],n=[],ix=[],rows=32,cols=48;for(let i=0;i<=rows;i++){let phi=i*Math.PI/rows;for(let j=0;j<=cols;j++){const theta=j*2*Math.PI/cols,x=Math.sin(phi)*Math.cos(theta),y=Math.cos(phi),z=Math.sin(phi)*Math.sin(theta);p.push(x,y,z);n.push(x,y,z);}}
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){let a=i*(cols+1)+j,b=a+cols+1;ix.push(a,b,a+1,b,b+1,a+1);}return makeMesh(p,n,ix);}
function cylinder(){const p=[],n=[],ix=[],cols=48;for(const y of [-1,1])for(let j=0;j<=cols;j++){let t=j*2*Math.PI/cols,x=Math.cos(t),z=Math.sin(t);p.push(x,y,z);n.push(x,0,z);}
 for(let j=0;j<cols;j++){let a=j,b=j+cols+1;ix.push(a,a+1,b,b,a+1,b+1);}return makeMesh(p,n,ix);}
const BALL=sphere(),TUBE=cylinder(),pal={fur:'#9a9ba0',dark:'#42454c',muzzle:'#e9e0d3',shadow:'#454756',white:'#fffdfa',nose:'#292b33',tail:'#73767e'};
const rgb={};function color(h){if(!rgb[h])rgb[h]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);return rgb[h];}
let aspect=canvas.width/canvas.height,P=persp(.76,aspect,.1,40),V=tr(0,-.42,-4.75);
function part(mesh,col,parent,x,y,z,sx,sy,sz,gloss=.22,alpha=1){let model=mul(node(parent,x,y,z),sc(sx,sy,sz));gl.uniformMatrix4fv(uMVP,false,new Float32Array(mul(P,mul(V,model))));gl.uniformMatrix4fv(uModel,false,new Float32Array(model));gl.uniform3fv(uColor,new Float32Array(color(col)));
 gl.uniform1f(uGloss,gloss);gl.uniform1f(uAlpha,alpha);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.pos);gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(aPos);gl.bindBuffer(gl.ARRAY_BUFFER,mesh.nor);gl.vertexAttribPointer(aNor,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(aNor);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.idx);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);}
const ball=(c,m,x,y,z,sx,sy,sz,g)=>part(BALL,c,m,x,y,z,sx,sy,sz,g),tube=(c,m,x,y,z,sx,sy,sz,g)=>part(TUBE,c,m,x,y,z,sx,sy,sz,g);
let phase=0,energy=0,lastT=0,lastPaint=0,wasPlaying=false;
function draw(t){let dt=lastT?clamp(t-lastT,0,.06):.016;lastT=t;let bpm=clamp(Number(cfg.bpm)||116,55,190),on=!!cfg.playing&&!prefersStill();
 energy=lerp(energy,on?clamp(cfg.level||.24,0,1):0,clamp(dt*5,0,1));
 if(on){phase+=dt*bpm/60*2*Math.PI;let target=(Number(cfg.position)||0)*bpm/60*2*Math.PI;let d=Math.atan2(Math.sin(target-phase),Math.cos(target-phase));phase+=d*clamp(dt*1.4,0,.085);}
 else phase+=dt*.5;
 let beat=Math.sin(phase),beat2=Math.sin(phase*2),sway=Math.sin(phase*.5),idle=Math.sin(t*1.6);
 const intensity=on?clamp(.40+energy*.45,.25,.80):0;
 let o=outfits[clamp(cfg.index|0,0,outfits.length-1)];
 let style=(cfg.dance==='auto'?({raccoon:'hiphop',cat:'disco',fox:'swing',robot:'popping',dog:'rock',fairy:'waltz'}[o.species]):cfg.dance)||'disco',timing=style==='waltz'?.55:style==='shuffle'?1.24:style==='rock'?1.12:1;
 let step=Math.sin(phase*timing),armA=.18*step*intensity,armB=-.2*Math.sin(phase*timing+.6)*intensity;
 let legsA=.14*Math.sin(phase*timing+.3)*intensity,legsB=-.14*Math.sin(phase*timing+.3)*intensity;
 if(style==='ballet'){armA=.26*intensity;armB=-.26*intensity;legsA*=.5;legsB*=.5;}
 if(style==='tango'){armA=.27*intensity;armB=-.08*intensity;}
 if(style==='hiphop'){armA=.36*step*intensity;armB=-.33*beat2*intensity;}
 if(style==='popping'){armA=.19*Math.tanh(step*2)*intensity;armB=-.2*Math.tanh(Math.sin(phase+.5)*2)*intensity;}
 let bob=on?.028*(1+beat2)*intensity:idle*.011;
 let root=node(id(),0,bob,-.04,0,.07*sway*intensity,.025*step*intensity);
 // Coat/body silhouette: rounded forms only, no large hard-edged box.
 // Tail behind the body, with shaded rings and mild sway.
 const species=o.species;
 const fur=species==='fox'?'#b9774b':species==='cat'?'#c69977':species==='dog'?'#b88e73':species==='fairy'?'#c7accc':species==='robot'?'#90a2af':pal.fur;
 const dark=species==='robot'?'#41596b':species==='fox'?'#754731':pal.dark;
 if(species==='fairy'){
   for(const s of [-1,1]){const wing=node(root,s*.24,1.0,-.18,0,0,-s*.22);
     ball('#ded4ea',wing,s*.14,.10,-.07,.18,.32,.035,.32);
   }
 }else if(species!=='robot'){
   const tailbase=node(root,.23,.54,-.23,0,0,.15*sway*intensity);
   for(let i=0;i<6;i++){let cx=.12+i*.10,cy=-.06+i*.047,cz=-.06-i*.047;
     const tc=species==='raccoon'?(i%2?fur:dark):species==='fox'?(i===5?'#f0e7d7':fur):fur;
     ball(tc,tailbase,cx,cy,cz,.14,.12,.13,.15);
   }
 }
 // Legs, knees, shoes: independent joint chains.
 for(const s of [-1,1]){let h=node(root,s*.17,.39,0,-.02,0,(s<0?legsA:legsB));
   tube(o.legs,h,0,-.15,0,.118,.19,.125);ball(o.legs,h,0,-.30,0,.13,.13,.13);
   let knee=node(h,0,-.31,0,0,0,-.08*step*intensity*s);
   tube(o.legs,knee,0,-.14,0,.112,.17,.116);
   ball(species==='raccoon'?'#c74a38':'#384d5e',knee,0,-.34,.105,.14,.10,.22,.22);
   ball('#f5e2ca',knee,0,-.38,.22,.125,.044,.115,.22);
 }
 ball(o.body,root,0,.80,0,.31,.45,.24,.20);
 for(const s of [-1,1]){
   ball(o.trim,root,s*.19,1.07,.18,.075,.11,.045,.20);
   ball('#e9d3b2',root,s*.23,.73,.226,.040,.018,.015,.24);
 }
 ball('#f4efe5',root,0,.82,.237,.106,.22,.026,.23);
 ball(o.trim,root,0,.82,.228,.185,.28,.04,.25);
 // Collar and scarf/zipper details.
 ball(o.trim,root,0,1.16,.14,.23,.075,.19,.32);
 ball(pal.dark,root,0,.82,.274,.016,.25,.018,.45);
 ball(pal.dark,root,0,.88,.295,.037,.038,.02,.35);
 // Fully jointed arms with shoulders, elbows and paws.
 for(const s of [-1,1]){let angle=s<0?armA:armB;
  let shoulder=node(root,s*.34,1.07,0,0,0,s*.12+angle);
  ball(o.body,shoulder,0,-.04,0,.15,.15,.17);
  ball(o.body,shoulder,s*.025,-.24,0,.12,.24,.135);
  let elbow=node(shoulder,s*.025,-.45,0,0,0,-s*(.12+.10*intensity)+angle*.48);
  ball(o.body,elbow,0,0,0,.12,.12,.12);
  ball(o.body,elbow,0,-.18,.016,.1,.18,.106);
  ball(dark,elbow,0,-.36,.02,.13,.12,.12);
  for(let j=-1;j<=1;j++)ball(fur,elbow,j*.075,-.42,.1,.036,.065,.043);
 }
 ball(fur,root,0,1.27,0,.12,.12,.12);
 const head=node(root,0,1.63,0,-.025+Math.sin(t*1.3)*.015,.06*sway*intensity,.035*step*intensity);
 ball(fur,head,0,0,0,.375,.335,.345,.25);
 if(species==='robot'){
   ball('#334958',head,0,.012,.30,.295,.17,.078,.7);
   for(const s of [-1,1]){
     ball('#c8eff5',head,s*.15,.04,.372,.095,.076,.017,.85);
     ball('#5bb8cd',head,s*.15,.04,.392,.040,.04,.016,.8);
   }
   tube('#a7c8d1',head,0,.36,0,.018,.12,.018,.45);
   ball('#e7b866',head,0,.47,0,.072,.072,.072,.6);
 }else{
   for(const s of [-1,1]){
     const ear=node(head,s*.27,.245,-.045,0,0,-s*(species==='dog'?.55:.21));
     ball(dark,ear,0,species==='dog'?-.04:.04,0,.140,
       species==='fox'?.24:species==='cat'?.21:.166,.09,.20);
     ball('#cfa4a4',ear,0,.027,.075,.075,.09,.032,.23);
   }
   for(const s of [-1,1]){
     const ey=node(head,s*.15,.052,.287,0,s*.12,0);
     if(species==='raccoon'){
       // Dark sunglasses from the approved raccoon-DJ illustration.
       ball('#272c36',ey,0,0,.035,.159,.103,.056,.87);
       ball('#65717a',ey,-.045,.037,.088,.054,.014,.01,.80);
     }else{
       ball(dark,ey,0,0,-.005,.14,.11,.055,.18);
       ball('#fff8ec',ey,0,.003,.062,.070,.072,.035,.3);
       ball('#303d4d',ey,0,0,.096,.036,.045,.025,.55);
       ball('#fff',ey,-.015,.022,.11,.015,.015,.012,.7);
     }
   }
   ball('#eee0d1',head,0,-.145,.30,species==='fox'?.19:.17,.103,
     species==='fox'?.14:.088,.18);
   ball(species==='cat'?'#a56f7b':'#2a2d37',head,0,-.116,
     species==='fox'?.420:.383,.071,.041,.045,.45);
   ball('#65464a',head,0,-.22,.358,.06,.011,.013,.18);
 }
 // Full 3D over-ear headphones with curved raised padded bridge.
 if(['raccoon','cat','dog'].includes(species)){
   for(let i=0;i<=12;i++){
     const angle=(.06+.88*i/12)*Math.PI;
     ball('#30343c',head,.395*Math.cos(angle),.035+.393*Math.sin(angle),
        -.035,.048,.054,.057,.52);
   }
   for(const s of [-1,1]){
     ball('#33343b',head,s*.405,.013,0,.09,.173,.15,.37);
     ball('#d4ac80',head,s*.45,.01,.015,.041,.115,.104,.64);
   }
 }
 if(species==='fairy'){
   ball(o.hat,head,0,.31,-.06,.26,.08,.25,.3);
   ball('#f5e2f2',head,0,.39,-.05,.12,.11,.12,.25);
 }
 if(o.id==='jazz'||o.id==='rock')ball(o.hat,head,0,.34,-.06,.20,.11,.24,.24);
}
function frame(ms){requestAnimationFrame(frame);if(!cfg.enabled||document.hidden||gl.isContextLost())return;let t=ms/1000;
 const targetFps=cfg.playing?60:24;if(ms-lastPaint<1000/targetFps)return;lastPaint=ms;
 gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);draw(t);
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();window.RetroAvatar3D.ready=false;});
window.RetroAvatar3D={models:outfits,ready:true,set(patch){if(patch&&typeof patch==='object')Object.assign(cfg,patch)}};
requestAnimationFrame(frame);
})();
