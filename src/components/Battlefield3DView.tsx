import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  GameState,
  UnitInstance,
  StructureInstance,
  Lane,
} from '../types/game';
import { CARD_DATABASE } from '../data/cards';
import { getCellId } from '../game/battlefield';
import {
  createTerrainTexture,
  createUnitBillboardTexture,
} from './3d/boardTextures';
import {
  createUnit3DGroup,
  createOutpost3DGroup,
  createStructure3DGroup,
  createNexus3DGroup,
} from './3d/unitMeshes';
import { CombatAnimationEngine } from './3d/combatAnimations';
import {
  Zap,
  Castle,
  Radio,
  Eye,
  Camera,
  Layers,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Shield,
  Swords,
  Heart,
  Plane,
  RotateCcw,
  Sparkles,
  Flame,
  Bomb,
} from 'lucide-react';

export interface Battlefield3DViewProps {
  state: GameState;
  onCellClick: (cellId: string) => void;
  onUnitClick: (unit: UnitInstance) => void;
  onAirbaseDropClick: (structure: StructureInstance) => void;
  onLaneClick?: (lane: Lane) => void;
  canPerformAirborneDrop: boolean;
  selectedAirbase: StructureInstance | null;
  onToggle2DMode?: () => void;
}

// 3D Grid Layout Constants
const SPACING_X = 2.9;
const SPACING_Z = 2.45;
const TILE_WIDTH = 2.5;
const TILE_DEPTH = 2.1;
const TILE_HEIGHT = 0.22;

export const Battlefield3DView: React.FC<Battlefield3DViewProps> = ({
  state,
  onCellClick,
  onUnitClick,
  onAirbaseDropClick,
  onLaneClick,
  canPerformAirborneDrop,
  selectedAirbase,
  onToggle2DMode,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Bottom dock collapse state (Compliant with Three.js Skill layout directives)
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<'isometric' | 'topdown' | 'frontline' | 'opponent'>('isometric');
  const [hoveredInfo, setHoveredInfo] = useState<{
    cellId?: string;
    unit?: UnitInstance;
    structure?: StructureInstance;
    lane?: Lane;
    terrain?: string;
  } | null>(null);

  // References to keep mutable three.js objects across renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cellMeshesMap = useRef<Map<string, THREE.Mesh>>(new Map());
  const unitMeshesMap = useRef<Map<string, THREE.Group>>(new Map());
  const interactiveColliders = useRef<THREE.Mesh[]>([]);
  const dynamicObjectsGroup = useRef<THREE.Group>(new THREE.Group());
  const combatEngineRef = useRef<CombatAnimationEngine | null>(null);
  const hoveredMeshRef = useRef<THREE.Mesh | null>(null);

  // Active target camera position for smooth damped transitions
  const targetCameraPos = useRef(new THREE.Vector3(0, 15, 14.5));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  // Current state ref for raycaster events to avoid stale closures
  const stateRef = useRef(state);
  stateRef.current = state;
  const callbacksRef = useRef({
    onCellClick,
    onUnitClick,
    onAirbaseDropClick,
    canPerformAirborneDrop,
    selectedAirbase,
  });
  callbacksRef.current = {
    onCellClick,
    onUnitClick,
    onAirbaseDropClick,
    canPerformAirborneDrop,
    selectedAirbase,
  };

  // Setup WebGL Scene once on mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software-WebGL Detection (Rule 1 & 2 of Three.js skill)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Modern Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // 3. Scene and Fog matching cosmic arena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    scene.fog = new THREE.FogExp2(0x060913, 0.022);
    sceneRef.current = scene;

    // 4. Studio Environment Reflection via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 5. Camera Setup
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      120
    );
    camera.position.set(0, 15, 14.5);
    cameraRef.current = camera;

    // 6. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 7;
    controls.maxDistance = 28;
    controls.maxPolarAngle = Math.PI / 2.05; // Prevent viewing underneath the table
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 7. Balanced 3-Point Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xdbeafe, 2.2);
    keyLight.position.set(10, 22, 12);
    keyLight.castShadow = !isSoftwareGl;
    if (keyLight.castShadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 40;
      keyLight.shadow.camera.left = -12;
      keyLight.shadow.camera.right = 12;
      keyLight.shadow.camera.top = 12;
      keyLight.shadow.camera.bottom = -12;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.1);
    fillLight.position.set(-12, 15, -10);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 0.9);
    rimLight.position.set(0, 8, -16);
    scene.add(rimLight);

    const hemiLight = new THREE.HemisphereLight(0x1e3a5f, 0x090d16, 1.2);
    scene.add(hemiLight);

    // 8. Ground Arena Floor & Support Frame
    const basePlateGeo = new THREE.BoxGeometry(11.5, 0.5, 20);
    const basePlateMat = new THREE.MeshStandardMaterial({
      color: 0x080c16,
      metalness: 0.9,
      roughness: 0.25,
    });
    const basePlate = new THREE.Mesh(basePlateGeo, basePlateMat);
    basePlate.position.y = -0.35;
    basePlate.receiveShadow = true;
    scene.add(basePlate);

    // Arena Perimeter Glow Border
    const borderGeo = new THREE.BoxGeometry(11.8, 0.1, 20.3);
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0284c7,
      emissiveIntensity: 0.8,
    });
    const borderGlow = new THREE.Mesh(borderGeo, borderMat);
    borderGlow.position.y = -0.58;
    scene.add(borderGlow);

    // Ambient floating starlight particles
    const starGeo = new THREE.BufferGeometry();
    const starCount = 350;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 50;
      starPositions[i + 1] = Math.random() * 25 - 2;
      starPositions[i + 2] = (Math.random() - 0.5) * 50;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.15,
      transparent: true,
      opacity: 0.65,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Add Dynamic Objects Group (units, outposts, structures, indicators)
    scene.add(dynamicObjectsGroup.current);

    // Initialize 3D Combat Animation Engine (Projectiles, Meteors, FX)
    combatEngineRef.current = new CombatAnimationEngine(scene, camera);

    // 9. Static 7x3 Board Tiles Generation
    const tileGeometry = new THREE.BoxGeometry(TILE_WIDTH, TILE_HEIGHT, TILE_DEPTH);
    const cellsMap = cellMeshesMap.current;
    cellsMap.clear();
    interactiveColliders.current = [];

    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 3; col++) {
        const cellId = getCellId(row, col);
        const cell = stateRef.current.cells[cellId];
        const terrain = cell?.terrainType || 'plains';
        const texture = createTerrainTexture(terrain);

        const tileMaterial = new THREE.MeshStandardMaterial({
          map: texture,
          metalness: 0.6,
          roughness: 0.4,
          color: 0xffffff,
          emissive: 0x000000,
        });

        const tileMesh = new THREE.Mesh(tileGeometry, tileMaterial);
        const posX = (col - 1) * SPACING_X;
        const posZ = (row - 3) * SPACING_Z;
        tileMesh.position.set(posX, 0, posZ);
        tileMesh.receiveShadow = true;
        tileMesh.castShadow = false;
        tileMesh.userData = { cellId, row, col, type: 'cell' };

        scene.add(tileMesh);
        cellsMap.set(cellId, tileMesh);
        interactiveColliders.current.push(tileMesh);
      }
    }

    // 10. Nexus Bases at Ends
    const opponentNexus = createNexus3DGroup('player2');
    opponentNexus.position.set(0, 0, -3 * SPACING_Z - 2.8);
    scene.add(opponentNexus);

    const playerNexus = createNexus3DGroup('player1');
    playerNexus.position.set(0, 0, 3 * SPACING_Z + 2.8);
    scene.add(playerNexus);

    // Raycaster for mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getPointerPos = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
    };

    const handlePointerMove = (e: MouseEvent) => {
      const pos = getPointerPos(e);
      mouse.x = pos.x;
      mouse.y = pos.y;
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(interactiveColliders.current, true);
      if (intersects.length > 0) {
        let hitObject: THREE.Object3D | null = intersects[0].object;
        while (hitObject && !hitObject.userData?.cellId && !hitObject.userData?.unitId && hitObject.parent) {
          hitObject = hitObject.parent;
        }

        if (hitObject?.userData?.cellId) {
          const hitCellId = hitObject.userData.cellId as string;
          const hitCell = stateRef.current.cells[hitCellId];
          const unit = hitCell?.unitId ? stateRef.current.units[hitCell.unitId] : undefined;
          const structure = hitCell?.structureId ? stateRef.current.structures[hitCell.structureId] : undefined;

          setHoveredInfo({
            cellId: hitCellId,
            unit,
            structure,
            lane: hitCell?.lane,
            terrain: hitCell?.terrainType,
          });
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        setHoveredInfo(null);
        renderer.domElement.style.cursor = 'default';
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      // Only process left click
      if (e.button !== 0) return;

      const pos = getPointerPos(e);
      mouse.x = pos.x;
      mouse.y = pos.y;
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(interactiveColliders.current, true);
      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object;
        while (hitObj && !hitObj.userData?.cellId && !hitObj.userData?.unitId && hitObj.parent) {
          hitObj = hitObj.parent;
        }

        if (hitObj?.userData?.cellId) {
          const targetCellId = hitObj.userData.cellId as string;
          const currentState = stateRef.current;
          const currentCell = currentState.cells[targetCellId];
          const currentUnit = currentCell?.unitId ? currentState.units[currentCell.unitId] : null;

          // If in card-targeting mode
          if (currentState.actionMode === 'card-targeting') {
            if (currentState.validTargetCellIds?.includes(targetCellId)) {
              const activeHandCard = currentState.player1.hand.find(
                (c) => c.instanceId === currentState.selectedCardInstanceId
              );
              const cardDef = activeHandCard ? CARD_DATABASE[activeHandCard.definitionId] : null;
              const isMeteorOrBlast =
                cardDef &&
                (cardDef.id === 'SPELL-METEOR' ||
                  cardDef.id === 'AD-07' ||
                  cardDef.name.includes('อุกกาบาต') ||
                  cardDef.name.includes('Meteor') ||
                  cardDef.name.includes('ระเบิด') ||
                  cardDef.name.includes('Bomb') ||
                  cardDef.targetRule?.effectType === 'damage' ||
                  cardDef.targetRule?.effectType === 'aoe-damage');

              if (isMeteorOrBlast && currentCell) {
                const targetPos = new THREE.Vector3(
                  (currentCell.col - 1) * SPACING_X,
                  0.1,
                  (currentCell.row - 3) * SPACING_Z
                );
                combatEngineRef.current?.spawnMeteor(targetPos, () => {
                  callbacksRef.current.onCellClick(targetCellId);
                });
              } else {
                callbacksRef.current.onCellClick(targetCellId);
              }
            }
            return;
          }

          // If in attack mode and cell is attackable: trigger realistic shooting & projectile animation!
          if (
            currentState.actionMode === 'attack' &&
            currentState.selectedUnitId &&
            currentState.attackableCellIds.includes(targetCellId)
          ) {
            const attacker = currentState.units[currentState.selectedUnitId];
            if (attacker && currentCell) {
              const startPos = new THREE.Vector3(
                (attacker.col - 1) * SPACING_X,
                0.8,
                (attacker.row - 3) * SPACING_Z
              );
              const endPos = new THREE.Vector3(
                (currentCell.col - 1) * SPACING_X,
                0.8,
                (currentCell.row - 3) * SPACING_Z
              );

              // Attacker physical recoil & rotation
              const attackerMesh = unitMeshesMap.current.get(attacker.id);
              if (attackerMesh) {
                attackerMesh.lookAt(endPos.x, attackerMesh.position.y, endPos.z);
                attackerMesh.position.y += 0.25;
                attackerMesh.rotation.x -= 0.35;
                setTimeout(() => {
                  if (attackerMesh) {
                    attackerMesh.position.y = 0.1;
                    attackerMesh.rotation.x = 0;
                  }
                }, 180);
              }

              let kind: 'bullet' | 'cannon' | 'laser' | 'arcane' | 'missile' = 'bullet';
              if (attacker.universe === 'iron-frontier') {
                kind = attacker.range > 1 ? 'cannon' : 'bullet';
              } else if (attacker.universe === 'neo-genesis') {
                kind = 'laser';
              } else if (attacker.universe === 'arcane-dominion') {
                kind = 'arcane';
              }

              combatEngineRef.current?.spawnShootingProjectile(
                startPos,
                endPos,
                kind,
                attacker.attack,
                () => {
                  callbacksRef.current.onCellClick(targetCellId);
                }
              );
              return;
            }
          }

          // If unit click on active player unit (and not in attack targeting)
          if (
            currentUnit &&
            currentUnit.owner === currentState.activePlayerId &&
            currentState.actionMode !== 'attack'
          ) {
            callbacksRef.current.onUnitClick(currentUnit);
          } else {
            callbacksRef.current.onCellClick(targetCellId);
          }
        }
      }
    };

    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('click', handlePointerDown);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Animation & Render Loop (Rule 3 Three.js skill)
    let animationFrameId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth camera position damping to target
      camera.position.lerp(targetCameraPos.current, 0.08);
      controls.target.lerp(targetLookAt.current, 0.08);
      controls.update();

      // Update Combat Animations (projectiles, falling meteors, debris, camera shake)
      combatEngineRef.current?.update(delta);

      // Subtle dynamic animations
      // Orbiting particles and crystal floating motions
      scene.traverse((obj) => {
        if (obj.name === 'nexus-core-crystal') {
          obj.rotation.y += delta * 0.8;
          obj.position.y = 2.4 + Math.sin(elapsed * 2) * 0.12;
        } else if (obj.name === 'nexus-ring-1') {
          obj.rotation.z += delta * 1.2;
        } else if (obj.name === 'nexus-ring-2') {
          obj.rotation.z -= delta * 1.0;
        } else if (obj.name === 'power-crystal') {
          obj.rotation.y += delta * 1.5;
          obj.position.y = 1.1 + Math.sin(elapsed * 2.5) * 0.08;
        } else if (obj.name === 'radar-dish') {
          obj.rotation.y += delta * 2.0;
        } else if (obj.name === 'arcane-core') {
          obj.rotation.y += delta * 1.8;
          obj.rotation.x += delta * 0.9;
        } else if (obj.name === 'creator-gyro') {
          obj.rotation.x += delta * 1.5;
          obj.rotation.y += delta * 1.2;
        } else if (obj.name === 'unit-avatar-body') {
          // Subtle breathing / hovering animation
          obj.position.y = 0.15 + Math.sin(elapsed * 2.5 + obj.id) * 0.03;
        } else if (obj.name === 'unit-billboard-mesh') {
          // Keep billboard facing camera
          obj.quaternion.copy(camera.quaternion);
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handlePointerMove);
      renderer.domElement.removeEventListener('click', handlePointerDown);
      combatEngineRef.current?.dispose();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync Camera Presets smoothly
  useEffect(() => {
    switch (cameraPreset) {
      case 'topdown':
        targetCameraPos.current.set(0, 22, 0.1);
        targetLookAt.current.set(0, 0, 0);
        break;
      case 'frontline':
        targetCameraPos.current.set(0, 8.5, 9.5);
        targetLookAt.current.set(0, 0.5, 0);
        break;
      case 'opponent':
        targetCameraPos.current.set(0, 15, -14.5);
        targetLookAt.current.set(0, 0, 0);
        break;
      case 'isometric':
      default:
        targetCameraPos.current.set(0, 15, 14.5);
        targetLookAt.current.set(0, 0, 0);
        break;
    }
  }, [cameraPreset]);

  // Update Dynamic Scene Objects when GameState updates (Units, Outposts, Cell Highlighting)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const group = dynamicObjectsGroup.current;
    // Clear previous dynamic meshes
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
    }

    const {
      cells,
      units,
      structures,
      outposts,
      selectedCellId,
      selectedUnitId,
      reachableCellIds,
      attackableCellIds,
      airborneLandingCellIds,
      validTargetCellIds,
      actionMode,
    } = state;

    const isCardTargeting = actionMode === 'card-targeting';

    // 1. Update Tile Highlights
    cellMeshesMap.current.forEach((tileMesh, cellId) => {
      const cell = cells[cellId];
      if (!cell) return;

      const isReachable = reachableCellIds.includes(cellId);
      const isAttackable = attackableCellIds.includes(cellId);
      const isAirborne = airborneLandingCellIds.includes(cellId);
      const isCardTarget = isCardTargeting && (validTargetCellIds?.includes(cellId) ?? false);
      const isSelected = selectedCellId === cellId;

      const mat = tileMesh.material as THREE.MeshStandardMaterial;

      if (isCardTarget) {
        // Bright Purple mystical target
        mat.emissive.setHex(0xa855f7);
        mat.emissiveIntensity = 0.85;
        tileMesh.position.y = 0.08;
      } else if (isAttackable) {
        // Crimson attack highlight
        mat.emissive.setHex(0xf43f5e);
        mat.emissiveIntensity = 0.75;
        tileMesh.position.y = 0.06;
      } else if (isAirborne) {
        // Amber airborne drop zone
        mat.emissive.setHex(0xf59e0b);
        mat.emissiveIntensity = 0.7;
        tileMesh.position.y = 0.06;
      } else if (isReachable) {
        // Cyan reachable move path
        mat.emissive.setHex(0x06b6d4);
        mat.emissiveIntensity = 0.65;
        tileMesh.position.y = 0.05;
      } else if (isSelected) {
        // Gold selected cell
        mat.emissive.setHex(0xfbbf24);
        mat.emissiveIntensity = 0.6;
        tileMesh.position.y = 0.08;
      } else {
        // Normal state
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        tileMesh.position.y = 0;
      }
    });

    // 2. Render Outposts (Row 3, 3 Lanes)
    Object.values(outposts).forEach((outpost) => {
      const outpost3D = createOutpost3DGroup(outpost);
      const posX = (outpost.col - 1) * SPACING_X;
      const posZ = (outpost.row - 3) * SPACING_Z;
      outpost3D.position.set(posX, 0.1, posZ);
      group.add(outpost3D);
    });

    // 3. Render Structures
    Object.values(structures).forEach((structure) => {
      const struct3D = createStructure3DGroup(structure);
      const posX = (structure.col - 1) * SPACING_X;
      const posZ = (structure.row - 3) * SPACING_Z;
      struct3D.position.set(posX, 0.1, posZ);
      group.add(struct3D);
    });

    // 4. Render Units with Floating 3D Stat Billboards
    unitMeshesMap.current.clear();
    Object.values(units).forEach((unit) => {
      const unit3D = createUnit3DGroup(unit);
      unitMeshesMap.current.set(unit.id, unit3D);
      const posX = (unit.col - 1) * SPACING_X;
      const posZ = (unit.row - 3) * SPACING_Z;
      unit3D.position.set(posX, 0.1, posZ);

      // Selected unit elevated highlight beacon
      if (selectedUnitId === unit.id) {
        const beaconGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.05, 24);
        const beaconMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: 0xfbbf24,
          emissiveIntensity: 1.2,
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = 0.02;
        unit3D.add(beacon);
      }

      // Floating 3D Billboard Badge (Name, Attack, Health)
      const billboardTex = createUnitBillboardTexture(
        unit.name,
        unit.attack,
        unit.currentHealth,
        unit.maxHealth,
        unit.owner
      );
      const billboardGeo = new THREE.PlaneGeometry(1.6, 0.8);
      const billboardMat = new THREE.MeshBasicMaterial({
        map: billboardTex,
        transparent: true,
        depthWrite: false,
      });
      const billboardMesh = new THREE.Mesh(billboardGeo, billboardMat);
      billboardMesh.name = 'unit-billboard-mesh';
      billboardMesh.position.set(0, 1.95, 0);
      unit3D.add(billboardMesh);

      group.add(unit3D);
    });
  }, [state]);

  const { player1, player2, actionMode, selectedCardInstanceId } = state;
  const isCardTargeting = actionMode === 'card-targeting';
  const selectedCardDef = selectedCardInstanceId
    ? CARD_DATABASE[
        player1.hand.find((c) => c.instanceId === selectedCardInstanceId)?.definitionId || ''
      ]
    : null;
  const isLaneTargeting = isCardTargeting && selectedCardDef?.targetRule?.mode === 'lane';

  // Demo triggers for interactive testing of Meteor & Shooting animations
  const handleTestMeteor = () => {
    // Drop fiery meteor right onto center lane
    const targetPos = new THREE.Vector3(0, 0.1, 0);
    combatEngineRef.current?.spawnMeteor(targetPos);
  };

  const handleTestShooting = () => {
    const unitsList = Object.values(stateRef.current.units);
    const p1 = unitsList.find((u) => u.owner === 'player1') || unitsList[0];
    const p2 = unitsList.find((u) => u.owner === 'player2') || unitsList[1];

    if (p1 && p2) {
      const startPos = new THREE.Vector3(
        (p1.col - 1) * SPACING_X,
        0.8,
        (p1.row - 3) * SPACING_Z
      );
      const endPos = new THREE.Vector3(
        (p2.col - 1) * SPACING_X,
        0.8,
        (p2.row - 3) * SPACING_Z
      );

      const mesh1 = unitMeshesMap.current.get(p1.id);
      if (mesh1) {
        mesh1.lookAt(endPos.x, mesh1.position.y, endPos.z);
        mesh1.position.y += 0.25;
        mesh1.rotation.x -= 0.35;
        setTimeout(() => {
          if (mesh1) {
            mesh1.position.y = 0.1;
            mesh1.rotation.x = 0;
          }
        }, 180);
      }

      const kind = p1.universe === 'neo-genesis' ? 'laser' : p1.universe === 'iron-frontier' ? 'cannon' : 'arcane';
      combatEngineRef.current?.spawnShootingProjectile(startPos, endPos, kind, p1.attack || 4);
    } else {
      // Demo duel between Row 4 Center and Row 2 Center
      const startPos = new THREE.Vector3(0, 0.8, 1 * SPACING_Z);
      const endPos = new THREE.Vector3(0, 0.8, -1 * SPACING_Z);
      combatEngineRef.current?.spawnShootingProjectile(startPos, endPos, 'laser', 4);
    }
  };

  return (
    <div className="relative w-full h-[620px] sm:h-[680px] lg:h-[720px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* TOP HUD: NEXUS INTEGRITY BARS & LANE TARGETING */}
      <div className="absolute top-3 inset-x-3 pointer-events-none z-10 flex flex-col gap-2">
        {/* Opponent & Player Base Nexus Indicators */}
        <div className="flex items-center justify-between gap-3">
          {/* Opponent Nexus (Top) */}
          <div className="pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-rose-900/60 shadow-lg backdrop-blur-md">
            <div className="w-6 h-6 rounded-lg bg-rose-950 border border-rose-600/60 flex items-center justify-center text-rose-300 font-bold text-xs">
              Ω
            </div>
            <div>
              <div className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">
                {player2.name} (เน็กซัส)
              </div>
              <div className="text-xs font-mono font-bold text-slate-200">
                {player2.baseHealth} / {player2.maxBaseHealth} HP
              </div>
            </div>
            <div className="w-24 sm:w-32 h-2.5 bg-slate-950 rounded-full overflow-hidden border border-rose-900/80 p-0.5 ml-1">
              <div
                className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(0, (player2.baseHealth / player2.maxBaseHealth) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Quick 2D Mode Switcher Button */}
          <div className="pointer-events-auto flex items-center gap-2">
            {onToggle2DMode && (
              <button
                type="button"
                onClick={onToggle2DMode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 shadow-lg cursor-pointer transition-colors backdrop-blur-md"
                title="สลับเป็นมุมมองกระดาน 2D แบบดั้งเดิม"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>มุมมอง 2D</span>
              </button>
            )}
          </div>

          {/* Local Player Nexus (Bottom) */}
          <div className="pointer-events-auto flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-cyan-900/60 shadow-lg backdrop-blur-md">
            <div className="w-24 sm:w-32 h-2.5 bg-slate-950 rounded-full overflow-hidden border border-cyan-900/80 p-0.5 mr-1">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.max(0, (player1.baseHealth / player1.maxBaseHealth) * 100)}%`,
                }}
              />
            </div>
            <div>
              <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider text-right">
                {player1.name} (เน็กซัสคุณ)
              </div>
              <div className="text-xs font-mono font-bold text-slate-200 text-right">
                {player1.baseHealth} / {player1.maxBaseHealth} HP
              </div>
            </div>
            <div className="w-6 h-6 rounded-lg bg-cyan-950 border border-cyan-600/60 flex items-center justify-center text-cyan-300 font-bold text-xs">
              α
            </div>
          </div>
        </div>

        {/* Lane Selection Bar during Lane Targeting Mode */}
        {isLaneTargeting && (
          <div className="pointer-events-auto grid grid-cols-3 gap-2 w-full max-w-xl mx-auto p-1.5 rounded-xl bg-purple-950/90 border border-purple-500/80 shadow-2xl backdrop-blur-md animate-pulse">
            <button
              type="button"
              onClick={() => onLaneClick && onLaneClick('left')}
              className="py-1 px-2 rounded-lg bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>เลนซ้าย</span>
            </button>
            <button
              type="button"
              onClick={() => onLaneClick && onLaneClick('center')}
              className="py-1 px-2 rounded-lg bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Castle className="w-3.5 h-3.5 text-sky-400" />
              <span>เลนกลาง</span>
            </button>
            <button
              type="button"
              onClick={() => onLaneClick && onLaneClick('right')}
              className="py-1 px-2 rounded-lg bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span>เลนขวา</span>
            </button>
          </div>
        )}
      </div>

      {/* HOVER INSPECTOR BADGE (Top-Left under Header) */}
      {hoveredInfo && hoveredInfo.unit && (
        <div className="absolute top-16 left-3 pointer-events-none z-10 px-3 py-2 rounded-xl bg-slate-900/90 border border-cyan-500/50 shadow-xl backdrop-blur-md max-w-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-xs text-white truncate">{hoveredInfo.unit.name}</span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                hoveredInfo.unit.owner === 'player1'
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                  : 'bg-rose-950 text-rose-300 border-rose-500/50'
              }`}
            >
              {hoveredInfo.unit.owner === 'player1' ? 'ฝ่ายเรา' : 'ฝ่ายศัตรู'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-rose-400 font-mono font-bold flex items-center gap-1">
              <Swords className="w-3 h-3" />
              {hoveredInfo.unit.attack}
            </span>
            <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {hoveredInfo.unit.currentHealth}/{hoveredInfo.unit.maxHealth}
            </span>
            <span className="text-amber-400 font-mono font-bold flex items-center gap-1">
              <Shield className="w-3 h-3" />
              {hoveredInfo.unit.defense}
            </span>
          </div>
          {hoveredInfo.unit.keywords.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {hoveredInfo.unit.keywords.map((kw) => (
                <span
                  key={kw}
                  className="text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ERGONOMIC COLLAPSIBLE BOTTOM DOCK (Three.js Skill Rule 5 Directive) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-full max-w-3xl px-3 pointer-events-none">
        <div className="flex flex-col items-center">
          {/* Collapse/Expand Toggle Button */}
          <button
            type="button"
            onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
            className="pointer-events-auto px-3 py-1 mb-1 rounded-t-lg bg-slate-900/90 hover:bg-slate-800 border-t border-x border-slate-700/80 text-[11px] font-semibold text-slate-300 flex items-center gap-1 shadow-md cursor-pointer backdrop-blur-md"
          >
            {isControlsCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>แสดงแถบกล้อง 3D (Show Controls)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                <span>ซ่อนแถบกล้อง (Zen Mode)</span>
              </>
            )}
          </button>

          {/* Unified Bottom Dock Body */}
          {!isControlsCollapsed && (
            <div className="pointer-events-auto w-full p-2.5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
              {/* Left: Camera Presets */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  กล้อง:
                </span>
                <button
                  type="button"
                  onClick={() => setCameraPreset('isometric')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                    cameraPreset === 'isometric'
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  Isometric (45°)
                </button>
                <button
                  type="button"
                  onClick={() => setCameraPreset('topdown')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                    cameraPreset === 'topdown'
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  ผู้บัญชาการ (Top)
                </button>
                <button
                  type="button"
                  onClick={() => setCameraPreset('frontline')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                    cameraPreset === 'frontline'
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  แนวหน้า (Clash)
                </button>
                <button
                  type="button"
                  onClick={() => setCameraPreset('opponent')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                    cameraPreset === 'opponent'
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  ฝ่ายตรงข้าม
                </button>
              </div>

              {/* Animation Live Triggers */}
              <div className="flex items-center gap-1.5 border-l border-slate-700/80 pl-2">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  แอนิเมชัน:
                </span>
                <button
                  type="button"
                  onClick={handleTestMeteor}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-950/60 flex items-center gap-1 border border-orange-400/80 active:scale-95"
                  title="ทดสอบอัญเชิญอุกกาบาตเพลิงพุ่งตกลงมาทำลายล้างกลางสนามรบ 3D"
                >
                  <Flame className="w-3.5 h-3.5 text-yellow-200" />
                  <span>อุกกาบาต (Meteor)</span>
                </button>
                <button
                  type="button"
                  onClick={handleTestShooting}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all bg-gradient-to-r from-cyan-700 to-blue-700 hover:from-cyan-600 hover:to-blue-600 text-white shadow-md shadow-cyan-950/60 flex items-center gap-1 border border-cyan-400/80 active:scale-95"
                  title="ทดสอบทหารยิงปืน/เลเซอร์ปะทะกันข้ามเลนพร้อมแรงถอยและตัวเลขดาเมจ"
                >
                  <Swords className="w-3.5 h-3.5 text-cyan-200" />
                  <span>ทหารยิงปะทะ (Shoot)</span>
                </button>
              </div>

              {/* Center / Right: Interactive Color Legend */}
              <div className="flex items-center gap-3 text-[11px] text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-cyan-200" />
                  <span>เดินได้</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-rose-300" />
                  <span>โจมตีได้</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 border border-purple-300" />
                  <span>เวท/สกิล</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-200" />
                  <span>ส่งทางอากาศ</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
