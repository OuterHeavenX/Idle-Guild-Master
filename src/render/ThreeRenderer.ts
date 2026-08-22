import * as THREE from 'three';

export class ThreeRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  private readonly rune: THREE.Mesh;
  private time = 0;

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.className = 'three-layer';
    host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x070910);
    this.scene.fog = new THREE.FogExp2(0x070910, 0.06);
    this.camera.position.set(0, 0, 7);

    const geometry = new THREE.TorusKnotGeometry(1.35, 0.18, 96, 12);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4b1f63,
      emissive: 0x1f082b,
      roughness: 0.38,
      metalness: 0.65
    });
    this.rune = new THREE.Mesh(geometry, material);
    this.rune.position.z = -1;
    this.scene.add(this.rune);

    const key = new THREE.PointLight(0xff7a3d, 35, 20);
    key.position.set(-3, 3, 5);
    this.scene.add(key);

    const fill = new THREE.PointLight(0x4a6dff, 20, 15);
    fill.position.set(4, -2, 2);
    this.scene.add(fill);
    this.scene.add(new THREE.AmbientLight(0x6e6680, 0.7));
  }

  resize(width: number, height: number): void {
    this.camera.aspect = Math.max(0.01, width / height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render(deltaSeconds: number): void {
    this.time += deltaSeconds;
    this.rune.rotation.x = this.time * 0.07;
    this.rune.rotation.y = this.time * 0.11;
    const pulse = 1 + Math.sin(this.time * 0.8) * 0.04;
    this.rune.scale.setScalar(pulse);
    this.renderer.render(this.scene, this.camera);
  }
}
