"use client";

import { useRef, useState } from "react";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({
  accept,
  label,
  name,
  required,
  onSelect,
  onRemove,
  file,
}: {
  accept?: string;
  label: string;
  name: string;
  required?: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
  file: { name: string; size: number } | null;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (!dropped) return;
    onSelect(dropped);
    // The hidden input is what the form submits, and input.files is
    // read-only — populate it through a DataTransfer so a dropped file
    // actually reaches the server (previously the form sent no file and
    // the post was rejected with "اختر ملفاً للمنشور").
    if (inputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(dropped);
      inputRef.current.files = transfer.files;
    }
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected) onSelect(selected);
  }

  // The input must stay mounted across the selected/unselected re-render:
  // a file input that leaves the DOM loses its value, so the form would
  // submit without the file field.
  const input = (
    <input
      ref={inputRef}
      type="file"
      name={name}
      accept={accept}
      required={required}
      onChange={handleChange}
      hidden
    />
  );

  if (file) {
    return (
      <>
        <div className="file-upload file-upload--selected">
          <div className="file-upload__info">
            <span className="file-upload__name">{file.name}</span>
            {file.size > 0 && (
              <span className="file-upload__size">{formatSize(file.size)}</span>
            )}
          </div>
          <button
            type="button"
            className="file-upload__remove"
            onClick={() => {
              onRemove();
              if (inputRef.current) inputRef.current.value = "";
            }}
            aria-label="إزالة"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {input}
      </>
    );
  }

  return (
    <>
      <div
        className={`file-upload ${dragging ? "file-upload--dragging" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label={`اختر ${label}`}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          inputRef.current?.click();
        }}
      >
        <svg className="file-upload__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
        </svg>
        <div className="file-upload__text">
          <strong>اختر {label}</strong>
          <span className="file-upload__drop-hint">أو اسحب وأفلت الملف هنا</span>
          <span className="file-upload__tap-hint">اضغط لاختيار الملف من جهازك</span>
          <span className="file-upload__hint">الحد الأقصى 100 ميجابايت</span>
        </div>
      </div>
      {input}
    </>
  );
}
