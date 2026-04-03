import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import type { Extensions } from "@tiptap/core";

export function createArticleEditorExtensions(placeholder: string): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: {
        openOnClick: false,
        HTMLAttributes: {
          class: "text-violet-700 underline underline-offset-2",
        },
      },
    }),
    Placeholder.configure({ placeholder }),
    TextAlign.configure({
      types: ["heading", "paragraph", "blockquote"],
    }),
    Image.configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: {
        class: "max-w-full h-auto rounded-lg my-4",
      },
    }),
    TableKit.configure({
      table: { resizable: false },
    }),
  ];
}
