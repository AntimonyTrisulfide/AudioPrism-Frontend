import { useCallback, useEffect, useRef, useState } from "react";

interface AudioSpectrumProps {
  src: string;
  height?: number;
  disabled?: boolean;
}

/**
 * Simple frequency spectrum visualizer using Web Audio API + canvas.
 * - Renders a <canvas> bar spectrum that reacts to the audio.
 * - Shows an <audio> element with controls under it.
 */
export function AudioSpectrum({ src, height = 80, disabled = false }: AudioSpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef(0);
  const seekingRef = useRef(false);

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (disabled) return;

    const audioEl = audioRef.current;
    const canvas = canvasRef.current;
    if (!audioEl || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const source = audioCtx.createMediaElementSource(audioEl);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    let animationFrameId: number;

    const render = () => {
      animationFrameId = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      const { width } = canvas;
      const h = canvas.height;
      ctx.clearRect(0, 0, width, h);

      const barWidth = (width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const value = dataArray[i];
        const barHeight = (value / 255) * h;
        // gradient-ish purple/indigo
        const alpha = 0.6 + (value / 255) * 0.4;
        ctx.fillStyle = `rgba(129, 140, 248, ${alpha})`; // indigo-400 ish
        ctx.fillRect(x, h - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }

      const px = progressRef.current * width;
      ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
      ctx.fillRect(px, 0, 2, h);
    };

    const handlePlay = () => {
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
      render();
    };

    const handlePause = () => {
      cancelAnimationFrame(animationFrameId);
    };

    audioEl.addEventListener("play", handlePlay);
    audioEl.addEventListener("pause", handlePause);
    audioEl.addEventListener("ended", handlePause);

    // clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      audioEl.removeEventListener("play", handlePlay);
      audioEl.removeEventListener("pause", handlePause);
      audioEl.removeEventListener("ended", handlePause);
      try {
        source.disconnect();
        analyser.disconnect();
        audioCtx.close();
      } catch {
        // ignore
      }
    };
  }, [disabled, src]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    const handleTime = () => {
      if (!audioEl.duration || Number.isNaN(audioEl.duration)) return;
      const ratio = Math.min(Math.max(audioEl.currentTime / audioEl.duration, 0), 1);
      progressRef.current = ratio;
      setProgress(ratio);
    };

    audioEl.addEventListener("timeupdate", handleTime);
    audioEl.addEventListener("loadedmetadata", handleTime);
    audioEl.addEventListener("ended", handleTime);

    return () => {
      audioEl.removeEventListener("timeupdate", handleTime);
      audioEl.removeEventListener("loadedmetadata", handleTime);
      audioEl.removeEventListener("ended", handleTime);
    };
  }, [src]);

  const seekToPointer = useCallback((clientX: number) => {
    const audioEl = audioRef.current;
    const canvas = canvasRef.current;
    if (!audioEl || !canvas || !audioEl.duration || Number.isNaN(audioEl.duration)) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    audioEl.currentTime = ratio * audioEl.duration;
    progressRef.current = ratio;
    setProgress(ratio);
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    seekingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekToPointer(event.clientX);
  }, [disabled, seekToPointer]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!seekingRef.current || disabled) return;
    seekToPointer(event.clientX);
  }, [disabled, seekToPointer]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    seekingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* noop */
    }
  }, [disabled]);

  const canvasClassName = disabled
    ? "h-20 w-full rounded-sm bg-black/60 cursor-not-allowed opacity-70"
    : "h-20 w-full rounded-sm bg-black/60 cursor-pointer";

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-white/10 bg-black/60 p-2">
        <canvas
          ref={canvasRef}
          height={height}
          className={canvasClassName}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        <div className="mt-1 text-right text-[10px] text-slate-400">{Math.round(progress * 100)}%</div>
      </div>
      <audio ref={audioRef} src={src} controls className="w-full" crossOrigin="anonymous" />
    </div>
  );
}
