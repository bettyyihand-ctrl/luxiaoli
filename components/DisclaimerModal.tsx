"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { DISCLAIMER_CONTENT } from "@/lib/constants/disclaimer";
import MarkdownMessage from "./MarkdownMessage";

interface DisclaimerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DisclaimerModal({ open, onOpenChange }: DisclaimerModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }

      if (e.key === "Tab") {
        const focusableElements = dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement> | undefined;

        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement as HTMLElement;

        if (e.shiftKey) {
          if (activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus close button on open
    closeButtonRef.current?.focus();

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, handleClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        className="relative w-full max-w-[480px] rounded-[12px] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] animate-modal-content"
      >
        {/* Close Button */}
        <button
          ref={closeButtonRef}
          onClick={handleClose}
          aria-label="Close disclaimer"
          className="absolute right-4 top-4 p-2 rounded-[6px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          <X size={20} strokeWidth={1.5} />
        </button>

        {/* Modal Content */}
        <div className="p-6 sm:p-8">
          {/* Title */}
          <h2
            id="disclaimer-title"
            className="text-[18px] font-semibold text-[var(--color-text-primary)] mb-4"
          >
            {DISCLAIMER_CONTENT.title}
          </h2>

          {/* Content */}
          <div className="text-[14px] leading-[1.6] text-[var(--color-text-primary)] mb-6 markdown-body">
            <MarkdownMessage rawText={DISCLAIMER_CONTENT.content} />
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleClose}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-[var(--color-primary)] text-white text-[13px] font-medium rounded-[var(--radius-lg)] hover:bg-[var(--color-primary-deep)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            {DISCLAIMER_CONTENT.confirmButtonText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
