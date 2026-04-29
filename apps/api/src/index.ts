import { HumanMessage } from 'langchain';
import { agent } from './agent';
import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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