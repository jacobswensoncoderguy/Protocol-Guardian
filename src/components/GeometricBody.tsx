import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { BodyZone, BODY_ZONES } from '@/data/bodyZoneMapping';

interface BodyMeshProps {
  zoneIntensities: Record<BodyZone, number>;
}

// Low-poly geometric body zone meshes
function BodyZoneMesh({ position, scale, intensity, color, shape }: {
  position: [number, number, number];
  scale: [number, number, number];
  intensity: number;
  color: string;
  shape: 'sphere' | 'box' | 'cylinder';
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Parse HSL color
  const threeColor = useMemo(() => new THREE.Color(color), [color]);
  const dimColor = useMemo(() => {
    const c = new THREE.Color(color);
    c.multiplyScalar(0.15);
    return c;
  }, [color]);

  const activeColor = useMemo(() => {
    const c = new THREE.Color();
    c.lerpColors(dimColor, threeColor, intensity);
    return c;
  }, [dimColor, threeColor, intensity]);

  useFrame((state) => {
    if (meshRef.current) {
      // Subtle breathing animation
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 1.5 + position[1]) * 0.02 * intensity;
      meshRef.current.scale.set(scale[0] * breathe, scale[1] * breathe, scale[2] * breathe);
    }
    if (glowRef.current) {
      const pulse = 0.3 + Math.sin(state.clock.elapsedTime * 2 + position[1] * 2) * 0.15;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = intensity * pulse;
    }
  });

  const geometry = useMemo(() => {
    switch (shape) {
      case 'sphere': return new THREE.IcosahedronGeometry(1, 1);
      case 'box': return new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
      case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
    }
  }, [shape]);

  return (
    <group position={position}>
      {/* Main mesh */}
      <mesh ref={meshRef} geometry={geometry} scale={scale}>
        <meshStandardMaterial
          color={activeColor}
          wireframe={false}
          transparent
          opacity={0.3 + intensity * 0.7}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>
      {/* Wireframe overlay */}
      <mesh geometry={geometry} scale={scale}>
        <meshBasicMaterial
          color={activeColor}
          wireframe
          transparent
          opacity={0.2 + intensity * 0.5}
        />
      </mesh>
      {/* Glow mesh */}
      {intensity > 0.1 && (
        <mesh ref={glowRef} geometry={geometry} scale={[scale[0] * 1.15, scale[1] * 1.15, scale[2] * 1.15]}>
          <meshBasicMaterial
            color={threeColor}
            transparent
            opacity={0}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </group>
  );
}

function HumanBody({ zoneIntensities }: BodyMeshProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      // Slow auto-rotation when not being interacted with
      groupRef.current.rotation.y += 0.002;
    }
  });

  // Body zone geometry definitions: zone → [position, scale, shape]
  const zones: Array<{ zone: BodyZone; position: [number, number, number]; scale: [number, number, number]; shape: 'sphere' | 'box' | 'cylinder' }> = [
    // Head (brain/cognitive)
    { zone: 'brain', position: [0, 2.2, 0], scale: [0.55, 0.65, 0.55], shape: 'sphere' },
    // Chest (cardiovascular)
    { zone: 'heart', position: [0, 1.0, 0], scale: [0.85, 0.7, 0.45], shape: 'box' },
    // Upper arms (musculoskeletal)
    { zone: 'arms', position: [-1.0, 1.1, 0], scale: [0.28, 0.8, 0.28], shape: 'cylinder' },
    { zone: 'arms', position: [1.0, 1.1, 0], scale: [0.28, 0.8, 0.28], shape: 'cylinder' },
    // Forearms
    { zone: 'arms', position: [-1.0, 0.1, 0], scale: [0.22, 0.7, 0.22], shape: 'cylinder' },
    { zone: 'arms', position: [1.0, 0.1, 0], scale: [0.22, 0.7, 0.22], shape: 'cylinder' },
    // Core (metabolic)
    { zone: 'core', position: [0, 0.15, 0], scale: [0.7, 0.55, 0.38], shape: 'box' },
    // Hips / hormonal
    { zone: 'hormonal', position: [0, -0.45, 0], scale: [0.75, 0.35, 0.4], shape: 'box' },
    // Upper legs (recovery)
    { zone: 'legs', position: [-0.35, -1.3, 0], scale: [0.3, 0.9, 0.3], shape: 'cylinder' },
    { zone: 'legs', position: [0.35, -1.3, 0], scale: [0.3, 0.9, 0.3], shape: 'cylinder' },
    // Lower legs
    { zone: 'legs', position: [-0.35, -2.3, 0], scale: [0.22, 0.8, 0.22], shape: 'cylinder' },
    { zone: 'legs', position: [0.35, -2.3, 0], scale: [0.22, 0.8, 0.22], shape: 'cylinder' },
    // Immune - distributed as small spheres (thymus, spleen area)
    { zone: 'immune', position: [0.25, 1.5, 0.2], scale: [0.2, 0.2, 0.2], shape: 'sphere' },
    { zone: 'immune', position: [-0.15, 0.5, 0.2], scale: [0.18, 0.18, 0.18], shape: 'sphere' },
  ];

  return (
    <group ref={groupRef}>
      {zones.map((z, i) => (
        <BodyZoneMesh
          key={i}
          position={z.position}
          scale={z.scale}
          intensity={zoneIntensities[z.zone]}
          color={BODY_ZONES[z.zone].color}
          shape={z.shape}
        />
      ))}
      {/* Spine / central line */}
      <mesh position={[0, 0.6, -0.15]}>
        <cylinderGeometry args={[0.04, 0.04, 3.8, 4]} />
        <meshBasicMaterial color="hsl(230, 30%, 25%)" transparent opacity={0.3} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 1.7, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 0.3, 6]} />
        <meshBasicMaterial color="hsl(230, 30%, 20%)" transparent opacity={0.3} wireframe />
      </mesh>
    </group>
  );
}

interface GeometricBodyProps {
  zoneIntensities: Record<BodyZone, number>;
  className?: string;
}

const GeometricBody = ({ zoneIntensities, className = '' }: GeometricBodyProps) => {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={0.8} color="hsl(230, 100%, 65%)" />
        <pointLight position={[-5, -3, 3]} intensity={0.4} color="hsl(330, 100%, 60%)" />
        <pointLight position={[0, 3, -5]} intensity={0.3} color="hsl(45, 100%, 55%)" />
        <HumanBody zoneIntensities={zoneIntensities} />
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={4}
          maxDistance={10}
          minPolarAngle={Math.PI * 0.2}
          maxPolarAngle={Math.PI * 0.8}
          autoRotate={false}
        />
      </Canvas>
    </div>
  );
};

export default GeometricBody;
