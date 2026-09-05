import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { AtlasPage } from './pages/Atlas';
import { HomePage } from './pages/Home';
import { LessonPage } from './pages/Lesson';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <div className="h-full">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lesson/:id" element={<LessonPage />} />
          <Route path="/atlas" element={<AtlasPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  </StrictMode>,
);
