import { RequestInit } from 'node-fetch';

export interface MicrosoftVoice {
  Name: string;
  ShortName: string;
  Gender: string;
  Locale: string;
}

export interface MicrosoftSpeechRequestHeaders {
  method: string;
  headers: {
    'Authorization': string;
    'X-Microsoft-OutputFormat': 'raw-16khz-16bit-mono-pcm' | 'raw-8khz-8bit-mono-mulaw' | 'riff-8khz-8bit-mono-alaw' | 'riff-8khz-8bit-mono-mulaw' | 'riff-16khz-16bit-mono-pcm' | 'audio-16khz-128kbitrate-mono-mp3' | 'audio-16khz-64kbitrate-mono-mp3' | 'audio-16khz-32kbitrate-mono-mp3' | 'raw-24khz-16bit-mono-pcm' | 'riff-24khz-16bit-mono-pcm' | 'audio-24khz-160kbitrate-mono-mp3' | 'audio-24khz-96kbitrate-mono-mp3' | 'audio-24khz-48kbitrate-mono-mp3';
    'Content-Type': string;
    'User-Agent': string;
  };
  body: string;
}

/*
Example voice response:

{
  "Name": "Microsoft Server Speech Text to Speech Voice (ar-EG, Hoda)",
  "ShortName": "ar-EG-Hoda",
  "Gender": "Female",
  "Locale": "ar-EG"
},
*/

export class MicrosoftSynthesizer {
  voices: MicrosoftVoice[] = [];
  subscriptionKey = process.env.MICROSOFT_TTS_SUBSCRIPTION_KEY;
  region = 'westeurope';
  accessToken: string | null = null;

  // Microsoft Text to Speech REST API docs:
  // 1. Go to: https://editor.swagger.io/
  // 2. Import URL: https://westeurope.cris.ai/docs/v2.0/swagge

  authorize = async () => {
    console.log('Microsoft: Authorizing...');

    const url = `https://${this.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;

    if (!this.subscriptionKey) {
      throw new Error('MICROSOFT_TTS_SUBSCRIPTION_KEY is required as an environment variable.');
    }

    const request: RequestInit = {
      method: 'post',
      headers: {
        'Ocp-Apim-Subscription-Key': this.subscriptionKey
      }
    }

    const nodeFetch = require('node-fetch');

    const response = await nodeFetch(url, request);

    if (!response.ok) {
      console.error('Microsoft: ', response);
      throw response;
    }

    const accessToken = await response.text()

    if (!accessToken) {
      const message = 'No accessToken in response.';
      console.error('Microsoft: ', message);
      throw new Error(message);
    }

    this.accessToken = accessToken;

    console.log('Microsoft: Authorized!');

    // TODO: save time with it, so we can use the token for 9 minutes
    // info: https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/rest-text-to-speech#how-to-use-an-access-token
    return this.accessToken;
  }

  getAllVoices = async (): Promise<MicrosoftVoice[]> => {
    console.log('Microsoft Azure: Getting all Microsoft voices from the API...');

    await this.authorize();

    const url = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;

    const request: RequestInit = {
      method: 'get',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    }

    const nodeFetch = require('node-fetch');

    const response = await nodeFetch(url, request);

    if (!response.ok) {
      throw new Error(JSON.stringify(response));
    }

    this.voices = await response.json();

    return this.voices;
  }
}
