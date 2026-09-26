// Rekenwerk achter het morphen van de koerslijn bij een periodewissel. Apart van PrijsGrafiek.tsx
// omdat dat bestand react-native binnentrekt en niet in Node draait; dit bestand wel, met de
// self-check onderaan.
//
// Twee lijnen kun je alleen punt voor punt in elkaar laten overlopen als ze evenveel punten op
// dezelfde x-posities hebben. 1M heeft 31 punten, Alles er 200. Beide naar een vast aantal (zeg
// 120) herbemonsteren werkt, maar snijdt de hoeken van de echte lijn af: een piek tussen twee
// monsterpunten wordt lager getekend, en als de morph klaar is staat er een licht andere lijn dan
// de echte. Daarom bemonsteren we op de VERENIGING van beide x-rasters. Elk echt punt van beide
// reeksen zit daar precies in, dus het begin van de morph is exact de oude lijn en het eind exact
// de nieuwe, zonder sprong als de animatie stilvalt.

// Fracties 0..1 langs de x-as, één per punt, oplopend.
export function fractiesVoor(aantal: number): number[] {
  if (aantal < 2) return [0];
  return Array.from({ length: aantal }, (_, i) => i / (aantal - 1));
}

// Twee oplopende rijen fracties samenvoegen tot één oplopende rij zonder dubbelen. Twee fracties
// die op minder dan een miljoenste van elkaar liggen zijn op elk scherm dezelfde pixel.
export function unieFracties(a: number[], b: number[]): number[] {
  const uit: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const volgende = j >= b.length || (i < a.length && a[i] <= b[j]) ? a[i++] : b[j++];
    if (uit.length === 0 || volgende - uit[uit.length - 1] > 1e-6) uit.push(volgende);
  }
  return uit;
}

// De lijn door (xs, ys) aflezen op de oplopende x-posities `op`, met rechte stukken ertussen,
// net zoals de lijn getekend wordt. Loopt in één keer door beide rijen.
export function bemonster(xs: number[], ys: number[], op: number[]): number[] {
  const uit: number[] = new Array(op.length);
  let k = 0;
  for (let i = 0; i < op.length; i++) {
    const x = op[i];
    while (k < xs.length - 2 && xs[k + 1] < x) k++;
    const x0 = xs[k];
    const x1 = xs[Math.min(k + 1, xs.length - 1)];
    const y0 = ys[k];
    const y1 = ys[Math.min(k + 1, ys.length - 1)];
    const t = x1 > x0 ? Math.min(Math.max((x - x0) / (x1 - x0), 0), 1) : 0;
    uit[i] = y0 + (y1 - y0) * t;
  }
  return uit;
}

// Skia mengt kleuren als losse kanalen. Naar 'transparent' (zwart zonder dekking) vervagen kleurt
// de onderkant van het verloop grauw; dezelfde kleur met alfa 0 blijft zuiver.
export function metAlfa(hex: string, alfa: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alfa})`;
}

// ponytail: self-check ipv testframework, run met `npx tsx app/src/components/grafiek/morph.ts`
if (require.main === module) {
  const gelijk = (a: number, b: number) => Math.abs(a - b) < 1e-9;

  // ---------- Vereniging van x-rasters ----------
  const drie = fractiesVoor(3);   // 0, 0.5, 1
  const vijf = fractiesVoor(5);   // 0, 0.25, 0.5, 0.75, 1
  const unie = unieFracties(drie, vijf);
  console.assert(unie.join(',') === '0,0.25,0.5,0.75,1', `unie zonder dubbelen, was: ${unie.join(',')}`);
  const vier = fractiesVoor(4);   // 0, 1/3, 2/3, 1
  console.assert(unieFracties(drie, vier).length === 5, 'derden en helften geven vijf punten');

  // ---------- Elk echt punt zit exact in de bemonstering ----------
  const ys = [10, 50, 20];
  const opUnie = bemonster(drie, ys, unieFracties(drie, vier));
  console.assert(gelijk(opUnie[0], 10) && gelijk(opUnie[2], 50) && gelijk(opUnie[4], 20),
    `echte punten blijven exact, was: ${opUnie.join(',')}`);
  // 1/3 ligt op tweederde van het eerste stuk: 10 + (50 - 10) * 2/3.
  console.assert(gelijk(opUnie[1], 10 + 40 * (2 / 3)), `tussenpunt ligt op de lijn, was: ${opUnie[1]}`);

  // ---------- Randen ----------
  console.assert(bemonster([0, 1], [5, 5], [0, 0.5, 1]).every(y => y === 5), 'vlakke lijn blijft vlak');
  console.assert(bemonster([0, 1], [0, 10], [1])[0] === 10, 'laatste punt wordt exact geraakt');

  // ---------- Kleur ----------
  console.assert(metAlfa('#16A34A', 0) === 'rgba(22, 163, 74, 0)', `hex naar rgba, was: ${metAlfa('#16A34A', 0)}`);
  console.assert(metAlfa('red', 0) === 'red', 'onbekend formaat blijft ongemoeid');

  console.log('morph.ts self-check geslaagd');
}
