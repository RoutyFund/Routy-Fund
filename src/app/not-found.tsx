import Link from "next/link";
import Nav from "@/components/Nav";

export default function NotFound() {
  return (
    <main className="shell">
      <Nav />
      <div className="wrap">
        <span className="kicker">404</span>
        <h1 style={{ fontSize: 64 }}>Route not found.</h1>
        <Link className="primary" href="/">Back home</Link>
      </div>
    </main>
  );
}
