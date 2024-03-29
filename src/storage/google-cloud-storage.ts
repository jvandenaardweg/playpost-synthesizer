console.log('App init: google-cloud-storage.ts @google-cloud/storage');
import { UploadOptions, File } from '@google-cloud/storage';
console.log('App init: google-cloud-storage.ts @google-cloud/storage DONE');

export type AvailableBucketName = 'storage.playpost.app' | 'storage-development.playpost.app' | 'storage-staging.playpost.app';

export interface UploadResult {
  fileMetaData: any;
  publicFileUrl: string;
}

export class GoogleCloudStorage {
  private readonly storage: any;
  private readonly bucketName: AvailableBucketName;

  constructor (bucketName: AvailableBucketName) {
    const { Storage } = require('@google-cloud/storage');
    this.storage = new Storage();
    this.bucketName = bucketName;
  }

  /**
   * Uploads a file to our specific bucket.
   *
   * Returns the public file path which we can use.
   */
  public upload = async (localAudiofilePath: string, destination: string): Promise<UploadResult> => {
    const uploadOptions: UploadOptions = {
      destination,
      contentType: 'audio/mpeg',
      resumable: false,
      gzip: false, // Important: We need to keep gzip false, so our audio works streaming on Safari browsers using "byte range" requests. More on that here: https://cloud.google.com/cdn/docs/caching
      metadata: {
        // metadata: { },
        // Enable long-lived HTTP caching headers
        // Use only if the contents of the file will never change
        // (If the contents will change, use cacheControl: 'no-cache')
        cacheControl: 'public, max-age=31536000', // 1 year
        // contentLanguage: voice.language.code
      }
    }

    const [file] = await this.storage.bucket(this.bucketName).upload(localAudiofilePath, uploadOptions);

    const publicFileUrl = this.getPublicFileUrl(file);

    return {
      fileMetaData: file.metadata,
      publicFileUrl
    };
  }

  public getPublicFileUrlFromFileMetaData = (file: File): string => {
    const { name } = file.metadata;
    return `https://${this.bucketName}/${name}`; // Example: https://storage.googleapis.com/synthesized-audio-files/13eda868daeb.mp3
  };

  public getPublicFileUrl = (file: File): string => {
    return this.getPublicFileUrlFromFileMetaData(file);
  };
}
