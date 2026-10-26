import * as THREE from 'three';
import { TacticalUnitInstance } from '../../types/tactical';

const matCache = new Map<string, THREE.Material>();

function getMat(key: string, create: () => THREE.Material): THREE.Material {
  let m = matCache.get(key);
  if (!m) {
    m = create();
    matCache.set(key, m);
  }
  return m;
}

/**
 * Creates an articulated 3D Stickman Soldier (Line Infantry, Mage, Sniper, Heavy, etc.)
 */
export function createStickmanUnit3D(unit: TacticalUnitInstance): THREE.Group {
  const root = new THREE.Group();
  root.name = `tactical-unit-${unit.id}`;
  root.userData = { unitId: unit.id, unit };

  const isP1 = unit.owner === 'player1';
  const factionColor = isP1 ? 0x06b6d4 : 0xf43f5e;
  const factionHex = isP1 ? '#06b6d4' : '#f43f5e';

  // 1. Base Pedestal with Faction Ring
  const pedestalGeo = new THREE.CylinderGeometry(0.55, 0.62, 0.1, 20);
  const pedestalMat = getMat('stickman-pedestal', () =>
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.3,
    })
  );
  const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestal.position.y = 0.05;
  pedestal.receiveShadow = true;
  root.add(pedestal);

  const ringGeo = new THREE.TorusGeometry(0.58, 0.03, 8, 24);
  const ringMat = getMat(`faction-ring-${factionHex}`, () =>
    new THREE.MeshStandardMaterial({
      color: factionColor,
      emissive: factionColor,
      emissiveIntensity: 0.9,
    })
  );
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.1;
  root.add(ring);

  // Overwatch Stance Field Indicator
  if (unit.stance === 'overwatch') {
    const owRingGeo = new THREE.RingGeometry(0.65, 0.85, 24);
    owRingGeo.rotateX(-Math.PI / 2);
    const owMat = getMat('overwatch-glow', () =>
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      })
    );
    const owMesh = new THREE.Mesh(owRingGeo, owMat);
    owMesh.position.y = 0.02;
    owMesh.name = 'overwatch-aura';
    root.add(owMesh);
  }

  // 2. Stickman Body Group (Pivot at feet)
  const body = new THREE.Group();
  body.name = 'stickman-body';
  body.position.y = 0.1;

  // Decide Stickman Archetype based on definitionId or name or universe
  const defId = unit.definitionId || '';
  const nameLower = unit.name.toLowerCase();

  const isMage =
    unit.universe === 'arcane-dominion' ||
    defId.includes('arcane') ||
    nameLower.includes('จอมเวท') ||
    nameLower.includes('mage') ||
    nameLower.includes('magus') ||
    nameLower.includes('เวทมนตร์');

  const isSniper =
    defId.includes('sniper') ||
    nameLower.includes('ซุ่มยิง') ||
    nameLower.includes('marksman') ||
    nameLower.includes('ghost');

  const isHeavy =
    defId.includes('heavy') ||
    defId.includes('tank') ||
    nameLower.includes('รถถัง') ||
    nameLower.includes('goliath');

  if (isMage) {
    buildStickmanMage(body, factionColor);
  } else if (isSniper) {
    buildStickmanSniper(body, factionColor);
  } else if (isHeavy && defId.includes('tank')) {
    buildStickmanMiniTank(body, factionColor);
  } else {
    // Default: Line Infantry (สติกแมนทหารราบใส่หมวกทหาร ถือปืน)
    buildStickmanLineInfantry(body, factionColor);
  }

  root.add(body);

  // 3. Floating 3D HUD Billboard (Name, AP, HP, Ammo)
  const hudMesh = createTacticalUnitBillboard(unit);
  hudMesh.name = 'stickman-billboard';
  hudMesh.position.set(0, 1.85, 0);
  root.add(hudMesh);

  return root;
}

/**
 * 1. Stickman Line Infantry (สติกแมนทหารราบใส่หมวกเหล็กทหาร ถือปืนไรเฟิล)
 */
function buildStickmanLineInfantry(parent: THREE.Group, factionColor: number) {
  const blackStickMat = getMat('stickman-black-ink', () =>
    new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.2,
      roughness: 0.5,
    })
  );

  const helmetMat = getMat('military-steel-helmet', () =>
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.35,
    })
  );

  const rifleMat = getMat('infantry-rifle-wood-metal', () =>
    new THREE.MeshStandardMaterial({
      color: 0x27272a,
      metalness: 0.75,
      roughness: 0.3,
    })
  );

  const woodStockMat = getMat('rifle-wood-stock', () =>
    new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.6,
    })
  );

  // Legs
  const legL = createStickBone(0.045, 0.42, blackStickMat);
  legL.position.set(-0.11, 0.21, 0);
  parent.add(legL);

  const legR = createStickBone(0.045, 0.42, blackStickMat);
  legR.position.set(0.11, 0.21, 0);
  parent.add(legR);

  // Combat Boots
  const bootGeo = new THREE.BoxGeometry(0.1, 0.08, 0.16);
  const bootL = new THREE.Mesh(bootGeo, blackStickMat);
  bootL.position.set(-0.11, 0.04, 0.03);
  parent.add(bootL);

  const bootR = new THREE.Mesh(bootGeo, blackStickMat);
  bootR.position.set(0.11, 0.04, 0.03);
  parent.add(bootR);

  // Pelvis & Torso Spine
  const pelvisGeo = new THREE.SphereGeometry(0.07, 12, 12);
  const pelvis = new THREE.Mesh(pelvisGeo, blackStickMat);
  pelvis.position.set(0, 0.42, 0);
  parent.add(pelvis);

  const spine = createStickBone(0.05, 0.48, blackStickMat);
  spine.position.set(0, 0.66, 0);
  parent.add(spine);

  // Tactical Bandolier / Belt (Faction Colored)
  const beltGeo = new THREE.TorusGeometry(0.09, 0.025, 8, 16);
  const beltMat = new THREE.MeshStandardMaterial({
    color: factionColor,
    emissive: factionColor,
    emissiveIntensity: 0.6,
  });
  const belt = new THREE.Mesh(beltGeo, beltMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.set(0, 0.46, 0);
  parent.add(belt);

  // Backpack
  const packGeo = new THREE.BoxGeometry(0.24, 0.28, 0.14);
  const packMat = getMat('soldier-backpack', () =>
    new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.8 })
  );
  const pack = new THREE.Mesh(packGeo, packMat);
  pack.position.set(0, 0.68, -0.12);
  parent.add(pack);

  // Head Sphere
  const headGeo = new THREE.SphereGeometry(0.14, 16, 16);
  const head = new THREE.Mesh(headGeo, blackStickMat);
  head.position.set(0, 1.0, 0);
  parent.add(head);

  // Military Steel Helmet (หมวกทหารเหล็กทรงโบราณพร้อมปีกหมวก)
  const helmetDomeGeo = new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const helmetDome = new THREE.Mesh(helmetDomeGeo, helmetMat);
  helmetDome.position.set(0, 1.04, 0);
  parent.add(helmetDome);

  const helmetRimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16);
  const helmetRim = new THREE.Mesh(helmetRimGeo, helmetMat);
  helmetRim.position.set(0, 1.03, 0);
  parent.add(helmetRim);

  // Arms holding Rifle in combat firing stance
  const armL = createStickBone(0.04, 0.38, blackStickMat);
  armL.position.set(-0.16, 0.78, 0.1);
  armL.rotation.x = 0.8;
  armL.rotation.z = -0.3;
  parent.add(armL);

  const armR = createStickBone(0.04, 0.42, blackStickMat);
  armR.position.set(0.14, 0.76, 0.15);
  armR.rotation.x = 1.1;
  armR.rotation.y = -0.4;
  parent.add(armR);

  // 3D Military Combat Rifle (ถือปืน)
  const rifleGroup = new THREE.Group();
  rifleGroup.name = 'weapon-group';

  // Wooden stock
  const stockGeo = new THREE.BoxGeometry(0.06, 0.08, 0.3);
  const stock = new THREE.Mesh(stockGeo, woodStockMat);
  stock.position.set(0, 0, -0.1);
  rifleGroup.add(stock);

  // Steel barrel
  const barrelGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.55, 10);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, rifleMat);
  barrel.position.set(0, 0.02, 0.28);
  rifleGroup.add(barrel);

  // Muzzle Tip
  const muzzleGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.08, 8);
  muzzleGeo.rotateX(Math.PI / 2);
  const muzzle = new THREE.Mesh(muzzleGeo, rifleMat);
  muzzle.position.set(0, 0.02, 0.58);
  muzzle.name = 'muzzle-tip';
  rifleGroup.add(muzzle);

  rifleGroup.position.set(0.12, 0.72, 0.3);
  rifleGroup.rotation.x = -0.2;
  parent.add(rifleGroup);
}

/**
 * 2. Stickman Mage (สติกแมนจอมเวทย์ใส่หมวกเวทย์พ่อมด ถือไม้เท้า/ปืนเวทมนตร์)
 */
function buildStickmanMage(parent: THREE.Group, factionColor: number) {
  const stickMat = getMat('stickman-black-ink', () =>
    new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.2,
      roughness: 0.5,
    })
  );

  const hatMat = getMat('wizard-purple-hat', () =>
    new THREE.MeshStandardMaterial({
      color: 0x3b0764,
      metalness: 0.3,
      roughness: 0.6,
    })
  );

  const crystalMat = getMat('mage-crystal-glow', () =>
    new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0xc084fc,
      emissiveIntensity: 1.8,
      roughness: 0.1,
    })
  );

  // Legs
  const legL = createStickBone(0.045, 0.42, stickMat);
  legL.position.set(-0.11, 0.21, 0);
  parent.add(legL);

  const legR = createStickBone(0.045, 0.42, stickMat);
  legR.position.set(0.11, 0.21, 0);
  parent.add(legR);

  // Torso Spine
  const spine = createStickBone(0.05, 0.48, stickMat);
  spine.position.set(0, 0.66, 0);
  parent.add(spine);

  // Wizard Cloak / Robe draping down the back
  const cloakGeo = new THREE.ConeGeometry(0.26, 0.65, 8, 1, true, -Math.PI / 2, Math.PI);
  const cloakMat = new THREE.MeshStandardMaterial({
    color: 0x2e1065,
    side: THREE.DoubleSide,
    roughness: 0.7,
  });
  const cloak = new THREE.Mesh(cloakGeo, cloakMat);
  cloak.position.set(0, 0.62, -0.04);
  cloak.rotation.x = 0.15;
  parent.add(cloak);

  // Head Sphere with Glowing Eyes
  const headGeo = new THREE.SphereGeometry(0.14, 16, 16);
  const head = new THREE.Mesh(headGeo, stickMat);
  head.position.set(0, 1.0, 0);
  parent.add(head);

  // Glowing Mystic Visor/Eyes
  const eyesGeo = new THREE.BoxGeometry(0.12, 0.04, 0.06);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });
  const eyes = new THREE.Mesh(eyesGeo, eyeMat);
  eyes.position.set(0, 1.02, 0.12);
  parent.add(eyes);

  // Wizard Hat (หมวกเวทย์มนตร์ทรงกรวยแหลมพร้อมปีกกว้าง)
  const hatBrimGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.02, 20);
  const hatBrim = new THREE.Mesh(hatBrimGeo, hatMat);
  hatBrim.position.set(0, 1.06, 0);
  hatBrim.rotation.x = -0.08;
  parent.add(hatBrim);

  const hatConeGeo = new THREE.ConeGeometry(0.2, 0.55, 16);
  const hatCone = new THREE.Mesh(hatConeGeo, hatMat);
  hatCone.position.set(0, 1.34, -0.04);
  hatCone.rotation.x = -0.15;
  parent.add(hatCone);

  // Gold Star Ribbon on Hat
  const ribbonGeo = new THREE.TorusGeometry(0.16, 0.02, 8, 16);
  const ribbonMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.7,
  });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.rotation.x = Math.PI / 2;
  ribbon.position.set(0, 1.09, -0.01);
  parent.add(ribbon);

  // Arms holding glowing Arcane Staff / Spell Blaster
  const armL = createStickBone(0.04, 0.4, stickMat);
  armL.position.set(-0.16, 0.76, 0.1);
  armL.rotation.x = 0.6;
  parent.add(armL);

  const armR = createStickBone(0.04, 0.42, stickMat);
  armR.position.set(0.16, 0.76, 0.12);
  armR.rotation.x = 0.9;
  parent.add(armR);

  // Magic Staff / Spell Weapon
  const staffGroup = new THREE.Group();
  staffGroup.name = 'weapon-group';

  const rodGeo = new THREE.CylinderGeometry(0.025, 0.03, 1.1, 10);
  const rodMat = getMat('staff-wood', () =>
    new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 })
  );
  const rod = new THREE.Mesh(rodGeo, rodMat);
  rod.position.y = 0.55;
  staffGroup.add(rod);

  // Levitating Arcane Crystal on Staff Top
  const crystalGeo = new THREE.OctahedronGeometry(0.15, 0);
  const crystal = new THREE.Mesh(crystalGeo, crystalMat);
  crystal.position.y = 1.15;
  crystal.name = 'staff-crystal';
  staffGroup.add(crystal);

  // Orbiting Runic Ring around Crystal
  const runeRingGeo = new THREE.TorusGeometry(0.2, 0.015, 8, 20);
  const runeRing = new THREE.Mesh(runeRingGeo, crystalMat);
  runeRing.position.y = 1.15;
  runeRing.rotation.x = Math.PI / 3;
  runeRing.name = 'staff-rune-ring';
  staffGroup.add(runeRing);

  staffGroup.position.set(0.24, 0.3, 0.2);
  parent.add(staffGroup);
}

/**
 * 3. Stickman Sniper (สติกแมนพลแม่นปืนใส่หมวกเบเร่ต์ ถือปืนสไนเปอร์ลำกล้องยาว)
 */
function buildStickmanSniper(parent: THREE.Group, factionColor: number) {
  const stickMat = getMat('stickman-black-ink', () =>
    new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.2,
      roughness: 0.5,
    })
  );

  const beretMat = getMat('sniper-camo-beret', () =>
    new THREE.MeshStandardMaterial({
      color: 0x064e3b,
      roughness: 0.8,
    })
  );

  const rifleMat = getMat('sniper-rifle-finish', () =>
    new THREE.MeshStandardMaterial({
      color: 0x09090b,
      metalness: 0.9,
      roughness: 0.25,
    })
  );

  // Legs & Kneeling stance
  const legL = createStickBone(0.045, 0.4, stickMat);
  legL.position.set(-0.11, 0.2, -0.05);
  legL.rotation.x = -0.2;
  parent.add(legL);

  const legR = createStickBone(0.045, 0.42, stickMat);
  legR.position.set(0.11, 0.21, 0.05);
  legR.rotation.x = 0.2;
  parent.add(legR);

  // Torso
  const spine = createStickBone(0.05, 0.48, stickMat);
  spine.position.set(0, 0.65, 0);
  spine.rotation.x = 0.1;
  parent.add(spine);

  // Head
  const headGeo = new THREE.SphereGeometry(0.14, 16, 16);
  const head = new THREE.Mesh(headGeo, stickMat);
  head.position.set(0, 1.0, 0.04);
  parent.add(head);

  // Military Beret (หมวกเบเร่ต์)
  const beretGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.08, 16);
  const beret = new THREE.Mesh(beretGeo, beretMat);
  beret.position.set(0.04, 1.1, 0.02);
  beret.rotation.z = -0.25;
  parent.add(beret);

  // Long Scoped Sniper Rifle
  const rifleGroup = new THREE.Group();
  rifleGroup.name = 'weapon-group';

  // Body
  const bodyGeo = new THREE.BoxGeometry(0.06, 0.08, 0.5);
  const bodyMesh = new THREE.Mesh(bodyGeo, rifleMat);
  rifleGroup.add(bodyMesh);

  // Long Barrel
  const barrelGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.85, 10);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, rifleMat);
  barrel.position.set(0, 0.02, 0.55);
  rifleGroup.add(barrel);

  // Scope with glowing crosshair lens
  const scopeGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.26, 10);
  scopeGeo.rotateX(Math.PI / 2);
  const scope = new THREE.Mesh(scopeGeo, rifleMat);
  scope.position.set(0, 0.09, 0.05);
  rifleGroup.add(scope);

  const lensGeo = new THREE.CircleGeometry(0.03, 12);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.position.set(0, 0.09, 0.185);
  rifleGroup.add(lens);

  rifleGroup.position.set(0.08, 0.8, 0.35);
  rifleGroup.rotation.x = -0.1;
  parent.add(rifleGroup);
}

/**
 * 4. Stickman Mini-Tank (สติกแมนผู้บัญชาการขับรถถังจิ๋ว)
 */
function buildStickmanMiniTank(parent: THREE.Group, factionColor: number) {
  const armorMat = getMat('tank-armor-olive', () =>
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.35,
    })
  );

  const blackMat = getMat('tank-treads-black', () =>
    new THREE.MeshStandardMaterial({
      color: 0x09090b,
      metalness: 0.9,
      roughness: 0.4,
    })
  );

  // Tank Hull
  const hullGeo = new THREE.BoxGeometry(0.9, 0.4, 1.1);
  const hull = new THREE.Mesh(hullGeo, armorMat);
  hull.position.y = 0.25;
  hull.castShadow = true;
  parent.add(hull);

  // Left & Right Treads
  const treadGeo = new THREE.BoxGeometry(0.18, 0.32, 1.2);
  const treadL = new THREE.Mesh(treadGeo, blackMat);
  treadL.position.set(-0.46, 0.18, 0);
  parent.add(treadL);

  const treadR = new THREE.Mesh(treadGeo, blackMat);
  treadR.position.set(0.46, 0.18, 0);
  parent.add(treadR);

  // Turret
  const turretGeo = new THREE.CylinderGeometry(0.36, 0.42, 0.32, 16);
  const turret = new THREE.Mesh(turretGeo, armorMat);
  turret.position.set(0, 0.58, -0.05);
  parent.add(turret);

  // Heavy Cannon Barrel
  const cannonGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.85, 12);
  cannonGeo.rotateX(Math.PI / 2);
  const cannon = new THREE.Mesh(cannonGeo, blackMat);
  cannon.position.set(0, 0.62, 0.55);
  parent.add(cannon);

  // Hatch with Stickman Commander peeking out
  const hatchGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12);
  const hatch = new THREE.Mesh(hatchGeo, blackMat);
  hatch.position.set(0, 0.74, -0.15);
  parent.add(hatch);

  // Stickman Upper Body
  const headGeo = new THREE.SphereGeometry(0.1, 12, 12);
  const head = new THREE.Mesh(headGeo, blackMat);
  head.position.set(0, 0.94, -0.15);
  parent.add(head);

  // Helmet on commander
  const helmetGeo = new THREE.SphereGeometry(0.12, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const helmet = new THREE.Mesh(helmetGeo, armorMat);
  helmet.position.set(0, 0.98, -0.15);
  parent.add(helmet);
}

/**
 * Creates single stick bone segment (limb)
 */
function createStickBone(radius: number, length: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius, radius, length, 8);
  return new THREE.Mesh(geo, mat);
}

/**
 * Floating 3D HUD Billboard for AP, HP, Ammo, and Stance
 */
export function createTacticalUnitBillboard(unit: TacticalUnitInstance): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const isP1 = unit.owner === 'player1';
  const borderColor = isP1 ? '#06b6d4' : '#f43f5e';
  const bgColor = isP1 ? 'rgba(8, 20, 36, 0.92)' : 'rgba(36, 8, 16, 0.92)';

  // Rounded Box
  ctx.fillStyle = bgColor;
  roundRect(ctx, 6, 6, 244, 116, 14);
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Unit Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const nameStr = unit.name.length > 14 ? unit.name.substring(0, 13) + '..' : unit.name;
  ctx.fillText(nameStr, 128, 14);

  // Health Bar
  const hBarW = 208;
  const hBarH = 10;
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, 24, 44, hBarW, hBarH, 4);
  ctx.fill();

  const hRatio = Math.max(0, Math.min(1, unit.currentHealth / (unit.maxHealth || 1)));
  ctx.fillStyle = hRatio > 0.5 ? '#10b981' : hRatio > 0.25 ? '#f59e0b' : '#ef4444';
  roundRect(ctx, 24, 44, Math.max(6, hBarW * hRatio), hBarH, 4);
  ctx.fill();

  // AP Badges (Action Points ⚡)
  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`⚡ ${unit.currentAP}/${unit.maxAP} AP`, 24, 66);

  // HP Text
  ctx.fillStyle = '#6ee7b7';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`💚 ${unit.currentHealth}/${unit.maxHealth}`, 232, 66);

  // Ammo & Stance line
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px monospace';
  ctx.textAlign = 'left';
  const ammoDots = '●'.repeat(unit.currentAmmo) + '○'.repeat(Math.max(0, unit.maxAmmo - unit.currentAmmo));
  ctx.fillText(`🔫 ${ammoDots}`, 24, 94);

  if (unit.stance === 'overwatch') {
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('🛡️ OVERWATCH', 232, 94);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 0.8, 1);
  return sprite;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
