import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scholar Agent",
  description: "Agent-enhanced paper reader",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script id="mathjax-config" strategy="beforeInteractive">
          {`
            window.MathJax = {
              loader: {load: ['[tex]/enrich']},
              tex: {
                packages: {'[+]': ['enrich']},
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                processEnvironments: true
              },
              options: {
                enableEnrichment: true,
                renderActions: {
                  addDataLatex: [10, (doc) => {
                    for (const math of doc.math) {
                      const node = math.typesetRoot;
                      if (node && node.setAttribute) {
                        node.setAttribute('data-latex', math.math);
                      }
                    }
                  }, '']
                },
                // Skip parsing for math that has already been processed or is in hidden elements
                ignoreHtmlClass: 'mjx-ignore',
                processHtmlClass: 'mjx-process'
              },
              startup: {
                pageReady: () => {
                  return window.MathJax.startup.defaultPageReady().then(() => {
                    window.dispatchEvent(new CustomEvent('MathJaxReady'));
                  });
                }
              }
            };
          `}
        </Script>
        <Script
          src="https://cdn.jsdelivr.net/npm/mathjax@4.0.0-beta.7/es5/tex-chtml.js"
          id="MathJax-script"
          strategy="afterInteractive"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
