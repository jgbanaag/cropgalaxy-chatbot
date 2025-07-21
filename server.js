require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

const { OPENAI_API_KEY, ASSISTANT_ID, CROPGALAXY_API_KEY } = process.env;
const PORT = process.env.PORT || 3001;
const POLLING_INTERVAL = 1000;

const GALAXY_URL = 'http://localhost:8080/api';

const verifyGalaxyAuth = async (req, res, next) => {
  if (!CROPGALAXY_API_KEY) {
    return res.status(401).json({ error: "Not authenticated with Galaxy" });
  }
  next();
};

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080'],
  methods: ['GET', 'POST']
}));
app.use(express.json());

const threads = new Map();

// ================ ROUTES =================== //
// login to Galaxy, returns API key (currently hardcoded)
app.post('/api/galaxy-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const response = await axios.post(`${GALAXY_URL}/authenticate/baseauth`, {
      login: email,
      password
    });
    const CROPGALAXY_API_KEY = response.data.api_key;
    res.json({ status: "authenticated" });
  } catch (error) {
    console.error("Galaxy login failed:", error.response?.data);
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// list all workflows
app.get('/api/workflows', verifyGalaxyAuth, async (req, res) => {
  try {
    const response = await axios.get(`${GALAXY_URL}/workflows`, {
      headers: { 'X-Api-Key': CROPGALAXY_API_KEY }
    });
    
    if (response.data.length === 0) {
      return res.status(200).json({ message: "No workflows found" });
    }
    
    const workflows = response.data.map(wf => ({
      id: wf.id,
      name: wf.name
    }));
    res.json(workflows);
    
  } catch (error) {
    console.error("Failed to fetch workflows:", error.response?.data);
    res.status(500).json({ 
      error: "Failed to fetch workflows",
      details: error.response?.data?.err_msg 
    });
  }
});

// list all histories
app.get('/api/histories', verifyGalaxyAuth, async (req, res) => {
  try {
    const response = await axios.get(`${GALAXY_URL}/histories`, {
      headers: { 'X-Api-Key': CROPGALAXY_API_KEY }
    });
    
    if (response.data.length === 0) {
      return res.status(200).json({ message: "No histories found" });
    }
    
    const histories = response.data.map(history => ({
      id: history.id,
      name: history.name,
      size: history.nice_size,
      state: history.state
    }));
    res.json(histories);
    
  } catch (error) {
    console.error("Failed to fetch histories:", {
      status: error.response?.status,
      data: error.response?.data
    });
    res.status(500).json({ 
      error: "Failed to fetch histories",
      details: error.response?.data?.err_msg 
    });
  }
});

// creates a new chat thread
app.post('/api/thread', async (req, res) => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/threads',
      {},
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
          'Content-Type': 'application/json'
        }
      }
    );
    const threadId = response.data.id;
    threads.set(threadId, []);
    res.json({ threadId });
  } catch (error) {
    console.error('Error creating thread:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

// sends a message to the assistant
app.post('/api/message', async (req, res) => {
  const { threadId, message } = req.body;
  if (!threadId || !message) {
    return res.status(400).json({ error: 'Missing threadId or message' });
  }

  try {
    // adds user message to thread
    await axios.post(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      { role: 'user', content: message },
      { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'assistants=v2' } }
    );

    // runs the assistant
    const run = await axios.post(
      `https://api.openai.com/v1/threads/${threadId}/runs`,
      { 
        assistant_id: ASSISTANT_ID,
        additional_instructions: "Omit all file references in your response"
      },
      { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'assistants=v2' } }
    );

    // waits for response (w polling)
    while (true) {
      const runStatus = await axios.get(
        `https://api.openai.com/v1/threads/${threadId}/runs/${run.data.id}`,
        { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'assistants=v2' } }
      );

      if (runStatus.data.status === 'requires_action') {
        const toolCalls = runStatus.data.required_action?.submit_tool_outputs?.tool_calls;

        console.log("Incoming request body:", req.body); // Check frontend data
        console.log("RunStatus tool_calls:", runStatus.data.required_action?.submit_tool_outputs?.tool_calls);

        if (!toolCalls || toolCalls.length === 0) {
          console.error("No tool calls found. Full runStatus:", runStatus.data);
          return res.status(400).json({ error: "Assistant triggered no tools" });
        }

        const toolOutputs = await Promise.all(
          toolCalls.map(async (toolCall) => {
            try {
              if (toolCall.function.name === "list_workflows") {
                const result = await axios.get('http://localhost:3001/api/workflows');
                const workflows = result.data.map(wf => `- ${wf.name} (ID: ${wf.id})`).join('\n');
                return {
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({
                    workflows: result.data,  // Raw data for debugging
                    message: `Available workflows:\n${workflows}`
                  }),
                };
              } else if (toolCall.function.name === "list_histories") {
                const result = await axios.get('http://localhost:3001/api/histories');
                const histories = result.data.map(h => `- ${h.name} (ID: ${h.id}, Status: ${h.state})`).join('\n');
                return {
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({
                    message: `Available histories:\n${histories}`
                  }),
                };
              }
              else if (toolCall.function.name === "list_datasets") {
                const { history_id } = JSON.parse(toolCall.function.arguments);
                const result = await axios.get(`http://localhost:3001/api/histories/${history_id}/datasets`);
                const datasets = result.data.map(d => `- ${d.name} (Type: ${d.type}, Size: ${d.size} bytes)`).join('\n');
                return {
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({
                    message: `Datasets in history ${history_id}:\n${datasets}`
                  }),
                };
              }
            } catch (error) {
              console.error(`Tool call ${toolCall.function.name} failed:`, error);
              return {
                tool_call_id: toolCall.id,
                output: JSON.stringify({ error: "Tool execution failed" }),
              };
            }
          })
        );

        // Submit all tool outputs back to OpenAI
        await axios.post(
          `https://api.openai.com/v1/threads/${threadId}/runs/${run.data.id}/submit_tool_outputs`,
          { tool_outputs: toolOutputs },
          { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'assistants=v2' } }
        );
      } 
      else if (runStatus.data.status === 'completed') {
        const messages = await axios.get(
          `https://api.openai.com/v1/threads/${threadId}/messages`,
          { headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'OpenAI-Beta': 'assistants=v2' } }
        );

        const rawResponse = messages.data.data[0].content[0].text.value;
        const response = rawResponse.replace(/【[\d:]+†source】/g, '');
        res.json({ response });
        break;
      }

      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
    }
  } catch (error) {
    console.error('Error processing message:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// starts server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});