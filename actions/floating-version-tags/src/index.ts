import { setFailed } from '@actions/core';
import { stringifyError } from '@simbo/stringify-error';

import { main } from './main.js';

try {
  await main();
} catch (error) {
  setFailed(stringifyError(error));
}
