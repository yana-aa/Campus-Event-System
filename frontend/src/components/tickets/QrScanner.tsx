import jsQR from 'jsqr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button } from '../ui';

interface QrScannerProps {
  /** Called once per distinct code; scanning pauses until `paused` turns false again. */
  onScan(value: string): void;
  paused?: boolean;
}

type CameraState = 'idle' | 'starting' | 'scanning' | 'unsupported' | 'denied' | 'error';

/** Camera QR scanner using getUserMedia + jsQR frame decoding. */
export function QrScanner({ onScan, paused = false }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number>(0);
  const lastValueRef = useRef<{ value: string; at: number } | null>(null);
  const pausedRef = useRef(paused);
  const onScanRef = useRef(onScan);
  const [state, setState] = useState<CameraState>('idle');

  pausedRef.current = paused;
  onScanRef.current = onScan;

  const supported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState((s) => (s === 'scanning' || s === 'starting' ? 'idle' : s));
  }, []);

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && !pausedRef.current) {
      const width = video.videoWidth;
      const height = video.videoHeight;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const image = ctx.getImageData(0, 0, width, height);
        const code = jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          const last = lastValueRef.current;
          const now = Date.now();
          // Ignore the same code for 3s so one ticket held in frame isn't submitted repeatedly.
          if (!last || last.value !== code.data || now - last.at > 3000) {
            lastValueRef.current = { value: code.data, at: now };
            onScanRef.current(code.data);
          }
        }
      }
    }
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(async () => {
    if (!supported) {
      setState('unsupported');
      return;
    }
    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        await video.play();
      }
      setState('scanning');
      frameRef.current = requestAnimationFrame(tick);
    } catch (error) {
      const name = (error as Error).name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
    }
  }, [supported, tick]);

  useEffect(() => stop, [stop]);

  return (
    <div className="scanner">
      <div className={['scanner__viewport', state === 'scanning' && 'scanner__viewport--live'].filter(Boolean).join(' ')}>
        <video ref={videoRef} className="scanner__video" muted aria-label="Camera preview" />
        <canvas ref={canvasRef} className="scanner__canvas" aria-hidden="true" />
        {state === 'scanning' && <div className="scanner__frame" aria-hidden="true" />}
        {state !== 'scanning' && (
          <div className="scanner__placeholder">
            <span aria-hidden="true">📷</span>
            <p>{state === 'starting' ? 'Starting camera…' : 'Point the camera at a CampusPass QR code'}</p>
          </div>
        )}
      </div>
      {!supported || state === 'unsupported' ? (
        <Alert tone="warning" title="Camera not available">
          This browser can't open the camera here. Camera scanning needs HTTPS or localhost. Type the booking code below instead.
        </Alert>
      ) : state === 'denied' ? (
        <Alert tone="danger" title="Camera permission denied">
          Allow camera access in your browser settings, or type the booking code below.
        </Alert>
      ) : state === 'error' ? (
        <Alert tone="danger" title="Could not start the camera">
          Another app may be using it. Try again or use manual entry.
        </Alert>
      ) : null}
      <div className="scanner__controls">
        {state === 'scanning' ? (
          <Button variant="secondary" onClick={stop}>
            Stop camera
          </Button>
        ) : (
          <Button onClick={start} disabled={!supported} loading={state === 'starting'} icon={<span aria-hidden="true">📷</span>}>
            Start camera scanner
          </Button>
        )}
        {paused && state === 'scanning' && <span className="text-muted">Paused while showing result…</span>}
      </div>
    </div>
  );
}
