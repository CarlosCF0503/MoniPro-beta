import { defineConfig } from '@prisma/config';
import 'dotenv/config'; // <-- Essa linha faz a mágica de ler o seu .env

export default defineConfig({
    datasource: {
        url: process.env.DATABASE_URL,
    },
});