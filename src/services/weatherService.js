const config = require('../config');
const { fetchWithTimeout } = require('../utils/helpers');

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
      
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
      
      const raw = await response.json();
      const processed = this._processWeatherData(raw);
      
      this.cache.data = processed;
      this.cache.fetchedAt = now;
      
      return processed;
    } catch (error) {
      console.error('❌ Weather fetch error:', error.message);
      
      // If we have stale cache, use it
      if (this.cache.data) return this.cache.data;

      // Try wttr.in Fallback
      try {
        console.log('🔄 Trying wttr.in weather fallback...');
        const fallbackUrl = 'https://wttr.in/Duzici?format=j1';
        const response = await fetchWithTimeout(fallbackUrl);
        if (!response.ok) throw new Error(`wttr.in status error: ${response.status}`);
        const raw = await response.json();
        const processed = this._processWttrData(raw);
        
        this.cache.data = processed;
        this.cache.fetchedAt = now;
        return processed;
      } catch (fallbackError) {
        console.error('❌ wttr.in fallback error:', fallbackError.message);
        
        // Safety Fallback (Never return 500)
        return {
          current: {
            temp: 20,
            feelsLike: 20,
            humidity: 50,
            windSpeed: 0,
            condition: { text: 'Veri Bekleniyor', icon: 'cloud' },
            code: 0,
            isDay: true,
          },
          forecast: [],
          location: 'Düziçi',
          fetchedAt: new Date().toISOString(),
          error: error.message
        };
      }
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

  _processWttrData(raw) {
    const current = raw.current_condition[0];
    const forecastList = raw.weather;
    const isDay = !current.weatherIconUrl?.[0]?.value?.includes('night');

    const wmoCode = this._wwoToWmo(current.weatherCode);

    return {
      current: {
        temp: Math.round(Number(current.temp_C)),
        feelsLike: Math.round(Number(current.FeelsLikeC)),
        humidity: Number(current.humidity),
        windSpeed: Number(current.windspeedKmph),
        condition: this._getCondition(wmoCode, isDay ? 1 : 0),
        code: wmoCode,
        isDay: isDay,
      },
      forecast: forecastList.map((day) => {
        const dayWmoCode = this._wwoToWmo(day.hourly[4]?.weatherCode || day.hourly[0]?.weatherCode || 113);
        return {
          date: day.date,
          maxTemp: Math.round(Number(day.maxtempC)),
          minTemp: Math.round(Number(day.mintempC)),
          condition: this._getCondition(dayWmoCode, 1),
          code: dayWmoCode,
        };
      }),
      location: 'Düziçi',
      fetchedAt: new Date().toISOString()
    };
  }

  _wwoToWmo(code) {
    const wwo = Number(code);
    switch (wwo) {
      case 113: return 0; // Clear
      case 116: return 2; // Partly Cloudy
      case 119: case 122: return 3; // Cloudy, Overcast
      case 143: case 248: case 260: return 45; // Mist, Fog
      case 263: case 266: case 293: case 296: return 61; // Light Drizzle / Light Rain
      case 299: case 302: case 305: case 308: return 63; // Moderate/Heavy Rain
      case 311: case 314: case 317: case 320: return 63; // Sleet
      case 353: case 356: case 359: return 80; // Light/Moderate Rain Shower
      case 362: case 365: return 80; // Sleet Showers
      case 386: case 389: case 392: case 395: return 95; // Thundery
      case 227: case 230: case 323: case 326: case 329: case 332: case 335: case 338: case 368: case 371: case 374: case 377: return 73; // Snow
      default: return 0;
    }
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
