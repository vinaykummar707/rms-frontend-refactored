import React, { useState, useEffect, useRef, useMemo } from "react";

type MarqueeDirection = "none" | "ltr" | "rtl";
type Alignment = "start" | "center" | "end";

interface LEDMatrixProps {
  rows: number;
  columns: number;
  pattern?: string[];
  dotSize?: number;
  dotSpacing?: number;
  onColor?: string;
  offColor?: string;
  marqueeDirection?: MarqueeDirection;
  scrollSpeed?: number;
  alignment?: Alignment;
  paused?: boolean;
}

const LEDMatrix: React.FC<LEDMatrixProps> = ({
  rows,
  columns,
  pattern,
  dotSize = 4,
  dotSpacing = 4,
  onColor = "#ffbf00",
  offColor = "#000",
  marqueeDirection = "rtl",
  scrollSpeed = 10,
  alignment = "start",
  paused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [interactiveMatrix, setInteractiveMatrix] = useState<boolean[][] | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentScrollPositionRef = useRef(0); // Renamed for clarity

  // Derive matrix synchronously on render to prevent blank/lagging frame flashes
  const baseMatrix = useMemo(() => {
    if (pattern && pattern.length > 0) {
      return pattern.map((row) =>
        row.split("").map((char) => char === "#")
      );
    }
    return Array(rows)
      .fill(0)
      .map(() => Array(columns).fill(false));
  }, [rows, columns, pattern]);

  // Reset user manual clicks when pattern or dimensions change
  useEffect(() => {
    setInteractiveMatrix(null);
  }, [baseMatrix]);

  const matrix = interactiveMatrix || baseMatrix;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const totalDotSize = dotSize + dotSpacing;
    const canvasWidth = columns * totalDotSize;
    const canvasHeight = rows * totalDotSize;

    if (canvas.width !== canvasWidth) {
      canvas.width = canvasWidth;
    }
    if (canvas.height !== canvasHeight) {
      canvas.height = canvasHeight;
    }

    // Calculate the actual width of the pattern in pixels
    const patternPixelWidth = (matrix[0]?.length || 0) * totalDotSize;

    const drawMatrix = (offsetX: number = 0) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
      ctx.fillStyle = "#000000"; // Set background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const patternHeight = matrix.length;
      let staticStartX = 0; // Renamed to clearly differentiate from scrolling offset

      // Calculate vertical centering offset
      const startY = Math.max(0, Math.floor((rows - patternHeight) / 2) * totalDotSize);

      // When no marquee, apply alignment for patterns smaller than canvas
      if (marqueeDirection === "none" && patternPixelWidth < canvasWidth) {
        
        switch (alignment) {
          case "center":
            staticStartX = Math.floor((canvasWidth - patternPixelWidth) / 2);
            break;
          case "end":
            staticStartX = canvasWidth - patternPixelWidth;
            break;
          default: // 'start'
            staticStartX = 0;
        }
      }

      // Draw the pattern. For marquee, we need to draw it twice to create the seamless loop
      // The drawing range for the loop should span the pattern width plus the canvas width.
      // This ensures the pattern completely exits one side and enters the other.
      const scrollRange = patternPixelWidth + canvasWidth;

      // Determine how many times to draw the pattern to cover the visible area
      // and ensure seamless scrolling.
      // We need to draw at least one full pattern for the current view and
      // one for the "next" pattern in the scroll.
      // Adjusting the draw start based on direction
      


      // Iterate over the pattern and draw its dots
      matrix.forEach((row, rowIndex) => {
        row.forEach((isOn, colIndex) => {
          // Calculate the base x position of the dot within the pattern
          const baseDotX = colIndex * totalDotSize;

          // For marquee, calculate the actual x position including the scroll offset
          let xWithOffset = baseDotX + offsetX;

          // For RTL, we need to ensure the pattern that's wrapping around
          // correctly appears on the right side of the canvas.
          if (marqueeDirection === "rtl") {
              // The effective start of the pattern considering the current scroll position
              // and wrapping around the full scroll range (pattern + canvas width)
              let effectiveX = (xWithOffset % scrollRange + scrollRange) % scrollRange;

              // If the effective X is within the canvas but the pattern itself is not
              // fully "in" the canvas, we need to draw its wrapped counterpart.
              if (effectiveX >= canvasWidth) {
                  effectiveX -= scrollRange;
              }
              xWithOffset = effectiveX;

          } else if (marqueeDirection === "ltr") {
              // For LTR, the pattern scrolls from left to right.
              // When it reaches the end, it should reappear from the left.
              let effectiveX = (xWithOffset % scrollRange + scrollRange) % scrollRange;
              if (effectiveX < -patternPixelWidth) {
                  effectiveX += scrollRange;
              }
              xWithOffset = effectiveX;
          }


          const y = rowIndex * totalDotSize + dotSize / 2 + startY;

          // [UX-04]: Matrix boundary clamping - skip drawing dots outside vertical matrix height
          if (y - dotSize / 2 < 0 || y + dotSize / 2 > canvas.height) {
            return;
          }

          // Only draw if the dot is within the visible canvas area
          // or is part of the wrapping pattern that will soon be visible.
          if (marqueeDirection === "none") {
            currentScrollPositionRef.current = 0;
            // Static position drawing
            if (
              xWithOffset + staticStartX + dotSize / 2 > -dotSize &&
              xWithOffset + staticStartX + dotSize / 2 < canvas.width + dotSize
            ) {
              ctx.beginPath();
              ctx.arc(
                xWithOffset + staticStartX + dotSize / 2,
                y,
                dotSize / 2,
                0,
                Math.PI * 2
              );
              ctx.fillStyle = isOn ? onColor : offColor;
              ctx.fill();
            }
          } else {
            // Marquee drawing: Draw the current position and the wrapped position
            // This ensures seamless continuity.
            // We draw the dot at its current position
            if (
              xWithOffset + dotSize / 2 > -dotSize &&
              xWithOffset + dotSize / 2 < canvas.width + dotSize
            ) {
              ctx.beginPath();
              ctx.arc(
                xWithOffset + dotSize / 2,
                y,
                dotSize / 2,
                0,
                Math.PI * 2
              );
              ctx.fillStyle = isOn ? onColor : offColor;
              ctx.fill();
            }

            // Draw the "wrapped" version of the dot for continuous scrolling
            let wrappedDotX = xWithOffset;
            if (marqueeDirection === "rtl") {
                wrappedDotX = xWithOffset + patternPixelWidth + canvasWidth;
            } else if (marqueeDirection === "ltr") {
                wrappedDotX = xWithOffset - (patternPixelWidth + canvasWidth);
            }

            if (
                wrappedDotX + dotSize / 2 > -dotSize &&
                wrappedDotX + dotSize / 2 < canvas.width + dotSize
            ) {
                ctx.beginPath();
                ctx.arc(
                    wrappedDotX + dotSize / 2,
                    y,
                    dotSize / 2,
                    0,
                    Math.PI * 2
                );
                ctx.fillStyle = isOn ? onColor : offColor;
                ctx.fill();
            }
          }
        });
      });
    };

    // Time-based so the speed is identical on 60Hz/120Hz screens; 1 = fastest, 10 = slowest.
    const clampedSpeed = Math.min(Math.max(scrollSpeed || 4, 1), 10);
    const pixelsPerSecond = (4 * (11 - clampedSpeed) + 4) * totalDotSize;
    let lastTime: number | null = null;

    const animate = (now?: number) => {
      if (!paused && marqueeDirection !== "none") {
        const timestamp = now ?? performance.now();
        // Cap the step so returning to a background tab doesn't jump the text.
        const elapsed = lastTime === null ? 0 : Math.min(timestamp - lastTime, 50);
        lastTime = timestamp;
        const step = (pixelsPerSecond * elapsed) / 1000;
        const scrollLoopLength = patternPixelWidth + canvasWidth; // Total distance for one full loop

        if (marqueeDirection === "ltr") {
          currentScrollPositionRef.current += step;
          if (currentScrollPositionRef.current >= scrollLoopLength) {
            currentScrollPositionRef.current -= scrollLoopLength;
          }
        } else {
          // RTL
          currentScrollPositionRef.current -= step;
          if (currentScrollPositionRef.current <= -scrollLoopLength) {
            currentScrollPositionRef.current += scrollLoopLength;
          }
        }
        drawMatrix(currentScrollPositionRef.current);
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        drawMatrix(currentScrollPositionRef.current); // Draw static position once without scheduling rAF
      }
    };

    // Initialize scroll position when marquee direction changes or on mount
    // currentScrollPositionRef.current = 0;
    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    matrix,
    dotSize,
    dotSpacing,
    onColor,
    offColor,
    marqueeDirection,
    scrollSpeed,
    alignment,
    columns,
    rows,
    paused,
  ]);

  // Handle click to toggle LED state
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const totalDotSize = dotSize + dotSpacing;
    const col = Math.floor(x / totalDotSize);
    const row = Math.floor(y / totalDotSize);

    if (row >= 0 && row < rows && col >= 0 && col < columns) {
      const newMatrix = matrix.map((r, i) =>
        i === row ? r.map((cell, j) => (j === col ? !cell : cell)) : r
      );
      setInteractiveMatrix(newMatrix);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      style={{
        backgroundColor: "#141414",
      }}
    />
  );
};

export default LEDMatrix;