import { Request, Response } from 'express';
import { Sentry } from '../sentry';

console.log('App init: synthesize-controller.ts ../storage/google-cloud-storage');
import { AvailableBucketName } from '../storage/google-cloud-storage';
import { AllowedOutputFileExtension } from '../synthesizers';

interface RequestBody {
  voiceSsmlGender: 'FEMALE' | 'MALE',
  outputFormat: AllowedOutputFileExtension;
  voiceName: string;
  voiceLanguageCode: string;
  ssml: string;
  bucketName: AvailableBucketName;
  bucketUploadDestination: string;
}

interface RequestParams {
  action: 'upload' | 'preview';
  synthesizerName: 'google' | 'aws';
}

export class SynthesizerController {
  public synthesize = async (req: Request, res: Response) => {
    const authorization = req.header('Authorization');
    const { synthesizerName, action } = req.params as unknown as RequestParams;
    const { voiceSsmlGender, voiceName, voiceLanguageCode, ssml, bucketName, bucketUploadDestination, outputFormat } = req.body as RequestBody;

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

    if (!['mp3', 'wav'].includes(outputFormat)) {
      const message = '"outputFormat" must be "mp3" or "wav".';
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

    let synthesizer: any;

    // Create the correct synthesizer class with the correct options
    if (synthesizerName === 'google') {
      const { GoogleSynthesizer } = require('../synthesizers/google');

      const audioEncoding = outputFormat === 'wav' ? 1 : 2; // 2 = MP3, 1 = LINEAR16

      synthesizer = new GoogleSynthesizer(
        outputFormat,
        {
          audioEncoding,
          ssml,
          voiceLanguageCode,
          voiceName,
          voiceSsmlGender: (voiceSsmlGender === 'MALE') ? 1 : (voiceSsmlGender === 'FEMALE') ? 2 : 0
        }
      );
    } else {
      const { AWSSynthesizer } = require('../synthesizers/aws');

      const audioEncoding = outputFormat === 'wav' ? 'pcm' : 'mp3';

      synthesizer = new AWSSynthesizer(
        outputFormat,
        {
          audioEncoding,
          ssml,
          voiceLanguageCode,
          voiceName
        }
      );
    }

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
