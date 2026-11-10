'use no memo';
// De Android-widget op het startscherm: het open resultaat van je portfolio (in procenten, dollars
// of R, naar keuze) of je vermogen, en op de brede versie een paar posities, desgewenst met een baan
// van stop naar doel. Wat hij toont staat in state/widgetWeergave.ts.
//
// Dit is geen gewoon React-component. react-native-android-widget roept de functies hieronder aan
// en zet het resultaat om naar een native widget; hooks werken hier dus niet, en de React Compiler
// mag dit bestand niet herschrijven (vandaar 'use no memo' bovenaan).

import React from 'react';
import { FlexWidget, TextWidget, type HexColor } from 'react-native-android-widget';
import { kiesPosities, type WidgetPositie, type WidgetStand } from '../state/widgetStand';
import type { WidgetWeergave } from '../state/widgetWeergave';
import { fmtPct, fmtR, fmtResultaatUsd } from '../engine/format';
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
  weergave: WidgetWeergave;
  breedte: number;
  kleuren: ColorTokens;
  nu: number;
  uri: string;
}

// Ouder dan dit en de tijd rechtsboven wordt oranje: de cijfers zijn dan niet meer van nu.
const OUD_NA_MS = 2 * 60 * 60 * 1000;
const USD = { valuta: 'USD' } as const;

function hex(kleur: string): HexColor {
  return kleur as HexColor;
}

// Een stand van vóór deze versie mist de nieuwe velden; die tellen dan als onbekend.
function getal(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

function teken(n: number | null, k: ColorTokens, decimalen = 2): HexColor {
  if (n === null) return hex(k.tekstPrimair);
  return hex(Number(n.toFixed(decimalen)) >= 0 ? k.winst : k.verlies);
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

interface Waarde { tekst: string; getal: number | null }

// Het hoofdgetal en de bijzin voor een totaal of een positie. Valt het gekozen hoofdgetal weg
// (geen aantal coins, geen stop), dan het eerstvolgende dat er wel is.
function waarden(
  pct: number | null,
  usd: number | null,
  r: number | null,
  w: WidgetWeergave,
): { hoofd: Waarde; bij: string | null } {
  const opties: Record<'pct' | 'usd' | 'r', Waarde | null> = {
    pct: pct !== null ? { tekst: fmtPct(pct), getal: pct } : null,
    usd: w.bedragen && usd !== null ? { tekst: fmtResultaatUsd(usd, USD), getal: usd } : null,
    r: r !== null ? { tekst: fmtR(r), getal: r } : null,
  };
  const volgorde = [w.hoofdgetal, 'pct', 'usd', 'r'] as const;
  const sleutel = volgorde.find(s => opties[s] !== null);
  if (!sleutel) return { hoofd: { tekst: 'Geen stop', getal: null }, bij: null };
  // De bijzin: procenten en dollars, wat niet al het hoofdgetal is.
  const bij = (['pct', 'usd'] as const).filter(s => s !== sleutel && opties[s] !== null).map(s => opties[s]!.tekst);
  return { hoofd: opties[sleutel]!, bij: bij.length > 0 ? bij.join(' · ') : null };
}

// De tijd staat rechtsboven op de brede widget; op de smalle past hij daar niet naast Demo en staat
// hij in de onderregel.
function Kop({ stand, kleuren, nu, metTijd }: { stand: WidgetStand | null; kleuren: ColorTokens; nu: number; metTijd: boolean }) {
  const oud = stand !== null && nu - stand.tijd > OUD_NA_MS;
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
      <TextWidget text="Kader" style={{ fontSize: 13, fontFamily: SANS_KOP, color: hex(kleuren.primair) }} />
      {stand?.omgeving === 'demo' && (
        <FlexWidget
          style={{
            backgroundColor: hex(kleuren.verhoogd),
            borderRadius: radii.pill,
            paddingHorizontal: 6,
            paddingVertical: 1,
            marginLeft: 6,
          }}
        >
          <TextWidget text="Demo" style={{ fontSize: 11, fontFamily: SANS, color: hex(kleuren.tekstGedimd) }} />
        </FlexWidget>
      )}
      <FlexWidget style={{ flex: 1 }} />
      {stand !== null && metTijd && (
        <TextWidget
          text={tijdTekst(stand.tijd, nu)}
          maxLines={1}
          style={{ fontSize: 11, fontFamily: SANS, color: hex(oud ? kleuren.letOp : kleuren.tekstGedimd) }}
        />
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

function Overline({ tekst, kleuren }: { tekst: string; kleuren: ColorTokens }) {
  return (
    <TextWidget
      text={tekst}
      style={{ fontSize: 10, fontFamily: SANS_KOP, letterSpacing: 0.06, color: hex(kleuren.tekstGedimd) }}
    />
  );
}

// Het open resultaat: overline, het hoofdgetal groot, de bijzin eronder.
function Resultaat({ stand, weergave, kleuren, groot }: {
  stand: WidgetStand;
  weergave: WidgetWeergave;
  kleuren: ColorTokens;
  groot: number;
}) {
  const { hoofd, bij } = waarden(getal(stand.totaalPct), stand.totaalUsd, stand.totaalR, weergave);
  return (
    <FlexWidget style={{ flexDirection: 'column' }}>
      <Overline tekst="OPEN RESULTAAT" kleuren={kleuren} />
      <TextWidget
        text={hoofd.tekst}
        maxLines={1}
        style={{
          fontSize: groot,
          adjustsFontSizeToFit: true,
          fontFamily: hoofd.getal !== null ? MONO : SANS_KOP,
          color: hoofd.getal !== null ? teken(hoofd.getal, kleuren) : hex(kleuren.letOp),
          marginTop: 2,
        }}
      />
      {bij !== null && (
        <TextWidget text={bij} maxLines={1} style={{ fontSize: 13, fontFamily: MONO, color: teken(hoofd.getal, kleuren) }} />
      )}
    </FlexWidget>
  );
}

function Onderregel({ tekst, kleur }: { tekst: string; kleur: HexColor }) {
  return <TextWidget text={tekst} maxLines={2} style={{ fontSize: 11, fontFamily: SANS, color: kleur, marginTop: spacing.xs }} />;
}

const STIP = 8;

// De baan van stop naar doel met een stip op de koers. Twee stukken spoor om een stip heen, want
// een widget kent geen absolute positie, en met een breedte in dp: een flex-verhouding negeert de
// widget.
function Baan({ baan, breedte, kleur, kleuren }: { baan: number; breedte: number; kleur: HexColor; kleuren: ColorTokens }) {
  const spoorBreedte = Math.max(0, breedte - STIP);
  const links = Math.round(spoorBreedte * baan);
  const spoor = { height: 4, backgroundColor: hex(kleuren.rand), borderRadius: 2 } as const;
  return (
    <FlexWidget style={{ width: breedte, height: STIP, flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
      {links > 0 && <FlexWidget style={{ ...spoor, width: links }} />}
      <FlexWidget style={{ width: STIP, height: STIP, borderRadius: STIP / 2, backgroundColor: kleur }} />
      {spoorBreedte - links > 0 && <FlexWidget style={{ ...spoor, width: spoorBreedte - links }} />}
    </FlexWidget>
  );
}

function PositieRij({ p, weergave, kleuren, baanBreedte }: { p: WidgetPositie; weergave: WidgetWeergave; kleuren: ColorTokens; baanBreedte: number }) {
  const { hoofd, bij } = waarden(getal(p.pct), p.usd, p.r, weergave);
  const kleur = hoofd.getal !== null ? teken(hoofd.getal, kleuren) : hex(kleuren.tekstGedimd);
  const label = nabijTekst(p);
  const baan = getal(p.baan);
  if (weergave.balken) {
    return (
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget text={p.symbool} maxLines={1} style={{ fontSize: 12, fontFamily: SANS_KOP, color: hex(kleuren.tekstPrimair) }} />
          <FlexWidget style={{ flex: 1 }} />
          <TextWidget text={hoofd.tekst} maxLines={1} style={{ fontSize: 12, fontFamily: MONO, color: kleur }} />
          {bij !== null && (
            <TextWidget text={` · ${bij}`} maxLines={1} style={{ fontSize: 11, fontFamily: MONO, color: hex(kleuren.tekstGedimd) }} />
          )}
        </FlexWidget>
        {baan !== null
          ? <Baan baan={baan} breedte={baanBreedte} kleur={p.nabij === 'stop' ? hex(kleuren.verlies) : kleur} kleuren={kleuren} />
          : <TextWidget text="geen stop of doel" style={{ fontSize: 10, fontFamily: SANS, color: hex(kleuren.tekstGedimd) }} />}
      </FlexWidget>
    );
  }
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget text={p.symbool} maxLines={1} truncate="END" style={{ fontSize: 13, fontFamily: SANS_KOP, color: hex(kleuren.tekstPrimair) }} />
        {label !== null && (
          <TextWidget
            text={label}
            maxLines={1}
            style={{ fontSize: 11, fontFamily: SANS, color: hex(p.nabij === 'stop' ? kleuren.letOp : kleuren.tekstGedimd) }}
          />
        )}
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
        <TextWidget text={hoofd.tekst} maxLines={1} style={{ fontSize: 13, fontFamily: MONO, color: kleur }} />
        {bij !== null && (
          <TextWidget text={bij} maxLines={1} style={{ fontSize: 11, fontFamily: MONO, color: hex(kleuren.tekstGedimd) }} />
        )}
      </FlexWidget>
    </FlexWidget>
  );
}

function Posities({ posities, weergave, kleuren, breedte }: { posities: WidgetPositie[]; weergave: WidgetWeergave; kleuren: ColorTokens; breedte: number }) {
  // Een vaste breedte voor de rechterkolom (de helft van wat binnen de rand en de marge overblijft),
  // zodat de balk precies past: binnenrand en scheidingslijn gaan eraf, plus twee dp speling.
  const kolom = Math.floor((breedte - 3 * spacing.base) / 2);
  const baanBreedte = Math.max(40, kolom - spacing.base - 1 - 2);
  return (
    <FlexWidget
      style={{
        width: kolom,
        height: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        marginLeft: spacing.base,
        paddingLeft: spacing.base,
        borderLeftWidth: 1,
        borderLeftColor: hex(kleuren.rand),
        flexGap: weergave.balken ? 6 : spacing.sm,
      }}
    >
      {posities.map(p => <PositieRij key={p.symbool} p={p} weergave={weergave} kleuren={kleuren} baanBreedte={baanBreedte} />)}
      {weergave.balken && posities.length < 4 && (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row' }}>
          <TextWidget text="stop" style={{ fontSize: 10, fontFamily: SANS, color: hex(kleuren.tekstGedimd) }} />
          <FlexWidget style={{ flex: 1 }} />
          <TextWidget text="doel" style={{ fontSize: 10, fontFamily: SANS, color: hex(kleuren.tekstGedimd) }} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

// Indeling Vermogen: het vermogen groot, het open resultaat in dollars en procenten eronder.
function Vermogen({ stand, vermogen, kleuren, breed, posities, nu }: {
  stand: WidgetStand;
  vermogen: number;
  kleuren: ColorTokens;
  breed: boolean;
  posities: WidgetPositie[];
  nu: number;
}) {
  const pct = getal(stand.totaalPct);
  const delen = [
    stand.totaalUsd !== null ? fmtResultaatUsd(stand.totaalUsd, USD) : null,
    pct !== null ? fmtPct(pct) : null,
  ].filter((x): x is string => x !== null);
  const kleur = teken(stand.totaalUsd ?? pct, kleuren);
  const bedrag = `$${Math.round(vermogen).toLocaleString('en-US')}`;
  if (!breed) {
    return (
      <FlexWidget style={{ flexDirection: 'column' }}>
        <Overline tekst="VERMOGEN" kleuren={kleuren} />
        <TextWidget text={bedrag} maxLines={1} style={{ fontSize: 24, adjustsFontSizeToFit: true, fontFamily: MONO, color: hex(kleuren.tekstPrimair), marginTop: 2 }} />
        {delen.length > 0 && (
          <TextWidget text={delen.join(' · ')} maxLines={1} style={{ fontSize: 13, fontFamily: MONO, color: kleur, marginTop: spacing.xs }} />
        )}
        <TextWidget text={`open resultaat · ${tijdTekst(stand.tijd, nu)}`} maxLines={1} style={{ fontSize: 11, fontFamily: SANS, color: hex(nu - stand.tijd > OUD_NA_MS ? kleuren.letOp : kleuren.tekstGedimd) }} />
      </FlexWidget>
    );
  }
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row' }}>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <Overline tekst="VERMOGEN" kleuren={kleuren} />
          <TextWidget text={bedrag} maxLines={1} style={{ fontSize: 24, adjustsFontSizeToFit: true, fontFamily: MONO, color: hex(kleuren.tekstPrimair) }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <Overline tekst="OPEN" kleuren={kleuren} />
          <TextWidget text={pct !== null ? fmtPct(pct) : 'onbekend'} maxLines={1} style={{ fontSize: 24, fontFamily: MONO, color: kleur }} />
          {stand.totaalUsd !== null && (
            <TextWidget text={fmtResultaatUsd(stand.totaalUsd, USD)} maxLines={1} style={{ fontSize: 12, fontFamily: MONO, color: kleur }} />
          )}
        </FlexWidget>
      </FlexWidget>
      {posities.length > 0 && (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', flexGap: 6, marginTop: spacing.sm }}>
          {posities.map(p => {
            const pp = getal(p.pct);
            return (
              <FlexWidget
                key={p.symbool}
                style={{ flex: 1, flexDirection: 'row', backgroundColor: hex(kleuren.verhoogd), borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 }}
              >
                <TextWidget text={`${p.symbool} `} maxLines={1} style={{ fontSize: 12, fontFamily: MONO, color: hex(kleuren.tekstPrimair) }} />
                {pp !== null && <TextWidget text={fmtPct(pp)} maxLines={1} style={{ fontSize: 12, fontFamily: MONO, color: teken(pp, kleuren) }} />}
              </FlexWidget>
            );
          })}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

export function KaderWidget({ stand, weergave, breedte, kleuren, nu, uri }: Props) {
  const breed = breedte >= BREED_VANAF;
  const aantal = stand?.aantalOpen ?? 0;
  const vermogen = weergave.indeling === 'vermogen' && weergave.bedragen ? getal(stand?.vermogen) : null;

  let inhoud: React.JSX.Element;
  let posities: WidgetPositie[] = [];
  let volleBreedte = false;
  if (stand === null) {
    inhoud = <Melding titel="Open Kader om bij te werken" sub={null} kleuren={kleuren} />;
  } else if (aantal === 0) {
    inhoud = vermogen !== null
      ? <Vermogen stand={stand} vermogen={vermogen} kleuren={kleuren} breed={false} posities={[]} nu={nu} />
      : <Melding titel="Geen open posities" sub={null} kleuren={kleuren} />;
  } else if (stand.metKoers === 0) {
    inhoud = <Melding titel="Open Kader om bij te werken" sub={`${aantal} open, nog geen koers`} kleuren={kleuren} />;
  } else {
    posities = kiesPosities(stand.posities, weergave.volgorde, weergave.aantal);
    const gedeeltelijk = stand.metKoers < stand.aantalOpen;
    const telling = `${aantal} open${gedeeltelijk ? `, ${stand.metKoers} met koers` : ''}`;
    if (vermogen !== null) {
      volleBreedte = breed;
      inhoud = <Vermogen stand={stand} vermogen={vermogen} kleuren={kleuren} breed={breed} posities={posities.slice(0, 3)} nu={nu} />;
    } else {
      // Op de smalle widget staat de urgentste positie in de onderregel; op de brede staan ze ernaast.
      const urgent = stand.posities.find(p => p.nabij !== null);
      const onder = !breed && urgent
        ? <Onderregel tekst={`${urgent.symbool} ${nabijTekst(urgent)}`} kleur={hex(urgent.nabij === 'stop' ? kleuren.letOp : kleuren.tekstPrimair)} />
        : <Onderregel tekst={telling} kleur={hex(kleuren.tekstGedimd)} />;
      const tijd = !breed
        ? <TextWidget text={tijdTekst(stand.tijd, nu)} maxLines={1} style={{ fontSize: 11, fontFamily: SANS, color: hex(nu - stand.tijd > OUD_NA_MS ? kleuren.letOp : kleuren.tekstGedimd) }} />
        : null;
      inhoud = (
        <FlexWidget style={{ flexDirection: 'column' }}>
          <Resultaat stand={stand} weergave={weergave} kleuren={kleuren} groot={28} />
          {onder}
          {tijd}
        </FlexWidget>
      );
    }
  }

  const links = (
    <FlexWidget style={{ flex: 1, height: 'match_parent', flexDirection: 'column' }}>
      <Kop stand={stand} kleuren={kleuren} nu={nu} metTijd={breed} />
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
      {breed && !volleBreedte && posities.length > 0 && <Posities posities={posities} weergave={weergave} kleuren={kleuren} breedte={breedte} />}
    </FlexWidget>
  );
}
