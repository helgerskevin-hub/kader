'use no memo';
// De Android-widget op het startscherm: het open resultaat van je portfolio in R, en op de brede
// versie de posities die het dichtst bij hun stop of doel staan.
//
// Dit is geen gewoon React-component. react-native-android-widget roept de functies hieronder aan
// en zet het resultaat om naar een native widget; hooks werken hier dus niet, en de React Compiler
// mag dit bestand niet herschrijven (vandaar 'use no memo' bovenaan).

import React from 'react';
import { FlexWidget, TextWidget, type HexColor } from 'react-native-android-widget';
import type { WidgetPositie, WidgetStand } from '../state/widgetStand';
import { fmtR, fmtResultaatUsd } from '../engine/format';
import { type ColorTokens, radii, spacing } from '../theme/tokens';

// De lettertypen staan via de plugin in app.json in de app; de naam is de bestandsnaam.
const SANS = 'IBMPlexSans_400Regular';
const SANS_KOP = 'IBMPlexSans_600SemiBold';
const MONO = 'IBMPlexMono_500Medium';

// Vanaf deze breedte (dp) is er plek voor de posities naast het totaal. Een 2x2-widget is op een
// telefoon zo'n 150 tot 180 dp breed, een 4x2 ruim 300.
const BREED_VANAF = 250;

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

interface Props {
  stand: WidgetStand | null;
  bedragen: boolean;
  breedte: number;
  kleuren: ColorTokens;
  nu: number;
  uri: string;
}

function hex(kleur: string): HexColor {
  return kleur as HexColor;
}

function rKleur(r: number, k: ColorTokens): HexColor {
  // Zelfde afronding als fmtR: wat op +0.00 R uitkomt is geen verlies.
  return hex(Number(r.toFixed(2)) >= 0 ? k.winst : k.verlies);
}

function twee(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// "14:05" vandaag, anders "5 nov, 14:05". Met de hand, zodat de widget-taak zonder schermlocale
// hetzelfde schrijft als de app.
function tijdTekst(tijd: number, nu: number): string {
  const d = new Date(tijd);
  const n = new Date(nu);
  const klok = `${twee(d.getHours())}:${twee(d.getMinutes())}`;
  const zelfdeDag = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  return zelfdeDag ? klok : `${d.getDate()} ${MAANDEN[d.getMonth()]}, ${klok}`;
}

function nabijTekst(p: WidgetPositie): string | null {
  if (p.nabij === 'stop') return 'dicht bij stop';
  if (p.nabij === 'doel') return 'bijna op doel';
  return null;
}

function Kop({ stand, kleuren }: { stand: WidgetStand | null; kleuren: ColorTokens }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
      <TextWidget text="Kader" style={{ fontSize: 13, fontFamily: SANS_KOP, color: hex(kleuren.primair) }} />
      <FlexWidget style={{ flex: 1 }} />
      {stand?.omgeving === 'demo' && (
        <FlexWidget
          style={{
            backgroundColor: hex(kleuren.verhoogd),
            borderRadius: radii.pill,
            paddingHorizontal: 6,
            paddingVertical: 1,
          }}
        >
          <TextWidget text="Demo" style={{ fontSize: 11, fontFamily: SANS, color: hex(kleuren.tekstGedimd) }} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

function Melding({ titel, sub, kleuren }: { titel: string; sub: string | null; kleuren: ColorTokens }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
      <TextWidget
        text={titel}
        maxLines={2}
        style={{ fontSize: 14, fontFamily: SANS_KOP, color: hex(kleuren.tekstPrimair) }}
      />
      {sub !== null && (
        <TextWidget
          text={sub}
          maxLines={2}
          style={{ fontSize: 11, fontFamily: SANS, color: hex(kleuren.tekstGedimd), marginTop: 2 }}
        />
      )}
    </FlexWidget>
  );
}

// Het totaal: overline, het R-bedrag groot, eventueel dollars, en een regel eronder.
function Totaal({ stand, bedragen, kleuren, nu, onderregel }: {
  stand: WidgetStand;
  bedragen: boolean;
  kleuren: ColorTokens;
  nu: number;
  onderregel: string;
}) {
  const gedeeltelijk = stand.metKoers < stand.aantalOpen;
  const tijd = `Bijgewerkt ${tijdTekst(stand.tijd, nu)}`;
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
      <TextWidget
        text="OPEN RESULTAAT"
        style={{ fontSize: 10, fontFamily: SANS_KOP, letterSpacing: 0.06, color: hex(kleuren.tekstGedimd) }}
      />
      {stand.totaalR !== null ? (
        <TextWidget
          text={fmtR(stand.totaalR)}
          maxLines={1}
          style={{ fontSize: 26, adjustsFontSizeToFit: true, fontFamily: MONO, color: rKleur(stand.totaalR, kleuren), marginTop: 2 }}
        />
      ) : (
        // Geen enkele positie met een stop onder de instap: zonder stop bestaat R niet.
        <TextWidget
          text="Geen stop"
          maxLines={1}
          style={{ fontSize: 20, fontFamily: SANS_KOP, color: hex(kleuren.letOp), marginTop: 2 }}
        />
      )}
      {bedragen && stand.totaalUsd !== null && (
        <TextWidget
          text={fmtResultaatUsd(stand.totaalUsd, { valuta: 'USD' })}
          maxLines={1}
          style={{ fontSize: 13, fontFamily: MONO, color: hex(kleuren.tekstGedimd) }}
        />
      )}
      <TextWidget
        text={gedeeltelijk ? `${onderregel}, ${stand.metKoers} van ${stand.aantalOpen} met koers` : onderregel}
        maxLines={2}
        style={{ fontSize: 11, fontFamily: SANS, color: hex(kleuren.tekstPrimair), marginTop: spacing.xs }}
      />
      <TextWidget text={tijd} maxLines={1} style={{ fontSize: 11, fontFamily: SANS, color: hex(kleuren.tekstGedimd) }} />
    </FlexWidget>
  );
}

function PositieRij({ p, bedragen, kleuren }: { p: WidgetPositie; bedragen: boolean; kleuren: ColorTokens }) {
  const label = nabijTekst(p);
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget
          text={p.symbool}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 13, fontFamily: SANS_KOP, color: hex(kleuren.tekstPrimair) }}
        />
        {label !== null && (
          <TextWidget text={label} maxLines={1} style={{ fontSize: 11, fontFamily: SANS, color: hex(kleuren.tekstGedimd) }} />
        )}
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
        <TextWidget
          text={p.r !== null ? fmtR(p.r) : 'geen stop'}
          maxLines={1}
          style={{
            fontSize: 13,
            fontFamily: p.r !== null ? MONO : SANS,
            color: p.r !== null ? rKleur(p.r, kleuren) : hex(kleuren.tekstGedimd),
          }}
        />
        {bedragen && p.usd !== null && (
          <TextWidget
            text={fmtResultaatUsd(p.usd, { valuta: 'USD' })}
            maxLines={1}
            style={{ fontSize: 11, fontFamily: MONO, color: hex(kleuren.tekstGedimd) }}
          />
        )}
      </FlexWidget>
    </FlexWidget>
  );
}

export function KaderWidget({ stand, bedragen, breedte, kleuren, nu, uri }: Props) {
  const breed = breedte >= BREED_VANAF;
  const aantal = stand?.aantalOpen ?? 0;

  let inhoud: React.JSX.Element;
  let posities: WidgetPositie[] = [];
  if (stand === null) {
    inhoud = <Melding titel="Open Kader om bij te werken" sub={null} kleuren={kleuren} />;
  } else if (aantal === 0) {
    inhoud = <Melding titel="Geen open posities" sub={`Bijgewerkt ${tijdTekst(stand.tijd, nu)}`} kleuren={kleuren} />;
  } else if (stand.metKoers === 0) {
    inhoud = (
      <Melding
        titel="Open Kader om bij te werken"
        sub={`${aantal} open, nog geen koers`}
        kleuren={kleuren}
      />
    );
  } else {
    posities = stand.posities;
    // Op de smalle widget staat de urgentste positie in de onderregel; op de brede staan ze ernaast.
    const urgent = posities.find(p => p.nabij !== null);
    const telling = `${aantal} open ${aantal === 1 ? 'positie' : 'posities'}`;
    const onderregel = !breed && urgent ? `${urgent.symbool} ${nabijTekst(urgent)}` : telling;
    inhoud = <Totaal stand={stand} bedragen={bedragen} kleuren={kleuren} nu={nu} onderregel={onderregel} />;
  }

  const links = (
    <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'column' }}>
      <Kop stand={stand} kleuren={kleuren} />
      <FlexWidget style={{ flex: 1 }} />
      {inhoud}
    </FlexWidget>
  );

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      accessibilityLabel="Kader, open Portfolio"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        flexDirection: 'row',
        backgroundColor: hex(kleuren.kaart),
        borderRadius: radii.kaart,
        padding: spacing.base,
      }}
    >
      {links}
      {breed && posities.length > 0 && (
        <FlexWidget
          style={{
            flex: 1,
            height: 'match_parent',
            flexDirection: 'column',
            justifyContent: 'center',
            marginLeft: spacing.base,
            paddingLeft: spacing.base,
            borderLeftWidth: 1,
            borderLeftColor: hex(kleuren.rand),
            flexGap: spacing.sm,
          }}
        >
          {posities.map(p => (
            <PositieRij key={p.symbool} p={p} bedragen={bedragen} kleuren={kleuren} />
          ))}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
