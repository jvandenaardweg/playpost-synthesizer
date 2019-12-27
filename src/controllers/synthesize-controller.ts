import { Request, Response } from 'express';
import { Sentry } from '../sentry';

console.log('App init: synthesize-controller.ts ../synthesizers/google');
import { GoogleSynthesizer } from '../synthesizers/google';
console.log('App init: synthesize-controller.ts ../synthesizers/aws');
import { AWSSynthesizer } from '../synthesizers/aws';
console.log('App init: synthesize-controller.ts ../storage/google-cloud-storage');
import { AvailableBucketName } from '../storage/google-cloud-storage';

interface RequestBody {
  action: 'upload' | 'preview',
  synthesizerName: 'google' | 'aws',
  voiceSsmlGender: 'FEMALE' | 'MALE',
  voiceName: string;
  voiceLanguageCode: string;
  ssml: string;
  bucketName: AvailableBucketName;
  bucketUploadDestination: string;
}

export class SynthesizerController {
  public synthesize = async (req: Request, res: Response) => {
    const authorization = req.header('Authorization');
    const { synthesizerName } = req.params;
    const { action, voiceSsmlGender, voiceName, voiceLanguageCode, ssml, bucketName, bucketUploadDestination } = req.body as RequestBody;

    console.log('req.body', JSON.stringify(req.body));

    if (!authorization) {
      const message = 'No access.';
      Sentry.captureMessage(message, Sentry.Severity.Critical);
      return res.status(403).json({ message });
    }

    if (authorization !== `Bearer ${process.env.ACCESS_TOKEN}`) {
      const message = 'Authorization bearer is invalid.';
      Sentry.captureMessage(message, Sentry.Severity.Critical);
      return res.status(403).json({ message });
    }

    if (!['google', 'aws'].includes(synthesizerName)) {
      const message = '"synthesizerName" must be "google" or "aws".';
      Sentry.captureMessage(message, Sentry.Severity.Log);
      return res.status(400).json({ message });
    }

    if (!['FEMALE', 'MALE'].includes(voiceSsmlGender)) {
      const message = '"voiceSsmlGender" must be "MALE" or "FEMALE".';
      Sentry.captureMessage(message, Sentry.Severity.Log);
      return res.status(400).json({ message });
    }

    if (!voiceName) {
      const message = '"voiceName" is required.';
      Sentry.captureMessage(message, Sentry.Severity.Log);
      return res.status(400).json({ message });
    }

    if (!voiceLanguageCode) {
      const message = '"voiceLanguageCode" is required.';
      Sentry.captureMessage(message, Sentry.Severity.Log);
      return res.status(400).json({ message });
    }

    if (!ssml) {
      const message = '"ssml" is required.';
      Sentry.captureMessage(message, Sentry.Severity.Log);
      return res.status(400).json({ message });
    }

    if (!['preview', 'upload'].includes(action)) {
      const message = '"action" param must be "preview" or "upload".';
      Sentry.captureMessage(message, Sentry.Severity.Log);
      return res.status(400).json({ message });
    }

    // Create the correct synthesizer class with the correct options
    const synthesizer =
      synthesizerName === 'google'
      ? new GoogleSynthesizer({
        audioEncoding: 2, // MP3
        ssml,
        voiceLanguageCode,
        voiceName,
        voiceSsmlGender: (voiceSsmlGender === 'MALE') ? 1 : (voiceSsmlGender === 'FEMALE') ? 2 : 0
      })
      : new AWSSynthesizer({
        audioEncoding: 'mp3',
        ssml,
        voiceLanguageCode,
        voiceName
      });

    // Just return the audiocontents to stream
    if (action === 'preview') {
      try {
        const result = await synthesizer.preview();
        return res.json({ audio: result });
      } catch (err) {
        Sentry.captureException(err);
        return res.status(500).json({
          message: err && err.message || 'Unknown error while synthesizing your preview request.'
        });
      }
    }

    // Upload the synthesize result to a bucket
    if (action === 'upload') {
      if (!bucketName) {
        const message = '"bucketName" is required';
        Sentry.captureMessage(message, Sentry.Severity.Log);
        return res.status(400).json({ message });
      }

      if (!bucketUploadDestination) {
        const message = '"bucketUploadDestination" is required';
        Sentry.captureMessage(message, Sentry.Severity.Log);
        return res.status(400).json({ message });
      }

      try {
        const result = await synthesizer.upload(bucketName, bucketUploadDestination);

        return res.json(result);
      } catch (err) {
        Sentry.captureException(err);
        return res.status(500).json({
          message: err && err.message || 'Unknown error while synthesizing your upload request.'
        })
      }
    }

    // We should not end up here
    const errorMessage = 'Invalid request.';
    Sentry.captureMessage(errorMessage, Sentry.Severity.Critical);
    return res.status(400).json({ message: errorMessage });
  }
}
