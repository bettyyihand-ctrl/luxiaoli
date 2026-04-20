"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sanitizeMarkdownText } from "@/lib/markdown";

interface Props {
  rawText: string;
}

export default function MarkdownMessage({ rawText }: Props) {
  const clean = sanitizeMarkdownText(rawText || "").trim();
  if (!clean) return null;

  return (
    <div className="lx-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          table: ({ ...props }) => (
            <div className="overflow-x-auto my-3 border border-[rgba(17,17,17,0.12)] rounded-sm">
              <table className="min-w-full text-[13px] border-collapse" {...props} />
            </div>
          ),
          thead: (props) => <thead className="bg-[#F5F7FA]" {...props} />,
          th: (props) => (
            <th className="border border-[rgba(17,17,17,0.08)] px-2.5 py-1.5 text-left font-semibold" {...props} />
          ),
          td: (props) => (
            <td className="border border-[rgba(17,17,17,0.08)] px-2.5 py-1.5 align-top" {...props} />
          ),
          strong: (props) => (
            <strong className="font-semibold" {...props} />
          ),
          a: ({ href, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] underline underline-offset-2"
              {...props}
            />
          ),
          ul: (props) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
          ol: (props) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
          h1: (props) => <h1 className="text-[12px] font-bold leading-[1.4] mt-3 mb-1.5" {...props} />,
          h2: (props) => <h2 className="text-[12px] font-bold leading-[1.4] mt-2.5 mb-1.5" {...props} />,
          h3: (props) => <h3 className="text-[12px] font-semibold leading-[1.4] mt-2 mb-1" {...props} />,
          h4: (props) => <h4 className="text-[12px] font-semibold leading-[1.5] mt-2 mb-1" {...props} />,
          h5: (props) => <h5 className="text-[12px] font-semibold leading-[1.5] mt-1.5 mb-0.5" {...props} />,
          h6: (props) => <h6 className="text-[12px] font-semibold leading-[1.5] mt-1.5 mb-0.5" {...props} />,
          code: ({ className, children, ...rest }) => {
            const isBlock = /language-/.test(className || "");
            return isBlock ? (
              <pre className="my-2 p-2.5 bg-[#F5F7FA] rounded-sm overflow-x-auto text-[12px]">
                <code className={className} {...rest}>{children}</code>
              </pre>
            ) : (
              <code className="px-1 py-[1px] bg-[#F5F7FA] rounded-[3px] text-[12px]" {...rest}>{children}</code>
            );
          },
          blockquote: (props) => (
            <blockquote className="border-l-2 border-[var(--color-primary)] pl-3 my-2 text-[var(--color-text-secondary)]" {...props} />
          ),
          hr: () => <hr className="my-3 border-[rgba(17,17,17,0.08)]" />,
          p: (props) => <p className="my-1.5 leading-[1.65]" {...props} />,
        }}
      >
        {clean}
      </ReactMarkdown>
    </div>
  );
}
