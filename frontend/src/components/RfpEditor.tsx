'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Undo2,
} from 'lucide-react';

interface RfpEditorProps {
  content: string;
  onChange: (html: string) => void;
  /** Bump this number whenever `content` should forcibly replace the editor's current state (e.g. after AI (re)generation). */
  revision?: number;
  editable?: boolean;
}

export default function RfpEditor({ content, onChange, revision = 0, editable = true }: RfpEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
    editorProps: {
      attributes: {
        class: 'rfp-editor-content',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(content, { emitUpdate: false });
    // Only re-run when `revision` changes (an explicit request to replace content), not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, revision]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) {
    return (
      <div className="rfp-editor rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-500">
        Loading editor...
      </div>
    );
  }

  const toolbarButtons: Array<{
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    isActive?: boolean;
    onClick: () => void;
  }> = [
    {
      label: 'Bold',
      icon: Bold,
      isActive: editor.isActive('bold'),
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      icon: Italic,
      isActive: editor.isActive('italic'),
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Heading 2',
      icon: Heading2,
      isActive: editor.isActive('heading', { level: 2 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'Heading 3',
      icon: Heading3,
      isActive: editor.isActive('heading', { level: 3 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: 'Bullet list',
      icon: List,
      isActive: editor.isActive('bulletList'),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbered list',
      icon: ListOrdered,
      isActive: editor.isActive('orderedList'),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Undo',
      icon: Undo2,
      onClick: () => editor.chain().focus().undo().run(),
    },
    {
      label: 'Redo',
      icon: Redo2,
      onClick: () => editor.chain().focus().redo().run(),
    },
  ];

  return (
    <div className="rfp-editor overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
      {editable && (
        <div className="flex flex-wrap gap-1 border-b border-white/10 bg-black/20 p-2">
          {toolbarButtons.map(({ label, icon: Icon, isActive, onClick }) => (
            <button
              key={label}
              type="button"
              title={label}
              onClick={onClick}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition ${
                isActive ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      )}
      <EditorContent editor={editor} className="rfp-editor-scroll" />
    </div>
  );
}
