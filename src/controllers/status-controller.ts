import { Request, Response } from 'express';

export class StatusController {
  getAll = (req: Request, res: Response) => {
    return res.status(200).json({ message: 'OK' });
  }
}
