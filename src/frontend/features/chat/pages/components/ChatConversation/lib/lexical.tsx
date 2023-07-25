import { $convertFromMarkdownString } from "@lexical/markdown";
import {
  $getRoot,
  $getSelection,
  DecoratorNode,
  ElementNode,
  LineBreakNode,
  ParagraphNode,
  RootNode,
  TextNode,
} from "lexical";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode, AutoLinkNode } from "@lexical/link";
import { TableNode, TableCellNode, TableRowNode } from "@lexical/table";
import { OverflowNode } from "@lexical/overflow";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { MarkNode } from "@lexical/mark";
import { HashtagNode } from "@lexical/hashtag";
import { CodeHighlightNode, CodeNode } from "@lexical/code";

import { TextFormatTransformer } from "@lexical/markdown";

import { find as findLinks } from "linkifyjs";

const INLINE_CODE: TextFormatTransformer = {
  format: ["code"],
  tag: "`",
  type: "text-format",
};

const BOLD_STAR: TextFormatTransformer = {
  format: ["bold"],
  tag: "*",
  type: "text-format",
};

const STRIKETHROUGH: TextFormatTransformer = {
  format: ["strikethrough"],
  tag: "~",
  type: "text-format",
};

const ITALIC_UNDERSCORE: TextFormatTransformer = {
  format: ["italic"],
  intraword: false,
  tag: "_",
  type: "text-format",
};

export const TEXT_FORMAT_TRANSFORMERS: Array<TextFormatTransformer> = [
  INLINE_CODE,
  BOLD_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
];

const URL_MATCHER =
  /([\w+]+\:\/\/)?([\w\d-]+\.)*[\w-]+[\.\:]\w+([\/\?\=\&\#\.]?[\w-]+)*\/?/gm;

const MATCHERS = [
  (text: string) => {
    const match = URL_MATCHER.exec(text);
    if (match === null) {
      return null;
    }
    const fullMatch = match[0];
    return {
      index: match.index,
      length: fullMatch.length,
      text: fullMatch,
      url: fullMatch.startsWith("http") ? fullMatch : `https://${fullMatch}`,
      attributes: fullMatch.includes("http://localhost:4000/join_group") // check if it is a special link to join a group, if it is, we don't want to open a new tab when user open the link
        ? undefined
        : { rel: "noopener", target: "_blank" }, // Optional link attributes
    };
  },
];

const MATCHERS_2 = [
  (text: string) => {
    const match = findLinks(text);
    if (match === null || match.length === 0) {
      return null;
    }
    const fullMatch = match[0];
    return {
      index: fullMatch.start,
      length: fullMatch.end - fullMatch.start,
      text: fullMatch.value,
      url: fullMatch.value.startsWith("http")
        ? fullMatch.value
        : `https://${fullMatch.value}`,
      attributes: fullMatch.value.includes("http://localhost:4000/join_group") // check if it is a special link to join a group, if it is, we don't want to open a new tab when user open the link
        ? undefined
        : { rel: "noopener", target: "_blank" }, // Optional link attributes
    };
  },
];

const LexErrorBoundary = (props: {
  onError: (err: Error) => void;
  children: React.ReactNode;
}) => {
  return <div>{props.children}</div>;
};

export const LexicalRenderer = (props: { content: string }) => {
  return (
    <div className="lexical-renderer">
      <LexicalComposer
        initialConfig={{
          namespace: "namespace",
          editorState: () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            $convertFromMarkdownString(props.content, TEXT_FORMAT_TRANSFORMERS);
          },
          theme: {
            ltr: "ltr",
            rtl: "rtl",
            placeholder: "editor-placeholder",
            paragraph: "editor-paragraph",
          },
          onError(err) {
            throw err;
          },
          nodes: [
            LineBreakNode,
            ParagraphNode,
            TextNode,
            LinkNode,
            HeadingNode,
            QuoteNode,
            ListNode,
            ListItemNode,
            CodeHighlightNode,
            CodeNode,
            HashtagNode,
            MarkNode,
            OverflowNode,
            TableNode,
            TableCellNode,
            TableRowNode,
            AutoLinkNode,
            RootNode,
            HorizontalRuleNode,
          ],
          editable: false,
        }}
      >
        <RichTextPlugin
          contentEditable={<ContentEditable className="editor-input" />}
          placeholder={<div />}
          ErrorBoundary={LexErrorBoundary}
        />
        <AutoLinkPlugin matchers={MATCHERS_2} />
        <MarkdownShortcutPlugin transformers={TEXT_FORMAT_TRANSFORMERS} />
      </LexicalComposer>
    </div>
  );
};
