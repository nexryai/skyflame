export interface NominationAPIGeoCodingData {
    place_id: number;
    licence: string;
    osm_type: 'node' | 'way' | 'relation';
    osm_id: number;
    lat: string;
    lon: string;
    category: string;
    type: string;
    place_rank: number;
    importance: number;
    addresstype: string;
    name: string;
    display_name: string;
    boundingbox: [string, string, string, string]; // [南, 北, 西, 東]
    address: {
        town?: string;
        city?: string;
        county?: string;
        quarter?: string;
        neighbourhood?: string;
        province?: string;
        postcode?: string;
        country: string;
        country_code: string;
        ['ISO3166-2-lvl4']?: string;
    };
}

export type IGeocodingFetcher = (query: string) => Promise<NominationAPIGeoCodingData[]>;

export const fetchGeocodingData: IGeocodingFetcher = async (query) => {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '10');

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`Failed to fetch geocoding data: ${response.statusText}`);
    }

    return response.json() as Promise<NominationAPIGeoCodingData[]>;
};


export type IReverseGeocodingFetcher = (lat: string, lon: string) => Promise<NominationAPIGeoCodingData[]>;

export const fetchReverseGeocodingData: IReverseGeocodingFetcher = async (lat, lon) => {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', lat);
    url.searchParams.set('lon', lon);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '10');

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`Failed to fetch reverse geocoding data: ${response.statusText}`);
    }

    return response.json() as Promise<NominationAPIGeoCodingData[]>;
};