// Every figure command, in cheat-sheet order.

import type { FigureCommand } from './types';
import { GRAPH_COMMANDS } from './graphs';
import { CURVE_COMMANDS } from './curves';
import { REGION_COMMANDS } from './regions';
import { signchart } from './signchart';
import { axes, vec } from './plane';
import { triangle } from './triangle';
import { interval } from './interval';
import { diagram } from './diagram';

export const ALL_COMMANDS: FigureCommand[] = [
  ...GRAPH_COMMANDS, ...CURVE_COMMANDS, signchart, axes, interval,
  ...REGION_COMMANDS,
  vec,
  triangle,
  diagram,
];
