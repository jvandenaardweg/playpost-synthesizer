console.log('App init: google.ts @google-cloud/text-to-speech/build/protos/protos');
import { google } from '@google-cloud/text-to-speech/build/protos/protos';
console.log('App init: google.ts ../storage/google-cloud-storage');
import { AvailableBucketName } from '../storage/google-cloud-storage';
console.log('App init: google.ts ./index');
import { BaseSynthesizer, SynthesizeUploadResponse, AllowedOutputFileExtension } from './index';
console.log('App init: google.ts ../utils/ssml');
import { GOOGLE_CHARACTER_HARD_LIMIT, GOOGLE_CHARACTER_SOFT_LIMIT } from '../utils/ssml';

export interface SynthesizeOptionsGoogle {
  ssml: string;
  audioEncoding: google.cloud.texttospeech.v1.AudioEncoding;
  voiceLanguageCode: string;
  voiceName: string;
  voiceSsmlGender: google.cloud.texttospeech.v1.SsmlVoiceGender;
}

export class GoogleSynthesizer extends BaseSynthesizer {
  private readonly client: any;
  private readonly options: SynthesizeOptionsGoogle;
  private readonly outputFormat: AllowedOutputFileExtension;

  constructor(outputFormat: AllowedOutputFileExtension, options: SynthesizeOptionsGoogle) {
    super({
      characterLimitHard: GOOGLE_CHARACTER_HARD_LIMIT,
      characterLimitSoft: GOOGLE_CHARACTER_SOFT_LIMIT,
      tempFilesExtension: outputFormat,
    });

    // Require the Text to Speech client here, and not on top of the file to improve startup performance...
    // ... on requests that do not need Google Text to Speech
    const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

    this.client = new TextToSpeechClient();
    this.options = options;
    this.outputFormat = outputFormat;

    console.log('Synthesizer options:', JSON.stringify(this.options));
  }

  public synthesize = async (optionsWithSsmlPart: SynthesizeOptionsGoogle): Promise<google.cloud.texttospeech.v1.ISynthesizeSpeechResponse> => {
    const speechRequestOptions: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
      audioConfig: {
        audioEncoding: optionsWithSsmlPart.audioEncoding
      },
      input: {
        ssml: optionsWithSsmlPart.ssml
      },
      voice: {
        languageCode: optionsWithSsmlPart.voiceLanguageCode,
        name: optionsWithSsmlPart.voiceName,
        ssmlGender: optionsWithSsmlPart.voiceSsmlGender
      }
    }

    try {
      console.log('Synthesize using: ', JSON.stringify(speechRequestOptions));
      const [response] = await this.client.synthesizeSpeech(speechRequestOptions);

      return response;
    } catch (err) {
      throw err;
    }
  }

  public preview = async (): Promise<string> => {
    const response = await this.synthesize(this.options);

    if (!response.audioContent) {
      throw new Error('audioContent not in response.');
    }

    // Return the audioContent as a base64 buffer, which applications can use
    return Buffer.from(response.audioContent).toString('base64');
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
        return this.saveTempFile(this.sessionId, index, result.audioContent);
      })

      const tempFiles = await Promise.all(saveTempFiles);
      console.log('tempFiles: ', JSON.stringify(tempFiles));

      const concatinatedAudiofilePath = await this.getConcatinatedAudiofilePath(tempFiles, this.tempFilesExtension, this.outputFormat);
      console.log('concatinatedAudiofilePath: ', concatinatedAudiofilePath);

      console.log('Uploading...');

      // Run these 2 in parallel, is faster
      const [durationInSeconds, uploadResponse] = await Promise.all([
        this.getAudiofileDurationInSeconds(concatinatedAudiofilePath),
        this.uploadToStorage(bucketName, concatinatedAudiofilePath, bucketUploadDestination)
      ]);

      console.log('durationInSeconds: ', durationInSeconds);
      console.log('uploadResponse:', JSON.stringify(uploadResponse));

      // Cleanup temp dir
      await this.removeDir(this.tempBaseDir);

      return {
        fileMetaData: uploadResponse.fileMetaData,
        publicFileUrl: uploadResponse.publicFileUrl,
        durationInSeconds
      };
    } catch (err) {
      // Cleanup temp dir (if exists)
      await this.removeDir(this.tempBaseDir);
      throw err;
    }
  }
}
