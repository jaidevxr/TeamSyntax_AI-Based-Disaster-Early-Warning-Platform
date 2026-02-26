import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Register service worker
registerSW({ 
  immediate: true,
  onRegistered(r) {
    r && setInterval(() => {
      r.update();
    }, 60 * 60 * 1000); // Check for updates every hour
  }
});

createRoot(document.getElementById("root")!).render(<App />);
