// WE ARE MAKING JOYSTICH BEHAVIOR HERE FOR TOUCH SCREEN DEVICES!

import React, { useRef, useImperativeHandle } from "react";
import "./Joystick.css";

const Joystick = React.forwardRef(({ onMove, onEnd }, ref) => {
  const baseRef = useRef();
  const thumbRef = useRef();

  useImperativeHandle(ref, () => ({
    base: baseRef.current,
    thumb: thumbRef.current,
  }));

  const handleMove = (e) => {
    if (!baseRef.current || !thumbRef.current) return;

    const rect = baseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.touches[0].clientX - centerX;
    const dy = e.touches[0].clientY - centerY;
    const maxDist = rect.width / 2;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist);
    const angle = Math.atan2(dy, dx);
    const x = (dist / maxDist) * Math.cos(angle);
    const y = (dist / maxDist) * Math.sin(angle);

    onMove({ x, y });
    thumbRef.current.style.transform = `translate(${x * maxDist}px, ${y * maxDist}px)`;
  };

  const handleEnd = () => {
    if (!thumbRef.current) return;
    onEnd();
    thumbRef.current.style.transform = `translate(0px, 0px)`;
  };

  return (
    <div
      className="joystick-base"
      ref={baseRef}
      onTouchStart={handleMove}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    >
      <div className="joystick-thumb" ref={thumbRef}></div>
    </div>
  );
});

export default Joystick;
