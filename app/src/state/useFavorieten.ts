import { useCallback, useEffect, useState } from 'react';
import { laadLijst, bewaarLijst, SLEUTELS } from '../storage/opslag';

export function useFavorieten() {
  const [favorieten, setFavorieten] = useState<Set<string>>(new Set());

  useEffect(() => {
    laadLijst<string>(SLEUTELS.favorieten).then(l => setFavorieten(new Set(l)));
  }, []);

  const isFavoriet = useCallback((symbool: string) => favorieten.has(symbool), [favorieten]);

  const wisselFavoriet = useCallback((symbool: string) => {
    setFavorieten(prev => {
      const volgende = new Set(prev);
      if (volgende.has(symbool)) volgende.delete(symbool); else volgende.add(symbool);
      bewaarLijst(SLEUTELS.favorieten, Array.from(volgende));
      return volgende;
    });
  }, []);

  return { isFavoriet, wisselFavoriet };
}
