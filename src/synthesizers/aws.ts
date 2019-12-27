console.log('App init: aws.ts ./index');
import { BaseSynthesizer, SynthesizeUploadResponse, AllowedOutputFileExtension } from './index';
console.log('App init: aws.ts ../storage/google-cloud-storage');
import { AvailableBucketName } from '../storage/google-cloud-storage';
console.log('App init: aws.ts ../utils/ssml');
import { AWS_CHARACTER_SOFT_LIMIT, AWS_CHARACTER_HARD_LIMIT } from '../utils/ssml';
console.log('App init: aws.ts aws-sdk/clients/polly');
import AWSPolly from 'aws-sdk/clients/polly';

export interface SynthesizeOptionsAWS {
  ssml: string;
  audioEncoding: AWSPolly.SynthesizeSpeechInput['OutputFormat'];
  voiceLanguageCode: AWSPolly.SynthesizeSpeechInput['LanguageCode'];
  voiceName: AWSPolly.SynthesizeSpeechInput['VoiceId'];
}

export class AWSSynthesizer extends BaseSynthesizer {
  private readonly client: AWSPolly;
  private readonly options: SynthesizeOptionsAWS;
  private readonly outputFormat: AllowedOutputFileExtension;

  constructor(outputFormat: AllowedOutputFileExtension, options: SynthesizeOptionsAWS) {
    super({
      characterLimitHard: AWS_CHARACTER_HARD_LIMIT,
      characterLimitSoft: AWS_CHARACTER_SOFT_LIMIT,
      tempFilesExtension: outputFormat === 'wav' ? 'pcm' : 'mp3'
    });

    // Required environment variables:
    // AWS_ACCESS_KEY_ID
    // AWS_SECRET_ACCESS_KEY
    // AWS_USER

    this.client = new AWSPolly({
      signatureVersion: 'v4',
      region: 'eu-west-1'
    });

    this.options = options;
    this.outputFormat = outputFormat;

    console.log('Synthesizer options:', JSON.stringify(this.options));
  }

  public synthesize = async (options: SynthesizeOptionsAWS): Promise<AWSPolly.SynthesizeSpeechOutput> => {
    return new Promise((resolve, reject) => {
      const speechRequestOptions: AWSPolly.SynthesizeSpeechInput = {
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
