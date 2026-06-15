export declare class OfflineActionDto {
    id: string;
    actionType: string;
    payload: Record<string, any>;
    createdAt: string;
}
export declare class SyncOfflineActionsDto {
    actions: OfflineActionDto[];
}
