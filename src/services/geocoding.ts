import { IGeocodingFetcher, IReverseGeocodingFetcher, NominationAPIGeoCodingData } from "./internal/openstreetmap";


export interface GeocodingResult extends Omit<NominationAPIGeoCodingData, 'licence' | 'osm_type' | 'osm_id' | 'place_rank' | 'importance' | 'boundingbox'> {}

export interface IGeocodingService {
    geocoding(query: string): Promise<GeocodingResult[]>;
    reverseGeocoding(lat: string, lon: string): Promise<GeocodingResult[]>;
}

export class GeocodingService implements IGeocodingService {
    constructor(
        private readonly fetcher: IGeocodingFetcher,
        private readonly reverseFetcher: IReverseGeocodingFetcher
    ) {}

    public async geocoding(query: string): Promise<GeocodingResult[]> {
        const data = await this.fetcher(query);
        return data.map(item => ({
            place_id: item.place_id,
            name: item.name,
            display_name: item.display_name,
            lat: item.lat,
            lon: item.lon,
            category: item.category,
            type: item.type,
            addresstype: item.addresstype,
            address: item.address
        }));
    }

    public async reverseGeocoding(lat: string, lon: string): Promise<GeocodingResult[]> {
        const data = await this.reverseFetcher(lat, lon);
        return data.map(item => ({
            place_id: item.place_id,
            name: item.name,
            display_name: item.display_name,
            lat: item.lat,
            lon: item.lon,
            category: item.category,
            type: item.type,
            addresstype: item.addresstype,
            address: item.address
        }));
    }
}
