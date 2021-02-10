/**
 * @fileoverview Internal implementation of grpc.web.Request.
 */
import { CallOptions } from "./calloptions.js";
import { Metadata } from "./methodtype.js";
import { MethodDescriptor } from "./methoddescriptor.js";
import { Request } from "./request.js";

/**
 * @template REQUEST, RESPONSE
 * @implements {Request<REQUEST, RESPONSE>}
 * @final
 * @package
 */
export class RequestInternal {
  /**
   * @param {REQUEST} requestMessage
   * @param {!MethodDescriptor<REQUEST, RESPONSE>} methodDescriptor
   * @param {!Metadata} metadata
   * @param {!CallOptions} callOptions
   */
  constructor(requestMessage, methodDescriptor, metadata, callOptions) {
    /**
     * @const {REQUEST}
     * @private
     */
    this.requestMessage_ = requestMessage;

    /**
     * @const {!MethodDescriptor<REQUEST, RESPONSE>}
     * @private
     */
    this.methodDescriptor_ = methodDescriptor;

    /** @const @private */
    this.metadata_ = metadata;

    /** @const @private */
    this.callOptions_ = callOptions;
  }

  /**
   * @override
   * @return {REQUEST}
   */
  getRequestMessage() {
    return this.requestMessage_;
  }

  /**
   * @override
   * @return {!MethodDescriptor<REQUEST, RESPONSE>}
   */
  getMethodDescriptor() {
    return this.methodDescriptor_;
  }

  /**
   * @override
   * @return {!Metadata}
   */
  getMetadata() {
    return this.metadata_;
  }

  /**
   * @override
   * @return {!CallOptions|undefined}
   */
  getCallOptions() {
    return this.callOptions_;
  }

  /**
   * @override
   */
  withMetadata(key, value) {
    this.metadata_[key] = value;
    return this;
  }

  /**
   * @override
   */
  withGrpcCallOption(name, value) {
    this.callOptions_.setOption(name, value);
    return this;
  }
}
