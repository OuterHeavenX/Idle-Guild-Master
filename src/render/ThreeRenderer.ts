import * as THREE from 'three';

export class ThreeRenderer {
  readonly renderer: THREE.WebGLRenderer; private readonly scene=new THREE.Scene(); private readonly camera=new THREE.PerspectiveCamera(50,1,.1,50); private time=0; private fogA:THREE.Mesh; private fogB:THREE.Mesh;
  constructor(host:HTMLElement){ this.renderer=new THREE.WebGLRenderer({antialias:false,alpha:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));this.renderer.domElement.className='three-layer';host.appendChild(this.renderer.domElement);this.renderer.setClearColor(0x070913,1);this.scene.fog=new THREE.FogExp2(0x0b0d18,.11);this.camera.position.set(0,0,6);
    const geo=new THREE.PlaneGeometry(8,3);const matA=new THREE.MeshBasicMaterial({color:0x6e78a8,transparent:true,opacity:.045,depthWrite:false});const matB=new THREE.MeshBasicMaterial({color:0xff8b4d,transparent:true,opacity:.025,depthWrite:false});this.fogA=new THREE.Mesh(geo,matA);this.fogB=new THREE.Mesh(geo.clone(),matB);this.fogA.position.set(-1,-.8,-1);this.fogB.position.set(1.5,.5,-2);this.scene.add(this.fogA,this.fogB); }
  resize(width:number,height:number):void{this.camera.aspect=Math.max(.01,width/height);this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);}
  render(dt:number):void{this.time+=dt;this.fogA.position.x=Math.sin(this.time*.13)*.8-1;this.fogB.position.x=Math.cos(this.time*.1)*1.1+1.5;this.fogA.rotation.z=Math.sin(this.time*.08)*.05;this.renderer.render(this.scene,this.camera);}
}
