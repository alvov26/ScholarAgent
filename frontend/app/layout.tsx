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
              tex: {
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                processEnvironments: true,
                packages: {'[+]': ['base', 'ams', 'noerrors', 'noundefined']}
              },
              mml: {
                // MathML input options for LaTeXML output
              },
              options: {
                enableMenu: false,
                menuOptions: {
                  settings: {
                    assistiveMml: true
                  }
                },
                enableEnrichment: true,
                sre: {
                  speech: 'deep'  // Enable semantic enrichment
                },
                renderActions: {
                  addMenu: []
                }
              },
              chtml: {
                fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2'
              },
              startup: {
                pageReady: () => {
                  return window.MathJax.startup.defaultPageReady().then(() => {
                    console.log('MathJax fully loaded, version:', window.MathJax.version);
                    console.log('Semantic enrichment enabled:', window.MathJax.config.options.enableEnrichment);
                    window.dispatchEvent(new CustomEvent('MathJaxReady'));
                  });
                }
              }
            };
          `}
        </Script>
        <Script
          src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"
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
