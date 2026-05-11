import "server-only";
import { env } from "@/lib/env";

export type MonthlyVolume = "<500" | "500-1500" | "1500-5000" | "5000+";

export interface ContactPayload {
  name: string;
  email: string;
  company: string;
  monthlyVolume: MonthlyVolume;
  message: string | null;
  source: string;
}

type SlackBlock =
  | { type: "section"; text: { type: "mrkdwn"; text: string } }
  | { type: "section"; fields: Array<{ type: "mrkdwn"; text: string }> };

export async function postContactToSlack(payload: ContactPayload): Promise<void> {
  const url = env.CONTACT_SLACK_WEBHOOK_URL;
  if (!url) {
    throw new Error("CONTACT_SLACK_WEBHOOK_URL is not configured");
  }

  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*New contact request* from source \`${payload.source}\``,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Name*\n${payload.name}` },
        { type: "mrkdwn", text: `*Email*\n${payload.email}` },
        { type: "mrkdwn", text: `*Company*\n${payload.company}` },
        { type: "mrkdwn", text: `*Monthly volume*\n${payload.monthlyVolume}` },
      ],
    },
  ];

  if (payload.message) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Message*\n${payload.message}` },
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blocks }),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status}`);
  }
}
