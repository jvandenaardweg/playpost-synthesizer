console.log('App init: audio.ts import fluent-ffmpeg');
import fluentFfmpeg from 'fluent-ffmpeg';
console.log('App init: audio.ts import ffmpeg-static');
import ffmpegStaticPath from 'ffmpeg-static';
import { AllowedOutputFileExtension, AllowedTempFilesExtension } from '../synthesizers';
console.log('App init: audio.ts import ../synthesizers');

/**
 * Concatinates multiple audiofiles into 1 audiofile
 */
export const concatAudioFiles = async (audioFiles: string[], tempBaseDir: string, inputFormat: AllowedTempFilesExtension, outputFormat: AllowedOutputFileExtension): Promise<string> => {
  return new Promise((resolve, reject) => {
    const loggerPrefix = 'Audio Util (Concat):';

    const hrstart = process.hrtime();
    console.log(loggerPrefix, 'Using ffmpeg path: ', ffmpegStaticPath);
    fluentFfmpeg.setFfmpegPath(ffmpegStaticPath);

    console.log(loggerPrefix, ``, audioFiles, tempBaseDir, inputFormat, outputFormat);
    console.log(loggerPrefix, `Combining ${audioFiles.length} audiofiles to one audio file...`);

    const ffmpegInputOptions: string[] = [];
    const ffmpegOutputOptions: string[] = [];
    const ffmpegInput = `concat:${audioFiles.join('|')}`;
    const outputPath = `${tempBaseDir}/concatinated.${outputFormat}`;

    if (outputFormat === 'mp3') {
      // Adding this makes concatinating go way faster
      // Without this options, a concatination of 300ms took 10 seconds
      ffmpegOutputOptions.push('-acodec copy');
      // ffmpegOutputOptions.push('-codec:a libmp3lame');
      // ffmpegOutputOptions.push('-b:a 48k'); // https://trac.ffmpeg.org/wiki/Encode/MP3
    }

    if (inputFormat === 'pcm') {
      // pcm to wav:
      // ffmpeg -f s16le -ar 16k -ac 1 -i "concat:file-0.pcm|file-1.pcm" output.wav

      // PCM format is used by AWS Polly. More on that here:
      // https://docs.aws.amazon.com/polly/latest/dg/API_SynthesizeSpeech.html#polly-SynthesizeSpeech-request-OutputFormat

      // audioCodec = 'pcm_s16le';
      ffmpegInputOptions.push('-f s16le');
      ffmpegInputOptions.push('-ar 16k');
      ffmpegInputOptions.push('-ac 1');
    }

    if (!audioFiles.length) {
      const errorMessage = 'No audiofiles given to concat.';
      console.error(loggerPrefix, JSON.stringify(errorMessage));
      reject(new Error(errorMessage));
    }

    const ffmpegOptions = {
      outputFormat,
      input: ffmpegInput,
      inputOptions: ffmpegInputOptions,
      outputOptions: ffmpegOutputOptions,
      save: outputPath
    }

    console.log(loggerPrefix, 'Run fluent ffmpeg with: ', JSON.stringify(ffmpegOptions));

    return fluentFfmpeg()
      .input(ffmpegOptions.input)
      .outputFormat(ffmpegOptions.outputFormat)
      .addInputOptions(ffmpegOptions.inputOptions)
      .addOutputOptions(ffmpegOptions.outputOptions)
      .save(ffmpegOptions.save)
      .on('error', err => {
        console.error(loggerPrefix, 'Audio Util (Concat): Concat failed using ffmpeg:', JSON.stringify(err));
        reject(err);
      })
      .on('end', () => {
        const hrend = process.hrtime(hrstart);
        const ds = hrend[0];
        const dms = hrend[1] / 1000000;
        console.log(loggerPrefix, 'Concat success!');
        console.log(loggerPrefix, `Execution time: ${ds} ${dms}ms`);
        resolve(outputPath);
      })
      .on('codecData', data => {
        console.log(loggerPrefix, 'Data:', JSON.stringify(data));
      });
  });
};
