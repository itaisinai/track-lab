import { HumanMessage } from 'langchain';
import { agent } from './agent.ts';
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
  const origin = req.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

app.post('/agent', async (req: express.Request, res: express.Response) => {
  try {
    const result = await agent.invoke({
        messages: [
            new HumanMessage(req.body.message)
        ]
    });
    const lastMessage = result.messages[result.messages.length - 1];
    console.log(lastMessage.content);
    res.json(lastMessage);
  } catch (error) {
    console.error('Error invoking agent:', error);
    res.status(500).json({ error: 'An error occurred while processing the request.' });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
