import * as migration_20261017_160636_initial from './20261017_160636_initial';
import * as migration_20261022_175938_nestwell_listings from './20261022_175938_nestwell_listings';

export const migrations = [
  {
    up: migration_20261017_160636_initial.up,
    down: migration_20261017_160636_initial.down,
    name: '20261017_160636_initial',
  },
  {
    up: migration_20261022_175938_nestwell_listings.up,
    down: migration_20261022_175938_nestwell_listings.down,
    name: '20261022_175938_nestwell_listings'
  },
];
