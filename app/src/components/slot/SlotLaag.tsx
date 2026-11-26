import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Modal } from 'react-native';
import { PodiumScherm } from '../PodiumScherm';
import { useSlotIntern, useVergrendeling } from '../../state/VergrendelProvider';
import type { PinUitkomst, SlotStand } from '../../state/vergrendelTypes';
import { PinInstellenSheet, PinVraagInhoud } from './PinInstellen';
import { SlotScherm } from './SlotScherm';

// Komt onWeg (einde van de ontgrendel-animatie) niet, dan gaat de Modal na deze tijd alsnog weg.
// Anders ligt er een onzichtbaar venster dat elke aanraking opslokt.
const ONWEG_NOODREM_MS = 1500;

// ---------- PinVraagSheet ----------

export interface PinVraagSheetProps {
  zichtbaar: boolean;
  titel: string;
  sub?: string;
  // Controleert de pincode (bijvoorbeeld controleerHuidigePin, of zetSlotUit omgezet naar een
  // PinUitkomst). Elke fout telt in dezelfde teller.
  onPin(pin: string): Promise<PinUitkomst>;
  // Na een goede pincode, als het scherm dicht is (na de sluitanimatie).
  onKlaar(): void;
  // Gesloten zonder goede pincode (X, terugknop, swipe-terug), na de sluitanimatie.
  onAnnuleer(): void;
  // Er loopt al een wachttijd bij het openen: de rest en de volle duur van de trede (ms).
  beginBlokkadeMs?: number;
  beginBlokkadeDuurMs?: number;
}

// PinVraagInhoud in een PodiumScherm: de pincodevraag bij een echte order (via bevestigIdentiteit,
// SlotLaag toont hem zelf) en bij "App vergrendelen" uitzetten (BeveiligingGroep toont hem met
// titel 'Voer je pincode in' en sub 'Om de vergrendeling uit te zetten.'). onKlaar en onAnnuleer
// komen pas na de sluitanimatie, zodat een volgende Modal (een dialoog na de order) nooit in
// dezelfde tick verschijnt als deze verdwijnt.
export function PinVraagSheet({
  zichtbaar,
  titel,
  sub,
  onPin,
  onKlaar,
  onAnnuleer,
  beginBlokkadeMs,
  beginBlokkadeDuurMs,
}: PinVraagSheetProps) {
  const uitkomst = useRef<'klaar' | 'annuleer'>('annuleer');
  useEffect(() => {
    if (zichtbaar) uitkomst.current = 'annuleer';
  }, [zichtbaar]);

  return (
    <PodiumScherm
      zichtbaar={zichtbaar}
      onSluiten={() => (uitkomst.current === 'klaar' ? onKlaar() : onAnnuleer())}
    >
      {sluit => (
        <PinVraagInhoud
          titel={titel}
          sub={sub}
          onPin={onPin}
          beginBlokkadeMs={beginBlokkadeMs}
          beginBlokkadeDuurMs={beginBlokkadeDuurMs}
          onKlaar={() => {
            uitkomst.current = 'klaar';
            sluit({ naarBron: false });
          }}
          onAnnuleer={() => {
            uitkomst.current = 'annuleer';
            sluit();
          }}
        />
      )}
    </PodiumScherm>
  );
}

// ---------- SlotLaag ----------

// De root-laag van de app-vergrendeling: de slot-Modal met SlotScherm, plus de PinVraagSheet
// (bevestigIdentiteit) en de PinInstellenSheet (vraagPinInstellen). Hoort precies één keer binnen
// VergrendelProvider te staan, buiten de takken van AppInhoud, zodat hij bij een takwissel (laden,
// onboarding, hoofdtak) niet opnieuw mount.
//
// Volgorde van vensters: op Android ligt het laatst getoonde Dialog-venster bovenop. De slot-Modal
// mount op het moment dat de status op slot gaat, en useNaSlot laat geen andere Modal openen
// zolang het slot er ligt; zo ligt het slot altijd bovenop. Een Modal die er al lag blijft eronder
// staan met zijn state.
export function SlotLaag() {
  const intern = useSlotIntern();
  if (!intern) return null;
  return <SlotLaagInhoud />;
}

function SlotLaagInhoud() {
  const v = useVergrendeling();
  const intern = useSlotIntern()!;
  const { status, kluisfout } = v;
  const { episode, openVia, meldSlotZichtbaar, slotGetoond } = intern;

  const nodig = status === 'vergrendeld' || status === 'setupVerplicht';
  const nodigRef = useRef(nodig);
  nodigRef.current = nodig;

  // De stand voor SlotScherm. Gaat het slot open, dan blijft de laatste stand staan tot de Modal
  // weg is (de ontgrendel-animatie speelt in die stand).
  const [stand, setStand] = useState<SlotStand>('afdekken');
  const nieuweStand: SlotStand | null =
    status === 'vergrendeld' ? (kluisfout ? 'kluisfout' : 'ontgrendelen') : status === 'setupVerplicht' ? 'setupVerplicht' : null;
  if (nieuweStand && nieuweStand !== stand) setStand(nieuweStand);

  const [modalAan, setModalAan] = useState(false);
  // De episode waarvoor de Modal getoond is (onShow). Pas dan mag de biometrie automatisch openen.
  const [getoondEpisode, setGetoondEpisode] = useState<number | null>(null);
  const episodeRef = useRef(episode);
  episodeRef.current = episode;

  // Bij termijn 'direct' gaat het slot al op de achtergrond dicht, en onShow kan dan ook daar
  // vallen. Een biometrische prompt vanaf de achtergrond faalt; dus pas automatisch openen als de
  // app weer op de voorgrond is.
  const [opVoorgrond, setOpVoorgrond] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => setOpVoorgrond(s !== 'background'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (nodig) {
      setModalAan(true);
      return;
    }
    if (!modalAan) return;
    if (openVia === 'slot') {
      // Wachten op onWeg; dit is de noodrem.
      const t = setTimeout(() => setModalAan(false), ONWEG_NOODREM_MS);
      return () => clearTimeout(t);
    }
    setModalAan(false);
  }, [nodig, openVia, modalAan]);

  useEffect(() => {
    meldSlotZichtbaar(modalAan);
    if (!modalAan) setGetoondEpisode(null);
  }, [modalAan, meldSlotZichtbaar]);

  // Hervergrendeld terwijl de Modal al lag: onShow komt niet opnieuw, dus hier de afdekking uit en
  // de nieuwe episode als getoond markeren (dan opent de biometrie weer automatisch).
  useEffect(() => {
    if (!nodig || getoondEpisode === null || getoondEpisode === episode) return;
    setGetoondEpisode(episode);
    slotGetoond();
    // Alleen bij een nieuwe episode; getoondEpisode wordt hier zelf gezet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode, nodig, slotGetoond]);

  const onShow = useCallback(() => {
    setGetoondEpisode(episodeRef.current);
    slotGetoond();
  }, [slotGetoond]);

  const onWeg = useCallback(() => {
    if (!nodigRef.current) setModalAan(false);
  }, []);

  const terugRef = useRef<(() => boolean) | null>(null);
  const terug = useCallback(() => {
    // Het slot is al open en de Modal speelt alleen nog de ontgrendel-animatie: de druk slikken. De
    // app sluiten zou hier verrassen, en SlotScherm is klaar met zijn episode.
    if (!nodigRef.current) return;
    if (terugRef.current?.()) return;
    // Geen venster eronder: de terugknop verlaat Kader, hij omzeilt het slot niet.
    BackHandler.exitApp();
  }, []);

  return (
    <>
      {intern.pinInstellen ? (
        <PinInstellenSheet
          key={intern.pinInstellen.id}
          {...intern.pinInstellen.props}
          zichtbaar={intern.pinInstellenZichtbaar}
          onKlaar={intern.pinInstellenKlaar}
          onAnnuleer={intern.pinInstellenAnnuleer}
        />
      ) : null}
      {intern.pinVraag ? (
        <PinVraagSheet
          key={intern.pinVraag.id}
          zichtbaar={intern.pinVraagZichtbaar}
          titel={intern.pinVraag.titel}
          sub={intern.pinVraag.sub}
          beginBlokkadeMs={intern.pinVraag.beginBlokkadeMs}
          beginBlokkadeDuurMs={intern.pinVraag.beginBlokkadeDuurMs}
          onPin={intern.pinVraagControleer}
          onKlaar={intern.pinVraagKlaar}
          onAnnuleer={intern.pinVraagAnnuleer}
        />
      ) : null}
      {modalAan ? (
        <Modal
          visible
          transparent
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          onShow={onShow}
          onRequestClose={terug}
        >
          <SlotScherm
            // Elke nieuwe vergrendeling begint met een vers scherm: een half afgemaakt herstel of
            // een open uitleg van de vorige episode blijft niet staan.
            key={episode}
            episode={episode}
            stand={stand}
            biometrieToets={v.biometrieBruikbaar && stand === 'ontgrendelen'}
            autoBiometrie={opVoorgrond && getoondEpisode === episode && stand === 'ontgrendelen'}
            blokkade={v.blokkade}
            onPin={v.ontgrendelMetPin}
            onBiometrie={v.ontgrendelMetBiometrie}
            onHerstel={v.herstelViaToestel}
            pinInstellen={intern.slotInstellen}
            onKoppelingVerwijderen={v.verwijderKoppelingEnOpen}
            onOpnieuwProberen={v.opnieuwProberen}
            onWeg={onWeg}
            terugRef={terugRef}
          />
        </Modal>
      ) : null}
    </>
  );
}
