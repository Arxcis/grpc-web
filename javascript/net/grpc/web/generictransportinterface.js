/**
 *
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
/**
 * @fileoverview gRPC-Web generic transport interface
 *
 * This class provides an abstraction for the underlying transport
 * implementation underneath the ClientReadableStream layer.
 *
 * @author stanleycheung@google.com (Stanley Cheung)
 */
import NodeReadableStream from "goog.net.streams.NodeReadableStream"; // @TODO How do we even 'esm' this import?
import XhrIo from "goog.net.XhrIo"; // @TODO

/**
 * @typedef {{
 *   nodeReadableStream: (?NodeReadableStream|undefined),
 *   xhr: (?XhrIo|undefined),
 * }}
 */
export const GenericTransportInterface;
