import { fetchWeatherData } from '@/services/internal/openmeteo';
import { SkyflameWeatherService } from '@/services/weather';
import { fetchGeocodingData, fetchReverseGeocodingData } from '@/services/internal/openstreetmap';
import { GeocodingService } from '@/services/geocoding';


export const weatherService = new SkyflameWeatherService(fetchWeatherData);
export const geocodingService = new GeocodingService(fetchGeocodingData, fetchReverseGeocodingData);
