import { type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { getSpeakerStyle } from "@/lib/speakerStyles";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function colorizeSpeakers(text: string, speakers: string[]): ReactNode[] {
  if (!speakers.length) return [text];

  const pattern = new RegExp(`(${speakers.map(escapeRegex).join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    const match = speakers.find((s) => s.toLowerCase() === part.toLowerCase());
    if (!match) return part;
    return (
      <span key={`${match}-${i}`} className={`font-semibold ${getSpeakerStyle(match).label}`}>
        {part}
      </span>
    );
  });
}

function withSpeakers(children: ReactNode, speakers: string[]): ReactNode {
  if (typeof children === "string") return colorizeSpeakers(children, speakers);
  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === "string" ? (
        <span key={i}>{colorizeSpeakers(child, speakers)}</span>
      ) : (
        child
      )
    );
  }
  return children;
}

type SummaryMarkdownProps = {
  content: string;
  speakers: string[];
};

export function SummaryMarkdown({ content, speakers }: SummaryMarkdownProps) {
  const colorize = (children: ReactNode) => withSpeakers(children, speakers);

  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="mb-3 mt-1 text-xl font-semibold text-[#0A0A0A]">{colorize(children)}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-5 text-base font-semibold text-[#0A0A0A]">{colorize(children)}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-4 text-sm font-semibold text-[#0A0A0A]">{colorize(children)}</h3>
        ),
        p: ({ children }) => (
          <p className="mb-2 text-sm leading-relaxed text-[#0A0A0A]">{colorize(children)}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm text-[#0A0A0A]">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm text-[#0A0A0A]">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{colorize(children)}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-[#0A0A0A]">{colorize(children)}</strong>
        ),
        em: ({ children }) => <em className="italic">{colorize(children)}</em>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
