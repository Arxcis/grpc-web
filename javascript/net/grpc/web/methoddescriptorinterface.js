/**
 * @fileoverview Description of this file.
 *
 * A templated class that is used to address gRPC Web requests.
 */
import { CallOptions } from "./calloptions.js"
import { Metadata } from "./metadata.js"
import { MethodType } from "./methodtype.js"
import { Request } from "./request.js"
import { UnaryResponse } from "./unaryresponse.js"
import { Status } from "./status.js"

/**
 * @interface
 * @template REQUEST, RESPONSE
 */
export const MethodDescriptorInterface = function() {};

/**
 * @param {REQUEST} requestMessage
 * @param {!Metadata=} metadata
 * @param {!CallOptions=} callOptions
 * @return {!Request<REQUEST, RESPONSE>}
 */
MethodDescriptorInterface.prototype.createRequest = function(
    requestMessage, metadata, callOptions) {};


/**
 * @param {RESPONSE} responseMessage
 * @param {!Metadata=} metadata
 * @param {?Status=} status
 * @return {!UnaryResponse<REQUEST, RESPONSE>}
 */
MethodDescriptorInterface.prototype.createUnaryResponse = function(
    responseMessage, metadata, status) {};

/** @return {string} */
MethodDescriptorInterface.prototype.getName = function() {};

/** @return {?MethodType} */
MethodDescriptorInterface.prototype.getMethodType = function() {};

/** @return {function(new: RESPONSE, ?Array=)} */
MethodDescriptorInterface.prototype.getResponseMessageCtor = function() {};

/** @return {function(new: REQUEST, ?Array=)} */
MethodDescriptorInterface.prototype.getRequestMessageCtor = function() {};

/** @return {function(?): RESPONSE} */
MethodDescriptorInterface.prototype.getResponseDeserializeFn = function() {};

/** @return {function(REQUEST): ?} */
MethodDescriptorInterface.prototype.getRequestSerializeFn = function() {};
