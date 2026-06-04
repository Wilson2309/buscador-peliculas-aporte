# CineFlick

Buscador de peliculas, series y actores conectado a TMDB mediante backend Express.

## Como iniciar

En Windows, ejecuta:

```powershell
.\INICIAR-CINEFLICK.ps1
```

Tambien puedes abrir `INICIAR-CINEFLICK.bat` con doble clic.

La app se abre en `http://127.0.0.1:5502`. El servidor usa Python si esta instalado; si no, usa un servidor local hecho con PowerShell.
El backend se inicia en `http://localhost:3000` si existe Node.js o el Node portable de `.tools`.

## Backend

```powershell
cd backend
npm install
npm start
```

Configura `backend/.env` con tus credenciales MySQL y tu API key de TMDB. El esquema esta en `backend/src/database/schema.sql`.

## Funciones

- Busqueda de peliculas, series y actores.
- Filtros por genero, ano, popularidad y rating.
- Categorias rapidas.
- Modal de detalles.
- Favoritos guardados en el navegador.
- Login, perfil y sincronizacion con MySQL cuando hay sesion.
- Carruseles con tendencias, recomendados, proximamente y top rated.
