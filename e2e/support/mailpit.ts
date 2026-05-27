const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

export interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

export const mailpit = {
  async clear(): Promise<void> {
    await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
  },

  async waitForMessageTo(email: string, timeoutMs = 10_000): Promise<MailpitMessage> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
      const { messages } = (await res.json()) as { messages: MailpitMessage[] };
      const match = messages.find((m) => m.To.some((t) => t.Address === email));
      if (match) return match;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Nenhum e-mail para ${email} em ${timeoutMs}ms`);
  },

  async getBody(id: string): Promise<string> {
    const res = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
    const data = (await res.json()) as { HTML: string; Text: string };
    return data.HTML || data.Text;
  },

  extractConfirmToken(body: string): string {
    const match = body.match(/confirmar-email\?token=([\w.-]+)/);
    if (!match) throw new Error('Token de confirmação não encontrado no e-mail');
    return match[1];
  },

  extractResetToken(body: string): string {
    const match = body.match(/nova-senha\?token=([\w.-]+)/);
    if (!match) throw new Error('Token de redefinição não encontrado no e-mail');
    return match[1];
  },
};
