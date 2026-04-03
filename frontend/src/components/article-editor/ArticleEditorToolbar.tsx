import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  FileCode2,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";

function ToolbarSep() {
  return <div className="hidden h-6 w-px shrink-0 bg-zinc-200 sm:block" aria-hidden />;
}

type BtnProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
};

function TBtn({ onClick, active, disabled, title, children }: BtnProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={clsx(
        "h-8 w-8 shrink-0 p-0",
        active && "bg-violet-100 text-violet-900 hover:bg-violet-200 hover:text-violet-950"
      )}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );
}

export function ArticleEditorToolbar({ editor }: { editor: Editor | null }) {
  const snap = useEditorState({
    editor,
    selector: ({ editor: ed, transactionNumber }) => {
      if (!ed) {
        return {
          transactionNumber,
          bold: false,
          italic: false,
          underline: false,
          strike: false,
          code: false,
          bullet: false,
          ordered: false,
          blockquote: false,
          link: false,
          codeBlock: false,
          al: false,
          ac: false,
          ar: false,
          aj: false,
          inTable: false,
          canUndo: false,
          canRedo: false,
          block: "paragraph" as const,
        };
      }

      return {
        transactionNumber,
        bold: ed.isActive("bold"),
        italic: ed.isActive("italic"),
        underline: ed.isActive("underline"),
        strike: ed.isActive("strike"),
        code: ed.isActive("code"),
        bullet: ed.isActive("bulletList"),
        ordered: ed.isActive("orderedList"),
        blockquote: ed.isActive("blockquote"),
        link: ed.isActive("link"),
        codeBlock: ed.isActive("codeBlock"),
        al: ed.isActive({ textAlign: "left" }),
        ac: ed.isActive({ textAlign: "center" }),
        ar: ed.isActive({ textAlign: "right" }),
        aj: ed.isActive({ textAlign: "justify" }),
        inTable: ed.isActive("table"),
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
        block: (() => {
          for (let level = 1; level <= 6; level++) {
            if (ed.isActive("heading", { level })) return `h${level}` as const;
          }
          return "paragraph" as const;
        })(),
      };
    },
  });

  if (!editor || !snap) return null;

  function setBlockType(v: string) {
    if (v === "paragraph") editor.chain().focus().setParagraph().run();
    else if (v.startsWith("h")) {
      const level = Number(v.slice(1));
      if (level >= 1 && level <= 6) {
        editor
          .chain()
          .focus()
          .setHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 })
          .run();
      }
    }
  }

  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("ลิงก์ (ว่างเพื่อลบ)", prev ?? "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (trimmed === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  }

  function setImage() {
    const url = window.prompt("URL ของรูป", "https://");
    if (url?.trim()) editor.chain().focus().setImage({ src: url.trim() }).run();
  }

  return (
    <div className="flex flex-col gap-2 rounded-t-xl border border-b-0 border-[var(--color-border)] bg-zinc-50/90 px-2 py-2">
      <div className="flex flex-wrap items-center gap-1">
        <label className="sr-only" htmlFor="article-block-type">
          รูปแบบบล็อก
        </label>
        <select
          id="article-block-type"
          className="h-8 max-w-[11rem] rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-800 shadow-sm"
          value={snap.block}
          onChange={(e) => setBlockType(e.target.value)}
        >
          <option value="paragraph">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="h5">Heading 5</option>
          <option value="h6">Heading 6</option>
        </select>
        <ToolbarSep />
        <TBtn
          title="ตัวหนา"
          active={snap.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </TBtn>
        <TBtn
          title="ตัวเอียง"
          active={snap.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </TBtn>
        <TBtn
          title="ขีดเส้นใต้"
          active={snap.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline className="h-4 w-4" />
        </TBtn>
        <TBtn
          title="ขีดฆ่า"
          active={snap.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </TBtn>
        <TBtn
          title="โค้ดอินไลน์"
          active={snap.code}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="h-4 w-4" />
        </TBtn>
        <ToolbarSep />
        <TBtn
          title="จัดชิดซ้าย"
          active={snap.al}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </TBtn>
        <TBtn
          title="จัดกึ่งกลาง"
          active={snap.ac}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </TBtn>
        <TBtn
          title="จัดชิดขวา"
          active={snap.ar}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </TBtn>
        <TBtn
          title="จัดเต็มบรรทัด"
          active={snap.aj}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify className="h-4 w-4" />
        </TBtn>
        <ToolbarSep />
        <TBtn
          title="รายการหัวข้อย่อย"
          active={snap.bullet}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </TBtn>
        <TBtn
          title="ลำดับเลข"
          active={snap.ordered}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </TBtn>
        <TBtn
          title="อ้างอิง"
          active={snap.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </TBtn>
        <TBtn
          title="บล็อกโค้ด"
          active={snap.codeBlock}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <FileCode2 className="h-4 w-4" />
        </TBtn>
        <ToolbarSep />
        <TBtn title="ลิงก์" active={snap.link} onClick={setLink}>
          <Link2 className="h-4 w-4" />
        </TBtn>
        <TBtn title="แทรกรูปในเนื้อหา" onClick={setImage}>
          <ImageIcon className="h-4 w-4" />
        </TBtn>
        <TBtn
          title="แทรกตาราง 3×3"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <Table2 className="h-4 w-4" />
        </TBtn>
        <TBtn
          title="ลบตาราง"
          disabled={!snap.inTable}
          onClick={() => editor.chain().focus().deleteTable().run()}
        >
          <Trash2 className="h-4 w-4" />
        </TBtn>
        <TBtn title="เส้นคั่น" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </TBtn>
        <ToolbarSep />
        <TBtn title="เลิกทำ" disabled={!snap.canUndo} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </TBtn>
        <TBtn title="ทำซ้ำ" disabled={!snap.canRedo} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </TBtn>
      </div>
    </div>
  );
}
