import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { Mascot as WobnimoMascot } from 'wobnimo';
import songbot from './songbot';
import styles from './AssistantMascot.module.css';

export type MascotState = 'idle' | 'listening' | 'thinking' | 'searching' | 'working' | 'speaking' | 'happy' | 'error' | 'sleeping';

const spriteState: Record<MascotState, string> = {
  idle: 'Idle', listening: 'Listening', thinking: 'Thinking', searching: 'Working',
  working: 'Working', speaking: 'Speaking', happy: 'Celebrating', error: 'Error', sleeping: 'Sleeping'
};

const liveState: Record<MascotState, 'idle' | 'listening' | 'thinking' | 'working' | 'speaking' | 'celebrating' | 'error' | 'sleeping'> = {
  idle: 'idle',
  listening: 'listening',
  thinking: 'thinking',
  searching: 'working',
  working: 'working',
  speaking: 'speaking',
  happy: 'celebrating',
  error: 'error',
  sleeping: 'sleeping'
};

export function AssistantMascot({ state, size, paused = false, label }: {
  state: MascotState;
  size: number;
  paused?: boolean;
  label?: string;
}) {
  const [ready, setReady] = useState(false);
  const [spriteReady, setSpriteReady] = useState(false);
  const staticOnly = paused || size < 55;
  const liveRef = useRef<HTMLSpanElement>(null);
  const actorRef = useRef<WobnimoMascot | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setSpriteReady(false);
    if (staticOnly) return;
    let current = true;
    const image = new window.Image();
    image.onload = () => { if (current) setSpriteReady(true); };
    image.src = `/admin/assistantSongbot${spriteState[state]}.webp`;
    return () => { current = false; };
  }, [staticOnly, state]);

  useEffect(() => {
    if (staticOnly) return;
    setReady(false);
    let cancelled = false;
    let actor: WobnimoMascot | null = null;
    void import('wobnimo').then(({ mount }) => {
      if (cancelled || !liveRef.current) return;
      actor = mount(liveRef.current, songbot, {
        state: liveState[stateRef.current], interactive: false, effects: size >= 88,
        speed: 0.9, maxPixelRatio: 2, floor: 0.35
      });
      actorRef.current = actor;
      actor.on('ready', () => { if (!cancelled) setReady(true); });
      if (actor.ready) setReady(true);
    }).catch(() => { /* Keep the static image when WebGL is unavailable. */ });
    return () => {
      cancelled = true;
      actor?.dispose();
      actorRef.current = null;
    };
  }, [staticOnly, size]);

  useEffect(() => { actorRef.current?.setState(liveState[state]); }, [state]);

  return <span className={styles.mascot} data-state={state} data-paused={paused || undefined} data-static={staticOnly || undefined}
    data-sprite-ready={!staticOnly && spriteReady || undefined} data-ready={!staticOnly && ready && actorRef.current?.ready || undefined}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    style={{ width: size, height: size }}>
    <Image src="/admin/assistantSongbot.webp" alt="" width={size} height={size}
      className={styles.poster} loading="eager" unoptimized />
    {!staticOnly && <span key={spriteState[state]} className={styles.sprite} aria-hidden="true"
      style={{ backgroundImage: `url('/admin/assistantSongbot${spriteState[state]}.webp')` }} />}
    {!staticOnly && <span ref={liveRef} className={styles.live} />}
  </span>;
}
