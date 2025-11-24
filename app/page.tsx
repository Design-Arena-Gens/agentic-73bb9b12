/* eslint-disable react/no-unknown-property */
"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, StatsGl } from "@react-three/drei";
import dynamic from "next/dynamic";
import { Suspense, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { usePlayerStore } from "../lib/playerStore";

const DesertScene = dynamic(() => import("../components/DesertScene"), {
  ssr: false
});

export default function Page() {
  const { playing, setPlaying, restart, duration } = usePlayerStore();
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);
  const lastRestartRef = useRef<number>(startRef.current);

  useEffect(() => {
    const step = () => {
      const now = performance.now();
      const start = lastRestartRef.current;
      const elapsed = (now - start) / 1000;
      const pct = Math.min(1, (elapsed % duration) / duration);
      setProgress(pct);
      if (playing) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    if (playing) {
      rafRef.current = requestAnimationFrame(step);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, duration]);

  useEffect(() => {
    const unsub = usePlayerStore.subscribe((state, prev) => {
      if (state.restartAt !== prev.restartAt) {
        lastRestartRef.current = state.restartAt || performance.now();
      }
    });
    return unsub;
  }, []);

  return (
    <main className={styles.main}>
      <div className={styles.canvasWrap}>
        <Canvas
          gl={{ antialias: true, alpha: false }}
          shadows
          camera={{ position: [0, 3, 10], fov: 60, near: 0.1, far: 2000 }}
        >
          <color attach="background" args={["#e6d2a3"]} />
          <fog attach="fog" color={"#e6d2a3"} near={10} far={400} />
          <Suspense fallback={null}>
            <DesertScene />
          </Suspense>
          {/* Uncomment for debugging */}
          {/* <StatsGl /> */}
          {/* <OrbitControls makeDefault /> */}
        </Canvas>
      </div>
      <div className={styles.hud}>
        <div className={styles.controls}>
          <button
            className={styles.button}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button className={styles.button} onClick={() => restart()}>
            Replay
          </button>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className={styles.caption}>Desert Convoy Cinematic ? 15s sequence</div>
      </div>
    </main>
  );
}

