import { parentPort, workerData } from 'worker_threads';
import { LanguageModel, DeepSpeech, EN_VOCABULARY } from 'ds2-tfjs';

const modelURL = workerData;
let gDS: DeepSpeech;

declare interface ParentMsg {
  type: 'Transcribe';
  value: Float32Array;
}

const initializeDS2 = (url: string, cb: (ds: DeepSpeech) => void) => {
  const lm = new LanguageModel(EN_VOCABULARY);
  const ds = new DeepSpeech(lm);
  Promise.all([lm.load(), ds.load(url)]).then(() => {
    cb(ds);
  });
};

initializeDS2(modelURL, (ds: DeepSpeech) => {
  gDS = ds;
  parentPort.postMessage({type: 'ModelLoaded'});
});

parentPort.on('message', async (msg: ParentMsg) => {
  switch (msg.type) {
    case 'Transcribe':
      if (gDS !== undefined) {
        const transcription =
            await gDS.transcribeWav(msg.value, {beamWidth: 64});
        parentPort.postMessage({type: 'TranscribeDone', value: transcription});
      }
      break;
    default:
  }
});