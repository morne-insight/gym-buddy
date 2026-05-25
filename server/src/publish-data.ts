import { type DataMessage, encodeDataMessage } from './data-messages.js';

export interface DataPublisher {
  publishData(data: Uint8Array, options: { reliable: boolean }): Promise<void>;
}

export async function publishDataMessage(
  publisher: DataPublisher,
  message: DataMessage,
): Promise<void> {
  const encoded = encodeDataMessage(message);
  await publisher.publishData(encoded, { reliable: true });
}
