/**
 * @fileoverview Description of this file.
 *
 * grpc web MethodType
 */
/**
 * See grpc.web.AbstractClientBase.
 * MethodType.UNARY for rpcCall/unaryCall.
 * MethodType.SERVER_STREAMING for serverStreaming.
 *
 * @enum {string}
 */
export const MethodType = {
  'UNARY': 'unary',
  'SERVER_STREAMING': 'server_streaming'
};
