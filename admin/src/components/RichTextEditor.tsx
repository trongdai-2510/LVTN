'use client';

import type { ChangeEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Extension, Mark, mergeAttributes, Node } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import {
  AlignCenter,
  AlignLeft,
  FileUp,
  Image as ImageIcon,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Table as TableIcon,
  Upload,
  X
} from '@/components/icons';

import { extractItems } from '@/features/shared/extract';
import { apiClient } from '@/lib/api-client';
import { endpoints } from '@/lib/api-endpoints';
import { cn } from '@/lib/cn';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  minHeight?: number;
}

type LinkPopoverState = {
  visible: boolean;
  url: string;
  top: number;
  left: number;
};

type ImagePopoverState = {
  visible: boolean;
  tab: 'library' | 'url';
  url: string;
  top: number;
  left: number;
};

type FileRecord = Record<string, unknown>;

const IMAGE_WIDTH_OPTIONS = ['25', '50', '75', '100'] as const;
type ImageWidth = (typeof IMAGE_WIDTH_OPTIONS)[number];
const IMAGE_ALIGN_OPTIONS = ['left', 'center', 'right'] as const;
type ImageAlign = (typeof IMAGE_ALIGN_OPTIONS)[number];

function normalizeImageWidth(value: unknown): ImageWidth {
  const str = typeof value === 'string' ? value.trim() : '';
  return (IMAGE_WIDTH_OPTIONS as readonly string[]).includes(str)
    ? (str as ImageWidth)
    : '100';
}

function normalizeImageAlign(value: unknown): ImageAlign {
  const str = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (IMAGE_ALIGN_OPTIONS as readonly string[]).includes(str)
    ? (str as ImageAlign)
    : 'center';
}

function buildImageWrapperStyle(width: ImageWidth, align: ImageAlign): string {
  const parts: string[] = [`width: ${width}%`, 'height: auto', 'display: block'];
  if (align === 'left') parts.push('margin-left: 0', 'margin-right: auto');
  else if (align === 'right') parts.push('margin-left: auto', 'margin-right: 0');
  else parts.push('margin-left: auto', 'margin-right: auto');
  return parts.join('; ');
}

const EditorImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: {
        default: '100',
        parseHTML: (element) =>
          normalizeImageWidth(
            element.getAttribute('data-width') ??
              element.style.width.replace('%', '').trim()
          ),
        renderHTML: (attributes) => ({ 'data-width': normalizeImageWidth(attributes.width) })
      },
      align: {
        default: 'center',
        parseHTML: (element) => normalizeImageAlign(element.getAttribute('data-align')),
        renderHTML: (attributes) => ({ 'data-align': normalizeImageAlign(attributes.align) })
      }
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const width = normalizeImageWidth(HTMLAttributes['data-width']);
    const align = normalizeImageAlign(HTMLAttributes['data-align']);
    return [
      'img',
      mergeAttributes(HTMLAttributes, {
        style: buildImageWrapperStyle(width, align)
      })
    ];
  }
});

const EditorUnderline = Mark.create({
  name: 'underline',

  parseHTML() {
    return [
      { tag: 'u' },
      {
        style: 'text-decoration',
        getAttrs: (value) =>
          typeof value === 'string' && value.includes('underline') ? {} : false
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['u', mergeAttributes(HTMLAttributes), 0];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-u': () => this.editor.chain().focus().toggleMark(this.name).run()
    };
  }
});

const EditorTextAlign = Extension.create({
  name: 'textAlign',

  addGlobalAttributes() {
    return [
      {
        types: ['heading', 'paragraph'],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => element.style.textAlign || null,
            renderHTML: (attributes) =>
              attributes.textAlign ? { style: `text-align: ${attributes.textAlign}` } : {}
          }
        }
      }
    ];
  }
});

type MammothImageObject = {
  read: (encoding: 'base64') => Promise<string>;
  contentType: string;
};

type MammothModule = {
  convertToHtml: (
    input: { arrayBuffer: ArrayBuffer },
    options?: {
      styleMap?: string[];
      convertImage?: (image: MammothImageObject) => Promise<{ src: string }>;
    }
  ) => Promise<{
    value: string;
    messages: Array<{ type?: string; message?: string }>;
  }>;
};

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Nhập nội dung...',
  readOnly = false,
  className,
  minHeight = 160
}: RichTextEditorProps) {
  const editorWrapRef = useRef<HTMLDivElement | null>(null);
  const wordInputRef = useRef<HTMLInputElement | null>(null);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const insertionAnchorRef = useRef<number>(0);
  const [linkPopover, setLinkPopover] = useState<LinkPopoverState | null>(null);
  const [imagePopover, setImagePopover] = useState<ImagePopoverState | null>(null);
  const [imageFiles, setImageFiles] = useState<FileRecord[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [, forceToolbarRender] = useState(0);

  const editorInstance = useEditor({
    immediatelyRender: false,
    extensions: [
      // StarterKit 3.x ships Link + Underline by default; disable to avoid
      // "Duplicate extension names" warning since we register our own
      // configured Link + custom EditorUnderline below.
      StarterKit.configure({ link: false, underline: false }),
      EditorUnderline,
      EditorTextAlign,
      EditorImage,
      Link.configure({
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        HTMLAttributes: { rel: 'noopener noreferrer' }
      }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'editor-table' } }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder })
    ],
    content: value,
    editable: !readOnly,
    onUpdate({ editor: ed }) {
      onChange(ed.getHTML());
    }
  });

  useEffect(() => {
    if (!editorInstance) return;
    const current = editorInstance.getHTML();
    if (current !== value) {
      editorInstance.commands.setContent(value);
    }
  }, [value, editorInstance]);

  useEffect(() => {
    editorInstance?.setEditable(!readOnly);
  }, [readOnly, editorInstance]);

  useEffect(() => {
    if (!editorInstance) return;
    const refreshToolbar = () => forceToolbarRender((value) => value + 1);
    editorInstance.on('transaction', refreshToolbar);
    editorInstance.on('selectionUpdate', refreshToolbar);
    return () => {
      editorInstance.off('transaction', refreshToolbar);
      editorInstance.off('selectionUpdate', refreshToolbar);
    };
  }, [editorInstance]);

  useEffect(() => {
    if (!linkPopover?.visible && !imagePopover?.visible) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.link-popover') || target.closest('.image-popover')) {
        return;
      }
      setLinkPopover(null);
      setImagePopover(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [linkPopover?.visible, imagePopover?.visible]);

  useEffect(() => {
    if (!imagePopover?.visible || imagePopover.tab !== 'library') return;
    let active = true;

    async function loadImages() {
      setImageLoading(true);
      setImageError('');
      try {
        const params = new URLSearchParams({ page: '1', page_size: '24' });
        const result = await apiClient.get<unknown>(
          `${endpoints.songThanh.files}?${params.toString()}`
        );
        const files = extractItems(result).filter((item) =>
          String(item.mime_type ?? '').startsWith('image/')
        );
        if (active) setImageFiles(files);
      } catch (error) {
        if (active) {
          setImageError(error instanceof Error ? error.message : 'Không tải được Kho tệp.');
          setImageFiles([]);
        }
      } finally {
        if (active) setImageLoading(false);
      }
    }

    void loadImages();
    return () => {
      active = false;
    };
  }, [imagePopover?.visible, imagePopover?.tab]);

  if (!editorInstance) return null;
  const editor = editorInstance;

  function getPopoverPosition(): { top: number; left: number } {
    const wrapRect = editorWrapRef.current?.getBoundingClientRect();
    const fallback = { top: 40, left: 8 };

    if (!wrapRect) {
      return fallback;
    }

    const selection = window.getSelection();
    const selectionRect =
      selection && selection.rangeCount > 0
        ? selection.getRangeAt(0).getBoundingClientRect()
        : null;

    let rect = selectionRect;
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      try {
        const coords = editor.view.coordsAtPos(editor.state.selection.from);
        rect = {
          top: coords.top,
          right: coords.right,
          bottom: coords.bottom,
          left: coords.left,
          width: coords.right - coords.left,
          height: coords.bottom - coords.top,
          x: coords.left,
          y: coords.top,
          toJSON: () => ({})
        } as DOMRect;
      } catch {
        rect = null;
      }
    }

    if (!rect) {
      return fallback;
    }

    return {
      top: Math.max(40, rect.bottom - wrapRect.top + 6),
      left: Math.max(8, Math.min(rect.left - wrapRect.left, wrapRect.width - 340))
    };
  }

  function handleLinkClick() {
    const existingHref = String(editor.getAttributes('link').href ?? '');
    const position = getPopoverPosition();
    setImagePopover(null);
    setLinkPopover({ visible: true, url: existingHref, ...position });
  }

  function applyLink(url: string) {
    const nextUrl = url.trim();
    if (!nextUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: nextUrl }).run();
    }
    setLinkPopover(null);
  }

  function handleImageClick() {
    insertionAnchorRef.current = editor.state.selection.anchor;
    const position = getPopoverPosition();
    setLinkPopover(null);
    setImagePopover({ visible: true, tab: 'library', url: '', ...position });
  }

  function insertImage(src: string, alt?: string) {
    const imageSrc = src.trim();
    if (!imageSrc) return;
    const altAttribute = alt ? ` alt="${escapeHtmlAttribute(alt)}"` : '';
    editor
      .chain()
      .focus()
      .insertContentAt(insertionAnchorRef.current, `<img src="${escapeHtmlAttribute(imageSrc)}"${altAttribute} />`)
      .run();
    setImagePopover(null);
  }

  function handleHeadingChange(value: string) {
    if (value === 'paragraph') {
      editor.chain().focus().setParagraph().run();
    } else if (value === 'h2') {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    } else if (value === 'h3') {
      editor.chain().focus().toggleHeading({ level: 3 }).run();
    }
  }

  function toggleUnderline() {
    editor.chain().focus().toggleMark('underline').run();
  }

  function updateImageAttrs(attrs: { width?: ImageWidth; align?: ImageAlign }) {
    if (!editor.isActive('image')) return;
    editor.chain().focus().updateAttributes('image', attrs).run();
  }

  const activeImageAttrs = editor.isActive('image')
    ? (editor.getAttributes('image') as { width?: string; align?: string })
    : null;
  const activeImageWidth: ImageWidth | null = activeImageAttrs
    ? normalizeImageWidth(activeImageAttrs.width)
    : null;
  const activeImageAlign: ImageAlign | null = activeImageAttrs
    ? normalizeImageAlign(activeImageAttrs.align)
    : null;

  function setTextAlign(value: 'left' | 'center') {
    const { state, view } = editor;
    const { from, to } = state.selection;
    const tr = state.tr;
    let updated = false;

    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return;
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign: value });
      updated = true;
    });

    if (!updated) {
      const { $from } = state.selection;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (node.type.name === 'paragraph' || node.type.name === 'heading') {
          tr.setNodeMarkup($from.before(depth), undefined, { ...node.attrs, textAlign: value });
          updated = true;
          break;
        }
      }
    }

    if (updated) {
      view.dispatch(tr.scrollIntoView());
    }
    editor.commands.focus();
  }

  async function handleLocalImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'other');
      const result = await apiClient.postForm<{ file?: FileRecord }>(
        endpoints.songThanh.fileUpload,
        formData
      );
      const fileData = (result.file ?? result) as FileRecord;
      const src = getFileImageSource(fileData);
      if (src) {
        const altText = String(fileData.original_filename ?? fileData.original_name ?? file.name ?? '');
        const altAttribute = altText ? ` alt="${escapeHtmlAttribute(altText)}"` : '';
        editor
          .chain()
          .focus()
          .insertContentAt(insertionAnchorRef.current, `<img src="${escapeHtmlAttribute(src)}"${altAttribute} />`)
          .run();
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleWordImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    setIsImporting(true);
    setImportWarning(null);
    setImportSuccess(null);

    let uploadedCount = 0;
    let failedCount = 0;

    try {
      const mammoth = (await import('mammoth')) as MammothModule;
      const arrayBuffer = await file.arrayBuffer();

      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: [
            "p[style-name='Heading 1'] => h2:fresh",
            "p[style-name='Heading 2'] => h3:fresh",
            "p[style-name='Heading 3'] => h4:fresh"
          ],
          convertImage: async (image) => {
            try {
              const base64 = await image.read('base64');
              const dataUrl = `data:${image.contentType};base64,${base64}`;
              const resp = await fetch(dataUrl);
              const blob = await resp.blob();
              const ext = image.contentType.split('/')[1] || 'jpg';
              const formData = new FormData();
              formData.append('file', blob, `word-import-${Date.now()}.${ext}`);
              formData.append('purpose', 'other');
              const uploadResult = await apiClient.postForm<{ file?: FileRecord }>(
                endpoints.songThanh.fileUpload,
                formData
              );
              const fileData = (uploadResult.file ?? uploadResult) as FileRecord;
              const src = getFileImageSource(fileData);
              if (src) {
                uploadedCount++;
                return { src };
              }
              failedCount++;
              return { src: '' };
            } catch {
              failedCount++;
              return { src: '' };
            }
          }
        }
      );

      if (result.value) {
        const currentContent = editor.getHTML();
        const isEmpty =
          currentContent === '' ||
          currentContent === '<p></p>' ||
          currentContent === '<p></p><p></p>';

        if (!isEmpty) {
          const confirmed = window.confirm(
            'Nhập từ Word sẽ thay thế nội dung hiện tại. Tiếp tục?'
          );
          if (!confirmed) return;
        }

        editor.commands.setContent(result.value);

        if (failedCount > 0) {
          setImportWarning(
            `Đã nhập xong.${uploadedCount > 0 ? ` ${uploadedCount} ảnh upload thành công.` : ''} ${failedCount} ảnh không upload được, vui lòng thêm thủ công.`
          );
        } else if (uploadedCount > 0) {
          setImportSuccess(`Đã nhập xong. ${uploadedCount} ảnh được upload tự động thành công.`);
          setTimeout(() => setImportSuccess(null), 5000);
        }
      }
    } catch (error) {
      console.error('Word import failed:', error);
      setImportWarning('Không thể đọc file. Vui lòng đảm bảo file là .docx hợp lệ.');
      setTimeout(() => setImportWarning(null), 4000);
    } finally {
      setIsImporting(false);
    }
  }

  function ToolbarButton({
    children,
    active,
    disabled = false,
    onMouseDown,
    title,
    className
  }: {
    children: ReactNode;
    active?: boolean;
    disabled?: boolean;
    onMouseDown: () => void;
    title: string;
    className?: string;
  }) {
    return (
      <button
        type="button"
        title={title}
        disabled={disabled}
        onMouseDown={(event) => {
          event.preventDefault();
          if (!disabled) onMouseDown();
        }}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded text-sm transition-colors',
          active
            ? 'bg-blue-100 text-blue-700'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
          disabled ? 'cursor-not-allowed opacity-50' : '',
          className
        )}
      >
        {children}
      </button>
    );
  }

  const divider = <div className="mx-1 h-5 w-px flex-shrink-0 bg-gray-200" />;
  const isLeftAligned =
    editor.isActive({ textAlign: 'left' }) ||
    (!editor.isActive({ textAlign: 'center' }) && !editor.isActive({ textAlign: 'right' }));

  return (
    <div
      ref={editorWrapRef}
      className={cn('relative overflow-visible rounded border border-border bg-panel', className)}
    >
      {!readOnly && (
        <>
          <input
            ref={imageUploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLocalImageUpload}
          />
          <input
            ref={wordInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleWordImport}
          />

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-1 overflow-visible border-b border-gray-200 bg-gray-50 px-2 py-1.5">
            <select
              value={
                editor.isActive('heading', { level: 2 })
                  ? 'h2'
                  : editor.isActive('heading', { level: 3 })
                    ? 'h3'
                    : 'paragraph'
              }
              onChange={(event) => handleHeadingChange(event.target.value)}
              onMouseDown={(event) => event.stopPropagation()}
              className="mr-1 h-7 cursor-pointer rounded border border-gray-200 bg-white px-1.5 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
              style={{ minWidth: 100 }}
            >
              <option value="paragraph">Đoạn văn</option>
              <option value="h2">Tiêu đề lớn</option>
              <option value="h3">Tiêu đề nhỏ</option>
            </select>
            {divider}
            <ToolbarButton
              active={editor.isActive('bold')}
              onMouseDown={() => editor.chain().focus().toggleBold().run()}
              title="In đậm (Ctrl+B)"
            >
              B
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('italic')}
              onMouseDown={() => editor.chain().focus().toggleItalic().run()}
              title="In nghiêng (Ctrl+I)"
            >
              <span className="italic">I</span>
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('underline')}
              onMouseDown={toggleUnderline}
              title="Gạch chân (Ctrl+U)"
            >
              <span className="underline">U</span>
            </ToolbarButton>
            {divider}
            <ToolbarButton
              active={isLeftAligned}
              onMouseDown={() => setTextAlign('left')}
              title="Căn trái"
            >
              <AlignLeft size={15} />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive({ textAlign: 'center' })}
              onMouseDown={() => setTextAlign('center')}
              title="Căn giữa"
            >
              <AlignCenter size={15} />
            </ToolbarButton>
            {divider}
            <ToolbarButton
              active={editor.isActive('bulletList')}
              onMouseDown={() => editor.chain().focus().toggleBulletList().run()}
              title="Danh sách dấu chấm"
            >
              <List size={14} />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('orderedList')}
              onMouseDown={() => editor.chain().focus().toggleOrderedList().run()}
              title="Danh sách số"
            >
              <ListOrdered size={14} />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('blockquote')}
              onMouseDown={() => editor.chain().focus().toggleBlockquote().run()}
              title="Trích dẫn"
            >
              <Quote size={14} />
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('table')}
              onMouseDown={() => {
                if (editor.isActive('table')) {
                  editor.chain().focus().deleteTable().run();
                } else {
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run();
                }
              }}
              title="Chèn bảng (3x3) — bấm lại để xóa bảng"
            >
              <TableIcon size={14} />
            </ToolbarButton>
            {divider}
            <ToolbarButton
              active={false}
              onMouseDown={handleImageClick}
              title="Chèn hình ảnh từ kho"
            >
              <ImageIcon size={14} />
            </ToolbarButton>
            <ToolbarButton
              active={false}
              disabled={isUploadingImage}
              onMouseDown={() => {
                insertionAnchorRef.current = editor.state.selection.anchor;
                imageUploadInputRef.current?.click();
              }}
              title="Upload ảnh từ máy tính"
            >
              {isUploadingImage ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            </ToolbarButton>
            <ToolbarButton
              active={editor.isActive('link')}
              onMouseDown={handleLinkClick}
              title="Chèn liên kết"
            >
              <Link2 size={14} />
            </ToolbarButton>
            {divider}
            <ToolbarButton
              active={false}
              disabled={isImporting}
              onMouseDown={() => wordInputRef.current?.click()}
              title="Nhập nội dung từ file Word (.docx)"
              className="h-7 w-auto flex-shrink-0 gap-1.5 border border-gray-200 bg-white px-2 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            >
              {isImporting ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
              Nhập Word
            </ToolbarButton>
          </div>

          {activeImageAttrs && (
            <div className="flex flex-wrap items-center gap-1 border-b border-blue-200 bg-blue-50 px-2 py-1.5">
              <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Ảnh đang chọn
              </span>
              <span className="mr-1 text-[11px] text-gray-600">Rộng:</span>
              {IMAGE_WIDTH_OPTIONS.map((w) => (
                <ToolbarButton
                  key={`width-${w}`}
                  active={activeImageWidth === w}
                  onMouseDown={() => updateImageAttrs({ width: w })}
                  title={`Chiều rộng ${w}%`}
                >
                  <span className="text-[11px] font-semibold">{w}%</span>
                </ToolbarButton>
              ))}
              {divider}
              <span className="mr-1 text-[11px] text-gray-600">Canh:</span>
              <ToolbarButton
                active={activeImageAlign === 'left'}
                onMouseDown={() => updateImageAttrs({ align: 'left' })}
                title="Canh trái"
              >
                <AlignLeft size={14} />
              </ToolbarButton>
              <ToolbarButton
                active={activeImageAlign === 'center'}
                onMouseDown={() => updateImageAttrs({ align: 'center' })}
                title="Canh giữa"
              >
                <AlignCenter size={14} />
              </ToolbarButton>
              <ToolbarButton
                active={activeImageAlign === 'right'}
                onMouseDown={() => updateImageAttrs({ align: 'right' })}
                title="Canh phải"
              >
                <AlignLeft size={14} className="rotate-180" />
              </ToolbarButton>
              {divider}
              <ToolbarButton
                onMouseDown={() => editor.chain().focus().deleteSelection().run()}
                title="Xóa ảnh"
              >
                <span className="text-[11px] font-semibold text-red-600">Xóa</span>
              </ToolbarButton>
            </div>
          )}

          {importWarning && (
            <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span>{importWarning}</span>
              <button
                type="button"
                className="ml-auto rounded px-1 text-amber-700 hover:bg-amber-100"
                onClick={() => setImportWarning(null)}
              >
                ✕
              </button>
            </div>
          )}
          {importSuccess && (
            <div className="flex items-center gap-3 border-b border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
              <span>{importSuccess}</span>
              <button
                type="button"
                className="ml-auto rounded px-1 text-green-700 hover:bg-green-100"
                onClick={() => setImportSuccess(null)}
              >
                ✕
              </button>
            </div>
          )}
        </>
      )}

      {linkPopover?.visible && (
        <div
          className="link-popover absolute z-50 flex min-w-[320px] items-center gap-2 rounded-md border border-border bg-panel p-2 shadow-lg"
          style={{ top: linkPopover.top, left: linkPopover.left }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <input
            autoFocus
            value={linkPopover.url}
            placeholder="https://example.com hoặc /duong-dan"
            onChange={(event) =>
              setLinkPopover((current) =>
                current ? { ...current, url: event.target.value } : null
              )
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyLink(linkPopover.url);
              if (event.key === 'Escape') setLinkPopover(null);
            }}
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
          />
          <button
            type="button"
            onClick={() => applyLink(linkPopover.url)}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
          >
            Xong
          </button>
          {editor.isActive('link') && (
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
                setLinkPopover(null);
              }}
              className="rounded px-2 py-1 text-sm text-red-500 hover:bg-red-50"
              title="Xóa liên kết"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {imagePopover?.visible && (
        <ImagePopover
          state={imagePopover}
          files={imageFiles}
          loading={imageLoading}
          error={imageError}
          onMouseDown={(event) => event.preventDefault()}
          onTabChange={(tab) =>
            setImagePopover((current) => (current ? { ...current, tab } : null))
          }
          onUrlChange={(url) =>
            setImagePopover((current) => (current ? { ...current, url } : null))
          }
          onInsertUrl={() => insertImage(imagePopover.url)}
          onSelectFile={(file) => {
            const src = getFileImageSource(file);
            if (src) insertImage(src, getFileTitle(file));
          }}
          onInsertMultiple={(selectedFiles) => {
            for (const file of selectedFiles) {
              const src = getFileImageSource(file);
              if (src) insertImage(src, getFileTitle(file));
            }
          }}
          onClose={() => setImagePopover(null)}
        />
      )}

      <div className="overflow-y-auto" style={{ minHeight: Math.max(200, minHeight), maxHeight: 520 }}>
        <EditorContent
          editor={editor}
          className={cn(
            'prose prose-sm max-w-none p-3 text-[14px] text-text focus-within:outline-none',
            '[&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:outline-none',
            // Heading visibility — make h1/h2/h3 clearly distinct while editing
            '[&_.ProseMirror_h1]:text-[22px] [&_.ProseMirror_h1]:font-extrabold [&_.ProseMirror_h1]:leading-snug [&_.ProseMirror_h1]:mt-4 [&_.ProseMirror_h1]:mb-2 [&_.ProseMirror_h1]:text-strong',
            '[&_.ProseMirror_h2]:text-[18px] [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:leading-snug [&_.ProseMirror_h2]:mt-4 [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:text-strong [&_.ProseMirror_h2]:border-l-[3px] [&_.ProseMirror_h2]:border-primary [&_.ProseMirror_h2]:pl-3',
            '[&_.ProseMirror_h3]:text-[15px] [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:leading-snug [&_.ProseMirror_h3]:mt-3 [&_.ProseMirror_h3]:mb-1.5 [&_.ProseMirror_h3]:text-strong',
            // Paragraph rhythm — chút khoảng cách để dễ phân biệt block
            '[&_.ProseMirror_p]:my-2 [&_.ProseMirror_p]:leading-[1.65]',
            // List visuals — bullets + numbers rõ ràng
            '[&_.ProseMirror_ul]:my-2 [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul_li]:my-1 [&_.ProseMirror_ul_li::marker]:text-primary',
            '[&_.ProseMirror_ol]:my-2 [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol_li]:my-1 [&_.ProseMirror_ol_li::marker]:font-semibold [&_.ProseMirror_ol_li::marker]:text-primary',
            // Blockquote — gạch trái + nền nhẹ để nhận ra
            '[&_.ProseMirror_blockquote]:my-3 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-primary [&_.ProseMirror_blockquote]:bg-subtle [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:pr-3 [&_.ProseMirror_blockquote]:py-2 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:text-body',
            // Inline marks
            '[&_.ProseMirror_strong]:font-semibold [&_.ProseMirror_strong]:text-strong',
            '[&_.ProseMirror_em]:italic',
            '[&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline [&_.ProseMirror_a]:underline-offset-2',
            // Placeholder cho ô rỗng
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground',
            '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]'
          )}
        />
      </div>
    </div>
  );
}

function ImagePopover({
  state,
  files,
  loading,
  error,
  onMouseDown,
  onTabChange,
  onUrlChange,
  onInsertUrl,
  onSelectFile,
  onInsertMultiple,
  onClose
}: {
  state: ImagePopoverState;
  files: FileRecord[];
  loading: boolean;
  error: string;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onTabChange: (tab: ImagePopoverState['tab']) => void;
  onUrlChange: (url: string) => void;
  onInsertUrl: () => void;
  onSelectFile: (file: FileRecord) => void;
  onInsertMultiple: (files: FileRecord[]) => void;
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleInsertSelected() {
    const selected = files.filter((f) => selectedIds.has(String(f.id)));
    onInsertMultiple(selected);
    setSelectedIds(new Set());
  }

  return (
    <div
      className="image-popover absolute z-50 w-[380px] rounded-md border border-border bg-panel p-3 shadow-lg"
      style={{ top: state.top, left: state.left }}
      onMouseDown={onMouseDown}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex rounded-md border border-border bg-muted p-0.5">
          <ImageTabButton
            active={state.tab === 'library'}
            onClick={() => onTabChange('library')}
          >
            📁 Chọn từ kho tệp
          </ImageTabButton>
          <ImageTabButton active={state.tab === 'url'} onClick={() => onTabChange('url')}>
            🔗 Nhập URL
          </ImageTabButton>
        </div>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-text"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>

      {state.tab === 'library' ? (
        <div className="max-h-[300px] overflow-y-auto pr-0.5">
          {loading ? (
            <div className="rounded border border-dashed border-border bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
              Đang tải Kho tệp...
            </div>
          ) : error ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : files.length === 0 ? (
            <div className="rounded border border-dashed border-border bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
              Chưa có ảnh trong Kho tệp.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-1.5">
                {files.map((file) => {
                  const src = getFileImageSource(file);
                  const id = String(file.id);
                  const isSelected = selectedIds.has(id);
                  return (
                    <div key={id} className="relative">
                      <button
                        type="button"
                        title={getFileTitle(file)}
                        className={[
                          'group flex w-full flex-col overflow-hidden rounded border bg-muted transition-colors',
                          isSelected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary'
                        ].join(' ')}
                        onClick={() => onSelectFile(file)}
                      >
                        <div className="aspect-square w-full overflow-hidden bg-panel">
                          {src ? (
                            <img
                              src={src}
                              alt={getFileTitle(file)}
                              className="h-full w-full object-cover transition-opacity group-hover:opacity-85"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon size={18} className="text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="truncate px-1 py-0.5 text-[10px] text-muted-foreground">
                          {getFileTitle(file)}
                        </p>
                      </button>
                      <button
                        type="button"
                        aria-label={isSelected ? 'Bỏ chọn' : 'Chọn ảnh này'}
                        className={[
                          'absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded border text-[9px] transition',
                          isSelected
                            ? 'border-primary bg-primary text-white'
                            : 'border-border bg-white/80 text-transparent hover:border-primary'
                        ].join(' ')}
                        onClick={(e) => { e.stopPropagation(); toggleSelect(id); }}
                      >
                        ✓
                      </button>
                    </div>
                  );
                })}
              </div>
              {selectedIds.size > 0 && (
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                  <span className="text-[11px] text-muted-foreground">
                    Đã chọn {selectedIds.size} ảnh
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      Bỏ chọn tất cả
                    </button>
                    <button
                      type="button"
                      className="rounded bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary/90"
                      onClick={handleInsertSelected}
                    >
                      Chèn {selectedIds.size} ảnh
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="url"
            value={state.url}
            placeholder="https://example.com/anh.jpg"
            onChange={(event) => onUrlChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onInsertUrl();
              if (event.key === 'Escape') onClose();
            }}
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-400"
          />
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            onClick={onInsertUrl}
          >
            Chèn ảnh
          </button>
        </div>
      )}
    </div>
  );
}

function ImageTabButton({
  children,
  active,
  onClick
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded px-2.5 py-1 text-xs font-medium transition-colors',
        active ? 'bg-panel text-text shadow-sm' : 'text-muted-foreground hover:text-text'
      )}
    >
      {children}
    </button>
  );
}

function getFileTitle(file: FileRecord) {
  return String(
    file.original_filename ??
      file.original_name ??
      file.filename ??
      (file.id ? `Ảnh ${String(file.id).slice(0, 8)}` : 'Ảnh')
  );
}

function getFileImageSource(file: FileRecord) {
  const storedPath = String(file.stored_path ?? file.url ?? '').trim();
  if (
    storedPath.startsWith('http://') ||
    storedPath.startsWith('https://') ||
    storedPath.startsWith('/')
  ) {
    return storedPath;
  }

  const id = String(file.id ?? '').trim();
  return id ? `/public/files/${encodeURIComponent(id)}` : '';
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
