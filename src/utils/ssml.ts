console.log('App init: ssml.ts import ssml-split');
import SSMLSplit, { OptionsInput } from 'ssml-split';

export const GOOGLE_CHARACTER_HARD_LIMIT = 5000;
export const GOOGLE_CHARACTER_SOFT_LIMIT = 4000;

export const AWS_CHARACTER_HARD_LIMIT = 3000;
export const AWS_CHARACTER_SOFT_LIMIT = 2000;

export const DEFAULT_SSML_SPLIT_HARD_LIMIT = AWS_CHARACTER_HARD_LIMIT;
export const DEFAULT_SSML_SPLIT_SOFT_LIMIT = AWS_CHARACTER_SOFT_LIMIT;

export const getSSMLParts = (ssml: string, optionsOverwrite?: OptionsInput) => {
  const loggerPrefix = 'SSML (Util):';

  const defaultOptions: OptionsInput = {
    hardLimit: DEFAULT_SSML_SPLIT_HARD_LIMIT, // MAX length of a single batch of split text
    softLimit: DEFAULT_SSML_SPLIT_SOFT_LIMIT, // MIN length of a single batch of split text
    synthesizer: 'aws',
    breakParagraphsAboveHardLimit: true
  };

  let options = defaultOptions;

  if (optionsOverwrite) {
    options = { ...defaultOptions, ...optionsOverwrite };
  }

  const ssmlSplit = new SSMLSplit(options);

  console.log(loggerPrefix, 'Splitting SSML content into different parts using options: ', JSON.stringify(options));

  const ssmlParts: string[] = ssmlSplit.split(ssml);

  if (!ssmlParts || !ssmlParts.length) {
    const errorMessage = 'Got no SSML parts.';
    console.error(loggerPrefix, JSON.stringify(errorMessage));
    throw new Error(errorMessage);
  }

  console.log(loggerPrefix, `Successfully splitted the SSML into ${ssmlParts.length} SSML parts.`);

  return ssmlParts;
};
