/**
 * @fileoverview Description of this file.
 *
 * A templated class that is used to address gRPC Web requests.
 */

import { CallOptions } from "./calloptions.js";
import { Metadata } from "./metadata.js";
import { MethodDescriptorInterface } from "./methoddescriptorinterface.js";
import { MethodType } from "./methodtype.js";
import { Request } from "./request.js";
import { RequestInternal } from "./requestinternal.js";
import { UnaryResponse } from "./unaryresponse.js";
import { UnaryResponseInternal } from "./unaryresponseinternal.js";
import { Status } from "./status.js";

/**
 * @final
 * @implements {MethodDescriptorInterface<REQUEST, RESPONSE>}
 * @template REQUEST, RESPONSE
 * @unrestricted
 */
export const MethodDescriptor = class {
  /**
   * @param {string} name
   * @param {?MethodType} methodType
   * @param {function(new: REQUEST, ...)} requestType
   * @param {function(new: RESPONSE, ...)} responseType
   * @param {function(REQUEST): ?} requestSerializeFn
   * @param {function(?): RESPONSE} responseDeserializeFn
   */
  constructor(
      name, methodType, requestType, responseType, requestSerializeFn,
      responseDeserializeFn) {
    /** @const */
    this.name = name;
    /** @const */
    this.methodType = methodType;
    /** @const */
    this.requestType = requestType;
    /** @const */
    this.responseType = responseType;
    /** @const */
    this.requestSerializeFn = requestSerializeFn;
    /** @const */
    this.responseDeserializeFn = responseDeserializeFn;
  }

  /**
   * @override
   * @param {REQUEST} requestMessage
   * @param {!Metadata=} metadata
   * @param {!CallOptions=} callOptions
   * @return {!Request<REQUEST, RESPONSE>}
   */
  createRequest(
      requestMessage, metadata = {}, callOptions = new CallOptions()) {
    return new RequestInternal(requestMessage, this, metadata, callOptions);
  }

  /**
   * @override
   * @param {RESPONSE} responseMessage
   * @param {!Metadata=} metadata
   * @param {?Status=} status
   * @return {!UnaryResponse<REQUEST, RESPONSE>}
   */
  createUnaryResponse(responseMessage, metadata = {}, status = null) {
    return new UnaryResponseInternal(responseMessage, this, metadata, status);
  }

  /**
   * @override
   */
  getName() {
    return this.name;
  }

  /**
   * @override
   */
  getMethodType() {
    return this.methodType;
  }

  /**
   * @override
   * @return {function(new: RESPONSE, ...)}
   */
  getResponseMessageCtor() {
    return this.responseType;
  }

  /**
   * @override
   * @return {function(new: REQUEST, ...)}
   */
  getRequestMessageCtor() {
    return this.requestType;
  }

  /** @override */
  getResponseDeserializeFn() {
    return this.responseDeserializeFn;
  }

  /** @override */
  getRequestSerializeFn() {
    return this.requestSerializeFn;
  }
};
