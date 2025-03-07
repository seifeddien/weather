import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = 9000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Service is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/retrieve-data', async (req, res) => {
  try {
    const { place } = req.query;
    
    if (!place) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required parameter: place'
      });
    }
    
    const coordinates = await getCoordinates(place);
    
    if (!coordinates) {
      return res.status(404).json({
        status: 'error',
        message: `Could not find coordinates for: ${place}`
      });
    }
    
    const weatherData = await getWeatherData(coordinates.latitude, coordinates.longitude);
    
    res.status(200).json({
      status: 'success',
      place,
      coordinates,
      weatherData
    });
  } catch (error) {
    console.error('Error fetching weather data:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve weather data',
      error: error.message
    });
  }
});

async function getCoordinates(place) {
  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      return {
        latitude: data.results[0].latitude,
        longitude: data.results[0].longitude,
        name: data.results[0].name,
        country: data.results[0].country
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error('Failed to geocode place name');
  }
}

async function getWeatherData(latitude, longitude) {
  try {
    const url = "https://api.open-meteo.com/v1/forecast";
    const params = new URLSearchParams({
      latitude,
      longitude,
      hourly: "temperature_2m,precipitation,weathercode",
      daily: "weathercode,temperature_2m_max,temperature_2m_min",
      timezone: "auto"
    });
    
    const response = await fetch(`${url}?${params}`);
    const data = await response.json();
    
    return {
      current: processCurrentWeather(data),
      hourly: processHourlyWeather(data),
      daily: processDailyWeather(data)
    };
  } catch (error) {
    console.error('Weather API error:', error);
    throw new Error('Failed to fetch weather data');
  }
}

function processCurrentWeather(data) {
  if (!data.hourly || !data.hourly.temperature_2m || data.hourly.temperature_2m.length === 0) {
    return null;
  }
  
  return {
    temperature: data.hourly.temperature_2m[0],
    weatherCode: data.hourly.weathercode ? data.hourly.weathercode[0] : null,
    precipitation: data.hourly.precipitation ? data.hourly.precipitation[0] : null,
    time: data.hourly.time ? data.hourly.time[0] : null
  };
}

function processHourlyWeather(data) {
  if (!data.hourly || !data.hourly.time) {
    return [];
  }
  
  const hourlyData = [];
  
  for (let i = 0; i < data.hourly.time.length; i++) {
    hourlyData.push({
      time: data.hourly.time[i],
      temperature: data.hourly.temperature_2m[i],
      weatherCode: data.hourly.weathercode ? data.hourly.weathercode[i] : null,
      precipitation: data.hourly.precipitation ? data.hourly.precipitation[i] : null
    });
  }
  
  return hourlyData;
}

function processDailyWeather(data) {
  if (!data.daily || !data.daily.time) {
    return [];
  }
  
  const dailyData = [];
  
  for (let i = 0; i < data.daily.time.length; i++) {
    dailyData.push({
      date: data.daily.time[i],
      maxTemperature: data.daily.temperature_2m_max[i],
      minTemperature: data.daily.temperature_2m_min[i],
      weatherCode: data.daily.weathercode[i]
    });
  }
  
  return dailyData;
}

app.listen(PORT, () => {
  console.log(`Weather API server running on port ${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}/health`);
  console.log(`Weather data endpoint: http://localhost:${PORT}/retrieve-data?place=<city-name>`);
});