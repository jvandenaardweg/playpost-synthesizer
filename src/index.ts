console.time('Startup Time');
console.log('App init: Start!');
require('@google-cloud/trace-agent').start();

// tslint:disable-next-line
const { version } = require('../package.json');

import { Sentry } from './sentry';
import { setupServer } from './server';

console.log('App init:', 'Release version:', version);

console.log('App init:', 'Sentry setup!', Sentry.SDK_VERSION);

async function bootstrap() {
  try {
    const app = await setupServer();
    return app;
  } catch (err) {
    console.error('Error during setup', err.message);
    return Sentry.captureException(err);
  } finally {
    console.log('App init: Complete!');
    console.timeEnd('Startup Time');
  }

}

// tslint:disable-next-line: no-floating-promises
bootstrap();
