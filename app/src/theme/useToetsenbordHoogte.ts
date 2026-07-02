import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useToetsenbordHoogte(): number {
  const [hoogte, setHoogte] = useState(0);

  useEffect(() => {
    const toonEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const verbergEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const toonSub = Keyboard.addListener(toonEvent, e => setHoogte(e.endCoordinates?.height ?? 0));
    const verbergSub = Keyboard.addListener(verbergEvent, () => setHoogte(0));

    return () => {
      toonSub.remove();
      verbergSub.remove();
    };
  }, []);

  return hoogte;
}
