import { PostHog } from 'posthog-node';

let client = null;

export function getPostHog() {
  if (!process.env.POSTHOG_API_KEY) return null;
  if (!client) {
    client = new PostHog(process.env.POSTHOG_API_KEY, {
      host: 'https://us.i.posthog.com'
    });
  }
  return client;
}

export async function shutdownPostHog() {
  if (client) await client.shutdown();
}
