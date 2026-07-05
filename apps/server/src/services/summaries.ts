import { getGeminiClient } from "./gemini.js";

type TranscriptMessageRow = {
  id?: string;
  speaker?: string | null;
  text: string;
  created_at?: string;
};

export type MeetingTranscriptJson = {
  meetingId: string;
  messages: {
    messageNumber: number;
    speaker: string;
    text: string;
    createdAt: string;
  }[];
};

export function transcriptRowsToMeetingTranscriptJson(
  meetingId: string,
  messages: TranscriptMessageRow[]
): MeetingTranscriptJson {
  return {
    meetingId,
    messages: messages.map((message, index) => ({
      messageNumber: index + 1,
      speaker: message.speaker ?? "Unknown",
      text: message.text,
      createdAt: message.created_at ?? new Date().toISOString(),
    })),
  };
}

export async function summariseMeetingTranscript(
  transcriptJson: MeetingTranscriptJson
): Promise<string> {
  const prompt = `
You are a meeting summarisation assistant.

You will receive a meeting transcript as JSON.

Your job:
- Summarise the meeting clearly.
- Preserve who said what when it matters.
- Preserve who owns each action item.
- Preserve decisions, risks, blockers, and open questions.
- Do not invent names, deadlines, or decisions.
- If the owner is unclear, write "Owner unknown".
- If the due date is unclear, write "Due date not specified".

Return the answer in this format:

# Meeting Summary

## Executive Summary

## Key Discussion Points

## Decisions Made

## Action Items
Use this format:
- [Owner] Task - Due date

## Risks / Blockers

## Open Questions

Meeting transcript JSON:
${JSON.stringify(transcriptJson, null, 2)}
  `.trim();

  const response = await getGeminiClient().models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text ?? "";
}
