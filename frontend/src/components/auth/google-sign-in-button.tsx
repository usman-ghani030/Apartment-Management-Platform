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
    if (!clientId || !buttonRef.current) return;

    let cancelled = false;

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