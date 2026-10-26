import * as THREE from 'three';
import { TacticalCell, TacticalStructureInstance } from '../../types/tactical';

const envMatCache = new Map<string, THREE.Material>();

function getEnvMat(key: string, create: () => THREE.Material): THREE.Material {
  let m = envMatCache.get(key);
  if (!m) {
    m = create();
    envMatCache.set(key, m);
  }
  return m;
}

/**
 * Creates 3D procedural Trees for Forest Tiles ("ป่าเป็นป่า")
 */
export function createForestGrove3D(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'forest-grove';

  const trunkMat = getEnvMat('tree-trunk-bark', () =>
    new THREE.MeshStandardMaterial({
      color: 0x3d2314,
      roughness: 0.85,
      metalness: 0.1,
    })
  );

  const leavesMat1 = getEnvMat('tree-leaves-pine-1', () =>
    new THREE.MeshStandardMaterial({
      color: 0x166534,
      roughness: 0.75,
      metalness: 0.05,
    })
  );

  const leavesMat2 = getEnvMat('tree-leaves-pine-2', () =>
    new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.8,
      metalness: 0.05,
    })
  );

  // 3 distinct trees per forest tile
  const offsets = [
    { x: -0.35, z: -0.28, scale: 0.9, height: 1.1 },
    { x: 0.38, z: 0.22, scale: 1.05, height: 1.25 },
    { x: -0.12, z: 0.35, scale: 0.8, height: 0.95 },
  ];

  offsets.forEach((t, i) => {
    const tree = new THREE.Group();
    tree.position.set(t.x, 0, t.z);
    tree.scale.set(t.scale, t.scale, t.scale);

    // Tree Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.06, 0.09, t.height * 0.45, 8);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = (t.height * 0.45) / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // Multi-tier layered foliage crown
    const tierCount = 3;
    for (let j = 0; j < tierCount; j++) {
      const radius = 0.42 - j * 0.1;
      const coneHeight = 0.48 - j * 0.08;
      const coneGeo = new THREE.ConeGeometry(radius, coneHeight, 8);
      const cone = new THREE.Mesh(coneGeo, j % 2 === 0 ? leavesMat1 : leavesMat2);
      cone.position.y = t.height * 0.35 + j * 0.26;
      cone.castShadow = true;
      tree.add(cone);
    }

    group.add(tree);
  });

  return group;
}

/**
 * Creates 3D Fortress Bastion / Bunker / Sandbag Fort ("ป้อมเป็นป้อม")
 */
export function createFortressBastion3D(isStructure: boolean = false): THREE.Group {
  const group = new THREE.Group();
  group.name = 'fortress-bastion';

  const stoneMat = getEnvMat('fortress-stone-block', () =>
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.4,
      roughness: 0.7,
    })
  );

  const metalMat = getEnvMat('fortress-steel-plate', () =>
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.35,
    })
  );

  const sandbagMat = getEnvMat('bunker-sandbags', () =>
    new THREE.MeshStandardMaterial({
      color: 0xa16207,
      roughness: 0.9,
    })
  );

  // Main Heavy Bastion Stone Tower
  const towerGeo = new THREE.BoxGeometry(1.2, 0.75, 1.2);
  const tower = new THREE.Mesh(towerGeo, stoneMat);
  tower.position.y = 0.375;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  // Crenellations on roof
  const merlonGeo = new THREE.BoxGeometry(0.24, 0.18, 0.24);
  const cornerOffsets = [
    { x: -0.48, z: -0.48 },
    { x: 0.48, z: -0.48 },
    { x: -0.48, z: 0.48 },
    { x: 0.48, z: 0.48 },
  ];
  cornerOffsets.forEach((co) => {
    const merlon = new THREE.Mesh(merlonGeo, stoneMat);
    merlon.position.set(co.x, 0.84, co.z);
    group.add(merlon);
  });

  // Reinforced Gun Slits / Embrasure
  const slitGeo = new THREE.BoxGeometry(0.35, 0.08, 0.08);
  const slitMat = new THREE.MeshBasicMaterial({ color: 0x09090b });
  const slitFront = new THREE.Mesh(slitGeo, slitMat);
  slitFront.position.set(0, 0.48, 0.61);
  group.add(slitFront);

  // Sandbags stacked in front
  const sandbagCount = 3;
  for (let i = 0; i < sandbagCount; i++) {
    const bagGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.38, 8);
    bagGeo.rotateZ(Math.PI / 2);
    const bag = new THREE.Mesh(bagGeo, sandbagMat);
    bag.position.set((i - 1) * 0.36, 0.1, 0.75);
    group.add(bag);
  }

  // Spotlight / Searchlight on tower roof
  const lightHousingGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.14, 10);
  lightHousingGeo.rotateX(Math.PI / 2);
  const lightHousing = new THREE.Mesh(lightHousingGeo, metalMat);
  lightHousing.position.set(0, 0.84, 0);
  group.add(lightHousing);

  const lensGeo = new THREE.CircleGeometry(0.07, 12);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.position.set(0, 0.84, 0.075);
  group.add(lens);

  return group;
}

/**
 * Creates 3D Military Command HQ / Radar / Factory Structure
 */
export function createTacticalStructureMesh(structure: TacticalStructureInstance): THREE.Group {
  const group = new THREE.Group();
  group.name = `structure-${structure.id}`;

  const isP1 = structure.owner === 'player1';
  const factionColor = isP1 ? 0x06b6d4 : structure.owner === 'player2' ? 0xf43f5e : 0xf59e0b;

  const baseMat = getEnvMat('structure-base-concrete', () =>
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.6,
      roughness: 0.5,
    })
  );

  const roofMat = getEnvMat('structure-roof-dark', () =>
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.3,
    })
  );

  // Foundation Slab
  const slabGeo = new THREE.BoxGeometry(1.6, 0.18, 1.6);
  const slab = new THREE.Mesh(slabGeo, baseMat);
  slab.position.y = 0.09;
  slab.receiveShadow = true;
  group.add(slab);

  if (structure.type === 'hq') {
    // Large Two-Story Command Building
    const buildingGeo = new THREE.BoxGeometry(1.3, 0.75, 1.3);
    const building = new THREE.Mesh(buildingGeo, baseMat);
    building.position.y = 0.55;
    group.add(building);

    // Glowing Tactical War Table inside / Roof Array
    const roofDomeGeo = new THREE.ConeGeometry(0.75, 0.4, 4);
    roofDomeGeo.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofDomeGeo, roofMat);
    roof.position.y = 1.12;
    group.add(roof);

    // Faction Command Banner / Flag
    const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(0.5, 1.4, 0.5);
    group.add(pole);

    const flagGeo = new THREE.PlaneGeometry(0.35, 0.22);
    const flagMat = new THREE.MeshBasicMaterial({
      color: factionColor,
      side: THREE.DoubleSide,
    });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.68, 1.7, 0.5);
    group.add(flag);
  } else if (structure.type === 'factory') {
    // Heavy Industrial Facility with Smokestacks
    const shedGeo = new THREE.BoxGeometry(1.4, 0.6, 1.2);
    const shed = new THREE.Mesh(shedGeo, baseMat);
    shed.position.y = 0.48;
    group.add(shed);

    // Twin Smokestacks
    const stackGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.85, 10);
    const stack1 = new THREE.Mesh(stackGeo, roofMat);
    stack1.position.set(-0.35, 1.1, -0.3);
    group.add(stack1);

    const stack2 = new THREE.Mesh(stackGeo, roofMat);
    stack2.position.set(0.35, 1.1, -0.3);
    group.add(stack2);
  } else {
    // Radar Tower / Supply Depot
    const spireGeo = new THREE.CylinderGeometry(0.08, 0.35, 1.4, 8);
    const spire = new THREE.Mesh(spireGeo, baseMat);
    spire.position.y = 0.75;
    group.add(spire);

    // Rotating Radar Dish
    const dishGeo = new THREE.CylinderGeometry(0.4, 0.05, 0.12, 16);
    const dishMat = new THREE.MeshStandardMaterial({
      color: factionColor,
      emissive: factionColor,
      emissiveIntensity: 0.8,
    });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.y = 1.45;
    dish.rotation.z = 0.35;
    dish.name = 'radar-spire-dish';
    group.add(dish);
  }

  return group;
}

/**
 * Creates 3D Bridge over Water
 */
export function createTacticalBridge3D(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'wooden-bridge';

  const woodMat = getEnvMat('bridge-heavy-planks', () =>
    new THREE.MeshStandardMaterial({
      color: 0x5c2e0b,
      roughness: 0.8,
    })
  );

  // Bridge Deck
  const deckGeo = new THREE.BoxGeometry(0.95, 0.12, 1.8);
  const deck = new THREE.Mesh(deckGeo, woodMat);
  deck.position.y = 0.16;
  deck.receiveShadow = true;
  group.add(deck);

  // Bridge Rails
  const railGeo = new THREE.BoxGeometry(0.06, 0.22, 1.8);
  const railL = new THREE.Mesh(railGeo, woodMat);
  railL.position.set(-0.44, 0.32, 0);
  group.add(railL);

  const railR = new THREE.Mesh(railGeo, woodMat);
  railR.position.set(0.44, 0.32, 0);
  group.add(railR);

  return group;
}
