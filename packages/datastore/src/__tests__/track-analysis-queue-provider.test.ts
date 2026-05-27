import assert from "node:assert/strict";
import test from "node:test";
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { createTrackAnalysisQueueProvider } from "../index.ts";

test("database queue provider is a no-op", async () => {
  const provider = createTrackAnalysisQueueProvider({ provider: "database" });

  assert.equal(provider.mode, "database");
  assert.equal(await provider.receiveNextMessage(), null);
  await provider.enqueue(123);
});

test("sqs queue provider enqueues and deletes job ids", async () => {
  const fakeModule = createFakeSqsModule();
  const provider = createTrackAnalysisQueueProvider({
    provider: "sqs",
    sqs: {
      region: "us-west-2",
      queueUrl: "https://sqs.us-west-2.amazonaws.com/123456789012/track-lab",
      clientFactory: () => fakeModule.client,
    },
  });

  await provider.enqueue(138);

  const received = await provider.receiveNextMessage();
  assert.deepEqual(received, {
    body: JSON.stringify({ jobId: 138 }),
    messageId: "message-1",
    receiptHandle: "receipt-1",
  });

  await provider.deleteMessage(received as NonNullable<typeof received>);

  assert.deepEqual(fakeModule.state.sentBodies, [JSON.stringify({ jobId: 138 })]);
  assert.deepEqual(fakeModule.state.deletedReceipts, ["receipt-1"]);
});

test("sqs queue provider enqueues analyze commands", async () => {
  const fakeModule = createFakeSqsModule();
  const provider = createTrackAnalysisQueueProvider({
    provider: "sqs",
    sqs: {
      region: "us-west-2",
      queueUrl: "https://sqs.us-west-2.amazonaws.com/123456789012/track-lab",
      clientFactory: () => fakeModule.client,
    },
  });
  const command = {
    commandId: "00000000-0000-0000-0000-000000000001",
    commandType: "AnalyzeTrackCommand",
    version: 1,
    requestedAt: "2026-05-25T10:00:00.000Z",
    correlationId: "00000000-0000-0000-0000-000000000002",
    producer: "apps/api",
    idempotencyKey: "track-analysis-job:138:command:analyze",
    payload: {
      jobId: 138,
      track: {
        title: "Strobe",
        artists: "deadmau5",
      },
    },
  } as const;

  await provider.enqueue(command);

  assert.deepEqual(fakeModule.state.sentBodies, [JSON.stringify(command)]);
});

function createFakeSqsModule() {
  const state = {
    sentBodies: [] as string[],
    deletedReceipts: [] as string[],
    messages: [
      {
        Body: JSON.stringify({ jobId: 138 }),
        MessageId: "message-1",
        ReceiptHandle: "receipt-1",
      },
    ],
  };

  const client = {
    async send(command: unknown) {
      if (command instanceof SendMessageCommand) {
        const body = command.input.MessageBody;
        if (!body) {
          throw new Error("missing message body");
        }

        state.sentBodies.push(body);
        return {};
      }

      if (command instanceof ReceiveMessageCommand) {
        return { Messages: state.messages.splice(0, 1) };
      }

      if (command instanceof DeleteMessageCommand) {
        const receiptHandle = command.input.ReceiptHandle;
        if (!receiptHandle) {
          throw new Error("missing receipt handle");
        }

        state.deletedReceipts.push(receiptHandle);
        return {};
      }

      throw new Error("unexpected command");
    }
  };

  return {
    client,
    state,
  };
}
