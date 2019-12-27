console.log('App init: index.ts import md5');
import md5 from 'md5';
console.log('App init: index.ts import fs');
import fs from 'fs';
console.log('App init: index.ts import os');
import os from 'os';
console.log('App init: index.ts import music-metadata');
import { IAudioMetadata } from 'music-metadata';
console.log('App init: index.ts import ../utils/ssml');
import { getSSMLParts } from '../utils/ssml';
console.log('App init: index.ts import ../utils/audio');
import { getAudioFileDurationInSeconds, concatAudioFiles, getAudiofileMetadata } from '../utils/audio';
console.log('App init: index.ts import ../storage/google-cloud-storage');
import { AvailableBucketName, GoogleCloudStorage } from '../storage/google-cloud-storage';

export interface SynthesizeUploadResponse {
  fileMetaData: any;
  publicFileUrl: string;
  durationInSeconds: number;
  audiofileMetadata: IAudioMetadata
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

    fs.mkdirSync(this.tempBaseDir);

    console.log('Synthesizer created tempBaseDir:', this.tempBaseDir);
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
    return new Promise((resolve, reject) => {
      const tempfile = `${this.tempBaseDir}/${sessionId}-${index}.${this.fileExtension}`;

      fs.writeFile(tempfile, audioContent, 'binary', (err: any) => {
        if (err) {
          reject(err);
        }

        console.log('saveTempFile:', tempfile);

        resolve(tempfile)
      });
    })
  }

  public removeDir = (dir: string) => {
    return new Promise((resolve, reject) => {
      // Important: rmdir { recurisve: true } requires node 12.10.0 or higher
      fs.rmdir(dir, { recursive: true }, (err) => {
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
