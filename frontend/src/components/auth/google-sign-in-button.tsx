'use client';

import { useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/api';

// Google Identity Services (GSI) global — loaded from accounts.google.com/gsi/client
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              shape?: string;
              text?: string;
              logo_alignment?: string;
              width?: number | string;
            }
          ) => void;
        };
      };
    };
  }
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleSignInButtonProps {
  /** Called with the signed Google ID token (JWT) once the user picks an account */
  onToken: (idToken: string) => void;
  disabled?: boolean;
}

/**
 * "Sign in with Google" button powered by Google Identity Services.
 *
 * The client ID comes from `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, which Next.js inlines
 * at BUILD time — so a frontend host that didn't have the variable when it built
 * (a very common Vercel setup mistake) would otherwise hide this button forever
 * with no visible clue. As a safety net we fall back to the backend's
 * `GOOGLE_CLIENT_ID` (through a public config endpoint) at runtime. OAuth client
 * IDs are public by design — browsers send them to Google — so this leaks nothing.
 *
 * Loads the GSI script once (shared across pages), renders the button into a div,
 * and forwards the verified ID token to `onToken`. The token is then sent to the
 * backend which verifies it server-side — the backend never trusts an unverified
 * token.
 */
export default function GoogleSignInButton({ onToken, disabled }: GoogleSignInButtonProps) {
  const buildTimeClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const [clientId, setClientId] = useState<string | null>(buildTimeClientId ?? null);
  // `resolved` = we know whether a client ID is available (so we can report the
  // real reason instead of logging an error while still resolving).
  const [resolved, setResolved] = useState(Boolean(buildTimeClientId));
  const buttonRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Keep the latest callback without re-initializing GSI on every render
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  // Resolve the client ID. The build-time value wins; otherwise ask the backend once.
  useEffect(() => {
    if (buildTimeClientId) return;
    let cancelled = false;
    auth
      .googleConfig()
      .then((cfg) => {
        if (!cancelled) setClientId(cfg.clientId);
      })
      .catch(() => {
        if (!cancelled) setClientId(null);
      })
      .finally(() => {
        if (!cancelled) setResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [buildTimeClientId]);

  useEffect(() => {
    if (!clientId) {
      if (resolved) {
        console.error(
          '[GoogleSignIn] No Google client ID available, so the button is hidden. Set ' +
            'NEXT_PUBLIC_GOOGLE_CLIENT_ID on the frontend host (e.g. Vercel → Settings → ' +
            'Environment Variables, for the Production environment) and REDEPLOY — ' +
            'NEXT_PUBLIC_* values are baked in at build time. Also make sure ' +
            'GOOGLE_CLIENT_ID is set on the backend (this button fell back to it and ' +
            'got nothing).'
        );
      }
      return;
    }
    if (!buttonRef.current) return;

    let cancelled = false;
    let verifyTimer: number | undefined;

    const handleLoad = () => {
      if (cancelled || !window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) onTokenRef.current(response.credential);
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        width: buttonRef.current.clientWidth || 320,
      });

      // GSI fails *silently* when this origin isn't listed in the OAuth client's
      // "Authorized JavaScript origins": it only logs to the browser console and
      // renders nothing, leaving a blank gap. Detect that and show a visible
      // message rather than an invisible button.
      verifyTimer = window.setTimeout(() => {
        if (!cancelled && buttonRef.current && buttonRef.current.childElementCount === 0) {
          setFailed(true);
        }
      }, 1500);
    };

    // Reuse the script tag if another page already loaded it
    const existingScript = document.getElementById('google-gsi-script') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', handleLoad);
      if (window.google) handleLoad();
    } else {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = GSI_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = handleLoad;
      script.onerror = () => setFailed(true);
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (verifyTimer) window.clearTimeout(verifyTimer);
    };
  }, [clientId, resolved]);

  if (!clientId) return null;
  if (failed) {
    return (
      <p className="text-caption-xs text-red-600">
        Google Sign-In failed to load. Please try again or use your password.
      </p>
    );
  }

  return (
    <div
      ref={buttonRef}
      className={disabled ? 'pointer-events-none opacity-60' : ''}
      aria-hidden={disabled}
    />
  );
}
