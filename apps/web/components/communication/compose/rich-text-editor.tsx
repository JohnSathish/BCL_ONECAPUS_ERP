'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { useEffect, useRef, useState } from 'react';
import { Bold, ImagePlus, Italic, Link2, List, Table2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

type Props = {
  value?: string;
  onChange?: (html: string) => void;
  className?: string;
  /** Upload a file and return a public URL to insert as an inline image. */
  onUploadImage?: (file: File) => Promise<string>;
};

export function RichTextEditor({ value, onChange, className, onUploadImage }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const onUploadImageRef = useRef(onUploadImage);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    onUploadImageRef.current = onUploadImage;
  }, [onUploadImage]);

  const insertUploadedImage = async (file: File) => {
    const upload = onUploadImageRef.current;
    const ed = editorRef.current;
    if (!upload || !ed) return;
    setUploadingImage(true);
    try {
      const url = await upload(file);
      if (url?.trim()) {
        ed.chain()
          .focus()
          .setImage({
            src: url.trim(),
            alt: file.name.replace(/\.[^.]+$/, '') || 'Image',
          })
          .run();
      }
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'rte-inline-image',
        },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value ?? '',
    onUpdate: ({ editor: ed }) => onChange?.(ed.getHTML()),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[180px] px-3 py-2 focus:outline-none',
      },
      handlePaste: (_view, event) => {
        if (!onUploadImageRef.current) return false;
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find((item) => item.type.startsWith('image/'));
        if (!imageItem) return false;
        const file = imageItem.getAsFile();
        if (!file) return false;
        event.preventDefault();
        void insertUploadedImage(file);
        return true;
      },
      handleDrop: (_view, event) => {
        if (!onUploadImageRef.current) return false;
        const file = Array.from(event.dataTransfer?.files ?? []).find((f) =>
          f.type.startsWith('image/'),
        );
        if (!file) return false;
        event.preventDefault();
        void insertUploadedImage(file);
        return true;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const next = value ?? '';
    if (editor.getHTML() === next) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;

  const insertImageFromUrl = () => {
    const url = window.prompt('Image URL');
    if (!url?.trim()) return;
    editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  const onPickImage = (file: File | null) => {
    if (!file || !onUploadImage) return;
    void insertUploadedImage(file);
  };
  return (
    <div
      className={cn(
        'rounded-xl border border-border/80 bg-background [&_.rte-inline-image]:my-3 [&_.rte-inline-image]:block [&_.rte-inline-image]:h-auto [&_.rte-inline-image]:max-w-full [&_.rte-inline-image]:rounded-lg',
        className,
      )}
    >
      <div className="flex flex-wrap gap-1 border-b border-border/60 p-2">
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('bold') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editor.isActive('italic') ? 'default' : 'ghost'}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const url = window.prompt('URL');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
        >
          <Link2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          title={onUploadImage ? 'Insert image' : 'Insert image from URL'}
          disabled={uploadingImage}
          onClick={() => {
            if (onUploadImage) {
              fileInputRef.current?.click();
              return;
            }
            insertImageFromUrl();
          }}
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <Table2 className="h-4 w-4" />
        </Button>
      </div>
      {onUploadImage ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void onPickImage(event.target.files?.[0] ?? null)}
        />
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}
