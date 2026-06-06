// Vercel serverless function: suggest an expense category for an item name.
// Keeps ANTHROPIC_API_KEY server-side — never expose it to the browser.
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic() // reads ANTHROPIC_API_KEY from env

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Vercel parses JSON bodies, but be defensive in case it arrives as a string.
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const { name = '', note = '', lang = 'th', categories = [] } = body

  const names = categories.map(c => (c && c.name ? String(c.name) : '')).filter(Boolean)
  if (!name.trim() || names.length === 0) {
    res.status(400).json({ error: 'name and categories are required' })
    return
  }

  // List the categories with icons to give the model context.
  const catList = categories
    .map(c => `- ${c.name}${c.icon ? ` (${c.icon})` : ''}`)
    .join('\n')

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      system:
        'You categorize a household expense into exactly one of the user\'s ' +
        'existing categories. Item names may be in Thai or English. Pick the ' +
        'single best-matching category. If none clearly fits, return "none". ' +
        'Return only the category name exactly as given.',
      messages: [
        {
          role: 'user',
          content:
            `Categories:\n${catList}\n\n` +
            `Item: ${name}\n` +
            (note ? `Note: ${note}\n` : '') +
            `Language: ${lang}`,
        },
      ],
      // Structured output: category is constrained to the user's own list,
      // so the model can never invent a category that isn't in the sheet.
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              category: { type: 'string', enum: [...names, 'none'] },
              confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
            required: ['category', 'confidence'],
            additionalProperties: false,
          },
        },
      },
    })

    const text = message.content.find(b => b.type === 'text')?.text || '{}'
    const parsed = JSON.parse(text)
    res.status(200).json({
      category: parsed.category || 'none',
      confidence: parsed.confidence || 'low',
    })
  } catch (err) {
    // Fail soft — the form still works without a suggestion.
    res.status(502).json({ error: 'categorization_failed', category: 'none', confidence: 'low' })
  }
}
