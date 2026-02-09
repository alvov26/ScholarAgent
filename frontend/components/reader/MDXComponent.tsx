"use client";

import React, { useMemo } from 'react';
import { getMDXComponent } from 'mdx-bundler/client';

interface MDXComponentProps {
  code: string;
  components?: Record<string, React.ComponentType<any>>;
}

export default function MDXComponent({ code, components }: MDXComponentProps) {
  const Component = useMemo(() => getMDXComponent(code), [code]);

  return (
    <div className="mdx-content">
      <Component components={components} />
    </div>
  );
}
