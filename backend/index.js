const express = require('express');
const cors = require('cors');
const pool = require('./db');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

console.log("Intentando conectar con el usuario:", process.env.DB_USER);
console.log("Usando la base de datos:", process.env.DB_NAME);

app.get('/api/trending-series', async (req, res) => {
  try {
    const countries = 'KR|JP|TH|CN|TW';
    const commonParams = {
      api_key: process.env.TMDB_API_KEY,
      language: 'es-ES',
      sort_by: 'popularity.desc',
      with_origin_country: countries,
      include_adult: false,
      page: 10,
    };

    const [seriesResponse, moviesResponse] = await Promise.all([
      axios.get(`https://api.themoviedb.org/3/discover/tv`, { params: commonParams }),
      axios.get(`https://api.themoviedb.org/3/discover/movie`, { params: commonParams })
    ]);

    const series = seriesResponse.data.results.map(s => ({ ...s, media_type: 'tv' }));
    const movies = moviesResponse.data.results.map(m => ({ ...m, media_type: 'movie' }));

    const combinedResults = [...series, ...movies];
    combinedResults.sort((a, b) => b.popularity - a.popularity);

    res.json(combinedResults);
  } catch (error) {
    console.error('Error al filtrar contenido:', error);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
});

app.get('/api/search', async (req, res) => {
  const { query } = req.query; 
  
  if (!query) {
    return res.status(400).json({ error: 'Debes proporcionar un nombre para buscar' });
  }

  try {
    const response = await axios.get(`https://api.themoviedb.org/3/search/multi`, {
      params: {
        api_key: process.env.TMDB_API_KEY,
        language: 'es-ES',
        query: query,
        include_adult: false
      }
    });

    const countries = ['KR', 'JP', 'TH', 'CN', 'TW'];
    const filteredResults = response.data.results.filter(item => 
      item.origin_country?.some(country => countries.includes(country)) || 
      countries.includes(item.original_language?.toUpperCase()) 
    );

    res.json(filteredResults);
  } catch (error) {
    console.error('Error en la búsqueda:', error);
    res.status(500).json({ error: 'Error al buscar en TMDB' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});