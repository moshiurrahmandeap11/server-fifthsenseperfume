export interface ISizeChartRow {
    euSize: string;
    ukSize?: string;
    usSize?: string;
    footLengthCm?: number;
    footLengthInch?: number;
}

export interface ICreateSizeChartPayload {
    title: string;
    description?: string;
    guideImage?: string;
    rows: ISizeChartRow[];
}

export interface IUpdateSizeChartPayload {
    title?: string;
    description?: string;
    guideImage?: string;
    rows?: ISizeChartRow[];
}

