import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  TacticalGameState,
  TacticalUnitInstance,
  TacticalStructureInstance,
  TacticalCell,
  TacticalTerrainType,
} from '../types/tactical';
import {
  getCoordKey,
  parseCoordKey,
  TERRAIN_DATA,
  getTacticalReachableCells,
  getTacticalAttackableCells,
} from '../game/tactical/mapEngine';
import {
  executeTacticalMove,
  executeTacticalAttack,
  executeTacticalReload,
  toggleOverwatchStance,
  executeTacticalSkill,
  endPlayerTurn,
} from '../game/tactical/turnManager';
import { queueUnitProduction } from '../game/tactical/productionEngine';
import { TACTICAL_BLUEPRINTS } from '../game/tactical/tacticalUnits';
import { soundFx } from '../utils/audio';
import { createStickmanUnit3D } from './3d/stickmanModels';
import {
  createForestGrove3D,
  createFortressBastion3D,
  createTacticalStructureMesh,
  createTacticalBridge3D,
} from './3d/tacticalEnvironment';
import { CombatAnimationEngine } from './3d/combatAnimations';
import {
  Shield,
  Swords,
  Heart,
  Zap,
  Target,
  RefreshCw,
  Camera,
  Layers,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Factory,
  Radio,
  Flame,
  Sparkles,
  RotateCcw,
  Eye,
  EyeOff,
  Maximize2,
  X,
  Plane,
} from 'lucide-react';

export interface TacticalMap3DViewProps {
  state: TacticalGameState;
  onStateChange: (newState: TacticalGameState) => void;
  viewerRole?: 'player1' | 'player2' | 'spectator';
  onExitMatch?: () => void;
  onToggle2DMode?: () => void;
}

const TILE_SIZE = 1.8;
const ELEVATION_STEP = 0.45;

export const TacticalMap3DView: React.FC<TacticalMap3DViewProps> = ({
  state,
  onStateChange,
  viewerRole = 'player1',
  onExitMatch,
  onToggle2DMode,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Camera presets & UI toggles
  const [cameraPreset, setCameraPreset] = useState<'rts' | 'topdown' | 'action'>('rts');
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [revealFogOfWar, setRevealFogOfWar] = useState(false);
  const [hoveredCellKey, setHoveredCellKey] = useState<string | null>(null);

  // Three.js mutable refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const combatEngineRef = useRef<CombatAnimationEngine | null>(null);

  const tileMeshesMap = useRef<Map<string, THREE.Mesh>>(new Map());
  const unitMeshesMap = useRef<Map<string, THREE.Group>>(new Map());
  const interactiveColliders = useRef<THREE.Mesh[]>([]);
  const dynamicGroupRef = useRef<THREE.Group>(new THREE.Group());

  // Camera target smoothing
  const targetCamPos = useRef(new THREE.Vector3(0, 18, 16));
  const targetCamLookAt = useRef(new THREE.Vector3(0, 0, 0));

  // Current state ref for raycaster
  const stateRef = useRef(state);
  stateRef.current = state;
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  const activeViewer = viewerRole === 'spectator' ? state.activePlayerId : viewerRole;
  const currentFog = state.fogOfWar ? state.fogOfWar[activeViewer] : {};
  const selectedUnit = state.selectedUnitId ? state.units[state.selectedUnitId] : null;

  // 1. Initialize Three.js WebGL Scene on Mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

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

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x08101a);
    scene.fog = new THREE.FogExp2(0x08101a, 0.018);
    sceneRef.current = scene;

    // Reflection Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      140
    );
    camera.position.set(0, 18, 16);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 6;
    controls.maxDistance = 38;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // 3-Point Lighting
    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.3);
    sunLight.position.set(15, 26, 18);
    sunLight.castShadow = !isSoftwareGl;
    if (sunLight.castShadow) {
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 60;
      sunLight.shadow.camera.left = -20;
      sunLight.shadow.camera.right = 20;
      sunLight.shadow.camera.top = 20;
      sunLight.shadow.camera.bottom = -20;
      sunLight.shadow.bias = -0.0005;
    }
    scene.add(sunLight);

    const skyFill = new THREE.HemisphereLight(0x38bdf8, 0x166534, 1.2);
    scene.add(skyFill);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.9);
    rimLight.position.set(-18, 16, -18);
    scene.add(rimLight);

    // Dynamic Objects Group
    scene.add(dynamicGroupRef.current);

    // Combat Engine
    combatEngineRef.current = new CombatAnimationEngine(scene, camera);

    // Pointer Raycasting for Clicks & Hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getPointerPos = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const pos = getPointerPos(e);
      mouse.x = pos.x;
      mouse.y = pos.y;
      raycaster.setFromCamera(mouse, camera);

      const hits = raycaster.intersectObjects(interactiveColliders.current, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData?.cellKey && obj.parent) {
          obj = obj.parent;
        }
        if (obj?.userData?.cellKey) {
          setHoveredCellKey(obj.userData.cellKey);
          renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        setHoveredCellKey(null);
        renderer.domElement.style.cursor = 'default';
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Only left-click
      const pos = getPointerPos(e);
      mouse.x = pos.x;
      mouse.y = pos.y;
      raycaster.setFromCamera(mouse, camera);

      const hits = raycaster.intersectObjects(interactiveColliders.current, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData?.cellKey && obj.parent) {
          obj = obj.parent;
        }

        if (obj?.userData?.cellKey) {
          const clickedKey = obj.userData.cellKey as string;
          handleCellInteraction(clickedKey);
        }
      }
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleMouseDown);

    // Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Render loop
    let frameId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Camera lerp
      camera.position.lerp(targetCamPos.current, 0.08);
      controls.target.lerp(targetCamLookAt.current, 0.08);
      controls.update();

      // Update combat animations
      combatEngineRef.current?.update(delta);

      // Subtle dynamic objects
      scene.traverse((o) => {
        if (o.name === 'radar-spire-dish') {
          o.rotation.y += delta * 1.8;
        } else if (o.name === 'stickman-body') {
          o.position.y = 0.1 + Math.sin(elapsed * 2.5 + o.id) * 0.02;
        } else if (o.name === 'staff-crystal') {
          o.rotation.y += delta * 2.0;
        } else if (o.name === 'staff-rune-ring') {
          o.rotation.z += delta * 1.5;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('click', handleMouseDown);
      combatEngineRef.current?.dispose();
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 2. Camera Preset Sync
  useEffect(() => {
    switch (cameraPreset) {
      case 'topdown':
        targetCamPos.current.set(0, 26, 0.1);
        targetCamLookAt.current.set(0, 0, 0);
        break;
      case 'action':
        targetCamPos.current.set(0, 10, 12);
        targetCamLookAt.current.set(0, 1, 0);
        break;
      case 'rts':
      default:
        targetCamPos.current.set(0, 18, 16);
        targetCamLookAt.current.set(0, 0, 0);
        break;
    }
  }, [cameraPreset]);

  // 3. World Grid Generation & State Sync
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const group = dynamicGroupRef.current;
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
    }

    tileMeshesMap.current.clear();
    unitMeshesMap.current.clear();
    interactiveColliders.current = [];

    const {
      mapWidth,
      mapHeight,
      cells,
      units,
      structures,
      currentCommandMode,
      selectedUnitId,
      selectedSkillId,
      reachableCellKeys,
      attackableCellKeys,
      skillTargetCellKeys,
      activePlayerId,
    } = state;

    const currentFogMap = revealFogOfWar ? {} : state.fogOfWar?.[activeViewer] || {};

    // 1. Render Terrain Tiles
    Object.values(cells).forEach((cell) => {
      const cellKey = getCoordKey(cell.x, cell.y);
      const fog = revealFogOfWar ? 'visible' : currentFogMap[cellKey] || 'visible';

      const worldX = (cell.x - mapWidth / 2) * TILE_SIZE;
      const worldZ = (cell.y - mapHeight / 2) * TILE_SIZE;
      const worldY = (cell.heightLevel || 0) * ELEVATION_STEP;

      const tileHeight = 0.2 + (cell.heightLevel || 0) * ELEVATION_STEP;
      const tileGeo = new THREE.BoxGeometry(TILE_SIZE * 0.96, tileHeight, TILE_SIZE * 0.96);

      // Color by terrain
      let tileColor = 0x1e3a1f; // default plains green
      if (cell.terrain === 'forest') tileColor = 0x14532d;
      else if (cell.terrain === 'hills') tileColor = 0x57534e;
      else if (cell.terrain === 'water') tileColor = 0x0284c7;
      else if (cell.terrain === 'road') tileColor = 0x64748b;
      else if (cell.terrain === 'building') tileColor = 0x334155;
      else if (cell.terrain === 'mountain') tileColor = 0x292524;

      if (fog === 'explored') {
        tileColor = 0x1e293b; // Fog explored dimmed
      }

      const isReachable = currentCommandMode === 'move' && reachableCellKeys.includes(cellKey);
      const isAttackable = currentCommandMode === 'attack' && attackableCellKeys.includes(cellKey);
      const isSkillTarget = currentCommandMode === 'skill-targeting' && skillTargetCellKeys.includes(cellKey);
      const isSelected = selectedUnit && selectedUnit.x === cell.x && selectedUnit.y === cell.y;

      const mat = new THREE.MeshStandardMaterial({
        color: tileColor,
        roughness: cell.terrain === 'water' ? 0.1 : 0.7,
        metalness: cell.terrain === 'water' ? 0.4 : 0.2,
      });

      if (isSkillTarget) {
        mat.emissive.setHex(0xa855f7);
        mat.emissiveIntensity = 0.85;
      } else if (isAttackable) {
        mat.emissive.setHex(0xf43f5e);
        mat.emissiveIntensity = 0.8;
      } else if (isReachable) {
        mat.emissive.setHex(0x10b981);
        mat.emissiveIntensity = 0.7;
      } else if (isSelected) {
        mat.emissive.setHex(0xfbbf24);
        mat.emissiveIntensity = 0.6;
      }

      const tileMesh = new THREE.Mesh(tileGeo, mat);
      tileMesh.position.set(worldX, worldY / 2, worldZ);
      tileMesh.receiveShadow = true;
      tileMesh.userData = { cellKey, x: cell.x, y: cell.y };

      group.add(tileMesh);
      tileMeshesMap.current.set(cellKey, tileMesh);
      interactiveColliders.current.push(tileMesh);

      // Add Real 3D Environment Models ("ป่าเป็นป่า, ป้อมเป็นป้อม")
      if (fog !== 'shrouded') {
        if (cell.terrain === 'forest') {
          const trees = createForestGrove3D();
          trees.position.set(worldX, worldY + 0.1, worldZ);
          group.add(trees);
        } else if (cell.terrain === 'building' && !cell.structureId) {
          const bastion = createFortressBastion3D(false);
          bastion.position.set(worldX, worldY + 0.1, worldZ);
          group.add(bastion);
        } else if (cell.terrain === 'water' && cell.coverDefense > 0) {
          // Tactical Bridge across river
          const bridge = createTacticalBridge3D();
          bridge.position.set(worldX, worldY, worldZ);
          group.add(bridge);
        }
      }
    });

    // 2. Render 3D Structures
    Object.values(structures).forEach((struct) => {
      const cellKey = getCoordKey(struct.x, struct.y);
      const fog = revealFogOfWar ? 'visible' : currentFogMap[cellKey] || 'visible';
      if (fog === 'shrouded') return;

      const cell = cells[cellKey];
      const worldX = (struct.x - mapWidth / 2) * TILE_SIZE;
      const worldZ = (struct.y - mapHeight / 2) * TILE_SIZE;
      const worldY = (cell?.heightLevel || 0) * ELEVATION_STEP;

      const structMesh = createTacticalStructureMesh(struct);
      structMesh.position.set(worldX, worldY + 0.1, worldZ);
      group.add(structMesh);
    });

    // 3. Render 3D Stickman Soldiers
    Object.values(units).forEach((unit) => {
      const cellKey = getCoordKey(unit.x, unit.y);
      const fog = revealFogOfWar ? 'visible' : currentFogMap[cellKey] || 'visible';

      // Hide enemy units in fog
      if (fog === 'shrouded' && unit.owner !== activeViewer) return;

      const cell = cells[cellKey];
      const worldX = (unit.x - mapWidth / 2) * TILE_SIZE;
      const worldZ = (unit.y - mapHeight / 2) * TILE_SIZE;
      const worldY = (cell?.heightLevel || 0) * ELEVATION_STEP;

      const stickman = createStickmanUnit3D(unit);
      stickman.position.set(worldX, worldY + 0.1, worldZ);

      // Elevate selected unit
      if (selectedUnitId === unit.id) {
        const beaconGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.04, 16);
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = 0.02;
        stickman.add(beacon);
      }

      group.add(stickman);
      unitMeshesMap.current.set(unit.id, stickman);
    });
  }, [state, revealFogOfWar, activeViewer]);

  // Handle Player Click Interactions (Move, Attack, Overwatch, Skills)
  const handleCellInteraction = (cellKey: string) => {
    const currentState = stateRef.current;
    const { x, y } = parseCoordKey(cellKey);
    const cell = currentState.cells[cellKey];
    if (!cell) return;

    // 1. Move Execution (Stickman dashes/moves to tile)
    if (
      currentState.currentCommandMode === 'move' &&
      currentState.selectedUnitId &&
      currentState.reachableCellKeys.includes(cellKey)
    ) {
      soundFx.playMove();
      const next = executeTacticalMove(currentState.selectedUnitId, x, y, currentState);
      onStateChangeRef.current(next);
      return;
    }

    // 2. Attack Execution (Stickman shoots rifle/staff with projectile and recoil)
    if (
      currentState.currentCommandMode === 'attack' &&
      currentState.selectedUnitId &&
      currentState.attackableCellKeys.includes(cellKey)
    ) {
      const attacker = currentState.units[currentState.selectedUnitId];
      if (attacker) {
        const startPos = new THREE.Vector3(
          (attacker.x - currentState.mapWidth / 2) * TILE_SIZE,
          0.8 + (currentState.cells[getCoordKey(attacker.x, attacker.y)]?.heightLevel || 0) * ELEVATION_STEP,
          (attacker.y - currentState.mapHeight / 2) * TILE_SIZE
        );
        const endPos = new THREE.Vector3(
          (x - currentState.mapWidth / 2) * TILE_SIZE,
          0.8 + (cell.heightLevel || 0) * ELEVATION_STEP,
          (y - currentState.mapHeight / 2) * TILE_SIZE
        );

        // Recoil stickman
        const attackerMesh = unitMeshesMap.current.get(attacker.id);
        if (attackerMesh) {
          attackerMesh.lookAt(endPos.x, attackerMesh.position.y, endPos.z);
          attackerMesh.position.y += 0.2;
          attackerMesh.rotation.x -= 0.35;
          setTimeout(() => {
            if (attackerMesh) {
              attackerMesh.position.y = 0.1;
              attackerMesh.rotation.x = 0;
            }
          }, 180);
        }

        const isMage = attacker.universe === 'arcane-dominion';
        const isSniper = attacker.definitionId.includes('sniper');
        const kind = isMage ? 'arcane' : isSniper ? 'laser' : 'bullet';

        combatEngineRef.current?.spawnShootingProjectile(
          startPos,
          endPos,
          kind,
          attacker.attack,
          () => {
            const next = executeTacticalAttack(currentState.selectedUnitId!, cellKey, currentState);
            onStateChangeRef.current(next);
          }
        );
        return;
      }
    }

    // 3. Skill Targeting Execution (Artillery Barrage / Snipe / Heal)
    if (
      currentState.currentCommandMode === 'skill-targeting' &&
      currentState.selectedUnitId &&
      currentState.selectedSkillId &&
      currentState.skillTargetCellKeys.includes(cellKey)
    ) {
      const targetPos = new THREE.Vector3(
        (x - currentState.mapWidth / 2) * TILE_SIZE,
        0.1 + (cell.heightLevel || 0) * ELEVATION_STEP,
        (y - currentState.mapHeight / 2) * TILE_SIZE
      );

      // If artillery or heavy damage skill, trigger meteor/blast
      combatEngineRef.current?.spawnMeteor(targetPos, () => {
        const next = executeTacticalSkill(
          currentState.selectedUnitId!,
          currentState.selectedSkillId!,
          cellKey,
          currentState
        );
        onStateChangeRef.current(next);
      });
      return;
    }

    // 4. Click on Unit
    const clickedUnit = Object.values(currentState.units).find((u) => u.x === x && u.y === y);
    if (clickedUnit) {
      if (clickedUnit.owner === currentState.activePlayerId) {
        soundFx.playCardSelect();
        onStateChangeRef.current({
          ...currentState,
          selectedUnitId: clickedUnit.id,
          selectedStructureId: null,
          currentCommandMode: 'idle',
        });
      }
      return;
    }

    // 5. Click on Structure
    if (cell.structureId) {
      const struct = currentState.structures[cell.structureId];
      if (struct && struct.owner === currentState.activePlayerId) {
        soundFx.playCardSelect();
        onStateChangeRef.current({
          ...currentState,
          selectedStructureId: struct.id,
          selectedUnitId: null,
          currentCommandMode: 'idle',
        });
      }
    }
  };

  // Commands triggered from UI
  const handleStartMove = () => {
    if (!selectedUnit) return;
    soundFx.playCardSelect();
    const reachable = getTacticalReachableCells(
      selectedUnit,
      state.cells,
      state.units,
      state.mapWidth,
      state.mapHeight
    );
    onStateChange({
      ...state,
      currentCommandMode: 'move',
      reachableCellKeys: reachable,
      attackableCellKeys: [],
      skillTargetCellKeys: [],
    });
  };

  const handleStartAttack = () => {
    if (!selectedUnit) return;
    soundFx.playCardSelect();
    const attackable = getTacticalAttackableCells(
      selectedUnit,
      state.cells,
      state.units,
      state.structures,
      state.mapWidth,
      state.mapHeight,
      revealFogOfWar ? undefined : currentFog
    );
    onStateChange({
      ...state,
      currentCommandMode: 'attack',
      attackableCellKeys: attackable,
      reachableCellKeys: [],
      skillTargetCellKeys: [],
    });
  };

  const handleToggleOverwatch = () => {
    if (!selectedUnit) return;
    const next = toggleOverwatchStance(selectedUnit.id, state);
    onStateChange(next);
  };

  const handleReload = () => {
    if (!selectedUnit) return;
    const next = executeTacticalReload(selectedUnit.id, state);
    onStateChange(next);
  };

  const handleEndTurn = () => {
    soundFx.playPhaseChange();
    const next = endPlayerTurn(state);
    onStateChange(next);
  };

  const hoveredCell = hoveredCellKey ? state.cells[hoveredCellKey] : null;

  return (
    <div className="relative w-full h-[calc(100vh-64px)] bg-slate-950 overflow-hidden select-none flex flex-col font-sans">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* TOP STATUS BAR: COMMANDER RESOURCES, TURN & CONTROLS */}
      <div className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-md flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onExitMatch}
            className="text-xs font-bold text-slate-400 hover:text-cyan-300 transition-colors uppercase tracking-wider cursor-pointer"
          >
            ← ออกจากสมรภูมิ
          </button>
          <span className="text-slate-700">|</span>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50 animate-pulse" />
            <span className="text-xs font-bold text-slate-200">
              {state.activePlayerId === 'player1' ? 'ผู้บัญชาการฝ่ายเรา' : 'ฝ่ายศัตรู (Player 2)'}
            </span>
            <span className="text-xs font-mono font-bold text-cyan-400">
              เทิร์น {state.turnNumber}
            </span>
          </div>

          {/* Resources */}
          <div className="hidden md:flex items-center gap-3 px-3 py-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-bold">
            <span className="text-amber-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 fill-current" />
              {state.player1Resources.charge}/{state.player1Resources.maxCharge}
            </span>
            <span className="text-cyan-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              {state.player1Resources.rift}
            </span>
            <span className="text-emerald-400 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              {state.player1Resources.resolve}
            </span>
          </div>
        </div>

        {/* View Controls & Actions */}
        <div className="flex items-center gap-2">
          {onToggle2DMode && (
            <button
              type="button"
              onClick={onToggle2DMode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 cursor-pointer shadow-md transition-colors"
              title="สลับเป็นมุมมองกระดาน 2D ตารางดั้งเดิม"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>โหมด 2D</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setRevealFogOfWar(!revealFogOfWar)}
            className={`p-1.5 rounded-xl border cursor-pointer transition-colors ${
              revealFogOfWar
                ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="เปิด/ปิด หมอกสงคราม (Fog of War Reveal)"
          >
            {revealFogOfWar ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setShowProductionModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/60 text-xs font-bold text-indigo-200 shadow-md cursor-pointer transition-colors"
          >
            <Factory className="w-3.5 h-3.5 text-indigo-400" />
            <span>สร้างกองทัพ (HQ)</span>
          </button>

          <button
            type="button"
            onClick={handleEndTurn}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-900/40 cursor-pointer transition-all"
          >
            <span>จบเทิร์น (End Turn)</span>
          </button>
        </div>
      </div>

      {/* HOVER TILE INFO (Top-Left) */}
      {hoveredCell && (
        <div className="absolute top-16 left-4 z-10 pointer-events-none px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-slate-200 shadow-xl backdrop-blur-md max-w-xs animate-in fade-in">
          <div className="font-bold text-cyan-300 capitalize flex items-center justify-between">
            <span>{hoveredCell.terrain} (ความสูงระดับ {hoveredCell.heightLevel || 0})</span>
            <span className="text-[10px] text-slate-400 font-mono">[{hoveredCell.x}, {hoveredCell.y}]</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-300 mt-1">
            <span>🛡️ กำบัง: +{hoveredCell.coverDefense}</span>
            <span>⚡ ค่าเดิน: {hoveredCell.movementCost} AP</span>
          </div>
        </div>
      )}

      {/* COLLAPSIBLE BOTTOM COMMAND DOCK (Three.js Skill Rule 5 Directive) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-full max-w-3xl px-3 pointer-events-none">
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
            className="pointer-events-auto px-3 py-1 mb-1 rounded-t-lg bg-slate-900/90 hover:bg-slate-800 border-t border-x border-slate-700/80 text-[11px] font-semibold text-slate-300 flex items-center gap-1 shadow-md cursor-pointer backdrop-blur-md"
          >
            {isControlsCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>แสดงแถบคำสั่ง RTS 3D</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                <span>ซ่อนแถบควบคุม (Zen Mode)</span>
              </>
            )}
          </button>

          {!isControlsCollapsed && (
            <div className="pointer-events-auto w-full p-2.5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
              {/* Left: Stickman Unit Actions (When selected) */}
              {selectedUnit ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 mr-2">
                    <span className="font-bold text-xs text-cyan-300">{selectedUnit.name}</span>
                    <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-600/50">
                      ⚡ {selectedUnit.currentAP} AP
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartMove}
                    disabled={selectedUnit.currentAP < selectedUnit.movementCostPerTile}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all border flex items-center gap-1 ${
                      state.currentCommandMode === 'move'
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 disabled:opacity-40'
                    }`}
                  >
                    <span>เคลื่อนพล (Move)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartAttack}
                    disabled={selectedUnit.currentAP < 2 || selectedUnit.currentAmmo <= 0}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all border flex items-center gap-1 ${
                      state.currentCommandMode === 'attack'
                        ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 disabled:opacity-40'
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5 text-rose-300" />
                    <span>โจมตี (Fire)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleOverwatch}
                    disabled={selectedUnit.currentAP < 2}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all border flex items-center gap-1 ${
                      selectedUnit.stance === 'overwatch'
                        ? 'bg-amber-600 text-white border-amber-400'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 disabled:opacity-40'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-300" />
                    <span>{selectedUnit.stance === 'overwatch' ? 'ระวังภัย (ON)' : 'ระวังภัย (Overwatch)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReload}
                    disabled={selectedUnit.currentAP < 1 || selectedUnit.currentAmmo >= selectedUnit.maxAmmo}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 cursor-pointer disabled:opacity-40 flex items-center gap-1"
                    title="บรรจุกระสุนใหม่ (ใช้ 1 AP)"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>รีโหลด</span>
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>💡 คลิกที่ทหารสติกแมนเพื่อออกคำสั่ง Move, Fire หรือ Overwatch</span>
                </div>
              )}

              {/* Right: Camera Presets */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  กล้อง:
                </span>
                <button
                  type="button"
                  onClick={() => setCameraPreset('rts')}
                  className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer border ${
                    cameraPreset === 'rts'
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  RTS (เฉียง)
                </button>
                <button
                  type="button"
                  onClick={() => setCameraPreset('topdown')}
                  className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer border ${
                    cameraPreset === 'topdown'
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  Top (บน)
                </button>
                <button
                  type="button"
                  onClick={() => setCameraPreset('action')}
                  className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer border ${
                    cameraPreset === 'action'
                      ? 'bg-cyan-600 text-white border-cyan-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  ประชิด
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PRODUCTION MODAL: QUEUE UNITS */}
      {showProductionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <Factory className="w-6 h-6 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">เกณฑ์กำลังพลสติกแมน (Stickman Recruitment)</h3>
                  <p className="text-xs text-slate-400">เลือกพิมพ์เขียวกำลังพลเพื่อเกณฑ์ลงสู่ฐานทัพ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProductionModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-4 max-h-[60vh] overflow-y-auto">
              {Object.values(TACTICAL_BLUEPRINTS).map((bp) => {
                const canAfford = state.player1Resources.charge >= bp.cost.charge;
                return (
                  <div
                    key={bp.id}
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-cyan-200">{bp.name}</span>
                        <span className="text-xs font-mono font-bold text-amber-400">⚡{bp.cost.charge}</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed mb-3">{bp.description}</p>
                      <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
                        <span>⚔️ {bp.attack}</span>
                        <span>💚 {bp.maxHealth}</span>
                        <span>⚡ {bp.maxAP} AP</span>
                        <span>🎯 {bp.range} ช่อง</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => {
                        const hq = Object.values(state.structures).find(
                          (s) => s.owner === 'player1' && s.type === 'hq'
                        ) || Object.values(state.structures)[0];
                        if (hq) {
                          const res = queueUnitProduction(hq.id, bp.id, 'player1', state);
                          if (res.success) {
                            onStateChange(res.nextState);
                            setShowProductionModal(false);
                            soundFx.playDeploy();
                          } else if (res.reason) {
                            soundFx.playError();
                          }
                        }
                      }}
                      className="mt-3 w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-bold text-white shadow cursor-pointer transition-colors"
                    >
                      เกณฑ์ลงสนาม ({bp.buildTurns} เทิร์น)
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
