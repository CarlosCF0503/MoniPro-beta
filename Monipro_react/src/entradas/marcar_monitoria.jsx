import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MarcarMonitoria from '../telas/MarcarMonitoria.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <MarcarMonitoria />
    </StrictMode>
);
