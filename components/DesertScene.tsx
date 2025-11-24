/* eslint-disable react/no-unknown-property */
"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { usePlayerStore } from "../lib/playerStore";

type CarProps = {
  position: THREE.Vector3;
  color: string;
};

function MakeCar({ position, color }: CarProps) {
  const group = useRef<THREE.Group>(null!);

  // Simple stylized off-road car: body + wheels
  const body = useMemo(() => new THREE.BoxGeometry(1.8, 0.6, 4), []);
  const cab = useMemo(() => new THREE.BoxGeometry(1.5, 0.6, 1.6), []);
  const wheel = useMemo(() => new THREE.CylinderGeometry(0.45, 0.45, 0.3, 18), []);
  const matBody = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.6 }), [color]);
  const matBlack = useMemo(() => new THREE.MeshStandardMaterial({ color: "#222" }), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state) => {
    // Roll wheels visually based on forward movement (z axis)
    const speed = 6; // m/s
    const t = state.clock.getElapsedTime();
    const roll = -t * speed;
    // Update wheel rotations
    group.current.traverse((obj) => {
      if ((obj as THREE.Mesh).geometry === wheel) {
        (obj as THREE.Mesh).rotation.z = roll;
      }
    });
  });

  return (
    <group ref={group} position={position.toArray()}>
      {/* Body */}
      <mesh geometry={body} material={matBody} castShadow receiveShadow position={[0, 0.9, 0]} />
      {/* Cab */}
      <mesh geometry={cab} material={matBody} castShadow receiveShadow position={[0, 1.2, -0.6]} />
      {/* Wheels */}
      {[-0.9, 0.9].map((x) =>
        [-1.5, 1.5].map((z) => (
          <mesh key={`${x}-${z}`} geometry={wheel} material={matBlack} rotation={[Math.PI / 2, 0, 0]} position={[x, 0.45, z]} castShadow receiveShadow />
        ))
      )}
    </group>
  );
}

function Terrain() {
  const geo = useMemo(() => {
    const width = 800;
    const height = 800;
    const segments = 256;
    const geometry = new THREE.PlaneGeometry(width, height, segments, segments);
    const positions = geometry.attributes.position as THREE.BufferAttribute;
    // Generate smooth dune-like heights using combined sin waves (fast and light)
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const nx = x / 80;
      const ny = y / 80;
      const h =
        Math.sin(nx) * 3 +
        Math.cos(ny * 1.3) * 2.5 +
        Math.sin(nx * 0.3 + ny * 0.7) * 1.8;
      positions.setZ(i, h);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  const sandMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#d9c28c"),
        roughness: 1,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: 1
      }),
    []
  );

  return (
    <mesh
      geometry={geo}
      material={sandMat}
      receiveShadow
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    />
  );
}

function Lights() {
  return (
    <>
      <directionalLight
        castShadow
        color={"#fff3e0"}
        intensity={2.2}
        position={[80, 120, 40]}
        shadow-mapSize={[2048, 2048]}
      />
      <ambientLight intensity={0.25} color={"#ffe9c4"} />
      <hemisphereLight args={["#ffe9c4", "#d9c28c", 0.3]} />
    </>
  );
}

function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function easeOutExpo(x: number) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}
function easeInExpo(x: number) {
  return x === 0 ? 0 : Math.pow(2, 10 * x - 10);
}

function CameraDirector({
  convoyRef
}: {
  convoyRef: React.RefObject<THREE.Group>;
}) {
  const { duration } = usePlayerStore.getState();
  const restartAtRef = useRef<number>(performance.now());
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);

  // Track restarts
  usePlayerStore.subscribe((state, prev) => {
    if (state.restartAt !== prev.restartAt) {
      restartAtRef.current = state.restartAt || performance.now();
    }
  });

  useFrame(({ camera }) => {
    const now = performance.now();
    const t = (now - restartAtRef.current) / 1000;
    const u = Math.min(1, (t % duration) / duration); // 0..1 over 15s
    const s = u * 15; // seconds elapsed modulo 15

    // Convoy baseline path (moves forward in -Z)
    const convoySpeed = 8; // m/s
    const convoyZ = -s * convoySpeed; // forward distance
    const convoyX = 0;
    const convoyY = 0.9; // slight body height

    // Update convoy group position
    if (convoyRef.current) {
      convoyRef.current.position.set(convoyX, 0, convoyZ);
    }

    // Camera choreography
    let cam = new THREE.Vector3();
    let target = new THREE.Vector3(convoyX, convoyY + 0.4, convoyZ - 6);

    if (s < 3) {
      // 0-3s: medium shot at dunes in front of lead car, fast push-in and 360 wrap to low chase behind
      const p = s / 3; // 0..1
      const r = easeInOutCubic(p);
      const radius = THREE.MathUtils.lerp(12, 4, r);
      const height = THREE.MathUtils.lerp(3, 1.2, r);
      const angle = THREE.MathUtils.degToRad(360 * r);
      const pivot = new THREE.Vector3(convoyX, convoyY + 0.8, convoyZ + 3);
      cam.set(
        pivot.x + Math.cos(angle) * radius,
        height,
        pivot.z + Math.sin(angle) * radius
      );
      target.set(convoyX, convoyY + 0.7, convoyZ + 1);
    } else if (s < 6) {
      // 3-6s: low fast, skim dune surface past side of 2nd car
      const p = (s - 3) / 3;
      const r = easeInOutCubic(p);
      const offsetX = THREE.MathUtils.lerp(2.8, -1.2, r); // move across the side
      cam.set(convoyX + offsetX, 0.6, convoyZ - 3 - r * 12);
      target.set(convoyX, convoyY + 0.5, convoyZ - 6 - r * 12);
    } else if (s < 9) {
      // 6-9s: pass under 3rd car chassis, extremely close to sand, then begin pull-up
      const p = (s - 6) / 3;
      const low = THREE.MathUtils.lerp(0.35, 0.7, easeOutExpo(p));
      const x = THREE.MathUtils.lerp(-0.8, 0.8, p);
      const z = convoyZ - 10 - p * 8;
      cam.set(convoyX + x, low, z);
      target.set(convoyX, convoyY + 0.6, z - 2);
    } else if (s < 11) {
      // 9-11s: explosive vertical climb, pull back and reveal vast plain
      const p = (s - 9) / 2; // 0..1
      const r = easeOutExpo(p);
      const height = THREE.MathUtils.lerp(1.2, 60, r);
      const back = THREE.MathUtils.lerp(6, 80, r);
      cam.set(convoyX + 12 * (1 - r), height, convoyZ + back);
      target.set(convoyX, convoyY, convoyZ - 10);
    } else if (s < 13) {
      // 11-13s: stabilize to top-down with slight tilt, majestic
      const p = (s - 11) / 2;
      const r = easeInOutCubic(p);
      const height = THREE.MathUtils.lerp(60, 100, r);
      const back = THREE.MathUtils.lerp(80, 120, r);
      cam.set(convoyX + 10, height, convoyZ + back);
      target.set(convoyX, convoyY, convoyZ - 20);
    } else {
      // 13-15s: slow lateral drift, shift away from convoy, end on vast serene desert
      const p = (s - 13) / 2;
      const r = easeInOutCubic(p);
      cam.set(convoyX + THREE.MathUtils.lerp(10, 40, r), 110, convoyZ + 140);
      target.set(convoyX - 10, convoyY, convoyZ - 40);
    }

    camera.position.copy(cam);
    camera.lookAt(target);
  });

  return null;
}

export default function DesertScene() {
  const convoy = useRef<THREE.Group>(null!);

  // Pre-place cars in a convoy pattern relative to group origin
  const carPositions = useMemo(
    () => [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-2.6, 0, -6),
      new THREE.Vector3(2.4, 0, -12)
    ],
    []
  );

  return (
    <>
      <Lights />
      <group ref={convoy}>
        <MakeCar position={carPositions[0]} color={"#b23a48"} />
        <MakeCar position={carPositions[1]} color={"#2b6cb0"} />
        <MakeCar position={carPositions[2]} color={"#2f855a"} />
      </group>
      <Terrain />
      {/* Shadow receiver helper plane slightly below to avoid acne */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <shadowMaterial opacity={0.18} />
      </mesh>
      <CameraDirector convoyRef={convoy} />
    </>
  );
}

