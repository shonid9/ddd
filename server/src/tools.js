/**
 * Function-tool schemas the assistant can call, plus a helper to extract the
 * spoken reply, the HUD cards and any memory facts from a Responses API result.
 *
 * These tools are "display-only": we don't run anything server-side, we simply
 * forward the model's structured arguments to the client (which draws the
 * holographic cards / stores the memory). So a single model turn is enough —
 * no tool-output round-trip required.
 */

/** Tools passed to openai.responses.create({ tools }). */
export const TOOLS = [
  { type: 'web_search_preview' },
  {
    type: 'function',
    name: 'show_panel',
    description:
      'Open a holographic HUD card for the user to display rich, structured information ' +
      '(weather, news, search results, a summary, a recommendation, a list, a note or a reminder). ' +
      'Always ALSO speak a short natural Hebrew sentence alongside it.',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['weather', 'news', 'search', 'summary', 'recommendation', 'list', 'note', 'reminder'],
          description: 'The type of card, controls the icon/accent.',
        },
        title: { type: 'string', description: 'Short Hebrew title.' },
        subtitle: { type: 'string', description: 'Optional short Hebrew subtitle.' },
        body: { type: 'string', description: 'Optional short Hebrew paragraph.' },
        bullets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of short Hebrew bullet points.',
        },
        source: { type: 'string', description: 'Optional source/citation label.' },
      },
      required: ['kind', 'title'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'remember',
    description:
      'Persist a durable personal fact about the user for future conversations ' +
      '(name, preference, location, goal, context). Use sparingly for things worth remembering.',
    parameters: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'The fact to remember, phrased concisely in Hebrew.' },
      },
      required: ['fact'],
      additionalProperties: false,
    },
  },
];

/**
 * Parse a Responses API result into { reply, cards, memory }.
 * Tolerant of shape differences across SDK/model versions.
 */
export function parseResponse(response) {
  const cards = [];
  const memory = [];

  const output = Array.isArray(response?.output) ? response.output : [];
  for (const item of output) {
    if (item?.type !== 'function_call') continue;
    let args = {};
    try {
      args = typeof item.arguments === 'string' ? JSON.parse(item.arguments) : item.arguments || {};
    } catch {
      args = {};
    }
    if (item.name === 'show_panel' && args && args.title) {
      cards.push({
        kind: args.kind || 'note',
        title: String(args.title),
        subtitle: args.subtitle ? String(args.subtitle) : undefined,
        body: args.body ? String(args.body) : undefined,
        bullets: Array.isArray(args.bullets) ? args.bullets.map(String).slice(0, 8) : undefined,
        source: args.source ? String(args.source) : undefined,
      });
    } else if (item.name === 'remember' && args && args.fact) {
      memory.push(String(args.fact));
    }
  }

  let reply = (response?.output_text || '').trim();

  // If the model only opened a card without speaking, synthesise a short line.
  if (!reply && cards.length > 0) {
    reply = cards[0].title;
  }

  return { reply, cards, memory };
}
