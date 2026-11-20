/**
 * Kleine Pixel-Icons für Markt und Schatzkammer (Vorschlag von Leni): Kinder sehen auf einen Blick,
 * was sie kaufen. Jedes Icon ist ein 12 × 12-Raster; '.' bleibt durchsichtig.
 */
const COLORS = {
  K: '#111', W: '#fff', Y: '#e3b45a', y: '#a8782a', B: '#c9a26b', b: '#8a6a3e', G: '#8a8a8a', g: '#d6d6d6',
  N: '#7a4b2a', S: '#e8b98a', R: '#b8322a', P: '#3a5a9a', C: '#2f4a2c',
};

const PIXELS = {
  money: [
    '............', '...KKKKKK...', '..KYYYYYYK..', '..KyyyyyyK..', '...KKKKKK...', '..KYYYYYYK..',
    '..KyyyyyyK..', '...KKKKKK...', '..KYYYYYYK..', '..KyyyyyyK..', '...KKKKKK...', '............',
  ],
  stones: [
    '............', 'KKKKKKKKKKKK', 'KBBBBKBBBBBK', 'KBbbbKBbbbbK', 'KKKKKKKKKKKK', 'KBBKBBBBKBBK',
    'KBbKBbbbKBbK', 'KKKKKKKKKKKK', 'KBBBBKBBBBBK', 'KBbbbKBbbbbK', 'KKKKKKKKKKKK', '............',
  ],
  mine: [
    '....KKKK....', '...KGggGK...', '...KgKKgK...', '...KGggGK...', '....KKKK....', '....K..K....',
    '...K.KK.K...', '...K.KK.K...', '..K..KK..K..', '..K..KK..K..', '.KKKKKKKKKK.', '.KYYyYYyYYK.',
  ],
  cannon: [
    '............', '..........K.', '........KKGK', '......KKGGK.', '....KKGGGK..', '..KKGGGGK...',
    '.KGGGGGK....', '.KGGKKK.....', '..KKNNNK....', '..KNNKNNK...', '..KNKKKNK...', '...KKKKK....',
  ],
  vane: [
    '....K.......', '....KKKKK...', '....KRRRRK..', '....KRRRRRK.', '....KRRRRK..', '....KKKKK...',
    '....K.......', '....K.......', '....K.......', '....K.......', '....K.......', '...KKK......',
  ],
  powder: [
    '............', '...KKKKKK...', '..KNNNNNNK..', '..KKKKKKKK..', '.KNNNNNNNNK.', '.KNNKKKKNNK.',
    '.KKKKKKKKKK.', '.KNNNNNNNNK.', '.KNNNNNNNNK.', '..KKKKKKKK..', '..KNNNNNNK..', '...KKKKKK...',
  ],
  balls: [
    '............', '...KKKK.....', '..KGgGGK....', '.KGgGGGGK...', '.KGGGGGGK...', '.KGGGGGGK...',
    '..KGGGGKKKK.', '...KKKKGgGGK', '......KGGGGK', '......KGGGGK', '.......KKKK.', '............',
  ],
  guard: [
    '.........K..', '........KGK.', '...KKK...K..', '..KGGGK..K..', '..KGGGK..K..', '..KKKKK..K..',
    '..KSSSK..K..', '...KKK...K..', '..KPPPKKKK..', '.KPPPPPK.K..', '.KPPPPPK.K..', '..KK.KK..K..',
  ],
  spy: [
    '....KKK.....', '...KCCCK....', '..KCCCCCK...', '..KCKKKCK...', '..KCKSKCK...', '..KCCCCCK...',
    '.KCCCCCCCK..', '.KCCCCCCCKRK', '.KCCCCCCCKRK', '..KCCCCCK.K.', '..KCK.KCK...', '..KK...KK...',
  ],
  repair: [
    '............', '...KKKKK....', '..KGGGGGK...', '..KGgggGKK..', '...KKKKKNNK.', '.......KNNK.',
    '......KNNK..', '.....KNNK...', '....KNNK....', '...KNNK.....', '...KNK......', '....K.......',
  ],
  pop: [
    '............', '..KK....KK..', '.KSSK..KSSK.', '.KSSK..KSSK.', '..KK....KK..', '.KRRK..KPPK.',
    'KRRRRKKPPPPK', 'KRRRRKKPPPPK', 'KRRRRKKPPPPK', '.KRRK..KPPK.', '.KKKK..KKKK.', '............',
  ],
  tax: [
    '............', '..KKKKKKKK..', '.KWWWWWWWWK.', '.KWKKWWWKWK.', '.KWKKWWKWWK.', '.KWWWWKWWWK.',
    '.KWWWKWWWWK.', '.KWWKWWKKWK.', '.KWKWWWKKWK.', '.KWWWWWWWWK.', '..KKKKKKKK..', '............',
  ],
};

export function MarketIcon({ name, size = 24 }) {
  const rows = PIXELS[name];
  if (!rows) return null;
  const rects = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== '.') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={COLORS[c]} />);
  }));
  return (
    <svg className="market-icon" width={size} height={size} viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
      {rects}
    </svg>
  );
}

/** Kurze Erklärungen für Kinder: wofür ist das gut? */
export function marketInfo(key, p) {
  const texts = {
    money: `Dein Geld, die Taler. Damit kaufst du im Markt ein. Jede Runde kommt neues Geld aus Steuern und Fördertürmen. Die Schatzkammer fasst ${p.caps.money} Taler, mehr geht nicht hinein.`,
    pop: 'Das Volk wohnt in deiner Burg und zahlt Steuern. Trifft eine Kugel die Burg, kann es Leute erwischen. Hat deine Burg kein Volk mehr, hast du verloren.',
    tax: 'Hohe Steuern bringen mehr Geld, aber dann zieht das Volk weg. Bei niedrigen Steuern wächst das Volk. Mit den Pfeilen stellst du die Steuern ein.',
    stones: 'Du bekommst 20 Steine. Damit baust du Mauern höher oder flickst Löcher. Male die Steine mit Finger oder Maus an Mauer oder Boden.',
    mine: 'Ein Förderturm holt jede Runde Gold aus dem Berg, etwa 40 bis 70 Taler. Je mehr Türme, desto reicher wird deine Burg. Kugeln können ihn beschädigen oder zerstören.',
    cannon: 'Mit einem Geschütz schießt du auf die andere Burg. Jeder Schuss braucht eine Kugel und Pulver. Hast du mehrere Geschütze, bleibt dir eins, wenn ein anderes zerstört wird.',
    vane: 'Die Windfahne zeigt dir, woher der Wind weht und wie stark er ist. Der Wind lenkt deine Kugeln ab. Ohne Windfahne siehst du ihn nicht und musst raten.',
    powder: `Pulver brauchst du für jeden Schuss. Je mehr Pulver, desto weiter fliegt die Kugel. Du bekommst 30 Pulver. Dein Pulverlager fasst ${p.caps.powder}.`,
    balls: `Jeder Schuss braucht eine Kugel. Du bekommst 2 Kugeln. Dein Kugellager fasst ${p.caps.balls}.`,
    guard: 'Die Burgwache steht vor deinem Tor. Will der Räuber dein Gold stehlen, fängt sie ihn, und du bekommst seinen ganzen Geldsack. Danach geht die Wache nach Hause.',
    spy: 'Der Spion schleicht über den Berg zur anderen Burg und sprengt dort einen Förderturm. Er braucht ein paar Runden. Der Gegner kann ihn unterwegs abschießen.',
    repair: 'Repariert einen beschädigten oder gesprengten Förderturm, dann fördert er wieder Gold. Kostet die Hälfte von einem neuen Turm.',
  };
  return texts[key] || '';
}
