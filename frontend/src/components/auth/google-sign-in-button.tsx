'use client';

import { useEffect, useRef, useState } from 'react';

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
 * Loads the GSI script once (shared across pages), renders the button into a
 * div, and forwards the verified ID token to `onToken`. The token is then sent
 * to the backend which verifies it server-side — the backend never trusts an
 * unverified token.
 */
export default function GoogleSignInButton({ onToken, disabled }: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const buttonRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Keep the latest callback without re-initializing GSI on every render
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!clientId) {
      // NEXT_PUBLIC_* vars are inlined at BUILD time, so an undefined value means
      // the build didn't have it — the button can't render at all. This is the
      // most common cause of "the Google button is missing in production".
      console.error(
        '[GoogleSignIn] NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set for this build, so the ' +
          'Google button is hidden. Set it in the frontend host (e.g. Vercel → Project → ' +
          'Settings → Environment Variables, for the Production environment), then REDEPLOY — ' +
          'NEXT_PUBLIC_* values are baked in at build time and need a fresh build.'
      );
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
  }, [clientId]);

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