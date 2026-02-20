"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function MathTestPage() {
  const [mathJaxStatus, setMathJaxStatus] = useState<string>("Checking...");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  useEffect(() => {
    addLog("Page mounted, checking MathJax...");

    const checkMathJax = () => {
      const MJ = (window as any).MathJax;

      if (!MJ) {
        addLog("MathJax not found on window");
        setMathJaxStatus("MathJax not loaded");
        return false;
      }

      addLog(`MathJax found: ${typeof MJ}`);
      addLog(`MathJax.version: ${MJ.version || "unknown"}`);
      addLog(`MathJax.typesetPromise: ${typeof MJ.typesetPromise}`);
      addLog(`MathJax.startup: ${typeof MJ.startup}`);

      if (MJ.config) {
        addLog(`MathJax.config.tex: ${JSON.stringify(MJ.config?.tex || {})}`);
      }

      if (MJ.typesetPromise) {
        setMathJaxStatus("MathJax loaded and ready");
        return true;
      } else {
        setMathJaxStatus("MathJax loaded but typesetPromise not available");
        return false;
      }
    };

    // Check immediately
    if (checkMathJax()) {
      addLog("MathJax ready on initial check");
      triggerTypeset();
    } else {
      // Listen for MathJaxReady event
      addLog("Waiting for MathJaxReady event...");

      const handleReady = () => {
        addLog("MathJaxReady event received");
        checkMathJax();
        triggerTypeset();
      };

      window.addEventListener("MathJaxReady", handleReady);

      // Also poll a few times
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        addLog(`Polling attempt ${attempts}...`);
        if (checkMathJax()) {
          clearInterval(interval);
          triggerTypeset();
        } else if (attempts >= 10) {
          clearInterval(interval);
          addLog("Gave up waiting for MathJax after 10 attempts");
        }
      }, 500);

      return () => {
        window.removeEventListener("MathJaxReady", handleReady);
        clearInterval(interval);
      };
    }
  }, []);

  const triggerTypeset = () => {
    const MJ = (window as any).MathJax;
    if (MJ && MJ.typesetPromise) {
      addLog("Calling MathJax.typesetPromise()...");
      MJ.typesetPromise()
        .then(() => {
          addLog("Typeset completed successfully!");
        })
        .catch((err: any) => {
          addLog(`Typeset error: ${err.message || err}`);
        });
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium mb-6 inline-block">
          &larr; Back to Reader
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">MathJax Sanity Check</h1>
        <p className="text-slate-500 mb-8">Testing if MathJax loads and renders correctly.</p>

        {/* Status */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Status</h2>
          <p className={`text-lg font-semibold ${mathJaxStatus.includes("ready") ? "text-green-600" : "text-amber-600"}`}>
            {mathJaxStatus}
          </p>
          <button
            onClick={triggerTypeset}
            className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700"
          >
            Manual Typeset
          </button>
        </section>

        {/* Test Cases */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Test Cases</h2>

          <div className="space-y-6">
            {/* Test 1: Inline math with $ */}
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-xs font-semibold text-slate-500 mb-2">1. Inline math with $ delimiters</h3>
              <p className="text-slate-700">
                The equation $E = mc^2$ is famous.
              </p>
              <code className="text-xs text-slate-400 mt-1 block">Source: The equation $E = mc^2$ is famous.</code>
            </div>

            {/* Test 2: Display math with $$ */}
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-xs font-semibold text-slate-500 mb-2">2. Display math with $$ delimiters</h3>
              <div className="text-slate-700">
                {'$$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$'}
              </div>
              <code className="text-xs text-slate-400 mt-1 block">Source: $$\int_0^\infty e&#123;-x^2&#125; dx = \frac&#123;\sqrt&#123;\pi&#125;&#125;&#123;2&#125;$$</code>
            </div>

            {/* Test 3: Inline math with \( \) */}
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-xs font-semibold text-slate-500 mb-2">{'3. Inline math with \\( \\) delimiters'}</h3>
              <p className="text-slate-700">
                {'The quadratic formula is \\(x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\).'}
              </p>
            </div>

            {/* Test 4: Display math with \[ \] */}
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-xs font-semibold text-slate-500 mb-2">{'4. Display math with \\[ \\] delimiters'}</h3>
              <div className="text-slate-700">
                {'\\[\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}\\]'}
              </div>
            </div>

            {/* Test 5: Raw HTML injection test */}
            <div className="pb-4">
              <h3 className="text-xs font-semibold text-slate-500 mb-2">5. Manually inserted span (should be processed)</h3>
              <p className="text-slate-700">
                Here is a test: <span className="mathjax-test">$\alpha + \beta = \gamma$</span>
              </p>
            </div>
          </div>
        </section>

        {/* Debug Logs */}
        <section className="bg-slate-900 rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Debug Logs</h2>
          <div className="font-mono text-xs text-slate-300 space-y-1 max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-slate-500">No logs yet...</p>
            ) : (
              logs.map((log, i) => <div key={i}>{log}</div>)
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
