import * as migration_20261017_160636_initial from './20261017_160636_initial';

export const migrations = [
  {
    up: migration_20261017_160636_initial.up,
    down: migration_20261017_160636_initial.down,
    name: '20261017_160636_initial'
  },
];
