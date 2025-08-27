import { fetchWeatherData } from '@/services/internal/openmeteo';
import { SkyflameWeatherService, SkyflameWeatherOverview } from '@/services/weather';
import { fetchGeocodingData, fetchReverseGeocodingData } from '@/services/internal/openstreetmap';
import { GeocodingService, GeocodingResult } from '@/services/geocoding';


export const weatherService = new SkyflameWeatherService(fetchWeatherData);
export const geocodingService = new GeocodingService(fetchGeocodingData, fetchReverseGeocodingData);

export type Weather = SkyflameWeatherOverview;
export type { GeocodingResult };
