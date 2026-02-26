import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

interface Leaf {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  rotation: number;
  opacity: number;
}

type BackgroundIntensity = 'off' | 'low' | 'medium' | 'high';

const AnimatedBackground: React.FC = () => {
  const [intensity, setIntensity] = useState<BackgroundIntensity>(() => {
    const saved = localStorage.getItem('bg-intensity');
    return (saved as BackgroundIntensity) || 'medium';
  });

  useEffect(() => {
    localStorage.setItem('bg-intensity', intensity);
  }, [intensity]);

  const intensityConfig = {
    off: { particles: 0, leaves: 0, orbs: false },
    low: { particles: 8, leaves: 12, orbs: true },
    medium: { particles: 18, leaves: 22, orbs: true },
    high: { particles: 30, leaves: 35, orbs: true },
  };

  const config = intensityConfig[intensity];

  // Generate floating particles with variety of colors
  const particles = useMemo(() => {
    const colors = [
      'bg-primary/30',
      'bg-accent/30',
      'bg-secondary/30',
      'bg-primary-glow/20',
      'bg-accent-glow/20',
    ];
    
    return Array.from({ length: config.particles }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 150 + 50,
      duration: Math.random() * 15 + 15,
      delay: Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }, [config.particles]);

  // Generate floating leaves with natural motion
  const leaves = useMemo(() => {
    return Array.from({ length: config.leaves }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 - Math.random() * 20,
      size: Math.random() * 30 + 15,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 10,
      rotation: Math.random() * 360,
      opacity: Math.random() * 0.3 + 0.15,
    }));
  }, [config.leaves]);

  const cycleIntensity = () => {
    const levels: BackgroundIntensity[] = ['off', 'low', 'medium', 'high'];
    const currentIndex = levels.indexOf(intensity);
    const nextIndex = (currentIndex + 1) % levels.length;
    setIntensity(levels[nextIndex]);
  };

  return (
    <>
      <div className="fixed inset-0 -z-10 overflow-hidden gradient-hero pointer-events-none">
        {/* Large animated gradient orbs with blur for glassmorphism effect */}
        {config.orbs && (
          <>
            <div className="absolute top-20 left-10 w-[500px] h-[500px] bg-gradient-to-br from-primary/20 to-accent/10 rounded-full blur-[100px] animate-float" />
            <div className="absolute bottom-20 right-10 w-[600px] h-[600px] bg-gradient-to-tl from-accent/15 to-primary/10 rounded-full blur-[120px] animate-float" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-r from-secondary/10 to-primary/5 rounded-full blur-[150px] animate-float" style={{ animationDelay: '2s' }} />
          </>
        )}
        
        {/* Mesh gradient overlay for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(142,76,36,0.03),transparent_50%)] animate-shimmer" />
      
      {/* Floating glowing particles */}
      <div className="absolute inset-0">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className={`absolute ${particle.color} rounded-full opacity-30 backdrop-blur-sm animate-float`}
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animationDuration: `${particle.duration}s`,
              animationDelay: `${particle.delay}s`,
              boxShadow: '0 0 20px currentColor',
            }}
          />
        ))}
      </div>

      {/* Floating leaves with natural motion */}
      <div className="absolute inset-0 pointer-events-none">
        {leaves.map((leaf) => (
          <div
            key={`leaf-${leaf.id}`}
            className="absolute animate-leaf-fall"
            style={{
              left: `${leaf.x}%`,
              top: `${leaf.y}%`,
              animationDuration: `${leaf.duration}s`,
              animationDelay: `${leaf.delay}s`,
              opacity: leaf.opacity,
            }}
          >
            <svg
              width={leaf.size}
              height={leaf.size}
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-primary/40 dark:text-primary/30"
              style={{
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                transform: `rotate(${leaf.rotation}deg)`,
              }}
            >
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66 1.89-6.87c1.7-6.17 5.3-6.84 9.04-6.84 2.86 0 5.76.86 7.36 2.56V8c-2-1-4-1-7-1zm3.47 8.14c-.75-.75-1.47-1.14-2.47-1.14-2.5 0-3 2-3 4 0 2 .5 4 3 4 1 0 1.72-.39 2.47-1.14V17c0-1 0-2 .75-2.75-.75-.75-.75-1.75-.75-2.75z"/>
            </svg>
          </div>
        ))}
      </div>

        {/* Subtle plant shadows */}
        {config.orbs && (
          <>
            <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-foreground/5 to-transparent opacity-30 pointer-events-none" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/5 to-transparent opacity-20 pointer-events-none" />
          </>
        )}
      </div>

    </>
  );
};

export default AnimatedBackground;
