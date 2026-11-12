import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import EscolhaCadastro from '../telas/EscolhaCadastro.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <EscolhaCadastro />
    </StrictMode>
);
