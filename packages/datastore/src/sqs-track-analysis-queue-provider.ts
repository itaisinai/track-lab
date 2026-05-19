import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
  type Message,
} from "@aws-sdk/client-sqs";
import type {
  TrackAnalysisQueueMessage,
  TrackAnalysisQueueProvider,
} from "./track-analysis-queue-provider.ts";

export type SqsTrackAnalysisQueueProviderOptions = {
  region: string;
  queueUrl: string;
  visibilityTimeoutSeconds?: number;
  clientFactory?: () => Promise<SqsClientAdapter> | SqsClientAdapter;
};

export class SqsTrackAnalysisQueueProvider implements TrackAnalysisQueueProvider {
  readonly mode = "sqs" as const;
  private clientPromise: Promise<SqsClientAdapter> | null = null;
  private readonly options: SqsTrackAnalysisQueueProviderOptions;

  constructor(options: SqsTrackAnalysisQueueProviderOptions) {
    this.options = options;
  }

  async enqueue(jobId: number): Promise<void> {
    const client = await this.getClient();

    await client.send(
      new SendMessageCommand({
        QueueUrl: this.options.queueUrl,
        MessageBody: JSON.stringify({ jobId }),
      }),
    );
  }

  async receiveNextMessage(): Promise<TrackAnalysisQueueMessage | null> {
    const client = await this.getClient();

    const response = (await client.send(
      new ReceiveMessageCommand({
        QueueUrl: this.options.queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        VisibilityTimeout: this.options.visibilityTimeoutSeconds ?? 300,
      }),
    )) as { Messages?: Array<Message> };

    const message = response.Messages?.[0];

    if (!message?.Body || !message.ReceiptHandle) {
      return null;
    }

    return {
      body: message.Body,
      messageId: message.MessageId,
      receiptHandle: message.ReceiptHandle,
    };
  }

  async deleteMessage(message: TrackAnalysisQueueMessage): Promise<void> {
    if (!message.receiptHandle) {
      return;
    }

    const client = await this.getClient();

    await client.send(
      new DeleteMessageCommand({
        QueueUrl: this.options.queueUrl,
        ReceiptHandle: message.receiptHandle,
      }),
    );
  }

  private async getClient(): Promise<SqsClientAdapter> {
    if (!this.clientPromise) {
      this.clientPromise = Promise.resolve(
        this.options.clientFactory
          ? this.options.clientFactory()
          : new SQSClient({ region: this.options.region }),
      );
    }

    return this.clientPromise;
  }
}

type SqsClientAdapter = Pick<SQSClient, "send">;
