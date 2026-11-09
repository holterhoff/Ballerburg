export const AI_PROFILES = [
  { id: 'kurt', name: 'Knappe Kurt', level: 1, desc: 'Zielt mit Begeisterung, trifft mit Glück.' },
  { id: 'grimm', name: 'Gräfin Grimm', level: 2, desc: 'Solide Schützin, spart gern.' },
  { id: 'bombast', name: 'Baron Bombast', level: 3, desc: 'Rüstet auf und schießt präzise.' },
  { id: 'erna', name: 'Die Eiserne Erna', level: 4, desc: 'Rechnet jede Flugbahn durch.' },
];

export const profileById = (id) => AI_PROFILES.find((p) => p.id === id) || AI_PROFILES[1];
