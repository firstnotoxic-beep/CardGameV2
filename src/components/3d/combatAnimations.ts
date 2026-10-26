import * as THREE from 'three';
import { soundFx } from '../../utils/audio';

// Reusable math vectors for zero-garbage collection in animation loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

export interface ActiveProjectile {
  mesh: THREE.Object3D;
  trailParticles?: THREE.Points;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  progress: number; // 0 to 1
  speed: number;
  arcHeight: number;
  kind: 'bullet' | 'cannon' | 'laser' | 'arcane' | 'missile';
  onHit?: () => void;
}

export interface ActiveMeteor {
  group: THREE.Group;
  tailParticles: THREE.Points;
  startPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  progress: number;
  speed: number;
  onImpact?: () => void;
}

export interface ActiveShockwave {
  mesh: THREE.Mesh;
  currentScale: number;
  maxScale: number;
  speed: number;
  opacity: number;
}

export interface ActiveDamageText {
  sprite: THREE.Sprite;
  currentY: number;
  maxY: number;
  opacity: number;
}

export interface ActiveDebrisParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  gravity: number;
  rotSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class CombatAnimationEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private projectiles: ActiveProjectile[] = [];
  private meteors: ActiveMeteor[] = [];
  private shockwaves: ActiveShockwave[] = [];
  private damageTexts: ActiveDamageText[] = [];
  private debrisList: ActiveDebrisParticle[] = [];

  // Camera shake state
  private cameraShakeIntensity: number = 0;
  private cameraShakeDecay: number = 0.92;
  private baseCameraOffset: THREE.Vector3 = new THREE.Vector3();

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
  }

  /**
   * Spawns a dramatic 3D Falling Meteor ("อุกกาบาตตกลงมาจริงๆ")
   */
  public spawnMeteor(targetPos: THREE.Vector3, onImpact?: () => void) {
    const meteorGroup = new THREE.Group();

    // 1. Core Fiery Asteroid Mesh
    const rockGeo = new THREE.DodecahedronGeometry(0.75, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x221105,
      emissive: 0xff3b00,
      emissiveIntensity: 2.2,
      roughness: 0.8,
      metalness: 0.3,
    });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    meteorGroup.add(rock);

    // 2. Outer Plasma Aura
    const auraGeo = new THREE.SphereGeometry(1.05, 16, 16);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.65,
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    meteorGroup.add(aura);

    // 3. Point Light attached to Meteor
    const meteorLight = new THREE.PointLight(0xff5500, 5, 12);
    meteorGroup.add(meteorLight);

    // 4. Trailing Smoke & Fire Tail Particles
    const tailCount = 120;
    const tailGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(tailCount * 3);
    const colors = new Float32Array(tailCount * 3);

    for (let i = 0; i < tailCount; i++) {
      const idx = i * 3;
      positions[idx] = (Math.random() - 0.5) * 0.4;
      positions[idx + 1] = Math.random() * 3.5;
      positions[idx + 2] = (Math.random() - 0.5) * 0.4;

      // Color from yellow to deep red
      const ratio = i / tailCount;
      colors[idx] = 1.0;
      colors[idx + 1] = Math.max(0, 0.8 - ratio * 0.7);
      colors[idx + 2] = 0.05;
    }
    tailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    tailGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const tailMat = new THREE.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const tail = new THREE.Points(tailGeo, tailMat);
    meteorGroup.add(tail);

    // Starting high in sky at diagonal angle
    const startPos = new THREE.Vector3(
      targetPos.x - 6.5,
      targetPos.y + 19,
      targetPos.z - 8.5
    );
    meteorGroup.position.copy(startPos);
    this.scene.add(meteorGroup);

    // Play falling audio
    soundFx.playMeteorImpact();

    this.meteors.push({
      group: meteorGroup,
      tailParticles: tail,
      startPos,
      targetPos: targetPos.clone(),
      progress: 0,
      speed: 1.6, // ~0.65 seconds to hit ground
      onImpact,
    });
  }

  /**
   * Triggers explosion shockwave, ground blast, sparks, and camera shake
   */
  public triggerImpactExplosion(pos: THREE.Vector3, isMeteor: boolean = false) {
    const scale = isMeteor ? 5.5 : 2.2;

    // 1. Flash of Light
    const flashLight = new THREE.PointLight(isMeteor ? 0xff6600 : 0x38bdf8, isMeteor ? 14 : 6, isMeteor ? 16 : 8);
    flashLight.position.set(pos.x, pos.y + 0.8, pos.z);
    this.scene.add(flashLight);
    setTimeout(() => {
      this.scene.remove(flashLight);
    }, 250);

    // 2. Expanding Ground Shockwave Ring
    const ringGeo = new THREE.RingGeometry(0.1, 0.45, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: isMeteor ? 0xff4400 : 0x06b6d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(pos.x, pos.y + 0.06, pos.z);
    this.scene.add(ring);

    this.shockwaves.push({
      mesh: ring,
      currentScale: 1,
      maxScale: scale,
      speed: isMeteor ? 9.5 : 6.0,
      opacity: 0.9,
    });

    // 3. Bursting Debris Sparks
    const sparkCount = isMeteor ? 45 : 18;
    const sparkGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: isMeteor ? 0xff9900 : 0x67e8f9,
    });

    for (let i = 0; i < sparkCount; i++) {
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.position.copy(pos);
      this.scene.add(spark);

      const angle = Math.random() * Math.PI * 2;
      const hSpeed = Math.random() * (isMeteor ? 8 : 4.5) + 1.5;
      const vSpeed = Math.random() * (isMeteor ? 10 : 5) + 2;

      this.debrisList.push({
        mesh: spark,
        velocity: new THREE.Vector3(
          Math.cos(angle) * hSpeed,
          vSpeed,
          Math.sin(angle) * hSpeed
        ),
        gravity: 16,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12
        ),
        life: 0,
        maxLife: isMeteor ? 0.9 : 0.5,
      });
    }

    // 4. Trigger Camera Tremor / Shake
    this.addCameraShake(isMeteor ? 0.45 : 0.15);
  }

  /**
   * Spawns a Ballistic or Laser Projectile between Units ("ทหารยิงกันจริงๆ")
   */
  public spawnShootingProjectile(
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    kind: 'bullet' | 'cannon' | 'laser' | 'arcane' | 'missile' = 'bullet',
    damageVal: number = 3,
    onHit?: () => void
  ) {
    let projMesh: THREE.Object3D;
    let arc = 0.25;
    let speed = 2.8;

    if (kind === 'laser') {
      // Sleek neon laser cylinder
      const geo = new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
      });
      projMesh = new THREE.Mesh(geo, mat);
      arc = 0.05; // Straight line
      speed = 3.6;
      soundFx.playGunshot('plasma');
    } else if (kind === 'cannon') {
      // Heavy glowing artillery shell
      const geo = new THREE.SphereGeometry(0.18, 12, 12);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: 0xf97316,
        emissiveIntensity: 1.8,
      });
      projMesh = new THREE.Mesh(geo, mat);
      arc = 2.4; // High mortar arc
      speed = 2.0;
      soundFx.playGunshot('cannon');
    } else if (kind === 'arcane') {
      // Homing magic energy orb
      const geo = new THREE.OctahedronGeometry(0.22, 1);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0xc084fc,
        emissiveIntensity: 2.2,
      });
      projMesh = new THREE.Mesh(geo, mat);
      arc = 0.8;
      speed = 2.2;
      soundFx.playAttack('arcane');
    } else {
      // Default kinetic tracer bullet
      const geo = new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
      });
      projMesh = new THREE.Mesh(geo, mat);
      arc = 0.2;
      speed = 3.2;
      soundFx.playGunshot('rifle');
    }

    projMesh.position.copy(startPos);
    this.scene.add(projMesh);

    // Orientation towards target
    projMesh.lookAt(endPos);

    this.projectiles.push({
      mesh: projMesh,
      startPos: startPos.clone(),
      endPos: endPos.clone(),
      progress: 0,
      speed,
      arcHeight: arc,
      kind,
      onHit: () => {
        // Trigger small impact burst
        this.triggerImpactExplosion(endPos, false);
        // Show floating damage number
        this.spawnDamageNumber(endPos, damageVal);
        if (onHit) onHit();
      },
    });
  }

  /**
   * Spawns a Floating 3D Damage Number ("-4 💥") above the hit unit
   */
  public spawnDamageNumber(pos: THREE.Vector3, damage: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`-${damage} 💥`, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.5, 0.75, 1);
    sprite.position.set(pos.x, pos.y + 1.8, pos.z);

    this.scene.add(sprite);

    this.damageTexts.push({
      sprite,
      currentY: pos.y + 1.8,
      maxY: pos.y + 3.2,
      opacity: 1.0,
    });
  }

  /**
   * Adds sudden camera shake
   */
  public addCameraShake(intensity: number) {
    this.cameraShakeIntensity = Math.min(0.65, this.cameraShakeIntensity + intensity);
  }

  /**
   * Main per-frame update loop
   */
  public update(delta: number) {
    // 1. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.progress += delta * p.speed;

      if (p.progress >= 1) {
        // Hit reached
        this.scene.remove(p.mesh);
        p.onHit?.();
        this.projectiles.splice(i, 1);
      } else {
        // Interpolate along arc
        p.mesh.position.lerpVectors(p.startPos, p.endPos, p.progress);
        const arcBonus = Math.sin(p.progress * Math.PI) * p.arcHeight;
        p.mesh.position.y += arcBonus;

        // Face trajectory tangent
        const nextT = Math.min(1, p.progress + 0.05);
        _v1.lerpVectors(p.startPos, p.endPos, nextT);
        _v1.y += Math.sin(nextT * Math.PI) * p.arcHeight;
        p.mesh.lookAt(_v1);
      }
    }

    // 2. Update Meteors
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.progress += delta * m.speed;

      if (m.progress >= 1) {
        // Impact ground!
        this.scene.remove(m.group);
        this.triggerImpactExplosion(m.targetPos, true);
        m.onImpact?.();
        this.meteors.splice(i, 1);
      } else {
        m.group.position.lerpVectors(m.startPos, m.targetPos, m.progress);
        // Spin meteorite on its axis
        m.group.rotation.x += delta * 6;
        m.group.rotation.y += delta * 8;
      }
    }

    // 3. Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.currentScale += delta * s.speed;
      s.opacity -= delta * 1.8;

      if (s.opacity <= 0 || s.currentScale >= s.maxScale) {
        this.scene.remove(s.mesh);
        this.shockwaves.splice(i, 1);
      } else {
        s.mesh.scale.set(s.currentScale, s.currentScale, s.currentScale);
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.opacity);
      }
    }

    // 4. Update Debris Sparks
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      d.life += delta;

      if (d.life >= d.maxLife) {
        this.scene.remove(d.mesh);
        this.debrisList.splice(i, 1);
      } else {
        d.velocity.y -= d.gravity * delta;
        d.mesh.position.addScaledVector(d.velocity, delta);
        d.mesh.rotation.x += d.rotSpeed.x * delta;
        d.mesh.rotation.y += d.rotSpeed.y * delta;
      }
    }

    // 5. Update Floating Damage Texts
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const t = this.damageTexts[i];
      t.currentY += delta * 1.2;
      t.opacity -= delta * 0.9;

      if (t.opacity <= 0) {
        this.scene.remove(t.sprite);
        this.damageTexts.splice(i, 1);
      } else {
        t.sprite.position.y = t.currentY;
        (t.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, t.opacity);
      }
    }

    // 6. Camera Tremor Shake
    if (this.cameraShakeIntensity > 0.005) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShakeIntensity;
      this.cameraShakeIntensity *= this.cameraShakeDecay;
    }
  }

  public dispose() {
    this.projectiles.forEach((p) => this.scene.remove(p.mesh));
    this.meteors.forEach((m) => this.scene.remove(m.group));
    this.shockwaves.forEach((s) => this.scene.remove(s.mesh));
    this.debrisList.forEach((d) => this.scene.remove(d.mesh));
    this.damageTexts.forEach((t) => this.scene.remove(t.sprite));
    this.projectiles = [];
    this.meteors = [];
    this.shockwaves = [];
    this.debrisList = [];
    this.damageTexts = [];
  }
}
