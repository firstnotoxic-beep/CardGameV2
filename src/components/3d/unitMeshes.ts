import * as THREE from 'three';
import { UnitInstance, StructureInstance, OutpostState, Universe } from '../../types/game';

// Shared Materials & Geometries caches for peak performance & zero garbage collection
const materialCache = new Map<string, THREE.Material>();

function getCachedMaterial(key: string, createFn: () => THREE.Material): THREE.Material {
  let mat = materialCache.get(key);
  if (!mat) {
    mat = createFn();
    materialCache.set(key, mat);
  }
  return mat;
}

/**
 * Creates a composite 3-8 part procedural 3D model for a UnitInstance
 */
export function createUnit3DGroup(unit: UnitInstance): THREE.Group {
  const group = new THREE.Group();
  group.name = `unit-${unit.id}`;
  group.userData = { unitId: unit.id, unit };

  const isP1 = unit.owner === 'player1';
  const factionColor = isP1 ? 0x06b6d4 : 0xf43f5e;
  const factionHex = isP1 ? '#06b6d4' : '#f43f5e';

  // 1. Base Pedestal (Primary silhouette anchor, bottom-center pivot)
  const pedestalGeo = new THREE.CylinderGeometry(0.72, 0.8, 0.15, 24);
  const pedestalMat = getCachedMaterial('unit-pedestal', () =>
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.3,
    })
  );
  const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestal.position.y = 0.075;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  group.add(pedestal);

  // 2. Faction Glowing Ring on Pedestal
  const ringGeo = new THREE.TorusGeometry(0.74, 0.035, 12, 32);
  const ringMat = getCachedMaterial(`unit-ring-${factionHex}`, () =>
    new THREE.MeshStandardMaterial({
      color: factionColor,
      emissive: factionColor,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.5,
    })
  );
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.14;
  group.add(ring);

  // 3. Composite Hero Model by Universe
  const modelGroup = new THREE.Group();
  modelGroup.position.y = 0.15;
  modelGroup.name = 'unit-avatar-body';

  switch (unit.universe) {
    case 'iron-frontier':
      buildIronFrontierMech(modelGroup, factionColor);
      break;
    case 'arcane-dominion':
      buildArcaneDominionGolem(modelGroup, factionColor);
      break;
    case 'neo-genesis':
      buildNeoGenesisRunner(modelGroup, factionColor);
      break;
    case 'mythic-wilds':
      buildMythicWildsBeast(modelGroup, factionColor);
      break;
    case 'creators-circle':
    default:
      buildCreatorMatrixGuardian(modelGroup, factionColor);
      break;
  }

  group.add(modelGroup);

  // 4. Status Effect Auras
  if (unit.statusEffects.some((s) => s.type === 'shielded')) {
    const shieldGeo = new THREE.SphereGeometry(1.05, 16, 16);
    const shieldMat = getCachedMaterial('shield-bubble', () =>
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.5,
        transmission: 0.6,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
      })
    );
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldMesh.position.y = 0.9;
    group.add(shieldMesh);
  }

  return group;
}

/**
 * Iron Frontier: Heavy armored tactical mech / battle-tank
 */
function buildIronFrontierMech(parent: THREE.Group, factionColor: number) {
  // Lower chassis
  const chassisGeo = new THREE.BoxGeometry(0.8, 0.45, 0.9);
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.85,
    roughness: 0.35,
  });
  const chassis = new THREE.Mesh(chassisGeo, armorMat);
  chassis.position.y = 0.35;
  chassis.castShadow = true;
  parent.add(chassis);

  // Main Turret / Torso
  const torsoGeo = new THREE.CylinderGeometry(0.38, 0.45, 0.5, 12);
  const torsoMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.9,
    roughness: 0.25,
  });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = 0.72;
  torso.castShadow = true;
  parent.add(torso);

  // Visor Cockpit Glass (Glowing faction color)
  const visorGeo = new THREE.BoxGeometry(0.42, 0.12, 0.18);
  const visorMat = new THREE.MeshStandardMaterial({
    color: factionColor,
    emissive: factionColor,
    emissiveIntensity: 1.2,
    roughness: 0.1,
  });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.78, 0.34);
  parent.add(visor);

  // Dual Shoulder Heavy Cannons
  const cannonGeo = new THREE.CylinderGeometry(0.065, 0.08, 0.65, 10);
  const cannonMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.95,
    roughness: 0.2,
  });

  const cannonL = new THREE.Mesh(cannonGeo, cannonMat);
  cannonL.rotation.x = Math.PI / 2;
  cannonL.position.set(-0.38, 0.76, 0.22);
  parent.add(cannonL);

  const cannonR = new THREE.Mesh(cannonGeo, cannonMat);
  cannonR.rotation.x = Math.PI / 2;
  cannonR.position.set(0.38, 0.76, 0.22);
  parent.add(cannonR);

  // Rear Heavy Exhaust Vents
  const ventGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.35, 8);
  const ventMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 0.6,
  });
  const ventL = new THREE.Mesh(ventGeo, ventMat);
  ventL.position.set(-0.25, 0.6, -0.42);
  parent.add(ventL);

  const ventR = new THREE.Mesh(ventGeo, ventMat);
  ventR.position.set(0.25, 0.6, -0.42);
  parent.add(ventR);
}

/**
 * Arcane Dominion: Levitation Mystic Golem with floating runic crystals
 */
function buildArcaneDominionGolem(parent: THREE.Group, factionColor: number) {
  // Levitating Rune Core
  const coreGeo = new THREE.OctahedronGeometry(0.4, 0);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0xa855f7,
    emissiveIntensity: 1.4,
    roughness: 0.15,
    metalness: 0.7,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = 0.85;
  core.name = 'arcane-core';
  parent.add(core);

  // Orbiting Shards Ring
  const shardGeo = new THREE.TetrahedronGeometry(0.12);
  const shardMat = new THREE.MeshStandardMaterial({
    color: factionColor,
    emissive: factionColor,
    emissiveIntensity: 1.0,
  });

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const shard = new THREE.Mesh(shardGeo, shardMat);
    shard.position.set(Math.cos(angle) * 0.58, 0.85, Math.sin(angle) * 0.58);
    shard.name = `arcane-shard-${i}`;
    parent.add(shard);
  }

  // Cloaked Obsidian Mantle
  const mantleGeo = new THREE.ConeGeometry(0.5, 0.7, 8);
  const mantleMat = new THREE.MeshStandardMaterial({
    color: 0x1e1035,
    roughness: 0.4,
    metalness: 0.6,
  });
  const mantle = new THREE.Mesh(mantleGeo, mantleMat);
  mantle.position.y = 0.45;
  mantle.rotation.x = Math.PI;
  parent.add(mantle);

  // Mystic halo ring
  const haloGeo = new THREE.TorusGeometry(0.45, 0.02, 8, 24);
  const haloMat = new THREE.MeshStandardMaterial({
    color: 0xc084fc,
    emissive: 0xc084fc,
    emissiveIntensity: 1.1,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.position.y = 1.15;
  halo.rotation.x = Math.PI / 2.3;
  parent.add(halo);
}

/**
 * Neo Genesis: High-speed Cyber Hovercraft / Drone Runner
 */
function buildNeoGenesisRunner(parent: THREE.Group, factionColor: number) {
  // Aerodynamic Delta Hull
  const hullGeo = new THREE.ConeGeometry(0.48, 1.1, 4);
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x0f2027,
    metalness: 0.8,
    roughness: 0.2,
  });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = Math.PI / 2;
  hull.rotation.y = Math.PI / 4;
  hull.position.set(0, 0.65, 0);
  parent.add(hull);

  // Twin Plasma Wings
  const wingGeo = new THREE.BoxGeometry(1.2, 0.04, 0.45);
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.9,
    roughness: 0.3,
  });
  const wings = new THREE.Mesh(wingGeo, wingMat);
  wings.position.set(0, 0.6, -0.15);
  parent.add(wings);

  // Glowing Thruster Core
  const thrusterGeo = new THREE.CylinderGeometry(0.12, 0.18, 0.3, 12);
  const thrusterMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.5,
  });
  const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
  thruster.rotation.x = Math.PI / 2;
  thruster.position.set(0, 0.6, -0.45);
  parent.add(thruster);

  // Front Scanner Visor
  const sensorGeo = new THREE.SphereGeometry(0.12, 12, 12);
  const sensorMat = new THREE.MeshStandardMaterial({
    color: factionColor,
    emissive: factionColor,
    emissiveIntensity: 1.3,
  });
  const sensor = new THREE.Mesh(sensorGeo, sensorMat);
  sensor.position.set(0, 0.65, 0.52);
  parent.add(sensor);
}

/**
 * Mythic Wilds: Primal Armored Beast / Chimera
 */
function buildMythicWildsBeast(parent: THREE.Group, factionColor: number) {
  // Muscular stone body
  const bodyGeo = new THREE.DodecahedronGeometry(0.48, 0);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.7,
    metalness: 0.3,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.65;
  body.scale.set(1, 0.85, 1.3);
  parent.add(body);

  // Armored Horn Crests
  const hornGeo = new THREE.ConeGeometry(0.08, 0.4, 6);
  const hornMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0xb45309,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });

  const hornL = new THREE.Mesh(hornGeo, hornMat);
  hornL.position.set(-0.25, 0.98, 0.28);
  hornL.rotation.z = -0.35;
  hornL.rotation.x = 0.2;
  parent.add(hornL);

  const hornR = new THREE.Mesh(hornGeo, hornMat);
  hornR.position.set(0.25, 0.98, 0.28);
  hornR.rotation.z = 0.35;
  hornR.rotation.x = 0.2;
  parent.add(hornR);

  // Core Nature Runestone
  const gemGeo = new THREE.IcosahedronGeometry(0.2, 0);
  const gemMat = new THREE.MeshStandardMaterial({
    color: factionColor,
    emissive: factionColor,
    emissiveIntensity: 1.3,
  });
  const gem = new THREE.Mesh(gemGeo, gemMat);
  gem.position.set(0, 0.72, 0.38);
  parent.add(gem);
}

/**
 * Creators Circle: Matrix Wireframe Avatar
 */
function buildCreatorMatrixGuardian(parent: THREE.Group, factionColor: number) {
  // Outer Gyro Ring
  const gyroGeo = new THREE.TorusGeometry(0.5, 0.03, 8, 24);
  const gyroMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.1,
  });
  const gyro = new THREE.Mesh(gyroGeo, gyroMat);
  gyro.position.y = 0.75;
  gyro.name = 'creator-gyro';
  parent.add(gyro);

  // Inner Hypercube Prism
  const prismGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const prismMat = new THREE.MeshStandardMaterial({
    color: factionColor,
    emissive: factionColor,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });
  const prism = new THREE.Mesh(prismGeo, prismMat);
  prism.position.y = 0.75;
  prism.rotation.x = Math.PI / 4;
  prism.rotation.y = Math.PI / 4;
  prism.name = 'creator-prism';
  parent.add(prism);
}

/**
 * Builds a 3D Outpost (Supply, Fortress, Relay) with dynamic ownership crystal
 */
export function createOutpost3DGroup(outpost: OutpostState): THREE.Group {
  const group = new THREE.Group();
  group.name = `outpost-${outpost.id}`;
  group.userData = { outpostId: outpost.id, outpost };

  const ownerColor =
    outpost.owner === 'player1'
      ? 0x06b6d4
      : outpost.owner === 'player2'
      ? 0xf43f5e
      : 0xfbbf24; // Yellow/amber for neutral

  // 1. Fortified Heavy Base Platform
  const baseGeo = new THREE.CylinderGeometry(0.95, 1.08, 0.25, 16);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.8,
    roughness: 0.3,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.125;
  base.castShadow = true;
  group.add(base);

  // 2. Specific Architecture by Outpost Type
  if (outpost.type === 'supply') {
    // Twin Fuel Pods + Valve Piping
    const tankGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.7, 12);
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.85,
      roughness: 0.3,
    });
    const tank1 = new THREE.Mesh(tankGeo, tankMat);
    tank1.position.set(-0.4, 0.55, 0);
    group.add(tank1);

    const tank2 = new THREE.Mesh(tankGeo, tankMat);
    tank2.position.set(0.4, 0.55, 0);
    group.add(tank2);
  } else if (outpost.type === 'fortress') {
    // Heavy Bastion Tower
    const wallGeo = new THREE.BoxGeometry(0.9, 0.75, 0.9);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.9,
      roughness: 0.4,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 0.55;
    group.add(wall);
  } else {
    // Relay Spire
    const spireGeo = new THREE.ConeGeometry(0.35, 1.2, 8);
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2,
    });
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.y = 0.75;
    group.add(spire);

    // Rotating Radar Dish
    const dishGeo = new THREE.CylinderGeometry(0.4, 0.05, 0.12, 12);
    const dishMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.9,
      roughness: 0.2,
    });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.y = 1.35;
    dish.rotation.z = 0.4;
    dish.name = 'radar-dish';
    group.add(dish);
  }

  // 3. Central Levitating Ownership Power Crystal
  const crystalGeo = new THREE.OctahedronGeometry(0.35, 0);
  const crystalMat = new THREE.MeshStandardMaterial({
    color: ownerColor,
    emissive: ownerColor,
    emissiveIntensity: 1.5,
    roughness: 0.15,
  });
  const crystal = new THREE.Mesh(crystalGeo, crystalMat);
  crystal.position.y = 1.1;
  crystal.name = 'power-crystal';
  group.add(crystal);

  return group;
}

/**
 * Builds 3D Structure (Airbase, Bunker, Fabricator, etc.)
 */
export function createStructure3DGroup(structure: StructureInstance): THREE.Group {
  const group = new THREE.Group();
  group.name = `structure-${structure.id}`;
  group.userData = { structureId: structure.id, structure };

  const isP1 = structure.owner === 'player1';
  const factionColor = isP1 ? 0x06b6d4 : 0xf43f5e;

  // Base platform
  const padGeo = new THREE.BoxGeometry(1.6, 0.18, 1.6);
  const padMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.8,
    roughness: 0.4,
  });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.position.y = 0.09;
  pad.receiveShadow = true;
  group.add(pad);

  if (structure.structureType === 'airbase') {
    // Runway Chevron lights
    const runwayGeo = new THREE.BoxGeometry(0.8, 0.02, 1.4);
    const runwayMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
    });
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.position.y = 0.19;
    group.add(runway);

    // Control Tower Spire
    const towerGeo = new THREE.CylinderGeometry(0.18, 0.25, 0.9, 8);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.9,
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(0.55, 0.55, -0.45);
    group.add(tower);

    // Tower Beacon
    const beaconGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: factionColor,
      emissive: factionColor,
      emissiveIntensity: 1.8,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0.55, 1.05, -0.45);
    group.add(beacon);
  } else {
    // Bunker Dome
    const bunkerGeo = new THREE.SphereGeometry(0.7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const bunkerMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.35,
    });
    const bunker = new THREE.Mesh(bunkerGeo, bunkerMat);
    bunker.position.y = 0.18;
    group.add(bunker);
  }

  return group;
}

/**
 * Builds Massive Nexus Core Monument at Row 0 / Row 6
 */
export function createNexus3DGroup(owner: 'player1' | 'player2'): THREE.Group {
  const group = new THREE.Group();
  const isP1 = owner === 'player1';
  const color = isP1 ? 0x06b6d4 : 0xf43f5e;

  // Heavy Fortress Foundation
  const foundationGeo = new THREE.CylinderGeometry(2.2, 2.5, 0.6, 24);
  const foundationMat = new THREE.MeshStandardMaterial({
    color: 0x0b1329,
    metalness: 0.9,
    roughness: 0.25,
  });
  const foundation = new THREE.Mesh(foundationGeo, foundationMat);
  foundation.position.y = 0.3;
  foundation.receiveShadow = true;
  group.add(foundation);

  // Levitating Giant Crystal Pylon
  const pylonGeo = new THREE.OctahedronGeometry(1.1, 0);
  pylonGeo.scale(0.8, 1.8, 0.8);
  const pylonMat = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.6,
    roughness: 0.1,
    metalness: 0.2,
    transmission: 0.4,
    transparent: true,
    opacity: 0.95,
  });
  const pylon = new THREE.Mesh(pylonGeo, pylonMat);
  pylon.position.y = 2.4;
  pylon.name = 'nexus-core-crystal';
  group.add(pylon);

  // Orbiting Energy Concentric Rings
  const ringGeo = new THREE.TorusGeometry(1.6, 0.045, 8, 36);
  const ringMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.2,
  });
  const ring1 = new THREE.Mesh(ringGeo, ringMat);
  ring1.position.y = 2.4;
  ring1.rotation.x = Math.PI / 3;
  ring1.name = 'nexus-ring-1';
  group.add(ring1);

  const ring2 = new THREE.Mesh(ringGeo, ringMat);
  ring2.position.y = 2.4;
  ring2.rotation.x = -Math.PI / 3;
  ring2.name = 'nexus-ring-2';
  group.add(ring2);

  return group;
}
