"use client";

import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { Suspense, useMemo, useRef, useEffect, useState } from "react";
import * as THREE from "three";
import type { TileDimensions, TileSurfaceId, EditableDefect } from "@/lib/tile";
import { getTileSurfaceSize } from "@/lib/tile";
import { renderTileSurfaceCanvas } from "@/lib/renderTile";

const MM_TO_WORLD = 0.01;

export interface Tile3DProps {
  dimensions: TileDimensions;
  defects: EditableDefect[];
  selectedDefectId: string | null;
  onAddDefect: (surface: TileSurfaceId, x: number, y: number) => void;
  onSelectDefect: (id: string | null) => void;
  onMoveDefect?: (id: string, x: number, y: number) => void;
}

interface FaceConfig {
  id: TileSurfaceId;
  position: [number, number, number];
  rotation: [number, number, number];
  width: number;
  height: number;
  uvFromLocal: (lx: number, ly: number) => { u: number; v: number };
  localFromUv: (u: number, v: number) => { lx: number; ly: number };
}

function buildFaces(dims: TileDimensions): FaceConfig[] {
  const L = dims.width_mm * MM_TO_WORLD;
  const W = dims.height_mm * MM_TO_WORLD;
  const T = dims.thickness_mm * MM_TO_WORLD;
  const half = { L: L / 2, W: W / 2, T: T / 2 };

  return [
    {
      id: "face",
      position: [0, 0, half.T],
      rotation: [0, 0, 0],
      width: L,
      height: W,
      uvFromLocal: (lx, ly) => ({ u: lx / L + 0.5, v: 0.5 - ly / W }),
      localFromUv: (u, v) => ({ lx: (u - 0.5) * L, ly: (0.5 - v) * W }),
    },
    {
      id: "top_edge",
      position: [0, half.W, 0],
      rotation: [-Math.PI / 2, 0, 0],
      width: L,
      height: T,
      uvFromLocal: (lx, ly) => ({ u: lx / L + 0.5, v: 0.5 - ly / T }),
      localFromUv: (u, v) => ({ lx: (u - 0.5) * L, ly: (0.5 - v) * T }),
    },
    {
      id: "bottom_edge",
      position: [0, -half.W, 0],
      rotation: [Math.PI / 2, 0, 0],
      width: L,
      height: T,
      uvFromLocal: (lx, ly) => ({ u: lx / L + 0.5, v: 0.5 - ly / T }),
      localFromUv: (u, v) => ({ lx: (u - 0.5) * L, ly: (0.5 - v) * T }),
    },
    {
      id: "left_edge",
      position: [-half.L, 0, 0],
      rotation: [Math.PI / 2, -Math.PI / 2, 0],
      width: W,
      height: T,
      uvFromLocal: (lx, ly) => ({ u: lx / W + 0.5, v: 0.5 - ly / T }),
      localFromUv: (u, v) => ({ lx: (u - 0.5) * W, ly: (0.5 - v) * T }),
    },
    {
      id: "right_edge",
      position: [half.L, 0, 0],
      rotation: [Math.PI / 2, Math.PI / 2, 0],
      width: W,
      height: T,
      uvFromLocal: (lx, ly) => ({ u: lx / W + 0.5, v: 0.5 - ly / T }),
      localFromUv: (u, v) => ({ lx: (u - 0.5) * W, ly: (0.5 - v) * T }),
    },
  ];
}

// ── Severity colours ──────────────────────────────────────────────────────────

function severityColor(severity: EditableDefect["severity"]): string {
  switch (severity) {
    case "minor":    return "#0ea5e9";
    case "major":    return "#f59e0b";
    case "critical": return "#ef4444";
  }
}

// ── Defect marker — ring indicator only (defect effect shown on surface) ──────

interface DefectMarkerProps {
  x: number;
  y: number;
  defect: EditableDefect;
  selected: boolean;
  onSelect: () => void;
  onDragStart?: () => void;
  onDragMove?: (worldPoint: THREE.Vector3) => void;
  onEndDrag?: () => void;
  clippingPlanes?: THREE.Plane[];
}

function DefectMarker({ x, y, defect, selected, onSelect, onDragStart, onDragMove, onEndDrag, clippingPlanes }: DefectMarkerProps) {
  const color = severityColor(defect.severity);
  const scale = defect.size ?? 1.0;
  const r = 0.022 * scale;

  return (
    <group
      position={[x, y, 0.006]}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerDown={(e) => { e.stopPropagation(); onDragStart?.(); }}
      onPointerMove={(e) => { if (onDragMove) { e.stopPropagation(); onDragMove(e.point); } }}
      onPointerUp={() => onEndDrag?.()}
    >
      {/* Severity colour ring */}
      <mesh>
        <ringGeometry args={[r * 0.7, r * 1.0, 24]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} clippingPlanes={clippingPlanes} />
      </mesh>

      {/* White outer ring for contrast */}
      <mesh position={[0, 0, -0.001]}>
        <ringGeometry args={[r * 1.0, r * 1.25, 24]} />
        <meshBasicMaterial color="white" transparent opacity={0.55} side={THREE.DoubleSide} clippingPlanes={clippingPlanes} />
      </mesh>

      {/* Selection highlight */}
      {selected && (
        <mesh position={[0, 0, 0.002]}>
          <ringGeometry args={[r * 1.25, r * 1.8, 28]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} clippingPlanes={clippingPlanes} />
        </mesh>
      )}
    </group>
  );
}

// ── Face plane — clickable ────────────────────────────────────────────────────

interface FacePlaneProps {
  face: FaceConfig;
  defects: EditableDefect[];
  selectedDefectId: string | null;
  dimensions: TileDimensions;
  onAddDefect: (surface: TileSurfaceId, x: number, y: number) => void;
  onSelectDefect: (id: string | null) => void;
  clippingPlanes: THREE.Plane[];
  dragRef: React.MutableRefObject<{ id: string; surface: TileSurfaceId } | null>;
  didDragRef: React.MutableRefObject<boolean>;
  onStartDrag: (id: string, surface: TileSurfaceId) => void;
  onMoveDefect?: (id: string, x: number, y: number) => void;
  onEndDrag: () => void;
  texture?: THREE.CanvasTexture | null;
}

function FacePlane({
  face, defects, selectedDefectId, onAddDefect, onSelectDefect,
  clippingPlanes, dragRef, didDragRef, onStartDrag, onMoveDefect, onEndDrag, texture,
}: FacePlaneProps) {
  const myDefects = defects.filter((d) => {
    const zoneMap: Record<string, TileSurfaceId> = {
      face: "face",
      top_left_corner: "face", top_right_corner: "face",
      bottom_left_corner: "face", bottom_right_corner: "face",
      top_edge: "top_edge",
      bottom_edge: "bottom_edge",
      left_edge: "left_edge",
      right_edge: "right_edge",
    };
    return zoneMap[d.zone] === face.id;
  });

  const planeMeshRef = useRef<THREE.Mesh>(null);

  const handleClickPlane = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (didDragRef.current) { didDragRef.current = false; return; }
    const localPoint = e.object.worldToLocal(e.point.clone());
    const { u, v } = face.uvFromLocal(localPoint.x, localPoint.y);
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    onAddDefect(face.id, u, v);
  };

  const moveFromWorld = (worldPoint: THREE.Vector3) => {
    const d = dragRef.current;
    if (!d || d.surface !== face.id || !planeMeshRef.current) return;
    const lp = planeMeshRef.current.worldToLocal(worldPoint.clone());
    const { u, v } = face.uvFromLocal(lp.x, lp.y);
    didDragRef.current = true;
    onMoveDefect?.(d.id, Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
  };

  return (
    <group position={face.position} rotation={face.rotation as [number, number, number]}>
      {/* Textured surface overlay (edge faces only — face overlay handled separately) */}
      {texture && (
        <mesh position={[0, 0, 0.0005]}>
          <planeGeometry args={[face.width, face.height]} />
          <meshStandardMaterial
            map={texture}
            roughness={0.85}
            clippingPlanes={clippingPlanes}
          />
        </mesh>
      )}

      {/* Invisible clickable plane */}
      <mesh
        ref={planeMeshRef}
        onClick={handleClickPlane}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (!dragRef.current || dragRef.current.surface !== face.id) return;
          e.stopPropagation();
          moveFromWorld(e.point);
        }}
        onPointerUp={() => onEndDrag()}
        position={[0, 0, 0.001]}
      >
        <planeGeometry args={[face.width, face.height]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Face label */}
      <Html position={[0, 0, 0.04]} center distanceFactor={8} zIndexRange={[0, 10]} pointerEvents="none">
        <div className="px-2 py-0.5 rounded bg-neutral-950/80 text-sky-400 text-[9px] font-bold uppercase tracking-widest border border-sky-500/30 whitespace-nowrap select-none">
          {face.id.replace(/_/g, " ")}
        </div>
      </Html>

      {/* Defect markers */}
      {myDefects.map((d) => {
        const { lx, ly } = face.localFromUv(d.x, d.y);
        const sel = d.id === selectedDefectId;
        return (
          <DefectMarker
            key={d.id}
            x={lx}
            y={ly}
            defect={d}
            selected={sel}
            onSelect={() => onSelectDefect(sel ? null : d.id)}
            onDragStart={() => onStartDrag(d.id, face.id)}
            onDragMove={(pt) => moveFromWorld(pt)}
            onEndDrag={onEndDrag}
            clippingPlanes={clippingPlanes}
          />
        );
      })}
    </group>
  );
}

// ── Camera framing ────────────────────────────────────────────────────────────

function FitCamera({ dimensions }: { dimensions: TileDimensions }) {
  const { camera } = useThree();
  const prevRef = useRef<TileDimensions | null>(null);
  useEffect(() => {
    const prev = prevRef.current;
    if (prev && prev.width_mm === dimensions.width_mm && prev.height_mm === dimensions.height_mm && prev.thickness_mm === dimensions.thickness_mm) return;
    prevRef.current = dimensions;
    const L = dimensions.width_mm * MM_TO_WORLD;
    const W = dimensions.height_mm * MM_TO_WORLD;
    const T = dimensions.thickness_mm * MM_TO_WORLD;
    const radius = Math.sqrt(L * L + W * W + T * T) / 2;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const dist = (radius / Math.sin((fov * Math.PI) / 360)) * 1.6;
    camera.position.set(dist * 0.35, dist * 0.35, dist * 0.85);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [dimensions, camera]);
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

interface ControlsLike { enabled: boolean }

export function Tile3D(props: Tile3DProps) {
  const faces = useMemo(() => buildFaces(props.dimensions), [props.dimensions]);
  const L = props.dimensions.width_mm * MM_TO_WORLD;
  const W = props.dimensions.height_mm * MM_TO_WORLD;
  const T = props.dimensions.thickness_mm * MM_TO_WORLD;

  const faceColor = props.dimensions.color ?? "#e4e1d8";

  const dragRef = useRef<{ id: string; surface: TileSurfaceId } | null>(null);
  const didDragRef = useRef(false);
  const controlsRef = useRef<ControlsLike | null>(null);

  const startDrag = (id: string, surface: TileSurfaceId) => {
    dragRef.current = { id, surface };
    didDragRef.current = false;
    if (controlsRef.current) controlsRef.current.enabled = false;
    props.onSelectDefect(id);
  };
  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (controlsRef.current) controlsRef.current.enabled = true;
    setTimeout(() => { didDragRef.current = false; }, 0);
  };

  useEffect(() => {
    const up = () => endDrag();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Live surface textures (debounced) ────────────────────────────────────────
  const [textures, setTextures] = useState<Map<TileSurfaceId, THREE.CanvasTexture>>(new Map());
  const prevTexturesRef = useRef<Map<TileSurfaceId, THREE.CanvasTexture>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const allSurfaces: TileSurfaceId[] = ["face", "top_edge", "bottom_edge", "left_edge", "right_edge"];
      const newMap = new Map<TileSurfaceId, THREE.CanvasTexture>();
      for (const surface of allSurfaces) {
        const maxPx = surface === "face" ? 512 : 128;
        const canvas = renderTileSurfaceCanvas(surface, props.dimensions, props.defects, maxPx);
        if (canvas) {
          newMap.set(surface, new THREE.CanvasTexture(canvas));
        }
      }
      prevTexturesRef.current.forEach((t) => t.dispose());
      prevTexturesRef.current = newMap;
      setTextures(new Map(newMap));
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [props.dimensions, props.defects]);

  const clippingPlanes = useMemo(() => {
    const E = 0.015;
    return [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), L / 2 + E),
      new THREE.Plane(new THREE.Vector3( 1, 0, 0), L / 2 + E),
      new THREE.Plane(new THREE.Vector3( 0,-1, 0), W / 2 + E),
      new THREE.Plane(new THREE.Vector3( 0, 1, 0), W / 2 + E),
      new THREE.Plane(new THREE.Vector3( 0, 0,-1), T / 2 + E),
      new THREE.Plane(new THREE.Vector3( 0, 0, 1), T / 2 + E),
    ];
  }, [L, W, T]);

  return (
    <div className="w-full h-full bg-neutral-950">
      <Canvas
        camera={{ position: [3, 2.5, 5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, localClippingEnabled: true }}
      >
        <color attach="background" args={["#0a0a0a"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 6]} intensity={0.9} />
        <directionalLight position={[-4, -3, -4]} intensity={0.25} />

        <Suspense fallback={null}>
          {/* Tile body */}
          <mesh onClick={(e) => { if (e.intersections.length === 1) props.onSelectDefect(null); }}>
            <boxGeometry args={[L, W, T]} />
            <meshStandardMaterial color="#c4a07a" roughness={0.9} />
          </mesh>

          {/* Glazed face overlay — live canvas texture */}
          <mesh position={[0, 0, T / 2 + 0.0001]}>
            <planeGeometry args={[L, W]} />
            {textures.get("face") ? (
              <meshStandardMaterial map={textures.get("face")} roughness={0.15} metalness={0.05} />
            ) : (
              <meshStandardMaterial color={faceColor} roughness={0.15} metalness={0.05} />
            )}
          </mesh>

          {faces.map((face) => (
            <FacePlane
              key={face.id}
              face={face}
              defects={props.defects}
              selectedDefectId={props.selectedDefectId}
              dimensions={props.dimensions}
              onAddDefect={props.onAddDefect}
              onSelectDefect={props.onSelectDefect}
              clippingPlanes={clippingPlanes}
              dragRef={dragRef}
              didDragRef={didDragRef}
              onStartDrag={startDrag}
              onMoveDefect={props.onMoveDefect}
              onEndDrag={endDrag}
              texture={face.id !== "face" ? (textures.get(face.id) ?? null) : null}
            />
          ))}

          <FitCamera dimensions={props.dimensions} />
        </Suspense>

        <OrbitControls
          ref={controlsRef as never}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          enablePan={false}
          maxDistance={20}
          minDistance={1}
        />
      </Canvas>
    </div>
  );
}
