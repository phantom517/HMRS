import type {Metadata} from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Patan Academy Emergency & Critical Care HRMS',
  description:
    'Hospital Human Resource Management System for Emergency & Trauma departments featuring duty rosters, calendar scheduling, shift type management, fatigue guardrails, leave tracking, and clinical compliance analytics.',
  openGraph: {
    title: 'Patan Academy Emergency & Critical Care HRMS',
    description:
      'Hospital Human Resource Management System for Emergency & Trauma departments featuring duty rosters, calendar scheduling, shift type management, fatigue guardrails, leave tracking, and clinical compliance analytics.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Patan Academy Emergency & Critical Care HRMS',
    description:
      'Hospital Human Resource Management System for Emergency & Trauma departments featuring duty rosters, calendar scheduling, shift type management, fatigue guardrails, leave tracking, and clinical compliance analytics.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
