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

// SVG path data — tightly traced to cartoon figure silhouettes
// viewBox is 0 0 100 100, preserveAspectRatio="none" so coords map to % of image
const ZONE_PATHS: Record<Gender, Record<BodyZone, string[]>> = {
  male: {
    brain: [
      // Head — rounded cranium following hairline and jaw
      'M 44,5 C 41,5 39,7 38,9 37,12 38,14.5 40,15.5 L 42,16 L 58,16 C 60,14.5 61,12 61,9 60,7 58,5 56,5 Z',
    ],
    immune: [
      // Neck — narrow column between jaw and shoulders
      'M 44,16 C 43,16.5 42,17 42,18 L 42,20 L 58,20 L 58,18 C 58,17 57,16.5 56,16 Z',
    ],
    heart: [
      // Chest/torso — shoulder to mid-rib, follows pec contour
      'M 34,20 C 31,20.5 29,21.5 28,23 L 27,26 L 28,30 L 30,33 L 34,35 L 66,35 L 70,33 L 72,30 L 73,26 L 72,23 C 71,21.5 69,20.5 66,20 Z',
    ],
    arms: [
      // Left arm — shoulder cap down to wrist, follows bicep/forearm taper
      'M 28,21 C 25,21 22,22 20,24 L 18,28 L 17,33 L 17,37 L 18,41 L 20,44 L 23,46 L 26,44 L 28,41 L 29,37 L 30,33 L 30,28 L 29,24 Z',
      // Right arm — mirrored
      'M 72,21 C 75,21 78,22 80,24 L 82,28 L 83,33 L 83,37 L 82,41 L 80,44 L 77,46 L 74,44 L 72,41 L 71,37 L 70,33 L 70,28 L 71,24 Z',
    ],
    core: [
      // Abs/midsection — from lower ribs to navel, narrowing at waist
      'M 35,35 C 34,36 33,38 33,40 L 33,44 L 34,47 L 36,48 L 64,48 L 66,47 L 67,44 L 67,40 C 67,38 66,36 65,35 Z',
    ],
    hormonal: [
      // Hip/waist — narrow band between abs and shorts waistline
      'M 36,48 C 35,49 34,50 34,52 L 35,54 L 38,55 L 62,55 L 65,54 L 66,52 C 66,50 65,49 64,48 Z',
    ],
    legs: [
      // Left leg — hip to ankle, follows thigh/calf contour
      'M 38,55 C 37,57 35,60 34,64 L 34,70 L 35,76 L 36,80 L 37,85 L 37,90 L 38,93 L 42,93 L 47,93 L 47,90 L 47,85 L 47,80 L 48,76 L 48,70 L 48,64 C 47,60 46,57 45,55 Z',
      // Right leg — mirrored
      'M 55,55 C 54,57 53,60 52,64 L 52,70 L 52,76 L 53,80 L 53,85 L 53,90 L 53,93 L 58,93 L 62,93 L 63,90 L 63,85 L 64,80 L 65,76 L 66,70 L 66,64 C 65,60 63,57 62,55 Z',
    ],
  },
  female: {
    brain: [
      // Head — slightly rounder than male
      'M 44,5 C 41,5 39,7 38,10 38,13 39,15 41,16 L 43,16.5 L 57,16.5 C 59,15 61,13 61,10 60,7 58,5 56,5 Z',
    ],
    immune: [
      // Neck
      'M 44,16.5 C 43,17 42,17.5 42,18.5 L 42,20.5 L 58,20.5 L 58,18.5 C 58,17.5 57,17 56,16.5 Z',
    ],
    heart: [
      // Chest — slightly narrower shoulders, bust contour
      'M 35,20.5 C 32,21 30,22 29,24 L 28,27 L 29,31 L 31,34 L 35,36 L 65,36 L 69,34 L 71,31 L 72,27 L 71,24 C 70,22 68,21 65,20.5 Z',
    ],
    arms: [
      // Left arm — slimmer taper
      'M 29,22 C 26,22 24,23 22,25 L 20,29 L 19,34 L 19,38 L 20,42 L 22,45 L 25,47 L 27,45 L 29,42 L 30,38 L 31,34 L 31,29 L 30,25 Z',
      // Right arm
      'M 71,22 C 74,22 76,23 78,25 L 80,29 L 81,34 L 81,38 L 80,42 L 78,45 L 75,47 L 73,45 L 71,42 L 70,38 L 69,34 L 69,29 L 70,25 Z',
    ],
    core: [
      // Waist — hourglass shape, narrower than male
      'M 36,36 C 35,37 34,39 34,41 L 34,45 L 35,48 L 37,49 L 63,49 L 65,48 L 66,45 L 66,41 C 66,39 65,37 64,36 Z',
    ],
    hormonal: [
      // Hips — wider than male, follows hip curve
      'M 37,49 C 36,50 34,51 34,53 L 34,55 L 36,56 L 64,56 L 66,55 L 66,53 C 66,51 64,50 63,49 Z',
    ],
    legs: [
      // Left leg — follows thigh/calf, slimmer
      'M 37,56 C 36,58 35,61 34,65 L 34,71 L 35,77 L 36,81 L 37,86 L 37,91 L 38,94 L 42,94 L 47,94 L 47,91 L 47,86 L 47,81 L 48,77 L 48,71 L 48,65 C 47,61 46,58 45,56 Z',
      // Right leg
      'M 55,56 C 54,58 53,61 52,65 L 52,71 L 52,77 L 53,81 L 53,86 L 53,91 L 53,94 L 58,94 L 62,94 L 63,91 L 63,86 L 64,81 L 65,77 L 66,71 L 66,65 C 65,61 63,58 62,56 Z',
    ],
  },
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

      {/* Body figure */}
      <div className="relative w-full flex-1 flex items-center justify-center">
        <div className="relative max-w-[220px] w-full">
          <img
            src={bodyImage}
            alt={`${gender} body map`}
            className="relative w-full h-auto object-contain transition-opacity duration-500"
            style={{
              mixBlendMode: 'screen',
              filter: 'drop-shadow(3px 5px 10px hsl(0 0% 0% / 0.7))',
            }}
            draggable={false}
          />

          {/* SVG overlay with contour-tracing hit areas */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: 'none' }}
          >
            <defs>
              {(Object.keys(paths) as BodyZone[]).map((zone) => (
                <filter key={`glow-${zone}`} id={`glow-${zone}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              ))}
            </defs>

            {(Object.entries(paths) as Array<[BodyZone, string[]]>).map(([zone, zonePaths]) =>
              zonePaths.map((d, idx) => {
                const info = BODY_ZONES[zone];
                const isHovered = hoveredZone === zone;
                const isPulsing = pulsingZone === zone;
                const intensity = zoneIntensities[zone];
                const isActive = intensity > 0.1;

                return (
                  <path
                    key={`${zone}-${idx}`}
                    d={d}
                    fill={isHovered ? `${info.color}12` : 'transparent'}
                    stroke={
                      isPulsing || isHovered
                        ? info.color
                        : isActive
                          ? info.color
                          : 'transparent'
                    }
                    strokeWidth={isPulsing ? 1.2 : isHovered ? 0.8 : isActive ? 0.4 : 0}
                    strokeOpacity={isPulsing ? 1 : isHovered ? 0.85 : isActive ? 0.2 + intensity * 0.3 : 0}
                    filter={isPulsing || isHovered ? `url(#glow-${zone})` : undefined}
                    style={{
                      pointerEvents: 'all',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      animation: isPulsing ? 'zonePulse 0.8s ease-out' : undefined,
                    }}
                    onClick={() => handleZoneTap(zone as BodyZone)}
                    onPointerEnter={() => setHoveredZone(zone as BodyZone)}
                    onPointerLeave={() => setHoveredZone(null)}
                  />
                );
              })
            )}
          </svg>

          {/* Hover tooltip */}
          {hoveredZone && (() => {
            const info = BODY_ZONES[hoveredZone];
            const intensity = zoneIntensities[hoveredZone];
            // Parse first path to find approximate top position
            const firstPath = paths[hoveredZone][0];
            const yMatch = firstPath.match(/[\s,](\d+)/);
            const approxTop = yMatch ? parseInt(yMatch[1]) : 50;
            const tooltipTop = approxTop > 12 ? approxTop - 8 : approxTop + 12;

            return (
              <div
                className="absolute z-20 pointer-events-none left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-center"
                style={{
                  top: `${tooltipTop}%`,
                  backgroundColor: 'hsl(var(--card) / 0.95)',
                  border: `1px solid ${info.color}60`,
                  boxShadow: `0 0 16px ${info.color}30, 0 4px 12px hsl(0 0% 0% / 0.4)`,
                }}
              >
                <span className="text-[11px] font-semibold font-mono block" style={{ color: info.color }}>
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
          0% { stroke-width: 1.5; stroke-opacity: 1; }
          50% { stroke-width: 2.5; stroke-opacity: 0.6; }
          100% { stroke-width: 0.8; stroke-opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default GeometricBody;
