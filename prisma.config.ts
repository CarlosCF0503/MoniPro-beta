import { defineConfig } from '@prisma/config';
import 'dotenv/config'; // <-- Essa linha faz a mágica de ler o seu .env

export default defineConfig({
    migrations: {
        // npx prisma db seed (ou npm run seed). Só para hml e local; ver prisma/seed.js.
        seed: 'node prisma/seed.js'
    },
    datasource: {
        url: process.env.DATABASE_URL
    }
});
