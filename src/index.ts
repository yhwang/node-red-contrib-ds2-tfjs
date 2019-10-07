import wav = require('node-wav');
import { downsampleTo16K } from './audiowav16';
import { homedir } from 'os';
import * as path from 'path';
import { mkdirSync } from 'fs';
import { Worker } from 'worker_threads';

const MODEL_SAMPLE_RATE = 16000;
const CACHE_DIR = path.join(homedir(), '.node-red', 'deepspeech2');

// make sure the CACHE_DIR exists
mkdirSync(CACHE_DIR, {recursive: true});

/**
 * Represent Node-Red's runtime
 */
declare class NodeRed {
  nodes: NodeRedNodes;
}

declare class NodeRedWire {
  [index: number]: string;
}

declare class NodeRedWires {
  [index: number]: NodeRedWire;
}

/**
 * Represent Node-Red's configuration for a custom node
 * For this case, it's the configuration for DeepSpeech
 * custom node
 */
declare class NodeRedProperties {
  id: string;
  type: string;
  name: string;
  modelURL: string;
  wires: NodeRedWires;
}

/**
 * Represent Node-Red's nodes
 */
declare class NodeRedNodes {
  createNode(node: any, props: NodeRedProperties): void;
  registerType(type: string, ctor: any): void;
}

/**
 * Represent Node-Red's message that passes to a node
 */
declare class NodeRedMessage {
  payload: Buffer|string;
}

declare interface StatusOption {
  fill: 'red' | 'green' | 'yellow' | 'blue' | 'grey';
  shape: 'ring' | 'dot';
  text: string;
}

declare interface WorkerMsg {
  type: 'ModelLoaded' | 'TranscribeDone';
  value?: string;
}

// Module for a Node-Red custom node
export = function ds2(RED: NodeRed) {

  class Speech2Text {
    //
    on: (event: string, fn: (msg: any) => void) => void;
    send: (msg: NodeRedMessage) => void;
    status: (option: StatusOption) => void;
    log: (msg: string) => void;

    id: string;
    type: string;
    name: string;
    wires: NodeRedWires;
    modelURL: string;
    worker: Worker;

    constructor(config: NodeRedProperties) {
      this.id = config.id;
      this.type = config.type;
      this.name = config.name;
      this.wires = config.wires;
      this.modelURL = config.modelURL;

      RED.nodes.createNode(this, config);
      this.on('input', (msg: NodeRedMessage) => {
        this.handleRequest(msg);
      });

      this.on('close', (done: () => void) => {
        this.handleClose(done);
      });

      if (this.modelURL.trim().length > 0) {
        this.status({fill:'red' ,shape:'ring', text:'loading model...'});
        this.log(`loading model from: ${this.modelURL}`);
        this._createWorker();
      }
    }

    // handle a single request
    handleRequest(msg: NodeRedMessage) {
      if (this.worker === undefined) {
        this.log('received input but model is not ready yet');
        return;
      }

      const result = wav.decode(msg.payload);
      let audio: Float32Array = result.channelData;
      if (result.sampleRate > MODEL_SAMPLE_RATE) {
        console.log(
          `downsampling from ${result.sampleRate} to ${MODEL_SAMPLE_RATE}`);
        audio = downsampleTo16K(result.channelData[0], result.sampleRate);
      }

      this.status({fill:'yellow' ,shape:'ring', text:'transcribing...'});
      this.log('transcribing...');
      this.worker.postMessage({type: 'Transcribe', value: audio});
    }

    handleClose(done: () => void) {
      // node level clean up
      if (this.worker !== undefined) {
        this.log('stop worker');
        this.worker.terminate();
      }
      done();
    }

    _createWorker() {
      const worker = new Worker(
        path.join(__dirname, 'worker.js'), { workerData: this.modelURL});
      worker.on('message', (msg: WorkerMsg) => {
        switch (msg.type) {
          case 'ModelLoaded':
            this.status({fill:'green' ,shape:'dot', text:'model is ready'});
            this.log('worker and model are ready');
            this.worker = worker;
            break;
          case 'TranscribeDone':
            this.status({fill:'green' ,shape:'dot', text:'model is ready'});
            this.log(`transcription:${msg.value}`);
            this.send(
              {payload: msg.value});
            break;
          default:
            break;
        }
      });
    }
  }

  RED.nodes.registerType('deepspeech2', Speech2Text);
};
