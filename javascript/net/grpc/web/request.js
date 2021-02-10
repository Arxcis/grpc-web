/**
 * @fileoverview  A templated class that is used to address an individual
 * gRPC-Web request instance.
 */
import { CallOptions } from "./calloptions.js"
import { Metadata } from "./metadata.js"
import { MethodDescriptorInterface } from "./methoddescriptorinterface.js"

/**
 * @interface
 * @template REQUEST, RESPONSE
 */
export class Request {
  /**
   * @export
   * @return {REQUEST}
   */
  getRequestMessage() {}

  /**
   * @export
   * @return {!MethodDescriptorInterface<REQUEST, RESPONSE>}
   */
  getMethodDescriptor() {}

  /**
   * @export
   * @return {!Metadata}
   */
  getMetadata() {}

  /**
   * Client CallOptions. Note that CallOptions has not been implemented in
   * grpc.web.AbstractClientbase yet, but will be used in
   * grpc.web.GenericClient.
   * @export
   * @return {!CallOptions|undefined}
   */
  getCallOptions() {}

  /**
   * @param {string} key
   * @param {string} value
   * @return {!Request<REQUEST, RESPONSE>}
   */
  withMetadata(key, value) {}

  /**
   * @param {string} name
   * @param {VALUE} value
   * @template VALUE
   * @return {!Request<REQUEST, RESPONSE>}
   */
  withGrpcCallOption(name, value) {}
}
