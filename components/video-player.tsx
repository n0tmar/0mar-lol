"use client";

import { useEffect, useRef, useState } from "react";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ratioX(event: React.PointerEvent | React.MouseEvent, el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
}

function ratioY(event: React.PointerEvent, el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return Math.max(0, Math.min(1, (rect.bottom - event.clientY) / rect.height));
}

const PlayIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
);

const PauseIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);

const SpeakerIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

const MutedIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

const EnterFullscreenIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9V3h6" />
    <path d="M21 9V3h-6" />
    <path d="M3 15v6h6" />
    <path d="M21 15v6h-6" />
  </svg>
);

const ExitFullscreenIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3v6H3" />
    <path d="M15 3v6h6" />
    <path d="M9 21v-6H3" />
    <path d="M15 21v-6h6" />
  </svg>
);

const Spinner = () => (
  <div className="video-player__spinner">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9.5" opacity="0.2" />
      <path d="M12 2.5a9.5 9.5 0 0 1 7.5 3.5" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="1s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  </div>
);

export function VideoPlayer({
  src,
  type,
  poster,
}: {
  src: string;
  type: string;
  poster?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const volumeRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTime = useRef(0);
  const playing = useRef(false);
  const wasPlayingBeforeScrub = useRef(false);
  const scrubbingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubFraction, setScrubFraction] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [volumeHovered, setVolumeHovered] = useState(false);

  // ---- video events ----

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => {
      setDuration(video.duration);
      setVolume(video.volume);
      setMuted(video.muted);
      setReady(true);
    };
    const onPlay = () => {
      playing.current = true;
      setPaused(false);
    };
    const onPause = () => {
      playing.current = false;
      setPaused(true);
      setShowControls(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    const onTime = () => {
      const now = performance.now();
      if (now - lastTime.current < 120) return;
      lastTime.current = now;
      if (!scrubbingRef.current) setCurrent(video.currentTime);
    };
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onVolume = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onWaiting = () => {
      if (playing.current) setBuffering(true);
    };
    const onCanPlay = () => setBuffering(false);
    const onEnded = () => setPaused(true);

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("progress", onProgress);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // ---- auto-hide controls ----

  function resetHideTimer() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!playing.current) return;
    setShowControls(true);
    hideTimer.current = setTimeout(() => {
      if (playing.current) setShowControls(false);
    }, 2500);
  }

  function onPointerActivity() {
    setShowControls(true);
    resetHideTimer();
  }

  // ---- play / pause ----

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  // ---- seek ----

  function seek(fraction: number) {
    const video = videoRef.current;
    if (video && duration > 0) {
      video.currentTime = Math.max(0, Math.min(1, fraction)) * duration;
    }
  }

  function onScrubStart(event: React.PointerEvent<HTMLDivElement>) {
    if (!duration) return;
    const track = trackRef.current;
    if (!track) return;
    event.preventDefault();
    track.setPointerCapture(event.pointerId);
    wasPlayingBeforeScrub.current = playing.current;
    if (playing.current) videoRef.current?.pause();
    scrubbingRef.current = true;
    setScrubbing(true);
    setScrubFraction(ratioX(event, track));
  }

  function onScrubMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!scrubbing) return;
    const track = trackRef.current;
    if (!track) return;
    setScrubFraction(ratioX(event, track));
  }

  function onScrubEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (!scrubbing) return;
    const track = trackRef.current;
    if (track?.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }
    if (scrubFraction !== null) seek(scrubFraction);
    scrubbingRef.current = false;
    setScrubbing(false);
    setScrubFraction(null);
    if (wasPlayingBeforeScrub.current) void videoRef.current?.play();
  }

  // ---- volume ----

  function setVolumeValue(fraction: number) {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, fraction));
    video.muted = fraction === 0;
  }

  function onVolumeStart(event: React.PointerEvent<HTMLDivElement>) {
    const slider = volumeRef.current;
    if (!slider) return;
    event.preventDefault();
    slider.setPointerCapture(event.pointerId);
    setVolumeValue(ratioY(event, slider));
  }

  function onVolumeMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!volumeRef.current?.hasPointerCapture(event.pointerId)) return;
    setVolumeValue(ratioY(event, volumeRef.current));
  }

  function onVolumeEnd(event: React.PointerEvent<HTMLDivElement>) {
    const slider = volumeRef.current;
    if (slider?.hasPointerCapture(event.pointerId)) {
      slider.releasePointerCapture(event.pointerId);
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }

  // ---- fullscreen ----

  async function toggleFullscreen() {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      // prefer container so custom controls render inside fullscreen
      if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else {
        await video.requestFullscreen();
      }
    } catch {
      // fallback: iOS Safari older versions
      try {
        const webkitVideo = video as HTMLVideoElement & { webkitEnterFullscreen?: () => Promise<void> };
        if (webkitVideo.webkitEnterFullscreen) {
          await webkitVideo.webkitEnterFullscreen();
        }
      } catch {
        /* unavailable */
      }
    }
  }

  // ---- keyboard ----

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video || !containerRef.current?.contains(document.activeElement)) return;

      if (event.code === "Space" || event.code === "KeyK") {
        event.preventDefault();
        togglePlay();
      }
      if (event.code === "KeyF") {
        event.preventDefault();
        toggleFullscreen();
      }
      if (event.code === "KeyM") {
        event.preventDefault();
        toggleMute();
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
      }
      if (event.code === "ArrowUp") {
        event.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
        video.muted = false;
      }
      if (event.code === "ArrowDown") {
        event.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ---- derived ----

  const effectiveCurrent =
    scrubbing && scrubFraction !== null ? scrubFraction * duration : current;
  const played = duration > 0 ? (effectiveCurrent / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;
  const controlsVisible = showControls || scrubbing || !ready;

  // ---- render ----

  return (
    <div
      ref={containerRef}
      className="video-player"
      dir="ltr"
      onMouseEnter={onPointerActivity}
      onMouseMove={onPointerActivity}
      onPointerMove={onPointerActivity}
    >
      <video
        ref={videoRef}
        className="video-player__video"
        preload="metadata"
        playsInline
        poster={poster}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onContextMenu={(event) => event.preventDefault()}
      >
        <source src={src} type={type} />
      </video>

      {paused && ready && !scrubbing && (
        <button
          type="button"
          className="video-player__big-play"
          onClick={(event) => {
            event.stopPropagation();
            togglePlay();
          }}
          aria-label="Play"
        >
          <PlayIcon />
        </button>
      )}

      {buffering && !paused && (
        <Spinner />
      )}

      <div
        className={`video-player__controls ${controlsVisible ? "" : "is-hidden"}`}
        onMouseEnter={onPointerActivity}
      >
        {/* play */}
        <button
          type="button"
          className="video-player__btn"
          onClick={togglePlay}
          aria-label={paused ? "Play" : "Pause"}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>

        {/* volume */}
        <div
          className="video-player__volume-control"
          onMouseEnter={() => {
            if (volumeLeaveTimer.current) clearTimeout(volumeLeaveTimer.current);
            setVolumeHovered(true);
          }}
          onMouseLeave={() => {
            volumeLeaveTimer.current = setTimeout(() => setVolumeHovered(false), 120);
          }}
        >
          <button
            type="button"
            className="video-player__btn"
            onClick={toggleMute}
            aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? <MutedIcon /> : <SpeakerIcon />}
          </button>
          <div
            ref={volumeRef}
            className={`video-player__volume ${volumeHovered ? "is-open" : ""}`}
            onPointerDown={onVolumeStart}
            onPointerMove={onVolumeMove}
            onPointerUp={onVolumeEnd}
            onPointerCancel={onVolumeEnd}
            onMouseEnter={() => {
              if (volumeLeaveTimer.current) clearTimeout(volumeLeaveTimer.current);
              setVolumeHovered(true);
            }}
            onMouseLeave={() => {
              volumeLeaveTimer.current = setTimeout(() => setVolumeHovered(false), 120);
            }}
            role="slider"
            aria-label="Volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((muted ? 0 : volume) * 100)}
            tabIndex={0}
          >
            <div className="video-player__volume-track" />
            <div
              className="video-player__volume-fill"
              style={{ height: `${(muted ? 0 : volume) * 100}%` }}
            />
          </div>
        </div>

        {/* seek bar */}
        <div
          ref={trackRef}
          className="video-player__track"
          onPointerDown={onScrubStart}
          onPointerMove={onScrubMove}
          onPointerUp={onScrubEnd}
          onPointerCancel={onScrubEnd}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(effectiveCurrent)}
          tabIndex={0}
        >
          <div
            className="video-player__buffered"
            style={{ width: `${bufferedPct}%` }}
          />
          <div
            className="video-player__progress"
            style={{ width: `${played}%` }}
          />
          <div
            className="video-player__thumb"
            style={{ left: `${played}%` }}
          />
        </div>

        {/* time */}
        <span className="video-player__time">
          <span>{formatTime(effectiveCurrent)}</span>
          <span className="video-player__divider">/</span>
          <span>{ready ? formatTime(duration) : "0:00"}</span>
        </span>

        {/* fullscreen */}
        <button
          type="button"
          className="video-player__btn"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
        </button>
      </div>
    </div>
  );
}
