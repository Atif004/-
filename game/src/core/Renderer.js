// إعداد العارض + الجودة + الإضاءة السينمائية والسماء.
import * as THREE from 'three';
import { setMaxAnisotropy } from '../world/Textures.js';

const QUALITY = {
  low: { shadows: false, shadowSize: 512, pr: 0.75, far: 220 },
  medium: { shadows: true, shadowSize: 1024, pr: 1.25, far: 300 },
  high: { shadows: true, shadowSize: 2048, pr: 2, far: 400 },
};

export const isMobile = () => matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);

export function resolveQuality(q) {
  if (q !== 'auto') return q;
  return isMobile() ? 'medium' : 'high';
}

export class Renderer {
  constructor(container, save) {
    this.save = save;
    const q = resolveQuality(save.get('quality'));
    this.renderer = new THREE.WebGLRenderer({ antialias: q !== 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    setMaxAnisotropy(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
    this.dynScale = 1;
    this.fpsAcc = 0; this.fpsFrames = 0;
    this.buildEnvironment();
    this.applyQuality();
    save.onChange((k) => { if (k === 'quality') this.applyQuality(); });
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  buildEnvironment() {
    const s = this.scene;
    // سماء بتدرج لوني دافئ (ساعة ذهبية) مع توهج الشمس
    this.sunDir = new THREE.Vector3(-0.55, 0.42, -0.72).normalize();
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sunDir: { value: this.sunDir } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 sunDir; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 top = vec3(0.23, 0.45, 0.72);
          vec3 mid = vec3(0.72, 0.78, 0.84);
          vec3 hor = vec3(0.98, 0.80, 0.58);
          vec3 col = mix(hor, mid, smoothstep(0.0, 0.18, h));
          col = mix(col, top, smoothstep(0.15, 0.7, h));
          float sd = max(dot(normalize(vDir), sunDir), 0.0);
          col += vec3(1.0, 0.72, 0.4) * pow(sd, 12.0) * 0.55 + vec3(1.0, 0.9, 0.7) * pow(sd, 400.0) * 2.0;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), skyMat);
    this.sky.scale.setScalar(350);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    s.add(this.sky);
    s.fog = new THREE.Fog('#e8cfae', 70, 330);
    s.background = new THREE.Color('#e8cfae');

    this.hemi = new THREE.HemisphereLight('#bcd8ff', '#c9a77a', 1.45);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffd9a8', 2.6);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    const sc = this.sun.shadow.camera;
    sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 160;
    s.add(this.sun, this.sun.target);
    this.fill = new THREE.DirectionalLight('#9fc4ff', 0.35);
    this.fill.position.set(60, 40, 60);
    s.add(this.fill);
  }

  applyQuality() {
    this.qualityName = resolveQuality(this.save.get('quality'));
    const q = QUALITY[this.qualityName];
    this.q = q;
    this.renderer.shadowMap.enabled = q.shadows;
    this.sun.castShadow = q.shadows;
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    this.camera.far = q.far;
    this.scene.fog.far = q.far - 40;
    this.dynScale = 1;
    this.resize();
    // إعادة تجميع المواد لتفعيل/تعطيل الظلال
    this.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.q.pr) * this.dynScale);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** تتبع الظل للاعب حتى تبقى الظلال حادة على الأجهزة المتوسطة. */
  followShadow(target) {
    const x = Math.round(target.x / 2) * 2, z = Math.round(target.z / 2) * 2;
    this.sun.position.set(x + this.sunDir.x * 90, this.sunDir.y * 90, z + this.sunDir.z * 90);
    this.sun.target.position.set(x, 0, z);
    this.sky.position.copy(this.camera.position);
  }

  /** دقة ديناميكية: خفض الدقة تلقائيًا إذا انخفض معدل الإطارات. */
  adapt(dt) {
    if (this.save.get('quality') !== 'auto') return;
    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc < 2) return;
    const fps = this.fpsFrames / this.fpsAcc;
    this.fpsAcc = 0; this.fpsFrames = 0;
    const prev = this.dynScale;
    if (fps < 40 && this.dynScale > 0.6) this.dynScale -= 0.1;
    else if (fps > 57 && this.dynScale < 1) this.dynScale += 0.05;
    if (prev !== this.dynScale) this.resize();
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
