// tslint:disable-next-line
const { version } = require('../package.json');

import express, { NextFunction, Request, Response } from 'express';

import { Sentry } from './sentry';
console.log('App init: Import synthesize controller...');
import { SynthesizerController } from './controllers/synthesize-controller';
console.log('App init: Import health controller...');
import { HealthController } from './controllers/health-controller';
console.log('App init: Import status controller...');
import { StatusController } from './controllers/status-controller';

export const setupServer = async () => {
  console.log('App init:', 'Server setup...');

  // Check required env vars
  if (!process.env.NODE_ENV) {
    throw new Error('Required environment variable "NODE_ENV" not set.');
  }
  if (!process.env.ACCESS_TOKEN) {
    throw new Error('Required environment variable "ACCESS_TOKEN" not set.');
  }
  if (!process.env.AWS_ACCESS_KEY_ID) {
    throw new Error('Required environment variable "AWS_ACCESS_KEY_ID" not set.');
  }
  if (!process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('Required environment variable "AWS_SECRET_ACCESS_KEY" not set.');
  }
  if (!process.env.AWS_USER) {
    throw new Error('Required environment variable "AWS_USER" not set.');
  }

  const PORT = process.env.PORT || 3000;

  const app: express.Application = express();

  // Send API version information
  app.use((req, res, next) => {
    res.append('X-API-Version', version);
    next();
  });

  app.use(Sentry.Handlers.requestHandler() as express.RequestHandler);
  app.use(Sentry.Handlers.errorHandler() as express.ErrorRequestHandler);

  console.log('App init: Importing controllers...');

  const synthesizerController = new SynthesizerController();
  const healthController = new HealthController();
  const statusController = new StatusController();

  console.log('App init: Controllers imported!');

  app.use(express.json());

  app.get('/v1/synthesize/:synthesizerName/voices', [synthesizerController.authorize, synthesizerController.validateSynthesizerName], synthesizerController.getAllVoices);
  app.post('/v1/synthesize/:synthesizerName/:action', [synthesizerController.authorize, synthesizerController.validateSynthesizerName], synthesizerController.postSynthesize);


  app.get('/status', healthController.getAll);
  app.get('/health', statusController.getAll);

  // Catch all
  // Should be the last route
  app.all('*', (req: Request, res: Response) => {
      return res.status(404).send('Not found.');
  });

  // Handle error exceptions
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err) {
      const statusCode = err.status ? err.status : err.statusCode ? err.statusCode : 500;

      // We do not want to track al error types
      // General Bad Request status codes is not something we want to see
      if ([400, 404].includes(statusCode)) {
        // Sentry error tracking is only enabled in NODE_ENV production
        Sentry.configureScope(scope => {
          if (statusCode === 500) {
            scope.setLevel(Sentry.Severity.Critical);
          }

          Sentry.captureException(err);
        });
      }

      // If we have a status code, use our custom error response
      if (statusCode) {
        return res.status(statusCode).json({
          status: statusCode ? statusCode : undefined,
          message: err.message ? err.message : 'An unexpected error occurred. Please try again or contact us when this happens again.',
          details: err.details ? err.details : undefined
        });
      }
    }

    return next(err);
  });

  app.listen(PORT, () => {
    console.log(`App init: Listening on port ${PORT}.`);
    console.log('App init: Ready!');
  });

  return app;
};
