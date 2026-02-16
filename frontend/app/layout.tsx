import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

import './global.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
    title: 'TastyRock Marketplace',
    description: 'Gaming marketplace for cards, items, and collectibles',
}

export const viewport: Viewport = {
    themeColor: '#0d1117',
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en">
            <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
        </html>
    )
}
