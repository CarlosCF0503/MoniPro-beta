import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PerfilMonitor from '../telas/PerfilMonitor.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <PerfilMonitor />
    </StrictMode>
);
