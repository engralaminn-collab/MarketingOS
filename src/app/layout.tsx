import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

const geistSans = localFont({
  src: "../../public/fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../../public/fonts/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  // --- Basic ---
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "kexsio",
    "marketing",
    "AI",
    "AI workforce",
    "AI employees",
    "social media",
    "CRM",
    "SEO",
    "automation",
    "content generation",
    "campaigns",
    "MarketingOS",
    "enterprise marketing",
    "AI agents",
    "marketing automation",
    "AI marketing platform",
  ],
  authors: [{ name: "Kexsio", url: SITE_URL }],
  creator: "Kexsio",
  publisher: "Kexsio",
  category: "Business > Marketing > Automation",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // --- Canonical ---
  alternates: {
    canonical: SITE_URL,
  },

  // --- Icons ---
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/kexsio-logo.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/kexsio-logo.png", sizes: "512x512" }],
    shortcut: "/favicon.ico",
  },

  // --- Open Graph ---
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE,
        width: 512,
        height: 512,
        alt: SITE_TITLE,
      },
    ],
  },

  // --- Twitter Card ---
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },

  // --- App manifest ---
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="canonical" href={SITE_URL} />
        <meta name="author" content="Kexsio" />
        <meta property="og:locale:alternate" content="en_US" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
