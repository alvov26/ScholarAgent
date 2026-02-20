"use client";

import dynamic from 'next/dynamic';

const PaperLoader = dynamic(() => import("@/components/reader/PaperLoader"), {
  ssr: false,
});

export default function Home() {
  return <PaperLoader />;
}
