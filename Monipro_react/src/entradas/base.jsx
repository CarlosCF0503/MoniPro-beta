import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Base from '../telas/Base.jsx';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <Base />
    </StrictMode>
);
