export type CreditPackKey = 'STARTER' | 'GROWTH' | 'SCALE';
export interface CreditPack {
    key: CreditPackKey;
    label: string;
    credits: number;
    price: number;
}
export declare const CREDIT_PACKS: Record<CreditPackKey, CreditPack>;
export declare const CREDIT_PACK_KEYS: CreditPackKey[];
export declare function isCreditPackKey(value: string): value is CreditPackKey;
export declare const PLAYBOOK_CREDIT_COST = 1;
export declare function creditPackPriceEnvKey(pack: CreditPackKey): string;
export declare function creditPackPriceId(pack: CreditPackKey): string | null;
export declare function creditPackForPriceId(priceId: string): CreditPack | null;
export declare function sellableCreditPacks(): CreditPack[];
