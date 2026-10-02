import Link from "next/link";

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="home-panel">
        <p className="eyebrow">University Capstone Prototype</p>
        <h1>Mock Interview</h1>
        <p>
          Practice behavioral and technical interview questions with mock AI-style
          feedback.
        </p>
        <Link className="primary-link" href="/mock-interview">
          Open Prototype
        </Link>
      </section>
    </main>
  );
}
