// Kader-check per coin voor de Feed: uit de marktanalyse als die er is, anders zelf opgehaald (zie
// haalKaderCheck). Eén coin tegelijk, zodat een volle Feed Binance niet in één keer bestookt.
import { useEffect, useMemo, useState } from 'react';
import { useMarkt } from './MarktProvider';
import { haalKaderCheck, KaderCheck, naarKaderCheck } from './kaderNiveaus';

export function useKaderChecks(symbolen: string[]): Record<string, KaderCheck> {
  const { state } = useMarkt();
  const [opgehaald, setOpgehaald] = useState<Record<string, KaderCheck>>({});

  const alle = state.status === 'success' ? state.alle : null;
  const uitAnalyse = useMemo(() => {
    const kaart: Record<string, KaderCheck> = {};
    if (alle) for (const t of alle) kaart[t.symbool] = naarKaderCheck(t);
    return kaart;
  }, [alle]);

  const sleutel = [...new Set(symbolen)].sort().join(',');
  useEffect(() => {
    const ontbreekt = sleutel.split(',').filter(s => s && !uitAnalyse[s]);
    if (ontbreekt.length === 0) return;
    let actief = true;
    (async () => {
      for (const s of ontbreekt) {
        const check = await haalKaderCheck(s);
        if (!actief) return;
        if (check) setOpgehaald(oud => (oud[s] ? oud : { ...oud, [s]: check }));
      }
    })().catch(() => {});
    return () => { actief = false; };
  }, [sleutel, uitAnalyse]);

  return useMemo(() => ({ ...opgehaald, ...uitAnalyse }), [opgehaald, uitAnalyse]);
}
