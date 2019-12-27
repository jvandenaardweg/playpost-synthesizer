// tslint:disable-next-line
const { version } = require('../package.json');

import Integrations from '@sentry/integrations';
import Sentry from '@sentry/node';

Sentry.init({
  dsn: 'https://a0e2345286da4af19959547590f85964@sentry.io/1864632',
  enabled: process.env.NODE_ENV === 'production', // Do not run on your local machine
  environment: process.env.NODE_ENV,
  integrations: [
    new Integrations.RewriteFrames({
      root: __dirname
    })
  ],
  release: version ? version : undefined,
});

export { Sentry }
