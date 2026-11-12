import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PerfilAluno from '../telas/PerfilAluno.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <PerfilAluno />
    </StrictMode>
);
