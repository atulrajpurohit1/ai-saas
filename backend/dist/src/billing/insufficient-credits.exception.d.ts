import { HttpException } from '@nestjs/common';
export declare class InsufficientCreditsException extends HttpException {
    readonly required: number;
    readonly available: number;
    constructor(message: string, required: number, available: number);
}
