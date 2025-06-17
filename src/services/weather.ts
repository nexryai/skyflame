import { IWeatherFetcher } from './openmeteo';
import { OpenMeteoWeatherData, WindSpeedUnit } from '../types';

// 指定されたプロパティをanyにし、継承先で任意の型に上書きできるようにする
type Overwritable<T, K extends keyof T> = {
    [P in keyof T]: P extends K ? any : T[P];
};

// 各プロパティの任意の型の配列を非配列に変換する
type Flatten<T> = {
    [P in keyof T]: T[P] extends Array<infer U> ? U : T[P];
};

// Record<K, V> 型を受け取り、その値 V に新しいプロパティを追加する
type AddPropToRecordValue<R extends Record<any, any>, P extends string | number | symbol, T> = {
    [K in keyof R]: R[K] & { [key in P]: T };
};

// 本来であればOpen-Meteoの型とは別に定義するべきな気もするが、Open-Meteo自体はOSSなのでロックインのリスクがそこまで高くないこと、
// 別のソースに切り替える際には少なからず取得できない情報が出てきて互換性の維持は結局できないと思われる点を踏まえ、型を拡張する形で実装する
export interface WeatherOverview extends Overwritable<OpenMeteoWeatherData, 'hourly' | 'daily'> {
    hourly: Record<
        string, // time
        Omit<Flatten<OpenMeteoWeatherData['hourly']>, 'time'>
    >;
    daily: Record<
        string, // time
        Omit<Flatten<OpenMeteoWeatherData['daily']>, 'time'>
    >;
}

export interface SkyflameWeatherOverview extends WeatherOverview {
    // 翌日以降の天気を適切に表示するための拡張
    daily: AddPropToRecordValue<WeatherOverview['daily'],
        'summary', Record<
            string, // 時間キー (e.g., "2025-06-08T09:00")
            Omit<Flatten<OpenMeteoWeatherData['hourly']>, 'time' | 'rain' | 'temperature_2m'> & {
                temperature_2m_max: number;
                temperature_2m_min: number;
                arrow_length: number;
            }
        >
    >;
    current: OpenMeteoWeatherData['current'] & {
        beaufort_wind_scale: number;
    };
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
        } as const satisfies WeatherOverview;
    }
}

export class SkyflameWeatherService extends WeatherService implements ISkyflameWeatherService {
    // 要約において同一の天気として扱うWMOの天気コードの類似性を定義
    private readonly WMOWeatherCodeSimilarity: Array<Array<number>> = [
        [0, 1, 2, 3], // 晴れ〜曇り
        [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], // 雨
    ];

    private getBeaufortWindScale(windSpeed: number, unit: WindSpeedUnit): number {
        if (unit === WindSpeedUnit.KMH) {
            windSpeed = windSpeed / 3.6; // km/hからm/sに変換
        } else if (unit === WindSpeedUnit.MPH) {
            windSpeed = windSpeed * 0.44704; // mphからm/sに変換
        } else if (unit === WindSpeedUnit.KNOT) {
            windSpeed = windSpeed * 0.514444; // ノットからm/sに変換
        }

        // Beaufort階級の計算
        // ref: https://ja.wikipedia.org/wiki/ビューフォート風力階級
        if (windSpeed < 0.3) return 0;
        if (windSpeed < 1.6) return 1;
        if (windSpeed < 3.4) return 2;
        if (windSpeed < 5.5) return 3;
        if (windSpeed < 8.0) return 4;
        if (windSpeed < 10.8) return 5;
        if (windSpeed < 13.9) return 6;
        if (windSpeed < 17.2) return 7;
        if (windSpeed < 20.8) return 8;
        if (windSpeed < 24.5) return 9;
        if (windSpeed < 28.5) return 10;
        if (windSpeed < 32.7) return 11;
        return 12;
    }

    public async getOverview(lat: number, lon: number): Promise<SkyflameWeatherOverview> {
        // 親クラスのメソッドを呼び出し、基本的なWeatherOverviewを取得
        const baseOverview = await super.getOverview(lat, lon);

        // baseOverview.dailyを元に、summaryプロパティを持つ新しいdailyオブジェクトを生成
        const newDaily = Object.entries(baseOverview.daily).reduce((acc, [day, dailyData]) => {
            const daySummary: SkyflameWeatherOverview['daily'][string]['summary'] = {};
            const timeKeys = Object.keys(baseOverview.hourly);

            let prevKey: string | null = null;
            timeKeys.forEach((time) => {
                const hourData = baseOverview.hourly[time];

                if (time.startsWith(day)) {
                    if (prevKey) {
                        const currentWeatherCode = hourData.weather_code;
                        const prevHourWeatherCode = baseOverview.hourly[prevKey].weather_code;

                        // 前の時間の天気コードと現在の時間の天気コードが同じ場合はスキップ
                        if (currentWeatherCode === prevHourWeatherCode) {
                            daySummary[prevKey].arrow_length += 1;
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

            acc[day] = {
                ...dailyData,
                summary: daySummary,
            };

            return acc;
        }, {} as SkyflameWeatherOverview['daily']);

        return {
            ...baseOverview,
            daily: newDaily,
            current: {
                ...baseOverview.current,
                beaufort_wind_scale: this.getBeaufortWindScale(
                    baseOverview.current.wind_speed_10m,
                    baseOverview.current_units.wind_speed_10m
                ),
            },
        } as const satisfies SkyflameWeatherOverview;
    }
}
