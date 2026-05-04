import "./globals.css";

export const metadata = {
  title: "FitBeat SSR",
  description: "Server-side rendered web frontend for FitBeat"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
