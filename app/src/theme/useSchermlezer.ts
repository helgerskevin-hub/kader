import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Of er een schermlezer (TalkBack) aan staat, live gevolgd: de stand kan wisselen terwijl een scherm
// open staat. Schermen die vasthouden vragen gebruiken dit om met een schermlezer een bevestiging te
// tonen en hun uitleg daarop aan te passen.
export function useSchermlezer(): boolean {
  const [aan, setAan] = useState(false);
  useEffect(() => {
    let actiefNog = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then(a => { if (actiefNog) setAan(a); })
      .catch(() => {});
    const abonnement = AccessibilityInfo.addEventListener('screenReaderChanged', setAan);
    return () => {
      actiefNog = false;
      abonnement.remove();
    };
  }, []);
  return aan;
}
