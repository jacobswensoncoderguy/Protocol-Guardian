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

// SVG polygon points (percentage-based, 0-100 coordinate space)
const ZONE_PATHS: Record<Gender, Record<BodyZone, string[]>> = {
  male: {
    brain: [
      'M 39,1 C 33,2 30,6 30,10 30,14 33,17 38,17 L 62,17 C 67,17 70,14 70,10 70,6 67,2 61,1 Z',
    ],
    immune: [
      'M 38,17 C 36,18 35,19 36,21 L 64,21 C 65,19 64,18 62,17 Z',
    ],
    heart: [
      'M 30,21 C 28,22 26,24 26,27 26,30 28,33 30,34 L 70,34 C 72,33 74,30 74,27 74,24 72,22 70,21 Z',
    ],
    arms: [
      // Left arm
      'M 8,22 C 6,24 5,28 6,32 7,36 9,40 12,42 L 24,42 C 26,38 26,34 25,30 24,26 22,23 20,21 Z',
      // Right arm
      'M 92,22 C 94,24 95,28 94,32 93,36 91,40 88,42 L 76,42 C 74,38 74,34 75,30 76,26 78,23 80,21 Z',
    ],
    core: [
      'M 30,34 C 29,36 28,40 28,44 28,47 29,48 30,48 L 70,48 C 71,48 72,47 72,44 72,40 71,36 70,34 Z',
    ],
    hormonal: [
      'M 30,48 C 29,50 28,52 29,55 L 71,55 C 72,52 71,50 70,48 Z',
    ],
    legs: [
      // Left leg
      'M 29,55 C 27,60 25,68 24,76 23,84 22,90 22,96 L 42,96 C 42,90 43,84 44,76 44,68 43,60 42,55 Z',
      // Right leg
      'M 71,55 C 73,60 75,68 76,76 77,84 78,90 78,96 L 58,96 C 58,90 57,84 56,76 56,68 57,60 58,55 Z',
    ],
  },
  female: {
    brain: [
      'M 40,2 C 35,3 32,7 32,11 32,15 35,18 40,18 L 60,18 C 65,18 68,15 68,11 68,7 65,3 60,2 Z',
    ],
    immune: [
      'M 40,18 C 38,19 37,20 38,22 L 62,22 C 63,20 62,19 60,18 Z',
    ],
    heart: [
      'M 30,22 C 28,23 26,26 26,29 26,32 28,34 30,35 L 70,35 C 72,34 74,32 74,29 74,26 72,23 70,22 Z',
    ],
    arms: [
      // Left arm
      'M 12,23 C 10,25 8,29 9,33 10,37 12,40 14,42 L 26,40 C 27,36 27,32 26,28 25,25 23,23 22,22 Z',
      // Right arm
      'M 88,23 C 90,25 92,29 91,33 90,37 88,40 86,42 L 74,40 C 73,36 73,32 74,28 75,25 77,23 78,22 Z',
    ],
    core: [
      'M 32,35 C 31,37 30,41 30,45 30,47 31,48 32,48 L 68,48 C 69,48 70,47 70,45 70,41 69,37 68,35 Z',
    ],
    hormonal: [
      'M 32,48 C 31,50 30,52 31,55 L 69,55 C 70,52 69,50 68,48 Z',
    ],
    legs: [
      // Left leg
      'M 31,55 C 29,60 27,68 26,76 25,84 25,90 25,96 L 43,96 C 43,90 44,84 44,76 44,68 43,60 42,55 Z',
      // Right leg
      'M 69,55 C 71,60 73,68 74,76 75,84 75,90 75,96 L 57,96 C 57,90 56,84 56,76 56,68 57,60 58,55 Z',
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
