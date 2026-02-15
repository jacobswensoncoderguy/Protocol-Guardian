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

// Percentage-based hit areas over the image (top, left, width, height)
const ZONE_REGIONS: Record<Gender, Record<BodyZone, { top: number; left: number; width: number; height: number }>> = {
  male: {
    brain:    { top: 1,  left: 28, width: 44, height: 13 },
    immune:   { top: 14, left: 32, width: 36, height: 5 },
    heart:    { top: 19, left: 24, width: 52, height: 12 },
    arms:     { top: 19, left: 5,  width: 20, height: 20 },
    core:     { top: 31, left: 26, width: 48, height: 14 },
    hormonal: { top: 45, left: 28, width: 44, height: 8 },
    legs:     { top: 53, left: 18, width: 64, height: 40 },
  },
  female: {
    brain:    { top: 2,  left: 30, width: 40, height: 14 },
    immune:   { top: 16, left: 34, width: 32, height: 4 },
    heart:    { top: 20, left: 26, width: 48, height: 11 },
    arms:     { top: 20, left: 8,  width: 20, height: 16 },
    core:     { top: 31, left: 28, width: 44, height: 12 },
    hormonal: { top: 43, left: 30, width: 40, height: 7 },
    legs:     { top: 50, left: 20, width: 60, height: 42 },
  },
};

// Right-side arm zones
const ZONE_REGIONS_RIGHT_ARM: Record<Gender, { top: number; left: number; width: number; height: number }> = {
  male:   { top: 19, left: 75, width: 20, height: 20 },
  female: { top: 20, left: 72, width: 20, height: 16 },
};

// Right-side leg zones
const ZONE_REGIONS_RIGHT_LEG: Record<Gender, { top: number; left: number; width: number; height: number }> = {
  male:   { top: 53, left: 50, width: 32, height: 40 },
  female: { top: 50, left: 48, width: 32, height: 42 },
};

const GeometricBody = ({ zoneIntensities, onZoneTap, className = '' }: GeometricBodyProps) => {
  const [hoveredZone, setHoveredZone] = useState<BodyZone | null>(null);
  const [gender, setGender] = useState<Gender>('male');
  const [pulsingZone, setPulsingZone] = useState<BodyZone | null>(null);

  const bodyImage = gender === 'male' ? bodyMale : bodyFemale;
  const regions = ZONE_REGIONS[gender];

  const handleZoneTap = (zone: BodyZone) => {
    setPulsingZone(zone);
    setTimeout(() => setPulsingZone(null), 800);
    onZoneTap?.(zone);
  };

  const renderHitArea = (zone: BodyZone, region: { top: number; left: number; width: number; height: number }, key?: string) => {
    const info = BODY_ZONES[zone];
    const isHovered = hoveredZone === zone;
    const isPulsing = pulsingZone === zone;

    return (
      <div
        key={key || zone}
        className="absolute cursor-pointer"
        style={{
          top: `${region.top}%`,
          left: `${region.left}%`,
          width: `${region.width}%`,
          height: `${region.height}%`,
          // Invisible by default — only shows glow on hover/pulse
          borderRadius: '12px',
          border: (isHovered || isPulsing) ? `1.5px solid ${info.color}` : '1.5px solid transparent',
          boxShadow: isPulsing
            ? `0 0 20px ${info.color}80, 0 0 40px ${info.color}40, inset 0 0 15px ${info.color}30`
            : isHovered
              ? `0 0 16px ${info.color}50, inset 0 0 10px ${info.color}20`
              : 'none',
          backgroundColor: isHovered ? `${info.color}10` : 'transparent',
          transition: 'all 0.3s ease',
          animation: isPulsing ? 'zonePulseGlow 0.8s ease-out' : undefined,
        }}
        onClick={() => handleZoneTap(zone)}
        onPointerEnter={() => setHoveredZone(zone)}
        onPointerLeave={() => setHoveredZone(null)}
      />
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

      {/* Body figure floating on dark bg */}
      <div className="relative w-full flex-1 flex items-center justify-center">
        <div className="relative max-w-[220px] w-full">
          {/* The cartoon figure — screen blend makes black bg transparent */}
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

          {/* Invisible hit areas for each zone */}
          {(Object.entries(regions) as Array<[BodyZone, typeof regions.brain]>).map(([zone, region]) => (
            <>
              {renderHitArea(zone, region)}
              {zone === 'arms' && renderHitArea(zone, ZONE_REGIONS_RIGHT_ARM[gender], 'arms-right')}
            </>
          ))}

          {/* Hover tooltip */}
          {hoveredZone && (() => {
            const info = BODY_ZONES[hoveredZone];
            const intensity = zoneIntensities[hoveredZone];
            const region = regions[hoveredZone];
            const tooltipTop = region.top > 12 ? region.top - 6 : region.top + region.height + 1;

            return (
              <div
                className="absolute z-20 pointer-events-none px-3 py-1.5 rounded-lg text-center"
                style={{
                  top: `${tooltipTop}%`,
                  left: '50%',
                  transform: 'translateX(-50%)',
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
        @keyframes zonePulseGlow {
          0% { box-shadow: 0 0 30px currentColor, inset 0 0 20px currentColor; opacity: 1; }
          100% { box-shadow: 0 0 0px transparent; opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default GeometricBody;
