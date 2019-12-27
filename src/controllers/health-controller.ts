// tslint:disable-next-line
const { version } = require('../../package.json');

import { Request, Response } from 'express';

export class HealthController {
  public getAll = (req: Request, res: Response) => {
    return res.status(200).json({
      status: 'ok',
      apiVersion: version,
      services: {
        googleTTS: null,
        awsPolly: null
      },
      messages: {
        googleTTS: null,
        awsPolly: null
      }
    });
  }
};
