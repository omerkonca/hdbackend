const fetch = require('node-fetch');
const config = require('../config');

class WeatherService {
  constructor() {
    this.cache = {
      data: null,
      fetchedAt: 0,
    };
  }

  async getWeather() {
    const now = Date.now();
    if (this.cache.data && now - this.cache.fetchedAt < config.WEATHER.CACHE_TTL_MS) {
      return this.cache.data;
    }

    try {
      const url = `${config.WEATHER.API_URL}?latitude=${config.WEATHER.LAT}&longitude=${config.WEATHER.LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Weather API error');
      
      const raw = await response.json();
      const processed = this._processWeatherData(raw);
      
      this.cache.data = processed;
      this.cache.fetchedAt = now;
      
      return processed;
    } catch (error) {
      console.error('❌ Weather fetch error:', error.message);
      if (this.cache.data) return this.cache.data; // Return stale cache on error
      throw error;
    }
  }

  _processWeatherData(raw) {
    const current = raw.current;
    const daily = raw.daily;

    return {
      current: {
        temp: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        condition: this._getCondition(current.weather_code, current.is_day),
        code: current.weather_code,
        isDay: !!current.is_day,
      },
      forecast: daily.time.map((date, i) => ({
        date,
        maxTemp: Math.round(daily.temperature_2m_max[i]),
        minTemp: Math.round(daily.temperature_2m_min[i]),
        condition: this._getCondition(daily.weather_code[i], 1),
        code: daily.weather_code[i],
      })),
      location: 'Düziçi',
      fetchedAt: new Date().toISOString()
    };
  }

  _getCondition(code, isDay) {
    const map = {
      0: { text: 'Açık', icon: isDay ? 'sunny' : 'nightlight' },
      1: { text: 'Az Bulutlu', icon: isDay ? 'partly_cloudy_day' : 'partly_cloudy_night' },
      2: { text: 'Parçalı Bulutlu', icon: isDay ? 'partly_cloudy_day' : 'partly_cloudy_night' },
      3: { text: 'Bulutlu', icon: 'cloud' },
      45: { text: 'Sisli', icon: 'foggy' },
      48: { text: 'Kırağı', icon: 'ac_unit' },
      51: { text: 'Hafif Çisenti', icon: 'grain' },
      53: { text: 'Çisenti', icon: 'grain' },
      55: { text: 'Yoğun Çisenti', icon: 'grain' },
      61: { text: 'Hafif Yağmurlu', icon: 'rainy' },
      63: { text: 'Yağmurlu', icon: 'rainy' },
      65: { text: 'Sağanak Yağışlı', icon: 'rainy_heavy' },
      71: { text: 'Hafif Kar Yağışlı', icon: 'snowing' },
      73: { text: 'Kar Yağışlı', icon: 'snowing' },
      75: { text: 'Yoğun Kar Yağışlı', icon: 'snowing_heavy' },
      80: { text: 'Hafif Sağanak Yağışlı', icon: 'rainy' },
      81: { text: 'Sağanak Yağışlı', icon: 'rainy' },
      82: { text: 'Şiddetli Sağanak Yağışlı', icon: 'rainy_heavy' },
      95: { text: 'Gök Gürültülü Fırtına', icon: 'thunderstorm' },
    };

    return map[code] || { text: 'Bilinmiyor', icon: 'help_outline' };
  }
}

module.exports = new WeatherService();
