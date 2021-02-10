/**
 * @fileoverview gRPC web client UnaryResponse returned by grpc unary calls.
 */

import { Metadata } from "./metadata.js"
import { MethodDescriptorInterface } from "./methoddescriptorinterface.js"
import { Status} from "./status.js"

/**
 * @interface
 * @template REQUEST, RESPONSE
 */
export class UnaryResponse {
  /**
   * @export
   * @return {RESPONSE}
   */
  getResponseMessage() {}

  /**
   * @export
   * @return {!Metadata}
   */
  getMetadata() {}

  /**
   * @export
   * @return {!MethodDescriptorInterface<REQUEST, RESPONSE>}
   */
  getMethodDescriptor() {}

  /**
   * gRPC status. Trailer metadata returned from a gRPC server is in
   * status.metadata.
   * @export
   * @return {?Status}
   */
  getStatus() {}
}
