import wav = require('node-wav');
import { downsampleTo16K } from './audiowav16';

const MODEL_SAMPLE_RATE = 16000;
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

// Module for a Node-Red custom node
export = function ds2(RED: NodeRed) {

  class Speech2Text {
    //
    on: (event: string, fn: (msg: any) => void) => void;
    send: (msg: NodeRedMessage) => void;

    id: string;
    type: string;
    name: string;
    wires: NodeRedWires;
    modelURL: string;

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
    }

    // handle a single request
    handleRequest(msg: NodeRedMessage) {
      const result = wav.decode(msg.payload);
      let audio: Float32Array = result.channelData;
      if (result.sampleRate > MODEL_SAMPLE_RATE) {
        console.log(
          `downsampling from ${result.sampleRate} to ${MODEL_SAMPLE_RATE}`);
        audio = downsampleTo16K(result.channelData[0], result.sampleRate);
      }

      this.send(
        {payload: `No transcription yet, audio length: ${audio.length}`});
    }

    handleClose(done: () => void) {
      // node level clean up
      done();
    }
  }

  RED.nodes.registerType('deepspeech2', Speech2Text);
};