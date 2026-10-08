import { Link } from "react-router-dom";
import { Search, MessagesSquare, Code, ArrowRight } from "lucide-react";
import "./Home.css";

const OPTIONS = [
  {
    title: "Job Search",
    description: "Find real job opportunities and get AI-powered fit analysis.",
    path: "/job-search",
    icon: Search,
  },
  {
    title: "Behavioral Interview",
    description: "Practice common behavioral questions and get feedback on your answers.",
    path: "/behavioral-interview",
    icon: MessagesSquare,
  },
  {
    title: "Technical Interview",
    description: "Work through technical questions and sharpen your problem-solving.",
    path: "/technical-interview",
    icon: Code,
  },
];

export default function Home() {
  return (
    <div className="home">
      <h1 className="home-title">Welcome back</h1>
      <p className="home-subtitle">What would you like to work on today?</p>

      <div className="home-grid">
        {OPTIONS.map(({ title, description, path, icon: Icon }) => (
          <Link key={path} to={path} className="home-card">
            <span className="home-card-icon">
              <Icon size={22} />
            </span>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className="home-card-cta">
              Get started <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
