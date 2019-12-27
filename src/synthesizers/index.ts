console.log('App init: index.ts import md5');
import md5 from 'md5';
console.log('App init: index.ts import rimraf');
import rimraf from 'rimraf';
console.log('App init: index.ts import fs-extra');
import fsExtra from 'fs-extra';
console.log('App init: index.ts import os');
import os from 'os';
console.log('App init: index.ts import music-metadata');
import musicMetadata from 'music-metadata';
console.log('App init: index.ts import ../utils/ssml');
import { getSSMLParts } from '../utils/ssml';
console.log('App init: index.ts import ../utils/audio');
import { getAudioFileDurationInSeconds, concatAudioFiles, getAudiofileMetadata } from '../utils/audio';
console.log('App init: index.ts import ../storage/google-cloud-storage');
import { AvailableBucketName, GoogleCloudStorage } from '../storage/google-cloud-storage';
console.log('App init: index.ts import @google-cloud/text-to-speech/build/protos/protos');
import { google } from '@google-cloud/text-to-speech/build/protos/protos';
console.log('App init: index.ts import aws-sdk');
import AWS from 'aws-sdk';

export interface SynthesizeOptionsGoogle {
  ssml: string;
  audioEncoding: google.cloud.texttospeech.v1.AudioEncoding;
  voiceLanguageCode: string;
  voiceName: string;
  voiceSsmlGender: google.cloud.texttospeech.v1.SsmlVoiceGender;
}

export interface SynthesizeOptionsAWS {
  ssml: string;
  audioEncoding: AWS.Polly.SynthesizeSpeechInput['OutputFormat'];
  voiceLanguageCode: AWS.Polly.SynthesizeSpeechInput['LanguageCode'];
  voiceName: AWS.Polly.SynthesizeSpeechInput['VoiceId'];
}

export interface SynthesizeUploadResponse {
  fileMetaData: any;
  publicFileUrl: string;
  durationInSeconds: number;
  audiofileMetadata: musicMetadata.IAudioMetadata
}

export class BaseSynthesizer {
  readonly sessionId: string;
  readonly fileExtension: string;
  readonly tempBaseDir: string;
  readonly characterLimitSoft: number;
  readonly characterLimitHard: number;

  constructor(characterLimitHard: number, characterLimitSoft: number) {
    this.sessionId = md5((new Date().getTime() * 10000).toString());
    this.fileExtension = 'mp3';
    this.tempBaseDir =`${os.tmpdir()}/${this.sessionId}`;
    this.characterLimitHard = characterLimitHard;
    this.characterLimitSoft = characterLimitSoft;

    console.log('Synthesizer sessionId:', this.sessionId);
    console.log('Synthesizer tempBaseDir:', this.tempBaseDir);
    console.log('Synthesizer fileExtension:', this.fileExtension);
    console.log('Synthesizer characterLimitHard:', this.characterLimitHard);
    console.log('Synthesizer characterLimitSoft:', this.characterLimitSoft);
  }

  public getSSMLParts = (ssml: string) => {
    return getSSMLParts(ssml, {
      hardLimit: this.characterLimitHard,
      softLimit: this.characterLimitSoft
    });
  }

  public getAudioFileDurationInSeconds = (concatinatedAudiofilePath: string) => {
    return getAudioFileDurationInSeconds(concatinatedAudiofilePath)
  }

  public getAudiofileMetadata = (concatinatedAudiofilePath: string) => {
    return getAudiofileMetadata(concatinatedAudiofilePath)
  }

  // string | Uint8Array | Buffer | Blob | internal.Readable | undefined
  public saveTempFile = async (sessionId: string, index: number, audioContent: Uint8Array | null | undefined | Buffer | any): Promise<string> => {
    const tempfile = `${this.tempBaseDir}/${sessionId}-${index}.${this.fileExtension}`;

    await fsExtra.ensureFile(tempfile);
    await fsExtra.writeFile(tempfile, audioContent, 'binary');

    console.log('saveTempFile:', tempfile);

    return tempfile;
  }

  public removeDir = (dir: string) => {
    return new Promise((resolve, reject) => {
      rimraf(dir, (err) => {
        if (err) {
          console.error('Failed to remove dir:', dir, JSON.stringify(err));
          reject(err);
        }

        console.log('Cleaned up dir:', dir);
        resolve();
      });
    });
  }

  public uploadToStorage = (bucketName: AvailableBucketName, concatinatedAudiofilePath: string, bucketUploadDestination: string) => {
    const googleCloudStorage = new GoogleCloudStorage(bucketName);
    return googleCloudStorage.upload(concatinatedAudiofilePath, bucketUploadDestination)
  }

  public getConcatinatedAudiofilePath = (tempFiles: string[]) => {
    return concatAudioFiles(tempFiles, this.tempBaseDir);
  }
}
