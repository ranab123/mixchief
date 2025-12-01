"use client";

import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { ContactShadows, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

function Disc3D({
  isPlaying,
  tiltXRef,
  tiltYRef,
  onSeek,
  wasSpinningRef,
}: DiscSpinProps) {
  // Size of the plane in scene units; slightly larger to read bigger relative to text
  // with camera at z=6 and fov=45
  const DISC_SIZE_UNITS = 4.8;
  const meshRef = useRef<THREE.Mesh>(null);
  const map = useTexture("/images/discc.png");
  // Track timers for cleanup
  const spinResetTimerRef = useRef<number | null>(null);
  
  // Keep color space correct
  useEffect(() => {
    if (map) {
      map.colorSpace = THREE.SRGBColorSpace;
      map.needsUpdate = true;
    }
  }, [map]);
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (spinResetTimerRef.current !== null) {
        clearTimeout(spinResetTimerRef.current);
        spinResetTimerRef.current = null;
      }
    };
  }, []);
  
  const MAX_TILT = 0.22; // ~12.6 degrees
  // Spin state
  const angleRef = useRef<number>(0);
  const spinVelRef = useRef<number>(0); // radians/frame
  const draggingRef = useRef<boolean>(false);
  const prevDragAngleRef = useRef<number>(0);
  const accumulatedSpinRef = useRef<number>(0); // Track total spin during drag for seeking
  // wasSpinningRef is now passed as a prop to communicate with parent
  const SPIN_DAMP = 0.985; // friction (higher = less friction)
  const DRAG_GAIN = 0.13;  // sensitivity of drag to imparted spin (lower = slower spin)
  const MAX_SPIN_VELOCITY = 0.3; // Maximum spin speed (radians/frame)
  const AUTO_SPIN_SPEED = -0.01; // constant slow spin when playing (radians/frame, negative for clockwise rotation)
  const MAX_SEEK_SECONDS = 75; // Maximum skip in seconds for a full rotation (more "bang" per full spin)
  const SEEK_THRESHOLD = Math.PI / 12; // Lower threshold (~15 degrees) before triggering seek so small spins count
  const CLICK_THRESHOLD = Math.PI / 36; // Very small threshold (~5 degrees) to distinguish click from spin
  
  useFrame(() => {
    if (!meshRef.current) return;
    const targetX = THREE.MathUtils.clamp(tiltXRef.current, -1, 1) * MAX_TILT;
    const targetY = THREE.MathUtils.clamp(tiltYRef.current, -1, 1) * MAX_TILT;
    // Smoothly ease rotation toward target
    const e = meshRef.current.rotation;
    const ease = 0.12;
    e.x += (targetX - e.x) * ease;
    e.y += (targetY - e.y) * ease;
    
    // If playing, add constant slow spin; if not playing, apply friction to manual spin
    if (isPlaying && !draggingRef.current) {
      // Auto-spin when playing
      angleRef.current += AUTO_SPIN_SPEED;
    } else {
      // Apply manual spin velocity with damping
      angleRef.current += spinVelRef.current;
      spinVelRef.current *= SPIN_DAMP;
      // clamp tiny velocity to zero
      if (Math.abs(spinVelRef.current) < 1e-5) spinVelRef.current = 0;
    }
    
    // Clamp spin velocity to prevent tweaking out
    spinVelRef.current = THREE.MathUtils.clamp(spinVelRef.current, -MAX_SPIN_VELOCITY, MAX_SPIN_VELOCITY);
    
    e.z = angleRef.current;
  });
  return (
    <mesh
      ref={meshRef}
      position={[0, 0, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (!meshRef.current) return;
        // compute local angle on the disc
        const localPoint = e.point.clone();
        meshRef.current.worldToLocal(localPoint);
        prevDragAngleRef.current = Math.atan2(localPoint.y, localPoint.x);
        draggingRef.current = true;
        accumulatedSpinRef.current = 0; // Reset accumulated spin at drag start
        if (wasSpinningRef) wasSpinningRef.current = false; // Reset spinning flag
        // reduce spin when grabbing for better control
        spinVelRef.current *= 0.5;
      }}
      onPointerMove={(e) => {
        if (!draggingRef.current || !meshRef.current) return;
        e.stopPropagation();
        const localPoint = e.point.clone();
        meshRef.current.worldToLocal(localPoint);
        const angle = Math.atan2(localPoint.y, localPoint.x);
        let delta = angle - prevDragAngleRef.current;
        // normalize to [-PI, PI]
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        // Clamp delta to prevent large jumps
        delta = THREE.MathUtils.clamp(delta, -0.3, 0.3);
        angleRef.current += delta;
        spinVelRef.current = delta * DRAG_GAIN;
        accumulatedSpinRef.current += delta; // Track total spin
        prevDragAngleRef.current = angle;
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        draggingRef.current = false;
        
        // Mark as spinning if there was meaningful movement (even below seek threshold)
        if (Math.abs(accumulatedSpinRef.current) > CLICK_THRESHOLD) {
          if (wasSpinningRef) {
            wasSpinningRef.current = true;
            // Clear existing timer before setting a new one
            if (spinResetTimerRef.current !== null) {
              clearTimeout(spinResetTimerRef.current);
            }
            // Reset after a short delay to allow clicks again
            spinResetTimerRef.current = window.setTimeout(() => {
              if (wasSpinningRef) wasSpinningRef.current = false;
              spinResetTimerRef.current = null;
            }, 100);
          }
        }
        
        // When drag ends, calculate seek amount based on accumulated spin
        if (onSeek && Math.abs(accumulatedSpinRef.current) > SEEK_THRESHOLD) {
          // Negative spin (clockwise, same as playback) = forward
          // Positive spin (counter-clockwise) = backward
          // Scale: full rotation (2*PI radians) = MAX_SEEK_SECONDS
          const deltaSeconds = -(accumulatedSpinRef.current / (2 * Math.PI)) * MAX_SEEK_SECONDS;
          onSeek(deltaSeconds);
        }
        accumulatedSpinRef.current = 0;
      }}
      onPointerOut={() => {
        // Mark as spinning if there was meaningful movement
        if (Math.abs(accumulatedSpinRef.current) > CLICK_THRESHOLD) {
          if (wasSpinningRef) {
            wasSpinningRef.current = true;
            // Clear existing timer before setting a new one
            if (spinResetTimerRef.current !== null) {
              clearTimeout(spinResetTimerRef.current);
            }
            // Reset after a short delay to allow clicks again
            spinResetTimerRef.current = window.setTimeout(() => {
              if (wasSpinningRef) wasSpinningRef.current = false;
              spinResetTimerRef.current = null;
            }, 100);
          }
        }
        
        if (draggingRef.current && onSeek && Math.abs(accumulatedSpinRef.current) > SEEK_THRESHOLD) {
          const deltaSeconds = -(accumulatedSpinRef.current / (2 * Math.PI)) * MAX_SEEK_SECONDS;
          onSeek(deltaSeconds);
        }
        draggingRef.current = false;
        accumulatedSpinRef.current = 0;
      }}
    >
      <planeGeometry args={[DISC_SIZE_UNITS, DISC_SIZE_UNITS]} />
      <meshBasicMaterial map={map} transparent />
    </mesh>
  );
}

function MeasureDiscWidth({
  onMeasure,
  sizeUnits,
}: {
  onMeasure: (px: number) => void;
  sizeUnits: number;
}) {
  const { camera, size } = useThree();
  const left = useRef(new THREE.Vector3(-sizeUnits / 2, 0, 0));
  const right = useRef(new THREE.Vector3(sizeUnits / 2, 0, 0));
  const lastRef = useRef<number>(0);
  useFrame(() => {
    const l = left.current.clone();
    const r = right.current.clone();
    l.project(camera);
    r.project(camera);
    const ndcDelta = Math.abs(r.x - l.x);
    const px = ndcDelta * (size.width / 2);
    if (Math.abs(px - lastRef.current) > 0.5) {
      lastRef.current = px;
      onMeasure(px);
    }
  });
  return null;
}

// ===== Key variables for quick experimenting =====
// Camera
const DEFAULT_CAMERA_POSITION: [number, number, number] = [0.0, 1.8, 5.5];
const DEFAULT_CAMERA_LOOK_AT: [number, number, number] = [0, 0.5, 0];
const DEFAULT_CAMERA_FOV = 55;
const DEFAULT_USE_ORTHO = true;
const DEFAULT_ORTHO_ZOOM = 140;
// Cover orientation
const DEFAULT_COVER_ROTATION = {
  yawDeg: -30,  // around Y (right edge slightly closer with negative values)
  pitchDeg: 0, // around X
  rollDeg: 0,  // around Z
};
// Conveyor motion: diagonal direction (positive X, positive Y, negative Z) and base offset
const DEFAULT_SCROLL_VECTOR: [number, number, number] = [1.0, 0.30, 0.70];
const DEFAULT_BASE_OFFSET: [number, number, number] = [0, 0.6, 0];
// Hover behavior - slide outward along the stack direction
const HOVER_S_OFFSET = 0.0;   // 0 = disabled (we'll use lateral slide instead)
const HOVER_EASE = 0.06;      // easing factor per frame (smaller = slower, smoother)
const HOVER_LATERAL = 1.0;   // world units to slide along local +X (right) at full hover
// Selection → face viewer & fade easing
const FACE_EASE = 0.07;       // easing toward front-facing rotation (smaller = slower)
const FADE_EASE = 0.08;       // easing for fading other covers out/in
const OVERLAY_EASE = 0.12;    // easing for white overlay fade
// =================================================

export interface VinylStackItem {
  src: string;
  videoId: string;
  id?: string;
  title?: string;
  channelTitle?: string;
  created_at?: string;
  duration?: string;
}

interface DiscSpinProps {
  isPlaying: boolean;
  tiltXRef: React.MutableRefObject<number>;
  tiltYRef: React.MutableRefObject<number>;
  onSeek?: (deltaSeconds: number) => void;
  wasSpinningRef?: React.MutableRefObject<boolean>;
}

interface VinylStack3DProps {
  items: VinylStackItem[];
  onSelect?: (item: VinylStackItem, index: number) => void;
  onRequestPlay?: (videoId: string) => void;
  onRequestToggle?: (videoId: string) => void;
  onDelete?: (item: VinylStackItem, index: number) => void;
  onSeek?: (deltaSeconds: number) => void;
  isPlaying?: boolean;
  currentTime?: number; // Current playback time in seconds
  clearSelectionKey?: number; // changes when parent wants to force-clear selection
  externalSelectVideoId?: string | null; // videoId to select externally (e.g., from list view)
  width?: number;
  containerAspect?: number;
  yRotationDeg?: number;    // yaw (around Y)
  xRotationDeg?: number;    // pitch (around X)
  zRotationDeg?: number;    // roll (around Z)
  xStep?: number;           // per-plane X offset
  yStep?: number;           // per-plane Y offset
  zStep?: number;           // per-plane Z offset (positive value; formula uses -s*stepZ)
  x0?: number;              // base X offset so first cover centers
  y0?: number;              // base Y offset so first cover centers
  z0?: number;              // base Z offset
  coverScale?: number;      // uniform scale for all covers
  coverThickness?: number;  // Z depth/thickness of each cover
  cameraPosition?: [number, number, number]; // custom camera position
  cameraLookAt?: [number, number, number];   // custom camera lookAt target
  transparentOpacity?: number;
  showShadows?: boolean;
  showBorders?: boolean;
}

function CoverPlane({
  src,
  aspect,
  opacity,
  fadeAlpha = 1,
  showBorders,
  onClick,
  yRotationRad,
  scale = 1,
  thickness = 0.04,
}: {
  src: string;
  aspect: number;
  opacity: number;
  fadeAlpha?: number;
  showBorders: boolean;
  onClick?: () => void;
  yRotationRad: number;
  scale?: number;
  thickness?: number;
}) {
  const texture = useTexture(src);

  useMemo(() => {
    if (texture) {
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.offset.set(0, 0);
      texture.repeat.set(1, 1);
      texture.center.set(0.5, 0.5);
      texture.needsUpdate = true;
    }
  }, [texture]);

  const boxGeomForEdges = useMemo(() => {
    return new THREE.BoxGeometry(aspect, 1, thickness);
  }, [aspect, thickness]);
  
  // Cleanup geometry on unmount or when deps change
  useEffect(() => {
    return () => {
      if (boxGeomForEdges) {
        boxGeomForEdges.dispose();
      }
    };
  }, [boxGeomForEdges]);
  
  const materials = useMemo(() => {
    
    // Safety: if no texture yet, fallback to neutral sides
    const makeSideMaterial = (map?: THREE.Texture) => {
      return new THREE.MeshStandardMaterial({
        map,
        roughness: 0.32,
        metalness: 0.06,
      });
    };

    // Front face material with inner-border alpha + blur gradient
    const front = (() => {
      if (!texture) {
        return new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9 });
      }
      const uniforms = {
        uMap: { value: texture as any },
        uPadding: { value: 0.15 },   // 15% padding band
        uAlphaOuter: { value: 0.70 }, // 70% at the very outer edge of padding
        uAlphaInner: { value: 0.95 }, // 95% at the inner boundary of padding
        uAlphaCenter: { value: 0.95 },// 95% inside the padding region (center area)
        uBlurMax: { value: 0.030 },  // increased max blur radius for more pronounced edge blur
        uAspect: { value: aspect },  // keep blur roughly circular for non-square images
      };
      const vertexShader = `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;
      const fragmentShader = `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D uMap;
        uniform float uPadding;
        uniform float uAlphaOuter;
        uniform float uAlphaInner;
        uniform float uAlphaCenter;
        uniform float uBlurMax;
        uniform float uAspect;
        vec4 gaussianBlur(sampler2D img, vec2 uv, vec2 texel) {
          // simple weighted kernel
          float w0 = 0.196482;
          float w1 = 0.120098;
          float w2 = 0.078482;
          float w3 = 0.049100;
          vec4 sum = texture2D(img, uv) * w0;
          sum += texture2D(img, uv + texel * vec2( 1.0,  0.0)) * w1;
          sum += texture2D(img, uv + texel * vec2(-1.0,  0.0)) * w1;
          sum += texture2D(img, uv + texel * vec2( 0.0,  1.0)) * w1;
          sum += texture2D(img, uv + texel * vec2( 0.0, -1.0)) * w1;
          vec2 d = texel * 0.7071;
          sum += texture2D(img, uv + d * vec2( 1.0,  1.0)) * w2;
          sum += texture2D(img, uv + d * vec2(-1.0,  1.0)) * w2;
          sum += texture2D(img, uv + d * vec2( 1.0, -1.0)) * w2;
          sum += texture2D(img, uv + d * vec2(-1.0, -1.0)) * w2;
          sum += texture2D(img, uv + texel * vec2( 2.0,  0.0)) * w3;
          sum += texture2D(img, uv + texel * vec2(-2.0,  0.0)) * w3;
          sum += texture2D(img, uv + texel * vec2( 0.0,  2.0)) * w3;
          sum += texture2D(img, uv + texel * vec2( 0.0, -2.0)) * w3;
          return sum;
        }
        void main() {
          vec4 tex = texture2D(uMap, vUv);
          // distance to nearest edge (0 at edge → 0.5 at center)
          float d = min(min(vUv.x, vUv.y), min(1.0 - vUv.x, 1.0 - vUv.y));
          float alpha;
          vec3 color = tex.rgb;
          if (d < uPadding) {
            // Inside the 15% padding band
            float t = clamp(d / uPadding, 0.0, 1.0);         // 0 at edge → 1 at inner boundary
            alpha = mix(uAlphaOuter, uAlphaInner, t);        // 70% at outer → 90% at inner boundary
            float edgeStrength = 1.0 - t;                    // 1 at edge → 0 at inner boundary
            float r = edgeStrength * uBlurMax;               // blur strongest at the outer edge
            if (r > 0.0001) {
              vec2 texel = vec2(r / max(uAspect, 0.0001), r);
              vec4 blurred = gaussianBlur(uMap, vUv, texel);
              color = mix(tex.rgb, blurred.rgb, edgeStrength);
            }
          } else {
            // Center area (outside padding): constant 90% opacity, no blur, no color change
            alpha = uAlphaCenter;
          }
          gl_FragColor = vec4(color, tex.a * alpha);
          if (gl_FragColor.a <= 0.001) discard;
        }
      `;
      return new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
      });
    })();

    if (!texture) {
      return [
        makeSideMaterial(), // right
        makeSideMaterial(), // left
        makeSideMaterial(), // top
        makeSideMaterial(), // bottom
        front,              // front
        makeSideMaterial(), // back
      ];
    }

    // Create narrow edge-sampling textures by cloning and using offset/repeat.
    const edge = 0.02; // 2% strip to approximate edge/average color
    const mkClone = (ox: number, oy: number, rx: number, ry: number) => {
      const t = texture.clone();
      t.needsUpdate = true;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.offset.set(ox, oy);
      t.repeat.set(rx, ry);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    // Right side samples a thin column near x=1
    const rightTex = mkClone(1 - edge, 0, edge, 1);
    // Left side samples a thin column near x=0
    const leftTex = mkClone(0, 0, edge, 1);
    // Top side samples a thin row near y=1
    const topTex = mkClone(0, 1 - edge, 1, edge);
    // Bottom side samples a thin row near y=0
    const bottomTex = mkClone(0, 0, 1, edge);
    
    // Box material order: [px, nx, py, ny, pz, nz]
    return [
      makeSideMaterial(rightTex),  // right
      makeSideMaterial(leftTex),   // left
      makeSideMaterial(topTex),    // top
      makeSideMaterial(bottomTex), // bottom
      front,                       // front (positive Z)
      makeSideMaterial(leftTex),   // back (use left sample as a neutral choice)
    ];
  }, [texture, aspect]);

  // Cleanup materials and textures on unmount or when deps change
  useEffect(() => {
    return () => {
      if (Array.isArray(materials)) {
        materials.forEach((mat, idx) => {
          if (mat) {
            // Dispose of textures used by the material
            if ('map' in mat && mat.map) {
              mat.map.dispose();
            }
            // Dispose of the material itself
            mat.dispose();
          }
        });
      }
    };
  }, [materials]);

  return (
    <group rotation={[0, yRotationRad, 0]} onClick={onClick} scale={[scale, scale, 1]}>
      <mesh castShadow receiveShadow material={materials as any}>
        <boxGeometry args={[aspect, 1, thickness]} />
      </mesh>
      {/* borders removed */}
    </group>
  );
}

function CameraSetup({ position, lookAt }: { position: [number, number, number]; lookAt: [number, number, number] }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
    gl.sortObjects = true;
    
    // Handle WebGL context loss
    const canvas = gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.log('WebGL context lost, will restore...');
    };
    const handleContextRestored = () => {
      console.log('WebGL context restored');
    };
    
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
    
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [camera, gl, position[0], position[1], position[2], lookAt[0], lookAt[1], lookAt[2]]);
  return null;
}

export default function VinylStack3D({
  items,
  onSelect,
  onRequestPlay,
  onRequestToggle,
  onDelete,
  onSeek,
  isPlaying = false,
  currentTime = 0,
  clearSelectionKey = 0,
  externalSelectVideoId = null,
  width,
  containerAspect = 16 / 9,
  yRotationDeg = DEFAULT_COVER_ROTATION.yawDeg,
  xRotationDeg = DEFAULT_COVER_ROTATION.pitchDeg,
  zRotationDeg = DEFAULT_COVER_ROTATION.rollDeg,
  xStep = DEFAULT_SCROLL_VECTOR[0],
  yStep = DEFAULT_SCROLL_VECTOR[1],
  zStep = DEFAULT_SCROLL_VECTOR[2], // used as positive; z = -s * zStep
  x0 = DEFAULT_BASE_OFFSET[0],
  y0 = DEFAULT_BASE_OFFSET[1],
  z0 = DEFAULT_BASE_OFFSET[2],
  coverScale = 1.8,
  coverThickness = 0.03,
  cameraPosition = DEFAULT_CAMERA_POSITION,
  cameraLookAt = DEFAULT_CAMERA_LOOK_AT,
  transparentOpacity = 0.85,
  showShadows = true,
  showBorders = false,
}: VinylStack3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Suppress console warnings from Three.js and other libraries
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      const msg = args[0]?.toString() || '';
      // Filter out passive event listener warnings and Three.js warnings
      if (msg.includes("passive event listener") || 
          msg.includes("non-passive") ||
          msg.includes("scroll-blocking")) {
        return;
      }
      originalWarn.apply(console, args);
    };

    return () => {
      console.warn = originalWarn;
    };
  }, []);
  
  // Track touch scrolling state
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isScrollingRef = useRef<boolean>(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  
  // Setup non-passive wheel event listener to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const sensitivity = 0.0018; // adjust scroll speed
      // Reverse scroll direction: scroll down increases progress toward 1 (or vice versa)
      const next = Math.min(1, Math.max(0, tTargetRef.current - e.deltaY * sensitivity));
      tTargetRef.current = next;
    };
    
    // Add with passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);
  
  // Setup touch event handlers for mobile scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      isScrollingRef.current = false;
      
      // Clear any existing scroll timeout
      if (scrollTimeoutRef.current !== null) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      
      // If vertical movement is significant, treat as scroll
      if (Math.abs(deltaY) > 10) {
        isScrollingRef.current = true;
        e.preventDefault(); // Prevent default touch behavior
        
        const sensitivity = 0.0012; // Touch scroll sensitivity (reduced from 0.003 for less sensitive, smoother scrolling)
        const next = Math.min(1, Math.max(0, tTargetRef.current + deltaY * sensitivity));
        tTargetRef.current = next;
        
        // Reset touch start to current position for continuous scrolling
        touchStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
        };
      }
    };
    
    const handleTouchEnd = () => {
      // Keep scrolling state active for a short time to prevent hover triggers
      if (isScrollingRef.current) {
        scrollTimeoutRef.current = window.setTimeout(() => {
          isScrollingRef.current = false;
        }, 200);
      }
      touchStartRef.current = null;
    };
    
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      if (scrollTimeoutRef.current !== null) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);
  const [fov] = useState<number>(DEFAULT_CAMERA_FOV);
  const selectedIndexRef = useRef<number | null>(null);
  const [aspects, setAspects] = useState<number[]>([]);
  const [t, setT] = useState<number>(0);
  const tRef = useRef<number>(0);
  const tTargetRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  // Responsive scaling for mobile
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const responsiveCoverScale = isMobile ? coverScale * 0.85 : coverScale;
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // Check if device supports touch
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  // Per-item hover smoothing for buttery transitions between neighbors
  const [hoverProgresses, setHoverProgresses] = useState<number[]>([]);
  const hoverProgressesRef = useRef<number[]>([]);
  const hoverTargetsRef = useRef<number[]>([]);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number; visible: boolean }>({
    text: "",
    x: 0,
    y: 0,
    visible: false,
  });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // Smooth rotation toward facing-viewer when selected
  const [faceProgresses, setFaceProgresses] = useState<number[]>([]);
  const faceProgressesRef = useRef<number[]>([]);
  const faceTargetsRef = useRef<number[]>([]);
  // Fade other covers when selected
  const [fadeProgresses, setFadeProgresses] = useState<number[]>([]);
  const fadeProgressesRef = useRef<number[]>([]);
  const fadeTargetsRef = useRef<number[]>([]);
  const deselectionTimeRef = useRef<number | null>(null);
  const lastSelectedIndexRef = useRef<number | null>(null);
  // Lock hover pull-out on the returning vinyl until user hovers a different vinyl
  const hoverLockIndexRef = useRef<number | null>(null);
  // Full-screen white overlay control
  const [overlayAlpha, setOverlayAlpha] = useState<number>(0);
  const overlayAlphaRef = useRef<number>(0);
  const overlayTargetRef = useRef<number>(0);
  const overlayTimerRef = useRef<number | null>(null);
  // Disc appearance after overlay
  const [showDisc, setShowDisc] = useState<boolean>(false);
  const discTimerRef = useRef<number | null>(null);

  // Allow parent to force-clear the current selection (e.g., when closing player)
  useEffect(() => {
    if (!clearSelectionKey) return;

    setSelectedIndex((prev) => {
      if (prev === null) return prev;
      deselectionTimeRef.current = performance.now();
      lastSelectedIndexRef.current = prev;
      hoverLockIndexRef.current = prev;
      if (overlayTimerRef.current !== null) {
        clearTimeout(overlayTimerRef.current);
        overlayTimerRef.current = null;
      }
      overlayAlphaRef.current = 1;
      setOverlayAlpha(1);
      overlayTargetRef.current = 0;
      if (discTimerRef.current !== null) {
        clearTimeout(discTimerRef.current);
        discTimerRef.current = null;
      }
      setShowDisc(false);
      return null;
    });

    const n = items.length;
    if (n > 0) {
      const zeros = Array(n).fill(0);
      const ones = Array(n).fill(1);

      hoverTargetsRef.current = zeros.slice();
      hoverProgressesRef.current = zeros.slice();
      setHoverProgresses(zeros);

      faceTargetsRef.current = zeros.slice();
      faceProgressesRef.current = zeros.slice();
      setFaceProgresses(zeros);

      fadeTargetsRef.current = ones.slice();
      fadeProgressesRef.current = ones.slice();
      setFadeProgresses(ones);
    }

    // Prevent any vinyl from rendering above others while resetting
    deselectionTimeRef.current = null;
    lastSelectedIndexRef.current = null;
    hoverLockIndexRef.current = null;
    // Also reset disc appearance delay
    discStartArmedRef.current = false;
    setShowDisc(false);
  }, [clearSelectionKey, items.length]);
  
  // Handle external selection (e.g., from list view)
  useEffect(() => {
    if (externalSelectVideoId) {
      const index = items.findIndex(item => item.videoId === externalSelectVideoId);
      if (index !== -1 && selectedIndex !== index) {
        setSelectedIndex(index);
        // Trigger overlay animation
        deselectionTimeRef.current = null;
        overlayTimerRef.current = window.setTimeout(() => {
          overlayTargetRef.current = 1;
        }, 2000);
        // Start playback
        if (typeof onRequestPlay === "function") {
          setTimeout(() => {
            onRequestPlay(externalSelectVideoId);
          }, 0);
        }
        // Set face targets
        const faceArr = faceTargetsRef.current.slice();
        for (let j = 0; j < faceArr.length; j++) {
          faceArr[j] = j === index ? 1 : 0;
        }
        faceTargetsRef.current = faceArr;
        // Set fade targets
        const fadeArr = fadeTargetsRef.current.slice();
        for (let j = 0; j < fadeArr.length; j++) {
          fadeArr[j] = j === index ? 1 : 0;
        }
        fadeTargetsRef.current = fadeArr;
      }
    }
  }, [externalSelectVideoId, items, selectedIndex, onRequestPlay]);
  
  const discStartArmedRef = useRef<boolean>(false);
  const discTiltXTargetRef = useRef<number>(0); // normalized -1..1
  const discTiltYTargetRef = useRef<number>(0); // normalized -1..1
  const [discWidthPx, setDiscWidthPx] = useState<number | null>(null);
  const discWasSpinningRef = useRef<boolean>(false); // Track if disc was spinning to prevent click

  // Track aspect ratios once images are loaded
  useEffect(() => {
    let isMounted = true;
    async function loadAspects() {
      const promises = items.map(
        (it) =>
          new Promise<number>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img.width / img.height || 1);
            img.onerror = () => resolve(1);
            img.src = it.src;
          })
      );
      const loaded = await Promise.all(promises);
      if (isMounted) setAspects(loaded);
    }
    loadAspects();
    // align hover arrays length to items
    const n = items.length;
    const prevLength = hoverProgressesRef.current.length;
    
    // Only reset arrays if length actually changed, otherwise preserve current values
    if (prevLength !== n) {
      hoverProgressesRef.current = Array(n).fill(0);
      hoverTargetsRef.current = Array(n).fill(0);
      setHoverProgresses(hoverProgressesRef.current.slice());
      // align face arrays
      faceProgressesRef.current = Array(n).fill(0);
      faceTargetsRef.current = Array(n).fill(0);
      setFaceProgresses(faceProgressesRef.current.slice());
      fadeProgressesRef.current = Array(n).fill(1);
      fadeTargetsRef.current = Array(n).fill(1);
      setFadeProgresses(fadeProgressesRef.current.slice());
    }
    return () => {
      isMounted = false;
    };
  }, [items]);

  // Smoothly ease t toward tTargetRef
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  useEffect(() => {
    hoverProgressesRef.current = hoverProgresses;
  }, [hoverProgresses]);
  useEffect(() => {
    faceProgressesRef.current = faceProgresses;
  }, [faceProgresses]);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);
  useEffect(() => {
    overlayAlphaRef.current = overlayAlpha;
  }, [overlayAlpha]);
  useEffect(() => {
    function step() {
      const cur = tRef.current;
      const target = tTargetRef.current;
      const ease = 0.08; // Reduced from 0.12 for smoother, more fluid scrolling
      const next = cur + (target - cur) * ease;
      if (Math.abs(next - cur) > 0.0005) {
        setT(next);
      }
      // per-item hover easing
      const hp = hoverProgressesRef.current;
      const ht = hoverTargetsRef.current;
      if (hp.length === ht.length && hp.length > 0) {
        let changed = false;
        const nextArr = new Array(hp.length);
        for (let i = 0; i < hp.length; i++) {
          const v = hp[i];
          const tv = ht[i];
          const nv = v + (tv - v) * HOVER_EASE;
          nextArr[i] = nv;
          if (Math.abs(nv - v) > 0.0005) changed = true;
        }
        if (changed) {
          setHoverProgresses(nextArr);
        }
      }
      // per-item facing easing
      const fp = faceProgressesRef.current;
      const ft = faceTargetsRef.current;
      if (fp.length === ft.length && fp.length > 0) {
        let changed2 = false;
        const nextFace = new Array(fp.length);
        for (let i = 0; i < fp.length; i++) {
          const v = fp[i];
          const tv = ft[i];
          const nv = v + (tv - v) * FACE_EASE;
          nextFace[i] = nv;
          if (Math.abs(nv - v) > 0.0005) changed2 = true;
        }
        if (changed2) setFaceProgresses(nextFace);
      }
      // per-item fade easing (no cooldown; when targets go back to 1, everything fades in together)
      const fdp = fadeProgressesRef.current;
      const fdt = fadeTargetsRef.current;
      if (fdp.length === fdt.length && fdp.length > 0) {
        let changed3 = false;
        const nextFade = new Array(fdp.length);
        for (let i = 0; i < fdp.length; i++) {
          const v = fdp[i];
          const tv = fdt[i];
          const nv = v + (tv - v) * FADE_EASE;
          nextFade[i] = nv;
          if (Math.abs(nv - v) > 0.0005) changed3 = true;
        }
        if (changed3) setFadeProgresses(nextFade);
      }
      // overlay easing
      {
        const curA = overlayAlphaRef.current;
        const tgtA = overlayTargetRef.current;
        const nextA = curA + (tgtA - curA) * OVERLAY_EASE;
        if (Math.abs(nextA - curA) > 0.0005) {
          setOverlayAlpha(nextA);
        }
        // When overlay fully visible, arm disc start after 0.5s
        if (tgtA === 1 && nextA > 0.995 && !discStartArmedRef.current) {
          discStartArmedRef.current = true;
          if (discTimerRef.current) {
            clearTimeout(discTimerRef.current);
            discTimerRef.current = null;
          }
          discTimerRef.current = window.setTimeout(() => {
            setShowDisc(true);
            // Audio playback already started when vinyl was clicked, no need to call again
          }, 500);
        }
        // If overlay is hiding, cancel disc and disarm
        if (tgtA === 0) {
          if (discTimerRef.current) {
            clearTimeout(discTimerRef.current);
            discTimerRef.current = null;
          }
          discStartArmedRef.current = false;
          if (showDisc) setShowDisc(false);
        }
      }
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  const count = items.length;
  const k = Math.max(count - 1, 0);
  const effectiveYawDeg = yRotationDeg;
  const yRotationRad = THREE.MathUtils.degToRad(effectiveYawDeg);
  const xRotationRad = THREE.MathUtils.degToRad(xRotationDeg);
  const zRotationRad = THREE.MathUtils.degToRad(zRotationDeg);
  const baseQuat = useMemo(() => {
    const e = new THREE.Euler(xRotationRad, yRotationRad, zRotationRad, "YXZ");
    const q = new THREE.Quaternion();
    q.setFromEuler(e);
    return q;
  }, [xRotationRad, yRotationRad, zRotationRad]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      <Canvas
        orthographic={DEFAULT_USE_ORTHO}
        shadows
        camera={{
          position: cameraPosition,
          // When orthographic, zoom controls view size; fov is ignored
          zoom: DEFAULT_USE_ORTHO ? DEFAULT_ORTHO_ZOOM : undefined,
          fov: DEFAULT_USE_ORTHO ? undefined : fov,
          near: 0.1,
          far: 1000,
        }}
        dpr={[1, 2]}
        gl={{ 
          alpha: true, 
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false,
        }}
        style={{ width: "100%", height: "100%", position: "relative", zIndex: 2 }}
      >
        <CameraSetup position={cameraPosition} lookAt={cameraLookAt} />
        <color attach="background" args={["#ffffff"]} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[6, 7, 6]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-5, -3, 5]} intensity={0.45} />

        <group>
          {items.map((item, i) => {
            // Hide other items only while one is actively selected.
            // When selection is cleared, show the full stack immediately again.
            if (selectedIndex !== null && selectedIndex !== i) {
              return null;
            }

            const aspect = aspects[i] ?? 1;
            const s = i - t * k;
            const sOut = s; // keep conveyor position unchanged for hover
            let px = x0 + sOut * xStep;
            let py = y0 + sOut * yStep;
            let pz = z0 - sOut * zStep;
            // Lateral slide along the cover's local -X (left) without changing size
            const p = hoverProgresses[i] ?? 0;
            const faceP = faceProgresses[i] ?? 0;
            const faceTarget = faceTargetsRef.current[i] ?? 0;
            // no-op logging removed
            // Allow lateral offset only when rotation is largely finished and this vinyl is not hover-locked
            if (p > 0 && faceP <= 0.05 && hoverLockIndexRef.current !== i) {
              const right = new THREE.Vector3(1, 0, 0).applyQuaternion(baseQuat); // local +X in world
              const offset = right.multiplyScalar(HOVER_LATERAL * p);
              px += offset.x;
              py += offset.y;
              pz += offset.z;
            }

            // Compute interpolated quaternion from base -> neutral based on face progress
            const neutralQuat = new THREE.Quaternion(); // identity -> faces viewer
            const finalQuat = new THREE.Quaternion().slerpQuaternions(baseQuat, neutralQuat, faceP);

            // While rotating to face the viewer, also translate toward screen center
            if (faceP > 0) {
              const cx = 0;      // screen center X
              const cy = y0;     // keep baseline vertical center alignment
              const cz = 0;      // bring depth toward camera look-at origin
              px = THREE.MathUtils.lerp(px, cx, faceP);
              py = THREE.MathUtils.lerp(py, cy, faceP);
              pz = THREE.MathUtils.lerp(pz, cz, faceP);
            }

            const badgeRadius = 0.12;
            // Extra padding so the badge isn't glued to the edges
            const badgePadding = 0.05;
            const coverHalfWidth = (aspect * responsiveCoverScale) / 2;
            const coverHalfHeight = responsiveCoverScale / 2;
            const badgeX = coverHalfWidth - (badgeRadius + badgePadding);
            const badgeY = -coverHalfHeight + (badgeRadius + badgePadding);
            const badgeZ = (coverThickness * responsiveCoverScale) / 2 + 0.03;

            return (
              <group
                key={item.id || item.videoId || i}
                position={[px, py, pz]}
                quaternion={finalQuat}
                onClick={(e) => {
                  e.stopPropagation();
                  // Toggle selection; clicking the same cover again clears selection
                  setSelectedIndex((prev) => {
                    const nextSel = prev === i ? null : i;
                    // If deselecting, record the timestamp
                    if (nextSel === null) {
                      deselectionTimeRef.current = performance.now();
                      lastSelectedIndexRef.current = prev;
                      // lock hover on the returning vinyl until user hovers a different one
                      hoverLockIndexRef.current = prev ?? null;
                      // cancel and hide overlay when deselecting
                      if (overlayTimerRef.current !== null) {
                        clearTimeout(overlayTimerRef.current);
                        overlayTimerRef.current = null;
                      }
                      overlayTargetRef.current = 0;
                    } else {
                      deselectionTimeRef.current = null;
                      lastSelectedIndexRef.current = nextSel;
                      // selecting a new one clears any previous lock
                      hoverLockIndexRef.current = null;
                      // schedule overlay to fade in after 2s
                      if (overlayTimerRef.current !== null) {
                        clearTimeout(overlayTimerRef.current);
                        overlayTimerRef.current = null;
                      }
                      overlayTargetRef.current = 0; // start from 0
                      overlayTimerRef.current = window.setTimeout(() => {
                        overlayTargetRef.current = 1;
                      }, 2000);
                      // Start audio playback immediately when vinyl is clicked
                      const vid = items[i]?.videoId;
                      if (vid && typeof onRequestPlay === "function") {
                        // Start audio right away with 3-second fade-in
                        setTimeout(() => {
                          onRequestPlay(vid);
                        }, 0);
                      }
                    }
                    // set face targets
                    const faceArr = faceTargetsRef.current.slice();
                    for (let j = 0; j < faceArr.length; j++) faceArr[j] = (nextSel === j ? 1 : 0);
                    faceTargetsRef.current = faceArr;
                    // no-op logging removed
                    // set fade targets
                    const fadeArr = fadeTargetsRef.current.slice();
                    for (let j = 0; j < fadeArr.length; j++) fadeArr[j] = (nextSel === null ? 1 : (nextSel === j ? 1 : 0));
                    fadeTargetsRef.current = fadeArr;
                    return nextSel;
                  });
                  if (onSelect) onSelect(item, i);
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  // Disable hover on touch devices or while scrolling
                  if (isTouchDevice || isScrollingRef.current) return;
                  
                  // If hover is locked on another vinyl, hovering a different one unlocks it
                  if (hoverLockIndexRef.current !== null && hoverLockIndexRef.current !== i) {
                    hoverLockIndexRef.current = null;
                  }
                  // set only this index as target; others decay smoothly
                  const arr = hoverTargetsRef.current.slice();
                  for (let j = 0; j < arr.length; j++) arr[j] = (j === i ? 1 : 0);
                  hoverTargetsRef.current = arr;
                  // show tooltip with title (ALL CAPS)
                  const title = (item as any)?.title ? String((item as any).title).toUpperCase() : "";
                  setTooltip({ text: title, x: e.clientX + 12, y: e.clientY + 16, visible: !!title });
                }}
                onPointerMove={(e) => {
                  // Disable on touch devices or while scrolling
                  if (isTouchDevice || isScrollingRef.current) return;
                  
                  // follow cursor
                  if (tooltip.visible) {
                    setTooltip((prev) => ({ ...prev, x: e.clientX + 12, y: e.clientY + 16 }));
                  }
                }}
                onPointerOut={(e) => {
                  e.stopPropagation();
                  // Disable on touch devices or while scrolling
                  if (isTouchDevice || isScrollingRef.current) return;
                  
                  // decay this one too
                  const arr = hoverTargetsRef.current.slice();
                  if (arr[i] !== undefined) arr[i] = 0;
                  hoverTargetsRef.current = arr;
                  setTooltip((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Suspense fallback={null}>
                  <CoverPlane
                    src={item.src}
                    aspect={aspect}
                    opacity={1}
                    showBorders={showBorders}
                    yRotationRad={0}
                    scale={responsiveCoverScale}
                    thickness={coverThickness}
                    onClick={undefined}
                  />
                </Suspense>
                {p > 0.35 && onDelete && !isTouchDevice && (
                  <group
                    position={[badgeX, badgeY, badgeZ]}
                    onPointerOver={(e) => {
                      e.stopPropagation();
                      // Disable on touch devices or while scrolling
                      if (isTouchDevice || isScrollingRef.current) return;
                      
                      // Treat hovering the minus as hovering the cover
                      const arr = hoverTargetsRef.current.slice();
                      for (let j = 0; j < arr.length; j++) arr[j] = j === i ? 1 : 0;
                      hoverTargetsRef.current = arr;
                      // Show DELETE tooltip near cursor
                      setTooltip({
                        text: "DELETE",
                        x: e.clientX + 12,
                        y: e.clientY + 16,
                        visible: true,
                      });
                    }}
                    onPointerMove={(e) => {
                      // Disable on touch devices or while scrolling
                      if (isTouchDevice || isScrollingRef.current) return;
                      
                      // Keep DELETE tooltip following the cursor
                      setTooltip((prev) =>
                        prev.visible && prev.text === "DELETE"
                          ? { ...prev, x: e.clientX + 12, y: e.clientY + 16 }
                          : prev
                      );
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <mesh
                      onClick={(e) => {
                        e.stopPropagation();
                        const label =
                          (item as any)?.title
                            ? String((item as any).title)
                            : "this mix";
                        const confirmed = window.confirm(
                          `Remove "${label}" from your crate?`
                        );
                        if (confirmed) {
                          onDelete(item, i);
                        }
                      }}
                    >
                      {/* Flat minus sign, aligned with the cover, using frosted-glass styling */}
                      <boxGeometry args={[0.16, 0.02, 0.006]} />
                      <meshStandardMaterial
                        color="#ffffff"
                        opacity={0.7}
                        transparent
                        roughness={0.9}
                        metalness={0}
                      />
                    </mesh>
                  </group>
                )}
                {/* increase roughness via an overlay material tweak by attaching keyframes isn't trivial declaratively per mesh,
                    so we rely on alpha modulation above; roughness is set on material in CoverPlane statically. */}
              </group>
            );
          })}
        </group>

        {showShadows && (
          <ContactShadows
            position={[0, -0.8, 0]}
            opacity={0.45}
            scale={6 * responsiveCoverScale}
            blur={1.3}
            far={1.2}
            resolution={1024}
            color="#000000"
          />
        )}
      </Canvas>
      {/* Full-screen white overlay that fades in after selection */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#ffffff",
          opacity: Math.max(0, Math.min(1, overlayAlpha)),
          transition: "opacity 0s linear", // opacity animated via RAF easing, keep CSS instant
          pointerEvents: "none",
          zIndex: 100,
        }}
      />
      {/* Disc overlay - appears 1s after overlay is fully opaque */}
      {showDisc && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "45%", // nudge disc + text slightly upward
            transform: "translate(-50%, -50%)",
            zIndex: 110,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            pointerEvents: "none", // let only the canvas receive pointer events
          }}
        >
          {(() => {
            // Keep the disc comfortably sized; default to 360px if measurement is unavailable/small
            // On mobile (width < 768px), use full screen width, but 25% smaller
            const measured = discWidthPx ? Math.round(discWidthPx) : 0;
            const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
            const discPx = isMobile 
              ? window.innerWidth * 0.75 // full screen width but 25% smaller
              : Math.max(480, measured);
            return (
              <>
                <Canvas
                  // Use perspective so tilt visibly foreshortens
                  camera={{ position: [0, 0, 6], fov: 45, near: 0.1, far: 1000 }}
                  dpr={[1, 2]}
                  gl={{ 
                    alpha: true,
                    powerPreference: 'high-performance',
                    preserveDrawingBuffer: false,
                    failIfMajorPerformanceCaveat: false,
                  }}
                  style={{
                    width: `${discPx}px`,
                    height: `${discPx}px`,
                    pointerEvents: "auto",
                  }}
                  onClick={() => {
                    // Don't toggle if user was spinning the disc
                    if (discWasSpinningRef.current) {
                      return;
                    }
                    const idx = selectedIndexRef.current;
                    const vid =
                      idx !== null && items[idx]?.videoId
                        ? items[idx].videoId
                        : undefined;
                    if (vid && typeof onRequestToggle === "function") {
                      onRequestToggle(vid);
                    }
                  }}
                  onPointerMove={(e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    const nx = ((e.clientX - cx) / (rect.width / 2));
                    const ny = ((e.clientY - cy) / (rect.height / 2));
                    discTiltXTargetRef.current = THREE.MathUtils.clamp(ny, -1, 1);
                    discTiltYTargetRef.current = THREE.MathUtils.clamp(nx, -1, 1);
                  }}
                  onPointerLeave={() => {
                    discTiltXTargetRef.current = 0;
                    discTiltYTargetRef.current = 0;
                  }}
                >
                  <ambientLight intensity={0.8} />
                  <Disc3D 
                    isPlaying={isPlaying} 
                    tiltXRef={discTiltXTargetRef} 
                    tiltYRef={discTiltYTargetRef} 
                    onSeek={onSeek} 
                    wasSpinningRef={discWasSpinningRef}
                  />
                </Canvas>
                {/* Video title, channel, and date below disc */}
                {selectedIndex !== null && items[selectedIndex]?.title && (
                  <div
                    style={{
                      marginTop: "16px",
                      maxWidth: `${discPx}px`,
                      width: "100%",
                      padding: isMobile ? "0 16px" : "0",
                    }}
                  >
                    {/* Timecode row: current (left) and duration (right) */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        width: "100%",
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: isMobile ? "15px" : "18px",
                        fontWeight: "bold",
                        letterSpacing: isMobile ? "1.5px" : "2px",
                        color: "#000000",
                        marginBottom: "12px",
                      }}
                    >
                      {/* Current position */}
                      <div style={{ flex: "1 1 auto", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden" }}>
                        {(() => {
                          function pad(n: number) { return String(n).padStart(2, "0"); }
                          const h = Math.floor(currentTime / 3600);
                          const m = Math.floor((currentTime % 3600) / 60);
                          const s = Math.floor(currentTime % 60);
                          return `${pad(h)}:${pad(m)}:${pad(s)}`;
                        })()}
                      </div>
                      {/* Total duration (formatted to HH:MM:SS) */}
                      <div style={{ flex: "1 1 auto", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden" }}>
                        {(() => {
                          const raw = items[selectedIndex]?.duration || "";
                          function pad(n: number) { return String(n).padStart(2, "0"); }
                          function fromSeconds(total: number) {
                            const h = Math.floor(total / 3600);
                            const m = Math.floor((total % 3600) / 60);
                            const s = Math.floor(total % 60);
                            return `${pad(h)}:${pad(m)}:${pad(s)}`;
                          }
                          // ISO 8601 (YouTube), e.g., PT1H2M3S, PT3M14S, PT45S
                          if (/^PT/i.test(raw)) {
                            const h = /(\d+)H/i.test(raw) ? parseInt(RegExp.$1 || "0", 10) : (raw.match(/(\d+)H/i)?.[1] ? parseInt(raw.match(/(\d+)H/i)![1], 10) : 0);
                            const m = /(\d+)M/i.test(raw) ? parseInt(RegExp.$1 || "0", 10) : (raw.match(/(\d+)M/i)?.[1] ? parseInt(raw.match(/(\d+)M/i)![1], 10) : 0);
                            const s = /(\d+)S/i.test(raw) ? parseInt(RegExp.$1 || "0", 10) : (raw.match(/(\d+)S/i)?.[1] ? parseInt(raw.match(/(\d+)S/i)![1], 10) : 0);
                            return `${pad(h)}:${pad(m)}:${pad(s)}`;
                          }
                          // Human-readable "1h 2m 3s" (or any subset like "3m 14s", "45s", "2h")
                          if (/[hms]/i.test(raw)) {
                            const h = (() => { const m = raw.match(/(\d+)\s*h/i); return m ? parseInt(m[1], 10) : 0; })();
                            const m = (() => { const m2 = raw.match(/(\d+)\s*m/i); return m2 ? parseInt(m2[1], 10) : 0; })();
                            const s = (() => { const m3 = raw.match(/(\d+)\s*s/i); return m3 ? parseInt(m3[1], 10) : 0; })();
                            return `${pad(h)}:${pad(m)}:${pad(s)}`;
                          }
                          // mm:ss or hh:mm:ss
                          if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) {
                            const parts = raw.split(":").map((p) => parseInt(p, 10));
                            let h = 0, m = 0, s = 0;
                            if (parts.length === 2) { [m, s] = parts; }
                            if (parts.length === 3) { [h, m, s] = parts; }
                            return `${pad(h)}:${pad(m)}:${pad(s)}`;
                          }
                          // plain seconds
                          if (/^\d+$/.test(raw)) {
                            return fromSeconds(parseInt(raw, 10));
                          }
                          // Fallback: show as-is if looks like already HH:MM:SS; else 00:00:00
                          return /^\d{2}:\d{2}:\d{2}$/.test(raw) ? raw : "00:00:00";
                        })()}
                      </div>
                    </div>
                    {/* Title */}
                    <a
                      href={`https://www.youtube.com/watch?v=${items[selectedIndex].videoId}${currentTime > 0 ? `&t=${Math.floor(currentTime)}` : ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: isMobile ? "15px" : "18px",
                        fontWeight: "bold",
                        letterSpacing: isMobile ? "1.5px" : "2px",
                        color: "#000000",
                        textAlign: "justify",
                        wordWrap: "break-word",
                        overflowWrap: "break-word",
                        marginBottom: "12px",
                        textDecoration: "none",
                        cursor: "pointer",
                        pointerEvents: "auto",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.textDecoration = "underline";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.textDecoration = "none";
                      }}
                    >
                      {String(items[selectedIndex].title).toUpperCase()}
                    </a>
                    {/* Channel (left) and Date (right), same size as title */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        width: "100%",
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: isMobile ? "15px" : "18px",
                        fontWeight: "bold",
                        letterSpacing: isMobile ? "1.5px" : "2px",
                        color: "#000000",
                      }}
                    >
                      {/* Channel poster (title) left-aligned */}
                      <div style={{ flex: "1 1 auto", textAlign: "left", whiteSpace: isMobile ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {items[selectedIndex].channelTitle ? String(items[selectedIndex].channelTitle).toUpperCase() : ""}
                      </div>
                      {/* Date right-aligned */}
                      <div style={{ flex: "1 1 auto", textAlign: "right", whiteSpace: isMobile ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {(() => {
                          if (!items[selectedIndex].created_at) return "";
                          const d = new Date(items[selectedIndex].created_at!);
                          const m = String(d.getMonth() + 1).padStart(2, "0");
                          const day = String(d.getDate()).padStart(2, "0");
                          const y = d.getFullYear();
                          return `${m}/${day}/${y}`;
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
      {/* White gradient border overlay - 10% padding from edges, 10% opacity outer → 0% opacity inner */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          background: `
            linear-gradient(to right, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 10%),
            linear-gradient(to left, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 10%),
            linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 10%),
            linear-gradient(to top, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 10%)
          `,
          backgroundSize: "10% 100%, 10% 100%, 100% 10%, 100% 10%",
          backgroundPosition: "left, right, bottom, top",
          backgroundRepeat: "no-repeat",
        }}
      />
      {tooltip.visible && tooltip.text && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate3d(0,0,0)",
            pointerEvents: "none",
            zIndex: 40,
            background: "rgba(17,17,17,0.9)",
            color: "#fff",
            padding: "6px 8px",
            borderRadius: 6,
            fontSize: 12,
            letterSpacing: 1.2,
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            whiteSpace: "nowrap",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}























