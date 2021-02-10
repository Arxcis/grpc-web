/**
 * @fileoverview gRPC-Web UnaryResponse internal implementation.
 */
import { Metadata } from "./metadata.js";
import { MethodDescriptor } from "./methoddescriptor.js";
import { UnaryResponse } from "./unaryresponse.js";
import { Status } from "./status.js";

/**
 * @template REQUEST, RESPONSE
 * @implements {UnaryResponse<REQUEST, RESPONSE>}
 * @final
 * @package
 */
export class UnaryResponseInternal {
  /**
   * @param {RESPONSE} responseMessage
   * @param {!MethodDescriptor<REQUEST, RESPONSE>} methodDescriptor
   * @param {!Metadata=} metadata
   * @param {?Status=} status
   */
  constructor(responseMessage, methodDescriptor, metadata = {}, status = null) {
    /**
     * @const {RESPONSE}
     * @private
     */
    this.responseMessage_ = responseMessage;

    /**
     * @const {!Metadata}
     * @private
     */
    this.metadata_ = metadata;

    /**
     * @const {!MethodDescriptor<REQUEST, RESPONSE>}
     * @private
     */
    this.methodDescriptor_ = methodDescriptor;

    /**
     * @const {?Status}
     * @private
     */
    this.status_ = status;
  }

  /** @override */
  getResponseMessage() {
    return this.responseMessage_;
  }

  /** @override */
  getMetadata() {
    return this.metadata_;
  }

  /** @override */
  getMethodDescriptor() {
    return this.methodDescriptor_;
  }

  /** @override */
  getStatus() {
    return this.status_;
  }
}
