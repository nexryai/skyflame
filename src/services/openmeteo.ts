import { OpenMeteoWeatherData } from '../types';

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
        console.error(response.body)
        throw new Error(`Failed to fetch weather data: ${response.statusText}`);
    }

    return response.json() as Promise<OpenMeteoWeatherData>;
};
