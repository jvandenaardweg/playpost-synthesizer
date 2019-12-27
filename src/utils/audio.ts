// import ffmpeg from '@ffmpeg-installer/ffmpeg';
import fluentFfmpeg from 'fluent-ffmpeg';
import * as musicMetadata from 'music-metadata';
import ffmpegStatic from 'ffmpeg-static';

fluentFfmpeg.setFfmpegPath(ffmpegStatic.path);

export const getAudiofileMetadata = async (audioFilePath: string): Promise<musicMetadata.IAudioMetadata> => {
  try {
    const metaData = await musicMetadata.parseFile(audioFilePath, { duration: true });
    return metaData;
  } catch (err) {
    console.log('Audio Util (Duration): Failed to get audiofile duration.', audioFilePath);
    throw err;
  }
};

export const getAudioFileDurationInSeconds = async (audioFilePath: string): Promise<number> => {
  console.log('Audio Util (Duration): Get audiofile duration in seconds...');

  try {
    const metaData = await musicMetadata.parseFile(audioFilePath, { duration: true });
    const durationInSeconds = metaData.format.duration;
    console.log(`Audio Util (Duration): Got audiofile duration: ${durationInSeconds} seconds.`);

    // If duration is "undefined", we just return 0
    return durationInSeconds || 0;
  } catch (err) {
    console.log('Audio Util (Duration): Failed to get audiofile duration.', audioFilePath);

    throw err;
  }
};

/**
 * Concatinates multiple audiofiles into 1 audiofile
 */
export const concatAudioFiles = async (audioFiles: string[], tempBaseDir: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hrstart = process.hrtime();

    console.log(`Audio Util (Concat): Combining ${audioFiles.length} audiofiles to one audio file...`);

    const audioCodec = 'libmp3lame';
    const format = 'mp3';
    const outputPath = `${tempBaseDir}/concatinated.mp3`;

    if (!audioFiles.length) {
      const errorMessage = 'No audiofiles given to concat.';
      console.error('Audio Util (Concat): ', JSON.stringify(errorMessage));
      reject(new Error(errorMessage));
    }

    return fluentFfmpeg()
      .format(format)
      .audioCodec(audioCodec)
      .input(`concat:${audioFiles.join('|')}`)
      .outputOptions('-acodec copy')
      .save(outputPath)
      .on('error', (err: any) => {
        console.error('Audio Util (Concat): Concat failed using ffmpeg:', JSON.stringify(err));
        reject(err);
      })
      .on('end', () => {
        const hrend = process.hrtime(hrstart);
        const ds = hrend[0];
        const dms = hrend[1] / 1000000;
        console.log('Audio Util (Concat): Concat success!');
        console.log(`Audio Util (Concat): Execution time: ${ds} ${dms}ms`);
        resolve(outputPath);
      })
      .on('codecData', (data: any) => {
        console.log('Audio Util (Concat): Data:', JSON.stringify(data));
      });
  });
};
