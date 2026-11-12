/* RetroSound One – original low-poly articulated 3D character renderer.
   Pure WebGL, offline, no external models, trademarks or engine dependencies. */
(function(){
const canvas=document.getElementById('avatar3D'); if(!canvas)return;
const outfits=[
{id:'cartoon',name:'Мультяшный танцор',icon:'🕺',body:'#ed9759',legs:'#293f6c',skin:'#edc69a',head:'round',hat:'#4e2d24'},
{id:'fairy',name:'Сказочная фея',icon:'🧚',body:'#77cfa4',legs:'#79a6c2',skin:'#f7cca9',head:'elf',hat:'#9bdeaa'},
{id:'robot',name:'Хромированный робот',icon:'🤖',body:'#b9d6e0',legs:'#819fae',skin:'#d6eaf0',head:'box',hat:'#5ecbd1'},
{id:'pilot',name:'Космический пилот',icon:'👨‍🚀',body:'#e8f0fa',legs:'#83a9c8',skin:'#f0c99c',head:'helmet',hat:'#addef1'},
{id:'pirate',name:'Капитан пиратов',icon:'🏴‍☠️',body:'#bf5e58',legs:'#493e4d',skin:'#e7b887',head:'bandana',hat:'#302c3e'},
{id:'knight',name:'Рыцарь легенд',icon:'🛡️',body:'#a0b3c4',legs:'#4a5c73',skin:'#e9c49f',head:'helmet',hat:'#cdd9e6'},
{id:'detective',name:'Герой нуара',icon:'🕵️',body:'#6b7b83',legs:'#38434d',skin:'#e7b889',head:'hat',hat:'#2f333a'},
{id:'cyber',name:'Кибергерой',icon:'🦾',body:'#795ce4',legs:'#252748',skin:'#e2bce6',head:'visor',hat:'#38d6ec'},
{id:'jazz',name:'Джазовый маэстро',icon:'🎷',body:'#773d59',legs:'#292e4a',skin:'#e5b98e',head:'hat',hat:'#ce9e51'},
{id:'disco',name:'Диско-звезда',icon:'✨',body:'#e8ae52',legs:'#b74985',skin:'#e7b890',head:'afro',hat:'#3f292c'}
];window.RetroAvatarModels=outfits;
function fallback2D(){
 const c=canvas.getContext('2d');if(!c)return;
 let f={index:0,dance:'disco',bpm:120,playing:false,level:0,position:0,enabled:true};
 window.RetroAvatar3D={set(patch){Object.assign(f,patch)},models:outfits,ready:false};
 const rad=(col,x,y,r)=>{const g=c.createRadialGradient(x-r*.3,y-r*.35,2,x,y,r);g.addColorStop(0,'#ffffff');g.addColorStop(.25,col);g.addColorStop(1,'#273846');return g};
 const leg=(x,y,angle,length,w,col)=>{c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=col;c.strokeStyle='#23313f';c.lineWidth=2;c.beginPath();c.roundRect(-w/2,0,w,length,w/2);c.fill();c.stroke();c.restore()};
 function paint(ms){requestAnimationFrame(paint);c.clearRect(0,0,canvas.width,canvas.height);if(!f.enabled)return;
 const o=outfits[f.index]||outfits[0],beat=(f.playing?f.position:ms/1000*.22)*Math.PI*2*f.bpm/60,m=f.playing?1:.06,dx=Math.sin(beat)*m;
 c.save();c.translate(120,132+Math.abs(dx)*-4);
 c.fillStyle='#13212c99';c.beginPath();c.ellipse(0,90,48,8,0,0,7);c.fill();
 leg(-17,27,.16+dx*.27,65,17,o.legs);leg(17,27,-.18-dx*.27,65,17,o.legs);
 leg(-39,-36,-.28+dx*.45,65,15,o.body);leg(39,-36,.3-dx*.45,65,15,o.body);
 c.fillStyle=rad(o.body,0,0,54);c.beginPath();c.ellipse(0,-1,35,53,0,0,7);c.fill();c.strokeStyle='#dce6ef88';c.lineWidth=2;c.stroke();
 const h=o.head==='box'?30:29;c.fillStyle=rad(o.skin,0,-92,35);c.beginPath();if(o.head==='box')c.roundRect(-h,-118,2*h,53,8);else c.ellipse(0,-89,30,34,0,0,7);c.fill();
 c.fillStyle=o.hat;
 if(o.head==='hat'){c.fillRect(-35,-116,70,7);c.fillRect(-22,-141,44,28)}
 else if(o.head==='afro'){c.beginPath();c.ellipse(0,-119,38,22,0,0,7);c.fill()}
 else if(o.head==='robot'||o.head==='box'){c.fillRect(-4,-141,8,17);c.beginPath();c.arc(0,-141,7,0,7);c.fill()}
 else if(o.head==='visor'){c.fillRect(-27,-106,54,13)}
 else if(o.head==='helmet'){c.strokeStyle=o.hat;c.lineWidth=9;c.beginPath();c.arc(0,-91,31,Math.PI,Math.PI*2);c.stroke()}
 else {c.beginPath();c.ellipse(0,-114,27,11,0,0,7);c.fill()}
 c.fillStyle='#263748';c.beginPath();c.arc(-9,-91,2.5,0,7);c.arc(9,-91,2.5,0,7);c.fill();c.restore();}
 requestAnimationFrame(paint);
}

const gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:false,premultipliedAlpha:false});
if(!gl){canvas.setAttribute('aria-label','Резервная иллюстрация: WebGL 3D недоступен');fallback2D();return}
const VS=`attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uMVP;uniform mat4 uModel;varying vec3 vNormal;varying vec3 vWorld;void main(){gl_Position=uMVP*vec4(aPosition,1.0);vNormal=normalize(mat3(uModel)*aNormal);vWorld=(uModel*vec4(aPosition,1.)).xyz;}`;
const FS=`precision mediump float;uniform vec3 uColor;varying vec3 vNormal;varying vec3 vWorld;void main(){vec3 n=normalize(vNormal);float light=max(dot(n,normalize(vec3(-0.45,0.8,1.0))),0.0);float rim=pow(1.0-max(dot(n,vec3(0.,0.,1.)),0.0),2.5)*.13;vec3 col=uColor*(0.40+0.67*light)+vec3(rim);gl_FragColor=vec4(col,1.0);}`;
function shader(type,src){const o=gl.createShader(type);gl.shaderSource(o,src);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(o));return o}
let program;try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,VS));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program))}catch(e){console.warn('3D avatar:',e);return}
gl.useProgram(program);const aPos=gl.getAttribLocation(program,'aPosition'),aNorm=gl.getAttribLocation(program,'aNormal'),uMVP=gl.getUniformLocation(program,'uMVP'),uModel=gl.getUniformLocation(program,'uModel'),uColor=gl.getUniformLocation(program,'uColor');gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
function I(){return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}
function mul(a,b){const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o}
function T(x,y,z){const m=I();m[12]=x;m[13]=y;m[14]=z;return m}
function S(x,y,z){const m=I();m[0]=x;m[5]=y;m[10]=z;return m}
function Rx(a){const c=Math.cos(a),s=Math.sin(a),m=I();m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m}
function Ry(a){const c=Math.cos(a),s=Math.sin(a),m=I();m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m}
function Rz(a){const c=Math.cos(a),s=Math.sin(a),m=I();m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m}
function TRS(parent,x,y,z,rx,ry,rz,sx=1,sy=1,sz=1){return mul(parent,mul(T(x,y,z),mul(Rx(rx),mul(Ry(ry),mul(Rz(rz),S(sx,sy,sz))))))}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),m=new Array(16).fill(0);m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=2*far*near/(near-far);return m}
function mesh(points,normals,indices){const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);const nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(normals),gl.STATIC_DRAW);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);return {vb,nb,ib,count:indices.length}}
function makeSphere(){const p=[],n=[],ix=[],rows=14,cols=20;for(let i=0;i<=rows;i++){const v=i/rows,phi=v*Math.PI;for(let j=0;j<=cols;j++){const u=j/cols,theta=u*2*Math.PI,x=Math.sin(phi)*Math.cos(theta),y=Math.cos(phi),z=Math.sin(phi)*Math.sin(theta);p.push(x,y,z);n.push(x,y,z)}}for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+cols+1;ix.push(a,b,a+1,b,b+1,a+1)}return mesh(p,n,ix)}
function makeCube(){const p=[],n=[],ix=[];const sides=[[[1,0,0],[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]]],[[-1,0,0],[[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]]],[[0,1,0],[[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]]],[[0,-1,0],[[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]]],[[0,0,1],[[1,-1,1],[1,1,1],[-1,1,1],[-1,-1,1]]],[[0,0,-1],[[-1,-1,-1],[-1,1,-1],[1,1,-1],[1,-1,-1]]]];for(const [norm,pts] of sides){const b=p.length/3;for(const q of pts){p.push(...q);n.push(...norm)}ix.push(b,b+1,b+2,b,b+2,b+3)}return mesh(p,n,ix)}
function makeCylinder(){const p=[],n=[],ix=[],cols=22;for(let h=-1;h<=1;h+=2)for(let j=0;j<=cols;j++){const phi=2*Math.PI*j/cols,x=Math.cos(phi),z=Math.sin(phi);p.push(x,h,z);n.push(x,0,z)}for(let j=0;j<cols;j++){const a=j,b=j+cols+1;ix.push(a,b,a+1,b,b+1,a+1)}return mesh(p,n,ix)}
const SPHERE=makeSphere(),CUBE=makeCube(),CYL=makeCylinder();
function color(h){if(Array.isArray(h))return h;h=(h||'#dddddd').replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)}

let cfg={index:0,dance:'disco',bpm:120,playing:false,level:0,position:0,enabled:true};
const P=perspective(Math.PI/4,canvas.width/canvas.height,0.1,50),V=T(0,-.7,-4.8);
function shape(mesh3,color3,m){gl.uniformMatrix4fv(uMVP,false,new Float32Array(mul(P,mul(V,m))));gl.uniformMatrix4fv(uModel,false,new Float32Array(m));gl.uniform3fv(uColor,new Float32Array(color(color3)));gl.bindBuffer(gl.ARRAY_BUFFER,mesh3.vb);gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(aPos);gl.bindBuffer(gl.ARRAY_BUFFER,mesh3.nb);gl.vertexAttribPointer(aNorm,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(aNorm);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh3.ib);gl.drawElements(gl.TRIANGLES,mesh3.count,gl.UNSIGNED_SHORT,0)}
function rsh(mesh,color,parent,x,y,z,rx,ry,rz,sx,sy,sz){shape(mesh,color,TRS(parent,x,y,z,rx,ry,rz,sx,sy,sz))}
function draw(t){if(!cfg.enabled)return;gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const o=outfits[cfg.index]||outfits[0];
let beat=(cfg.playing?cfg.position:t*.3)*Math.PI*2*(cfg.bpm||120)/60;let e=cfg.playing?Math.max(.1,Math.min(1,cfg.level)):0.11;
const cyc=Math.sin(beat),half=Math.sin(beat*.5),quarter=Math.sin(beat*.25);let armA=.42*cyc,armB=-.48*cyc,legA=.3*Math.sin(beat+.6),legB=-.3*Math.sin(beat+.6),yaw=.12*half,lean=.06*cyc;
if(cfg.dance==='waltz'){armA=.9+.1*cyc;armB=-.86-.07*cyc;legA=.14*half;legB=-.16*half;yaw=.35*half;lean=.09*quarter}
else if(cfg.dance==='tango'){armA=.85+.17*cyc;armB=-.25;legA=.18*cyc;legB=-.48*(cyc>0?cyc:0);yaw=.18*cyc;lean=.07*half}
else if(cfg.dance==='hiphop'){armA=-.1+.65*cyc;armB=.25-.55*Math.sin(beat+.8);legA=.5*half;legB=-.52*half;lean=.15*cyc}
else if(cfg.dance==='popping'){armA=.7*Math.sign(cyc);armB=-.7*Math.sign(cyc);legA=.2*Math.sign(half);legB=-.2*Math.sign(half)}
else if(cfg.dance==='ballet'){armA=1.2+.2*half;armB=-1.2-.2*half;legA=.28*Math.sin(beat/2);legB=-.32*Math.cos(beat/2);yaw=.7*half}
else if(cfg.dance==='salsa'){armA=.45*Math.sin(beat*1.5);armB=-.45*Math.sin(beat*1.5+.8);legA=.4*cyc;legB=-.4*cyc;yaw=.3*half}
else if(cfg.dance==='rock'){armA=.75*cyc;armB=-.75*Math.sin(beat+.5);legA=.55*Math.sin(beat*.5);legB=-.55*Math.sin(beat*.5);lean=.15*cyc}
else if(cfg.dance==='shuffle'){armA=.2+.4*cyc;armB=-.2-.4*cyc;legA=.7*Math.sin(beat);legB=-.7*Math.sin(beat+.7)}
else if(cfg.dance==='swing'){armA=.65*Math.sin(beat+.4);armB=-.6*Math.sin(beat+.4);legA=.42*cyc;legB=-.42*cyc;yaw=.28*half}
else if(cfg.dance==='house'){armA=.52*cyc;armB=-.52*cyc;legA=.52*Math.sin(beat*.5);legB=-.48*Math.sin(beat*.5)}
const amt=cfg.playing?(.8+e*.32):.10;
const base=TRS(I(),0,Math.abs(cyc)*.045*amt,-.05,lean*amt,yaw*amt,.03*cyc,1,1,1);
// floor cast shadow (opaque dark ellipse)
rsh(SPHERE,'#253241',I(),0,-.48,-.2,0,0,0,.76,.025,.43);
// torso and neck
rsh(CUBE,o.body,base,0,.86,0,0,0,0,.28,.37,.2);
rsh(SPHERE,o.body,base,0,.67,0,0,0,0,.29,.17,.21);
rsh(CYL,o.skin,base,0,1.28,0,0,0,0,.105,.12,.105);
// legs articulated from hip
for(const [side,a] of [[-1,legA*amt],[1,legB*amt]]){
 const hip=TRS(base,side*.16,.48,0,a*.17,0,-a);
 rsh(CYL,o.legs,hip,0,-.35,0,0,0,0,.125,.34,.125);
 rsh(SPHERE,o.legs,hip,0,-.72,0,0,0,0,.13,.14,.14);
 rsh(CUBE,'#253a45',hip,0,-.8,.08,0,0,0,.16,.11,.28);
}
// shoulders, arms
for(const [side,a] of [[-1,armA*amt],[1,armB*amt]]){
 const shoulder=TRS(base,side*.37,1.12,0,0,0,-a+side*.1);
 rsh(SPHERE,o.body,shoulder,0,0,0,0,0,0,.15,.16,.16);
 rsh(CYL,o.body,shoulder,0,-.26,0,0,0,0,.105,.29,.105);
 rsh(SPHERE,o.skin,shoulder,0,-.6,0,0,0,0,.125,.12,.12);
}
// facial head
const face=TRS(base,0,1.54,0,0,.04*cyc,0);
rsh(o.head==='box'?CUBE:SPHERE,o.head==='box'?o.skin:o.skin,face,0,0,0,0,0,0,.24,.28,.23);
if(o.head==='afro'){rsh(SPHERE,o.hat,face,0,.22,-.045,0,0,0,.3,.20,.29)}
else if(o.head==='hat'){rsh(CYL,o.hat,face,0,.29,0,0,0,0,.31,.06,.31);rsh(CYL,o.hat,face,0,.39,0,0,0,0,.21,.16,.21)}
else if(o.head==='bandana'){rsh(CYL,o.hat,face,0,.19,0,0,0,0,.25,.07,.24)}
else if(o.head==='helmet'){rsh(SPHERE,o.hat,face,0,.08,-.04,0,0,0,.3,.36,.28);rsh(CUBE,o.skin,face,0,-.04,.19,0,0,0,.19,.15,.07)}
else if(o.head==='visor'){rsh(CUBE,o.hat,face,0,.035,.205,0,0,0,.245,.085,.045)}
else if(o.head==='elf'){rsh(SPHERE,o.hat,face,0,.23,-.035,0,0,0,.23,.13,.22);rsh(SPHERE,o.skin,face,-.26,.04,0,0,0,-.5,.16,.14,.09);rsh(SPHERE,o.skin,face,.26,.04,0,0,0,.5,.16,.14,.09)}
else if(o.head==='round'){rsh(SPHERE,o.hat,face,0,.19,-.06,0,0,0,.255,.12,.22)}
else if(o.head==='box'){rsh(CYL,o.hat,face,0,.35,0,0,0,0,.03,.1,.03);rsh(SPHERE,o.hat,face,0,.45,0,0,0,0,.065,.065,.065)}
if(o.head!=='helmet'&&o.head!=='visor'){
 rsh(SPHERE,'#162638',face,-.09,.03,.223,0,0,0,.025,.03,.024);rsh(SPHERE,'#162638',face,.09,.03,.223,0,0,0,.025,.03,.024);
 rsh(SPHERE,'#ab6e57',face,0,-.105,.23,0,0,0,.06,.019,.012)
}
// stylized belt and badge
rsh(CUBE,'#263e51',base,0,.66,.205,0,0,0,.26,.06,.018);
}
let last=0;function loop(ms){requestAnimationFrame(loop);if(!cfg.enabled)return;if(ms-last<28)return;last=ms;draw(ms/1000)}requestAnimationFrame(loop);
window.RetroAvatar3D={set(patch){Object.assign(cfg,patch)},models:outfits,ready:true};
})();
