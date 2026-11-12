import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Cadastro from '../telas/Cadastro.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <Cadastro />
    </StrictMode>
);
