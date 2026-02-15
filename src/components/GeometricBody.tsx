import { useState } from 'react';
import { BodyZone, BODY_ZONES } from '@/data/bodyZoneMapping';
import bodyMale from '@/assets/body-male.jpeg';
import bodyFemale from '@/assets/body-female.jpeg';
import { Brain, Heart, Dumbbell, Flame, Activity, Shield, Zap } from 'lucide-react';

interface GeometricBodyProps {
  zoneIntensities: Record<BodyZone, number>;
  onZoneTap?: (zone: BodyZone) => void;
  className?: string;
  gender?: 'male' | 'female';
}

// Badge positions for each zone — positioned near but not on the body region
// Values are percentage of the container width/height
const BADGE_POSITIONS: Record<'male' | 'female', Record<BodyZone, { top: string; left: string }>> = {
  male: {
    brain:    { top: '5%', left: '72%' },
    immune:   { top: '15%', left: '18%' },
    heart:    { top: '28%', left: '75%' },
    arms:     { top: '38%', left: '10%' },
    core:     { top: '42%', left: '75%' },
    hormonal: { top: '52%', left: '18%' },
    legs:     { top: '70%', left: '75%' },
  },
  female: {
    brain:    { top: '5%', left: '72%' },
    immune:   { top: '15%', left: '18%' },
    heart:    { top: '28%', left: '75%' },
    arms:     { top: '38%', left: '10%' },
    core:     { top: '42%', left: '75%' },
    hormonal: { top: '52%', left: '18%' },
    legs:     { top: '70%', left: '75%' },
  },
};

const ZONE_ICONS: Record<BodyZone, typeof Brain> = {
  brain: Brain,
  heart: Heart,
  arms: Dumbbell,
  core: Flame,
  legs: Activity,
  immune: Shield,
  hormonal: Zap,
};

const GeometricBody = ({ zoneIntensities, onZoneTap, className = '', gender = 'male' }: GeometricBodyProps) => {
  const [activeZone, setActiveZone] = useState<BodyZone | null>(null);

  const bodyImage = gender === 'male' ? bodyMale : bodyFemale;
  const positions = BADGE_POSITIONS[gender];

  const handleZoneTap = (zone: BodyZone) => {
    if (activeZone === zone) {
      // Tapping same zone again deactivates it
      setActiveZone(null);
    } else {
      setActiveZone(zone);
      onZoneTap?.(zone);
    }
  };

  const activeZones = (Object.entries(zoneIntensities) as Array<[BodyZone, number]>)
    .filter(([, v]) => v > 0.1)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className={`w-full h-full flex flex-col items-center ${className}`}>
      {/* Body figure with badge icons */}
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

          {/* Badge icons positioned near body regions */}
          {activeZones.map(([zone, intensity]) => {
            const pos = positions[zone];
            const info = BODY_ZONES[zone];
            const Icon = ZONE_ICONS[zone];
            const isActive = activeZone === zone;

            return (
              <button
                key={zone}
                onClick={() => handleZoneTap(zone)}
                className={`absolute z-10 flex items-center gap-1 px-1.5 py-1 rounded-full border transition-all duration-300 active:scale-95 ${
                  isActive
                    ? 'bg-card/95 border-primary/60 shadow-lg scale-110'
                    : 'bg-card/80 border-border/40 hover:border-primary/40'
                }`}
                style={{
                  top: pos.top,
                  left: pos.left,
                  boxShadow: isActive ? `0 0 12px ${info.color}40` : `0 0 ${4 + intensity * 6}px ${info.color}20`,
                }}
              >
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${info.color}25` }}
                >
                  <Icon className="w-2.5 h-2.5" style={{ color: info.color }} />
                </div>
                <span className="text-[8px] font-mono font-semibold" style={{ color: info.color }}>
                  {Math.round(intensity * 100)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GeometricBody;
