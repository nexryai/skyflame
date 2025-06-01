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

export interface SkyflameWeatherOverview extends WeatherOverview {
	// 翌日以降の天気を適切に表示するための拡張
	daily_summary: Record<
		string, // 該当する日
		// 天気の変動を格納
		Record<
			string, // 時間
			{
				weather_code: number;
				temperature_2m_max: number;
				temperature_2m_min: number;
				precipitation_probability: number;
				precipitation: number;
				showers: number;
				snowfall: number;
				arrow_length: number; // 次の変動までの時間を示す矢印の長さ（次のRecordまでの時間の長さに比例）
			}
		>
	>;
}

export interface IWeatherService {
	getOverview(lat: number, lon: number): Promise<WeatherOverview>;
}

export interface ISkyflameWeatherService {
	getOverview(lat: number, lon: number): Promise<SkyflameWeatherOverview>;
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

export class SkyflameWeatherService extends WeatherService implements ISkyflameWeatherService {
	// 要約において同一の天気として扱うWMOの天気コードの類似性を定義
	private readonly WMOWeatherCodeSimilarity: Array<Array<number>> = [
		[0, 1, 2, 3], // 晴れ〜曇り
		[51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], // 雨
	];

	public async getOverview(lat: number, lon: number): Promise<SkyflameWeatherOverview> {
		const overview = await super.getOverview(lat, lon);

		const dailySummary: Record<string, any> = {};

		Object.keys(overview.daily).forEach((day) => {
			const dailyData = overview.daily[day];
			const timeKeys = Object.keys(overview.hourly);
			const daySummary: Record<string, any> = {};

			let prevKey: string | null = null;
			timeKeys.forEach((time) => {
				const hourData = overview.hourly[time];

				if (time.startsWith(day)) {
					if (prevKey) {
						const currentWeatherCode = hourData.weather_code;
						const prevHourWeatherCode = overview.hourly[prevKey].weather_code;

						// 前の時間の天気コードと現在の時間の天気コードが同じ場合はスキップ
						if (currentWeatherCode === prevHourWeatherCode) {
							daySummary[prevKey].arrow_length += 1; // 矢印の長さを増やす
							return;
						}

						// 一文字目が等しい場合（概ね等しい天気である場合）
						if (currentWeatherCode.toString().charAt(0) === prevHourWeatherCode.toString().charAt(0)) {
							// prevDataの数値よりcurrentの方が大きい場合、currentのweather_codeをprevDataに上書き
							// weather_codeが大きい方が悪天候を示す傾向にあるため
							daySummary[prevKey].weather_code = Math.max(currentWeatherCode, prevHourWeatherCode);

							daySummary[prevKey].arrow_length += 1;
							return;
						}

						// WMOWeatherCodeSimilarityに含まれる場合は、同じ天気として扱う
						const isSimilar = this.WMOWeatherCodeSimilarity.some(
							(group) => group.includes(currentWeatherCode) && group.includes(prevHourWeatherCode)
						);

						if (isSimilar) {
							daySummary[prevKey].weather_code = Math.max(currentWeatherCode, prevHourWeatherCode);
							daySummary[prevKey].arrow_length += 1;
							return;
						}

						const parsedTime = new Date(time);
						const parsedPrevKey = new Date(prevKey);

						// 自身がAM 6:00以前のデータかつprevKeyのデータもそうである場合、prevKeyのデータを削除する
						// 早朝のデータがやたら多くても意味がないため
						if (parsedTime.getHours() <= 6 && parsedPrevKey.getHours() < 6) {
							delete daySummary[prevKey];
						}

						// 自身が22:00以降のデータかつprevKeyのデータもそうである場合
						if (parsedTime.getHours() > 22 && parsedPrevKey.getHours() >= 22) {
							// prevKeyのweather_codeを大きい方で上書きしてこのデータは無視する
							daySummary[prevKey].weather_code = Math.max(currentWeatherCode, prevHourWeatherCode);
							daySummary[prevKey].arrow_length += 1;
							return;
						}
					}

					prevKey = time;

					daySummary[time] = {
						weather_code: hourData.weather_code,
						temperature_2m_max: dailyData.temperature_2m_max,
						temperature_2m_min: dailyData.temperature_2m_min,
						precipitation_probability: hourData.precipitation_probability,
						precipitation: hourData.precipitation,
						showers: hourData.showers,
						snowfall: hourData.snowfall,
						arrow_length: 1, // デフォルトの矢印の長さ
					};
				}
			});

			dailySummary[day] = daySummary;
		});

		return {
			...overview,
			daily_summary: dailySummary,
		} as SkyflameWeatherOverview;
	}
}
