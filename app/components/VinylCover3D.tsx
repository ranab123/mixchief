"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";
import { Suspense, useMemo, useRef, useCallback, useState, useEffect } from "react";

interface VinylCover3DProps {
  src: string;
  width?: number; // max pixel width when responsive
  size?: number; // legacy fallback
  debug?: boolean; // show container and shadow bounds
  containerAspectScale?: number; // multiply container aspect to make it narrower/taller without changing geometry
}

function AlbumSleeve({ src, aspect, onAspect }: { src: string; aspect: number; onAspect?: (a: number) => void }) {
  // Load texture with CORS enabled
  const texture = useTexture(src);
  
  // Configure texture
  useMemo(() => {
    if (texture) {
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.offset.set(0, 0);
      texture.repeat.set(1, 1);
      texture.center.set(0.5, 0.5);
      texture.needsUpdate = true;
    }
  }, [texture]);

  useEffect(() => {
    const img: any = texture?.image as any;
    const w = img?.width;
    const h = img?.height;
    if (w && h && onAspect) {
      onAspect(w / h);
    }
  }, [texture, onAspect]);
  
  // Create materials array for each face
  const materials = useMemo(() => {
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: "#1f1f1f",
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.1,
    });
    
    const frontMaterial = new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: 0.68,
      metalness: 0.03,
      clearcoat: 0.08,
      clearcoatRoughness: 0.7,
      envMapIntensity: 0.18,
      specularIntensity: 0.25,
      ior: 1.2,
    });
    
    // Return array: [right, left, top, bottom, front, back]
    return [
      sideMaterial.clone(), // right
      sideMaterial.clone(), // left
      sideMaterial.clone(), // top
      sideMaterial.clone(), // bottom
      frontMaterial,        // front (with texture)
      sideMaterial.clone(), // back
    ];
  }, [texture]);
  
  return (
    <mesh material={materials} castShadow>
      <boxGeometry args={[aspect, 1, 0.06]} />
    </mesh>
  );
}

function Loader() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 0.06]} />
      <meshStandardMaterial color="#666666" />
    </mesh>
  );
}

function Shadows({
  scale,
  y = -0.52,
  blur = 1.6,
  far = 1.2,
}: {
  scale: number;
  y?: number;
  blur?: number;
  far?: number;
}) {
  return (
    <ContactShadows
      position={[0, y, 0]}
      opacity={0.65}
      scale={scale}
      blur={blur}
      far={far}
      resolution={2048}
      color="#000000"
    />
  );
}

function TiltedSleeve({
  src,
  aspect,
  targetRotationRef,
  ease,
  targetZRef,
  yOffset = 0,
}: {
  src: string;
  aspect: number;
  targetRotationRef: React.MutableRefObject<{ x: number; y: number }>;
  ease: number;
  targetZRef: React.MutableRefObject<number>;
  yOffset?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    // Rotation easing
    const tRot = 1 - Math.pow(1 - ease, 60 * delta);
    // Position (Z) easing: slower than rotation for a softer pop
    const easeZ = Math.max(0.05, Math.min(0.25, ease * 0.6));
    const tZ = 1 - Math.pow(1 - easeZ, 60 * delta);
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, targetRotationRef.current.x, tRot);
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, targetRotationRef.current.y, tRot);
    group.position.z = THREE.MathUtils.lerp(group.position.z, targetZRef.current, tZ);
  });

  return (
    <group ref={groupRef} position={[0, yOffset, 0]}>
      <Suspense fallback={<Loader />}>
        <AlbumSleeve src={src} aspect={aspect} />
      </Suspense>
    </group>
  );
}

export default function VinylCover3D({ src, width, size = 200, debug = false, containerAspectScale = 1 }: VinylCover3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const targetRotation = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const targetZ = useRef<number>(0);
  const [aspect, setAspect] = useState<number>(16 / 9);
  const [cameraZ, setCameraZ] = useState<number>(1.5);
  const [fov, setFov] = useState<number>(46);
  const pixelWidth = width ?? size ?? 500; // used as max width
  const shadowScale = Math.max(aspect, 1) * 2;
  const containerAspect = aspect * containerAspectScale;
    // Move content down inside the canvas to reduce bottom whitespace
    const FRAME_Y_OFFSET = 0.0;
    // Adjust shadow plane position accordingly
    const SHADOW_EXTRA_Y = 0.0;

  // Caps (radians): slight tilt (~7° on X, ~6° on Y)
  const MAX_ROT_X = 0.12; // ≈ 7°
  const MAX_ROT_Y = 0.10; // ≈ 6°
  const EASE = 0.25; // responsiveness (used in delta-based easing)

  // Responsive camera: adjust distance and FOV based on container width
  useEffect(() => {
    function updateCamera() {
      const containerWidth = containerRef.current?.offsetWidth || 500;
      // Tie perceived vinyl size to the parent container width so scaling up the container increases the sleeve size.
      const baseWidth = containerWidth;
      // Formula: as width increases, camera gets closer (z decreases)
      // Slightly closer to reduce visual gaps between sleeves
      // Base: 400px = z of 1.8, Target: 1000px = z of ~1.25
      const z = 1.8 - ((baseWidth - 400) / 600) * 0.55;
      const clampedZ = Math.max(1.2, Math.min(2.6, z));
      setCameraZ(clampedZ);
      
      // Wider FOV to capture the full sleeve and its shadow when tilted
      const newFov = baseWidth > 1200
        ? 58
        : baseWidth > 900
        ? 54
        : baseWidth > 700
        ? 50
        : 46;
      setFov(newFov);
    }
    
    updateCamera();
    window.addEventListener('resize', updateCamera);
    return () => window.removeEventListener('resize', updateCamera);
  }, [pixelWidth]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;   // 0..1
    const y = (e.clientY - rect.top) / rect.height;   // 0..1
    const nx = x * 2 - 1; // -1..1
    const ny = y * 2 - 1; // -1..1
    targetRotation.current.x = THREE.MathUtils.clamp(ny * -MAX_ROT_X, -MAX_ROT_X, MAX_ROT_X);
    targetRotation.current.y = THREE.MathUtils.clamp(nx * MAX_ROT_Y, -MAX_ROT_Y, MAX_ROT_Y);
    targetZ.current = 0.12; // stronger lift on hover
  }, []);

  const handlePointerEnter = useCallback(() => {
    targetZ.current = 0.12;
  }, []);

  const handlePointerLeave = useCallback(() => {
    targetRotation.current.x = 0;
    targetRotation.current.y = 0;
    targetZ.current = 0;
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={{
        width: "100%",
        aspectRatio: String(containerAspect),
        position: "relative",
        overflow: "visible",
        outline: debug ? "2px dashed red" : undefined,
        outlineOffset: 0,
      }}
    >
      <Canvas
        shadows
        camera={{
          position: [0, 0, cameraZ], // responsive: closer on wider screens
          fov: fov, // responsive: wider FOV on wider screens
          near: 0.1,
          far: 1000,
        }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
      >
        <color attach="background" args={["#ffffff"]} />
        
        {/* Low-intensity ambient light for basic illumination */}
        <ambientLight intensity={0.6} />
        
        {/* Key light - casts shadows */}
        <directionalLight 
          position={[5, 6, 5]} 
          intensity={1.0}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        
        {/* Fill light - no shadows */}
        <directionalLight position={[-5, -3, 5]} intensity={0.45} />
        
        <Environment preset="studio" background={false} />

        <TiltedSleeve src={src} aspect={aspect} targetRotationRef={targetRotation} ease={EASE} targetZRef={targetZ} yOffset={FRAME_Y_OFFSET} />
        
        {/* Soft contact shadow underneath */}
        <Shadows
          scale={shadowScale}
          y={-0.52 + FRAME_Y_OFFSET + SHADOW_EXTRA_Y}
          blur={1.0}
          far={0.9}
        />

        {/* Debug: visualize shadow plane bounds */}
        {debug && (
          <mesh
            position={[0, -0.52 + 0.001, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[shadowScale, shadowScale]} />
            <meshBasicMaterial color="red" wireframe transparent opacity={0.6} />
          </mesh>
        )}
      </Canvas>
    </div>
  );
}

