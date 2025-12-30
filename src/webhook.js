import crypto from 'crypto';
import bodyParser from 'body-parser';
import { handleGithubEvent } from './githubEvents.js';

export function createWebhookHandler({ app, client, storage }) {
  // Use raw body so we can verify signature
  app.post('/github-webhook', bodyParser.raw({ type: '*/*' }), async (req, res) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const sig = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];

    if (secret) {
      if (!sig) {
        console.warn('Missing signature header');
        return res.status(400).send('Missing signature');
      }
      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(req.body).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig))) {
        console.warn('Invalid signature');
        return res.status(401).send('Invalid signature');
      }
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf-8'));
    } catch (e) {
      console.error('Invalid JSON payload', e);
      return res.status(400).send('Invalid JSON');
    }

    try {
      await handleGithubEvent({ client, storage, event, payload });
    } catch (e) {
      console.error('Error handling event', e);
    }

    res.status(204).send();
  });
}
