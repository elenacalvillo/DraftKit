import { Mark, mergeAttributes } from "@tiptap/react";

export interface StickyCommentOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    stickyComment: {
      setStickyComment: (attrs: { comment: string; author: string }) => ReturnType;
      unsetStickyComment: () => ReturnType;
      updateStickyComment: (attrs: { comment: string }) => ReturnType;
    };
  }
}

export const StickyComment = Mark.create<StickyCommentOptions>({
  name: "stickyComment",

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      comment: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment"),
        renderHTML: (attrs) => ({ "data-comment": attrs.comment }),
      },
      author: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-author"),
        renderHTML: (attrs) => ({ "data-author": attrs.author }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span.dk-highlight" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "dk-highlight",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setStickyComment:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetStickyComment:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
      updateStickyComment:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    };
  },
});
