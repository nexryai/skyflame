import { WindSpeedUnit } from '@/types';

export interface OpenMeteoWeatherData {
    latitude: number;
    longitude: number;
    generationtime_ms: number;
    utc_offset_seconds: number;
    timezone: string;
    timezone_abbreviation: string;
    elevation: number;
    current_units: {
        time: string;
        interval: string;
        temperature_2m: string;
        weather_code: string;
        rain: string;
        wind_speed_10m: WindSpeedUnit;
        wind_direction_10m: string;
        wind_gusts_10m: WindSpeedUnit;
        pressure_msl: string;
        surface_pressure: string;
        precipitation: string;
        is_day: string;
        apparent_temperature: string;
        relative_humidity_2m: string;
        cloud_cover: string;
        snowfall: string;
        showers: string;
    };
    current: {
        time: string;
        interval: number;
        temperature_2m: number;
        weather_code: number;
        rain: number;
        wind_speed_10m: number;
        wind_direction_10m: number;
        wind_gusts_10m: number;
        pressure_msl: number;
        surface_pressure: number;
        precipitation: number;
        is_day: number;
        apparent_temperature: number;
        relative_humidity_2m: number;
        cloud_cover: number;
        snowfall: number;
        showers: number;
    };
    hourly_units: {
        time: string;
        temperature_2m: string;
        weather_code: string;
        rain: string;
        precipitation_probability: string;
        precipitation: string;
        showers: string;
        snowfall: string;
    };
    hourly: {
        time: string[];
        temperature_2m: number[];
        weather_code: number[];
        rain: number[];
        precipitation_probability: number[];
        precipitation: number[];
        showers: number[];
        snowfall: number[];
    };
    daily_units: {
        time: string;
        weather_code: string;
        sunrise: string;
        sunset: string;
        uv_index_max: string;
        temperature_2m_max: string;
        temperature_2m_min: string;
        daylight_duration: string;
        sunshine_duration: string;
    };
    daily: {
        time: string[];
        weather_code: number[];
        sunrise: string[];
        sunset: string[];
        uv_index_max: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        daylight_duration: number[];
        sunshine_duration: number[];
    };
}

export type IWeatherFetcher = (lat: number, lon: number) => Promise<OpenMeteoWeatherData>;

export const fetchWeatherData: IWeatherFetcher = async (lat, lon) => {
    const params = {
        latitude: lat,
        longitude: lon,
        daily: [
            'weather_code',
            'sunrise',
            'sunset',
            'uv_index_max',
            'temperature_2m_max',
            'temperature_2m_min',
            'daylight_duration',
            'sunshine_duration',
        ],
        hourly: ['temperature_2m', 'weather_code', 'rain', 'precipitation_probability', 'precipitation', 'showers', 'snowfall'],
        current: [
            'temperature_2m',
            'weather_code',
            'rain',
            'wind_speed_10m',
            'wind_direction_10m',
            'wind_gusts_10m',
            'pressure_msl',
            'surface_pressure',
            'precipitation',
            'is_day',
            'apparent_temperature',
            'relative_humidity_2m',
            'cloud_cover',
            'snowfall',
            'showers',
        ],
        timezone: 'auto',
    };
    const url = 'https://api.open-meteo.com/v1/forecast';

    const paramsString = new URLSearchParams(params as unknown as Record<string, string>).toString();

    const response = await fetch(`${url}?${paramsString}`);
    if (!response.ok) {
        console.error(await response.text())
        throw new Error(`Failed to fetch weather data: ${response.statusText}`);
    }

    return response.json() as Promise<OpenMeteoWeatherData>;
};
