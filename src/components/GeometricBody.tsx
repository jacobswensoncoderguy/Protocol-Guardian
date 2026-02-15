import { useState } from 'react';
import { BodyZone, BODY_ZONES } from '@/data/bodyZoneMapping';
import bodyMale from '@/assets/body-male.jpeg';
import bodyFemale from '@/assets/body-female.jpeg';

interface GeometricBodyProps {
  zoneIntensities: Record<BodyZone, number>;
  onZoneTap?: (zone: BodyZone) => void;
  className?: string;
}

type Gender = 'male' | 'female';

// SVG clip-path style outlines for each zone, drawn as polygon percentages
// These trace the actual body region edges rather than boxy rectangles
const ZONE_PATHS: Record<Gender, Record<BodyZone, string>> = {
  male: {
    brain:    'M 35 2, 65 2, 68 8, 66 14, 34 14, 32 8',
    immune:   'M 34 14, 66 14, 64 19, 36 19',
    heart:    'M 30 19, 50 18, 70 19, 72 28, 50 32, 28 28',
    arms:     'M 10 20, 28 19, 28 28, 26 38, 18 42, 10 38, 8 28',
    core:     'M 30 32, 70 32, 68 46, 32 46',
    hormonal: 'M 32 46, 68 46, 66 52, 34 52',
    legs:     'M 22 52, 42 52, 44 72, 42 92, 36 95, 28 92, 24 72',
  },
  female: {
    brain:    'M 37 2, 63 2, 66 8, 64 15, 36 15, 34 8',
    immune:   'M 36 15, 64 15, 62 19, 38 19',
    heart:    'M 32 19, 50 18, 68 19, 70 28, 50 31, 30 28',
    arms:     'M 12 20, 30 19, 30 28, 28 36, 20 40, 12 36, 10 28',
    core:     'M 32 31, 68 31, 66 44, 34 44',
    hormonal: 'M 34 44, 66 44, 64 50, 36 50',
    legs:     'M 24 50, 44 50, 46 70, 44 90, 38 94, 30 90, 26 70',
  },
};

// Mirrored arm path for right side
const ZONE_PATHS_RIGHT_ARM: Record<Gender, string> = {
  male:   'M 72 19, 90 20, 92 28, 90 38, 82 42, 74 38, 72 28',
  female: 'M 70 19, 88 20, 90 28, 88 36, 80 40, 72 36, 70 28',
};

// Mirrored leg path for right side
const ZONE_PATHS_RIGHT_LEG: Record<Gender, string> = {
  male:   'M 58 52, 78 52, 76 72, 72 92, 64 95, 58 92, 56 72',
  female: 'M 56 50, 76 50, 74 70, 70 90, 62 94, 56 90, 54 70',
};

const GeometricBody = ({ zoneIntensities, onZoneTap, className = '' }: GeometricBodyProps) => {
  const [hoveredZone, setHoveredZone] = useState<BodyZone | null>(null);
  const [gender, setGender] = useState<Gender>('male');
  const [pulsingZone, setPulsingZone] = useState<BodyZone | null>(null);

  const bodyImage = gender === 'male' ? bodyMale : bodyFemale;
  const paths = ZONE_PATHS[gender];

  const handleZoneTap = (zone: BodyZone) => {
    setPulsingZone(zone);
    setTimeout(() => setPulsingZone(null), 800);
    onZoneTap?.(zone);
  };

  const renderZonePath = (zone: BodyZone, pathStr: string, extra?: string) => {
    const info = BODY_ZONES[zone];
    const intensity = zoneIntensities[zone];
    const isHovered = hoveredZone === zone;
    const isPulsing = pulsingZone === zone;
    const isActive = intensity > 0.1;

    const points = pathStr;
    const strokeOpacity = isHovered ? 0.9 : isPulsing ? 1 : isActive ? 0.15 + intensity * 0.4 : 0;
    const fillOpacity = isHovered ? 0.08 : 0;
    const strokeWidth = isHovered || isPulsing ? 1.8 : 1;
    const glowSize = isPulsing ? 6 : isHovered ? 4 : 2;

    return (
      <g key={`${zone}-${extra || 'main'}`}>
        {/* Glow filter for this zone */}
        {(isHovered || isPulsing || isActive) && (
          <defs>
            <filter id={`glow-${zone}-${extra || 'main'}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={glowSize} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}
        <polygon
          points={points}
          fill={info.color}
          fillOpacity={fillOpacity}
          stroke={info.color}
          strokeWidth={strokeWidth}
          strokeOpacity={strokeOpacity}
          strokeLinejoin="round"
          filter={(isHovered || isPulsing) ? `url(#glow-${zone}-${extra || 'main'})` : undefined}
          className="cursor-pointer transition-all duration-300"
          style={{
            animation: isPulsing ? 'zonePulse 0.8s ease-out' : undefined,
          }}
          onClick={() => handleZoneTap(zone)}
          onPointerEnter={() => setHoveredZone(zone)}
          onPointerLeave={() => setHoveredZone(null)}
        />
      </g>
    );
  };

  return (
    <div className={`w-full h-full flex flex-col items-center ${className}`}>
      {/* Gender toggle */}
      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={() => setGender('male')}
          className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all duration-300 ${
            gender === 'male'
              ? 'bg-primary/20 text-primary border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.2)]'
              : 'bg-secondary/30 text-muted-foreground border border-border/20 hover:border-border/40'
          }`}
        >
          Male
        </button>
        <button
          onClick={() => setGender('female')}
          className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all duration-300 ${
            gender === 'female'
              ? 'bg-primary/20 text-primary border border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.2)]'
              : 'bg-secondary/30 text-muted-foreground border border-border/20 hover:border-border/40'
          }`}
        >
          Female
        </button>
      </div>

      {/* Body figure with drop shadow on dark */}
      <div className="relative w-full flex-1 flex items-center justify-center">
        <div className="relative max-w-[220px] w-full">
          {/* Drop shadow behind figure */}
          <div
            className="absolute inset-0 rounded-xl"
            style={{
              filter: 'blur(20px)',
              background: 'radial-gradient(ellipse at center 80%, hsl(0 0% 0% / 0.6) 0%, transparent 70%)',
              transform: 'translateY(8px) scaleX(0.85)',
            }}
          />

          {/* The cartoon figure */}
          <img
            src={bodyImage}
            alt={`${gender} body map`}
            className="relative w-full h-auto object-contain transition-opacity duration-500"
            style={{
              filter: 'drop-shadow(4px 6px 12px hsl(0 0% 0% / 0.6))',
            }}
            draggable={false}
          />

          {/* SVG overlay for zone outlines */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: 'none' }}
          >
            <g style={{ pointerEvents: 'auto' }}>
              {(Object.keys(paths) as BodyZone[]).map((zone) => (
                <>
                  {renderZonePath(zone, paths[zone])}
                  {zone === 'arms' && renderZonePath(zone, ZONE_PATHS_RIGHT_ARM[gender], 'right-arm')}
                  {zone === 'legs' && renderZonePath(zone, ZONE_PATHS_RIGHT_LEG[gender], 'right-leg')}
                </>
              ))}
            </g>
          </svg>

          {/* Hover label */}
          {hoveredZone && (() => {
            const info = BODY_ZONES[hoveredZone];
            const intensity = zoneIntensities[hoveredZone];
            return (
              <div
                className="absolute z-20 pointer-events-none left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-center"
                style={{
                  top: '-8px',
                  backgroundColor: 'hsl(var(--card) / 0.95)',
                  border: `1px solid ${info.color}60`,
                  boxShadow: `0 0 16px ${info.color}30, 0 4px 12px hsl(0 0% 0% / 0.4)`,
                }}
              >
                <span
                  className="text-[11px] font-semibold font-mono block"
                  style={{ color: info.color }}
                >
                  {info.label}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {Math.round(intensity * 100)}% coverage
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      <style>{`
        @keyframes zonePulse {
          0% { stroke-opacity: 1; stroke-width: 2.5; }
          50% { stroke-opacity: 0.6; stroke-width: 1.5; }
          100% { stroke-opacity: 0; stroke-width: 1; }
        }
      `}</style>
    </div>
  );
};

export default GeometricBody;
