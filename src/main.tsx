import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Apply persisted theme before first paint so all pages stay in sync.
try {
	const savedTheme = localStorage.getItem("theme") === "light" ? "light" : "dark";
	if (savedTheme === "dark") {
		document.documentElement.classList.add("dark");
	} else {
		document.documentElement.classList.remove("dark");
	}
} catch {
	document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")!).render(<App />);
