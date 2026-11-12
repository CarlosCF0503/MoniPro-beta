import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CadastroDisciplina from '../telas/CadastroDisciplina.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <CadastroDisciplina />
    </StrictMode>
);
