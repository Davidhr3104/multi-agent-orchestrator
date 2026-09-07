"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  speedY: number;
  speedX: number;
  isLavender: boolean;
};

export function CosmicParticles() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let raf = 0;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const COUNT = 75;

    function resize() {
      width = canvas!.width = window.innerWidth;
      height = canvas!.height = window.innerHeight;
    }

    function reset(p: Particle, init = false) {
      p.x = Math.random() * width;
      p.y = init ? Math.random() * height : height + Math.random() * 20;
      p.size = Math.random() * 1.5 + 0.9;
      p.baseAlpha = Math.random() * 0.45 + 0.15;
      p.alpha = p.baseAlpha;
      p.twinkleSpeed = Math.random() * 0.02 + 0.008;
      p.twinklePhase = Math.random() * Math.PI * 2;
      p.speedY = Math.random() * 0.28 + 0.12;
      p.speedX = (Math.random() - 0.5) * 0.08;
      p.isLavender = Math.random() > 0.6;
    }

    function init() {
      resize();
      particles = Array.from({ length: COUNT }, () => {
        const p = {} as Particle;
        reset(p, true);
        return p;
      });
    }

    function tick() {
      ctx!.clearRect(0, 0, width, height);
      for (const p of particles) {
        if (!prefersReduced) {
          p.y -= p.speedY;
          p.x += p.speedX;
          p.twinklePhase += p.twinkleSpeed;
          p.alpha = Math.max(0.05, p.baseAlpha + Math.sin(p.twinklePhase) * 0.18);
          if (p.y < -10) reset(p, false);
          if (p.x < -10) p.x = width + 5;
          if (p.x > width + 10) p.x = -5;
        }
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        if (p.isLavender) {
          ctx!.fillStyle = `rgba(216, 180, 254, ${p.alpha})`;
          ctx!.shadowColor = "rgba(192, 132, 252, 0.4)";
          ctx!.shadowBlur = p.size * 3;
        } else {
          ctx!.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
          ctx!.shadowColor = "rgba(255, 255, 255, 0.5)";
          ctx!.shadowBlur = p.size * 2.5;
        }
        ctx!.fill();
        ctx!.shadowBlur = 0;
      }
      raf = requestAnimationFrame(tick);
    }

    init();
    tick();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      id="cosmic-particles"
      className="pointer-events-none fixed inset-0 z-0 hidden dark:block"
      aria-hidden
    />
  );
}
