import { useCallback, useEffect, useState } from 'react';
import { laadTekst, bewaarTekst, SLEUTELS } from '../storage/opslag';
import { usePortfolio } from './PortfolioProvider';
import { bepaalRem, RemStand } from './verliesRem';

// Markt, Kansen en de kooporder lezen allemaal of de rem loopt. Hef je hem op Markt op, dan moet
// de kooporder dat meteen weten, dus de opgeheven-stand is gedeeld.
let opgeheven: number | null | undefined;
const luisteraars = new Set<(a: number | null) => void>();

async function laadOpgeheven(): Promise<number | null> {
  if (opgeheven !== undefined) return opgeheven;
  const n = Number(await laadTekst(SLEUTELS.remOpgeheven, ''));
  opgeheven = Number.isFinite(n) && n > 0 ? n : null;
  return opgeheven;
}

export function useVerliesRem(): { rem: RemStand | null; hefOp: () => Promise<void> } {
  const { trades, omgeving } = usePortfolio();
  const [anker, setAnker] = useState<number | null>(opgeheven ?? null);
  const [geladen, setGeladen] = useState(opgeheven !== undefined);
  const [nu, setNu] = useState(Date.now());

  useEffect(() => {
    let actief = true;
    laadOpgeheven().then(a => { if (actief) { setAnker(a); setGeladen(true); } });
    luisteraars.add(setAnker);
    return () => { actief = false; luisteraars.delete(setAnker); };
  }, []);

  const rem = geladen ? bepaalRem(trades, omgeving, anker, nu) : null;

  // Loopt de rem af terwijl het scherm open staat, dan verdwijnt de kaart vanzelf.
  useEffect(() => {
    if (!rem) return;
    const t = setTimeout(() => setNu(Date.now()), Math.max(1000, rem.tot - Date.now() + 1000));
    return () => clearTimeout(t);
  }, [rem?.tot]);

  const hefOp = useCallback(async () => {
    if (!rem) return;
    opgeheven = rem.anker;
    luisteraars.forEach(f => f(rem.anker));
    await bewaarTekst(SLEUTELS.remOpgeheven, String(rem.anker));
  }, [rem?.anker]);

  return { rem, hefOp };
}
