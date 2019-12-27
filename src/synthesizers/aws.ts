console.log('App init: aws.ts import aws-sdk');
// import AWS from 'aws-sdk';
console.log('App init: aws.ts ./index');
import { BaseSynthesizer, SynthesizeOptionsAWS, SynthesizeUploadResponse } from './index';
console.log('App init: aws.ts ../storage/google-cloud-storage');
import { AvailableBucketName } from '../storage/google-cloud-storage';
console.log('App init: aws.ts ../utils/ssml');
import { AWS_CHARACTER_SOFT_LIMIT, AWS_CHARACTER_HARD_LIMIT } from '../utils/ssml';

export class AWSSynthesizer extends BaseSynthesizer {
  private readonly client: AWS.Polly;
  private readonly options: SynthesizeOptionsAWS;

  constructor(options: SynthesizeOptionsAWS) {
    super(
      AWS_CHARACTER_HARD_LIMIT,
      AWS_CHARACTER_SOFT_LIMIT
    );

    // Required environment variables:
    // AWS_ACCESS_KEY_ID
    // AWS_SECRET_ACCESS_KEY
    // AWS_USER
    const AWS = require('aws-sdk');
    // Make sure the environment variables are set up in the function.

    AWS.config.update({ region: 'eu-west-1' });

    this.client = new AWS.Polly({
      signatureVersion: 'v4',
      region: 'eu-west-1'
    });

    this.options = options;

    console.log('Synthesizer options:', JSON.stringify(this.options));
  }

  public synthesize = async (options: SynthesizeOptionsAWS): Promise<AWS.Polly.SynthesizeSpeechOutput> => {
    return new Promise((resolve, reject) => {
      const speechRequestOptions: AWS.Polly.SynthesizeSpeechInput = {
        OutputFormat: options.audioEncoding,
        Text: options.ssml,
        VoiceId: options.voiceName,
        LanguageCode: options.voiceLanguageCode,
        TextType: 'ssml'
      }

      console.log('Synthesize using: ', JSON.stringify(speechRequestOptions));

      return this.client.synthesizeSpeech(speechRequestOptions, async (err, response) => {
        if (err) {
          reject(err);
        }
        resolve(response);
      });
    });
  }

  public preview = async (): Promise<string> => {
    const response = await this.synthesize(this.options);

    if (!response.AudioStream) {
      throw new Error('AudioStream not in response.');
    }

    // Return the AudioStream as a base64 buffer, which applications can use
    return response.AudioStream.toString('base64');
  }

  public upload = async (bucketName: AvailableBucketName, bucketUploadDestination: string): Promise<SynthesizeUploadResponse> => {
    try {
      const ssmlParts = this.getSSMLParts(this.options.ssml);
      console.log('ssmlParts: ', ssmlParts.length, JSON.stringify(ssmlParts));

      console.log('bucketUploadDestination: ', bucketUploadDestination);

      console.log('Synthesizing...');
      // Create a request for each SSML part
      const promises = ssmlParts.map((ssmlPart) => {
        return this.synthesize({
          ...this.options,
          ssml: ssmlPart // overwrite the ssml with the new ssml part
        })
      });

      const results = await Promise.all(promises);
      console.log('synethesize results: ', results.length);

      // Save the temporary files
      const saveTempFiles = results.map((result, index) => {
        return this.saveTempFile(this.sessionId, index, result.AudioStream);
      })

      const tempFiles = await Promise.all(saveTempFiles);
      console.log('tempFiles: ', JSON.stringify(tempFiles));

      const concatinatedAudiofilePath = await this.getConcatinatedAudiofilePath(tempFiles);
      console.log('concatinatedAudiofilePath: ', concatinatedAudiofilePath);

      console.log('Uploading...');

      // Run these 2 in parallel, is faster
      const [audiofileMetadata, uploadResponse] = await Promise.all([
        this.getAudiofileMetadata(concatinatedAudiofilePath),
        this.uploadToStorage(bucketName, concatinatedAudiofilePath, bucketUploadDestination)
      ]);

      console.log('audiofileMetadata: ', JSON.stringify(audiofileMetadata));

      const durationInSeconds = audiofileMetadata.format.duration || 0;

      console.log('durationInSeconds: ', durationInSeconds);
      console.log('uploadResponse:', JSON.stringify(uploadResponse));

      // Cleanup temp dir
      await this.removeDir(this.tempBaseDir);

      return {
        fileMetaData: uploadResponse.fileMetaData,
        publicFileUrl: uploadResponse.publicFileUrl,
        audiofileMetadata,
        durationInSeconds
      };
    } catch (err) {
      // Cleanup temp dir (if exists)
      await this.removeDir(this.tempBaseDir);
      throw err;
    }
  }
}
