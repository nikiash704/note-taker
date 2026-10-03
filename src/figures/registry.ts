// Every figure command, in cheat-sheet order.

import type { FigureCommand } from './types';
import { GRAPH_COMMANDS } from './graphs';
import { CURVE_COMMANDS } from './curves';
import { REGION_COMMANDS } from './regions';
import { signchart } from './signchart';
import { MULTIVAR_COMMANDS } from './multivar';
import { LINALG_COMMANDS } from './linalg';
import { DIFFEQ_COMMANDS } from './diffeq';
import { axes, vec } from './plane';
import { triangle } from './triangle';
import { interval } from './interval';
import { diagram } from './diagram';

export const ALL_COMMANDS: FigureCommand[] = [
  ...GRAPH_COMMANDS, ...CURVE_COMMANDS, signchart, axes, interval,
  ...REGION_COMMANDS,
  ...MULTIVAR_COMMANDS,
  vec, ...LINALG_COMMANDS,
  ...DIFFEQ_COMMANDS,
  triangle,
  diagram,
];
