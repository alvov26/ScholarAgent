"use client";

import React, { useEffect, useRef } from 'react';

interface LatexTextProps {
  text: string;
  className?: string;
}

declare global {
  interface Window {
    MathJax?: {
      typesetPromise: (elements?: HTMLElement[]) => Promise<void>;
      startup?: {
        promise?: Promise<void>;
      };
    };
  }
}

/**
 * LatexText - Renders text with inline LaTeX math using MathJax.
 *
 * Supports:
 * - Inline math: $...$
 * - Display math: $$...$$
 *
 * Uses MathJax (same as the main paper rendering) for proper support of
 * \mathbb, \mathcal, and other LaTeX commands.
 */
export function LatexText({ text, className = '' }: LatexTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const typeset = async () => {
      if (typeof window !== 'undefined' && window.MathJax?.typesetPromise && containerRef.current) {
        try {
          // Wait for MathJax startup if needed
          if (window.MathJax.startup?.promise) {
            await window.MathJax.startup.promise;
          }
          // Typeset the container
          await window.MathJax.typesetPromise([containerRef.current]);
        } catch (err) {
          console.error('[LatexText] MathJax typesetting error:', err);
        }
      }
    };

    // Typeset after mounting
    typeset();
  }, [text]);

  // Convert $ delimiters to \( \) for inline math (MathJax format)
  // Keep $$ as is for display math
  const convertedText = text.replace(/\$\$/g, '$$DISPLAY$$')
    .replace(/\$/g, (match, offset) => {
      // Check if this is part of $$DISPLAY$$
      if (text.substring(Math.max(0, offset - 1), offset + 2) === '$$$') {
        return match;
      }
      // Alternate between \( and \) for inline math
      const beforeText = text.substring(0, offset);
      const dollarCount = (beforeText.match(/\$/g) || []).length;
      return dollarCount % 2 === 0 ? '\\(' : '\\)';
    })
    .replace(/\$\$DISPLAY\$\$/g, '$$');

  return (
    <div ref={containerRef} className={className}>
      {convertedText}
    </div>
  );
}

export default LatexText;
