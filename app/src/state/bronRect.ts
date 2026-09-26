// Waar een full-screen scherm vandaan komt. Een kaart die een scherm opent legt hier vlak voor
// zijn onPress vast waar hij op het scherm stond, en PodiumScherm pakt dat op bij het openen om
// het scherm uit precies die kaart te laten groeien (en er bij sluiten weer in terug te laten
// krimpen).
//
// Bewust een kaal modulevariabele en geen context: de kaart en het scherm zitten op heel
// verschillende plekken in de boom (een kaart diep in een FlatList, het scherm als broer van die
// lijst), en er is maar één vinger die tegelijk een kaart kan indrukken. Een context zou elke
// kaart laten meerenderen voor iets dat nooit in beeld komt.

export interface BronStijl {
  // Achtergrondkleur van de kaart. Zolang het scherm nog klein is, is dit de kleur van het vlak
  // dat uitgroeit, zodat het begin er precies uitziet als de kaart zelf.
  kleur: string;
  // Hoekradius van de kaart, gaat tijdens het uitgroeien naar 0.
  radius: number;
}

export interface BronRect extends BronStijl {
  // Venstercoördinaten uit measureInWindow. Die lopen gelijk met een full-screen Modal, want die
  // ligt edge-to-edge over hetzelfde scherm.
  x: number;
  y: number;
  breedte: number;
  hoogte: number;
}

let laatste: { rect: BronRect; tijd: number } | null = null;

export function zetBron(rect: BronRect): void {
  laatste = { rect, tijd: Date.now() };
}

// Eenmalig: wie hem neemt, leegt hem ook. Anders groeit een scherm dat later via een melding of
// een knop opent uit een kaart die al lang niet meer is aangeraakt. Om dezelfde reden telt een
// rect alleen als hij vers is: tussen de tik en het openen zit hooguit een render.
export function neemBron(maxLeeftijdMs: number = 600): BronRect | null {
  const l = laatste;
  laatste = null;
  if (!l || Date.now() - l.tijd > maxLeeftijdMs) return null;
  return l.rect;
}
