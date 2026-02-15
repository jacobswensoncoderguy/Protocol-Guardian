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

// Zone hit areas as percentage-based regions over the photo
// Each zone: { top, left, width, height } in percentages
const ZONE_REGIONS: Record<Gender, Record<BodyZone, { top: number; left: number; width: number; height: number }>> = {
  male: {
    brain:    { top: 0,  left: 25, width: 50, height: 12 },
    immune:   { top: 12, left: 30, width: 40, height: 6 },
    heart:    { top: 18, left: 20, width: 60, height: 14 },
    arms:     { top: 18, left: 5,  width: 18, height: 22 },
    core:     { top: 32, left: 22, width: 56, height: 16 },
    hormonal: { top: 48, left: 25, width: 50, height: 10 },
    legs:     { top: 58, left: 15, width: 70, height: 42 },
  },
  female: {
    brain:    { top: 0,  left: 28, width: 44, height: 14 },
    immune:   { top: 14, left: 32, width: 36, height: 5 },
    heart:    { top: 19, left: 22, width: 56, height: 13 },
    arms:     { top: 19, left: 5,  width: 20, height: 18 },
    core:     { top: 32, left: 25, width: 50, height: 14 },
    hormonal: { top: 46, left: 28, width: 44, height: 8 },
    legs:     { top: 54, left: 18, width: 64, height: 46 },
  },
};

const GeometricBody = ({ zoneIntensities, onZoneTap, className = '' }: GeometricBodyProps) => {
  const [hoveredZone, setHoveredZone] = useState<BodyZone | null>(null);
  const [gender, setGender] = useState<Gender>('male');

  const regions = ZONE_REGIONS[gender];
  const bodyImage = gender === 'male' ? bodyMale : bodyFemale;

  return (
    <div className={`w-full h-full flex flex-col items-center ${className}`}>
      {/* Gender toggle */}
      <div className="flex items-center gap-1 mb-3">
        <button
          onClick={() => setGender('male')}
          className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all duration-300 ${
            gender === 'male'
              ? 'bg-primary/20 text-primary border border-primary/40 shadow-[0_0_8px_hsl(190,100%,50%,0.2)]'
              : 'bg-secondary/30 text-muted-foreground border border-border/20 hover:border-border/40'
          }`}
        >
          Male
        </button>
        <button
          onClick={() => setGender('female')}
          className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-all duration-300 ${
            gender === 'female'
              ? 'bg-primary/20 text-primary border border-primary/40 shadow-[0_0_8px_hsl(190,100%,50%,0.2)]'
              : 'bg-secondary/30 text-muted-foreground border border-border/20 hover:border-border/40'
          }`}
        >
          Female
        </button>
      </div>

      {/* Photo with zone overlays */}
      <div className="relative w-full flex-1 flex items-center justify-center">
        <div className="relative max-w-[240px] w-full">
          {/* Photo */}
          <img
            src={bodyImage}
            alt={`${gender} body map`}
            className="w-full h-auto rounded-xl object-cover transition-opacity duration-500"
            style={{
              filter: 'brightness(1) contrast(1.05)',
            }}
            draggable={false}
          />

          {/* Interactive zone overlays */}
          {(Object.entries(regions) as Array<[BodyZone, typeof regions.brain]>).map(([zone, region]) => {
            const intensity = zoneIntensities[zone];
            const info = BODY_ZONES[zone];
            const isHovered = hoveredZone === zone;
            const isActive = intensity > 0.1;

            const fillOpacity = isHovered
              ? 0.35
              : isActive
                ? 0.08 + intensity * 0.15
                : 0.02;

            const borderOpacity = isHovered ? 0.7 : isActive ? 0.15 + intensity * 0.35 : 0.05;

            return (
              <div
                key={zone}
                className="absolute cursor-pointer transition-all duration-300"
                style={{
                  top: `${region.top}%`,
                  left: `${region.left}%`,
                  width: `${region.width}%`,
                  height: `${region.height}%`,
                  backgroundColor: info.color,
                  opacity: fillOpacity,
                  borderRadius: '8px',
                  border: `1.5px solid ${info.color}`,
                  boxShadow: isHovered || intensity > 0.5
                    ? `0 0 20px ${info.color}40, inset 0 0 15px ${info.color}20`
                    : 'none',
                }}
                onClick={() => onZoneTap?.(zone)}
                onPointerEnter={() => setHoveredZone(zone)}
                onPointerLeave={() => setHoveredZone(null)}
              />
            );
          })}

          {/* Hover tooltip */}
          {hoveredZone && (() => {
            const region = regions[hoveredZone];
            const info = BODY_ZONES[hoveredZone];
            const intensity = zoneIntensities[hoveredZone];
            const tooltipTop = region.top > 15 ? region.top - 5 : region.top + region.height + 1;

            return (
              <div
                className="absolute z-20 pointer-events-none px-2.5 py-1 rounded-md text-center"
                style={{
                  top: `${tooltipTop}%`,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'hsl(220, 30%, 8% / 0.95)',
                  border: `1px solid ${info.color}60`,
                  boxShadow: `0 0 12px ${info.color}30`,
                }}
              >
                <span
                  className="text-[10px] font-semibold font-mono"
                  style={{ color: info.color }}
                >
                  {info.label} {Math.round(intensity * 100)}%
                </span>
              </div>
            );
          })()}

          {/* Scanning line effect */}
          <div
            className="absolute left-0 right-0 h-[1px] pointer-events-none rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, hsl(200, 80%, 60% / 0.15), transparent)',
              animation: 'scanLine 8s linear infinite',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes scanLine {
          0% { top: 0%; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
};

export default GeometricBody;
