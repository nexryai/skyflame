import { IWeatherFetcher } from './openmeteo';
import { OpenMeteoWeatherData } from '../types';


type Overwritable<T, K extends keyof T> = {
	[P in keyof T]: P extends K ? any : T[P];
};

// 本来であればOpen-Meteoの型とは別に定義するべきな気もするが、Open-Meteo自体はOSSなのでロックインのリスクがそこまで高くないこと、
// 別のソースに切り替える際には少なからず取得できない情報が出てきて互換性の維持は結局できないと思われる点を踏まえ、型を拡張する形で実装する
export interface WeatherOverview extends Overwritable<OpenMeteoWeatherData, 'hourly' | 'daily'> {
	hourly: Record<
		string, // time
		{
			temperature_2m: number;
			weather_code: number;
			rain: number;
			precipitation_probability: number;
			precipitation: number;
			showers: number;
			snowfall: number;
		}
	>;
	daily: Record<
		string, // time
		{
			weather_code: number;
			sunrise: string;
			sunset: string;
			uv_index_max: number;
			uv_index_clear_sky_max: number;
			temperature_2m_max: number;
			temperature_2m_min: number;
			daylight_duration: number;
			sunshine_duration: number;
		}
	>;
}

export interface IWeatherService {
	getOverview(lat: number, lon: number): Promise<WeatherOverview>;
}

export class WeatherService implements IWeatherService {
	constructor(
		private readonly fetcher: IWeatherFetcher
	) {}

	public async getOverview(lat: number, lon: number): Promise<WeatherOverview> {
		const data = await this.fetcher(lat, lon);

		return {
			...data,
			hourly: data.hourly.time.reduce((acc, time, index) => {
				acc[time] = {
					temperature_2m: data.hourly.temperature_2m[index],
					weather_code: data.hourly.weather_code[index],
					rain: data.hourly.rain[index],
					precipitation_probability: data.hourly.precipitation_probability[index],
					precipitation: data.hourly.precipitation[index],
					showers: data.hourly.showers[index],
					snowfall: data.hourly.snowfall[index],
				};
				return acc;
			}, {} as Record<string, any>),
			daily: data.daily.time.reduce((acc, time, index) => {
				acc[time] = {
					weather_code: data.daily.weather_code[index],
					sunrise: data.daily.sunrise[index],
					sunset: data.daily.sunset[index],
					uv_index_max: data.daily.uv_index_max[index],
					uv_index_clear_sky_max: data.daily.uv_index_clear_sky_max[index],
					temperature_2m_max: data.daily.temperature_2m_max[index],
					temperature_2m_min: data.daily.temperature_2m_min[index],
					daylight_duration: data.daily.daylight_duration[index],
					sunshine_duration: data.daily.sunshine_duration[index],
				};
				return acc;
			}, {} as Record<string, any>),
		} as WeatherOverview;
	}
}
