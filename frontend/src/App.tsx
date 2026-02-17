import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import ProjectView from './components/project/ProjectView';
import EditorView from './components/editor/EditorView';

function WelcomePage() {
  return (
    <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)]">
      <div className="text-center">
        <p className="text-lg">Select a project or create a new one</p>
        <p className="text-sm mt-1">Use the sidebar to get started</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<WelcomePage />} />
          <Route path="/projects/:projectId" element={<ProjectView />} />
          <Route path="/editor/:projectId/:audioId" element={<EditorView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
