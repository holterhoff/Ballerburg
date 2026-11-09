export const W = 640;
export const H = 360;
export const CELL = 4;
export const COLS = 32;
export const GROUND = 316;

export const GRAVITY = 60;
export const WIND_ACC = 1.5;
export const MAX_WIND = 15;
export const SPEED_PER_POWDER = 14.5;
export const MAX_POWDER = 20;
export const DEFAULT_POWDER = 12;
export const TIME_SCALE = 2.6;
export const SUBSTEP = 1 / 120;

/** x-range [from, to) each side may build in */
export const HOME = [
  [0, 176],
  [464, 640],
];

/** pixel sizes [w, h] of castle objects */
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
