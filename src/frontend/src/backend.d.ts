import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Horse {
    odds: number;
    predictedProb: number;
    actualOutcome: boolean;
}
export interface Race {
    timestamp: Time;
    horses: Array<Horse>;
}
export type Time = bigint;
export interface OddsRange {
    max: number;
    min: number;
}
export interface backendInterface {
    getROI(): Promise<number>;
    getRaceHistory(): Promise<Array<Race>>;
    getTrustWeights(): Promise<Array<[OddsRange, number]>>;
    getValueBets(horses: Array<Horse>): Promise<Array<Horse>>;
    logRace(horses: Array<Horse>): Promise<void>;
}
