import { bundleMDX } from 'mdx-bundler';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export async function prepareMDX(source: string) {
  // In some environments, esbuild needs to know where its binary is
  if (process.env.NODE_ENV === 'development') {
    process.env.ESBUILD_BINARY_PATH = undefined; // Let it find it automatically
  }

  const result = await bundleMDX({
    source,
    mdxOptions(options) {
      options.remarkPlugins = [
        ...(options.remarkPlugins ?? []), 
        remarkGfm,
        remarkMath
      ];
      options.rehypePlugins = [
        ...(options.rehypePlugins ?? []),
        rehypeKatex
      ];
      return options;
    },
  });

  return result.code;
}
