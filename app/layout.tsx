import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
 metadataBase: new URL('https://chengyu-dahui-zhang.zhangchi00708.chatgpt.site'),
 icons: { icon: '/og.png' },
 title: '成语大会 · 以词会友',
 description: '朋友聚会的成语出题器，支持限时、限词挑战和自定义 TXT 题库。',
 openGraph: { title: '成语大会 · 以词会友', description: '四个字，有你们的默契。限时与限词成语挑战。', images: [{ url: '/og.png', alt: '成语大会：四个字，有你们的默契。' }] },
 twitter: { card: 'summary_large_image', title: '成语大会 · 以词会友', description: '四个字，有你们的默契。', images: ['/og.png'] },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="zh-CN"><body>{children}</body></html>;
}
