"use client";

import React, { useRef, useState, useEffect } from "react";

export function TiltImage({ src, alt, speed = 0.1 }: { src: string; alt: string; speed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    // Calculate rotation based on mouse position (max 15 degrees)
    const rotateX = -(y / rect.height) * 30;
    const rotateY = (x / rect.width) * 30;
    
    setRotation({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setRotation({ x: 0, y: 0 });
  };

  const parallaxY = scrollY * speed;

  return (
    <div 
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: "1000px",
        display: "inline-block",
        transform: `translateY(${parallaxY}px)`,
        transition: "transform 0.1s ease-out"
      }}
    >
      <div
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transition: "transform 0.1s ease-out",
          transformStyle: "preserve-3d",
          filter: "drop-shadow(0 30px 40px rgba(13, 40, 24, 0.25))",
        }}
      >
        <img 
          src={src} 
          alt={alt} 
          style={{
            display: "block",
            width: "100%",
            maxWidth: "400px",
            height: "auto",
            transform: "translateZ(30px)",
          }} 
        />
      </div>
    </div>
  );
}
