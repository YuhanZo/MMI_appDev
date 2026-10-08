import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  House,
  Search,
  MessagesSquare,
  Code,
  User,
  Settings,
  Sparkles,
  LogOut,
  ChevronDown,
  Menu,
  type LucideIcon,
} from "lucide-react";
import "./Navbar.css";

// Placeholder user: swap in real data once you have auth/profile set up
const USER = { name: "Jane Liu", initials: "JL" };

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

const MAIN_LINKS: NavItem[] = [
  { label: "Home", path: "/", icon: House },
  { label: "Job Search", path: "/job-search", icon: Search },
  { label: "Behavioral Interview", path: "/behavioral-interview", icon: MessagesSquare },
  { label: "Technical Interview", path: "/technical-interview", icon: Code },
];

const ACCOUNT_LINKS: NavItem[] = [
  { label: "My Profile", path: "/profile", icon: User },
  { label: "Settings", path: "/settings", icon: Settings },
];

export default function Navbar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close the profile dropdown when clicking anywhere outside it
  useEffect(() => {
    if (!profileOpen) return;
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  const closeSidebar = () => setSidebarOpen(false);
  const closeProfile = () => setProfileOpen(false);

  const renderLink = ({ label, path, icon: Icon }: NavItem) => (
    <NavLink
      key={path}
      to={path}
      end={path === "/"}
      className={({ isActive }) => (isActive ? "sidebar-link active" : "sidebar-link")}
      onClick={closeSidebar}
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <Link to="/" className="sidebar-brand" onClick={closeSidebar}>
          <Sparkles size={20} className="sidebar-brand-icon" />
          <span>Career Assistant</span>
        </Link>

        <nav className="sidebar-nav">
          {MAIN_LINKS.map(renderLink)}
          <div className="sidebar-divider" />
          {ACCOUNT_LINKS.map(renderLink)}
        </nav>

        <div className="sidebar-footer">
          "Make more informed career decisions."
          <br />
          Powered by Aivana.
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={closeSidebar} />}

      <div className="main-area">
        <header className="topbar">
          <button
            className="topbar-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>

          <div className="profile" ref={profileRef}>
            <button
              className="profile-button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              <span className="avatar">{USER.initials}</span>
              <span className="profile-name">{USER.name}</span>
              <ChevronDown size={16} />
            </button>

            {profileOpen && (
              <div className="profile-menu" role="menu">
                <Link to="/profile" role="menuitem" onClick={closeProfile}>
                  <User size={16} /> My Profile
                </Link>
                <Link to="/settings" role="menuitem" onClick={closeProfile}>
                  <Settings size={16} /> Settings
                </Link>
                <div className="profile-menu-divider" />
                <button className="profile-menu-logout" role="menuitem" onClick={closeProfile}>
                  <LogOut size={16} /> Log out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
