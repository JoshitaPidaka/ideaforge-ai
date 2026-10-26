import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { AppProvider } from "./lib/store";
import Analysis from "./pages/Analysis";
import Batch from "./pages/Batch";
import Brief from "./pages/Brief";
import Collection from "./pages/Collection";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Workspace from "./pages/Workspace";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/classic" element={<Home />} />
          <Route path="/p/:id" element={<Workspace />} />
          <Route path="/p/:id/:module" element={<Workspace />} />
          <Route path="/brief" element={<Brief />} />
          <Route path="/analysis/:id" element={<Analysis />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/batch" element={<Batch />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  </React.StrictMode>
);
