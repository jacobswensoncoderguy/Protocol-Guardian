import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { BodyZone, BODY_ZONES } from '@/data/bodyZoneMapping';

interface BodyMeshProps {
  zoneIntensities: Record<BodyZone, number>;
  onZoneTap?: (zone: BodyZone) => void;
}

function BodyZoneMesh({ position, scale, intensity, color, shape, zone, onTap }: {
  position: [number, number, number];
  scale: [number, number, number];
  intensity: number;
  color: string;
  shape: 'sphere' | 'box' | 'cylinder';
  zone: BodyZone;
  onTap?: (zone: BodyZone) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const threeColor = useMemo(() => new THREE.Color(color), [color]);
  const dimColor = useMemo(() => {
    const c = new THREE.Color(color);
    c.multiplyScalar(0.15);
    return c;
  }, [color]);

  const activeColor = useMemo(() => {
    const c = new THREE.Color();
    c.lerpColors(dimColor, threeColor, hovered ? Math.max(intensity, 0.7) : intensity);
    return c;
  }, [dimColor, threeColor, intensity, hovered]);

  useFrame((state) => {
    if (meshRef.current) {
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 1.5 + position[1]) * 0.02 * intensity;
      const hoverScale = hovered ? 1.08 : 1;
      meshRef.current.scale.set(scale[0] * breathe * hoverScale, scale[1] * breathe * hoverScale, scale[2] * breathe * hoverScale);
    }
    if (glowRef.current) {
      const pulse = hovered ? 0.6 : 0.3 + Math.sin(state.clock.elapsedTime * 2 + position[1] * 2) * 0.15;
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

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onTap?.(zone);
  };

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        scale={scale}
        onClick={handleClick}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <meshStandardMaterial
          color={activeColor}
          wireframe={false}
          transparent
          opacity={hovered ? 0.9 : 0.3 + intensity * 0.7}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>
      <mesh geometry={geometry} scale={scale}>
        <meshBasicMaterial
          color={activeColor}
          wireframe
          transparent
          opacity={hovered ? 0.8 : 0.2 + intensity * 0.5}
        />
      </mesh>
      {(intensity > 0.1 || hovered) && (
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

function HumanBody({ zoneIntensities, onZoneTap }: BodyMeshProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
  });

  const zones: Array<{ zone: BodyZone; position: [number, number, number]; scale: [number, number, number]; shape: 'sphere' | 'box' | 'cylinder' }> = [
    { zone: 'brain', position: [0, 2.2, 0], scale: [0.55, 0.65, 0.55], shape: 'sphere' },
    { zone: 'heart', position: [0, 1.0, 0], scale: [0.85, 0.7, 0.45], shape: 'box' },
    { zone: 'arms', position: [-1.0, 1.1, 0], scale: [0.28, 0.8, 0.28], shape: 'cylinder' },
    { zone: 'arms', position: [1.0, 1.1, 0], scale: [0.28, 0.8, 0.28], shape: 'cylinder' },
    { zone: 'arms', position: [-1.0, 0.1, 0], scale: [0.22, 0.7, 0.22], shape: 'cylinder' },
    { zone: 'arms', position: [1.0, 0.1, 0], scale: [0.22, 0.7, 0.22], shape: 'cylinder' },
    { zone: 'core', position: [0, 0.15, 0], scale: [0.7, 0.55, 0.38], shape: 'box' },
    { zone: 'hormonal', position: [0, -0.45, 0], scale: [0.75, 0.35, 0.4], shape: 'box' },
    { zone: 'legs', position: [-0.35, -1.3, 0], scale: [0.3, 0.9, 0.3], shape: 'cylinder' },
    { zone: 'legs', position: [0.35, -1.3, 0], scale: [0.3, 0.9, 0.3], shape: 'cylinder' },
    { zone: 'legs', position: [-0.35, -2.3, 0], scale: [0.22, 0.8, 0.22], shape: 'cylinder' },
    { zone: 'legs', position: [0.35, -2.3, 0], scale: [0.22, 0.8, 0.22], shape: 'cylinder' },
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
          zone={z.zone}
          onTap={onZoneTap}
        />
      ))}
      <mesh position={[0, 0.6, -0.15]}>
        <cylinderGeometry args={[0.04, 0.04, 3.8, 4]} />
        <meshBasicMaterial color="hsl(230, 30%, 25%)" transparent opacity={0.3} />
      </mesh>
      <mesh position={[0, 1.7, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 0.3, 6]} />
        <meshBasicMaterial color="hsl(230, 30%, 20%)" transparent opacity={0.3} wireframe />
      </mesh>
    </group>
  );
}

interface GeometricBodyProps {
  zoneIntensities: Record<BodyZone, number>;
  onZoneTap?: (zone: BodyZone) => void;
  className?: string;
}

const GeometricBody = ({ zoneIntensities, onZoneTap, className = '' }: GeometricBodyProps) => {
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
        <HumanBody zoneIntensities={zoneIntensities} onZoneTap={onZoneTap} />
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
