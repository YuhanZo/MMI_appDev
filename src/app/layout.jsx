import "./globals.css";

export const metadata = {
  title: "Mock Interview Prototype",
  description: "Frontend prototype for a university capstone mock interview experience"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
