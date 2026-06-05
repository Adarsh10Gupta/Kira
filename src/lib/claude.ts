const getApiKey = () =>
  localStorage.getItem('KIRA_CLAUDE_KEY') ||
  localStorage.getItem('KIRA_GEMINI_KEY') ||
  import.meta.env.VITE_GEMINI_API_KEY ||
  import.meta.env.VITE_ANTHROPIC_API_KEY ||
  '';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function callClaude(
  systemPrompt: string,
  messages: Message[],
  maxTokens: number = 1024
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('No API key found. Please add your Gemini API key in Settings.');

  // Convert messages to Gemini format
  const geminiMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: geminiMessages,
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();

  // Save token usage
  try {
    const today = new Date().toISOString().split('T')[0];
    const usageKey = `kira_token_usage_${today}`;

    // Get existing usage for today
    const existing = JSON.parse(
      localStorage.getItem(usageKey) || 
      '{"requests": 0, "inputTokens": 0, "outputTokens": 0, "totalTokens": 0}'
    );

    // Gemini returns token counts in the response
    const inputTokens = data.usageMetadata?.promptTokenCount || 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

    // Update usage
    const updated = {
      requests: existing.requests + 1,
      inputTokens: existing.inputTokens + inputTokens,
      outputTokens: existing.outputTokens + outputTokens,
      totalTokens: (existing.inputTokens + inputTokens) + 
                   (existing.outputTokens + outputTokens)
    };
    localStorage.setItem(usageKey, JSON.stringify(updated));

    // Clean up yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    localStorage.removeItem(`kira_token_usage_${yesterday}`);

    window.dispatchEvent(new Event('kira_token_update'));
  } catch (e) {
    console.error('Failed to update Gemini token tracking:', e);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
}

export function getTodayUsage() {
  const today = new Date().toISOString().split('T')[0];
  const usageKey = `kira_token_usage_${today}`;
  try {
    const val = localStorage.getItem(usageKey);
    if (val) {
      const parsed = JSON.parse(val);
      return {
        requests: parsed.requests || 0,
        inputTokens: parsed.inputTokens || 0,
        outputTokens: parsed.outputTokens || 0,
        totalTokens: parsed.totalTokens || (parsed.inputTokens || 0) + (parsed.outputTokens || 0),
      };
    }
  } catch (e) {
    // ignore
  }
  return { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
}
