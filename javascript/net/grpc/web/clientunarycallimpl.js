/**
 * @fileoverview This class handles ClientReadableStream returned by unary
 * calls.
 */

import { ClientReadableStream } from "./clientreadablestream.js";

/**
 * @implements {ClientReadableStream<RESPONSE>}
 * @template RESPONSE
 */
export class ClientUnaryCallImpl {
  /**
   * @param {!ClientReadableStream<RESPONSE>} stream
   */
  constructor(stream) {
    this.stream = stream;
  }

  /**
   * @override
   */
  on(eventType, callback) {
    if (eventType == 'data' || eventType == 'error') {
      // unary call responses and errors should be handled by the main
      // (err, resp) => ... callback
      return this;
    }
    return this.stream.on(eventType, callback);
  }

  /**
   * @override
   */
  removeListener(eventType, callback) {
    return this.stream.removeListener(eventType, callback);
  }

  /**
   * @override
   */
  cancel() {
    this.stream.cancel();
  }
}