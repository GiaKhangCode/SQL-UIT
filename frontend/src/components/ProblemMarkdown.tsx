import { type HTMLAttributes } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

type FontSizeMarkdownNode = {
  type: string;
  value?: string;
  children?: FontSizeMarkdownNode[];
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
};

function parseFontSizeChildren(children: FontSizeMarkdownNode[]): FontSizeMarkdownNode[] {
  const output: FontSizeMarkdownNode[] = [];
  const stack: Array<{ parent: FontSizeMarkdownNode[] }> = [];
  const tokenPattern = /\[font-size=(\d{2})\]|\[\/font-size\]/g;
  let current = output;

  const pushText = (text: string) => {
    if (text) current.push({ type: "text", value: text });
  };

  children.forEach((child) => {
    if (child.type !== "text" || typeof child.value !== "string") {
      const nestedChild = child.children
        ? { ...child, children: parseFontSizeChildren(child.children) }
        : child;
      current.push(nestedChild);
      return;
    }

    let cursor = 0;
    let match = tokenPattern.exec(child.value);
    while (match) {
      pushText(child.value.slice(cursor, match.index));
      if (match[1]) {
        const spanNode: FontSizeMarkdownNode = {
          type: "font-size",
          data: {
            hName: "span",
            hProperties: { style: { fontSize: `${match[1]}px` } },
          },
          children: [],
        };
        current.push(spanNode);
        stack.push({ parent: current });
        current = spanNode.children as FontSizeMarkdownNode[];
      } else if (stack.length) {
        current = stack.pop()?.parent || output;
      } else {
        pushText(match[0]);
      }
      cursor = match.index + match[0].length;
      match = tokenPattern.exec(child.value);
    }
    pushText(child.value.slice(cursor));
  });

  return output;
}

function remarkFontSize() {
  return (tree: FontSizeMarkdownNode) => {
    const visit = (node: FontSizeMarkdownNode) => {
      if (!node.children) return;
      node.children = parseFontSizeChildren(node.children);
    };

    visit(tree);
  };
}

const markdownComponents: Components = {
  p({ children }) {
    const rawText = typeof children === "string" ? children.trim() : "";
    const expression = rawText.replace(/\s+/g, " ");
    const isStandaloneExpression =
      expression.length > 0 &&
      expression.length <= 180 &&
      /_[A-Za-z0-9]+/.test(expression) &&
      /[*/+=-]/.test(expression) &&
      /^[\w\s().,+*/%=-]+$/.test(expression);

    if (isStandaloneExpression) {
      return (
        <pre className="problem-expression">
          <code>{expression}</code>
        </pre>
      );
    }

    return <p>{children}</p>;
  },
};

type ProblemMarkdownProps = HTMLAttributes<HTMLDivElement> & {
  children?: string;
};

export function ProblemMarkdown({ className, children = "", ...props }: ProblemMarkdownProps) {
  return (
    <div className={["problem-markdown", className].filter(Boolean).join(" ")} {...props}>
      <ReactMarkdown skipHtml remarkPlugins={[remarkFontSize]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
