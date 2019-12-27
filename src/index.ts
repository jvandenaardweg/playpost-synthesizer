console.time('Startup Time');
console.log('App init: Start!');
require('cache-require-paths');
require('@google-cloud/trace-agent').start();

console.log('App init: Require package.json...');
// tslint:disable-next-line
const { version } = require('../package.json');

console.log('App init: Import Sentry...');
import { Sentry } from './sentry';

console.log('App init: Import setupServer...');
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
