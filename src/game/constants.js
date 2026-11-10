/*
 * Spielfeld und Konstanten.
 * Die Spielmechanik ist eine Portierung von Ballerburg (C) 1987, 1989 Eckhard Kruse
 * und der SDL-Fassung (C) 2010, 2015 Thomas Huth, veröffentlicht unter der GNU GPL v3.
 * Das Spielfeld nutzt wie das Original 640x400 Bildpunkte, damit alle Formeln unverändert gelten.
 */

export const W = 640;
export const H = 400;
/** Burgfehde: the stage is drawn at this multiple of the 640×400 world, so round shapes look smooth. */
export const RES = 3;
export const CELL = 4;
export const COLS = 32;
/** Default ground level when no terrain is given (the original picks 300..379 per castle). */
export const GROUND = 340;

/** Original: G in baller1.h (gravity per flight step, "g/500"). */
export const G = 0.02;
/** Flight steps per second. The original waits ~8 ms per step plus drawing time. */
export const STEPS_PER_SECOND = 110;
/** Original: cannoneer.c clamps the dialog to these ranges. */
export const ANGLE_MAX = 180;
export const POWDER_MIN = 5;
export const POWDER_MAX = 20;
export const DEFAULT_AIM = { angle: 45, powder: 12 };

/** Pixel sizes [w, h] of the castle objects in Burgfehde's own graphics. */
export const SIZES = {
  king: [12, 16],
  cannon: [12, 8],
  powder: [12, 12],
  balls: [12, 8],
  gold: [8, 8],
  vane: [4, 20],
  mine: [16, 24],
};

export const AIR = 0;
export const EARTH = 1;
/** BRICK + side index (2 = left, 3 = right) */
export const BRICK = 2;
