import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import EscolhaDisciplina from '../telas/EscolhaDisciplina.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <EscolhaDisciplina />
    </StrictMode>
);
